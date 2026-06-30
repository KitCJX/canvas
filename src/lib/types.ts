export interface Project {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  canvasCount?: number;
}

export interface Canvas {
  id: string;
  projectId: string;
  name: string;
  type: "excalidraw" | "tldraw";
  data: string | null;
  thumbnail: string | null;
  updatedAt: string;
  openedAt: string | null;
  deletedAt: string | null;
  projectName?: string;
}

export interface CanvasVersion {
  id: string;
  canvasId: string;
  data: string;
  thumbnail: string | null;
  createdAt: string;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  projects: Project[];
  canvases: Canvas[];
}

export interface DataHealth {
  databaseLocation: string;
  projectCount: number;
  canvasCount: number;
  trashedProjectCount: number;
  trashedCanvasCount: number;
  versionCount: number;
  versionBytes: number;
}
