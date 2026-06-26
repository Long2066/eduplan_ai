import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/lib/auth-server";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const categories = new Set(["bug", "improvement", "feature", "other"]);

type FeedbackRequest = {
  category?: string;
  message?: string;
  pageUrl?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = (await request.json()) as FeedbackRequest;
    const message = String(payload.message || "").trim();
    const category = categories.has(String(payload.category || "")) ? String(payload.category) : "other";

    if (message.length < 5) {
      return NextResponse.json({ error: "Nội dung góp ý cần tối thiểu 5 ký tự." }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "Nội dung góp ý tối đa 5000 ký tự." }, { status: 400 });
    }

    await getFirebaseDb().collection("feedback").add({
      category,
      message,
      status: "new",
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      pageUrl: String(payload.pageUrl || "").slice(0, 500),
      userAgent: String(request.headers.get("user-agent") || "").slice(0, 500),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.name === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể gửi góp ý lúc này." },
      { status },
    );
  }
}
