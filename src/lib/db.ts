import type { BackupData, Canvas, CanvasVersion, DataHealth, Project, ProjectExportData } from "./types";

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
    `SELECT p.id, p.name, p.createdAt, p.deletedAt, COUNT(c.id) AS canvasCount
     FROM Project p
     LEFT JOIN Canvas c ON c.projectId = p.id AND c.deletedAt IS NULL
     WHERE p.deletedAt IS NULL
     GROUP BY p.id, p.name, p.createdAt, p.deletedAt
     ORDER BY p.createdAt DESC`
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
  return { id, name, createdAt, deletedAt: null, canvasCount: 0 };
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
    `SELECT id, projectId, name, type, data, thumbnail, updatedAt, openedAt, deletedAt
     FROM Canvas
     WHERE projectId = ? AND deletedAt IS NULL
     ORDER BY COALESCE(openedAt, updatedAt) DESC`,
    [projectId]
  );
}

export async function listTrashedCanvases(): Promise<Canvas[]> {
  const db = await getDb();
  return db.select<Canvas[]>(
    `SELECT id, projectId, name, type, data, thumbnail, updatedAt, openedAt, deletedAt
     FROM Canvas WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC`
  );
}

export async function listAllCanvases(): Promise<Canvas[]> {
  const db = await getDb();
  return db.select<Canvas[]>(
    `SELECT c.id, c.projectId, c.name, c.type, c.data, c.thumbnail, c.updatedAt, c.openedAt, c.deletedAt,
            p.name AS projectName
     FROM Canvas c
     JOIN Project p ON p.id = c.projectId
     WHERE c.deletedAt IS NULL AND p.deletedAt IS NULL
     ORDER BY COALESCE(c.openedAt, c.updatedAt) DESC`
  );
}

export async function listRecentCanvases(limit = 12): Promise<Canvas[]> {
  const db = await getDb();
  return db.select<Canvas[]>(
    `SELECT c.id, c.projectId, c.name, c.type, c.data, c.thumbnail, c.updatedAt, c.openedAt, c.deletedAt,
            p.name AS projectName
     FROM Canvas c
     JOIN Project p ON p.id = c.projectId
     WHERE c.deletedAt IS NULL AND p.deletedAt IS NULL
     ORDER BY COALESCE(c.openedAt, c.updatedAt) DESC
     LIMIT ?`,
    [limit]
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
  const thumbnail = createCanvasThumbnail(name, type, null);
  await db.execute(
    "INSERT INTO Canvas (id, projectId, name, type, data, thumbnail, updatedAt) VALUES (?, ?, ?, ?, NULL, ?, ?)",
    [id, projectId, name, type, thumbnail, updatedAt]
  );
  return { id, projectId, name, type, data: null, thumbnail, updatedAt, openedAt: null, deletedAt: null };
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
    "INSERT INTO Canvas (id, projectId, name, type, data, thumbnail, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, projectId, `${canvas.name} (copy)`, canvas.type, canvas.data, canvas.thumbnail, updatedAt]
  );
  return { id, projectId, name: `${canvas.name} (copy)`, type: canvas.type, data: canvas.data, thumbnail: canvas.thumbnail, updatedAt, openedAt: null, deletedAt: null };
}

export async function moveCanvas(canvasId: string, targetProjectId: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET projectId = ? WHERE id = ?", [targetProjectId, canvasId]);
}

export async function touchCanvasOpened(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE Canvas SET openedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
}

export async function saveCanvasData(id: string, data: string, thumbnail?: string | null): Promise<void> {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db.execute(
    "UPDATE Canvas SET data = ?, thumbnail = COALESCE(?, thumbnail), updatedAt = ? WHERE id = ?",
    [data, thumbnail ?? null, updatedAt, id]
  );
  await db.execute(
    "INSERT INTO CanvasVersion (id, canvasId, data, thumbnail, createdAt) VALUES (?, ?, ?, ?, ?)",
    [crypto.randomUUID(), id, data, thumbnail ?? null, updatedAt]
  );
  await db.execute(
    `DELETE FROM CanvasVersion
     WHERE canvasId = ?
       AND id NOT IN (
         SELECT id FROM CanvasVersion WHERE canvasId = ? ORDER BY createdAt DESC LIMIT 20
       )`,
    [id, id]
  );
}

export async function listCanvasVersions(canvasId: string): Promise<CanvasVersion[]> {
  const db = await getDb();
  return db.select<CanvasVersion[]>(
    `SELECT id, canvasId, data, thumbnail, createdAt
     FROM CanvasVersion
     WHERE canvasId = ?
     ORDER BY createdAt DESC`,
    [canvasId]
  );
}

export async function restoreCanvasVersion(canvasId: string, version: CanvasVersion): Promise<void> {
  await saveCanvasData(canvasId, version.data, version.thumbnail);
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

export async function exportBackup(): Promise<BackupData> {
  const db = await getDb();
  const [projects, canvases] = await Promise.all([
    db.select<Project[]>("SELECT id, name, createdAt, deletedAt FROM Project ORDER BY createdAt DESC"),
    db.select<Canvas[]>(
      `SELECT id, projectId, name, type, data, thumbnail, updatedAt, openedAt, deletedAt
       FROM Canvas ORDER BY updatedAt DESC`
    ),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), projects, canvases };
}

export async function importBackup(backup: BackupData): Promise<void> {
  if (backup.version !== 1 || !Array.isArray(backup.projects) || !Array.isArray(backup.canvases)) {
    throw new Error("Unsupported backup file");
  }

  const db = await getDb();
  for (const project of backup.projects) {
    await db.execute(
      `INSERT OR REPLACE INTO Project (id, name, createdAt, deletedAt)
       VALUES (?, ?, ?, ?)`,
      [project.id, project.name, project.createdAt, project.deletedAt]
    );
  }
  for (const canvas of backup.canvases) {
    await db.execute(
      `INSERT OR REPLACE INTO Canvas (id, projectId, name, type, data, thumbnail, updatedAt, openedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        canvas.id,
        canvas.projectId,
        canvas.name,
        canvas.type,
        canvas.data,
        canvas.thumbnail ?? createCanvasThumbnail(canvas.name, canvas.type, canvas.data),
        canvas.updatedAt,
        canvas.openedAt,
        canvas.deletedAt,
      ]
    );
  }
}

export async function importCanvasToProject(canvas: Canvas, projectId: string): Promise<Canvas> {
  if (!canvas.name || (canvas.type !== "excalidraw" && canvas.type !== "tldraw")) {
    throw new Error("Unsupported canvas file");
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const thumbnail = canvas.thumbnail ?? createCanvasThumbnail(canvas.name, canvas.type, canvas.data);
  await db.execute(
    `INSERT INTO Canvas (id, projectId, name, type, data, thumbnail, updatedAt, openedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    [id, projectId, canvas.name, canvas.type, canvas.data, thumbnail, updatedAt]
  );

  return {
    id,
    projectId,
    name: canvas.name,
    type: canvas.type,
    data: canvas.data,
    thumbnail,
    updatedAt,
    openedAt: null,
    deletedAt: null,
  };
}

export async function importProjectExport(projectExport: ProjectExportData): Promise<Project> {
  if (
    projectExport.version !== 1 ||
    !projectExport.project?.name ||
    !Array.isArray(projectExport.canvases)
  ) {
    throw new Error("Unsupported project file");
  }

  const db = await getDb();
  const projectId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.execute(
    "INSERT INTO Project (id, name, createdAt, deletedAt) VALUES (?, ?, ?, NULL)",
    [projectId, projectExport.project.name, createdAt]
  );

  for (const canvas of projectExport.canvases) {
    await importCanvasToProject(canvas, projectId);
  }

  return {
    id: projectId,
    name: projectExport.project.name,
    createdAt,
    deletedAt: null,
    canvasCount: projectExport.canvases.length,
  };
}

async function countSql(sql: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ count: number }>>(sql);
  return rows[0]?.count ?? 0;
}

export async function getDataHealth(): Promise<DataHealth> {
  const db = await getDb();
  const versionBytes = await db.select<Array<{ bytes: number }>>(
    "SELECT COALESCE(SUM(LENGTH(data) + COALESCE(LENGTH(thumbnail), 0)), 0) AS bytes FROM CanvasVersion"
  );

  return {
    databaseLocation: "~/Library/Application Support/com.canvas.manager/local-projects.db",
    projectCount: await countSql("SELECT COUNT(*) AS count FROM Project WHERE deletedAt IS NULL"),
    canvasCount: await countSql("SELECT COUNT(*) AS count FROM Canvas WHERE deletedAt IS NULL"),
    trashedProjectCount: await countSql("SELECT COUNT(*) AS count FROM Project WHERE deletedAt IS NOT NULL"),
    trashedCanvasCount: await countSql("SELECT COUNT(*) AS count FROM Canvas WHERE deletedAt IS NOT NULL"),
    versionCount: await countSql("SELECT COUNT(*) AS count FROM CanvasVersion"),
    versionBytes: versionBytes[0]?.bytes ?? 0,
  };
}

export async function pruneCanvasVersions(keepPerCanvas = 10): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM CanvasVersion
     WHERE id NOT IN (
       SELECT id FROM (
         SELECT id,
                ROW_NUMBER() OVER (PARTITION BY canvasId ORDER BY createdAt DESC) AS rn
         FROM CanvasVersion
       ) ranked
       WHERE rn <= ?
     )`,
    [keepPerCanvas]
  );
}

export function createCanvasThumbnail(
  name: string,
  type: "excalidraw" | "tldraw",
  data: string | null
): string {
  const bg = type === "excalidraw" ? "#f5f3ff" : "#f0f9ff";
  const fg = type === "excalidraw" ? "#7c3aed" : "#0284c7";
  const muted = type === "excalidraw" ? "#ddd6fe" : "#bae6fd";
  const mark = type === "excalidraw" ? "freehand" : "diagram";
  const detail = data ? `${Math.max(1, Math.round(data.length / 1024))} KB saved` : "empty canvas";
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" rx="28" fill="${bg}"/><path d="M54 184 C126 72 198 224 286 108 S394 68 426 154" fill="none" stroke="${muted}" stroke-width="18" stroke-linecap="round"/><rect x="46" y="42" width="388" height="186" rx="22" fill="white" fill-opacity="0.72"/><text x="72" y="102" fill="${fg}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">${escape(name.slice(0, 22))}</text><text x="72" y="140" fill="#64748b" font-family="Inter, Arial, sans-serif" font-size="18">${mark}</text><text x="72" y="176" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="16">${escape(detail)}</text><circle cx="382" cy="88" r="24" fill="${fg}" fill-opacity="0.16"/><circle cx="382" cy="88" r="10" fill="${fg}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
