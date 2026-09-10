import type { User } from "firebase/auth";

export type GoogleAuthStrategy = "popup" | "redirect";

type GoogleAuthRuntime = {
  isElectron?: boolean;
  userAgent?: string;
  userAgentDataMobile?: boolean;
  maxTouchPoints?: number;
};

type CompleteAuthSessionOptions = {
  user: Pick<User, "getIdToken">;
  fetcher?: typeof fetch;
};

type CompleteFirebaseAuthSessionOptions = {
  user: Pick<User, "getIdToken"> | null;
  onSessionReady: () => Promise<void> | void;
  fetcher?: typeof fetch;
};

const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini/i;
const IPAD_DESKTOP_USER_AGENT = /Macintosh/i;

export function resolveGoogleAuthStrategy(runtime: GoogleAuthRuntime): GoogleAuthStrategy {
  if (runtime.isElectron) return "popup";
  if (runtime.userAgentDataMobile === true) return "redirect";

  const userAgent = runtime.userAgent || "";
  if (MOBILE_USER_AGENT.test(userAgent)) return "redirect";
  if (IPAD_DESKTOP_USER_AGENT.test(userAgent) && (runtime.maxTouchPoints || 0) > 1) {
    return "redirect";
  }

  return "popup";
}

export function getGoogleAuthStrategy(): GoogleAuthStrategy {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "popup";

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  return resolveGoogleAuthStrategy({
    isElectron: Boolean(window.eduplanDesktop),
    userAgent: navigator.userAgent,
    userAgentDataMobile: navigatorWithUserAgentData.userAgentData?.mobile,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export async function createServerAuthSession({
  user,
  fetcher = fetch,
}: CompleteAuthSessionOptions) {
  const idToken = await user.getIdToken(true);
  if (!idToken) throw new Error("Không lấy được phiên đăng nhập.");

  const response = await fetcher("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || "Không thể tạo phiên đăng nhập.");
  }
}

export async function completeFirebaseAuthSession({
  user,
  onSessionReady,
  fetcher,
}: CompleteFirebaseAuthSessionOptions) {
  if (!user) return false;

  await createServerAuthSession({ user, fetcher });
  await onSessionReady();
  return true;
}
