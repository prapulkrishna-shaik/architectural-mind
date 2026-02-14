export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  sources: Source[];
  analysis_options: AnalysisOptions;
  created_at: string;
  updated_at: string;
}

export interface Source {
  type: 'github' | 'upload' | 'google-drive';
  name: string;
  url?: string;
  content?: string;
}

export interface AnalysisOptions {
  focus?: string;
  diagramTypes?: string[];
}

export interface AnalysisResult {
  id: string;
  project_id: string;
  diagram_type: string;
  mermaid_code: string;
  summary: Record<string, unknown> | null;
  created_at: string;
}
