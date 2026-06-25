"use client";

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

type PublicFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

let configPromise: Promise<PublicFirebaseConfig> | null = null;

async function loadConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/firebase-config")
      .then((response) => response.json())
      .then((result: { config: PublicFirebaseConfig }) => result.config);
  }
  return configPromise;
}

export async function getFirebaseClientApp(): Promise<FirebaseApp> {
  if (getApps().length) return getApp();
  const config = await loadConfig();
  return initializeApp(config);
}

export async function getFirebaseClientAuth() {
  const auth = getAuth(await getFirebaseClientApp());
  auth.languageCode = "vi";
  return auth;
}

export const googleAuthProvider = new GoogleAuthProvider();
