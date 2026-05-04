"use client";

import { useState } from "react";

type Mode = "chat" | "verified" | "audit";
type View = "chat" | "history" | "settings";
type Message = { role: "user" | "assistant"; content: string };
type Claim = { text: string; status: string };
type Source = { title: string; url?: string; domain?: string };

export default function Page() {
  const [mode, setMode] = useState<Mode>("verified");
  const [view, setView] = useState<View>("chat");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [trust, setTrust] = useState(80);

  const [claims, setClaims] = useState<Claim[]>([
    { text: "Ready to verify factual answers.", status: "Supported" },
  ]);

  const [sources, setSources] = useState<Source[]>([
    { title: "Groq LLM", domain: "Current response backend" },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I am VeritasAI — your evidence-aware assistant. Ask me anything.",
    },
  ]);

  const trustLabel = trust >= 70 ? "High" : trust >= 40 ? "Medium" : "Low";

  const formatMessage = (text: string) => {
    const parts = text.split(/```/g);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <pre
            key={index}
            className="my-4 overflow-x-auto rounded-2xl bg-[#21170f] p-4 text-sm text-[#fff7ed] shadow-inner"
          >
            <code className="font-mono leading-7">
              {part
                .replace(/^(python|javascript|js|ts|tsx|html|css|java|sql)\n/i, "")
                .trim()}
            </code>
          </pre>
        );
      }

      return (
        <p
          key={index}
          className="mb-3 whitespace-pre-wrap text-[15px] leading-8 text-[#332313]"
        >
          {part}
        </p>
      );
    });
  };

  const newChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi! I am VeritasAI — your evidence-aware assistant. Ask me anything.",
      },
    ]);
    setInput("");
    setView("chat");
    setTrust(80);
    setClaims([{ text: "Ready to verify factual answers.", status: "Supported" }]);
    setSources([{ title: "Groq LLM", domain: "Current response backend" }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setView("chat");
    setHistory((prev) => [userText, ...prev.filter((x) => x !== userText)].slice(0, 8));
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, mode }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response." },
      ]);

      setTrust(data.trust ?? 60);
      setClaims(data.claims ?? []);
      setSources(data.sources ?? []);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Frontend failed to call backend." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const auditReport = () => {
    alert(
      `VeritasAI Audit Report\n\nMode: ${mode}\nTrust Score: ${trust}%\n\nClaims:\n${claims
        .map((c) => `- ${c.text} (${c.status})`)
        .join("\n")}\n\nSources:\n${sources
        .map((s) => `- ${s.title} ${s.url || ""}`)
        .join("\n")}`
    );
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#fbf7ef] text-[#2d1f0e]">
      <aside className="flex w-[268px] shrink-0 flex-col border-r border-[#eadfce] bg-[#f4efe7] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff7ed] text-2xl shadow-sm">
            ⚛️
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">VeritasAI</h1>
            <p className="text-[11px] text-[#a08060]">No hallucinations. Just evidence.</p>
          </div>
        </div>

        <button
          onClick={newChat}
          className="mt-6 rounded-xl bg-[#c96a2a] py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#b85e22]"
        >
          ＋ New Chat
        </button>

        <nav className="mt-7 space-y-2 text-sm">
          {[
            ["chat", "💬 Chats"],
            ["history", "🕐 History"],
            ["settings", "⚙️ Settings"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key as View)}
              className={`w-full rounded-xl px-4 py-3 text-left transition ${
                view === key ? "bg-[#e9dfd2]" : "text-[#6b5040] hover:bg-[#ece3d8]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-7">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#a08060]">
            Mode
          </p>

          <div className="space-y-2">
            {[
              ["chat", "💬", "Chat Mode", "Casual conversation"],
              ["verified", "⚛️", "Verified Answer", "Evidence-backed answers"],
              ["audit", "🔍", "Audit Mode", "Full verification report"],
            ].map(([key, icon, title, desc]) => (
              <button
                key={key}
                onClick={() => setMode(key as Mode)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  mode === key
                    ? "border-[#e8c8a0] bg-[#fff0e6] shadow-sm"
                    : "border-transparent hover:bg-[#ece3d8]"
                }`}
              >
                <p className="text-sm font-medium">
                  {icon} {title}
                </p>
                <p className="mt-1 text-xs text-[#a08060]">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-[#b8dfc0] bg-[#eef7f0] p-4">
          <p className="text-sm font-medium text-[#1a6b36]">● VeritasAI is active</p>
          <p className="mt-2 text-xs leading-relaxed text-[#4a8a5a]">
            Uses Groq for answers and Tavily for live evidence when configured.
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[#eadfce] bg-[#fbf7ef]/90 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚛️</span>
            <h2 className="text-lg font-semibold tracking-tight">VeritasAI</h2>
            <span className="rounded-md border border-[#e8c8a0] bg-[#fff0e6] px-2 py-1 text-xs text-[#c96a2a]">
              v2.0
            </span>
          </div>

          <span className="rounded-full border border-[#e8e2d8] bg-white px-4 py-2 text-sm text-[#6b5040] shadow-sm">
            {mode === "chat"
              ? "💬 Chat Mode"
              : mode === "verified"
              ? "⚛️ Verified Answer Mode"
              : "🔍 Audit Mode"}
          </span>
        </header>

        {view === "history" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-4 text-xl font-semibold">History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#a08060]">No history yet.</p>
            ) : (
              history.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(item);
                    setView("chat");
                  }}
                  className="mb-2 block w-full rounded-2xl border border-[#e8e2d8] bg-white p-4 text-left text-sm shadow-sm hover:bg-[#fff0e6]"
                >
                  {item}
                </button>
              ))
            )}
          </div>
        ) : view === "settings" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="mb-4 text-xl font-semibold">Settings</h2>
            <div className="rounded-2xl border border-[#e8e2d8] bg-white p-5 shadow-sm">
              <p className="font-medium">Current Mode: {mode}</p>
              <p className="mt-2 text-sm text-[#a08060]">
                Switch modes from the sidebar. Verified and Audit modes show evidence details.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {messages.map((msg, index) =>
                msg.role === "user" ? (
                  <div key={index} className="flex justify-end gap-3">
                    <div className="max-w-[680px] rounded-2xl rounded-tr-md border border-[#e8e2d8] bg-white px-5 py-4 text-sm leading-7 shadow-sm">
                      {msg.content}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8c8a0] text-xs font-semibold text-[#6b3a10]">
                      SC
                    </div>
                  </div>
                ) : (
                  <div key={index} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e8c8a0] bg-[#fff0e6]">
                      ⚛️
                    </div>

                    <div className="flex-1 rounded-2xl rounded-tl-md border border-[#e8e2d8] bg-white px-5 py-4 shadow-sm">
                      <div className="text-[#3d2510]">{formatMessage(msg.content)}</div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#f0ebe2] pt-3">
                        <span className="rounded-full border border-[#b8dfc0] bg-[#eef7f0] px-3 py-1 text-xs text-[#1a6b36]">
                          ● Evidence-aware
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              alert("Copied response!");
                            }}
                            className="rounded-lg border border-[#e8e2d8] bg-[#faf8f5] px-2 py-1 text-sm hover:bg-[#fff0e6]"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => alert("Thanks for your feedback 👍")}
                            className="rounded-lg border border-[#e8e2d8] bg-[#faf8f5] px-2 py-1 text-sm hover:bg-[#fff0e6]"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => alert("Thanks — we will improve this response 👎")}
                            className="rounded-lg border border-[#e8e2d8] bg-[#faf8f5] px-2 py-1 text-sm hover:bg-[#fff0e6]"
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8c8a0] bg-[#fff0e6]">
                    ⚛️
                  </div>
                  <div className="rounded-2xl border border-[#e8e2d8] bg-white px-5 py-4 text-sm shadow-sm">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#eadfce] bg-[#fbf7ef] p-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[#e0d8cc] bg-white px-4 py-2 shadow-sm focus-within:border-[#c96a2a]">
                <input
                  className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-[#c0a880]"
                  placeholder="Message VeritasAI..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />

                <button
                  onClick={sendMessage}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c96a2a] text-white transition hover:bg-[#b85e22]"
                >
                  ➤
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[#c0a880]">
                VeritasAI may make mistakes. Verify critical information.
              </p>
            </div>
          </>
        )}
      </section>

      {mode !== "chat" && (
        <aside className="w-[315px] shrink-0 overflow-y-auto border-l border-[#eadfce] bg-white p-5">
          <div className="mb-5 border-b border-[#f0ebe2] pb-4">
            <h3 className="text-sm font-semibold">⚛️ Verification Details</h3>
          </div>

          <div className="mb-6 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-[#3a9e5a] bg-[#f4fbf6]">
              <span className="text-2xl font-semibold text-[#1a6b36]">
                {trust}%
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">Trust Score: {trustLabel}</p>
            <p className="mt-1 text-xs text-[#a08060]">
              Based on source retrieval and claim support.
            </p>
          </div>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#a08060]">
            Claim Analysis
          </p>

          <div className="space-y-2">
            {claims.map((claim, index) => (
              <div
                key={index}
                className={`rounded-xl border-l-4 p-3 ${
                  claim.status === "Supported"
                    ? "border-[#3a9e5a] bg-[#f4fbf6]"
                    : claim.status === "Error"
                    ? "border-red-400 bg-red-50"
                    : "border-[#c96a2a] bg-[#fef9f5]"
                }`}
              >
                <p className="text-xs leading-5">{claim.text}</p>
                <p className="mt-1 text-[10px] font-medium text-[#a08060]">
                  {claim.status}
                </p>
              </div>
            ))}
          </div>

          <p className="mb-3 mt-6 text-[10px] font-semibold uppercase tracking-widest text-[#a08060]">
            Sources
          </p>

          <div className="space-y-2">
            {sources.length === 0 ? (
              <div className="rounded-xl border border-[#e8e2d8] bg-[#faf8f5] p-3 text-xs text-[#a08060]">
                No external sources found.
              </div>
            ) : (
              sources.map((source, index) =>
                source.url ? (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    className="block rounded-xl border border-[#e8e2d8] bg-[#faf8f5] p-3 transition hover:bg-[#fff0e6]"
                  >
                    <p className="truncate text-xs font-medium">{source.title}</p>
                    <p className="text-[10px] text-[#a08060]">{source.domain}</p>
                  </a>
                ) : (
                  <div
                    key={index}
                    className="rounded-xl border border-[#e8e2d8] bg-[#faf8f5] p-3"
                  >
                    <p className="truncate text-xs font-medium">{source.title}</p>
                    <p className="text-[10px] text-[#a08060]">{source.domain}</p>
                  </div>
                )
              )
            )}
          </div>

          <button
            onClick={auditReport}
            className="mt-6 w-full rounded-xl bg-[#c96a2a] py-3 text-sm font-medium text-white transition hover:bg-[#b85e22]"
          >
            📊 View Full Audit Report ↗
          </button>
        </aside>
      )}
    </main>
  );
}