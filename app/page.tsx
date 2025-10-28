"use client";

import { useState, useEffect } from "react";
import { Upload, Sparkles, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tier = "standard" | "pro";

interface OrderStatus {
  status: "pending" | "processing" | "done" | "failed";
  urls?: {
    lrc_url?: string;
    srt_url?: string;
    video_url?: string;
  };
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [tier, setTier] = useState<Tier>("standard");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const emailParam = urlParams.get("email");

    if (success === "true" && emailParam) {
      setEmail(emailParam);
      setIsProcessing(true);
      pollOrderStatus(emailParam);
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!audioFile) {
      newErrors.audio = "Audio file is required";
    } else if (audioFile.size > 25 * 1024 * 1024) {
      newErrors.audio = "File must be under 25 MB";
    }

    if (!lyrics.trim()) {
      newErrors.lyrics = "Lyrics are required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (email !== confirmEmail) {
      newErrors.confirmEmail = "Emails must match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setErrors({ ...errors, audio: "File must be under 25 MB" });
        return;
      }
      setAudioFile(file);
      setErrors({ ...errors, audio: "" });
    }
  };

  const pollOrderStatus = async (email: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setOrderStatus({ status: "failed" });
        return;
      }

      try {
        const response = await fetch(`/api/status?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.status === "done") {
          setOrderStatus(data);
          setIsProcessing(false);
        } else if (data.status === "failed") {
          setOrderStatus(data);
          setIsProcessing(false);
        } else {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (error) {
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("audioFile", audioFile!);
      formData.append("lyrics", lyrics);
      formData.append("email", email);
      formData.append("tier", tier);

      const response = await fetch("/api/checkout", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrors({ submit: "Failed to create checkout session" });
        setIsProcessing(false);
      }
    } catch (error) {
      setErrors({ submit: "An error occurred. Please try again." });
      setIsProcessing(false);
    }
  };

  if (orderStatus?.status === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
              <Download className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Your Files Are Ready!</h1>
            <p className="text-gray-400">Download links have been sent to {email}</p>
            <p className="text-sm text-gray-500 mt-2">Links expire in 48 hours</p>
          </div>

          <div className="space-y-4">
            {orderStatus.urls?.lrc_url && (
              <a
                href={orderStatus.urls.lrc_url}
                download
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <span className="font-medium">.lrc file</span>
                <Download className="w-5 h-5 text-gray-400" />
              </a>
            )}
            {orderStatus.urls?.srt_url && (
              <a
                href={orderStatus.urls.srt_url}
                download
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <span className="font-medium">.srt file</span>
                <Download className="w-5 h-5 text-gray-400" />
              </a>
            )}
            {orderStatus.urls?.video_url && (
              <a
                href={orderStatus.urls.video_url}
                download
                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg border border-blue-500/50 hover:border-blue-400/50 transition-colors"
              >
                <span className="font-medium">1080p Karaoke Video</span>
                <Download className="w-5 h-5 text-blue-400" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Processing Your Order</h2>
          <p className="text-gray-400">This usually takes under 60 seconds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-2xl">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-blue-500" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">SyncDrop</h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Studio-grade lyric sync in 60s</h2>
          <p className="text-gray-400 text-base md:text-lg">
            Spotify / Apple / IG-ready .lrc & .srt
            <br className="hidden md:block" />
            <span className="text-gray-500"> + optional 1080p lyric-video</span>
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="audio" className="text-base mb-2 block">
              Audio File
            </Label>
            <div className="relative">
              <input
                type="file"
                id="audio"
                accept=".mp3,.wav"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="audio"
                className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  errors.audio
                    ? "border-red-500 bg-red-500/5"
                    : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                }`}
              >
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-gray-300">
                  {audioFile ? audioFile.name : "Upload MP3 or WAV (max 25 MB)"}
                </span>
              </label>
            </div>
            {errors.audio && <p className="text-red-400 text-sm mt-2">{errors.audio}</p>}
          </div>

          <div>
            <Label htmlFor="lyrics" className="text-base mb-2 block">
              Lyrics
            </Label>
            <Textarea
              id="lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste your lyrics here...&#10;&#10;Example:&#10;Verse 1&#10;Line one of the song&#10;Line two of the song&#10;&#10;Chorus&#10;Hook line here"
              className={`min-h-[200px] bg-gray-800/50 border-gray-700 focus:border-gray-600 text-white resize-none ${
                errors.lyrics ? "border-red-500" : ""
              }`}
            />
            {errors.lyrics && <p className="text-red-400 text-sm mt-2">{errors.lyrics}</p>}
          </div>

          <div>
            <Label htmlFor="email" className="text-base mb-2 block">
              Email
            </Label>
            <Input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={`bg-gray-800/50 border-gray-700 focus:border-gray-600 text-white ${
                errors.email ? "border-red-500" : ""
              }`}
            />
            {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email}</p>}
          </div>

          <div>
            <Label htmlFor="confirmEmail" className="text-base mb-2 block">
              Confirm Email
            </Label>
            <Input
              type="email"
              id="confirmEmail"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="your@email.com"
              className={`bg-gray-800/50 border-gray-700 focus:border-gray-600 text-white ${
                errors.confirmEmail ? "border-red-500" : ""
              }`}
            />
            {errors.confirmEmail && (
              <p className="text-red-400 text-sm mt-2">{errors.confirmEmail}</p>
            )}
          </div>

          <div>
            <Label className="text-base mb-3 block">Choose Your Tier</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setTier("standard")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  tier === "standard"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                }`}
              >
                <div className="font-bold text-lg mb-1">Standard</div>
                <div className="text-2xl font-bold mb-2">$5</div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>.lrc file</li>
                  <li>.srt file</li>
                </ul>
              </button>

              <button
                onClick={() => setTier("pro")}
                className={`p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                  tier === "pro"
                    ? "border-cyan-500 bg-gradient-to-br from-blue-500/10 to-cyan-500/10"
                    : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                }`}
              >
                <div className="font-bold text-lg mb-1">Pro</div>
                <div className="text-2xl font-bold mb-2">$12</div>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>.lrc file</li>
                  <li>.srt file</li>
                  <li className="text-cyan-400 font-medium">+ 1080p karaoke video</li>
                </ul>
              </button>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6 rounded-lg font-semibold transition-colors"
          >
            Generate My Files
          </Button>

          {errors.submit && <p className="text-red-400 text-sm text-center">{errors.submit}</p>}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Secure payment via Stripe • Files delivered via email</p>
          <p className="mt-2">Download links expire after 48 hours</p>
        </div>
      </div>
    </div>
  );
}
