import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "بازیابی از پشتیبان map-bilboard غیرفعال شده است." },
    { status: 410 }
  );
}
