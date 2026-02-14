import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "JetBrains Mono, monospace",
});

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

export default function MermaidDiagram({ code, className }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !code) return;
    setError(null);

    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
        setError("Failed to render diagram. The Mermaid code may be invalid.");
      });
  }, [code]);

  if (error) {
    return (
      <div className={`rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div ref={ref} className={`overflow-auto rounded-xl bg-card/50 p-4 [&_svg]:mx-auto ${className}`} />
  );
}
