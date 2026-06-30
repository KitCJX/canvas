"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, CheckCircle, Copy, Download, History, Loader2, MoreHorizontal, PenLine, Trash2, XCircle } from "lucide-react";
import { listCanvasVersions, restoreCanvasVersion } from "@/lib/db";
import type { Canvas, CanvasVersion } from "@/lib/types";

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

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface Props {
  canvas: Canvas;
  projectName: string;
  onBack: () => void;
  onRename: (canvas: Canvas, name: string) => void;
  onDuplicate: (canvas: Canvas) => void;
  onDelete: (canvas: Canvas) => void;
  onExport: (canvas: Canvas) => void;
  onCanvasSaved: (canvas: Canvas) => void;
}

export default function CanvasEditor({
  canvas,
  projectName,
  onBack,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
  onCanvasSaved,
}: Props) {
  const [activeCanvas, setActiveCanvas] = useState(canvas);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveSignal, setSaveSignal] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(canvas.name);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const markStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
    if (status !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleSaved = useCallback((data: string, thumbnail: string) => {
    const updated = { ...activeCanvas, data, thumbnail, updatedAt: new Date().toISOString() };
    setActiveCanvas(updated);
    onCanvasSaved(updated);
  }, [activeCanvas, onCanvasSaved]);

  const requestBack = useCallback(() => {
    if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error") {
      const leave = window.confirm("This canvas has unsaved or failed changes. Leave the editor anyway?");
      if (!leave) return;
    }
    onBack();
  }, [onBack, saveStatus]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSaveSignal((value) => value + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const commitRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    const updated = { ...activeCanvas, name };
    setActiveCanvas(updated);
    onRename(activeCanvas, name);
    setRenaming(false);
    setShowActions(false);
  };

  const openHistory = async () => {
    setVersions(await listCanvasVersions(activeCanvas.id));
    setShowHistory(true);
    setShowActions(false);
  };

  const restoreVersion = async (version: CanvasVersion) => {
    await restoreCanvasVersion(activeCanvas.id, version);
    const updated = { ...activeCanvas, data: version.data, thumbnail: version.thumbnail, updatedAt: new Date().toISOString() };
    setActiveCanvas(updated);
    onCanvasSaved(updated);
    setReloadKey((value) => value + 1);
    setShowHistory(false);
    markStatus("saved");
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-gray-200 shrink-0 bg-white z-10">
        <button
          onClick={requestBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={15} />
          <span>{projectName}</span>
        </button>
        <span className="text-gray-300">/</span>
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") setRenaming(false);
            }}
            className="text-sm font-medium text-gray-800 border border-blue-400 rounded px-1.5 py-0.5 outline-none"
          />
        ) : (
          <span className="text-sm font-medium text-gray-800">{activeCanvas.name}</span>
        )}
        <span className="text-xs text-gray-400 capitalize bg-gray-100 rounded px-1.5 py-0.5">
          {activeCanvas.type}
        </span>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          {saveStatus === "dirty" && <span>Unsaved</span>}
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
          {saveStatus === "error" && (
            <>
              <XCircle size={12} className="text-red-500" />
              <span className="text-red-600">Save failed</span>
            </>
          )}
          <button
            onClick={() => setSaveSignal((value) => value + 1)}
            className="ml-3 rounded px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            title="Save now (⌘S)"
          >
            Save
          </button>
          <div className="relative">
            <button
              onClick={() => setShowActions((value) => !value)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              title="Canvas actions"
            >
              <MoreHorizontal size={16} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-7 z-30 w-44 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-xl">
                <button onClick={() => { setRenaming(true); setShowActions(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"><PenLine size={14} /> Rename</button>
                <button onClick={() => { onDuplicate(activeCanvas); setShowActions(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"><Copy size={14} /> Duplicate</button>
                <button onClick={() => { onExport(activeCanvas); setShowActions(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"><Download size={14} /> Export JSON</button>
                <button onClick={openHistory} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"><History size={14} /> Version history</button>
                <button onClick={() => { onDelete(activeCanvas); setShowActions(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50"><Trash2 size={14} /> Move to trash</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        {activeCanvas.type === "excalidraw" ? (
          <ExcalidrawEditor key={reloadKey} canvas={activeCanvas} onSaveStatus={markStatus} onSaved={handleSaved} saveSignal={saveSignal} />
        ) : (
          <TldrawEditor key={reloadKey} canvas={activeCanvas} onSaveStatus={markStatus} onSaved={handleSaved} saveSignal={saveSignal} />
        )}
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="flex max-h-[70vh] w-[420px] flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Version history</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700">x</button>
            </div>
            <div className="overflow-y-auto p-3">
              {versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No saved versions yet.</p>
              ) : versions.map((version) => (
                <div key={version.id} className="flex items-center gap-3 border-b border-gray-100 px-2 py-2 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{new Date(version.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{Math.max(1, Math.round(version.data.length / 1024))} KB</p>
                  </div>
                  <button onClick={() => restoreVersion(version)} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">Restore</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
