use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
            CREATE TABLE IF NOT EXISTS Project (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS Canvas (
                id TEXT PRIMARY KEY,
                projectId TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('excalidraw', 'tldraw')),
                data TEXT,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
            );
        ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_soft_delete_and_opened_at",
            sql: "
                ALTER TABLE Project ADD COLUMN deletedAt DATETIME;
                ALTER TABLE Canvas ADD COLUMN deletedAt DATETIME;
                ALTER TABLE Canvas ADD COLUMN openedAt DATETIME;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_canvas_thumbnails_and_versions",
            sql: "
                ALTER TABLE Canvas ADD COLUMN thumbnail TEXT;

                CREATE TABLE IF NOT EXISTS CanvasVersion (
                    id TEXT PRIMARY KEY,
                    canvasId TEXT NOT NULL,
                    data TEXT NOT NULL,
                    thumbnail TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (canvasId) REFERENCES Canvas(id) ON DELETE CASCADE
                );
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:local-projects.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
