import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "unihubhg-tnu";
const firebaseDatabaseId = process.env.FIREBASE_DATABASE_ID || "(default)";

function firebasePrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function firebaseConfigStatus() {
  return {
    projectId: firebaseProjectId,
    databaseId: firebaseDatabaseId,
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
    throw new Error("Thiếu FIREBASE_CLIENT_EMAIL hoặc FIREBASE_PRIVATE_KEY trong .env.local.");
  }

  return initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseAdminApp(), firebaseDatabaseId);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
