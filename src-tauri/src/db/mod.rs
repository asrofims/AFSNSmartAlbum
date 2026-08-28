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
    pub unit: String,
    pub dpi: i32,
    pub spacing_value: f64,
    pub spacing_unit: String,
    pub margin_enabled: bool,
    pub margin_value: f64,
    pub margin_unit: String,
    pub border_enabled: bool,
    pub border_width_value: f64,
    pub border_width_unit: String,
    pub border_color: String,
    pub background_type: String,
    pub background_color: String,
    pub background_image_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
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

/// Thread-safe wrapper around SQLite connection.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn expected_version() -> i32 {
        5
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
                unit TEXT NOT NULL,
                dpi INTEGER NOT NULL,
                spacing_value REAL NOT NULL,
                spacing_unit TEXT NOT NULL,
                border_enabled INTEGER NOT NULL DEFAULT 0,
                border_width_value REAL NOT NULL DEFAULT 0.0,
                border_width_unit TEXT NOT NULL DEFAULT 'mm',
                border_color TEXT NOT NULL DEFAULT '#000000',
                background_type TEXT NOT NULL DEFAULT 'solid',
                background_color TEXT NOT NULL DEFAULT '#FFFFFF',
                background_image_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at DESC);
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

    pub fn get_schema_version(&self) -> SqliteResult<i32> {
        let conn = self.conn.lock().unwrap();
        let version: i32 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )?;
        Ok(version)
    }

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

    pub fn create_project(
        &self,
        id: &str,
        name: &str,
        canvas_width: f64,
        canvas_height: f64,
        unit: &str,
        dpi: i32,
        spacing_value: f64,
        spacing_unit: &str,
        margin_enabled: bool,
        margin_value: f64,
        margin_unit: &str,
        border_enabled: bool,
        border_width_value: f64,
        border_width_unit: &str,
        border_color: &str,
        background_type: &str,
        background_color: &str,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (
                id, name, canvas_width, canvas_height, unit, dpi,
                spacing_value, spacing_unit,
                margin_enabled, margin_value, margin_unit,
                border_enabled, border_width_value, border_width_unit, border_color,
                background_type, background_color,
                created_at, updated_at, last_opened_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6,
                ?7, ?8,
                ?9, ?10, ?11,
                ?12, ?13, ?14, ?15,
                ?16, ?17,
                datetime('now'), datetime('now'), datetime('now')
            )",
            rusqlite::params![
                id, name, canvas_width, canvas_height, unit, dpi,
                spacing_value, spacing_unit,
                margin_enabled as i32, margin_value, margin_unit,
                border_enabled as i32, border_width_value, border_width_unit, border_color,
                background_type, background_color,
            ],
        )?;
        Ok(())
    }

    pub fn get_project(&self, id: &str) -> SqliteResult<Option<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, unit, dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width_value, border_width_unit, border_color,
                    background_type, background_color, background_image_path,
                    created_at, updated_at, last_opened_at
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
                unit: row.get(4)?,
                dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: margin_enabled_int != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: border_enabled_int != 0,
                border_width_value: row.get(12)?,
                border_width_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                background_image_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                last_opened_at: row.get(20)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_recent_projects(&self, limit: i32) -> SqliteResult<Vec<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, unit, dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width_value, border_width_unit, border_color,
                    background_type, background_color, background_image_path,
                    created_at, updated_at, last_opened_at
             FROM projects
             ORDER BY COALESCE(last_opened_at, updated_at) DESC
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
                unit: row.get(4)?,
                dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: margin_enabled_int != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: border_enabled_int != 0,
                border_width_value: row.get(12)?,
                border_width_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                background_image_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
                last_opened_at: row.get(20)?,
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

    pub fn relink_photo(&self, photo_id: &str, new_path: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE photos SET file_path = ?1, is_missing = 0, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![new_path, photo_id],
        )?;
        Ok(())
    }

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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_crud() {
        let temp_dir = std::env::temp_dir().join("afsn_test_db_v5");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        assert_eq!(db.get_schema_version().unwrap(), 5);

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

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
