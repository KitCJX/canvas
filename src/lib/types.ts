export interface Project {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface Canvas {
  id: string;
  projectId: string;
  name: string;
  type: "excalidraw" | "tldraw";
  data: string | null;
  updatedAt: string;
  openedAt: string | null;
  deletedAt: string | null;
}
