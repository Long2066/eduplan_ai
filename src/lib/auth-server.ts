import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/model-strategy";
import { buildSubscriptionStatus, initialSubscriptionFields, type SubscriptionStatus } from "@/lib/subscription-policy";

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
  blockedReason: string;
  role: "user" | "admin";
  plan: SubscriptionPlan;
  freeLimit: number;
  usedGenerations: number;
  remainingGenerations: number;
  subscription: SubscriptionStatus;
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
    blockedReason: "",
    role: "user",
    plan: "free",
    freeLimit: DEFAULT_FREE_LIMIT,
    usedGenerations: 0,
    ...initialSubscriptionFields(true),
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
      disabled: Boolean(userRecord.disabled || snapshot.get("disabled")),
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
  const subscription = buildSubscriptionStatus(profile);
  const disabled = Boolean(profile.disabled);
  const freeLimit = subscription.free.limit;
  const usedGenerations = subscription.free.used;
  const activeCard = subscription.cards.find((card) => card.id === subscription.activePlan);

  return {
    uid: decoded.uid,
    email: String(profile.email || decoded.email || ""),
    displayName: String(profile.displayName || decoded.name || ""),
    photoURL: String(profile.photoURL || decoded.picture || ""),
    emailVerified: Boolean(profile.emailVerified),
    disabled,
    blockedReason: String(profile.blockedReason || ""),
    role: profile.role === "admin" ? "admin" : "user",
    plan: normalizeSubscriptionPlan(subscription.activePlan),
    freeLimit,
    usedGenerations,
    remainingGenerations: disabled ? 0 : Math.max(0, activeCard?.remaining || 0),
    subscription,
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
    const message = user.blockedReason === "ip_account_limit"
      ? "Bạn đang sử dụng quá nhiều tài khoản để truy cập, vui lòng chỉ sử dụng 1 tài khoản để truy cập. Trân trọng."
      : "Tài khoản của bạn bị khóa, vui lòng liên hệ hỗ trợ kĩ thuật 0342 733 640 nếu bạn cho là bị nhầm lẫn.";
    const error = new Error(message);
    error.name = "ACCOUNT_DISABLED";
    throw error;
  }
  return user;
}


