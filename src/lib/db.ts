import type { Project, Canvas } from "./types";

let _db: import("@tauri-apps/plugin-sql").default | null = null;

async function getDb() {
  if (typeof window === "undefined") {
    throw new Error("db must only be used in browser context");
  }
  if (!_db) {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    _db = await Database.load("sqlite:local-projects.db");
  }
  return _db;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    "SELECT id, name, createdAt, deletedAt FROM Project WHERE deletedAt IS NULL ORDER BY createdAt DESC"
  );
}

export async function listTrashedProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(
    "SELECT id, name, createdAt, deletedAt FROM Project WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC"
  );
}

export async function createProject(name: string): Promise<Project> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.execute(
    "INSERT INTO Project (id, name, createdAt) VALUES (?, ?, ?)",
    [id, name, createdAt]
  );
  return { id, name, createdAt, deletedAt: null };
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Project SET name = ? WHERE id = ?", [name, id]);
}

export async function softDeleteProject(id: string): Promise<void> {
  const db = await getDb();
  const deletedAt = new Date().toISOString();
  await db.execute("UPDATE Project SET deletedAt = ? WHERE id = ?", [deletedAt, id]);
}

export async function restoreProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Project SET deletedAt = NULL WHERE id = ?", [id]);
}

export async function permanentDeleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM Project WHERE id = ?", [id]);
}

// ─── Canvases ────────────────────────────────────────────────────────────────

export async function listCanvases(projectId: string): Promise<Canvas[]> {
  const db = await getDb();
  return db.select<Canvas[]>(
    `SELECT id, projectId, name, type, data, updatedAt, openedAt, deletedAt
     FROM Canvas
     WHERE projectId = ? AND deletedAt IS NULL
     ORDER BY COALESCE(openedAt, updatedAt) DESC`,
    [projectId]
  );
}

export async function listTrashedCanvases(): Promise<Canvas[]> {
  const db = await getDb();
  return db.select<Canvas[]>(
    `SELECT id, projectId, name, type, data, updatedAt, openedAt, deletedAt
     FROM Canvas WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC`
  );
}

export async function createCanvas(
  projectId: string,
  name: string,
  type: "excalidraw" | "tldraw"
): Promise<Canvas> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  await db.execute(
    "INSERT INTO Canvas (id, projectId, name, type, data, updatedAt) VALUES (?, ?, ?, ?, NULL, ?)",
    [id, projectId, name, type, updatedAt]
  );
  return { id, projectId, name, type, data: null, updatedAt, openedAt: null, deletedAt: null };
}

export async function renameCanvas(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET name = ? WHERE id = ?", [name, id]);
}

export async function duplicateCanvas(canvas: Canvas, newProjectId?: string): Promise<Canvas> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const projectId = newProjectId ?? canvas.projectId;
  await db.execute(
    "INSERT INTO Canvas (id, projectId, name, type, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    [id, projectId, `${canvas.name} (copy)`, canvas.type, canvas.data, updatedAt]
  );
  return { id, projectId, name: `${canvas.name} (copy)`, type: canvas.type, data: canvas.data, updatedAt, openedAt: null, deletedAt: null };
}

export async function moveCanvas(canvasId: string, targetProjectId: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET projectId = ? WHERE id = ?", [targetProjectId, canvasId]);
}

export async function touchCanvasOpened(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET openedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
}

export async function saveCanvasData(id: string, data: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE Canvas SET data = ?, updatedAt = ? WHERE id = ?",
    [data, new Date().toISOString(), id]
  );
}

export async function softDeleteCanvas(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET deletedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
}

export async function restoreCanvas(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET deletedAt = NULL WHERE id = ?", [id]);
}

export async function permanentDeleteCanvas(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM Canvas WHERE id = ?", [id]);
}
