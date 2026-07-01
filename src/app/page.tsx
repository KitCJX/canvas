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
  getDataHealth,
  importBackup,
  importCanvasToProject,
  importProjectExport,
  pruneCanvasVersions,
} from "@/lib/db";
import { applyThemePreference, DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import type { BackupData, Canvas, DataHealth, Project, ProjectExportData } from "@/lib/types";
import { Loader2, RotateCcw, Search, Trash, X } from "lucide-react";

type View = { kind: "grid" } | { kind: "editor"; canvas: Canvas };

type PendingDelete =
  | { kind: "project"; item: Project }
  | { kind: "canvas"; item: Canvas };

type PaletteCommand = {
  id: string;
  title: string;
  description: string;
  action: () => void;
};

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
  const [showDataHealth, setShowDataHealth] = useState(false);
  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  const [draggingCanvas, setDraggingCanvas] = useState<Canvas | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());

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
    applyThemePreference(appSettings.theme);
  }, [appSettings.theme]);

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
    if (!appSettings.confirmBeforeDelete) {
      void (async () => {
        try {
          await softDeleteProject(project.id);
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
          if (selectedProject?.id === project.id) { setSelectedProject(null); setView({ kind: "grid" }); }
          await loadTrash();
          await refreshCanvases(undefined);
        } catch (err) { console.error(err); }
      })();
      return;
    }
    setPendingDelete({ kind: "project", item: project });
  }, [appSettings.confirmBeforeDelete, loadTrash, refreshCanvases, selectedProject]);

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
    if (!appSettings.confirmBeforeDelete) {
      void (async () => {
        try {
          await softDeleteCanvas(canvas.id);
          setCanvases((prev) => prev.filter((c) => c.id !== canvas.id));
          if (view.kind === "editor" && view.canvas.id === canvas.id) setView({ kind: "grid" });
          await loadTrash();
          await reloadProjects();
          await refreshCanvases(selectedProject?.id);
        } catch (err) { console.error(err); }
      })();
      return;
    }
    setPendingDelete({ kind: "canvas", item: canvas });
  }, [appSettings.confirmBeforeDelete, loadTrash, refreshCanvases, reloadProjects, selectedProject, view]);

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
      const imported = JSON.parse(await file.text()) as BackupData | ProjectExportData | Canvas;
      let refreshProjectId = selectedProject?.id;
      if ("projects" in imported && Array.isArray(imported.projects) && "canvases" in imported) {
        await importBackup(imported);
        setToast({ message: "Backup imported." });
      } else if ("project" in imported && "canvases" in imported) {
        const project = await importProjectExport(imported);
        setSelectedProject(project);
        refreshProjectId = project.id;
        setToast({ message: "Project imported." });
      } else if ("type" in imported && "name" in imported) {
        if (!selectedProject) {
          setToast({ message: "Select a project before importing a canvas." });
          return;
        }
        await importCanvasToProject(imported, selectedProject.id);
        setToast({ message: "Canvas imported." });
      } else {
        throw new Error("Unsupported import file");
      }
      await reloadProjects();
      await refreshCanvases(refreshProjectId);
      await loadTrash();
    } catch (err) {
      console.error(err);
      setToast({ message: "Import failed. Check the JSON file." });
    }
  }, [loadTrash, refreshCanvases, reloadProjects, selectedProject]);

  const openDataHealth = useCallback(async () => {
    setDataHealth(await getDataHealth());
    setShowDataHealth(true);
  }, []);

  const handlePruneVersions = useCallback(async () => {
    await pruneCanvasVersions(10);
    setDataHealth(await getDataHealth());
    setToast({ message: "Old versions pruned." });
  }, []);

  const handleSaveSettings = useCallback((settings: AppSettings) => {
    setAppSettings(settings);
    saveAppSettings(settings);
    setShowSettings(false);
    setToast({ message: "Settings saved." });
  }, []);

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
          handleCreateCanvas("Untitled Canvas", appSettings.defaultCanvasType);
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
  }, [view, pendingDelete, showTrash, showGlobalSearch, selectedProject, handleCreateCanvas, handleCreateProject, appSettings.defaultCanvasType]);

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

  const paletteQuery = globalSearch.trim().toLowerCase();
  const closePalette = () => {
    setShowGlobalSearch(false);
    setGlobalSearch("");
  };
  const commandItems: PaletteCommand[] = [
    {
      id: "new-project",
      title: "Create project",
      description: "Add a new untitled project",
      action: () => { handleCreateProject("Untitled Project"); closePalette(); },
    },
    {
      id: "new-excalidraw",
      title: "Create Excalidraw canvas",
      description: selectedProject ? `Add to ${selectedProject.name}` : "Select a project first",
      action: () => { if (selectedProject) handleCreateCanvas("Untitled Canvas", "excalidraw"); closePalette(); },
    },
    {
      id: "new-tldraw",
      title: "Create tldraw canvas",
      description: selectedProject ? `Add to ${selectedProject.name}` : "Select a project first",
      action: () => { if (selectedProject) handleCreateCanvas("Untitled Canvas", "tldraw"); closePalette(); },
    },
    {
      id: "open-trash",
      title: "Open trash",
      description: "Restore or permanently delete trashed items",
      action: () => { loadTrash(); setShowTrash(true); closePalette(); },
    },
    {
      id: "export-backup",
      title: "Export full backup",
      description: "Download all projects and canvases as JSON",
      action: () => { handleExportBackup(); closePalette(); },
    },
  ].filter((command) => {
    if (!paletteQuery) return true;
    return `${command.title} ${command.description}`.toLowerCase().includes(paletteQuery);
  });
  const projectResults = paletteQuery
    ? projects.filter((project) => project.name.toLowerCase().includes(paletteQuery))
    : projects.slice(0, 5);
  const globalResults = paletteQuery
    ? allCanvases.filter((canvas) => {
        return (
          canvas.name.toLowerCase().includes(paletteQuery) ||
          canvas.projectName?.toLowerCase().includes(paletteQuery) ||
          canvas.type.includes(paletteQuery)
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
        settings={appSettings}
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
        onDataHealth={openDataHealth}
        draggingCanvasProjectId={draggingCanvas?.projectId ?? null}
        onDropCanvas={handleDropCanvasOnProject}
        onSettings={() => setShowSettings(true)}
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
                placeholder="Search or run a command..."
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <button onClick={closePalette} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {commandItems.length === 0 && projectResults.length === 0 && globalResults.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">No commands, projects, or canvases found.</p>
              ) : null}
              {commandItems.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Commands</p>
                  {commandItems.map((command) => (
                    <button
                      key={command.id}
                      onClick={command.action}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">⌘</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{command.title}</p>
                        <p className="truncate text-xs text-gray-400">{command.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {projectResults.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Projects</p>
                  {projectResults.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => { setSelectedProject(project); setView({ kind: "grid" }); closePalette(); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-50 text-xs font-semibold text-blue-600">P</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{project.name}</p>
                        <p className="truncate text-xs text-gray-400">{project.canvasCount ?? 0} canvases</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {globalResults.length > 0 && (
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Canvases</p>
              )}
              {globalResults.map((canvas) => (
                <button
                  key={canvas.id}
                  onClick={() => {
                    const project = projects.find((p) => p.id === canvas.projectId) ?? null;
                    setSelectedProject(project);
                    handleOpenCanvas(canvas);
                    closePalette();
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

      {showDataHealth && dataHealth && (
      {showDataHealth && dataHealth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[520px] max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Data health</h2>
              <button onClick={() => setShowDataHealth(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Database</p>
                <p className="mt-1 break-all rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">{dataHealth.databaseLocation}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HealthStat label="Active projects" value={dataHealth.projectCount} />
                <HealthStat label="Active canvases" value={dataHealth.canvasCount} />
                <HealthStat label="Trashed projects" value={dataHealth.trashedProjectCount} />
                <HealthStat label="Trashed canvases" value={dataHealth.trashedCanvasCount} />
                <HealthStat label="Saved versions" value={dataHealth.versionCount} />
                <HealthStat label="Version storage" value={`${Math.round(dataHealth.versionBytes / 1024)} KB`} />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Backup reminder: export a full backup after major work or before pruning version history.
              </div>
              <button
                onClick={handlePruneVersions}
                className="w-full rounded-lg bg-gray-900 py-2 text-sm text-white hover:bg-gray-800"
              >
                Prune old versions, keep latest 10 per canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          settings={appSettings}
          onSave={handleSaveSettings}
          onReset={() => handleSaveSettings(DEFAULT_APP_SETTINGS)}
          onClose={() => setShowSettings(false)}
        />
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

function HealthStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function SettingsModal({
  settings,
  onSave,
  onReset,
  onClose,
}: {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[460px] max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Default canvas type</span>
            <select
              value={draft.defaultCanvasType}
              onChange={(event) => setDraft({ ...draft, defaultCanvasType: event.target.value as AppSettings["defaultCanvasType"] })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            >
              <option value="excalidraw">Excalidraw</option>
              <option value="tldraw">tldraw</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Auto-save debounce</span>
            <input
              type="number"
              min={100}
              step={100}
              value={draft.autoSaveMs}
              onChange={(event) => setDraft({ ...draft, autoSaveMs: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            />
            <span className="mt-1 block text-xs text-gray-400">Milliseconds before editor changes are written.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Versions to keep per canvas</span>
            <input
              type="number"
              min={1}
              max={100}
              value={draft.versionRetention}
              onChange={(event) => setDraft({ ...draft, versionRetention: Number(event.target.value) })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Theme preference</span>
            <select
              value={draft.theme}
              onChange={(event) => setDraft({ ...draft, theme: event.target.value as AppSettings["theme"] })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.confirmBeforeDelete}
              onChange={(event) => setDraft({ ...draft, confirmBeforeDelete: event.target.checked })}
            />
            Confirm before moving items to trash
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(draft)} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700">Save</button>
            <button onClick={onReset} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm text-gray-600 hover:bg-gray-200">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}
