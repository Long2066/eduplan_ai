import "server-only";

import { createHash } from "crypto";
import { buildSubscriptionStatus } from "@/lib/subscription-policy";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const IP_ACCOUNT_LIMIT_MESSAGE = "Bạn đang sử dụng quá nhiều tài khoản để truy cập, vui lòng chỉ sử dụng 1 tài khoản để truy cập. Trân trọng.";

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT || process.env.FIREBASE_PROJECT_ID || "eduplan-ip-policy";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function accessDocId(ipHash: string, uid: string) {
  return createHash("sha256").update(`${ipHash}:${uid}`).digest("hex");
}

export async function enforceFreeTrialIpLimit(request: Request, uid: string) {
  const db = getFirebaseDb();
  const auth = getFirebaseAdminAuth();
  const profileRef = db.collection("users").doc(uid);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data() || {};
  if (profile.role === "admin" || profile.ipLimitOverride === true || buildSubscriptionStatus(profile).planStatus === "paid") return;

  const ip = clientIp(request);
  if (ip === "unknown") return;
  const ipHash = hashIp(ip);
  const accessCollection = db.collection("freeTrialIpAccess");
  const accessRef = accessCollection.doc(accessDocId(ipHash, uid));
  const existingAccess = await accessRef.get();

  if (!existingAccess.exists) {
    const accessSnapshot = await accessCollection.where("ipHash", "==", ipHash).limit(20).get();
    const otherUids = Array.from(new Set(accessSnapshot.docs.map((doc) => String(doc.get("uid") || "")).filter((id) => id && id !== uid)));
    const otherProfiles = await Promise.all(otherUids.map((id) => db.collection("users").doc(id).get()));
    const activeFreeTrialAccounts = otherProfiles.filter((snapshot) => {
      if (!snapshot.exists) return false;
      const data = snapshot.data() || {};
      return data.role !== "admin" && !data.disabled && data.ipLimitOverride !== true && buildSubscriptionStatus(data).planStatus !== "paid";
    });

    if (activeFreeTrialAccounts.length >= 2) {
      const now = new Date();
      await profileRef.set({ disabled: true, blockedReason: "ip_account_limit", blockedAt: now, lastLoginIpHash: ipHash, updatedAt: now }, { merge: true });
      await accessRef.set({ uid, ipHash, status: "blocked", firstSeenAt: now, lastSeenAt: now }, { merge: true });
      await db.collection("securityEvents").add({ uid, type: "ip_account_limit", ipHash, relatedUids: activeFreeTrialAccounts.map((snapshot) => snapshot.id), createdAt: now });
      await auth.revokeRefreshTokens(uid);
      throw new Error(IP_ACCOUNT_LIMIT_MESSAGE);
    }
  }

  const now = new Date();
  await Promise.all([
    accessRef.set({ uid, ipHash, status: "allowed", firstSeenAt: existingAccess.get("firstSeenAt") || now, lastSeenAt: now }, { merge: true }),
    profileRef.set({ lastLoginIpHash: ipHash, lastLoginAt: now, updatedAt: now }, { merge: true }),
  ]);
}
