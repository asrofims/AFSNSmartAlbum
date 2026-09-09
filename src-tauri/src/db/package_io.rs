use super::*;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

fn package_error(message: impl std::fmt::Display) -> rusqlite::Error {
    rusqlite::Error::InvalidPath(message.to_string().into())
}

pub(super) fn require_extension(path: &Path, extension: &str) -> SqliteResult<()> {
    if path
        .extension()
        .and_then(|v| v.to_str())
        .is_some_and(|v| v.eq_ignore_ascii_case(extension))
    {
        Ok(())
    } else {
        Err(package_error(if extension == "afsn" {
            "Open and save .afsn project files only. Extract ZIP packages first, then open project.afsn inside the extracted folder."
        } else {
            "Complete packages must use the .zip extension."
        }))
    }
}

/// Stage alongside the destination so rename replaces the file on the same filesystem.
/// Errors before publication leave the existing file untouched.
fn atomic_write(
    path: &Path,
    write: impl FnOnce(&mut File) -> SqliteResult<()>,
) -> SqliteResult<()> {
    if path.is_symlink() {
        return Err(package_error("Cannot overwrite a symbolic link."));
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let temporary = parent.join(format!(".afsn-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .read(true)
            .create_new(true)
            .open(&temporary)
            .map_err(package_error)?;
        write(&mut file)?;
        file.flush().map_err(package_error)?;
        file.sync_all().map_err(package_error)?;
        drop(file);
        fs::rename(&temporary, path).map_err(package_error)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn same_path(a: &str, b: &str) -> bool {
    fn normalized(value: &str) -> PathBuf {
        let path = Path::new(value);
        fs::canonicalize(path).unwrap_or_else(|_| {
            let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
            match (fs::canonicalize(parent), path.file_name()) {
                (Ok(parent), Some(name)) => parent.join(name),
                _ => path.to_path_buf(),
            }
        })
    }
    let (a, b) = (normalized(a), normalized(b));
    if cfg!(windows) {
        a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
    } else { a == b }
}

fn document_id(path: &Path) -> SqliteResult<String> {
    #[derive(Deserialize)]
    struct Identity { id: String }
    #[derive(Deserialize)]
    struct Header { project: Identity }
    let header: Header = serde_json::from_reader(std::io::BufReader::new(
        File::open(path).map_err(package_error)?
    )).map_err(package_error)?;
    if header.project.id.is_empty() {
        return Err(package_error("The project file has no valid identity. Use Save As to choose a destination."));
    }
    Ok(header.project.id)
}

fn detach_file(conn: &Connection, id: &str) -> SqliteResult<()> {
    // Keep all recovery content, including photos and album layouts.
    conn.execute("UPDATE projects SET file_path = NULL WHERE id = ?1", [id])?;
    conn.execute("DELETE FROM project_file_identity WHERE project_id = ?1", [id])?;
    Ok(())
}

fn claim_file(conn: &Connection, owner: &str, path: &str, identity: &str) -> SqliteResult<()> {
    let paths = conn.prepare("SELECT id, file_path FROM projects WHERE id != ?1 AND file_path IS NOT NULL")?
        .query_map([owner], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?
        .collect::<SqliteResult<Vec<_>>>()?;
    for (id, other_path) in paths {
        if same_path(path, &other_path) { detach_file(conn, &id)?; }
    }
    conn.execute("INSERT INTO project_file_identity (project_id, document_id) VALUES (?1, ?2)
        ON CONFLICT(project_id) DO UPDATE SET document_id = excluded.document_id", [owner, identity])?;
    Ok(())
}

fn validate_file_owner(conn: &Connection, project_id: &str, path: &str) -> SqliteResult<()> {
    let (bound_path, expected): (Option<String>, String) = conn.query_row(
        "SELECT p.file_path, COALESCE(f.document_id, p.id) FROM projects p
         LEFT JOIN project_file_identity f ON f.project_id = p.id WHERE p.id = ?1",
        [project_id], |row| Ok((row.get(0)?, row.get(1)?)))?;
    if !bound_path.is_some_and(|p| same_path(&p, path)) || document_id(Path::new(path))? != expected {
        return Err(package_error("This file belongs to another project or has been replaced. Your recovery data is safe. Use Save As to choose a destination."));
    }
    Ok(())
}

fn remap_identity(package: &mut ProjectPackagePayload, id: &str) {
    let fresh = || uuid::Uuid::new_v4().to_string();
    package.project.id = id.to_string();
    let mut photos = HashMap::new();
    let mut folders = HashMap::new();
    let mut groups = HashMap::new();
    for photo in &mut package.photos {
        let new_id = fresh();
        photos.insert(photo.id.clone(), new_id.clone());
        photo.id = new_id;
        photo.project_id = id.to_string();
    }
    for folder in &mut package.folders {
        let new_id = fresh();
        folders.insert(folder.id.clone(), new_id.clone());
        folder.id = new_id;
        folder.project_id = id.to_string();
    }
    for member in &mut package.folder_members {
        if let Some(new_id) = folders.get(&member.folder_id) {
            member.folder_id = new_id.clone();
        }
        if let Some(new_id) = photos.get(&member.photo_id) {
            member.photo_id = new_id.clone();
        }
    }
    if let Some(album) = &mut package.album {
        album.id = format!("album-{}", id);
        album.project_id = id.to_string();
        for spread in std::iter::once(&mut album.cover_spread).chain(album.spreads.iter_mut()) {
            spread.id = fresh();
            for page in [&mut spread.left_page, &mut spread.right_page]
                .into_iter()
                .flatten()
            {
                page.id = fresh();
            }
            for element in &mut spread.elements {
                element.id = fresh();
                if let Some(photo_id) = &element.photo_id {
                    if let Some(new_id) = photos.get(photo_id) {
                        element.photo_id = Some(new_id.clone());
                    }
                }
                if let Some(group) = &mut element.group_id {
                    *group = groups.entry(group.clone()).or_insert_with(fresh).clone();
                }
            }
        }
    }
}

impl Database {
    pub fn validate_project_file(&self, project_id: &str, path: &str) -> SqliteResult<()> {
        validate_file_owner(&self.conn.lock().unwrap(), project_id, path)
    }

    /// Repair legacy/shared destinations without deleting recoverable projects.
    pub fn reconcile_project_files(&self) -> SqliteResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let entries = tx.prepare("SELECT p.id, p.file_path, COALESCE(f.document_id, p.id)
            FROM projects p LEFT JOIN project_file_identity f ON f.project_id = p.id
            WHERE p.file_path IS NOT NULL ORDER BY p.id")?
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)))?
            .collect::<SqliteResult<Vec<_>>>()?;
        let mut owners: Vec<String> = Vec::new();
        for (id, path, expected) in entries {
            // Missing/offline files retain their location; Save still validates them.
            if let Ok(actual) = document_id(Path::new(&path)) {
                if actual != expected || owners.iter().any(|p| same_path(p, &path)) {
                    detach_file(&tx, &id)?;
                } else {
                    owners.push(path);
                }
            }
        }
        tx.commit()
    }

    fn project_package(&self, project_id: &str) -> SqliteResult<ProjectPackagePayload> {
        let project = self
            .get_project(project_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let photos = self.get_photos_for_project(project_id)?;
        let folders = self.get_folders_for_project(project_id)?;
        let album = self.load_album_structure(project_id)?;
        let mut folder_members = Vec::new();
        for folder in &folders {
            for photo in self.get_photos_for_folder(&folder.id)? {
                folder_members.push(FolderMemberPayload {
                    folder_id: folder.id.clone(),
                    photo_id: photo.id,
                });
            }
        }
        Ok(ProjectPackagePayload {
            version: 1,
            project,
            photos,
            folders,
            album,
            folder_members,
        })
    }

    pub fn export_project_package(&self, project_id: &str, target_path: &str) -> SqliteResult<()> {
        self.write_project_package(project_id, target_path, false)
    }

    /// Only call after the user has selected/confirmed the destination in Save As.
    pub fn export_project_package_as(&self, project_id: &str, target_path: &str) -> SqliteResult<()> {
        self.write_project_package(project_id, target_path, true)
    }

    fn write_project_package(&self, project_id: &str, target_path: &str, replace: bool) -> SqliteResult<()> {
        let path = Path::new(target_path);
        require_extension(path, "afsn")?;
        let mut package = self.project_package(project_id)?;
        package.project.file_path = Some(target_path.to_string());
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            package.project.name = stem.to_string();
        }
        let json = serde_json::to_vec_pretty(&package).map_err(package_error)?;
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        if !replace && path.try_exists().map_err(package_error)? {
            validate_file_owner(&tx, project_id, target_path)?;
        }
        claim_file(&tx, project_id, target_path, project_id)?;
        tx.execute("UPDATE projects SET name = ?1, file_path = ?2, updated_at = datetime('now') WHERE id = ?3",
            rusqlite::params![package.project.name, target_path, project_id])?;
        atomic_write(path, |file| file.write_all(&json).map_err(package_error))?;
        tx.commit()?;
        Ok(())
    }

    pub fn export_bundled_project_package(
        &self,
        project_id: &str,
        target_path: &str,
    ) -> SqliteResult<()> {
        let path = Path::new(target_path);
        require_extension(path, "zip")?;
        let mut package = self.project_package(project_id)?;
        // An archive is a transport copy; it must never become the working save path.
        package.project.file_path = None;
        atomic_write(path, |file| {
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            let mut paths = HashMap::new();
            for (index, photo) in package.photos.iter_mut().enumerate() {
                let safe_name = photo
                    .file_name
                    .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
                let entry = format!("photos/{}_{}", index, safe_name);
                let mut original = File::open(&photo.file_path).map_err(|e| {
                    package_error(format!("Cannot package photo '{}': {}", photo.file_path, e))
                })?;
                zip.start_file(&entry, options).map_err(package_error)?;
                std::io::copy(&mut original, &mut zip).map_err(package_error)?;
                paths.insert(photo.file_path.clone(), entry.clone());
                photo.file_path = entry;
                photo.preview_path = None;
                photo.thumbnail_path = None;
                photo.thumbnail_base64 = None;
            }
            if let Some(album) = &mut package.album {
                for spread in
                    std::iter::once(&mut album.cover_spread).chain(album.spreads.iter_mut())
                {
                    for element in &mut spread.elements {
                        if element.r#type == "text" {
                            continue;
                        }
                        // A placed frame can outlive its photo library entry.
                        if !paths.contains_key(&element.file_path) {
                            let safe_name = Path::new(&element.file_path)
                                .file_name()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "photo".into())
                                .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
                            let relative =
                                format!("photos/frame_{}_{}", uuid::Uuid::new_v4(), safe_name);
                            let mut original = File::open(&element.file_path).map_err(|e| {
                                package_error(format!(
                                    "Cannot package placed photo '{}': {}",
                                    element.file_path, e
                                ))
                            })?;
                            zip.start_file(&relative, options).map_err(package_error)?;
                            std::io::copy(&mut original, &mut zip).map_err(package_error)?;
                            paths.insert(element.file_path.clone(), relative);
                        }
                        element.file_path = paths[&element.file_path].clone();
                        element.preview_path = None;
                        element.thumbnail_path = None;
                    }
                }
            }
            zip.start_file("project.afsn", options)
                .map_err(package_error)?;
            let json = serde_json::to_vec_pretty(&package).map_err(package_error)?;
            zip.write_all(&json).map_err(package_error)?;
            zip.finish().map_err(package_error)?;
            Ok(())
        })
    }

    pub fn import_project_package(&self, source_path: &str) -> SqliteResult<ProjectPackagePayload> {
        let path = Path::new(source_path);
        require_extension(path, "afsn")?;
        let canonical = fs::canonicalize(path).map_err(package_error)?;
        let parent = canonical
            .parent()
            .ok_or_else(|| package_error("Project folder is unavailable."))?;
        let json = fs::read_to_string(&canonical).map_err(package_error)?;
        let mut package: ProjectPackagePayload =
            serde_json::from_str(&json).map_err(package_error)?;
        if package.version != 1 {
            return Err(package_error(format!(
                "Unsupported project format version: {}",
                package.version
            )));
        }
        let project_id = &package.project.id;
        if project_id.is_empty()
            || package.photos.iter().any(|p| &p.project_id != project_id)
            || package.folders.iter().any(|f| &f.project_id != project_id)
            || package
                .album
                .as_ref()
                .is_some_and(|a| &a.project_id != project_id)
        {
            return Err(package_error("Invalid project ownership in package."));
        }
        // Resolve extracted photos relative to project.afsn, independent of process cwd.
        let resolve = |value: &str| -> String {
            if value.is_empty() || Path::new(value).is_absolute() {
                value.to_string()
            } else {
                parent.join(value).to_string_lossy().to_string()
            }
        };
        for photo in &mut package.photos {
            photo.file_path = resolve(&photo.file_path);
            photo.is_missing = !Path::new(&photo.file_path).is_file();
            photo.preview_path = photo.preview_path.take().filter(|p| Path::new(p).is_file());
            photo.thumbnail_path = photo
                .thumbnail_path
                .take()
                .filter(|p| Path::new(p).is_file());
        }
        if let Some(album) = &mut package.album {
            for spread in std::iter::once(&mut album.cover_spread).chain(album.spreads.iter_mut()) {
                for element in &mut spread.elements {
                    if element.r#type != "text" {
                        element.file_path = resolve(&element.file_path);
                        element.preview_path = element
                            .preview_path
                            .take()
                            .filter(|p| Path::new(p).is_file());
                        element.thumbnail_path = element
                            .thumbnail_path
                            .take()
                            .filter(|p| Path::new(p).is_file());
                    }
                }
            }
        }
        let file_identity = package.project.id.clone();
        // Reopening a copied document must reuse its local identity until its first Save.
        let known_copy = {
            let conn = self.conn.lock().unwrap();
            let entries = conn.prepare("SELECT p.id, p.file_path FROM projects p
                JOIN project_file_identity f ON f.project_id = p.id
                WHERE f.document_id = ?1 AND p.file_path IS NOT NULL")?
                .query_map([&file_identity], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
                .collect::<SqliteResult<Vec<_>>>()?;
            entries.into_iter().find(|(_, p)| same_path(p, source_path)).map(|(id, _)| id)
        };
        if let Some(id) = known_copy.filter(|id| id != &package.project.id) {
            remap_identity(&mut package, &id);
        } else if let Some(existing) = self.get_project(&package.project.id)? {
            if !existing
                .file_path
                .as_deref()
                .is_some_and(|p| same_path(p, source_path))
            {
                remap_identity(&mut package, &uuid::Uuid::new_v4().to_string());
            }
        }
        package.project.file_path = Some(canonical.to_string_lossy().to_string());
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            package.project.name = stem.to_string();
        }
        self.store_project_package_with_identity(&package, Some(&file_identity))?;
        Ok(package)
    }

    /// Import the whole project or leave the prior database state untouched.
    fn store_project_package(&self, package: &ProjectPackagePayload) -> SqliteResult<()> {
        self.store_project_package_with_identity(package, None)
    }

    fn store_project_package_with_identity(&self, package: &ProjectPackagePayload, file_identity: Option<&str>) -> SqliteResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let p = &package.project;
        tx.execute(
            "INSERT INTO projects (
                    id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                    spacing_value, spacing_unit,
                    margin_enabled, margin_value, margin_unit,
                    margin_top, margin_bottom, margin_outside, margin_spine,
                    border_enabled, border_width, border_unit, border_color,
                    background_type, background_color, file_path,
                    created_at, updated_at
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6,
                    ?7, ?8,
                    ?9, ?10, ?11,
                    ?12, ?13, ?14, ?15,
                    ?16, ?17, ?18, ?19,
                    ?20, ?21, ?22,
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
                    margin_top = excluded.margin_top,
                    margin_bottom = excluded.margin_bottom,
                    margin_outside = excluded.margin_outside,
                    margin_spine = excluded.margin_spine,
                    border_enabled = excluded.border_enabled,
                    border_width = excluded.border_width,
                    border_unit = excluded.border_unit,
                    border_color = excluded.border_color,
                    background_type = excluded.background_type,
                    background_color = excluded.background_color,
                    file_path = excluded.file_path,
                    updated_at = datetime('now')",
            rusqlite::params![
                p.id,
                p.name,
                p.canvas_width,
                p.canvas_height,
                p.canvas_unit,
                p.canvas_dpi,
                p.spacing_value,
                p.spacing_unit,
                p.margin_enabled as i32,
                p.margin_value,
                p.margin_unit,
                p.margin_top.unwrap_or(p.margin_value),
                p.margin_bottom.unwrap_or(p.margin_value),
                p.margin_outside.unwrap_or(p.margin_value),
                p.margin_spine.unwrap_or(p.margin_value),
                p.border_enabled as i32,
                p.border_width,
                p.border_unit,
                p.border_color,
                p.background_type,
                p.background_color,
                p.file_path,
            ],
        )?;
        if let (Some(path), Some(identity)) = (&p.file_path, file_identity) {
            claim_file(&tx, &p.id, path, identity)?;
        }
        tx.execute("DELETE FROM album_spreads WHERE project_id = ?1", [&p.id])?;
        tx.execute("DELETE FROM photo_folders WHERE project_id = ?1", [&p.id])?;
        tx.execute("DELETE FROM photos WHERE project_id = ?1", [&p.id])?;
        for photo in &package.photos {
            Self::insert_photo(&tx, photo)?;
        }
        for folder in &package.folders {
            tx.execute("INSERT INTO photo_folders (id, project_id, name, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
                rusqlite::params![folder.id, folder.project_id, folder.name, folder.sort_order])?;
        }
        for member in &package.folder_members {
            if !package.folders.iter().any(|f| f.id == member.folder_id)
                || !package.photos.iter().any(|p| p.id == member.photo_id)
            {
                return Err(package_error("Invalid photo folder membership in package."));
            }
            tx.execute("INSERT INTO photo_folder_members (folder_id, photo_id, created_at) VALUES (?1, ?2, datetime('now'))",
                rusqlite::params![member.folder_id, member.photo_id])?;
        }
        if let Some(album) = &package.album {
            Self::save_album_in_transaction(&tx, album)?;
        }
        tx.commit()
    }

    pub fn duplicate_project(
        &self,
        source_id: &str,
        new_id: &str,
        new_name: &str,
        new_file_path: &str,
    ) -> SqliteResult<ProjectRow> {
        if self.get_project(new_id)?.is_some() {
            return Err(package_error(
                "A project with this identity already exists.",
            ));
        }
        let mut package = self.project_package(source_id)?;
        remap_identity(&mut package, new_id);
        package.project.name = new_name.to_string();
        package.project.file_path = if new_file_path.is_empty() {
            None
        } else {
            Some(new_file_path.to_string())
        };
        self.store_project_package(&package)?;
        self.get_project(new_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn save_project_as(&self, source_id: &str, target_path: &str) -> SqliteResult<ProjectRow> {
        require_extension(Path::new(target_path), "afsn")?;
        let source = self
            .get_project(source_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        if source
            .file_path
            .as_deref()
            .is_some_and(|p| same_path(p, target_path))
        {
            self.export_project_package_as(source_id, target_path)?;
            return self
                .get_project(source_id)?
                .ok_or(rusqlite::Error::QueryReturnedNoRows);
        }
        let id = uuid::Uuid::new_v4().to_string();
        self.duplicate_project(source_id, &id, &source.name, "")?;
        if let Err(error) = self.export_project_package_as(&id, target_path) {
            self.delete_project(&id)?;
            return Err(error);
        }
        self.get_project(&id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (Database, PathBuf) {
        let root = std::env::temp_dir().join(format!("afsn-package-test-{}", uuid::Uuid::new_v4()));
        let db = Database::init(root.join("test.db")).unwrap();
        db.ensure_project_exists("source", "Source").unwrap();
        fs::write(root.join("photo.jpg"), b"original photo bytes").unwrap();
        let photo: PhotoRow = serde_json::from_value(serde_json::json!({
            "id":"photo", "projectId":"source", "filePath":root.join("photo.jpg").to_string_lossy(),
            "fileName":"photo.jpg", "fileSize":20, "width":10, "height":10, "format":"jpg",
            "isFavorite":true, "usedCount":0, "isMissing":false, "createdAt":"now", "updatedAt":"now"
        })).unwrap();
        db.add_photo(&photo).unwrap();
        db.create_folder("folder", "source", "Portraits").unwrap();
        db.add_photos_to_folder("folder", &["photo".into()])
            .unwrap();
        (db, root)
    }

    #[test]
    fn extracted_package_edit_save_preserves_zip_and_photos() {
        let (db, root) = fixture();
        let afsn = root.join("source.afsn");
        db.export_project_package("source", afsn.to_str().unwrap())
            .unwrap();
        let zip = root.join("bundle.zip");
        db.export_bundled_project_package("source", zip.to_str().unwrap())
            .unwrap();
        let archive_bytes = fs::read(&zip).unwrap();
        assert!(db.import_project_package(zip.to_str().unwrap()).is_err());
        assert!(db
            .export_project_package("source", zip.to_str().unwrap())
            .is_err());
        let destination = root.join("extracted");
        zip::ZipArchive::new(File::open(&zip).unwrap())
            .unwrap()
            .extract(&destination)
            .unwrap();
        let project_file = destination.join("project.afsn");
        let opened = db
            .import_project_package(project_file.to_str().unwrap())
            .unwrap();
        assert_ne!(
            opened.project.id, "source",
            "opening another copy must not replace the original workspace"
        );
        let photo = &opened.photos[0];
        assert_eq!(fs::read(&photo.file_path).unwrap(), b"original photo bytes");
        assert_eq!(
            db.get_photos_for_folder(&opened.folders[0].id)
                .unwrap()
                .len(),
            1
        );
        db.rename_folder(&opened.folders[0].id, "Edited collection")
            .unwrap();
        db.export_project_package(&opened.project.id, project_file.to_str().unwrap())
            .unwrap();
        let reopened = db
            .import_project_package(project_file.to_str().unwrap())
            .unwrap();
        assert_eq!(reopened.project.id, opened.project.id);
        assert_eq!(reopened.folders[0].name, "Edited collection");
        assert_eq!(
            fs::read(&zip).unwrap(),
            archive_bytes,
            "saving must never modify the transport archive"
        );
        assert_eq!(
            db.get_folders_for_project("source").unwrap()[0].name,
            "Portraits"
        );
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_write_preserves_existing_file_and_cleans_temporary() {
        let root = std::env::temp_dir().join(format!("afsn-atomic-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("project.afsn");
        fs::write(&path, b"previous valid file").unwrap();
        let result = atomic_write(&path, |file| {
            file.write_all(b"incomplete data").unwrap();
            Err(package_error("simulated disk full"))
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&path).unwrap(), b"previous valid file");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        atomic_write(&path, |file| {
            file.write_all(b"new complete file").map_err(package_error)
        })
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new complete file");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_photo_cannot_replace_a_complete_archive() {
        let (db, root) = fixture();
        let zip = root.join("complete.zip");
        db.export_bundled_project_package("source", zip.to_str().unwrap())
            .unwrap();
        let original = fs::read(&zip).unwrap();
        fs::remove_file(root.join("photo.jpg")).unwrap();
        assert!(db
            .export_bundled_project_package("source", zip.to_str().unwrap())
            .is_err());
        assert_eq!(fs::read(&zip).unwrap(), original);
        assert_eq!(db.get_project("source").unwrap().unwrap().file_path, None);
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn import_rolls_back_on_invalid_membership_and_rejects_future_formats() {
        let (db, root) = fixture();
        let path = root.join("source.afsn");
        db.export_project_package("source", path.to_str().unwrap())
            .unwrap();
        let mut package = db.project_package("source").unwrap();
        package.project.name = "Must roll back".into();
        package.folder_members.push(FolderMemberPayload {
            folder_id: "folder".into(),
            photo_id: "missing".into(),
        });
        assert!(db.store_project_package(&package).is_err());
        assert_eq!(db.get_project("source").unwrap().unwrap().name, "source");
        assert_eq!(db.get_photos_for_folder("folder").unwrap().len(), 1);
        package.version = 999;
        fs::write(&path, serde_json::to_vec(&package).unwrap()).unwrap();
        assert!(db.import_project_package(path.to_str().unwrap()).is_err());
        assert_eq!(db.get_project("source").unwrap().unwrap().name, "source");
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn save_as_same_path_and_failed_destination_preserve_identity() {
        let (db, root) = fixture();
        let source = root.join("source.afsn");
        db.export_project_package("source", source.to_str().unwrap())
            .unwrap();
        let same = db
            .save_project_as("source", source.to_str().unwrap())
            .unwrap();
        assert_eq!(same.id, "source");
        let before = db.list_recent_projects(100).unwrap().len();
        assert!(db
            .save_project_as(
                "source",
                root.join("missing-dir/copy.afsn").to_str().unwrap()
            )
            .is_err());
        assert_eq!(db.list_recent_projects(100).unwrap().len(), before);
        let copy_path = root.join("copy.afsn");
        let copy = db
            .save_project_as("source", copy_path.to_str().unwrap())
            .unwrap();
        assert_ne!(copy.id, "source");
        assert_eq!(copy.name, "copy");
        let folder = &db.get_folders_for_project(&copy.id).unwrap()[0];
        assert_eq!(db.get_photos_for_folder(&folder.id).unwrap().len(), 1);
        assert_eq!(
            db.get_project("source")
                .unwrap()
                .unwrap()
                .file_path
                .as_deref(),
            source.to_str()
        );
        let old_path = db.get_project("source").unwrap().unwrap().file_path;
        assert!(db
            .export_project_package("source", root.join("missing/new.afsn").to_str().unwrap())
            .is_err());
        assert_eq!(
            db.get_project("source").unwrap().unwrap().file_path,
            old_path
        );
        drop(db);
        fs::remove_dir_all(root).unwrap();
    }
}
