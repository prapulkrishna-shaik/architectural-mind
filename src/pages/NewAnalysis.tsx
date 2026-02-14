import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, GitBranch, Upload, Cloud, Sparkles,
  X, FileText, CheckCircle2, Loader2,
} from "lucide-react";
import type { Source, AnalysisOptions } from "@/lib/types";

const FOCUS_OPTIONS = ["Full Architecture", "Backend Only", "Frontend Only", "Data Flow", "API Surface"];
const DIAGRAM_OPTIONS = ["Component Diagram", "Sequence Diagram", "Data Flow", "Class Diagram", "Deployment Diagram"];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [focus, setFocus] = useState("Full Architecture");
  const [diagramTypes, setDiagramTypes] = useState<string[]>(["Component Diagram"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addGithubSource = () => {
    if (!githubUrl.trim()) return;
    const repoName = githubUrl.split("/").slice(-2).join("/") || githubUrl;
    setSources((prev) => [...prev, { type: "github", name: repoName, url: githubUrl.trim() }]);
    setGithubUrl("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setSources((prev) => [
          ...prev,
          { type: "upload", name: file.name, content: reader.result as string },
        ]);
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const removeSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDiagram = (d: string) => {
    setDiagramTypes((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || sources.length === 0 || diagramTypes.length === 0) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const options: AnalysisOptions = { focus, diagramTypes };
      const { data, error } = await supabase
        .from("projects")
        .insert([{ name, description: description || null, sources: JSON.parse(JSON.stringify(sources)), analysis_options: JSON.parse(JSON.stringify(options)), status: "processing" }])
        .select()
        .single();
      if (error) throw error;
      navigate(`/project/${data.id}`);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { title: "Project Setup", subtitle: "Name your analysis project" },
    { title: "Input Sources", subtitle: "Add code and documents to analyze" },
    { title: "Analysis Options", subtitle: "Configure what to analyze" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
        <p className="mt-1 text-muted-foreground">Configure and run an architecture analysis.</p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i === step
                  ? "gradient-primary text-primary-foreground glow-primary"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </button>
            <span className={`hidden text-sm font-medium sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {s.title}
            </span>
            {i < steps.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 0: Project Setup */}
          {step === 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>{steps[0].title}</CardTitle>
                <CardDescription>{steps[0].subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Project Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Backend Analysis" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="mt-1.5" rows={3} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Input Sources */}
          {step === 1 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>{steps[1].title}</CardTitle>
                <CardDescription>{steps[1].subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="github">
                  <TabsList className="mb-4 w-full">
                    <TabsTrigger value="github" className="flex-1 gap-1.5"><GitBranch className="h-3.5 w-3.5" />GitHub</TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1 gap-1.5"><Upload className="h-3.5 w-3.5" />File Upload</TabsTrigger>
                    <TabsTrigger value="drive" className="flex-1 gap-1.5"><Cloud className="h-3.5 w-3.5" />Google Drive</TabsTrigger>
                  </TabsList>
                  <TabsContent value="github" className="space-y-3">
                    <div className="flex gap-2">
                      <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/user/repo" onKeyDown={(e) => e.key === "Enter" && addGithubSource()} />
                      <Button onClick={addGithubSource} variant="secondary">Add</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Enter a public GitHub repository URL. We'll fetch the file tree, README, and key source files.</p>
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-3">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-secondary/30 py-10 transition-colors hover:border-primary/30 hover:bg-secondary/50">
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Drop files here or click to upload</span>
                      <span className="mt-1 text-xs text-muted-foreground">PDF, DOC, TXT, MD, JSON, etc.</span>
                      <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml" />
                    </label>
                  </TabsContent>
                  <TabsContent value="drive">
                    <div className="flex flex-col items-center py-10 text-center">
                      <Cloud className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Google Drive integration coming soon.</p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Sources list */}
                {sources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Added Sources ({sources.length})</Label>
                    {sources.map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          {s.type === "github" ? <GitBranch className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-accent" />}
                          <span className="font-medium">{s.name}</span>
                          <Badge variant="outline" className="text-xs">{s.type}</Badge>
                        </div>
                        <button onClick={() => removeSource(i)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Analysis Options */}
          {step === 2 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>{steps[2].title}</CardTitle>
                <CardDescription>{steps[2].subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-2 block">Analysis Focus</Label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map((f) => (
                      <Badge
                        key={f}
                        variant={focus === f ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${focus === f ? "gradient-primary border-0" : "hover:border-primary/50"}`}
                        onClick={() => setFocus(f)}
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Diagram Types *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAGRAM_OPTIONS.map((d) => (
                      <Badge
                        key={d}
                        variant={diagramTypes.includes(d) ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${diagramTypes.includes(d) ? "bg-accent text-accent-foreground border-0" : "hover:border-accent/50"}`}
                        onClick={() => toggleDiagram(d)}
                      >
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !name.trim()}>
            Next<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting || sources.length === 0 || diagramTypes.length === 0} className="gradient-primary border-0 glow-primary">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Start Analysis
          </Button>
        )}
      </div>
    </div>
  );
}
