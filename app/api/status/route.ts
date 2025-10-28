import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key"
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email parameter is required" },
      { status: 400 }
    );
  }

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        status: "pending",
      });
    }

    const order = orders[0];

    return NextResponse.json({
      status: order.status,
      urls: {
        lrc_url: order.lrc_url,
        srt_url: order.srt_url,
        video_url: order.video_url,
      },
    });
  } catch (error: any) {
    console.error("Error fetching order status:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
