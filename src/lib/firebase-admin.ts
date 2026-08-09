import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "unihubhg-tnu";
const firebaseDatabaseId = process.env.FIREBASE_DATABASE_ID || "(default)";
const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET
  || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  || (firebaseProjectId ? `${firebaseProjectId}.firebasestorage.app` : "");

function firebasePrivateKey() {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawKey) return undefined;
  // Loại bỏ các dấu nháy kép hoặc đơn ở đầu và cuối chuỗi nếu có
  const cleaned = rawKey.replace(/^['"]|['"]$/g, "");
  return cleaned.replace(/\\n/g, "\n");
}

export function firebaseConfigStatus() {
  return {
    projectId: firebaseProjectId,
    databaseId: firebaseDatabaseId,
    storageBucket: firebaseStorageBucket,
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(firebasePrivateKey()),
  };
}

export function getFirebaseAdminApp() {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = firebasePrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error("Máy chủ chưa cấu hình đầy đủ Firebase Admin.");
  }

  return initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail,
      privateKey,
    }),
    ...(firebaseStorageBucket ? { storageBucket: firebaseStorageBucket } : {}),
  });
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseAdminApp(), firebaseDatabaseId);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseStorageBucket() {
  if (!firebaseStorageBucket) {
    throw new Error("Máy chủ chưa cấu hình Firebase Storage bucket.");
  }
  return getStorage(getFirebaseAdminApp()).bucket(firebaseStorageBucket);
}
