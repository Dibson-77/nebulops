import { NextRequest, NextResponse } from "next/server";
import { getAdminData } from "@/lib/api/admin";
import "server-only";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userParams = {
      page: searchParams.get("userPage") || 1,
      limit: searchParams.get("userLimit") || 10,
    };
    const profileParams = {
      page: searchParams.get("profilePage") || 1,
      limit: searchParams.get("profileLimit") || 10,
    };

    const data = await getAdminData(userParams, profileParams);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[ADMIN_DATA_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
