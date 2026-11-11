import { NextResponse } from "next/server";
import {
  FREE_DAILY_LIMIT,
  PAID_TRIAL_DAILY_CREDITS,
  PLAN_CATALOG,
  getSubscriptionSettings,
} from "@/lib/subscription-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSubscriptionSettings();
    return NextResponse.json(
      {
        freeDailyLimit: settings.freeDailyLimit,
        paidTrialDailyCredits: settings.paidTrialDailyCredits,
        paidTrialGenerationCost: PLAN_CATALOG.plus.generationCost,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        freeDailyLimit: FREE_DAILY_LIMIT,
        paidTrialDailyCredits: PAID_TRIAL_DAILY_CREDITS,
        paidTrialGenerationCost: PLAN_CATALOG.plus.generationCost,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
