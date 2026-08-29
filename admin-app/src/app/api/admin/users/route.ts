import { NextResponse } from "next/server";
import { requireAdmin, adminError, writeAuditLog } from "@/lib/admin-auth";
import { getFirebaseAdminAuth, getFirebaseDb } from "@/lib/firebase-admin";
import { serializeUser } from "@/lib/serializers";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate" };

function inactiveLongerThan(user: ReturnType<typeof serializeUser>, days: number) {
  if (!user.lastSeenAt) return false;
  const lastSeenMs = new Date(user.lastSeenAt).getTime();
  return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs >= days * 86_400_000;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingAuthUser(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "auth/user-not-found";
}

async function quotaSettings() {
  const snapshot = await getFirebaseDb().collection("app_settings").doc("system").get();
  return {
    freeDailyLimit: Math.max(0, Number(snapshot.get("defaultFreeLimit") ?? 3)),
    paidTrialDailyCredits: Math.max(0, Number(snapshot.get("paidTrialDailyCredits") ?? 10)),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const filter = searchParams.get("filter") || "all";
    const [snapshot, settings] = await Promise.all([
      getFirebaseDb().collection("users").limit(300).get(),
      quotaSettings(),
    ]);
    let users = snapshot.docs.map((doc) => serializeUser(doc, settings));
    if (query) {
      users = users.filter((user) =>
        `${user.email} ${user.displayName}`.toLowerCase().includes(query),
      );
    }
    if (filter === "remaining") users = users.filter((user) => user.remainingGenerations > 0);
    if (filter === "exhausted") users = users.filter((user) => user.remainingGenerations <= 0);
    if (filter === "admin") users = users.filter((user) => user.role === "admin");
    if (filter === "unverified") users = users.filter((user) => !user.emailVerified);
    if (filter === "disabled") users = users.filter((user) => user.disabled);
    if (filter === "ip_blocked") users = users.filter((user) => user.disabled && user.blockedReason === "ip_account_limit");
    if (filter === "online") users = users.filter((user) => user.isOnline);
    if (filter === "offline") users = users.filter((user) => !user.isOnline && Boolean(user.lastSeenAt));
    if (filter === "inactive_7d") users = users.filter((user) => !user.isOnline && inactiveLongerThan(user, 7));
    if (filter === "inactive_30d") users = users.filter((user) => !user.isOnline && inactiveLongerThan(user, 30));
    if (filter === "inactive_90d") users = users.filter((user) => !user.isOnline && inactiveLongerThan(user, 90));
    if (filter === "never_seen") users = users.filter((user) => !user.lastSeenAt);

    users.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ users }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải danh sách user.");
    return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { uids?: unknown };
    if (!Array.isArray(body.uids)) {
      return NextResponse.json({ error: "Danh sách user cần xóa không hợp lệ." }, { status: 400 });
    }

    const uids = Array.from(new Set(
      body.uids
        .filter((uid): uid is string => typeof uid === "string")
        .map((uid) => uid.trim())
        .filter(Boolean),
    ));
    if (!uids.length) return NextResponse.json({ error: "Chưa chọn user để xóa." }, { status: 400 });
    if (uids.includes(admin.uid)) {
      return NextResponse.json({ error: "Không thể xóa chính tài khoản admin đang đăng nhập." }, { status: 400 });
    }

    const db = getFirebaseDb();
    const refs = uids.map((uid) => db.collection("users").doc(uid));
    const snapshots = await Promise.all(refs.map((ref) => ref.get()));
    const foundUsers = snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => ({
        uid: snapshot.id,
        email: String(snapshot.get("email") || ""),
        role: String(snapshot.get("role") || ""),
      }));
    if (!foundUsers.length) return NextResponse.json({ error: "Không tìm thấy user để xóa." }, { status: 404 });

    await Promise.all(foundUsers.map(async (user) => {
      try {
        await getFirebaseAdminAuth().deleteUser(user.uid);
      } catch (deleteError) {
        if (!isMissingAuthUser(deleteError)) throw deleteError;
      }
    }));

    const batch = db.batch();
    foundUsers.forEach((user) => batch.delete(db.collection("users").doc(user.uid)));
    await batch.commit();

    await writeAuditLog(admin, "users.delete", {
      count: foundUsers.length,
      targetUids: foundUsers.map((user) => user.uid),
      targetEmails: foundUsers.map((user) => user.email),
      targetRoles: foundUsers.map((user) => user.role),
    });
    return NextResponse.json({ ok: true, deletedCount: foundUsers.length });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể xóa user đã chọn.");
    return NextResponse.json({ error: message }, { status });
  }
}
