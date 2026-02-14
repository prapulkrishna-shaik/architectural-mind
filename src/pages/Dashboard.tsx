import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, GitBranch, FileText, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Project } from "@/lib/types";
import { motion } from "framer-motion";

const statusConfig: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  draft: { icon: Clock, className: "bg-muted text-muted-foreground", label: "Draft" },
  processing: { icon: Loader2, className: "bg-warning/20 text-warning", label: "Processing" },
  completed: { icon: CheckCircle2, className: "bg-success/20 text-success", label: "Completed" },
  failed: { icon: XCircle, className: "bg-destructive/20 text-destructive", label: "Failed" },
};

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Project[];
    },
  });

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Analyze codebases and generate architecture diagrams with AI.
          </p>
        </div>
        <Button asChild className="gradient-primary border-0 glow-primary">
          <Link to="/new">
            <Plus className="mr-2 h-4 w-4" />
            New Analysis
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !projects?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/50 py-20"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary glow-primary">
            <GitBranch className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No projects yet</h2>
          <p className="mb-6 max-w-sm text-center text-muted-foreground">
            Start by creating a new analysis from a GitHub repo, uploaded docs, or Google Drive files.
          </p>
          <Button asChild className="gradient-primary border-0">
            <Link to="/new">
              <Plus className="mr-2 h-4 w-4" />
              Create First Analysis
            </Link>
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => {
            const status = statusConfig[project.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/project/${project.id}`}>
                  <Card className="group cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:glow-primary">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        <Badge variant="secondary" className={status.className}>
                          <StatusIcon className={`mr-1 h-3 w-3 ${project.status === 'processing' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {project.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {(project.sources as unknown as Array<unknown>)?.length || 0} sources
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
