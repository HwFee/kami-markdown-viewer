use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

const MAX_FILE_SIZE_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDocument {
    pub path: String,
    pub file_name: String,
    pub parent_path: String,
    pub markdown: String,
}

/// Result of resolving an asset source: either a local file to inline, or a
/// remote/data URL the webview can load directly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AssetRef {
    Local(PathBuf),
    Remote(String),
}

fn is_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_ascii_lowercase();
            ext == "md" || ext == "markdown"
        })
        .unwrap_or(false)
}

fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn check_file_size(path: &Path) -> Result<(), String> {
    let size = std::fs::metadata(path)
        .map_err(|error| format!("Cannot read file metadata: {error}"))?
        .len();
    if size > MAX_FILE_SIZE_BYTES {
        return Err(format!("file too large: {size} bytes (max 50 MB)"));
    }
    Ok(())
}

pub fn load_markdown_file(path: &Path) -> Result<LoadedDocument, String> {
    let canonical =
        dunce::canonicalize(path).map_err(|error| format!("Cannot open file: {error}"))?;

    if !canonical.is_file() {
        return Err(format!("Path is not a file: {}", canonical.display()));
    }

    if !is_markdown_extension(&canonical) {
        return Err(format!("Not a Markdown file: {}", canonical.display()));
    }

    check_file_size(&canonical)?;

    let markdown = std::fs::read_to_string(&canonical)
        .map_err(|error| format!("Cannot read UTF-8 Markdown: {error}"))?;

    let file_name = canonical
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled.md")
        .to_string();

    let parent_path = canonical
        .parent()
        .map(|parent| parent.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(LoadedDocument {
        path: canonical.to_string_lossy().to_string(),
        file_name,
        parent_path,
        markdown,
    })
}

/// Resolve an asset source against the directory that anchors local paths
/// (the loaded document's parent directory). `http:`, `https:` and `data:`
/// sources are classified as `Remote`; everything else must stay inside the
/// anchor directory.
pub fn resolve_local_asset_path(anchor_dir: &Path, asset_src: &str) -> Result<AssetRef, String> {
    if asset_src.starts_with("http://")
        || asset_src.starts_with("https://")
        || asset_src.starts_with("data:")
    {
        return Ok(AssetRef::Remote(asset_src.to_string()));
    }

    let decoded = urlencoding::decode(asset_src)
        .map_err(|error| format!("Invalid asset URL: {error}"))?
        .replace('\\', "/");

    let asset_path = PathBuf::from(decoded);

    let candidate = if asset_path.is_absolute() {
        asset_path
    } else {
        anchor_dir.join(asset_path)
    };

    let canonical_candidate =
        dunce::canonicalize(candidate).map_err(|error| format!("Cannot resolve asset: {error}"))?;

    let canonical_anchor_dir = dunce::canonicalize(anchor_dir)
        .map_err(|error| format!("Cannot canonicalize anchor directory: {error}"))?;

    if !canonical_candidate.starts_with(&canonical_anchor_dir) {
        return Err(format!(
            "Asset path escapes the Markdown directory: {}",
            canonical_candidate.display()
        ));
    }

    Ok(AssetRef::Local(canonical_candidate))
}

pub fn resolve_asset_to_data_url(anchor_dir: &Path, asset_src: &str) -> Result<String, String> {
    match resolve_local_asset_path(anchor_dir, asset_src)? {
        AssetRef::Remote(url) => Ok(url),
        AssetRef::Local(path) => {
            check_file_size(&path)?;
            let bytes =
                std::fs::read(&path).map_err(|error| format!("Cannot read asset: {error}"))?;
            let mime = mime_type_for_path(&path);
            let encoded = STANDARD.encode(&bytes);
            Ok(format!("data:{mime};base64,{encoded}"))
        }
    }
}
