use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;

/// Current database schema version.
/// Increment this when making schema changes, and add corresponding migrations.
const SCHEMA_VERSION: i32 = 4;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

/// Thread-safe wrapper around SQLite connection.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
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

        Ok(())
    }

    /// Schema version 1: Initial schema with settings table.
    fn migrate_v1(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            -- Application settings key-value store
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            -- Insert default settings
            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('app.theme', 'dark'),
                ('app.language', 'en'),
                ('app.recent_projects', '[]');

            -- Record schema version
            INSERT INTO schema_version (version) VALUES (1);

            COMMIT;"
        )?;

        log::info!("Applied database migration v1");
        Ok(())
    }

    /// Schema version 2: Add projects table.
    fn migrate_v2(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                canvas_width REAL NOT NULL,
                canvas_height REAL NOT NULL,
                canvas_unit TEXT NOT NULL DEFAULT 'mm',
                canvas_dpi INTEGER NOT NULL DEFAULT 300,
                spacing_value REAL NOT NULL DEFAULT 3.0,
                spacing_unit TEXT NOT NULL DEFAULT 'mm',
                border_enabled INTEGER NOT NULL DEFAULT 0,
                border_width REAL NOT NULL DEFAULT 1.0,
                border_unit TEXT NOT NULL DEFAULT 'mm',
                border_color TEXT NOT NULL DEFAULT '#FFFFFF',
                background_type TEXT NOT NULL DEFAULT 'solid',
                background_color TEXT NOT NULL DEFAULT '#FFFFFF',
                file_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            INSERT INTO schema_version (version) VALUES (2);

            COMMIT;"
        )?;
        log::info!("Applied database migration v2");
        Ok(())
    }

    /// Schema version 3: Add margin columns to projects table.
    fn migrate_v3(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            ALTER TABLE projects ADD COLUMN margin_enabled INTEGER NOT NULL DEFAULT 1;
            ALTER TABLE projects ADD COLUMN margin_value REAL NOT NULL DEFAULT 10.0;
            ALTER TABLE projects ADD COLUMN margin_unit TEXT NOT NULL DEFAULT 'mm';

            INSERT INTO schema_version (version) VALUES (3);

            COMMIT;"
        )?;
        log::info!("Applied database migration v3: safe margin support");
        Ok(())
    }

    /// Schema version 4: Add photos table for project photo library.
    fn migrate_v4(conn: &Connection) -> SqliteResult<()> {
        conn.execute_batch(
            "BEGIN;

            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY NOT NULL,
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

            INSERT INTO schema_version (version) VALUES (4);

            COMMIT;"
        )?;
        log::info!("Applied database migration v4: photos table");
        Ok(())
    }

    /// Get the current schema version.
    pub fn get_schema_version(&self) -> SqliteResult<i32> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
    }

    /// Get a setting value by key.
    pub fn get_setting(&self, key: &str) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Set a setting value.
    pub fn set_setting(&self, key: &str, value: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
            [key, value],
        )?;
        Ok(())
    }

    /// Get the expected schema version constant.
    pub fn expected_version() -> i32 {
        SCHEMA_VERSION
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
                spacing_value, spacing_unit, margin_enabled, margin_value, margin_unit,
                border_enabled, border_width, border_unit, border_color,
                background_type, background_color
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                spacing_value, spacing_unit, margin_enabled as i32, margin_value, margin_unit,
                border_enabled as i32, border_width, border_unit, border_color,
                background_type, background_color
            ],
        )?;
        Ok(())
    }

    pub fn get_project(&self, id: &str) -> SqliteResult<Option<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit, margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path, created_at, updated_at
             FROM projects WHERE id = ?1"
        )?;
        let result = stmt.query_row([id], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                canvas_width: row.get(2)?,
                canvas_height: row.get(3)?,
                canvas_unit: row.get(4)?,
                canvas_dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: row.get::<_, i32>(8)? != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: row.get::<_, i32>(11)? != 0,
                border_width: row.get(12)?,
                border_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                file_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            })
        });
        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn list_recent_projects(&self, limit: i32) -> SqliteResult<Vec<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit, margin_enabled, margin_value, margin_unit,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path, created_at, updated_at
             FROM projects ORDER BY updated_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map([limit], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                canvas_width: row.get(2)?,
                canvas_height: row.get(3)?,
                canvas_unit: row.get(4)?,
                canvas_dpi: row.get(5)?,
                spacing_value: row.get(6)?,
                spacing_unit: row.get(7)?,
                margin_enabled: row.get::<_, i32>(8)? != 0,
                margin_value: row.get(9)?,
                margin_unit: row.get(10)?,
                border_enabled: row.get::<_, i32>(11)? != 0,
                border_width: row.get(12)?,
                border_unit: row.get(13)?,
                border_color: row.get(14)?,
                background_type: row.get(15)?,
                background_color: row.get(16)?,
                file_path: row.get(17)?,
                created_at: row.get(18)?,
                updated_at: row.get(19)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn delete_project(&self, id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
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
                id, project_id, file_path, file_name, file_size, width, height, format,
                thumbnail_path, thumbnail_base64, preview_path, is_favorite, used_count, is_missing
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
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
            "SELECT id, project_id, file_path, file_name, file_size, width, height, format,
                    thumbnail_path, thumbnail_base64, preview_path, is_favorite, used_count,
                    is_missing, created_at, updated_at
             FROM photos WHERE project_id = ?1 ORDER BY file_name ASC"
        )?;
        let rows = stmt.query_map([project_id], |row| {
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
                is_favorite: row.get::<_, i32>(11)? != 0,
                used_count: row.get(12)?,
                is_missing: row.get::<_, i32>(13)? != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn get_photo(&self, photo_id: &str) -> SqliteResult<Option<PhotoRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, file_path, file_name, file_size, width, height, format,
                    thumbnail_path, thumbnail_base64, preview_path, is_favorite, used_count,
                    is_missing, created_at, updated_at
             FROM photos WHERE id = ?1"
        )?;
        let result = stmt.query_row([photo_id], |row| {
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
                is_favorite: row.get::<_, i32>(11)? != 0,
                used_count: row.get(12)?,
                is_missing: row.get::<_, i32>(13)? != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        });
        match result {
            Ok(photo) => Ok(Some(photo)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_crud() {
        let temp_dir = std::env::temp_dir().join("afsn_test_db_v4");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        assert_eq!(db.get_schema_version().unwrap(), 4);

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
        let photo = PhotoRow {
            id: "photo-1".to_string(),
            project_id: "test-id-1".to_string(),
            file_path: "C:\\photos\\img1.jpg".to_string(),
            file_name: "img1.jpg".to_string(),
            file_size: 1024000,
            width: 4000,
            height: 3000,
            format: "jpg".to_string(),
            thumbnail_path: Some("C:\\cache\\thumb.jpg".to_string()),
            thumbnail_base64: None,
            preview_path: None,
            is_favorite: false,
            used_count: 0,
            is_missing: false,
            created_at: "2026-08-28".to_string(),
            updated_at: "2026-08-28".to_string(),
        };

        db.add_photo(&photo).expect("Failed to add photo");
        let photos = db.get_photos_for_project("test-id-1").expect("Failed to get photos");
        assert_eq!(photos.len(), 1);
        assert_eq!(photos[0].file_name, "img1.jpg");
        assert_eq!(photos[0].width, 4000);

        db.toggle_photo_favorite("photo-1", true).expect("Failed to toggle favorite");
        let updated_photo = db.get_photo("photo-1").unwrap().expect("Photo not found");
        assert_eq!(updated_photo.is_favorite, true);

        db.delete_photo("photo-1").expect("Failed to delete photo");
        let photos_after = db.get_photos_for_project("test-id-1").expect("Failed to get photos");
        assert_eq!(photos_after.len(), 0);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
