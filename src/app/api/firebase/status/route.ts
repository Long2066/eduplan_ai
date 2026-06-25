import { NextResponse } from "next/server";
import { firebaseConfigStatus, getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET() {
  const config = firebaseConfigStatus();
  if (!config.hasClientEmail || !config.hasPrivateKey) {
    return NextResponse.json({
      connected: false,
      configured: false,
      projectId: config.projectId,
      databaseId: config.databaseId,
      missing: {
        FIREBASE_CLIENT_EMAIL: !config.hasClientEmail,
        FIREBASE_PRIVATE_KEY: !config.hasPrivateKey,
      },
    });
  }

  try {
    const db = getFirebaseDb();
    await db.collection("_health").doc("firestore").set(
      {
        checkedAt: new Date().toISOString(),
        source: "EduPlan AI",
      },
      { merge: true },
    );

    return NextResponse.json({
      connected: true,
      configured: true,
      projectId: config.projectId,
      databaseId: config.databaseId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        configured: true,
        projectId: config.projectId,
        databaseId: config.databaseId,
        error: error instanceof Error ? error.message : "Không thể kết nối Firebase.",
      },
      { status: 500 },
    );
  }
}
