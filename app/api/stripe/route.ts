import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { processWithGumloop } from "@/lib/gumloop";
import { sendDownloadEmail } from "@/lib/email";

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
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("audio_file_url, email, lyrics, expires_at")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      throw new Error(`Order not found: ${fetchError?.message || "unknown error"}`);
    }

    console.log(`Processing order ${orderId} for ${order.email}`);
    console.log(`Tier: ${tier}, Audio URL: ${order.audio_file_url}`);

    const gumloopOutputs = await processWithGumloop({
      audioUrl: order.audio_file_url,
      lyrics: order.lyrics,
      email: order.email,
      tier,
    });

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        lrc_url: gumloopOutputs.lrc_url,
        srt_url: gumloopOutputs.srt_url,
        video_url: gumloopOutputs.video_url || null,
        status: "done",
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    const expiresDate = new Date(order.expires_at);
    const formattedExpiry = expiresDate.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });

    await sendDownloadEmail({
      to: order.email,
      orderId,
      tier,
      lrcUrl: gumloopOutputs.lrc_url,
      srtUrl: gumloopOutputs.srt_url,
      lrcContent: gumloopOutputs.lrc_content,
      srtContent: gumloopOutputs.srt_content,
      videoUrl: gumloopOutputs.video_url,
      expiresAt: formattedExpiry,
    });

    console.log(`Order ${orderId} processed successfully and email sent to ${order.email}`);
  } catch (error: any) {
    console.error(`Error processing order ${orderId}:`, error);

    await supabase
      .from("orders")
      .update({
        status: "failed",
        error_message: error.message || "Unknown error occurred",
      })
      .eq("id", orderId);
  }
}
