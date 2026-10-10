import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

import { normalizePhoneNumber, isValidPhoneNumber } from "@/lib/phone-utils";

export async function POST(request: Request) {
  try {
    const { phoneNumber, intent } = (await request.json()) as {
      phoneNumber?: string;
      intent?: "login" | "register";
    };

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Vui lòng nhập số điện thoại." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(normalized)) {
      return NextResponse.json(
        { error: "Số điện thoại không đúng định dạng. Vui lòng nhập số hợp lệ (ví dụ: 0912345678)." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseDb();
    let exists = false;

    try {
      const userRecord = await auth.getUserByPhoneNumber(normalized);
      if (userRecord && userRecord.uid) {
        exists = true;
      }
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : "";
      if (code !== "auth/user-not-found") {
        console.error("[Phone Check Auth Error]", e);
      }
    }

    if (!exists) {
      const snapshot = await db
        .collection("users")
        .where("phoneNumber", "==", normalized)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        exists = true;
      }
    }

    if (intent === "register" && exists) {
      return NextResponse.json(
        {
          error: "Số điện thoại này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập.",
          code: "PHONE_ALREADY_EXISTS",
          exists: true,
          formattedPhone: normalized,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (intent === "login" && !exists) {
      return NextResponse.json(
        {
          error: "Số điện thoại này chưa được đăng ký tài khoản. Vui lòng chọn Đăng ký.",
          code: "PHONE_NOT_FOUND",
          exists: false,
          formattedPhone: normalized,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: true, exists, formattedPhone: normalized },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[Phone Check API Error]", error);
    const message = error instanceof Error ? error.message : "Không thể kiểm tra số điện thoại lúc này.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
