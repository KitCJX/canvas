export interface AppSettings {
  defaultCanvasType: "excalidraw" | "tldraw";
  autoSaveMs: number;
  versionRetention: number;
  confirmBeforeDelete: boolean;
  theme: "system" | "light" | "dark";
}

const KEY = "canvas-manager-settings";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultCanvasType: "excalidraw",
  autoSaveMs: 500,
  versionRetention: 20,
  confirmBeforeDelete: true,
  theme: "system",
};

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

export function applyThemePreference(theme: AppSettings["theme"]) {
  document.documentElement.dataset.theme = theme;
}
