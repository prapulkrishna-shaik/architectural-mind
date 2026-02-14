

# AutoArchitect MVP — AI-Powered Architecture Analysis Platform

## Overview
A single-user platform that ingests code from GitHub repos and uploaded documents (PDF/DOC), analyzes them using AI (Lovable AI Gateway), and generates interactive Mermaid architecture diagrams and structured summaries.

---

## Page 1: Dashboard / Projects
- List of past analysis projects with name, date, and status
- "New Analysis" button to start a new project
- Quick preview of generated diagrams for each project
- Clean, modern dark-themed UI with card-based layout

## Page 2: New Analysis — Input Sources
A multi-step wizard for configuring a new analysis:

### Step 1: Project Setup
- Project name and optional description

### Step 2: Input Sources (tabs for each source type)
- **GitHub Tab**: Enter a public GitHub repo URL → fetches repo structure and key files via GitHub API (README, package.json, source files, configs)
- **File Upload Tab**: Drag-and-drop zone for PDF/DOC files → parsed on the frontend for text extraction
- **Google Drive Tab**: Connect via Google OAuth → browse and select documents to import
- Users can combine multiple sources in one analysis

### Step 3: Analysis Options
- Choose analysis focus: Full Architecture, Backend Only, Frontend Only, Data Flow, API Surface
- Choose diagram types to generate: Component Diagram, Sequence Diagram, Data Flow, Class Diagram, Deployment Diagram

## Page 3: Analysis Processing
- Animated progress view showing each stage: Fetching Sources → Extracting Content → Analyzing Architecture → Generating Diagrams
- Real-time streaming of AI reasoning/analysis as it processes
- Estimated time remaining

## Page 4: Results & Visualization
- **Diagram Viewer**: Rendered Mermaid diagrams (component, sequence, data flow, class diagrams) with tabs to switch between diagram types
- **Structured Summary**: AI-generated architectural summary including detected patterns (MVC, microservices, etc.), key components, dependencies, and technology stack
- **Raw Output**: View the raw Mermaid code with copy-to-clipboard
- Export options: Copy Mermaid code, download as PNG/SVG
- "Re-analyze" button to refine with different options

---

## Backend (Lovable Cloud + Edge Functions)

### Edge Function: `analyze-github`
- Accepts a GitHub repo URL
- Uses GitHub API to fetch repository tree, README, package.json, key source files
- Returns structured content for AI processing

### Edge Function: `analyze-architecture`
- Receives extracted content from all sources (GitHub files, uploaded doc text)
- Sends to Lovable AI (Gemini) with a detailed system prompt for architectural analysis
- Streams back: detected patterns, component relationships, and Mermaid diagram code
- Returns structured JSON with diagrams and summaries

### Edge Function: `google-drive-list` & `google-drive-fetch`
- OAuth token-based access to list and fetch Google Drive documents

---

## Data & State Management
- Projects and results stored in Supabase database (projects table, analysis_results table)
- File uploads temporarily stored for processing
- TanStack Query for data fetching and caching

## Key Technical Decisions
- **Mermaid.js** for diagram rendering directly in the browser
- **AI-powered analysis** via Lovable AI Gateway (Gemini model) — no AST parsing needed
- **Streaming responses** for real-time analysis feedback
- **GitHub REST API** for repo content fetching (no server-side cloning)
- **Google OAuth** connector for Drive integration

