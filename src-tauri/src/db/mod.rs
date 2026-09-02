use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};

/// Represents a project record from SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub canvas_width: f64,
    pub canvas_height: f64,
    pub canvas_unit: String,
    pub canvas_dpi: i32,
    pub spacing_value: f64,
    pub spacing_unit: String,
    pub margin_enabled: bool,
    pub margin_value: f64,
    pub margin_unit: String,
    pub border_enabled: bool,
    pub border_width: f64,
    pub border_unit: String,
    pub border_color: String,
    pub background_type: String,
    pub background_color: String,
    pub file_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a photo record from SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoRow {
    pub id: String,
    pub project_id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub thumbnail_path: Option<String>,
    pub thumbnail_base64: Option<String>,
    pub preview_path: Option<String>,
    pub is_favorite: bool,
    pub used_count: i32,
    pub is_missing: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a photo folder / collection record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoFolderRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub sort_order: i32,
    pub photo_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn default_element_type() -> String { "photo".to_string() }
fn default_one_hundred() -> f64 { 100.0 }
fn default_one_i32() -> i32 { 1 }
fn default_photo_aspect() -> f64 { 1.5 }
fn default_crop_scale() -> f64 { 1.0 }
fn default_border_color() -> String { "#FFFFFF".to_string() }
fn default_opacity() -> f64 { 1.0 }
fn default_gutter_unit() -> String { "mm".to_string() }
fn default_bg_color() -> String { "#FFFFFF".to_string() }
fn default_bg_type() -> String { "solid".to_string() }

/// Represents an element / photo frame on a spread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementPayload {
    pub id: String,
    #[serde(default = "default_element_type")]
    pub r#type: String,
    pub photo_id: Option<String>,
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub file_name: String,
    pub preview_path: Option<String>,
    pub thumbnail_path: Option<String>,
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "default_one_hundred")]
    pub width: f64,
    #[serde(default = "default_one_hundred")]
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_one_i32")]
    pub z_index: i32,
    #[serde(default = "default_photo_aspect")]
    pub photo_aspect: f64,
    pub group_id: Option<String>,
    pub original_width: Option<f64>,
    pub original_height: Option<f64>,
    #[serde(default)]
    pub crop_x: f64,
    #[serde(default)]
    pub crop_y: f64,
    #[serde(default = "default_crop_scale")]
    pub crop_scale: f64,
    pub crop_rotation: Option<f64>,
    #[serde(default)]
    pub border_enabled: bool,
    #[serde(default)]
    pub border_width: f64,
    #[serde(default = "default_border_color")]
    pub border_color: String,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    #[serde(default)]
    pub locked: Option<bool>,
}

/// Represents a single page in a spread.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PagePayload {
    pub id: String,
    #[serde(default)]
    pub page_number: i32,
    #[serde(default)]
    pub r#type: String,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
    #[serde(default)]
    pub unit: String,
    #[serde(default)]
    pub bleed: f64,
    #[serde(default)]
    pub safe_area: f64,
    #[serde(default = "default_bg_color")]
    pub background_color: String,
    #[serde(default = "default_bg_type")]
    pub background_type: String,
}

/// Represents a full spread (cover or interior).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpreadPayload {
    pub id: String,
    #[serde(default)]
    pub spread_index: i32,
    #[serde(default)]
    pub r#type: String,
    #[serde(default)]
    pub name: String,
    pub left_page: Option<PagePayload>,
    pub right_page: Option<PagePayload>,
    #[serde(default)]
    pub gutter_width: f64,
    #[serde(default = "default_gutter_unit")]
    pub gutter_unit: String,
    #[serde(default)]
    pub bleed: f64,
    #[serde(default)]
    pub safe_area: f64,
    #[serde(default = "default_bg_color")]
    pub background_color: String,
    #[serde(default)]
    pub elements: Vec<ElementPayload>,
}

/// Represents the complete Album structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumPayload {
    pub id: String,
    pub project_id: String,
    pub cover_spread: SpreadPayload,
    #[serde(default)]
    pub spreads: Vec<SpreadPayload>,
    #[serde(default)]
    pub total_spreads: i32,
    #[serde(default)]
    pub total_pages: i32,
}

/// Represents a portable .afsn project package.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPackagePayload {
    pub version: i32,
    pub project: ProjectRow,
    pub photos: Vec<PhotoRow>,
    pub folders: Vec<PhotoFolderRow>,
    pub album: Option<AlbumPayload>,
}

/// Thread-safe wrapper around SQLite connection.
pub struct Database {
    conn: Mutex<Connection>,
    db_path: PathBuf,
}

impl Database {
    pub fn expected_version() -> i32 {
        7
    }

    /// Initialize the database at the given path.
    /// Creates the database file and runs initial schema if it doesn't exist.
    pub fn init(db_path: PathBuf) -> SqliteResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                rusqlite::Error::InvalidPath(
                    format!("Failed to create database directory: {}", e).into(),
                )
            })?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrent read performance
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        // Initialize schema
        Self::run_migrations(&conn)?;

        log::info!("Database initialized at: {:?}", db_path);

        Ok(Self {
            conn: Mutex::new(conn),
            db_path,
        })
    }

    /// Run database migrations to bring schema to current version.
    fn run_migrations(conn: &Connection) -> SqliteResult<()> {
        // Create the schema_version tracking table if it doesn't exist
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        )?;

        let current_version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current_version < 1 {
            Self::migrate_v1(conn)?;
        }

        if current_version < 2 {
            Self::migrate_v2(conn)?;
        }

        if current_version < 3 {
            Self::migrate_v3(conn)?;
        }

        if current_version < 4 {
            Self::migrate_v4(conn)?;
        }

        if current_version < 5 {
            Self::migrate_v5(conn)?;
        }

        if current_version < 6 {
            Self::migrate_v6(conn)?;
        }

        if current_version < 7 {
            Self::migrate_v7(conn)?;
        }

        if current_version < 8 {
            Self::migrate_v8(conn)?;
        }

        if current_version < 9 {
            Self::migrate_v9(conn)?;
        }

        Ok(())
    }

    /// Schema version 1: Initial schema with settings table.
    fn migrate_v1(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            -- Application settings key-value store
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- Record this migration version
            INSERT INTO schema_version (version) VALUES (1);

            COMMIT;",
        )?;

        log::info!("Applied database migration v1");
        Ok(())
    }

    /// Schema version 2: Projects table for Phase 1.
    fn migrate_v2(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                canvas_width REAL NOT NULL,
                canvas_height REAL NOT NULL,
                canvas_unit TEXT NOT NULL,
                canvas_dpi INTEGER NOT NULL,
                spacing_value REAL NOT NULL,
                spacing_unit TEXT NOT NULL,
                border_enabled INTEGER NOT NULL DEFAULT 0,
                border_width REAL NOT NULL DEFAULT 0.0,
                border_unit TEXT NOT NULL DEFAULT 'mm',
                border_color TEXT NOT NULL DEFAULT '#000000',
                background_type TEXT NOT NULL DEFAULT 'solid',
                background_color TEXT NOT NULL DEFAULT '#FFFFFF',
                file_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

            INSERT INTO schema_version (version) VALUES (2);

            COMMIT;",
        )?;

        log::info!("Applied database migration v2");
        Ok(())
    }

    /// Schema version 3: Project margin settings.
    fn migrate_v3(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            ALTER TABLE projects ADD COLUMN margin_enabled INTEGER NOT NULL DEFAULT 1;
            ALTER TABLE projects ADD COLUMN margin_value REAL NOT NULL DEFAULT 10.0;
            ALTER TABLE projects ADD COLUMN margin_unit TEXT NOT NULL DEFAULT 'mm';

            INSERT INTO schema_version (version) VALUES (3);

            COMMIT;",
        )?;

        log::info!("Applied database migration v3");
        Ok(())
    }

    /// Schema version 4: Photos library table.
    fn migrate_v4(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                format TEXT NOT NULL,
                thumbnail_path TEXT,
                thumbnail_base64 TEXT,
                preview_path TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                used_count INTEGER NOT NULL DEFAULT 0,
                is_missing INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);
            CREATE INDEX IF NOT EXISTS idx_photos_favorite ON photos(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_photos_used ON photos(used_count);

            INSERT INTO schema_version (version) VALUES (4);

            COMMIT;",
        )?;

        log::info!("Applied database migration v4");
        Ok(())
    }

    /// Schema version 5: Photo Folders & Collection Management.
    fn migrate_v5(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS photo_folders (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS photo_folder_members (
                folder_id TEXT NOT NULL,
                photo_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY(folder_id, photo_id),
                FOREIGN KEY(folder_id) REFERENCES photo_folders(id) ON DELETE CASCADE,
                FOREIGN KEY(photo_id) REFERENCES photos(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_photo_folders_project ON photo_folders(project_id);
            CREATE INDEX IF NOT EXISTS idx_photo_folder_members_folder ON photo_folder_members(folder_id);
            CREATE INDEX IF NOT EXISTS idx_photo_folder_members_photo ON photo_folder_members(photo_id);

            INSERT INTO schema_version (version) VALUES (5);

            COMMIT;",
        )?;

        log::info!("Applied database migration v5");
        Ok(())
    }

    /// Schema version 6: Album Spreads and Photo Frame Elements.
    fn migrate_v6(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS album_spreads (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                spread_index INTEGER NOT NULL DEFAULT 0,
                spread_type TEXT NOT NULL DEFAULT 'interior',
                name TEXT NOT NULL,
                left_page_id TEXT,
                right_page_id TEXT,
                gutter_width REAL NOT NULL DEFAULT 0.0,
                gutter_unit TEXT NOT NULL DEFAULT 'mm',
                bleed REAL NOT NULL DEFAULT 3.0,
                safe_area REAL NOT NULL DEFAULT 10.0,
                background_color TEXT NOT NULL DEFAULT '#FFFFFF',
                is_cover INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS spread_elements (
                id TEXT PRIMARY KEY,
                spread_id TEXT NOT NULL,
                element_type TEXT NOT NULL DEFAULT 'photo',
                photo_id TEXT,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                preview_path TEXT,
                thumbnail_path TEXT,
                x REAL NOT NULL DEFAULT 0.0,
                y REAL NOT NULL DEFAULT 0.0,
                width REAL NOT NULL DEFAULT 100.0,
                height REAL NOT NULL DEFAULT 80.0,
                rotation REAL NOT NULL DEFAULT 0.0,
                z_index INTEGER NOT NULL DEFAULT 1,
                photo_aspect REAL NOT NULL DEFAULT 1.0,
                original_width REAL NOT NULL DEFAULT 100.0,
                original_height REAL NOT NULL DEFAULT 80.0,
                crop_x REAL NOT NULL DEFAULT 0.0,
                crop_y REAL NOT NULL DEFAULT 0.0,
                crop_scale REAL NOT NULL DEFAULT 1.0,
                crop_rotation REAL NOT NULL DEFAULT 0.0,
                border_enabled INTEGER NOT NULL DEFAULT 0,
                border_width REAL NOT NULL DEFAULT 0.0,
                border_color TEXT NOT NULL DEFAULT '#FFFFFF',
                opacity REAL NOT NULL DEFAULT 1.0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(spread_id) REFERENCES album_spreads(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_album_spreads_project ON album_spreads(project_id);
            CREATE INDEX IF NOT EXISTS idx_album_spreads_index ON album_spreads(project_id, spread_index);
            CREATE INDEX IF NOT EXISTS idx_spread_elements_spread ON spread_elements(spread_id);

            INSERT INTO schema_version (version) VALUES (6);

            COMMIT;",
        )?;

        log::info!("Applied database migration v6");
        Ok(())
    }

    /// Schema version 7: Add group_id to spread_elements table.
    fn migrate_v7(conn: &Connection) -> SqliteResult<()> {
        let mut cols = conn.prepare("PRAGMA table_info(spread_elements)")?;
        let col_names: Vec<String> = cols
            .query_map([], |row| row.get(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !col_names.contains(&"group_id".to_string()) {
            conn.execute_batch(
                "BEGIN;
                ALTER TABLE spread_elements ADD COLUMN group_id TEXT;
                INSERT INTO schema_version (version) VALUES (7);
                COMMIT;",
            )?;
        } else {
            conn.execute("INSERT INTO schema_version (version) VALUES (7)", [])?;
        }

        log::info!("Applied database migration v7");
        Ok(())
    }

    /// Schema version 8: Photo frame element lock status.
    fn migrate_v8(conn: &Connection) -> SqliteResult<()> {
        let mut cols = conn.prepare("PRAGMA table_info(spread_elements)")?;
        let col_names: Vec<String> = cols
            .query_map([], |row| row.get(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !col_names.contains(&"locked".to_string()) {
            conn.execute_batch(
                "BEGIN;
                ALTER TABLE spread_elements ADD COLUMN locked INTEGER DEFAULT 0;
                INSERT INTO schema_version (version) VALUES (8);
                COMMIT;",
            )?;
        } else {
            conn.execute("INSERT INTO schema_version (version) VALUES (8)", [])?;
        }

        log::info!("Applied database migration v8");
        Ok(())
    }

    /// Schema version 9: Add left_page_background_color and right_page_background_color to album_spreads table.
    fn migrate_v9(conn: &Connection) -> SqliteResult<()> {
        let mut cols = conn.prepare("PRAGMA table_info(album_spreads)")?;
        let col_names: Vec<String> = cols
            .query_map([], |row| row.get(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !col_names.contains(&"left_page_background_color".to_string()) {
            conn.execute_batch(
                "BEGIN;
                ALTER TABLE album_spreads ADD COLUMN left_page_background_color TEXT;
                ALTER TABLE album_spreads ADD COLUMN right_page_background_color TEXT;
                INSERT INTO schema_version (version) VALUES (9);
                COMMIT;",
            )?;
        } else {
            conn.execute("INSERT INTO schema_version (version) VALUES (9)", [])?;
        }

        log::info!("Applied database migration v9");
        Ok(())
    }

    pub fn get_schema_version(&self) -> SqliteResult<i32> {
        let conn = self.conn.lock().unwrap();
        let version: i32 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )?;
        Ok(version)
    }

    #[allow(dead_code)]
    pub fn get_setting(&self, key: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;

        if let Some(row) = rows.next()? {
            let value: String = row.get(0)?;
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    #[allow(dead_code)]
    pub fn set_setting(&self, key: &str, value: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 updated_at = excluded.updated_at",
            [key, value],
        )?;
        Ok(())
    }

    // --- Project Operations ---

    pub fn ensure_project_exists(&self, id: &str, name: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let exists: bool = conn.query_row(
            "SELECT 1 FROM projects WHERE id = ?1",
            [id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !exists {
            log::warn!("Project {} not found in SQLite DB; creating entry to satisfy foreign keys", id);
            conn.execute(
                "INSERT OR IGNORE INTO projects (
                    id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color,
                    created_at, updated_at
                ) VALUES (
                    ?1, ?2, 200.0, 200.0, 'mm', 300,
                    2.0, 'mm',
                    1, 10.0, 'mm',
                    0, 0.0, 'mm', '#000000',
                    'solid', '#FFFFFF',
                    datetime('now'), datetime('now')
                )",
                rusqlite::params![id, name],
            )?;
        }
        Ok(())
    }

    pub fn create_project(
        &self,
        id: &str,
        name: &str,
        canvas_width: f64,
        canvas_height: f64,
        canvas_unit: &str,
        canvas_dpi: i32,
        spacing_value: f64,
        spacing_unit: &str,
        margin_enabled: bool,
        margin_value: f64,
        margin_unit: &str,
        border_enabled: bool,
        border_width: f64,
        border_unit: &str,
        border_color: &str,
        background_type: &str,
        background_color: &str,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (
                id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                spacing_value, spacing_unit,
                margin_enabled, margin_value, margin_unit,
                border_enabled, border_width, border_unit, border_color,
                background_type, background_color,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6,
                ?7, ?8,
                ?9, ?10, ?11,
                ?12, ?13, ?14, ?15,
                ?16, ?17,
                datetime('now'), datetime('now')
            )",
            rusqlite::params![
                id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                spacing_value, spacing_unit,
                margin_enabled as i32, margin_value, margin_unit,
                border_enabled as i32, border_width, border_unit, border_color,
                background_type, background_color,
            ],
        )?;
        Ok(())
    }

    pub fn get_project(&self, id: &str) -> SqliteResult<Option<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path,
                    created_at, updated_at
             FROM projects WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            let margin_enabled_int: i32 = row.get(8)?;
            let border_enabled_int: i32 = row.get(11)?;
            Ok(Some(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                canvas_width: row.get(2)?,
                canvas_height: row.get(3)?,
                canvas_unit: row.get(4)?,
                canvas_dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: margin_enabled_int != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: border_enabled_int != 0,
                border_width: row.get(12)?,
                border_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                file_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_project_spacing(&self, id: &str, spacing_value: f64, spacing_unit: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET spacing_value = ?1, spacing_unit = ?2, updated_at = datetime('now') WHERE id = ?3",
            rusqlite::params![spacing_value, spacing_unit, id],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn update_project_name(&self, id: &str, name: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![name, id],
        )?;
        Ok(())
    }

    pub fn update_project_name_and_path(&self, id: &str, name: &str, file_path: Option<&str>) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET name = ?1, file_path = ?2, updated_at = datetime('now') WHERE id = ?3",
            rusqlite::params![name, file_path, id],
        )?;
        Ok(())
    }

    pub fn list_recent_projects(&self, limit: i32) -> SqliteResult<Vec<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path,
                    created_at, updated_at
             FROM projects
             ORDER BY updated_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit], |row| {
            let margin_enabled_int: i32 = row.get(8)?;
            let border_enabled_int: i32 = row.get(11)?;
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                canvas_width: row.get(2)?,
                canvas_height: row.get(3)?,
                canvas_unit: row.get(4)?,
                canvas_dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: margin_enabled_int != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: border_enabled_int != 0,
                border_width: row.get(12)?,
                border_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                file_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            })
        })?;

        let mut projects = Vec::new();
        for p in rows {
            projects.push(p?);
        }
        Ok(projects)
    }

    pub fn delete_project(&self, project_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", [project_id])?;
        Ok(())
    }

    pub fn clear_recent_projects(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects", [])?;
        Ok(())
    }

    // --- Photo Library Operations ---

    pub fn add_photo(&self, photo: &PhotoRow) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO photos (
                id, project_id, file_path, file_name, file_size,
                width, height, format, thumbnail_path, thumbnail_base64,
                preview_path, is_favorite, used_count, is_missing,
                created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14,
                datetime('now'), datetime('now')
            )",
            rusqlite::params![
                photo.id,
                photo.project_id,
                photo.file_path,
                photo.file_name,
                photo.file_size,
                photo.width,
                photo.height,
                photo.format,
                photo.thumbnail_path,
                photo.thumbnail_base64,
                photo.preview_path,
                photo.is_favorite as i32,
                photo.used_count,
                photo.is_missing as i32,
            ],
        )?;
        Ok(())
    }

    pub fn add_photos_batch(&self, photos: &[PhotoRow], folder_id: Option<&str>) -> SqliteResult<()> {
        if photos.is_empty() {
            return Ok(());
        }

        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO photos (
                    id, project_id, file_path, file_name, file_size,
                    width, height, format, thumbnail_path, thumbnail_base64,
                    preview_path, is_favorite, used_count, is_missing,
                    created_at, updated_at
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5,
                    ?6, ?7, ?8, ?9, ?10,
                    ?11, ?12, ?13, ?14,
                    datetime('now'), datetime('now')
                )",
            )?;

            for photo in photos {
                stmt.execute(rusqlite::params![
                    photo.id,
                    photo.project_id,
                    photo.file_path,
                    photo.file_name,
                    photo.file_size,
                    photo.width,
                    photo.height,
                    photo.format,
                    photo.thumbnail_path,
                    photo.thumbnail_base64,
                    photo.preview_path,
                    photo.is_favorite as i32,
                    photo.used_count,
                    photo.is_missing as i32,
                ])?;
            }
        }

        if let Some(fid) = folder_id {
            let mut folder_stmt = tx.prepare(
                "INSERT OR IGNORE INTO photo_folder_members (folder_id, photo_id, created_at)
                 VALUES (?1, ?2, datetime('now'))",
            )?;
            for photo in photos {
                folder_stmt.execute(rusqlite::params![fid, photo.id])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_photos_for_project(&self, project_id: &str) -> SqliteResult<Vec<PhotoRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_path, file_name, file_size,
                    width, height, format, thumbnail_path, thumbnail_base64,
                    preview_path, is_favorite, used_count, is_missing,
                    created_at, updated_at
             FROM photos
             WHERE project_id = ?1
             ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map([project_id], |row| {
            let fav_int: i32 = row.get(11)?;
            let missing_int: i32 = row.get(13)?;
            Ok(PhotoRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                format: row.get(7)?,
                thumbnail_path: row.get(8)?,
                thumbnail_base64: row.get(9)?,
                preview_path: row.get(10)?,
                is_favorite: fav_int != 0,
                used_count: row.get(12)?,
                is_missing: missing_int != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut photos = Vec::new();
        for p in rows {
            photos.push(p?);
        }
        Ok(photos)
    }

    pub fn get_photo_ids(&self) -> SqliteResult<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id FROM photos")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect()
    }

    pub fn get_photo(&self, photo_id: &str) -> SqliteResult<Option<PhotoRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_path, file_name, file_size,
                    width, height, format, thumbnail_path, thumbnail_base64,
                    preview_path, is_favorite, used_count, is_missing,
                    created_at, updated_at
             FROM photos WHERE id = ?1",
        )?;

        let mut rows = stmt.query([photo_id])?;
        if let Some(row) = rows.next()? {
            let fav_int: i32 = row.get(11)?;
            let missing_int: i32 = row.get(13)?;
            Ok(Some(PhotoRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                format: row.get(7)?,
                thumbnail_path: row.get(8)?,
                thumbnail_base64: row.get(9)?,
                preview_path: row.get(10)?,
                is_favorite: fav_int != 0,
                used_count: row.get(12)?,
                is_missing: missing_int != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn toggle_photo_favorite(&self, photo_id: &str, is_favorite: bool) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET is_favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![is_favorite as i32, photo_id],
        )?;
        Ok(())
    }

    pub fn delete_photo(&self, photo_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM photos WHERE id = ?1", [photo_id])?;
        Ok(())
    }

    pub fn update_photo_missing(&self, photo_id: &str, is_missing: bool) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET is_missing = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![is_missing as i32, photo_id],
        )?;
        Ok(())
    }

    pub fn update_photo_thumbnail(&self, photo_id: &str, thumbnail_path: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET thumbnail_path = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![thumbnail_path, photo_id],
        )?;
        Ok(())
    }

    pub fn update_photo_preview(&self, photo_id: &str, preview_path: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET preview_path = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![preview_path, photo_id],
        )?;
        Ok(())
    }

    pub fn relink_photo(&self, photo_id: &str, new_path: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET file_path = ?1, is_missing = 0, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![new_path, photo_id],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn check_photo_exists_in_project(&self, project_id: &str, file_path: &str) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM photos WHERE project_id = ?1 AND file_path = ?2",
            [project_id, file_path],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // --- Batch Photo Operations ---

    pub fn batch_delete_photos(&self, photo_ids: &[String]) -> SqliteResult<()> {
        if photo_ids.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock().unwrap();
        let placeholders: Vec<String> = photo_ids.iter().map(|_| "?".to_string()).collect();
        let query = format!("DELETE FROM photos WHERE id IN ({})", placeholders.join(","));
        let params: Vec<&dyn rusqlite::ToSql> = photo_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        conn.execute(&query, rusqlite::params_from_iter(params))?;
        Ok(())
    }

    pub fn batch_toggle_favorites(&self, photo_ids: &[String], is_favorite: bool) -> SqliteResult<()> {
        if photo_ids.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock().unwrap();
        let placeholders: Vec<String> = photo_ids.iter().map(|_| "?".to_string()).collect();
        let query = format!(
            "UPDATE photos SET is_favorite = ?1, updated_at = datetime('now') WHERE id IN ({})",
            placeholders.join(",")
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        let fav_val = is_favorite as i32;
        params.push(&fav_val);
        for id in photo_ids {
            params.push(id);
        }
        conn.execute(&query, rusqlite::params_from_iter(params))?;
        Ok(())
    }

    // --- Photo Folder Operations ---

    pub fn create_folder(&self, id: &str, project_id: &str, name: &str) -> SqliteResult<PhotoFolderRow> {
        let conn = self.conn.lock().unwrap();
        let max_order: i32 = conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM photo_folders WHERE project_id = ?1",
            [project_id],
            |row| row.get(0),
        ).unwrap_or(-1);

        let next_order = max_order + 1;
        conn.execute(
            "INSERT INTO photo_folders (id, project_id, name, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
            rusqlite::params![id, project_id, name, next_order],
        )?;

        Ok(PhotoFolderRow {
            id: id.to_string(),
            project_id: project_id.to_string(),
            name: name.to_string(),
            sort_order: next_order,
            photo_count: 0,
            created_at: "now".to_string(),
            updated_at: "now".to_string(),
        })
    }

    pub fn get_folders_for_project(&self, project_id: &str) -> SqliteResult<Vec<PhotoFolderRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT f.id, f.project_id, f.name, f.sort_order,
                    COUNT(m.photo_id) AS photo_count,
                    f.created_at, f.updated_at
             FROM photo_folders f
             LEFT JOIN photo_folder_members m ON f.id = m.folder_id
             WHERE f.project_id = ?1
             GROUP BY f.id
             ORDER BY f.sort_order ASC, f.created_at ASC",
        )?;

        let rows = stmt.query_map([project_id], |row| {
            Ok(PhotoFolderRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                sort_order: row.get(3)?,
                photo_count: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut folders = Vec::new();
        for f in rows {
            folders.push(f?);
        }
        Ok(folders)
    }

    pub fn rename_folder(&self, folder_id: &str, new_name: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photo_folders SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![new_name, folder_id],
        )?;
        Ok(())
    }

    pub fn delete_folder(&self, folder_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM photo_folders WHERE id = ?1", [folder_id])?;
        Ok(())
    }

    pub fn add_photos_to_folder(&self, folder_id: &str, photo_ids: &[String]) -> SqliteResult<()> {
        if photo_ids.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock().unwrap();
        for photo_id in photo_ids {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO photo_folder_members (folder_id, photo_id, created_at)
                 VALUES (?1, ?2, datetime('now'))",
                rusqlite::params![folder_id, photo_id],
            );
        }
        Ok(())
    }

    pub fn remove_photos_from_folder(&self, folder_id: &str, photo_ids: &[String]) -> SqliteResult<()> {
        if photo_ids.is_empty() {
            return Ok(());
        }
        let conn = self.conn.lock().unwrap();
        let placeholders: Vec<String> = photo_ids.iter().map(|_| "?".to_string()).collect();
        let query = format!(
            "DELETE FROM photo_folder_members WHERE folder_id = ?1 AND photo_id IN ({})",
            placeholders.join(",")
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        params.push(&folder_id);
        for id in photo_ids {
            params.push(id);
        }
        conn.execute(&query, rusqlite::params_from_iter(params))?;
        Ok(())
    }

    pub fn move_photos_between_folders(
        &self,
        from_folder_id: &str,
        to_folder_id: &str,
        photo_ids: &[String],
    ) -> SqliteResult<()> {
        if photo_ids.is_empty() {
            return Ok(());
        }
        self.remove_photos_from_folder(from_folder_id, photo_ids)?;
        self.add_photos_to_folder(to_folder_id, photo_ids)?;
        Ok(())
    }

    pub fn get_photos_for_folder(&self, folder_id: &str) -> SqliteResult<Vec<PhotoRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.project_id, p.file_path, p.file_name, p.file_size,
                    p.width, p.height, p.format, p.thumbnail_path, p.thumbnail_base64,
                    p.preview_path, p.is_favorite, p.used_count, p.is_missing,
                    p.created_at, p.updated_at
             FROM photos p
             INNER JOIN photo_folder_members m ON p.id = m.photo_id
             WHERE m.folder_id = ?1
             ORDER BY m.created_at ASC",
        )?;

        let rows = stmt.query_map([folder_id], |row| {
            let fav_int: i32 = row.get(11)?;
            let missing_int: i32 = row.get(13)?;
            Ok(PhotoRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: row.get(3)?,
                file_size: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                format: row.get(7)?,
                thumbnail_path: row.get(8)?,
                thumbnail_base64: row.get(9)?,
                preview_path: row.get(10)?,
                is_favorite: fav_int != 0,
                used_count: row.get(12)?,
                is_missing: missing_int != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut photos = Vec::new();
        for p in rows {
            photos.push(p?);
        }
        Ok(photos)
    }

    // --- Album Structure & Elements Persistence ---

    pub fn save_album_structure(&self, album: &AlbumPayload) -> SqliteResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        // Ensure project exists to satisfy FK constraint
        let project_exists: bool = tx.query_row(
            "SELECT 1 FROM projects WHERE id = ?1",
            [&album.project_id],
            |_| Ok(true),
        ).unwrap_or(false);

        if !project_exists {
            tx.execute(
                "INSERT OR IGNORE INTO projects (
                    id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit, margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, created_at, updated_at
                ) VALUES (?1, 'Untitled Album', 200.0, 200.0, 'mm', 300, 2.0, 'mm', 1, 10.0, 'mm', 0, 0.0, 'mm', '#000000', 'solid', '#FFFFFF', datetime('now'), datetime('now'))",
                [&album.project_id],
            )?;
        }

        // Delete existing spreads for this project (will CASCADE delete spread_elements)
        tx.execute("DELETE FROM album_spreads WHERE project_id = ?1", [&album.project_id])?;

        // Helper to insert a spread and its elements into SQLite
        fn insert_spread_record(tx: &rusqlite::Transaction, project_id: &str, spread: &SpreadPayload, is_cover: bool) -> SqliteResult<()> {
            let left_id = spread.left_page.as_ref().map(|p| p.id.clone());
            let right_id = spread.right_page.as_ref().map(|p| p.id.clone());
            let left_bg = spread.left_page.as_ref().map(|p| p.background_color.clone()).unwrap_or_else(|| spread.background_color.clone());
            let right_bg = spread.right_page.as_ref().map(|p| p.background_color.clone()).unwrap_or_else(|| spread.background_color.clone());

            tx.execute(
                "INSERT INTO album_spreads (
                    id, project_id, spread_index, spread_type, name,
                    left_page_id, right_page_id, gutter_width, gutter_unit,
                    bleed, safe_area, background_color, is_cover,
                    left_page_background_color, right_page_background_color,
                    created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'), datetime('now'))",
                rusqlite::params![
                    spread.id,
                    project_id,
                    spread.spread_index,
                    spread.r#type,
                    spread.name,
                    left_id,
                    right_id,
                    spread.gutter_width,
                    spread.gutter_unit,
                    spread.bleed,
                    spread.safe_area,
                    spread.background_color,
                    if is_cover { 1 } else { 0 },
                    left_bg,
                    right_bg,
                ],
            )?;

            for elem in &spread.elements {
                tx.execute(
                    "INSERT INTO spread_elements (
                        id, spread_id, element_type, photo_id, group_id, file_path, file_name,
                        preview_path, thumbnail_path, x, y, width, height,
                        rotation, z_index, photo_aspect, original_width, original_height,
                        crop_x, crop_y, crop_scale, crop_rotation,
                        border_enabled, border_width, border_color, opacity, locked,
                        created_at, updated_at
                    ) VALUES (
                        ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                        ?8, ?9, ?10, ?11, ?12, ?13,
                        ?14, ?15, ?16, ?17, ?18,
                        ?19, ?20, ?21, ?22,
                        ?23, ?24, ?25, ?26, ?27,
                        datetime('now'), datetime('now')
                    )",
                    rusqlite::params![
                        elem.id,
                        spread.id,
                        elem.r#type,
                        elem.photo_id,
                        elem.group_id,
                        elem.file_path,
                        elem.file_name,
                        elem.preview_path,
                        elem.thumbnail_path,
                        elem.x,
                        elem.y,
                        elem.width,
                        elem.height,
                        elem.rotation,
                        elem.z_index,
                        elem.photo_aspect,
                        elem.original_width.unwrap_or(elem.width),
                        elem.original_height.unwrap_or(elem.height),
                        elem.crop_x,
                        elem.crop_y,
                        elem.crop_scale,
                        elem.crop_rotation.unwrap_or(0.0),
                        elem.border_enabled as i32,
                        elem.border_width,
                        elem.border_color,
                        elem.opacity,
                        elem.locked.unwrap_or(false) as i32,
                    ],
                )?;
            }
            Ok(())
        }

        // Save cover spread
        insert_spread_record(&tx, &album.project_id, &album.cover_spread, true)?;

        // Save interior spreads
        for spread in &album.spreads {
            insert_spread_record(&tx, &album.project_id, spread, false)?;
        }

        // Update project updated_at timestamp
        tx.execute("UPDATE projects SET updated_at = datetime('now') WHERE id = ?1", [&album.project_id])?;

        tx.commit()?;
        Ok(())
    }

    pub fn load_album_structure(&self, project_id: &str) -> SqliteResult<Option<AlbumPayload>> {
        let conn = self.conn.lock().unwrap();

        // Check if project exists directly without re-locking self.conn (prevents deadlock)
        let mut proj_stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path,
                    created_at, updated_at
             FROM projects WHERE id = ?1",
        )?;
        let mut proj_rows = proj_stmt.query([project_id])?;
        let project = if let Some(row) = proj_rows.next()? {
            let margin_enabled_int: i32 = row.get(8)?;
            let border_enabled_int: i32 = row.get(11)?;
            ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                canvas_width: row.get(2)?,
                canvas_height: row.get(3)?,
                canvas_unit: row.get(4)?,
                canvas_dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: margin_enabled_int != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: border_enabled_int != 0,
                border_width: row.get(12)?,
                border_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                file_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            }
        } else {
            return Ok(None);
        };

        // Query all spreads for this project
        let mut spread_stmt = conn.prepare(
            "SELECT id, project_id, spread_index, spread_type, name,
                    left_page_id, right_page_id, gutter_width, gutter_unit,
                    bleed, safe_area, background_color, is_cover,
                    left_page_background_color, right_page_background_color,
                    created_at, updated_at
             FROM album_spreads
             WHERE project_id = ?1
             ORDER BY spread_index ASC",
        )?;

        let mut elem_stmt = conn.prepare(
            "SELECT id, spread_id, element_type, photo_id, file_path, file_name,
                    preview_path, thumbnail_path, x, y, width, height,
                    rotation, z_index, photo_aspect, original_width, original_height,
                    crop_x, crop_y, crop_scale, crop_rotation,
                    border_enabled, border_width, border_color, opacity,
                    group_id, locked, created_at, updated_at
             FROM spread_elements
             WHERE spread_id = ?1
             ORDER BY z_index ASC",
        )?;

        let spread_rows = spread_stmt.query_map([project_id], |row| {
            let is_cover_int: i32 = row.get(12).unwrap_or(0);
            let bg: String = row.get::<_, String>(11).unwrap_or_else(|_| "#FFFFFF".to_string());
            let left_bg: String = row.get::<_, Option<String>>(13).ok().flatten().unwrap_or_else(|| bg.clone());
            let right_bg: String = row.get::<_, Option<String>>(14).ok().flatten().unwrap_or_else(|| bg.clone());
            Ok((
                row.get::<_, String>(0)?, // id
                row.get::<_, String>(1).unwrap_or_default(), // project_id
                row.get::<_, i32>(2).unwrap_or(0),    // spread_index
                row.get::<_, String>(3).unwrap_or_else(|_| "interior".to_string()), // spread_type
                row.get::<_, String>(4).unwrap_or_else(|_| "Spread".to_string()), // name
                row.get::<_, Option<String>>(5).ok().flatten(), // left_page_id
                row.get::<_, Option<String>>(6).ok().flatten(), // right_page_id
                row.get::<_, f64>(7).unwrap_or(0.0),    // gutter_width
                row.get::<_, String>(8).unwrap_or_else(|_| "mm".to_string()), // gutter_unit
                row.get::<_, f64>(9).unwrap_or(3.0),    // bleed
                row.get::<_, f64>(10).unwrap_or(10.0),   // safe_area
                bg,                                     // background_color
                is_cover_int != 0,                      // is_cover
                left_bg,                                // left_page_background_color
                right_bg,                               // right_page_background_color
            ))
        })?;

        let mut cover_spread: Option<SpreadPayload> = None;
        let mut interior_spreads: Vec<SpreadPayload> = Vec::new();

        for s_res in spread_rows {
            let (id, _pid, spread_index, spread_type, name, left_page_id, right_page_id, gutter_width, gutter_unit, bleed, safe_area, background_color, is_cover, left_bg, right_bg) = s_res?;

            // Load elements for this spread
            let elem_rows = elem_stmt.query_map([&id], |er| {
                let border_int: i32 = er.get(21).unwrap_or(0);
                let locked_int: i32 = er.get(26).unwrap_or(0);
                let w: f64 = er.get(10).unwrap_or(100.0);
                let h: f64 = er.get(11).unwrap_or(80.0);
                Ok(ElementPayload {
                    id: er.get(0)?,
                    r#type: er.get(2).unwrap_or_else(|_| "photo".to_string()),
                    photo_id: er.get(3).ok(),
                    file_path: er.get(4).unwrap_or_default(),
                    file_name: er.get(5).unwrap_or_default(),
                    preview_path: er.get(6).ok(),
                    thumbnail_path: er.get(7).ok(),
                    x: er.get(8).unwrap_or(0.0),
                    y: er.get(9).unwrap_or(0.0),
                    width: w,
                    height: h,
                    rotation: er.get(12).unwrap_or(0.0),
                    z_index: er.get(13).unwrap_or(1),
                    photo_aspect: er.get(14).unwrap_or(1.0),
                    original_width: er.get(15).ok().or(Some(w)),
                    original_height: er.get(16).ok().or(Some(h)),
                    crop_x: er.get(17).unwrap_or(0.0),
                    crop_y: er.get(18).unwrap_or(0.0),
                    crop_scale: er.get(19).unwrap_or(1.0),
                    crop_rotation: er.get(20).ok(),
                    border_enabled: border_int != 0,
                    border_width: er.get(22).unwrap_or(0.0),
                    border_color: er.get(23).unwrap_or_else(|_| "#FFFFFF".to_string()),
                    opacity: er.get(24).unwrap_or(1.0),
                    group_id: er.get(25).ok(),
                    locked: Some(locked_int != 0),
                })
            })?;

            let mut elements = Vec::new();
            for e in elem_rows {
                elements.push(e?);
            }

            // Construct Left & Right Page payloads
            let (left_page, right_page) = if is_cover {
                let left = PagePayload {
                    id: left_page_id.unwrap_or_else(|| format!("{}-page-cover-back", id)),
                    page_number: 0,
                    r#type: "cover_back".to_string(),
                    width: project.canvas_width,
                    height: project.canvas_height,
                    unit: project.canvas_unit.clone(),
                    bleed,
                    safe_area,
                    background_color: left_bg,
                    background_type: "solid".to_string(),
                };
                let right = PagePayload {
                    id: right_page_id.unwrap_or_else(|| format!("{}-page-cover-front", id)),
                    page_number: 1,
                    r#type: "cover_front".to_string(),
                    width: project.canvas_width,
                    height: project.canvas_height,
                    unit: project.canvas_unit.clone(),
                    bleed,
                    safe_area,
                    background_color: right_bg,
                    background_type: "solid".to_string(),
                };
                (Some(left), Some(right))
            } else {
                let left_num = (spread_index - 1) * 2 + 1;
                let right_num = left_num + 1;
                let left = PagePayload {
                    id: left_page_id.unwrap_or_else(|| format!("{}-page-{}", id, left_num)),
                    page_number: left_num,
                    r#type: "left".to_string(),
                    width: project.canvas_width,
                    height: project.canvas_height,
                    unit: project.canvas_unit.clone(),
                    bleed,
                    safe_area,
                    background_color: left_bg,
                    background_type: "solid".to_string(),
                };
                let right = PagePayload {
                    id: right_page_id.unwrap_or_else(|| format!("{}-page-{}", id, right_num)),
                    page_number: right_num,
                    r#type: "right".to_string(),
                    width: project.canvas_width,
                    height: project.canvas_height,
                    unit: project.canvas_unit.clone(),
                    bleed,
                    safe_area,
                    background_color: right_bg,
                    background_type: "solid".to_string(),
                };
                (Some(left), Some(right))
            };

            let spread_payload = SpreadPayload {
                id,
                spread_index,
                r#type: spread_type,
                name,
                left_page,
                right_page,
                gutter_width,
                gutter_unit,
                bleed,
                safe_area,
                background_color,
                elements,
            };

            if is_cover {
                cover_spread = Some(spread_payload);
            } else {
                interior_spreads.push(spread_payload);
            }
        }

        if cover_spread.is_none() && interior_spreads.is_empty() {
            return Ok(None);
        }

        let total_spreads = interior_spreads.len() as i32;
        let total_pages = total_spreads * 2;

        let final_cover = cover_spread.unwrap_or_else(|| SpreadPayload {
            id: format!("album-{}-spread-cover", project_id),
            spread_index: 0,
            r#type: "cover".to_string(),
            name: "Cover Spread".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 6.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 10.0,
            background_color: "#1e293b".to_string(),
            elements: Vec::new(),
        });

        Ok(Some(AlbumPayload {
            id: format!("album-{}", project_id),
            project_id: project_id.to_string(),
            cover_spread: final_cover,
            spreads: interior_spreads,
            total_spreads,
            total_pages,
        }))
    }

    pub fn export_project_package(&self, project_id: &str, target_path: &str) -> SqliteResult<()> {
        let project = self.get_project(project_id)?.ok_or_else(|| {
            rusqlite::Error::QueryReturnedNoRows
        })?;
        let photos = self.get_photos_for_project(project_id)?;
        let folders = self.get_folders_for_project(project_id)?;
        let album = self.load_album_structure(project_id)?;

        let package = ProjectPackagePayload {
            version: 1,
            project,
            photos,
            folders,
            album,
        };

        let json_str = serde_json::to_string_pretty(&package).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to serialize package: {}", e).into())
        })?;

        std::fs::write(target_path, json_str).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to write .afsn file: {}", e).into())
        })?;

        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "UPDATE projects SET file_path = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![target_path, project_id],
        );

        Ok(())
    }

    /// Exports a standalone complete package (.zip) containing project.afsn and all raw photo files.
    pub fn export_bundled_project_package(&self, project_id: &str, target_path: &str) -> SqliteResult<()> {
        let project = self.get_project(project_id)?.ok_or_else(|| {
            rusqlite::Error::QueryReturnedNoRows
        })?;
        let mut photos = self.get_photos_for_project(project_id)?;
        let folders = self.get_folders_for_project(project_id)?;
        let mut album = self.load_album_structure(project_id)?;

        let file = std::fs::File::create(target_path).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to create package file: {}", e).into())
        })?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);

        let mut path_remap: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        // Write all original photo files into photos/ folder in zip
        for photo in &mut photos {
            let orig_path = std::path::Path::new(&photo.file_path);
            if orig_path.exists() {
                let safe_name = photo.file_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
                let zip_entry_name = format!("{}_{}", photo.id, safe_name);
                let zip_entry_path = format!("photos/{}", zip_entry_name);

                if let Ok(mut src_file) = std::fs::File::open(orig_path) {
                    if zip.start_file(&zip_entry_path, options).is_ok() {
                        let _ = std::io::copy(&mut src_file, &mut zip);
                    }
                }
                path_remap.insert(photo.file_path.clone(), zip_entry_path.clone());
                photo.file_path = zip_entry_path;
            }
        }

        // Remap photo paths inside album elements to matching bundled relative paths
        if let Some(ref mut alb) = album {
            for elem in &mut alb.cover_spread.elements {
                if let Some(new_p) = path_remap.get(&elem.file_path) {
                    elem.file_path = new_p.clone();
                }
            }
            for spread in &mut alb.spreads {
                for elem in &mut spread.elements {
                    if let Some(new_p) = path_remap.get(&elem.file_path) {
                        elem.file_path = new_p.clone();
                    }
                }
            }
        }

        let package = ProjectPackagePayload {
            version: 1,
            project,
            photos,
            folders,
            album,
        };

        let json_str = serde_json::to_string_pretty(&package).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to serialize package: {}", e).into())
        })?;

        use std::io::Write;
        zip.start_file("project.afsn", options).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to add project.afsn to zip: {}", e).into())
        })?;
        zip.write_all(json_str.as_bytes()).map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to write project.afsn into zip: {}", e).into())
        })?;

        zip.finish().map_err(|e| {
            rusqlite::Error::InvalidPath(format!("Failed to finalize package zip: {}", e).into())
        })?;

        Ok(())
    }

    pub fn import_project_package(&self, source_path: &str) -> SqliteResult<ProjectPackagePayload> {
        let path = std::path::Path::new(source_path);
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

        let mut package: ProjectPackagePayload;

        if ext == "zip" || ext == "afsnz" {
            // Open and extract ZIP package
            let file = std::fs::File::open(path).map_err(|e| {
                rusqlite::Error::InvalidPath(format!("Failed to open package zip: {}", e).into())
            })?;
            let mut archive = zip::ZipArchive::new(file).map_err(|e| {
                rusqlite::Error::InvalidPath(format!("Invalid zip archive: {}", e).into())
            })?;

            // Read project.afsn from zip
            let json_str = {
                let mut afsn_file = archive.by_name("project.afsn").map_err(|e| {
                    rusqlite::Error::InvalidPath(format!("Missing project.afsn inside zip: {}", e).into())
                })?;
                let mut s = String::new();
                use std::io::Read;
                afsn_file.read_to_string(&mut s).map_err(|e| {
                    rusqlite::Error::InvalidPath(format!("Failed to read project.afsn from zip: {}", e).into())
                })?;
                s
            };

            package = serde_json::from_str(&json_str).map_err(|e| {
                rusqlite::Error::InvalidPath(format!("Invalid project.afsn in zip: {}", e).into())
            })?;

            // Extract bundled photos to local app cache/user directory
            let extract_base_dir = self.db_path.parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join("extracted_packages")
                .join(&package.project.id);
            let _ = std::fs::create_dir_all(&extract_base_dir);

            for i in 0..archive.len() {
                if let Ok(mut entry) = archive.by_index(i) {
                    let entry_name = entry.name().to_string();
                    if entry_name.starts_with("photos/") && !entry.is_dir() {
                        let out_path = extract_base_dir.join(&entry_name);
                        if let Some(parent) = out_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        if let Ok(mut out_file) = std::fs::File::create(&out_path) {
                            let _ = std::io::copy(&mut entry, &mut out_file);
                        }
                    }
                }
            }

            // Remap photos to absolute extracted disk paths
            let mut remapped_paths: std::collections::HashMap<String, String> = std::collections::HashMap::new();
            for photo in &mut package.photos {
                if photo.file_path.starts_with("photos/") {
                    let abs_path = extract_base_dir.join(&photo.file_path);
                    let abs_str = abs_path.to_string_lossy().to_string();
                    remapped_paths.insert(photo.file_path.clone(), abs_str.clone());
                    photo.file_path = abs_str;
                }
            }

            // Remap in album elements
            if let Some(ref mut alb) = package.album {
                for elem in &mut alb.cover_spread.elements {
                    if let Some(abs_p) = remapped_paths.get(&elem.file_path) {
                        elem.file_path = abs_p.clone();
                    }
                }
                for spread in &mut alb.spreads {
                    for elem in &mut spread.elements {
                        if let Some(abs_p) = remapped_paths.get(&elem.file_path) {
                            elem.file_path = abs_p.clone();
                        }
                    }
                }
            }
        } else {
            let json_str = std::fs::read_to_string(source_path).map_err(|e| {
                rusqlite::Error::InvalidPath(format!("Failed to read .afsn file: {}", e).into())
            })?;

            package = serde_json::from_str(&json_str).map_err(|e| {
                rusqlite::Error::InvalidPath(format!("Invalid .afsn package format: {}", e).into())
            })?;

            // If the .afsn file has a valid custom name on disk, sync the project name with it
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()).filter(|s| !s.is_empty()) {
                package.project.name = stem.to_string();
            }
        }

        package.project.file_path = Some(source_path.to_string());

        // Upsert project into SQLite database
        let p = &package.project;
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO projects (
                    id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path,
                    created_at, updated_at
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6,
                    ?7, ?8,
                    ?9, ?10, ?11,
                    ?12, ?13, ?14, ?15,
                    ?16, ?17, ?18,
                    datetime('now'), datetime('now')
                )
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    canvas_width = excluded.canvas_width,
                    canvas_height = excluded.canvas_height,
                    canvas_unit = excluded.canvas_unit,
                    canvas_dpi = excluded.canvas_dpi,
                    spacing_value = excluded.spacing_value,
                    spacing_unit = excluded.spacing_unit,
                    margin_enabled = excluded.margin_enabled,
                    margin_value = excluded.margin_value,
                    margin_unit = excluded.margin_unit,
                    border_enabled = excluded.border_enabled,
                    border_width = excluded.border_width,
                    border_unit = excluded.border_unit,
                    border_color = excluded.border_color,
                    background_type = excluded.background_type,
                    background_color = excluded.background_color,
                    file_path = excluded.file_path,
                    updated_at = datetime('now')",
                rusqlite::params![
                    p.id, p.name, p.canvas_width, p.canvas_height, p.canvas_unit, p.canvas_dpi,
                    p.spacing_value, p.spacing_unit,
                    p.margin_enabled as i32, p.margin_value, p.margin_unit,
                    p.border_enabled as i32, p.border_width, p.border_unit, p.border_color,
                    p.background_type, p.background_color, source_path,
                ],
            )?;
        }

        // Import photos
        for photo in &package.photos {
            let _ = self.add_photo(photo);
        }

        // Import folders
        for folder in &package.folders {
            let _ = self.create_folder(&folder.id, &folder.project_id, &folder.name);
        }

        // Import album structure
        if let Some(album) = &package.album {
            self.save_album_structure(album)?;
        }

        Ok(package)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inspect_actual_db() {
        if let Ok(app_data_str) = std::env::var("APPDATA") {
            let app_data = PathBuf::from(app_data_str).join("com.afsn.smartalbum").join("afsn_smart_album.db");
            if app_data.exists() {
                let conn = rusqlite::Connection::open(&app_data).unwrap();
                let mut stmt = conn.prepare("PRAGMA table_info(projects)").unwrap();
                let cols = stmt.query_map([], |row| {
                    let name: String = row.get(1)?;
                    let col_type: String = row.get(2)?;
                    Ok(format!("{}: {}", name, col_type))
                }).unwrap();
                println!("=== ACTUAL DB PRAGMA table_info(projects) ===");
                for c in cols {
                    println!("COL: {}", c.unwrap());
                }
                println!("=============================================");
            }
        }
    }

    #[test]
    fn test_project_crud() {
        let temp_dir = std::env::temp_dir().join("afsn_test_db_v6");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        assert_eq!(db.get_schema_version().unwrap(), 8);

        db.create_project(
            "test-id-1",
            "Wedding Album",
            8.0,
            8.0,
            "inch",
            300,
            3.0,
            "mm",
            true,
            10.0,
            "mm",
            false,
            1.0,
            "mm",
            "#FFFFFF",
            "solid",
            "#FFFFFF",
        ).expect("Failed to create project");

        let project = db.get_project("test-id-1").unwrap().expect("Project not found");
        assert_eq!(project.name, "Wedding Album");
        assert_eq!(project.canvas_width, 8.0);
        assert_eq!(project.margin_enabled, true);
        assert_eq!(project.margin_value, 10.0);
        assert_eq!(project.border_enabled, false);

        let list = db.list_recent_projects(10).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "test-id-1");

        // Test Photo CRUD
        let photo1 = PhotoRow {
            id: "photo-1".to_string(),
            project_id: "test-id-1".to_string(),
            file_path: "C:\\photos\\img1.jpg".to_string(),
            file_name: "img1.jpg".to_string(),
            file_size: 1024000,
            width: 4000,
            height: 3000,
            format: "jpg".to_string(),
            thumbnail_path: Some("C:\\cache\\thumb1.jpg".to_string()),
            thumbnail_base64: None,
            preview_path: None,
            is_favorite: false,
            used_count: 0,
            is_missing: false,
            created_at: "2026-08-28".to_string(),
            updated_at: "2026-08-28".to_string(),
        };

        let photo2 = PhotoRow {
            id: "photo-2".to_string(),
            project_id: "test-id-1".to_string(),
            file_path: "C:\\photos\\img2.jpg".to_string(),
            file_name: "img2.jpg".to_string(),
            file_size: 2048000,
            width: 4000,
            height: 3000,
            format: "jpg".to_string(),
            thumbnail_path: Some("C:\\cache\\thumb2.jpg".to_string()),
            thumbnail_base64: None,
            preview_path: None,
            is_favorite: false,
            used_count: 0,
            is_missing: false,
            created_at: "2026-08-28".to_string(),
            updated_at: "2026-08-28".to_string(),
        };

        db.add_photo(&photo1).expect("Failed to add photo 1");
        db.add_photo(&photo2).expect("Failed to add photo 2");

        let photos = db.get_photos_for_project("test-id-1").expect("Failed to get photos");
        assert_eq!(photos.len(), 2);
        assert_eq!(db.get_photo_ids().expect("Failed to get photo IDs").len(), 2);

        db.update_photo_preview("photo-1", "C:\\cache\\preview1.jpg")
            .expect("Failed to update photo preview");
        let photo_with_preview = db.get_photo("photo-1").unwrap().unwrap();
        assert_eq!(photo_with_preview.preview_path.as_deref(), Some("C:\\cache\\preview1.jpg"));

        // Test Batch Favorites
        db.batch_toggle_favorites(&["photo-1".to_string(), "photo-2".to_string()], true).expect("Failed batch fav");
        let p1 = db.get_photo("photo-1").unwrap().unwrap();
        let p2 = db.get_photo("photo-2").unwrap().unwrap();
        assert_eq!(p1.is_favorite, true);
        assert_eq!(p2.is_favorite, true);

        // Test Folder Operations
        let folder1 = db.create_folder("folder-1", "test-id-1", "Akad").expect("Failed to create folder");
        assert_eq!(folder1.name, "Akad");

        let folder2 = db.create_folder("folder-2", "test-id-1", "Resepsi").expect("Failed to create folder 2");
        assert_eq!(folder2.name, "Resepsi");

        db.add_photos_to_folder("folder-1", &["photo-1".to_string(), "photo-2".to_string()]).expect("Failed to add to folder");
        let folder1_photos = db.get_photos_for_folder("folder-1").expect("Failed to get folder photos");
        assert_eq!(folder1_photos.len(), 2);

        let folders = db.get_folders_for_project("test-id-1").expect("Failed to get folders");
        assert_eq!(folders.len(), 2);
        assert_eq!(folders[0].photo_count, 2);

        // Move photo-2 from folder 1 to folder 2
        db.move_photos_between_folders("folder-1", "folder-2", &["photo-2".to_string()]).expect("Failed move");
        assert_eq!(db.get_photos_for_folder("folder-1").unwrap().len(), 1);
        assert_eq!(db.get_photos_for_folder("folder-2").unwrap().len(), 1);

        // Rename folder
        db.rename_folder("folder-1", "Akad Nikah").expect("Failed to rename");
        let folders_renamed = db.get_folders_for_project("test-id-1").unwrap();
        assert_eq!(folders_renamed[0].name, "Akad Nikah");

        // Batch Delete
        db.batch_delete_photos(&["photo-1".to_string(), "photo-2".to_string()]).expect("Failed batch delete");
        assert_eq!(db.get_photos_for_project("test-id-1").unwrap().len(), 0);

        // Test Album Structure Persistence (Migration v6)
        let cover_spread = SpreadPayload {
            id: "spread-cover-1".to_string(),
            spread_index: 0,
            r#type: "cover".to_string(),
            name: "Cover Spread".to_string(),
            left_page: Some(PagePayload {
                id: "page-cover-back".to_string(),
                page_number: 0,
                r#type: "cover_back".to_string(),
                width: 8.0,
                height: 8.0,
                unit: "inch".to_string(),
                bleed: 0.125,
                safe_area: 10.0,
                background_color: "#1e293b".to_string(),
                background_type: "solid".to_string(),
            }),
            right_page: Some(PagePayload {
                id: "page-cover-front".to_string(),
                page_number: 1,
                r#type: "cover_front".to_string(),
                width: 8.0,
                height: 8.0,
                unit: "inch".to_string(),
                bleed: 0.125,
                safe_area: 10.0,
                background_color: "#1e293b".to_string(),
                background_type: "solid".to_string(),
            }),
            gutter_width: 0.25,
            gutter_unit: "inch".to_string(),
            bleed: 0.125,
            safe_area: 10.0,
            background_color: "#1e293b".to_string(),
            elements: vec![],
        };

        let interior_spread_1 = SpreadPayload {
            id: "spread-int-1".to_string(),
            spread_index: 1,
            r#type: "interior".to_string(),
            name: "Spread 1 (Pages 1-2)".to_string(),
            left_page: Some(PagePayload {
                id: "page-1".to_string(),
                page_number: 1,
                r#type: "left".to_string(),
                width: 8.0,
                height: 8.0,
                unit: "inch".to_string(),
                bleed: 0.125,
                safe_area: 10.0,
                background_color: "#FFFFFF".to_string(),
                background_type: "solid".to_string(),
            }),
            right_page: Some(PagePayload {
                id: "page-2".to_string(),
                page_number: 2,
                r#type: "right".to_string(),
                width: 8.0,
                height: 8.0,
                unit: "inch".to_string(),
                bleed: 0.125,
                safe_area: 10.0,
                background_color: "#FFFFFF".to_string(),
                background_type: "solid".to_string(),
            }),
            gutter_width: 0.0,
            gutter_unit: "inch".to_string(),
            bleed: 0.125,
            safe_area: 10.0,
            background_color: "#FFFFFF".to_string(),
            elements: vec![
                ElementPayload {
                    id: "frame-1".to_string(),
                    r#type: "photo".to_string(),
                    photo_id: Some("photo-1".to_string()),
                    file_path: "C:\\photos\\img1.jpg".to_string(),
                    file_name: "img1.jpg".to_string(),
                    preview_path: None,
                    thumbnail_path: None,
                    x: 10.0,
                    y: 10.0,
                    width: 50.0,
                    height: 40.0,
                    rotation: 0.0,
                    z_index: 1,
                    photo_aspect: 1.25,
                    group_id: None,
                    original_width: Some(50.0),
                    original_height: Some(40.0),
                    crop_x: 0.0,
                    crop_y: 0.0,
                    crop_scale: 1.0,
                    crop_rotation: Some(0.0),
                    border_enabled: true,
                    border_width: 1.0,
                    border_color: "#FFFFFF".to_string(),
                    opacity: 1.0,
                    locked: Some(false),
                }
            ],
        };

        let album = AlbumPayload {
            id: "album-test-id-1".to_string(),
            project_id: "test-id-1".to_string(),
            cover_spread,
            spreads: vec![interior_spread_1],
            total_spreads: 1,
            total_pages: 2,
        };

        db.save_album_structure(&album).expect("Failed to save album structure");

        let loaded_album = db.load_album_structure("test-id-1").expect("Failed to load album").expect("Album not found");
        assert_eq!(loaded_album.total_spreads, 1);
        assert_eq!(loaded_album.spreads.len(), 1);
        assert_eq!(loaded_album.spreads[0].elements.len(), 1);
        assert_eq!(loaded_album.spreads[0].elements[0].id, "frame-1");
        assert_eq!(loaded_album.spreads[0].elements[0].width, 50.0);
        assert_eq!(loaded_album.spreads[0].elements[0].border_enabled, true);
        assert_eq!(loaded_album.spreads[0].elements[0].locked, Some(false));

        // Test Export & Import .afsn Package
        let afsn_path = temp_dir.join("test_package.afsn");
        db.export_project_package("test-id-1", afsn_path.to_str().unwrap()).expect("Failed export .afsn");
        assert!(afsn_path.exists());

        let imported_pkg = db.import_project_package(afsn_path.to_str().unwrap()).expect("Failed import .afsn");
        assert_eq!(imported_pkg.project.id, "test-id-1");
        assert_eq!(imported_pkg.album.unwrap().spreads.len(), 1);

        // Test Export & Import Standalone Bundle .zip Package (with photos)
        let sample_img_path = temp_dir.join("sample_img.jpg");
        std::fs::write(&sample_img_path, b"fake_jpeg_binary_data").unwrap();
        db.add_photo(&PhotoRow {
            id: "photo-bundle-1".to_string(),
            project_id: "test-id-1".to_string(),
            file_path: sample_img_path.to_string_lossy().to_string(),
            file_name: "sample_img.jpg".to_string(),
            file_size: 21,
            width: 100,
            height: 100,
            format: "jpeg".to_string(),
            thumbnail_path: None,
            thumbnail_base64: None,
            preview_path: None,
            is_favorite: false,
            used_count: 0,
            is_missing: false,
            created_at: "2026-08-29T12:00:00Z".to_string(),
            updated_at: "2026-08-29T12:00:00Z".to_string(),
        }).unwrap();

        let zip_path = temp_dir.join("test_bundle.zip");
        db.export_bundled_project_package("test-id-1", zip_path.to_str().unwrap()).expect("Failed export bundle .zip");
        assert!(zip_path.exists());

        // Test Import from .zip package
        let zip_imported = db.import_project_package(zip_path.to_str().unwrap()).expect("Failed import zip bundle");
        assert_eq!(zip_imported.project.id, "test-id-1");
        assert!(zip_imported.photos.iter().any(|p| p.file_name == "sample_img.jpg"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_batch_photo_insertion() {
        let temp_dir = std::env::temp_dir().join("afsn_test_db_batch");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test_batch.db")).expect("Failed to init DB");

        db.ensure_project_exists("proj-batch", "Batch Test Album").unwrap();
        let folder = db.create_folder("folder-1", "proj-batch", "Portraits").unwrap();

        let photos = vec![
            PhotoRow {
                id: "p-batch-1".to_string(),
                project_id: "proj-batch".to_string(),
                file_path: "/dummy/path1.jpg".to_string(),
                file_name: "path1.jpg".to_string(),
                file_size: 1024,
                width: 1920,
                height: 1080,
                format: "jpg".to_string(),
                thumbnail_path: None,
                thumbnail_base64: None,
                preview_path: None,
                is_favorite: false,
                used_count: 0,
                is_missing: false,
                created_at: "now".to_string(),
                updated_at: "now".to_string(),
            },
            PhotoRow {
                id: "p-batch-2".to_string(),
                project_id: "proj-batch".to_string(),
                file_path: "/dummy/path2.jpg".to_string(),
                file_name: "path2.jpg".to_string(),
                file_size: 2048,
                width: 1920,
                height: 1080,
                format: "jpg".to_string(),
                thumbnail_path: None,
                thumbnail_base64: None,
                preview_path: None,
                is_favorite: false,
                used_count: 0,
                is_missing: false,
                created_at: "now".to_string(),
                updated_at: "now".to_string(),
            },
        ];

        db.add_photos_batch(&photos, Some(&folder.id)).expect("Batch insert failed");

        let project_photos = db.get_photos_for_project("proj-batch").unwrap();
        assert_eq!(project_photos.len(), 2);

        let folder_photos = db.get_photos_for_folder(&folder.id).unwrap();
        assert_eq!(folder_photos.len(), 2);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
