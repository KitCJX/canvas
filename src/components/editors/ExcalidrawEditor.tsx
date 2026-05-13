"use client";

// This file is only ever loaded via dynamic(..., { ssr: false })
// so browser-only imports are safe here.
import { useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import debounce from "lodash.debounce";
import { saveCanvasData } from "@/lib/db";
import type { Canvas } from "@/lib/types";
// Type-only imports via the package's wildcard export
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderedExcalidrawElement = any;

interface Props {
  canvas: Canvas;
  onSaved?: () => void;
}

export default function ExcalidrawEditor({ canvas, onSaved }: Props) {
  const initialData = useRef(
    canvas.data
      ? (() => {
          try {
            return JSON.parse(canvas.data!);
          } catch {
            return undefined;
          }
        })()
      : undefined
  ).current;

  const debouncedSave = useRef(
    debounce(
      async (
        elements: readonly OrderedExcalidrawElement[],
        appState: AppState,
        _files: BinaryFiles
      ) => {
        try {
          const data = JSON.stringify({
            elements,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              currentItemFontFamily: appState.currentItemFontFamily,
              theme: appState.theme,
            },
          });
          await saveCanvasData(canvas.id, data);
          onSaved?.();
        } catch (err) {
          console.error("Excalidraw save failed:", err);
        }
      },
      500
    )
  ).current;

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      debouncedSave(elements, appState, files);
    },
    [debouncedSave]
  );

  return (
    <div className="absolute inset-0">
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
