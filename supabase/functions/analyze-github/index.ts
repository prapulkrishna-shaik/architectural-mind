import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { repoUrl } = await req.json();
    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "repoUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Invalid GitHub URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    const apiBase = `https://api.github.com/repos/${owner}/${cleanRepo}`;
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json", "User-Agent": "AutoArchitect" };

    // Fetch repo tree (recursive, default branch)
    const treeResp = await fetch(`${apiBase}/git/trees/HEAD?recursive=1`, { headers });
    if (!treeResp.ok) {
      const t = await treeResp.text();
      throw new Error(`GitHub API error: ${treeResp.status} ${t}`);
    }
    const treeData = await treeResp.json();
    const tree: Array<{ path: string; type: string; size?: number }> = treeData.tree || [];

    // Key files to fetch
    const keyPatterns = [
      /^readme\.md$/i,
      /^package\.json$/i,
      /^tsconfig\.json$/i,
      /^docker-compose\.ya?ml$/i,
      /^dockerfile$/i,
      /^\.env\.example$/i,
      /^src\/app\.(tsx?|jsx?)$/i,
      /^src\/main\.(tsx?|jsx?)$/i,
      /^src\/index\.(tsx?|jsx?)$/i,
      /^app\.(tsx?|jsx?|py|go|rb)$/i,
      /^main\.(tsx?|jsx?|py|go|rb)$/i,
      /^server\.(tsx?|jsx?|py|go|rb)$/i,
      /^routes\//i,
      /^api\//i,
      /^src\/routes\//i,
      /^src\/pages\//i,
      /^src\/components\/.*index\.(tsx?|jsx?)$/i,
      /^config\//i,
      /requirements\.txt$/i,
      /go\.mod$/i,
      /Cargo\.toml$/i,
      /pyproject\.toml$/i,
    ];

    const filesToFetch = tree
      .filter((f) => f.type === "blob" && keyPatterns.some((p) => p.test(f.path)))
      .slice(0, 30); // Limit

    const fileTree = tree
      .filter((f) => f.type === "blob")
      .map((f) => f.path)
      .join("\n");

    // Fetch file contents
    const fileContents: string[] = [`=== Repository: ${owner}/${cleanRepo} ===\n\n=== File Tree ===\n${fileTree}\n`];

    for (const file of filesToFetch) {
      try {
        const contentResp = await fetch(`${apiBase}/contents/${file.path}`, { headers });
        if (!contentResp.ok) continue;
        const contentData = await contentResp.json();
        if (contentData.encoding === "base64" && contentData.content) {
          const decoded = atob(contentData.content.replace(/\n/g, ""));
          // Skip large files
          if (decoded.length > 10000) {
            fileContents.push(`--- ${file.path} (truncated, ${decoded.length} chars) ---\n${decoded.slice(0, 5000)}\n...[truncated]`);
          } else {
            fileContents.push(`--- ${file.path} ---\n${decoded}`);
          }
        }
      } catch {
        // Skip files that fail
      }
    }

    return new Response(
      JSON.stringify({ content: fileContents.join("\n\n") }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-github error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
