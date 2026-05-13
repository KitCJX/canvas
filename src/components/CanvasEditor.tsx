"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import type { Canvas } from "@/lib/types";

const ExcalidrawEditor = dynamic(
  () => import("./editors/ExcalidrawEditor"),
  {
    ssr: false,
    loading: () => <EditorLoading label="Excalidraw" />,
  }
);

const TldrawEditor = dynamic(
  () => import("./editors/TldrawEditor"),
  {
    ssr: false,
    loading: () => <EditorLoading label="tldraw" />,
  }
);

function EditorLoading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-gray-400 mr-2" size={20} />
      <span className="text-gray-500 text-sm">Loading {label}…</span>
    </div>
  );
}

type SaveStatus = "idle" | "saving" | "saved";

interface Props {
  canvas: Canvas;
  projectName: string;
  onBack: () => void;
}

export default function CanvasEditor({ canvas, projectName, onBack }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const handleSaved = useCallback(() => {
    setSaveStatus("saved");
    const t = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-gray-200 shrink-0 bg-white z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={15} />
          <span>{projectName}</span>
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-800">{canvas.name}</span>
        <span className="text-xs text-gray-400 capitalize bg-gray-100 rounded px-1.5 py-0.5">
          {canvas.type}
        </span>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="animate-spin" size={12} />
              Saving…
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle size={12} className="text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        {canvas.type === "excalidraw" ? (
          <ExcalidrawEditor canvas={canvas} onSaved={handleSaved} />
        ) : (
          <TldrawEditor canvas={canvas} onSaved={handleSaved} />
        )}
      </div>
    </div>
  );
}
