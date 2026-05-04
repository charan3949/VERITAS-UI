import { NextResponse } from "next/server";

type Source = {
  title: string;
  url: string;
  domain: string;
  content: string;
};

type Claim = {
  text: string;
  status: "Supported" | "Contradicted" | "Uncertain" | "Unverified" | "Error";
};

function extractClaims(answer: string): string[] {
  return answer
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .slice(0, 6);
}

function keywordSupport(claim: string, sources: Source[]) {
  const claimWords = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const sourceText = sources
    .map((s) => `${s.title} ${s.content}`)
    .join(" ")
    .toLowerCase();

  const matched = claimWords.filter((w) => sourceText.includes(w)).length;
  const ratio = claimWords.length ? matched / claimWords.length : 0;

  return ratio;
}

function detectPossibleContradiction(claim: string, sources: Source[]) {
  const negativeWords = ["not", "false", "incorrect", "myth", "debunked", "no evidence", "not confirmed", "unproven"];
  const text = sources.map((s) => s.content.toLowerCase()).join(" ");
  const claimLower = claim.toLowerCase();

  return negativeWords.some((w) => text.includes(w)) &&
    !negativeWords.some((w) => claimLower.includes(w));
}

export async function POST(req: Request) {
  try {
    const { message, mode } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        reply: "Missing GROQ_API_KEY in .env.local.",
        trust: 20,
        claims: [{ text: "Groq API key is missing.", status: "Error" }],
        sources: [],
      });
    }

    let sources: Source[] = [];
    let context = "";

    if (process.env.TAVILY_API_KEY && mode !== "chat") {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: message,
          search_depth: "advanced",
          max_results: 5,
          include_answer: false,
        }),
      });

      const tavilyData = await tavilyRes.json();

      sources =
        tavilyData.results?.slice(0, 5).map((s: any) => ({
          title: s.title || "Source",
          url: s.url || "",
          domain: s.url ? new URL(s.url).hostname.replace("www.", "") : "source",
          content: s.content || "",
        })) || [];

      context = sources
        .map(
          (s, i) =>
            `Source ${i + 1}: ${s.title}\nDomain: ${s.domain}\nContent: ${s.content}\nURL: ${s.url}`
        )
        .join("\n\n");
    }

    const prompt =
      mode === "chat"
        ? message
        : `You are VeritasAI, an AI safety-focused assistant.

Your goal is to reduce hallucination risk.
Use the evidence below when possible.
If evidence is weak, conflicting, or missing, explicitly mention uncertainty.
Do NOT invent facts or sources.
For code questions, use triple backticks.

Evidence:
${context}

Question:
${message}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are VeritasAI. Prioritize truthfulness, uncertainty awareness, evidence grounding, and clear explanations. Do not fabricate.",
          },
          { role: "user", content: prompt },
        ],
        temperature: mode === "chat" ? 0.55 : 0.2,
      }),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      return NextResponse.json({
        reply: `Groq API error: ${groqData.error?.message || "Unknown error"}`,
        trust: 20,
        claims: [{ text: "Groq API returned an error.", status: "Error" }],
        sources,
      });
    }

    const reply =
      groqData.choices?.[0]?.message?.content || "No AI response generated.";

    const extractedClaims = extractClaims(reply);

    const verifiedClaims: Claim[] = extractedClaims.map((claim) => {
      if (sources.length === 0) {
        return { text: claim, status: "Unverified" };
      }

      const supportRatio = keywordSupport(claim, sources);
      const contradictionHint = detectPossibleContradiction(claim, sources);

      if (supportRatio >= 0.35) {
        return { text: claim, status: "Supported" };
      }

      if (contradictionHint && supportRatio < 0.2) {
        return { text: claim, status: "Contradicted" };
      }

      return { text: claim, status: "Uncertain" };
    });

    const supported = verifiedClaims.filter((c) => c.status === "Supported").length;
    const contradicted = verifiedClaims.filter((c) => c.status === "Contradicted").length;
    const uncertain = verifiedClaims.filter((c) => c.status === "Uncertain").length;

    const sourceScore = Math.min(sources.length * 8, 40);
    const supportScore =
      verifiedClaims.length > 0
        ? Math.round((supported / verifiedClaims.length) * 45)
        : 0;

    const penalty = contradicted * 12 + uncertain * 4;
    const auditBonus = mode === "audit" ? 5 : 0;

    const trust =
      mode === "chat"
        ? 60
        : Math.max(
            20,
            Math.min(95, 30 + sourceScore + supportScore + auditBonus - penalty)
          );

    return NextResponse.json({
      reply,
      trust,
      claims:
        verifiedClaims.length > 0
          ? verifiedClaims
          : [
              {
                text:
                  sources.length > 0
                    ? "Evidence was retrieved, but no clear factual claims were extracted."
                    : "No external evidence was retrieved.",
                status: sources.length > 0 ? "Uncertain" : "Unverified",
              },
            ],
      sources: sources.map((s) => ({
        title: s.title,
        url: s.url,
        domain: s.domain,
      })),
    });
  } catch {
    return NextResponse.json({
      reply: "Backend error. Check route.ts, .env.local, and restart npm run dev.",
      trust: 20,
      claims: [{ text: "Backend request failed.", status: "Error" }],
      sources: [],
    });
  }
}