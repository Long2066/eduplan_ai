import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const ACTIVE_PAYMENT_STATUSES = new Set([
  "awaiting_proof",
  "precheck_failed",
  "pending_review",
]);

function privateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return "";
  return raw.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
}

function nonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function userPatch(data) {
  const patch = {};
  for (const field of ["activePlan", "paidPlan", "plan"]) {
    if (data[field] === "pro") patch[field] = "plus";
  }
  if (data.trials && Object.prototype.hasOwnProperty.call(data.trials, "proRemaining")) {
    patch["trials.plusRemaining"] = nonNegativeNumber(data.trials.plusRemaining)
      + nonNegativeNumber(data.trials.proRemaining);
    patch["trials.proRemaining"] = 0;
  }
  return patch;
}

function firebaseApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const key = privateKey();
  if (!projectId || !clientEmail || !key) {
    throw new Error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.");
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey: key }) });
}

async function legacyUsers(db) {
  const users = new Map();
  for (const field of ["activePlan", "paidPlan", "plan"]) {
    const snapshot = await db.collection("users").where(field, "==", "pro").get();
    for (const doc of snapshot.docs) users.set(doc.id, doc);
  }

  // Trial-only legacy documents are uncommon, so include them without requiring
  // a Firestore composite index or rewriting unrelated users.
  const trialSnapshot = await db.collection("users").where("trials.proRemaining", ">", 0).get();
  for (const doc of trialSnapshot.docs) users.set(doc.id, doc);
  return [...users.values()];
}

async function legacyPayments(db) {
  const snapshot = await db.collection("paymentRequests").where("targetPlan", "==", "pro").get();
  return snapshot.docs.filter((doc) => ACTIVE_PAYMENT_STATUSES.has(String(doc.get("status") || "")));
}

async function applyUpdates(db, updates) {
  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = db.batch();
    for (const update of updates.slice(offset, offset + 400)) {
      batch.update(update.ref, update.patch);
    }
    await batch.commit();
  }
}

async function main() {
  const databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
  const db = getFirestore(firebaseApp(), databaseId);
  const userDocs = await legacyUsers(db);
  const paymentDocs = await legacyPayments(db);
  const updates = [
    ...userDocs.map((doc) => ({ ref: doc.ref, patch: userPatch(doc.data()), kind: "user" })),
    ...paymentDocs.map((doc) => ({ ref: doc.ref, patch: { targetPlan: "plus" }, kind: "payment" })),
  ].filter((item) => Object.keys(item.patch).length > 0);

  const counts = updates.reduce((result, item) => {
    result[item.kind] += 1;
    return result;
  }, { user: 0, payment: 0 });

  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", databaseId, ...counts, total: updates.length }, null, 2));
  if (!APPLY) {
    console.log("No writes performed. Re-run with --apply after reviewing the counts.");
    return;
  }

  await applyUpdates(db, updates);
  console.log(`Migration completed: ${updates.length} documents updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
