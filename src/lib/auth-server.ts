import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "@/lib/model-strategy";
import { buildSubscriptionStatus, getSubscriptionSettings, initialSubscriptionFields, normalizeSubscriptionSettings, type SubscriptionStatus } from "@/lib/subscription-policy";
import { accountBlockedMessage } from "@/lib/account-block";

export const SESSION_COOKIE_NAME = "eduplan_session";
export const DEFAULT_FREE_LIMIT = 3;
export const LESSON_TTL_DAYS = 7;

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  disabled: boolean;
  blockedReason: string;
  blockedReasonDetail: string;
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
    return await getFirebaseAdminAuth().verifySessionCookie(session, true);
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
    disabled: false,
    blockedReason: "",
    blockedReasonDetail: "",
    role: "user",
    plan: "free",
    freeLimit: DEFAULT_FREE_LIMIT,
    usedGenerations: 0,
    ...initialSubscriptionFields(true),
    createdAt: now,
    updatedAt: now,
  };

  if (!snapshot.exists) {
    try {
      const systemDoc = await db.collection("app_settings").doc("system").get();
      if (systemDoc.exists) {
        const systemData = systemDoc.data() || {};
        const settings = normalizeSubscriptionSettings(systemData);
        const newProfile = {
          ...baseProfile,
          freeLimit: settings.freeDailyLimit,
          freeDailyLimit: settings.freeDailyLimit,
          paidTrialDailyLimit: settings.paidTrialDailyCredits,
          trials: {
            plusRemaining: 0,
            proRemaining: 0,
          },
        };
        await ref.set(newProfile);
        return newProfile;
      }
    } catch (e) {
      console.error("[EduPlan AI] Failed to read system settings for new user initial fields, fallback to default:", e);
    }
    await ref.set(baseProfile);
    return baseProfile;
  }

  const storedPhotoURL = String(snapshot.get("photoURL") || "");
  await ref.set(
    {
      email: baseProfile.email,
      displayName: baseProfile.displayName || snapshot.get("displayName") || "",
      photoURL: storedPhotoURL || baseProfile.photoURL,
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
  const subscription = buildSubscriptionStatus(profile, new Date(), await getSubscriptionSettings());
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
    blockedReasonDetail: String(profile.blockedReasonDetail || ""),
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
    const error = new Error(accountBlockedMessage(user.blockedReason, user.blockedReasonDetail));
    error.name = "ACCOUNT_DISABLED";
    throw error;
  }
  return user;
}
