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
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const tier = formData.get("tier") as "standard" | "pro";
    const lyrics = formData.get("lyrics") as string;
    const audioFile = formData.get("audioFile") as File;

    if (!audioFile || !lyrics) {
      return NextResponse.json(
        { error: "Missing audio file or lyrics" },
        { status: 400 }
      );
    }

    const orderId = crypto.randomUUID();
    const fileName = `${orderId}-${audioFile.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("audio-uploads")
      .upload(fileName, audioFile, {
        contentType: audioFile.type,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload audio file" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("audio-uploads")
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    const { error: insertError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        email,
        tier,
        audio_file_url: audioUrl,
        lyrics,
        status: "pending",
      });

    if (insertError) {
      console.error("Database error:", insertError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

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
        orderId,
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
