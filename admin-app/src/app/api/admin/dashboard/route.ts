import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { adminError, requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

function vietnamDateKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET() {
  try {
    await requireAdmin();
    const db = getFirebaseDb();
    const today = vietnamDateKey();
    const [users, visitsDoc, lessons] = await Promise.all([
      db.collection("users").get(),
      db.collection("analytics_daily_visits").doc(today).get(),
      db.collection("lessons").limit(1000).get(),
    ]);

    const verifiedUsers = users.docs.filter((doc) => Boolean(doc.get("emailVerified"))).length;
    const lowQuotaUsers = users.docs.filter((doc) => {
      const freeLimit = Number(doc.get("freeLimit") ?? 10);
      const used = Number(doc.get("usedGenerations") ?? 0);
      return Math.max(0, freeLimit - used) <= 2;
    }).length;
    const lessonsToday = lessons.docs.filter((doc) => {
      const createdAt = doc.get("createdAt")?.toDate?.();
      if (!createdAt) return false;
      return new Date(createdAt.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === today;
    }).length;

    return NextResponse.json({
      today,
      totalUsers: users.size,
      verifiedUsers,
      todayVisits: Number(visitsDoc.get("visits") || 0),
      totalLessons: lessons.size,
      lessonsToday,
      lowQuotaUsers,
    });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải dashboard.");
    return NextResponse.json({ error: message }, { status });
  }
}
