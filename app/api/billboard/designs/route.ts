import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "ارسال طرح به API خارجی غیرفعال شده است." },
    { status: 410 }
  );
}
