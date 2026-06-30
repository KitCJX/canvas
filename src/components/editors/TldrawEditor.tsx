"use client";

// This file is only ever loaded via dynamic(..., { ssr: false })
// so browser-only imports are safe here.
import { useEffect, useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import debounce from "lodash.debounce";
import { createCanvasThumbnail, saveCanvasData } from "@/lib/db";
import type { Canvas } from "@/lib/types";
import type { Editor } from "tldraw";

interface Props {
  canvas: Canvas;
  onSaveStatus?: (status: "dirty" | "saving" | "saved" | "error") => void;
  onSaved?: (data: string, thumbnail: string) => void;
  saveSignal?: number;
}

export default function TldrawEditor({ canvas, onSaveStatus, onSaved, saveSignal = 0 }: Props) {
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

    const debouncedSave = debounce(async () => {
      try {
        const data = JSON.stringify(getSnapshot(editor.store));
        const thumbnail = createCanvasThumbnail(canvas.name, canvas.type, data);
        onSaveStatus?.("saving");
        await saveCanvasData(canvas.id, data, thumbnail);
        onSaved?.(data, thumbnail);
        onSaveStatus?.("saved");
      } catch (err) {
        console.error("tldraw save failed:", err);
        onSaveStatus?.("error");
      }
    }, 500);

    debouncedSaveRef.current = debouncedSave;

    const unsubscribe = editor.store.listen(() => {
      onSaveStatus?.("dirty");
      debouncedSave();
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
    <div className="absolute inset-0">
      <Tldraw onMount={handleMount} />
    </div>
  );
}
