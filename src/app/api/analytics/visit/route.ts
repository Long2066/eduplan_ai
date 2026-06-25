import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth-server";

function vietnamDateKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function dailyVisitRef() {
  const date = vietnamDateKey();
  return {
    date,
    ref: getFirebaseDb().collection("analytics_daily_visits").doc(date),
  };
}

export async function GET() {
  try {
    await requireUser();
    const { date, ref } = await dailyVisitRef();
    const snapshot = await ref.get();
    return NextResponse.json({
      date,
      visits: Number(snapshot.get("visits") || 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tải lượt truy cập.";
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const { date, ref } = await dailyVisitRef();
    await ref.set(
      {
        date,
        visits: FieldValue.increment(1),
        lastUserId: user.uid,
        updatedAt: new Date(),
      },
      { merge: true },
    );
    const snapshot = await ref.get();
    return NextResponse.json({
      date,
      visits: Number(snapshot.get("visits") || 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể ghi lượt truy cập.";
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
