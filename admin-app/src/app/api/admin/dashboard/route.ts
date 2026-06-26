import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { adminError, requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

function vietnamDateKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function lastVietnamDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
}

function docDateKey(value: unknown) {
  const maybeTimestamp = value as { toDate?: () => Date };
  const date = typeof maybeTimestamp?.toDate === "function" ? maybeTimestamp.toDate() : value instanceof Date ? value : null;
  if (!date) return "";
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function countByDate<T>(items: T[], keys: string[], getKey: (item: T) => string) {
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const item of items) {
    const key = getKey(item);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return keys.map((date) => ({ date, value: counts.get(date) || 0 }));
}

export async function GET() {
  try {
    await requireAdmin();
    const db = getFirebaseDb();
    const today = vietnamDateKey();
    const dateKeys = lastVietnamDateKeys(7);
    const weekStart = dateKeys[0];
    const [users, visitsDoc, lessons, feedback, audits, errorLogs, visitDocs] = await Promise.all([
      db.collection("users").get(),
      db.collection("analytics_daily_visits").doc(today).get(),
      db.collection("lessons").limit(2000).get(),
      db.collection("feedback").limit(1000).get(),
      db.collection("admin_audit_logs").limit(50).get(),
      db.collection("app_error_logs").limit(20).get(),
      Promise.all(dateKeys.map((key) => db.collection("analytics_daily_visits").doc(key).get())),
    ]);

    const verifiedUsers = users.docs.filter((doc) => Boolean(doc.get("emailVerified"))).length;
    const newUsersToday = users.docs.filter((doc) => docDateKey(doc.get("createdAt")) === today).length;
    const newUsersThisWeek = users.docs.filter((doc) => {
      const key = docDateKey(doc.get("createdAt"));
      return key && key >= weekStart;
    }).length;
    const lowQuotaUsers = users.docs.filter((doc) => {
      const freeLimit = Number(doc.get("freeLimit") ?? 10);
      const used = Number(doc.get("usedGenerations") ?? 0);
      return Math.max(0, freeLimit - used) <= 2;
    }).length;
    const remainingGenerations = users.docs.reduce((total, doc) => {
      const freeLimit = Number(doc.get("freeLimit") ?? 10);
      const used = Number(doc.get("usedGenerations") ?? 0);
      return total + Math.max(0, freeLimit - used);
    }, 0);
    const lessonsToday = lessons.docs.filter((doc) => docDateKey(doc.get("createdAt")) === today).length;
    const feedbackOpen = feedback.docs.filter((doc) => !["resolved", "ignored"].includes(String(doc.get("status") || "new"))).length;
    const feedbackNew = feedback.docs.filter((doc) => String(doc.get("status") || "new") === "new").length;
    const recentAuditIssues = audits.docs
      .filter((doc) => /error|fail|delete|password/i.test(String(doc.get("action") || "")))
      .slice(0, 6)
      .map((doc) => ({
        id: doc.id,
        action: String(doc.get("action") || ""),
        adminEmail: String(doc.get("adminEmail") || ""),
        createdAt: doc.get("createdAt")?.toDate?.()?.toISOString?.() || "",
      }));
    const recentErrors = errorLogs.docs.slice(0, 6).map((doc) => ({
      id: doc.id,
      message: String(doc.get("message") || doc.get("error") || ""),
      source: String(doc.get("source") || ""),
      createdAt: doc.get("createdAt")?.toDate?.()?.toISOString?.() || "",
    }));

    return NextResponse.json({
      today,
      totalUsers: users.size,
      verifiedUsers,
      newUsersToday,
      newUsersThisWeek,
      todayVisits: Number(visitsDoc.get("visits") || 0),
      totalLessons: lessons.size,
      lessonsToday,
      lowQuotaUsers,
      remainingGenerations,
      feedbackNew,
      feedbackOpen,
      recentErrors: recentErrors.length ? recentErrors : recentAuditIssues,
      chart: {
        visits: dateKeys.map((date, index) => ({ date, value: Number(visitDocs[index].get("visits") || 0) })),
        users: countByDate(users.docs, dateKeys, (doc) => docDateKey(doc.get("createdAt"))),
        lessons: countByDate(lessons.docs, dateKeys, (doc) => docDateKey(doc.get("createdAt"))),
        feedback: countByDate(feedback.docs, dateKeys, (doc) => docDateKey(doc.get("createdAt"))),
      },
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải dashboard.");
    return NextResponse.json({ error: message }, { status });
  }
}
