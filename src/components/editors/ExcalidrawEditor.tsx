"use client";

// This file is only ever loaded via dynamic(..., { ssr: false })
// so browser-only imports are safe here.
import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import debounce from "lodash.debounce";
import { saveCanvasData } from "@/lib/db";
import { captureLiveThumbnail } from "@/lib/thumbnails";
import type { Canvas } from "@/lib/types";
// Type-only imports via the package's wildcard export
import type { AppState } from "@excalidraw/excalidraw/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderedExcalidrawElement = any;

interface Props {
  canvas: Canvas;
  onSaveStatus?: (status: "dirty" | "saving" | "saved" | "error") => void;
  onSaved?: (data: string, thumbnail: string) => void;
  saveSignal?: number;
  autoSaveMs: number;
  versionRetention: number;
}

export default function ExcalidrawEditor({
  canvas,
  onSaveStatus,
  onSaved,
  saveSignal = 0,
  autoSaveMs,
  versionRetention,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [initialData] = useState(() => {
    if (!canvas.data) return undefined;
    try {
      return JSON.parse(canvas.data);
    } catch {
      return undefined;
    }
  });

  const [debouncedSave] = useState(() =>
    debounce(
      async (data: string, thumbnail: string) => {
        try {
          onSaveStatus?.("saving");
          await saveCanvasData(canvas.id, data, thumbnail, versionRetention);
          onSaved?.(data, thumbnail);
          onSaveStatus?.("saved");
        } catch (err) {
          console.error("Excalidraw save failed:", err);
          onSaveStatus?.("error");
        }
      },
      autoSaveMs
    )
  );

  useEffect(() => () => { debouncedSave.flush(); }, [debouncedSave]);
  useEffect(() => { if (saveSignal > 0) debouncedSave.flush(); }, [debouncedSave, saveSignal]);

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState
    ) => {
      const data = JSON.stringify({
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          theme: appState.theme,
        },
      });
      const thumbnail = captureLiveThumbnail(rootRef.current, canvas.name, canvas.type, data);
      onSaveStatus?.("dirty");
      debouncedSave(data, thumbnail);
    },
    [canvas.name, canvas.type, debouncedSave, onSaveStatus]
  );

  return (
    <div ref={rootRef} className="absolute inset-0">
      <Excalidraw
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: false,
            export: false,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
}
