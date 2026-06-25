import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { serializeUser } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const snapshot = await getFirebaseDb().collection("users").limit(300).get();
    let users = snapshot.docs.map(serializeUser);
    if (query) {
      users = users.filter((user) =>
        `${user.email} ${user.displayName}`.toLowerCase().includes(query),
      );
    }
    users.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return NextResponse.json({ users });
  } catch (error) {
    const { message, status } = adminError(error, "Không thể tải danh sách user.");
    return NextResponse.json({ error: message }, { status });
  }
}
