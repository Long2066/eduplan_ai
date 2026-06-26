import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";

export const runtime = "nodejs";

const fallbackSystemSettings = {
  defaultFreeLimit: 10,
  featureFlags: {
    feedbackWidget: true,
    lessonHistory: true,
    exportFiles: true,
  },
};

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb().collection("app_settings").doc("system").get();
    const data = snapshot.data() || {};
    return NextResponse.json({
      system: {
        ...fallbackSystemSettings,
        ...data,
        featureFlags: {
          ...fallbackSystemSettings.featureFlags,
          ...(data.featureFlags || {}),
        },
        updatedAt: toIso(data.updatedAt),
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải cấu hình hệ thống.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as {
      defaultFreeLimit?: number;
      featureFlags?: Record<string, boolean>;
    };
    const system = {
      defaultFreeLimit: Math.min(1000, Math.max(0, Number(body.defaultFreeLimit ?? fallbackSystemSettings.defaultFreeLimit))),
      featureFlags: {
        feedbackWidget: Boolean(body.featureFlags?.feedbackWidget),
        lessonHistory: Boolean(body.featureFlags?.lessonHistory),
        exportFiles: Boolean(body.featureFlags?.exportFiles),
      },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };
    await getFirebaseDb().collection("app_settings").doc("system").set(system, { merge: true });
    await writeAuditLog(admin, "system.update", {
      defaultFreeLimit: system.defaultFreeLimit,
      featureFlags: system.featureFlags,
    });
    return NextResponse.json({ system });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể lưu cấu hình hệ thống.");
    return NextResponse.json({ error: message }, { status });
  }
}
