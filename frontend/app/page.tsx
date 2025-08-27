"use client"; 
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Smart Librarian — Minimal Next.js (App Router) Frontend
 * -------------------------------------------------------
 * Drop this file in `app/page.tsx` of a Next.js 14+ project.
 * Assumes a Python backend running locally exposing:
 *  - POST   http://localhost:8000/recommend   { query: string }
 *      → { title: string, reason: string }
 *  - GET    http://localhost:8000/summary?title=Title
 *      → { title: string, summary: string }
 *  - POST   http://localhost:8000/tts         { text: string }
 *      → audio file (audio/mpeg)  (optional)
 *  - GET    http://localhost:8000/cover?title=Title
 *      → { image_url: string }                (optional)
 *  - POST   http://localhost:8000/api/images/generate { prompt: string, size?: string }
 *      → { image_base64: string }             (custom image API returning base64)
 *
 * Notes
 * - Profanity filter (optional requirement) is implemented client-side as a soft gate.
 * - Text-to-Speech is implemented with the Web Speech API as a fallback even if no /tts.
 * - Voice mode (Speech-to-Text) leverages webkitSpeechRecognition where available.
 * - This is a single-file UI using TailwindCSS utility classes. You can replace with shadcn/ui.
 */

// --- Config ---
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

// Simple, non-exhaustive bad-words list (demo only)
const BAD_WORDS = ["idiot", "stupid", "hate", "dumb"]; // extend server-side for real use

// Types
interface RecommendResponse {
  title: string;
  reason?: string;
}
interface SummaryResponse {
  title: string;
  summary: string;
}
interface CoverResponse {
  image_url?: string;
}
interface ImageGenResponse {
  image_base64?: string; // preferred
  b64_json?: string;     // alt format
  data?: { b64_json?: string }[]; // some SDKs return an array
  content_type?: string;
}

export default function Page() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  // New: image generation state
  const [genImgLoading, setGenImgLoading] = useState(false);
  const [genImgError, setGenImgError] = useState<string | null>(null);
  const [genImageDataUrl, setGenImageDataUrl] = useState<string | null>(null);

  // Derived: basic profanity check
  const hasProfanity = useMemo(() => {
    const lower = query.toLowerCase();
    return BAD_WORDS.some((w) => lower.includes(w));
  }, [query]);

  // Voice input (Speech-to-Text)
  useEffect(() => {
    if (!voiceMode) return;
    const WSR = (window as any).webkitSpeechRecognition;
    if (!WSR) return;
    const recognition = new WSR();
    recognition.continuous = false;
    recognition.lang = "en-US"; // change as needed
    recognition.interimResults = false;

    recognition.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setQuery(text);
    };
    recognition.onerror = () => {};
    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [voiceMode]);

  const startListening = () => {
    try {
      recognitionRef.current?.start();
    } catch {}
  };

  // Speak helper (Web Speech API)
  const speak = (text: string) => {
    if (typeof window === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(text);
    setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // New: call your backend image API that returns base64
  const handleGenerateImage = async () => {
    if (!recommendation) return;
    setGenImgError(null);
    setGenImgLoading(true);
    setGenImageDataUrl(null);
    try {
      // Build a prompt using the recommendation + summary (trim to keep it short)
      const basePrompt = `Book cover concept for "${recommendation}". ${summary ? "Summary: " + summary.slice(0, 300) : ""} and size 512x512`;
      const res = await fetch(`${API_BASE}/cover_image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_description : basePrompt}),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Image API failed: ${res.status} ${text}`);
      }
      const data: {content:string} = await res.json();
      console.log(data)
      const b64 = data.content 
      if (!b64) throw new Error("No base64 image found in response");
      // Convert to data URL for <img src>
      setGenImageDataUrl(`data:${data.content || "image/png"};base64,${b64}`);
    } catch (e: any) {
      setGenImgError(e?.message || "Image generation failed");
    } finally {
      setGenImgLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!query.trim()) {
      setError("Please enter what you’re in the mood to read.");
      return;
    }
    if (hasProfanity) {
      setError("Let’s keep it polite. Try rephrasing your request.");
      return;
    }

    setLoading(true);
    setRecommendation(null);
    setSummary("");
    setImageUrl(undefined);
    setGenImageDataUrl(null);

    try {
      // 1) Ask backend for a recommendation (RAG)
      const recRes = await fetch(`${API_BASE}/ask_question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query, // or `question: query` if that’s what your backend expects
        }),
      });
      if (recRes.status === 400) throw new Error("I don't have such a book. Please try another question.");
      if (!recRes.ok) throw new Error("Recommendation failed");
      const data: { status: number; content: string | string[] } = await recRes.json();

      // Your backend seems to return [title, summary]
      if (Array.isArray(data.content)) {
        setRecommendation(data.content[0] || null);
        setSummary(data.content[1] || "");
      } else {
        // Fallback if content is a single string
        setRecommendation(data.content);
      }

      // Optional cover fetch
      // if (data.content && Array.isArray(data.content)) fetchCover(data.content[0]);

    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Smart Librarian</h1>
          <p className="text-sm text-slate-600">Book recommendations powered by RAG + Tools</p>
        </header>

        <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm font-medium">What would you like to read?</label>
            <input
              className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="e.g., Friendship and magic, or war stories, or dystopian themes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-sky-600 px-4 py-2 text-white shadow disabled:opacity-60"
              >
                {loading ? "Thinking…" : "Recommend a book"}
              </button>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={voiceMode}
                  onChange={(e) => setVoiceMode(e.target.checked)}
                />
                Voice mode
              </label>
              {voiceMode && (
                <button
                  type="button"
                  onClick={startListening}
                  className="rounded-xl border px-3 py-1 text-sm"
                >
                  🎙️ Start listening
                </button>
              )}

              {speaking ? (
                <button
                  type="button"
                  onClick={() => {window.speechSynthesis.cancel();

                    setSpeaking(false);}
                  }
                  className="rounded-xl border px-3 py-1 text-sm"
                >
                  ⏹️ Stop voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const text = [
                      recommendation ? `${"Title:" + recommendation}.` : "",
                      summary ? `Summary: ${summary}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    if (text) speak(text);
                  }}
                  className="rounded-xl border px-3 py-1 text-sm"
                >
                  🔊 Read aloud
                </button>
              )}
            </div>

            {hasProfanity && (
              <p className="text-sm text-amber-600">
                Heads up: please avoid offensive language. Your query won’t be sent.
              </p>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </section>

        {/* Results */}
        {recommendation && (
          <section className="mb-6 grid gap-4 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-3">
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold">Recommended: {recommendation}</h2>

              {summary && (
                <div className="prose prose-slate mt-4 max-w-none">
                  <h3>Summary</h3>
                  <p className="whitespace-pre-line text-sm leading-6">{summary}</p>
                </div>
              )}

              {/* New: Generate Image button + status */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={genImgLoading}
                  className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {genImgLoading ? "Generating image…" : "🖼️ Generate image"}
                </button>
                {genImgError && (
                  <span className="text-sm text-rose-600">{genImgError}</span>
                )}
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Image API expected at <code>{`${API_BASE}/images/generate`}</code> returning <code>{`{ image_base64: "..." }`}</code>.
              </div>
            </div>

            <div className="flex items-start justify-center">
              {genImageDataUrl ? (
                // Generated image takes priority
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={genImageDataUrl}
                  alt={`${recommendation} (generated)`}
                  className="h-64 w-44 rounded-xl object-cover shadow"
                />
              ) : imageUrl ? (
                // Fallback to cover endpoint, if any
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={recommendation}
                  className="h-64 w-44 rounded-xl object-cover shadow"
                />
              ) : (
                <div className="flex h-64 w-44 items-center justify-center rounded-xl border text-slate-400">
                  No image yet
                </div>
              )}
            </div>
          </section>
        )}

        {/* Helper footer */}
        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>
            Backend expected at <code>{API_BASE}</code>. Update with
            <code> NEXT_PUBLIC_API_BASE</code>.
          </p>
        </footer>
      </div>
    </main>
  );
}
