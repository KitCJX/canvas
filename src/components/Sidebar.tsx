"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, FolderOpen, Folder, Search, Trash } from "lucide-react";
import type { Project } from "@/lib/types";

interface Props {
  projects: Project[];
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onCreate: (name: string) => void;
  onDelete: (project: Project) => void;
  onRename: (project: Project, name: string) => void;
  onTrash: () => void;
  trashCount: number;
}

export default function Sidebar({
  projects,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onTrash,
  trashCount,
}: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  const startRename = (p: Project) => {
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const commitRename = (p: Project) => {
    const name = renameValue.trim();
    if (name && name !== p.name) onRename(p, name);
    setRenamingId(null);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
    setCreating(false);
  };

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : projects;

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-gray-50 border-r border-gray-200 h-full">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Projects
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title="New project (⌘N)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1">
          <Search size={12} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      {creating && (
        <div className="px-3 pt-1 pb-1">
          <input
            autoFocus
            type="text"
            placeholder="Project name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            className="w-full text-sm px-2 py-1.5 border border-blue-400 rounded outline-none bg-white text-gray-800 placeholder-gray-400"
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleCreate}
              className="flex-1 text-xs bg-blue-600 text-white rounded py-1 hover:bg-blue-700"
            >
              Create
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="flex-1 text-xs bg-gray-200 text-gray-600 rounded py-1 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 && !creating && (
          <p className="text-xs text-gray-400 text-center mt-6 px-4">
            {search ? "No matches." : "No projects yet.\nClick + to create one."}
          </p>
        )}
        {filtered.map((p) => {
          const active = p.id === selectedId;
          return (
            <div
              key={p.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() => {
                if (renamingId !== p.id) onSelect(p);
              }}
              onDoubleClick={() => startRename(p)}
            >
              {active ? (
                <FolderOpen size={14} className="shrink-0 text-blue-500" />
              ) : (
                <Folder size={14} className="shrink-0 text-gray-400" />
              )}
              {renamingId === p.id ? (
                <input
                  ref={renameRef}
                  className="text-sm flex-1 bg-white border border-blue-400 rounded px-1 outline-none text-gray-800"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(p);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onBlur={() => commitRename(p)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate flex-1">{p.name}</span>
              )}
              {renamingId !== p.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  title="Move to trash"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Trash link */}
      <div className="border-t border-gray-200 px-3 py-2">
        <button
          onClick={onTrash}
          className="flex items-center gap-2 w-full text-xs text-gray-400 hover:text-gray-700 transition-colors py-1"
        >
          <Trash size={13} />
          <span>Trash</span>
          {trashCount > 0 && (
            <span className="ml-auto text-[10px] bg-gray-200 text-gray-500 rounded-full px-1.5 py-0.5">
              {trashCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
