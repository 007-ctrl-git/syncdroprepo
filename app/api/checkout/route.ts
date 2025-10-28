import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-09-30.clover",
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const tier = formData.get("tier") as "standard" | "pro";

    const prices = {
      standard: 500,
      pro: 1200,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: tier === "standard" ? "SyncDrop Standard" : "SyncDrop Pro",
              description:
                tier === "standard"
                  ? ".lrc + .srt lyric files"
                  : ".lrc + .srt lyric files + 1080p karaoke video",
            },
            unit_amount: prices[tier],
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.headers.get("origin")}/?success=true&email=${encodeURIComponent(email)}`,
      cancel_url: `${request.headers.get("origin")}/?canceled=true`,
      customer_email: email,
      metadata: {
        email,
        tier,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
