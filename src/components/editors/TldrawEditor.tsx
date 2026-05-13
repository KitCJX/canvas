"use client";

// This file is only ever loaded via dynamic(..., { ssr: false })
// so browser-only imports are safe here.
import { useRef } from "react";
import { Tldraw, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import debounce from "lodash.debounce";
import { saveCanvasData } from "@/lib/db";
import type { Canvas } from "@/lib/types";
import type { Editor } from "tldraw";

interface Props {
  canvas: Canvas;
  onSaved?: () => void;
}

export default function TldrawEditor({ canvas, onSaved }: Props) {
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
        const snapshot = getSnapshot(editor.store);
        await saveCanvasData(canvas.id, JSON.stringify(snapshot));
        onSaved?.();
      } catch (err) {
        console.error("tldraw save failed:", err);
      }
    }, 500);

    debouncedSaveRef.current = debouncedSave;

    const unsubscribe = editor.store.listen(debouncedSave, {
      source: "user",
      scope: "document",
    });

    // onMount cleanup — tldraw calls this when the component unmounts
    return () => {
      unsubscribe();
      debouncedSave.cancel();
    };
  };

  return (
    <div className="absolute inset-0">
      <Tldraw onMount={handleMount} />
    </div>
  );
}
