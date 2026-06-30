"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import CanvasGrid from "@/components/CanvasGrid";
import CanvasEditor from "@/components/CanvasEditor";
import {
  listProjects,
  listTrashedProjects,
  listTrashedCanvases,
  listAllCanvases,
  listRecentCanvases,
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
  exportBackup,
  importBackup,
} from "@/lib/db";
import type { Project, Canvas } from "@/lib/types";
import { Loader2, RotateCcw, Search, Trash, X } from "lucide-react";

type View = { kind: "grid" } | { kind: "editor"; canvas: Canvas };

type PendingDelete =
  | { kind: "project"; item: Project }
  | { kind: "canvas"; item: Canvas };

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [allCanvases, setAllCanvases] = useState<Canvas[]>([]);
  const [recentCanvases, setRecentCanvases] = useState<Canvas[]>([]);
  const [view, setView] = useState<View>({ kind: "grid" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: () => void } | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [draggingCanvas, setDraggingCanvas] = useState<Canvas | null>(null);

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

  const refreshCanvases = useCallback(async (projectId = selectedProject?.id) => {
    const [all, recent] = await Promise.all([listAllCanvases(), listRecentCanvases()]);
    setAllCanvases(all);
    setRecentCanvases(recent);
    if (projectId) setCanvases(await listCanvases(projectId));
  }, [selectedProject]);

  const reloadProjects = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  useEffect(() => {
    listProjects()
      .then((ps) => { setProjects(ps); setLoading(false); })
      .catch((err) => {
        console.error(err);
        setError("Could not connect to the local database. Are you running inside Tauri?");
        setLoading(false);
      });
    Promise.all([listTrashedProjects(), listTrashedCanvases(), listAllCanvases(), listRecentCanvases()])
      .then(([tp, tc, all, recent]) => {
        setTrashedProjects(tp);
        setTrashedCanvases(tc);
        setTrashCount(tp.length + tc.length);
        setAllCanvases(all);
        setRecentCanvases(recent);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    listCanvases(selectedProject.id).then(setCanvases).catch(console.error);
  }, [selectedProject]);

  // ── Projects ──────────────────────────────────────────────────────────────
  const handleCreateProject = useCallback(async (name: string) => {
    try {
      const p = await createProject(name);
      setProjects((prev) => [p, ...prev]);
      setSelectedProject(p);
      setView({ kind: "grid" });
      await refreshCanvases(p.id);
    } catch (err) { console.error(err); }
  }, [refreshCanvases]);

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
      await refreshCanvases(undefined);
      setToast({
        message: "Project moved to trash.",
        action: () => {
          void (async () => {
            await restoreProject(project.id);
            await reloadProjects();
            await refreshCanvases(undefined);
            await loadTrash();
          })();
        },
      });
    } catch (err) { console.error(err); }
  }, [selectedProject, loadTrash, refreshCanvases, reloadProjects]);

  // ── Canvases ──────────────────────────────────────────────────────────────
  const handleCreateCanvas = useCallback(async (name: string, type: "excalidraw" | "tldraw") => {
    if (!selectedProject) return;
    try {
      const c = await createCanvas(selectedProject.id, name, type);
      setCanvases((prev) => [c, ...prev]);
      await reloadProjects();
      await refreshCanvases(selectedProject.id);
      setView({ kind: "editor", canvas: c });
    } catch (err) { console.error(err); }
  }, [selectedProject, reloadProjects, refreshCanvases]);

  const handleRenameCanvas = useCallback(async (canvas: Canvas, name: string) => {
    try {
      await renameCanvas(canvas.id, name);
      setCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, name } : c));
      setAllCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, name } : c));
      setRecentCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, name } : c));
      if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "editor", canvas: { ...view.canvas, name } });
    } catch (err) { console.error(err); }
  }, [view]);

  const handleDuplicateCanvas = useCallback(async (canvas: Canvas) => {
    try {
      const copy = await duplicateCanvas(canvas);
      setCanvases((prev) => [copy, ...prev]);
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
    } catch (err) { console.error(err); }
  }, [reloadProjects, refreshCanvases, selectedProject]);

  const handleMoveCanvas = useCallback(async (canvas: Canvas, targetProjectId: string) => {
    try {
      await moveCanvas(canvas.id, targetProjectId);
      setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
      if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "grid" });
    } catch (err) { console.error(err); }
  }, [view, reloadProjects, refreshCanvases, selectedProject]);

  const handleDropCanvasOnProject = useCallback((project: Project) => {
    if (!draggingCanvas || draggingCanvas.projectId === project.id) return;
    handleMoveCanvas(draggingCanvas, project.id);
    setDraggingCanvas(null);
  }, [draggingCanvas, handleMoveCanvas]);

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
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
      setToast({
        message: "Canvas moved to trash.",
        action: () => {
          void (async () => {
            await restoreCanvas(canvas.id);
            await reloadProjects();
            await refreshCanvases(selectedProject?.id);
            await loadTrash();
          })();
        },
      });
    } catch (err) { console.error(err); }
  }, [view, loadTrash, reloadProjects, refreshCanvases, selectedProject]);

  const handleOpenCanvas = useCallback((canvas: Canvas) => {
    touchCanvasOpened(canvas.id).catch(console.error);
    setView({ kind: "editor", canvas });
    refreshCanvases(canvas.projectId).catch(console.error);
  }, [refreshCanvases]);

  const handleBack = useCallback(() => setView({ kind: "grid" }), []);

  const handleCanvasSaved = useCallback((canvas: Canvas) => {
    setCanvases((prev) => prev.map((c) => c.id === canvas.id ? canvas : c));
    setAllCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, ...canvas } : c));
    setRecentCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, ...canvas } : c));
    if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "editor", canvas });
  }, [view]);

  const handleExportCanvas = useCallback((canvas: Canvas) => {
    downloadJson(`${canvas.name.replaceAll("/", "-")}.canvas.json`, canvas);
  }, []);

  const handleExportProject = useCallback(async (project: Project) => {
    const projectCanvases = allCanvases.filter((canvas) => canvas.projectId === project.id);
    downloadJson(`${project.name.replaceAll("/", "-")}.project.json`, { version: 1, project, canvases: projectCanvases });
  }, [allCanvases]);

  const handleExportBackup = useCallback(async () => {
    downloadJson(`canvas-manager-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup());
  }, []);

  const handleImportBackup = useCallback(async (file: File) => {
    try {
      await importBackup(JSON.parse(await file.text()));
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
      await loadTrash();
      setToast({ message: "Backup imported." });
    } catch (err) {
      console.error(err);
      setToast({ message: "Import failed. Check the backup file." });
    }
  }, [loadTrash, refreshCanvases, reloadProjects, selectedProject]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }
      if (meta && e.key.toLowerCase() === "n" && view.kind === "grid" && !showTrash) {
        e.preventDefault();
        if (selectedProject) {
          handleCreateCanvas("Untitled Canvas", "excalidraw");
        } else {
          handleCreateProject("Untitled Project");
        }
      }
      if (e.key === "Escape") {
        if (pendingDelete) { setPendingDelete(null); return; }
        if (showGlobalSearch) { setShowGlobalSearch(false); return; }
        if (showTrash) { setShowTrash(false); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, pendingDelete, showTrash, showGlobalSearch, selectedProject, handleCreateCanvas, handleCreateProject]);

  // ── Trash actions ─────────────────────────────────────────────────────────
  const handleRestoreProject = useCallback(async (p: Project) => {
    try {
      await restoreProject(p.id);
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [loadTrash, refreshCanvases, reloadProjects, selectedProject]);

  const handleRestoreCanvas = useCallback(async (c: Canvas) => {
    try {
      await restoreCanvas(c.id);
      if (selectedProject?.id === c.projectId) {
        setCanvases((prev) => [{ ...c, deletedAt: null }, ...prev]);
      }
      await reloadProjects();
      await refreshCanvases(selectedProject?.id);
      await loadTrash();
    } catch (err) { console.error(err); }
  }, [selectedProject, loadTrash, refreshCanvases, reloadProjects]);

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

  const globalResults = globalSearch.trim()
    ? allCanvases.filter((canvas) => {
        const query = globalSearch.trim().toLowerCase();
        return (
          canvas.name.toLowerCase().includes(query) ||
          canvas.projectName?.toLowerCase().includes(query) ||
          canvas.type.includes(query)
        );
      })
    : recentCanvases;

  // ── Full-screen editor ────────────────────────────────────────────────────
  if (view.kind === "editor") {
    return (
      <CanvasEditor
        key={view.canvas.id}
        canvas={view.canvas}
        projectName={selectedProject?.name ?? ""}
        onBack={handleBack}
        onRename={handleRenameCanvas}
        onDuplicate={handleDuplicateCanvas}
        onDelete={handleDeleteCanvas}
        onExport={handleExportCanvas}
        onCanvasSaved={handleCanvasSaved}
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
        onExport={handleExportProject}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        draggingCanvasProjectId={draggingCanvas?.projectId ?? null}
        onDropCanvas={handleDropCanvasOnProject}
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
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-5xl">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Canvas Manager</h1>
                  <p className="mt-1 text-sm text-gray-400">Open recent work, search everything, or create a project.</p>
                </div>
                <button
                  onClick={() => setShowGlobalSearch(true)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                >
                  <Search size={15} /> Search all <span className="text-xs text-gray-300">⌘K</span>
                </button>
              </div>
              {recentCanvases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
                  <p className="text-sm">Select or create a project to get started.</p>
                </div>
              ) : (
                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Recent canvases</h2>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {recentCanvases.map((canvas) => (
                      <button
                        key={canvas.id}
                        onClick={() => {
                          const project = projects.find((p) => p.id === canvas.projectId) ?? null;
                          setSelectedProject(project);
                          handleOpenCanvas(canvas);
                        }}
                        className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-gray-50">
                          {canvas.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={canvas.thumbnail} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <p className="truncate text-sm font-medium text-gray-800">{canvas.name}</p>
                        <p className="truncate text-xs text-gray-400">{canvas.projectName ?? "Project"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            onExport={handleExportCanvas}
            onDragStart={setDraggingCanvas}
            onDragEnd={() => setDraggingCanvas(null)}
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

      {showGlobalSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20">
          <div className="w-[640px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <Search size={18} className="text-gray-400" />
              <input
                autoFocus
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search canvases, projects, or type..."
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <button onClick={() => setShowGlobalSearch(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {globalResults.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No canvases found.</p>
              ) : globalResults.map((canvas) => (
                <button
                  key={canvas.id}
                  onClick={() => {
                    const project = projects.find((p) => p.id === canvas.projectId) ?? null;
                    setSelectedProject(project);
                    handleOpenCanvas(canvas);
                    setShowGlobalSearch(false);
                    setGlobalSearch("");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="h-12 w-20 overflow-hidden rounded bg-gray-100">
                    {canvas.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={canvas.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{canvas.name}</p>
                    <p className="truncate text-xs text-gray-400">{canvas.projectName ?? "Project"} - {canvas.type}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-xl">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { toast.action?.(); setToast(null); }}
              className="font-medium text-blue-200 hover:text-white"
            >
              Undo
            </button>
          )}
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white">x</button>
        </div>
      )}
    </div>
  );
}
