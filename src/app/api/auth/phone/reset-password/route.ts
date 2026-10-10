import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { phoneToInternalEmail } from "@/lib/phone-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export async function POST(request: Request) {
  try {
    const { idToken, newPassword } = (await request.json()) as {
      idToken?: string;
      newPassword?: string;
    };

    if (!idToken) {
      return NextResponse.json({ error: "Thiếu mã xác thực OTP." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới cần tối thiểu 6 ký tự." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;

    if (!phoneNumber) {
      return NextResponse.json({ error: "Xác thực số điện thoại không hợp lệ." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const internalEmail = phoneToInternalEmail(phoneNumber);

    // Update password and ensure internal email is set
    await auth.updateUser(decoded.uid, {
      password: newPassword,
      email: internalEmail,
    });

    const now = new Date();
    await getFirebaseDb().collection("users").doc(decoded.uid).set(
      {
        phoneNumber,
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json(
      { ok: true, message: "Đã cập nhật mật khẩu thành công." },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[Phone Reset Password Error]", error);
    const message = error instanceof Error ? error.message : "Không thể đặt lại mật khẩu lúc này.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
