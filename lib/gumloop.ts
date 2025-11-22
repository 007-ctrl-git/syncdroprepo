interface GumloopInput {
  audioUrl: string;
  lyrics: string;
  email: string;
  tier: "standard" | "pro";
}

interface GumloopOutput {
  lrc_url: string;
  srt_url: string;
  lrc_content: string;
  srt_content: string;
  video_url?: string;
}

interface GumloopResponse {
  status: "success" | "error";
  outputs?: GumloopOutput;
  error?: string;
}

export async function processWithGumloop(
  input: GumloopInput
): Promise<GumloopOutput> {
  const gumloopUrl = process.env.GUMLOOP_WORKFLOW_URL;
  const gumloopApiKey = process.env.GUMLOOP_API_KEY;

  if (!gumloopUrl || !gumloopApiKey) {
    throw new Error(
      "Gumloop credentials not configured. Set GUMLOOP_WORKFLOW_URL and GUMLOOP_API_KEY in .env"
    );
  }

  try {
    const response = await fetch(gumloopUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gumloopApiKey}`,
      },
      body: JSON.stringify({
        audioUrl: input.audioUrl,
        lyrics: input.lyrics,
        email: input.email,
        tier: input.tier,
        includeLrc: true,
        includeSrt: true,
        includeVideo: input.tier === "pro",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gumloop API error (${response.status}): ${errorText}`
      );
    }

    const data: GumloopResponse = await response.json();

    if (data.status === "error" || !data.outputs) {
      throw new Error(data.error || "Gumloop processing failed");
    }

    return data.outputs;
  } catch (error: any) {
    console.error("Gumloop API error:", error);
    throw new Error(`Failed to process with Gumloop: ${error.message}`);
  }
}
