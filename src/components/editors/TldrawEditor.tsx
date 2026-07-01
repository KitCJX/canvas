"use client";

// This file is only ever loaded via dynamic(..., { ssr: false })
// so browser-only imports are safe here.
import { useEffect, useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import debounce from "lodash.debounce";
import { saveCanvasData } from "@/lib/db";
import { captureLiveThumbnail } from "@/lib/thumbnails";
import type { Canvas } from "@/lib/types";
import type { Editor } from "tldraw";

interface Props {
  canvas: Canvas;
  onSaveStatus?: (status: "dirty" | "saving" | "saved" | "error") => void;
  onSaved?: (data: string, thumbnail: string) => void;
  saveSignal?: number;
  autoSaveMs: number;
  versionRetention: number;
}

export default function TldrawEditor({
  canvas,
  onSaveStatus,
  onSaved,
  saveSignal = 0,
  autoSaveMs,
  versionRetention,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref to the debounced saver so it is created once.
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  const handleMount = (editor: Editor) => {
    // Load persisted data
    if (canvas.data) {
      try {
        loadSnapshot(editor.store, JSON.parse(canvas.data));
      } catch (err) {
        console.error("tldraw snapshot load failed:", err);
      }
    }

    const debouncedSave = debounce(async (data: string, thumbnail: string) => {
      try {
        onSaveStatus?.("saving");
        await saveCanvasData(canvas.id, data, thumbnail, versionRetention);
        onSaved?.(data, thumbnail);
        onSaveStatus?.("saved");
      } catch (err) {
        console.error("tldraw save failed:", err);
        onSaveStatus?.("error");
      }
    }, autoSaveMs);

    debouncedSaveRef.current = debouncedSave;

    const unsubscribe = editor.store.listen(() => {
      const data = JSON.stringify(getSnapshot(editor.store));
      const thumbnail = captureLiveThumbnail(rootRef.current, canvas.name, canvas.type, data);
      onSaveStatus?.("dirty");
      debouncedSave(data, thumbnail);
    }, {
      source: "user",
      scope: "document",
    });

    // onMount cleanup — tldraw calls this when the component unmounts
    return () => {
      unsubscribe();
      debouncedSave.flush();
    };
  };

  useEffect(() => {
    if (saveSignal > 0) debouncedSaveRef.current?.flush();
  }, [saveSignal]);

  return (
    <div ref={rootRef} className="absolute inset-0">
      <Tldraw onMount={handleMount} />
    </div>
  );
}
