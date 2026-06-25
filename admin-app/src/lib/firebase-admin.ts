import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadSharedEnv } from "@/lib/env";

loadSharedEnv();

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const firebaseDatabaseId = process.env.FIREBASE_DATABASE_ID || "(default)";

function firebasePrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = firebasePrivateKey();
  if (!firebaseProjectId || !clientEmail || !privateKey) {
    throw new Error("Thiếu cấu hình Firebase Admin trong .env.local của tool chính.");
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

export function getFirebasePublicConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseProjectId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}
