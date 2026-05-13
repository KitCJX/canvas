"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import CanvasGrid from "@/components/CanvasGrid";
import CanvasEditor from "@/components/CanvasEditor";
import {
  listProjects,
  listTrashedProjects,
  listTrashedCanvases,
  createProject,
  renameProject,
  softDeleteProject,
  restoreProject,
  permanentDeleteProject,
  listCanvases,
  createCanvas,
  renameCanvas,
  duplicateCanvas,
  moveCanvas,
  softDeleteCanvas,
  restoreCanvas,
  permanentDeleteCanvas,
  touchCanvasOpened,
} from "@/lib/db";
import type { Project, Canvas } from "@/lib/types";
import { Loader2, Trash, RotateCcw, X } from "lucide-react";

type View = { kind: "grid" } | { kind: "editor"; canvas: Canvas };

type PendingDelete =
  | { kind: "project"; item: Project }
  | { kind: "canvas"; item: Canvas };

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [view, setView] = useState<View>({ kind: "grid" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // Trash state
  const [showTrash, setShowTrash] = useState(false);
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  const [trashedCanvases, setTrashedCanvases] = useState<Canvas[]>([]);
  const [trashCount, setTrashCount] = useState(0);

  const loadTrash = useCallback(async () => {
    const [tp, tc] = await Promise.all([listTrashedProjects(), listTrashedCanvases()]);
    setTrashedProjects(tp);
    setTrashedCanvases(tc);
    setTrashCount(tp.length + tc.length);
  }, []);

  useEffect(() => {
    listProjects()
      .then((ps) => { setProjects(ps); setLoading(false); })
      .catch((err) => {
        console.error(err);
        setError("Could not connect to the local database. Are you running inside Tauri?");
        setLoading(false);
      });
    loadTrash();
  }, [loadTrash]);

  useEffect(() => {
    if (!selectedProject) { setCanvases([]); return; }
    listCanvases(selectedProject.id).then(setCanvases).catch(console.error);
  }, [selectedProject]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "n" && view.kind === "grid" && !showTrash) {
        e.preventDefault();
        // Open new project if no project selected, otherwise focus is in CanvasGrid
      }
      if (e.key === "Escape") {
        if (pendingDelete) { setPendingDelete(null); return; }
        if (showTrash) { setShowTrash(false); return; }
        if (view.kind === "editor") { setView({ kind: "grid" }); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, pendingDelete, showTrash]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const handleCreateProject = useCallback(async (name: string) => {
    try {
      const p = await createProject(name);
      setProjects((prev) => [p, ...prev]);
      setSelectedProject(p);
      setView({ kind: "grid" });
    } catch (err) { console.error(err); }
  }, []);

  const handleRenameProject = useCallback(async (project: Project, name: string) => {
    try {
      await renameProject(project.id, name);
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, name } : p));
      if (selectedProject?.id === project.id) setSelectedProject((p) => p ? { ...p, name } : p);
    } catch (err) { console.error(err); }
  }, [selectedProject]);

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setView({ kind: "grid" });
  }, []);

  const handleDeleteProject = useCallback((project: Project) => {
    setPendingDelete({ kind: "project", item: project });
  }, []);

  const confirmDeleteProject = useCallback(async (project: Project) => {
    setPendingDelete(null);
    try {
      await softDeleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (selectedProject?.id === project.id) { setSelectedProject(null); setView({ kind: "grid" }); }
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [selectedProject, loadTrash]);

  // ── Canvases ──────────────────────────────────────────────────────────────
  const handleCreateCanvas = useCallback(async (name: string, type: "excalidraw" | "tldraw") => {
    if (!selectedProject) return;
    try {
      const c = await createCanvas(selectedProject.id, name, type);
      setCanvases((prev) => [c, ...prev]);
      setView({ kind: "editor", canvas: c });
    } catch (err) { console.error(err); }
  }, [selectedProject]);

  const handleRenameCanvas = useCallback(async (canvas: Canvas, name: string) => {
    try {
      await renameCanvas(canvas.id, name);
      setCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, name } : c));
    } catch (err) { console.error(err); }
  }, []);

  const handleDuplicateCanvas = useCallback(async (canvas: Canvas) => {
    try {
      const copy = await duplicateCanvas(canvas);
      setCanvases((prev) => [copy, ...prev]);
    } catch (err) { console.error(err); }
  }, []);

  const handleMoveCanvas = useCallback(async (canvas: Canvas, targetProjectId: string) => {
    try {
      await moveCanvas(canvas.id, targetProjectId);
      setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
      if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "grid" });
    } catch (err) { console.error(err); }
  }, [view]);

  const handleDeleteCanvas = useCallback((canvas: Canvas) => {
    setPendingDelete({ kind: "canvas", item: canvas });
  }, []);

  const confirmDeleteCanvas = useCallback(async (canvas: Canvas) => {
    setPendingDelete(null);
    try {
      await softDeleteCanvas(canvas.id);
      setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
      if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "grid" });
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [view, loadTrash]);

  const handleOpenCanvas = useCallback((canvas: Canvas) => {
    touchCanvasOpened(canvas.id).catch(console.error);
    setView({ kind: "editor", canvas });
  }, []);

  const handleBack = useCallback(() => setView({ kind: "grid" }), []);

  // ── Trash actions ─────────────────────────────────────────────────────────
  const handleRestoreProject = useCallback(async (p: Project) => {
    try {
      await restoreProject(p.id);
      setProjects((prev) => [{ ...p, deletedAt: null }, ...prev]);
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [loadTrash]);

  const handleRestoreCanvas = useCallback(async (c: Canvas) => {
    try {
      await restoreCanvas(c.id);
      if (selectedProject?.id === c.projectId) {
        setCanvases((prev) => [{ ...c, deletedAt: null }, ...prev]);
      }
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [selectedProject, loadTrash]);

  const handlePermanentDeleteProject = useCallback(async (p: Project) => {
    try {
      await permanentDeleteProject(p.id);
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [loadTrash]);

  const handlePermanentDeleteCanvas = useCallback(async (c: Canvas) => {
    try {
      await permanentDeleteCanvas(c.id);
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [loadTrash]);

  // ── Full-screen editor ────────────────────────────────────────────────────
  if (view.kind === "editor") {
    return (
      <CanvasEditor
        canvas={view.canvas}
        projectName={selectedProject?.name ?? ""}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        projects={projects}
        selectedId={selectedProject?.id ?? null}
        onSelect={handleSelectProject}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
        onRename={handleRenameProject}
        onTrash={() => { loadTrash(); setShowTrash(true); }}
        trashCount={trashCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span className="text-sm">Connecting to database…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center max-w-sm">
              <p className="text-red-500 text-sm font-medium">Connection error</p>
              <p className="text-gray-400 text-xs mt-1">{error}</p>
            </div>
          </div>
        ) : !selectedProject ? (
          <div className="flex items-center justify-center flex-1 text-gray-400">
            <p className="text-sm">Select or create a project to get started.</p>
          </div>
        ) : (
          <CanvasGrid
            project={selectedProject}
            canvases={canvases}
            allProjects={projects}
            onCreate={handleCreateCanvas}
            onOpen={handleOpenCanvas}
            onDelete={handleDeleteCanvas}
            onRename={handleRenameCanvas}
            onDuplicate={handleDuplicateCanvas}
            onMove={handleMoveCanvas}
          />
        )}
      </main>

      {/* ── Confirm delete modal ───────────────────────────────────────────── */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {pendingDelete.kind === "project" ? "Move project to trash?" : "Move canvas to trash?"}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {pendingDelete.kind === "project"
                ? `"${pendingDelete.item.name}" and all its canvases will be moved to trash.`
                : `"${pendingDelete.item.name}" will be moved to trash.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  pendingDelete.kind === "project"
                    ? confirmDeleteProject(pendingDelete.item)
                    : confirmDeleteCanvas(pendingDelete.item)
                }
                className="flex-1 text-sm bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 transition-colors"
              >
                Move to Trash
              </button>
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 text-sm bg-gray-100 text-gray-600 rounded-lg py-2 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trash panel ───────────────────────────────────────────────────── */}
      {showTrash && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Trash size={16} className="text-gray-500" />
                <h3 className="text-base font-semibold text-gray-900">Trash</h3>
                {trashCount > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                    {trashCount}
                  </span>
                )}
              </div>
              <button onClick={() => setShowTrash(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3">
              {trashCount === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Trash is empty.</p>
              ) : (
                <>
                  {trashedProjects.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Projects</p>
                      {trashedProjects.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700 flex-1 truncate">{p.name}</span>
                          <button
                            onClick={() => handleRestoreProject(p)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            title="Restore"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteProject(p)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                            title="Delete forever"
                          >
                            <X size={12} /> Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {trashedCanvases.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Canvases</p>
                      {trashedCanvases.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                              c.type === "excalidraw"
                                ? "bg-violet-100 text-violet-600"
                                : "bg-sky-100 text-sky-600"
                            }`}
                          >
                            {c.type}
                          </span>
                          <span className="text-sm text-gray-700 flex-1 truncate">{c.name}</span>
                          <button
                            onClick={() => handleRestoreCanvas(c)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <RotateCcw size={12} /> Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteCanvas(c)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                          >
                            <X size={12} /> Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
