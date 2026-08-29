import "server-only";

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { SECURITY_SCHEMA_VERSION } from "@shared/security-contract";
import { buildSubscriptionStatus } from "@/lib/subscription-policy";
import { requestIpHash } from "@/lib/security-context";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const IP_ACCOUNT_LIMIT_MESSAGE = "Bạn đang sử dụng quá nhiều tài khoản để truy cập, vui lòng chỉ sử dụng 1 tài khoản để truy cập. Trân trọng.";
const FREE_TRIAL_IP_ACCOUNT_LIMIT = 2;
const MAX_IP_CLUSTER_READS = 50;

function accessDocId(ipHash: string, uid: string) {
  return createHash("sha256").update(`${ipHash}:${uid}`).digest("hex");
}

function isExemptProfile(profile: Record<string, unknown>) {
  return profile.role === "admin"
    || profile.ipLimitOverride === true
    || buildSubscriptionStatus(profile).planStatus === "paid";
}

function isActiveFreeTrialProfile(profile: Record<string, unknown>) {
  return !isExemptProfile(profile) && !profile.disabled;
}

export async function enforceFreeTrialIpLimit(request: Request, uid: string) {
  const db = getFirebaseDb();
  const auth = getFirebaseAdminAuth();
  const profileRef = db.collection("users").doc(uid);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data() || {};
  if (isExemptProfile(profile)) return;

  const ipHash = requestIpHash(request);
  if (!ipHash) return;

  const accessCollection = db.collection("freeTrialIpAccess");
  const accessRef = accessCollection.doc(accessDocId(ipHash, uid));
  const accessSnapshot = await accessCollection
    .where("ipHash", "==", ipHash)
    .limit(MAX_IP_CLUSTER_READS)
    .get();
  const otherUids = Array.from(new Set(
    accessSnapshot.docs
      .map((doc) => String(doc.get("uid") || ""))
      .filter((id) => id && id !== uid),
  ));
  const otherProfiles = await Promise.all(
    otherUids.map((id) => db.collection("users").doc(id).get()),
  );
  const activeFreeTrialUids = otherProfiles
    .filter((snapshot) => snapshot.exists && isActiveFreeTrialProfile(snapshot.data() || {}))
    .map((snapshot) => snapshot.id);
  const blocked = activeFreeTrialUids.length >= FREE_TRIAL_IP_ACCOUNT_LIMIT;
  const now = new Date();
  const eventRef = blocked ? db.collection("securityEvents").doc() : null;

  // The transaction validates the current profile state and writes the decision as
  // one unit. The bounded cluster read above avoids unbounded login-time scans.
  await db.runTransaction(async (transaction) => {
    const [freshProfile, freshAccess] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(accessRef),
    ]);
    const freshData = freshProfile.data() || {};
    if (!freshProfile.exists || isExemptProfile(freshData)) return;

    const firstSeenAt = freshAccess.get("firstSeenAt") || now;
    transaction.set(accessRef, {
      schemaVersion: SECURITY_SCHEMA_VERSION,
      uid,
      ipHash,
      status: blocked ? "blocked" : "allowed",
      firstSeenAt,
      lastSeenAt: now,
    }, { merge: true });

    transaction.set(profileRef, {
      ...(blocked ? {
        disabled: true,
        blockedReason: "ip_account_limit",
        blockedReasonDetail: IP_ACCOUNT_LIMIT_MESSAGE,
        blockedAt: now,
        presenceState: "offline",
      } : {
        lastLoginAt: now,
      }),
      lastLoginIpHash: ipHash,
      updatedAt: now,
    }, { merge: true });

    if (blocked && eventRef) {
      transaction.create(eventRef, {
        schemaVersion: SECURITY_SCHEMA_VERSION,
        uid,
        type: "ip_account_limit",
        ipHash,
        relatedUids: activeFreeTrialUids,
        reviewStatus: "open",
        reviewNote: "",
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  if (blocked) {
    await auth.revokeRefreshTokens(uid);
    throw new Error(IP_ACCOUNT_LIMIT_MESSAGE);
  }

  // Keep compatibility with older readers that inspect this field while the new
  // security console uses the decision written in the transaction above.
  await profileRef.set({ securitySchemaVersion: SECURITY_SCHEMA_VERSION }, { merge: true }).catch(() => undefined);
}

export async function touchFreeTrialIpAccess(ipHash: string, uid: string) {
  if (!ipHash) return;
  await getFirebaseDb().collection("freeTrialIpAccess").doc(accessDocId(ipHash, uid)).set({
    schemaVersion: SECURITY_SCHEMA_VERSION,
    uid,
    ipHash,
    lastSeenAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
