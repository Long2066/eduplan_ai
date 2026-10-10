import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import {
  isValidVietnamesePhoneNumber,
  normalizePhoneNumber,
  phoneToInternalEmail,
} from "@/lib/phone-utils";
import { enforceFreeTrialIpLimit } from "@/lib/ip-abuse-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

export async function POST(request: Request) {
  try {
    const { phoneNumber, password, displayName, recoveryCode } = (await request.json()) as {
      phoneNumber?: string;
      password?: string;
      displayName?: string;
      recoveryCode?: string;
    };

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập họ và tên của bạn." },
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
        { error: "Số điện thoại không đúng định dạng nhà mạng Việt Nam (10 chữ số, đầu số 03, 05, 07, 08, 09)." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu cần tối thiểu 6 ký tự." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const trimmedCode = (recoveryCode || "").trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: "Vui lòng nhập mã code tùy chỉnh đúng 6 chữ số để khôi phục mật khẩu sau này." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const internalEmail = phoneToInternalEmail(normalized);
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseDb();

    // Check duplicate phone in Firebase Auth or Firestore
    let alreadyExists = false;
    try {
      const user = await auth.getUserByEmail(internalEmail);
      if (user?.uid) alreadyExists = true;
    } catch {
      // not found in Auth
    }

    if (!alreadyExists) {
      const snapshot = await db
        .collection("users")
        .where("phoneNumber", "==", normalized)
        .limit(1)
        .get();
      if (!snapshot.empty) alreadyExists = true;
    }

    if (alreadyExists) {
      return NextResponse.json(
        { error: "Số điện thoại này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const nameToUse = displayName.trim();

    // Create Firebase Auth user with email & password (Spark-compatible, 0 SMS OTP)
    const userRecord = await auth.createUser({
      email: internalEmail,
      password,
      displayName: nameToUse,
    });

    const now = new Date();
    await db.collection("users").doc(userRecord.uid).set(
      {
        phoneNumber: normalized,
        email: internalEmail,
        displayName: nameToUse,
        recoveryCode: trimmedCode,
        presenceState: "online",
        lastSeenAt: now,
        lastOnlineAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await enforceFreeTrialIpLimit(request, userRecord.uid);

    // Create custom token so client can sign in immediately
    const customToken = await auth.createCustomToken(userRecord.uid);

    return NextResponse.json({ ok: true, customToken }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[Phone Register API Error]", error);
    const message = error instanceof Error ? error.message : "Không thể hoàn tất đăng ký số điện thoại.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
