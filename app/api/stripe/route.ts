import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-09-30.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE || "placeholder_key"
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder"
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const tier = session.metadata?.tier as "standard" | "pro";
    const paymentIntentId = session.payment_intent as string;

    if (!orderId) {
      console.error("No orderId found in session metadata");
      return NextResponse.json(
        { error: "Order ID not found" },
        { status: 400 }
      );
    }

    try {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          stripe_payment_intent_id: paymentIntentId,
          status: "processing",
        })
        .eq("id", orderId);

      if (updateError) throw updateError;

      processOrder(orderId, tier);

      return NextResponse.json({ received: true });
    } catch (error: any) {
      console.error("Error updating order:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}

async function processOrder(orderId: string, tier: "standard" | "pro") {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("audio_file_url, email, lyrics")
      .eq("id", orderId)
      .single();

    if (!order) throw new Error("Order not found");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockLrcUrl = `https://example.com/song-${orderId}.lrc`;
    const mockSrtUrl = `https://example.com/song-${orderId}.srt`;
    const mockVideoUrl = tier === "pro" ? `https://example.com/karaoke-${orderId}.mp4` : null;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        lrc_url: mockLrcUrl,
        srt_url: mockSrtUrl,
        video_url: mockVideoUrl,
        status: "done",
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    console.log(`Order ${orderId} processed successfully`);
    console.log(`Audio URL: ${order.audio_file_url}`);
    console.log(`Lyrics preview: ${order.lyrics?.substring(0, 100)}...`);
  } catch (error) {
    console.error("Error processing order:", error);

    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId);
  }
}
