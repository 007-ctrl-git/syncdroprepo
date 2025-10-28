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
    const email = session.metadata?.email || session.customer_email;
    const tier = session.metadata?.tier as "standard" | "pro";
    const paymentIntentId = session.payment_intent as string;

    if (!email) {
      console.error("No email found in session");
      return NextResponse.json(
        { error: "Email not found" },
        { status: 400 }
      );
    }

    try {
      const { data: order, error: insertError } = await supabase
        .from("orders")
        .insert({
          email,
          tier,
          stripe_payment_intent_id: paymentIntentId,
          status: "processing",
        })
        .select()
        .single();

      if (insertError || !order) throw insertError || new Error("Order not created");

      processOrder(order.id, email, tier);

      return NextResponse.json({ received: true });
    } catch (error: any) {
      console.error("Error creating order:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}

async function processOrder(orderId: string, email: string, tier: "standard" | "pro") {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockLrcUrl = "https://example.com/song.lrc";
    const mockSrtUrl = "https://example.com/song.srt";
    const mockVideoUrl = tier === "pro" ? "https://example.com/karaoke.mp4" : null;

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
  } catch (error) {
    console.error("Error processing order:", error);

    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId);
  }
}
