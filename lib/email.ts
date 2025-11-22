interface EmailData {
  to: string;
  orderId: string;
  tier: "standard" | "pro";
  lrcUrl: string;
  srtUrl: string;
  lrcContent: string;
  srtContent: string;
  videoUrl?: string;
  expiresAt: string;
}

export async function sendDownloadEmail(data: EmailData): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured in .env");
  }

  const videoSection = data.videoUrl
    ? `
    <tr>
      <td style="padding: 15px; background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); border-radius: 8px;">
        <a href="${data.videoUrl}" style="color: white; text-decoration: none; display: block;">
          <strong>📹 1080p Karaoke Video</strong><br>
          <span style="font-size: 14px; opacity: 0.9;">Pro tier bonus</span>
        </a>
      </td>
    </tr>
    `
    : "";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1f2937 0%, #000000 100%); color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #1f2937; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #1f2937 0%, #111827 100%);">
        <div style="display: inline-flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <span style="font-size: 32px;">✨</span>
          <h1 style="margin: 0; font-size: 36px; font-weight: bold;">SyncDrop</h1>
        </div>
        <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #60a5fa;">Your Files Are Ready!</h2>
      </td>
    </tr>

    <tr>
      <td style="padding: 30px;">
        <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #d1d5db;">
          Thanks for using SyncDrop! Your lyric sync files have been processed and are ready to download.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 15px; background: #374151; border-radius: 8px; margin-bottom: 10px;">
              <a href="${data.lrcUrl}" style="color: white; text-decoration: none; display: block;">
                <strong>📄 .lrc File</strong><br>
                <span style="font-size: 14px; color: #9ca3af;">Spotify, Apple Music compatible</span>
              </a>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px; background: #374151; border-radius: 8px;">
              <a href="${data.srtUrl}" style="color: white; text-decoration: none; display: block;">
                <strong>📄 .srt File</strong><br>
                <span style="font-size: 14px; color: #9ca3af;">Subtitle format for video editing</span>
              </a>
            </td>
          </tr>
          ${videoSection ? '<tr><td style="height: 10px;"></td></tr>' + videoSection : ''}
        </table>

        <div style="margin: 25px 0; padding: 15px; background: #991b1b; border-radius: 8px; border-left: 4px solid #dc2626;">
          <p style="margin: 0; font-size: 14px; color: #fecaca;">
            <strong>⚠️ Important:</strong> These download links will expire on ${data.expiresAt}. Please download your files before then.
          </p>
        </div>

        <p style="margin: 20px 0 0; font-size: 14px; color: #9ca3af;">
          Order ID: <code style="background: #374151; padding: 2px 6px; border-radius: 4px;">${data.orderId}</code>
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding: 20px 30px; text-align: center; background: #111827; border-top: 1px solid #374151;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Need help? Reply to this email or visit our support page.<br>
          <span style="color: #4b5563;">This is an automated message from SyncDrop</span>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const lrcBase64 = Buffer.from(data.lrcContent).toString('base64');
    const srtBase64 = Buffer.from(data.srtContent).toString('base64');

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "SyncDrop <noreply@syncdrop.app>",
        to: data.to,
        subject: "🎵 Your SyncDrop Files Are Ready!",
        html: htmlContent,
        attachments: [
          {
            filename: `song-${data.orderId}.lrc`,
            content: lrcBase64,
          },
          {
            filename: `song-${data.orderId}.srt`,
            content: srtBase64,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error (${response.status}): ${errorText}`);
    }

    console.log(`Email sent successfully to ${data.to}`);
  } catch (error: any) {
    console.error("Email sending error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
