import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, focus, diagramTypes, projectId } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const diagramInstructions = (diagramTypes || ["Component Diagram"])
      .map((d: string) => {
        switch (d) {
          case "Component Diagram": return "A Mermaid graph TD component diagram showing major components and their relationships";
          case "Sequence Diagram": return "A Mermaid sequenceDiagram showing key request/response flows";
          case "Data Flow": return "A Mermaid flowchart showing data flow between systems";
          case "Class Diagram": return "A Mermaid classDiagram showing key classes/models and relationships";
          case "Deployment Diagram": return "A Mermaid graph showing deployment architecture (servers, services, databases)";
          default: return `A Mermaid diagram for: ${d}`;
        }
      })
      .join("\n- ");

    const systemPrompt = `You are an expert software architect. Analyze the provided codebase and documentation to understand the architecture.

Focus area: ${focus || "Full Architecture"}

Generate the following diagrams as valid Mermaid code blocks (each wrapped in \`\`\`mermaid ... \`\`\`):
- ${diagramInstructions}

Also provide a structured summary including:
- Detected architectural patterns (MVC, microservices, monolith, event-driven, layered, etc.)
- Key components and their responsibilities
- Technology stack
- Dependencies and integrations
- Data flow overview

IMPORTANT:
- Use VALID Mermaid syntax. Test each diagram mentally before outputting.
- Keep node labels short (no special characters that break Mermaid).
- Use simple alphanumeric IDs for nodes (e.g., A, B, C or api, db, auth).
- Wrap labels in square brackets for graph diagrams: A[Label Text]
- Do NOT use parentheses or quotes inside node labels.
- Each diagram must be in its own \`\`\`mermaid code block.
- Provide the summary text AFTER the diagrams.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this codebase:\n\n${content.slice(0, 80000)}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-architecture error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
