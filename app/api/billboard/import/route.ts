import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "واردات از API خارجی غیرفعال شده است. تمام بیلبوردها مستقیماً در این سامانه ثبت می‌شوند." },
    { status: 410 }
  );
}
