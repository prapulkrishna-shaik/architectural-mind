import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, RefreshCw, Loader2, CheckCircle2, Code2, LayoutDashboard, FileText, Sparkles } from "lucide-react";
import MermaidDiagram from "@/components/MermaidDiagram";
import type { Project, AnalysisResult, AnalysisOptions } from "@/lib/types";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

const PROCESSING_STAGES = [
  "Fetching Sources",
  "Extracting Content",
  "Analyzing Architecture",
  "Generating Diagrams",
];

export default function ProjectResults() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [streamedText, setStreamedText] = useState("");
  const [processingStage, setProcessingStage] = useState(0);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Project;
    },
    refetchInterval: (query) => {
      const data = query.state.data as Project | undefined;
      return data?.status === "processing" ? 3000 : false;
    },
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["results", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("analysis_results").select("*").eq("project_id", id!);
      if (error) throw error;
      return data as unknown as AnalysisResult[];
    },
    enabled: !!project && project.status === "completed",
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      setStreamedText("");
      setProcessingStage(0);

      // Update project status to processing
      await supabase.from("projects").update({ status: "processing" }).eq("id", id!);

      // Delete old results
      await supabase.from("analysis_results").delete().eq("project_id", id!);

      // Stage 1: Fetch GitHub sources
      setProcessingStage(0);
      const githubSources = (project?.sources || []).filter((s) => s.type === "github");
      const fetchedContents: string[] = [];

      for (const source of githubSources) {
        if (source.url) {
          try {
            const { data, error } = await supabase.functions.invoke("analyze-github", {
              body: { repoUrl: source.url },
            });
            if (error) throw error;
            fetchedContents.push(data.content);
          } catch (err) {
            console.error("GitHub fetch error:", err);
            fetchedContents.push(`Failed to fetch ${source.url}`);
          }
        }
      }

      // Include uploaded file content
      const uploadSources = (project?.sources || []).filter((s) => s.type === "upload");
      for (const source of uploadSources) {
        if (source.content) fetchedContents.push(`--- File: ${source.name} ---\n${source.content}`);
      }

      setProcessingStage(1);
      const allContent = fetchedContents.join("\n\n");

      // Stage 2-3: Analyze with AI (streaming)
      setProcessingStage(2);
      const options = project?.analysis_options as AnalysisOptions;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-architecture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          content: allContent,
          focus: options?.focus || "Full Architecture",
          diagramTypes: options?.diagramTypes || ["Component Diagram"],
          projectId: id,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || "Analysis failed");
      }

      // Stream response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setStreamedText(fullText);
              if (fullText.includes("```mermaid")) setProcessingStage(3);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Parse mermaid blocks from AI response
      const mermaidBlocks = fullText.match(/```mermaid\n([\s\S]*?)```/g) || [];
      const diagramTypeNames = options?.diagramTypes || ["Component Diagram"];

      for (let i = 0; i < mermaidBlocks.length; i++) {
        const code = mermaidBlocks[i].replace(/```mermaid\n/, "").replace(/```$/, "").trim();
        await supabase.from("analysis_results").insert({
          project_id: id!,
          diagram_type: diagramTypeNames[i] || `Diagram ${i + 1}`,
          mermaid_code: code,
          summary: null,
        });
      }

      // Extract summary (text outside mermaid blocks)
      const summaryText = fullText.replace(/```mermaid[\s\S]*?```/g, "").trim();
      if (summaryText && mermaidBlocks.length > 0) {
        // Update first result with summary
        const { data: firstResult } = await supabase
          .from("analysis_results")
          .select("id")
          .eq("project_id", id!)
          .limit(1)
          .maybeSingle();
        if (firstResult) {
          await supabase.from("analysis_results").update({ summary: JSON.parse(JSON.stringify({ text: summaryText })) }).eq("id", firstResult.id);
        }
      }

      await supabase.from("projects").update({ status: mermaidBlocks.length > 0 ? "completed" : "failed" }).eq("id", id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["results", id] });
      toast({ title: "Analysis complete" });
    },
    onError: (err) => {
      console.error(err);
      supabase.from("projects").update({ status: "failed" }).eq("id", id!);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast({ title: "Analysis failed", description: String(err), variant: "destructive" });
    },
  });

  // Auto-start analysis for new projects
  const startAnalysis = useCallback(() => {
    if (project?.status === "processing" && !analysisMutation.isPending && !results?.length) {
      analysisMutation.mutate();
    }
  }, [project?.status, analysisMutation.isPending, results?.length]);

  useEffect(() => {
    startAnalysis();
  }, [startAnalysis]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied to clipboard" });
  };

  if (projectLoading) {
    return <div className="mx-auto max-w-4xl space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">Project not found</div>;
  }

  const isProcessing = project.status === "processing" || analysisMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
        </div>
        {project.status === "completed" && (
          <Button variant="outline" onClick={() => analysisMutation.mutate()} disabled={analysisMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${analysisMutation.isPending ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        )}
      </div>

      {/* Processing view */}
      {isProcessing && (
        <Card className="border-border/50">
          <CardContent className="py-10">
            <div className="mb-8 space-y-3">
              {PROCESSING_STAGES.map((stage, i) => (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: i <= processingStage ? 1 : 0.4 }}
                  className="flex items-center gap-3"
                >
                  {i < processingStage ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : i === processingStage ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted" />
                  )}
                  <span className={`text-sm font-medium ${i === processingStage ? "text-primary" : i < processingStage ? "text-success" : "text-muted-foreground"}`}>
                    {stage}
                  </span>
                </motion.div>
              ))}
            </div>
            {streamedText && (
              <div className="mt-6 max-h-60 overflow-auto rounded-xl bg-secondary/30 p-4 font-mono text-xs text-muted-foreground">
                {streamedText.slice(-500)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed view */}
      {project.status === "failed" && !isProcessing && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center py-10">
            <p className="mb-4 text-destructive">Analysis failed. Please try again.</p>
            <Button onClick={() => analysisMutation.mutate()} className="gradient-primary border-0">
              <RefreshCw className="mr-2 h-4 w-4" />Retry Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results view */}
      {project.status === "completed" && results && results.length > 0 && (
        <Tabs defaultValue={results[0]?.diagram_type || "summary"}>
          <TabsList className="mb-4 flex-wrap">
            {results.map((r) => (
              <TabsTrigger key={r.id} value={r.diagram_type} className="gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" />{r.diagram_type}
              </TabsTrigger>
            ))}
            {results[0]?.summary && <TabsTrigger value="summary"><FileText className="mr-1.5 h-3.5 w-3.5" />Summary</TabsTrigger>}
            <TabsTrigger value="raw"><Code2 className="mr-1.5 h-3.5 w-3.5" />Raw</TabsTrigger>
          </TabsList>

          {results.map((r) => (
            <TabsContent key={r.id} value={r.diagram_type}>
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{r.diagram_type}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => copyCode(r.mermaid_code)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />Copy
                  </Button>
                </CardHeader>
                <CardContent>
                  <MermaidDiagram code={r.mermaid_code} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {results[0]?.summary && (
            <TabsContent value="summary">
              <Card className="border-border/50">
                <CardContent className="prose prose-invert max-w-none pt-6">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                    {(results[0].summary as Record<string, string>)?.text || JSON.stringify(results[0].summary, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="raw">
            <div className="space-y-4">
              {results.map((r) => (
                <Card key={r.id} className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">{r.diagram_type}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => copyCode(r.mermaid_code)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />Copy
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-auto rounded-xl bg-secondary/30 p-4 font-mono text-xs">{r.mermaid_code}</pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {project.status === "completed" && (!results || results.length === 0) && !resultsLoading && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center py-10">
            <Sparkles className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">No diagrams generated. Try re-analyzing.</p>
            <Button onClick={() => analysisMutation.mutate()} className="gradient-primary border-0">
              <RefreshCw className="mr-2 h-4 w-4" />Re-analyze
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
