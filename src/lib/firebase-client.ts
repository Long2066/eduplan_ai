"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { type ActionCodeSettings, getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const firebaseDatabaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";

export function hasFirebaseClientConfig() {
  return Object.values(firebaseClientConfig).every(Boolean);
}

export function getFirebaseClientApp() {
  if (!hasFirebaseClientConfig()) {
    throw new Error("Thiếu Firebase Web App config. Hãy điền NEXT_PUBLIC_FIREBASE_* trong .env.local.");
  }
  return getApps().length ? getApp() : initializeApp(firebaseClientConfig);
}

export function getFirebaseClientAuth() {
  const auth = getAuth(getFirebaseClientApp());
  auth.languageCode = "vi";
  return auth;
}

export function getFirebaseClientDb() {
  return getFirestore(getFirebaseClientApp(), firebaseDatabaseId);
}

export function getEmailActionSettings(): ActionCodeSettings | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    url: `${window.location.origin}/`,
    handleCodeInApp: false,
  };
}

export const googleAuthProvider = new GoogleAuthProvider();
