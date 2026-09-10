import { describe, expect, it, vi } from "vitest";
import {
  completeFirebaseAuthSession,
  createServerAuthSession,
  resolveGoogleAuthStrategy,
} from "./auth-client";

describe("Google authentication strategy", () => {
  it("uses redirect for Android and iPhone web browsers", () => {
    expect(resolveGoogleAuthStrategy({
      userAgent: "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
    })).toBe("redirect");
    expect(resolveGoogleAuthStrategy({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    })).toBe("redirect");
  });

  it("recognizes modern mobile hints and iPad desktop mode", () => {
    expect(resolveGoogleAuthStrategy({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      userAgentDataMobile: true,
    })).toBe("redirect");
    expect(resolveGoogleAuthStrategy({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      maxTouchPoints: 5,
    })).toBe("redirect");
  });

  it("keeps popup for desktop browsers and always for Electron", () => {
    const desktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";
    expect(resolveGoogleAuthStrategy({ userAgent: desktopUserAgent })).toBe("popup");
    expect(resolveGoogleAuthStrategy({
      isElectron: true,
      userAgent: "Mozilla/5.0 (Linux; Android 16) Mobile",
      userAgentDataMobile: true,
    })).toBe("popup");
  });

  it("falls back conservatively to popup when runtime data is missing", () => {
    expect(resolveGoogleAuthStrategy({})).toBe("popup");
  });
});

describe("Firebase server session completion", () => {
  it("posts a fresh ID token to the server session endpoint", async () => {
    const getIdToken = vi.fn(async () => "firebase-id-token");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    await createServerAuthSession({ user: { getIdToken }, fetcher });

    expect(getIdToken).toHaveBeenCalledOnce();
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "firebase-id-token" }),
    });
  });

  it("does nothing when a redirect returns no Firebase user", async () => {
    const fetcher = vi.fn();
    const onSessionReady = vi.fn();

    await expect(completeFirebaseAuthSession({
      user: null,
      fetcher,
      onSessionReady,
    })).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onSessionReady).not.toHaveBeenCalled();
  });

  it("notifies the app only after a successful server session", async () => {
    const events: string[] = [];
    const fetcher = vi.fn(async () => {
      events.push("session");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const onSessionReady = vi.fn(() => {
      events.push("ready");
    });

    await expect(completeFirebaseAuthSession({
      user: { getIdToken: vi.fn(async () => "token") },
      fetcher,
      onSessionReady,
    })).resolves.toBe(true);
    expect(events).toEqual(["session", "ready"]);
    expect(onSessionReady).toHaveBeenCalledOnce();
  });

  it("surfaces server errors without notifying the app", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: "Tài khoản bị khóa.",
    }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
    const onSessionReady = vi.fn();

    await expect(completeFirebaseAuthSession({
      user: { getIdToken: vi.fn(async () => "token") },
      fetcher,
      onSessionReady,
    })).rejects.toThrow("Tài khoản bị khóa.");
    expect(onSessionReady).not.toHaveBeenCalled();
  });
});
