import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import {
  isValidVietnamesePhoneNumber,
  normalizePhoneNumber,
  phoneToInternalEmail,
} from "@/lib/phone-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export async function POST(request: Request) {
  try {
    const { phoneNumber, displayName, recoveryCode, newPassword } = (await request.json()) as {
      phoneNumber?: string;
      displayName?: string;
      recoveryCode?: string;
      newPassword?: string;
    };

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập họ và tên tài khoản." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập số điện thoại." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!isValidVietnamesePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: "Số điện thoại không đúng định dạng nhà mạng Việt Nam." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const trimmedCode = (recoveryCode || "").trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: "Mã khôi phục phải gồm đúng 6 chữ số." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới cần tối thiểu 6 ký tự." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseDb();

    let targetUid: string | null = null;
    let targetData: FirebaseFirestore.DocumentData | null = null;

    // Find user in Firestore by phoneNumber
    const snapshot = await db
      .collection("users")
      .where("phoneNumber", "==", normalized)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      targetUid = doc.id;
      targetData = doc.data();
    } else {
      // Fallback check by internal email in Firebase Auth
      const internalEmail = phoneToInternalEmail(normalized);
      try {
        const authUser = await auth.getUserByEmail(internalEmail);
        if (authUser?.uid) {
          targetUid = authUser.uid;
          const userDoc = await db.collection("users").doc(authUser.uid).get();
          if (userDoc.exists) targetData = userDoc.data() || null;
        }
      } catch {
        // user not found
      }
    }

    const mismatchError = "Thông tin Họ tên, Số điện thoại hoặc Mã khôi phục chưa chính xác. Vui lòng kiểm tra lại.";

    if (!targetUid || !targetData) {
      return NextResponse.json({ error: mismatchError }, { status: 400, headers: NO_STORE_HEADERS });
    }

    // Verify displayName (case-insensitive, trimmed, normalized whitespace)
    const storedName = String(targetData.displayName || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    const inputName = displayName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    if (!storedName || storedName !== inputName) {
      return NextResponse.json({ error: mismatchError }, { status: 400, headers: NO_STORE_HEADERS });
    }

    // Verify 6-digit recoveryCode
    const storedRecoveryCode = String(targetData.recoveryCode || "").trim();
    if (!storedRecoveryCode || storedRecoveryCode !== trimmedCode) {
      return NextResponse.json({ error: mismatchError }, { status: 400, headers: NO_STORE_HEADERS });
    }

    // All 3 matched! Update password on Firebase Auth
    const internalEmail = phoneToInternalEmail(normalized);
    await auth.updateUser(targetUid, {
      password: newPassword,
      email: internalEmail,
    });

    const now = new Date();
    await db.collection("users").doc(targetUid).set(
      {
        phoneNumber: normalized,
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json(
      { ok: true, message: "Đã đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay." },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[Phone Reset Password Error]", error);
    const message = error instanceof Error ? error.message : "Không thể đặt lại mật khẩu lúc này.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
