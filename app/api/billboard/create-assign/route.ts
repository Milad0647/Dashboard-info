import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "ثبت بیلبورد از طریق API خارجی غیرفعال شده است. از فرم ثبت محلی استفاده کنید." },
    { status: 410 }
  );
}
