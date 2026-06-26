import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const SESSION_COOKIE_NAME = "eduplan_session";
export const DEFAULT_FREE_LIMIT = 10;
export const LESSON_TTL_DAYS = 7;

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  disabled: boolean;
  role: "user" | "admin";
  plan: "free" | string;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
};

export function lessonExpiresAt() {
  return new Date(Date.now() + LESSON_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function sessionCookie() {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

export async function verifySessionCookie() {
  const session = await sessionCookie();
  if (!session) return null;
  try {
    return getFirebaseAdminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

export async function ensureUserProfile(decoded: DecodedIdToken) {
  const db = getFirebaseDb();
  const userRecord = await getFirebaseAdminAuth().getUser(decoded.uid);
  const ref = db.collection("users").doc(decoded.uid);
  const snapshot = await ref.get();
  const now = new Date();
  const baseProfile = {
    email: userRecord.email || decoded.email || "",
    displayName: userRecord.displayName || decoded.name || "",
    photoURL: userRecord.photoURL || decoded.picture || "",
    emailVerified: Boolean(userRecord.emailVerified),
    disabled: Boolean(userRecord.disabled),
    role: "user",
    plan: "free",
    freeLimit: DEFAULT_FREE_LIMIT,
    usedGenerations: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (!snapshot.exists) {
    await ref.set(baseProfile);
    return baseProfile;
  }

  await ref.set(
    {
      email: baseProfile.email,
      displayName: baseProfile.displayName || snapshot.get("displayName") || "",
      photoURL: baseProfile.photoURL || snapshot.get("photoURL") || "",
      emailVerified: baseProfile.emailVerified,
      disabled: baseProfile.disabled,
      updatedAt: now,
    },
    { merge: true },
  );

  const nextSnapshot = await ref.get();
  return nextSnapshot.data() || baseProfile;
}

export async function currentUser(): Promise<AuthUser | null> {
  const decoded = await verifySessionCookie();
  if (!decoded) return null;
  const profile = await ensureUserProfile(decoded);
  const freeLimit = Number(profile.freeLimit ?? DEFAULT_FREE_LIMIT);
  const usedGenerations = Number(profile.usedGenerations ?? 0);
  const disabled = Boolean(profile.disabled);

  if (disabled) {
    return {
      uid: decoded.uid,
      email: String(profile.email || decoded.email || ""),
      displayName: String(profile.displayName || decoded.name || ""),
      photoURL: String(profile.photoURL || decoded.picture || ""),
      emailVerified: Boolean(profile.emailVerified),
      disabled,
      role: profile.role === "admin" ? "admin" : "user",
      plan: String(profile.plan || "free"),
      freeLimit,
      usedGenerations,
      remainingGenerations: 0,
    };
  }

  return {
    uid: decoded.uid,
    email: String(profile.email || decoded.email || ""),
    displayName: String(profile.displayName || decoded.name || ""),
    photoURL: String(profile.photoURL || decoded.picture || ""),
    emailVerified: Boolean(profile.emailVerified),
    disabled,
    role: profile.role === "admin" ? "admin" : "user",
    plan: String(profile.plan || "free"),
    freeLimit,
    usedGenerations,
    remainingGenerations: Math.max(0, freeLimit - usedGenerations),
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    const error = new Error("Bạn cần đăng nhập để sử dụng tính năng này.");
    error.name = "UNAUTHENTICATED";
    throw error;
  }
  if (user.disabled) {
    const error = new Error("Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn.");
    error.name = "ACCOUNT_DISABLED";
    throw error;
  }
  return user;
}

export async function incrementGenerationUsage(uid: string) {
  await getFirebaseDb().collection("users").doc(uid).set(
    {
      usedGenerations: FieldValue.increment(1),
      updatedAt: new Date(),
    },
    { merge: true },
  );
}
