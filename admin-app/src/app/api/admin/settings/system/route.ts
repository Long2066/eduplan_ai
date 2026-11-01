import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminError, requireAdmin, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serializers";
import { normalizeAiGatewaySettings, type AiGatewaySettings } from "@shared/ai-gateway-catalog";

export const runtime = "nodejs";

const fallbackSystemSettings = {
  defaultFreeLimit: 3,
  paidTrialDailyCredits: 10,
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
        defaultFreeLimit: Number(data.defaultFreeLimit ?? fallbackSystemSettings.defaultFreeLimit),
        paidTrialDailyCredits: Number(data.paidTrialDailyCredits ?? fallbackSystemSettings.paidTrialDailyCredits),
        featureFlags: {
          ...fallbackSystemSettings.featureFlags,
          ...(data.featureFlags || {}),
        },
        aiGateway: normalizeAiGatewaySettings(data.aiGateway),
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
      paidTrialDailyCredits?: number;
      featureFlags?: Record<string, boolean>;
      aiGateway?: Partial<AiGatewaySettings>;
    };
    const system = {
      defaultFreeLimit: Math.min(1000, Math.max(0, Number(body.defaultFreeLimit ?? fallbackSystemSettings.defaultFreeLimit))),
      paidTrialDailyCredits: Math.min(1000, Math.max(0, Number(body.paidTrialDailyCredits ?? fallbackSystemSettings.paidTrialDailyCredits))),
      featureFlags: {
        feedbackWidget: Boolean(body.featureFlags?.feedbackWidget),
        lessonHistory: Boolean(body.featureFlags?.lessonHistory),
        exportFiles: Boolean(body.featureFlags?.exportFiles),
      },
      aiGateway: normalizeAiGatewaySettings(body.aiGateway),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };
    await getFirebaseDb().collection("app_settings").doc("system").set(system, { merge: true });
    await writeAuditLog(admin, "system.update", {
      defaultFreeLimit: system.defaultFreeLimit,
      paidTrialDailyCredits: system.paidTrialDailyCredits,
      featureFlags: system.featureFlags,
      aiGateway: {
        enabled: system.aiGateway.enabled,
        baseUrl: system.aiGateway.baseUrl,
        routingMode: system.aiGateway.routingMode,
        freeModel: system.aiGateway.freeModel,
        freeOcrModel: system.aiGateway.freeOcrModel,
        plusModel: system.aiGateway.plusModel,
        plusOcrModel: system.aiGateway.plusOcrModel,
        openaiFreeModel: system.aiGateway.openaiFreeModel,
        openaiFreeOcrModel: system.aiGateway.openaiFreeOcrModel,
        openaiPlusModel: system.aiGateway.openaiPlusModel,
        openaiPlusOcrModel: system.aiGateway.openaiPlusOcrModel,
      },
    });
    return NextResponse.json({ system });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể lưu cấu hình hệ thống.");
    return NextResponse.json({ error: message }, { status });
  }
}
