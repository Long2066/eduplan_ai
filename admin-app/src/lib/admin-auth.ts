import "server-only";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";

export const ADMIN_SESSION_COOKIE = "eduplan_admin_session";
const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;

export type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin";
};

async function sessionCookie() {
  return (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
}

export async function createAdminSession(idToken: string) {
  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const profile = await getFirebaseDb().collection("users").doc(decoded.uid).get();
  if (profile.get("role") !== "admin") {
    throw new Error("Tài khoản này chưa được cấp quyền admin.");
  }
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN });
}

export async function setAdminSessionCookie(sessionCookieValue: string) {
  (await cookies()).set(ADMIN_SESSION_COOKIE, sessionCookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRES_IN / 1000,
    path: "/",
  });
}

export async function clearAdminSessionCookie() {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const session = await sessionCookie();
  if (!session) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(session, true);
    const profile = await getFirebaseDb().collection("users").doc(decoded.uid).get();
    if (profile.get("role") !== "admin") return null;
    return {
      uid: decoded.uid,
      email: String(profile.get("email") || decoded.email || ""),
      displayName: String(profile.get("displayName") || decoded.name || ""),
      role: "admin",
    };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) {
    const error = new Error("Bạn cần đăng nhập bằng tài khoản admin.");
    error.name = "UNAUTHORIZED_ADMIN";
    throw error;
  }
  return admin;
}

export async function writeAuditLog(admin: AdminUser, action: string, detail: Record<string, unknown>) {
  await getFirebaseDb().collection("admin_audit_logs").add({
    action,
    adminUid: admin.uid,
    adminEmail: admin.email,
    detail,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function adminError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof Error && error.name === "UNAUTHORIZED_ADMIN" ? 401 : 500;
  return { message, status };
}
