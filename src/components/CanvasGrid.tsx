"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Trash2, PenLine, Pencil, Search, Copy, MoveRight } from "lucide-react";
import type { Canvas, Project } from "@/lib/types";

interface Props {
  project: Project;
  canvases: Canvas[];
  allProjects: Project[];
  onCreate: (name: string, type: "excalidraw" | "tldraw") => void;
  onOpen: (canvas: Canvas) => void;
  onDelete: (canvas: Canvas) => void;
  onDeleteMany: (canvases: Canvas[]) => void;
  onRename: (canvas: Canvas, name: string) => void;
  onDuplicate: (canvas: Canvas) => void;
  onMove: (canvas: Canvas, targetProjectId: string) => void;
  onExport: (canvas: Canvas) => void;
  onExportMany: (canvases: Canvas[]) => void;
  onDragStart: (canvas: Canvas) => void;
  onDragEnd: () => void;
}

const EXCALIDRAW_COLOR = "bg-violet-50 border-violet-200 hover:border-violet-400";
const TLDRAW_COLOR = "bg-sky-50 border-sky-200 hover:border-sky-400";

export default function CanvasGrid({
  project,
  canvases,
  allProjects,
  onCreate,
  onOpen,
  onDelete,
  onDeleteMany,
  onRename,
  onDuplicate,
  onMove,
  onExport,
  onExportMany,
  onDragStart,
  onDragEnd,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"excalidraw" | "tldraw">("excalidraw");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingCanvas, setMovingCanvas] = useState<Canvas | null>(null);
  const [movingSelection, setMovingSelection] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ canvas: Canvas; x: number; y: number } | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  const startRename = (c: Canvas) => {
    setRenamingId(c.id);
    setRenameValue(c.name);
  };

  const commitRename = (c: Canvas) => {
    const name = renameValue.trim();
    if (name && name !== c.name) onRename(c, name);
    setRenamingId(null);
  };

  const openModal = (type: "excalidraw" | "tldraw") => {
    setModalType(type);
    setNewName("");
    setShowModal(true);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, modalType);
    setShowModal(false);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const otherProjects = allProjects.filter((p) => p.id !== project.id);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const filtered = search.trim()
    ? canvases.filter((c) =>
        c.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : canvases;
  const selectedCanvases = filtered.filter((canvas) => selectedIds.includes(canvas.id));

  const toggleSelected = (canvas: Canvas) => {
    setSelectedIds((prev) =>
      prev.includes(canvas.id) ? prev.filter((id) => id !== canvas.id) : [...prev, canvas.id]
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Project header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1 mr-1">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search canvases…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs w-32 outline-none bg-transparent text-gray-700 placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => openModal("excalidraw")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors"
          >
            <PenLine size={14} />
            New Excalidraw
          </button>
          <button
            onClick={() => openModal("tldraw")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
          >
            <Pencil size={14} />
            New tldraw
          </button>
        </div>
      </div>

      {selectedCanvases.length > 0 && (
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-6 py-2 text-sm text-blue-700">
          <span className="font-medium">{selectedCanvases.length} selected</span>
          <button onClick={() => selectedCanvases.forEach(onDuplicate)} className="rounded bg-white px-2 py-1 text-xs hover:bg-blue-100">Duplicate</button>
          {otherProjects.length > 0 && (
            <button onClick={() => setMovingSelection(true)} className="rounded bg-white px-2 py-1 text-xs hover:bg-blue-100">Move</button>
          )}
          <button onClick={() => onExportMany(selectedCanvases)} className="rounded bg-white px-2 py-1 text-xs hover:bg-blue-100">Export</button>
          <button onClick={() => { onDeleteMany(selectedCanvases); setSelectedIds([]); }} className="rounded bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50">Trash</button>
          <button onClick={() => setSelectedIds([])} className="ml-auto rounded px-2 py-1 text-xs hover:bg-blue-100">Clear</button>
        </div>
      )}

      {/* Canvas grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <PenLine size={40} className="mb-3 opacity-30" />
            {search ? (
              <p className="text-sm">No canvases match &quot;{search}&quot;.</p>
            ) : (
              <>
                <p className="text-sm">No canvases yet.</p>
                <p className="text-xs mt-1">Create an Excalidraw or tldraw board above.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                draggable={renamingId !== c.id}
                className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                  c.type === "excalidraw" ? EXCALIDRAW_COLOR : TLDRAW_COLOR
                }`}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", c.id);
                  onDragStart(c);
                }}
                onDragEnd={onDragEnd}
                onClick={() => {
                  if (renamingId !== c.id) onOpen(c);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ canvas: c, x: e.clientX, y: e.clientY });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(c);
                }}
              >
                <div className="aspect-video rounded-lg bg-white/70 mb-3 overflow-hidden flex items-center justify-center">
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : c.type === "excalidraw" ? (
                    <PenLine size={28} className="text-violet-300" aria-hidden="true" />
                  ) : (
                    <Pencil size={28} className="text-sky-300" aria-hidden="true" />
                  )}
                </div>
                <label className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-1 shadow-sm" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelected(c)}
                    aria-label={`Select ${c.name}`}
                  />
                </label>

                {renamingId === c.id ? (
                  <input
                    ref={renameRef}
                    className="text-sm w-full bg-white border border-blue-400 rounded px-1 outline-none text-gray-800 mb-0.5"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(c);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => commitRename(c)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(c.openedAt ?? c.updatedAt)}
                </p>

                <span
                  className={`absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    c.type === "excalidraw"
                      ? "bg-violet-100 text-violet-600"
                      : "bg-sky-100 text-sky-600"
                  }`}
                >
                  {c.type}
                </span>

                {/* Action buttons */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {otherProjects.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMovingCanvas(c);
                      }}
                      className="text-gray-300 hover:text-blue-500"
                      title="Move to project"
                    >
                      <MoveRight size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(c);
                    }}
                    className="text-gray-300 hover:text-green-500"
                    title="Duplicate canvas"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(c);
                    }}
                    className="text-gray-300 hover:text-blue-500"
                    title="Export canvas"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                    className="text-gray-300 hover:text-red-500"
                    title="Move to trash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New canvas modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              New{" "}
              <span className={modalType === "excalidraw" ? "text-violet-600" : "text-sky-600"}>
                {modalType}
              </span>{" "}
              board
            </h3>
            <p className="text-xs text-gray-400 mb-4">in {project.name}</p>
            <input
              autoFocus
              type="text"
              placeholder="Board name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowModal(false);
              }}
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-400 text-gray-800 placeholder-gray-400"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 text-sm bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm bg-gray-100 text-gray-600 rounded-lg py-2 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move canvas modal */}
      {(movingCanvas || movingSelection) && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) { setMovingCanvas(null); setMovingSelection(false); } }}
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{movingSelection ? "Move selected canvases" : "Move canvas"}</h3>
            <p className="text-xs text-gray-400 mb-4">
              {movingSelection ? `${selectedCanvases.length} canvases` : `"${movingCanvas?.name}"`} → select destination project
            </p>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {otherProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (movingSelection) {
                      selectedCanvases.forEach((canvas) => onMove(canvas, p.id));
                      setSelectedIds([]);
                    } else if (movingCanvas) {
                      onMove(movingCanvas, p.id);
                    }
                    setMovingCanvas(null);
                    setMovingSelection(false);
                  }}
                  className="text-left text-sm px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setMovingCanvas(null); setMovingSelection(false); }}
              className="w-full mt-3 text-sm bg-gray-100 text-gray-600 rounded-lg py-2 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {menu && (
        <div
          className="fixed z-50 w-44 rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { startRename(menu.canvas); setMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"
          >
            <PenLine size={14} /> Rename
          </button>
          <button
            onClick={() => { onDuplicate(menu.canvas); setMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"
          >
            <Copy size={14} /> Duplicate
          </button>
          {otherProjects.length > 0 && (
            <button
              onClick={() => { setMovingCanvas(menu.canvas); setMenu(null); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"
            >
              <MoveRight size={14} /> Move
            </button>
          )}
          <button
            onClick={() => { onExport(menu.canvas); setMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => { onDelete(menu.canvas); setMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Move to trash
          </button>
        </div>
      )}
    </div>
  );
}
