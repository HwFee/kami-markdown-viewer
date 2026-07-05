use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDocument {
    pub path: String,
    pub file_name: String,
    pub parent_path: String,
    pub markdown: String,
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

pub fn load_markdown_file(path: &Path) -> Result<LoadedDocument, String> {
    let canonical =
        dunce::canonicalize(path).map_err(|error| format!("Cannot open file: {error}"))?;

    if !canonical.is_file() {
        return Err(format!("Path is not a file: {}", canonical.display()));
    }

    if !is_markdown_extension(&canonical) {
        return Err(format!("Not a Markdown file: {}", canonical.display()));
    }

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

pub fn resolve_local_asset_path(document_path: &Path, asset_src: &str) -> Result<PathBuf, String> {
    if asset_src.starts_with("http://") || asset_src.starts_with("https://") {
        return Ok(PathBuf::from(asset_src));
    }

    let decoded = urlencoding::decode(asset_src)
        .map_err(|error| format!("Invalid asset URL: {error}"))?
        .replace('\\', "/");

    let asset_path = PathBuf::from(decoded);
    let document_dir = document_path
        .parent()
        .ok_or_else(|| "Markdown file has no parent directory".to_string())?;

    let candidate = if asset_path.is_absolute() {
        asset_path
    } else {
        document_dir.join(asset_path)
    };

    let canonical_candidate =
        dunce::canonicalize(candidate).map_err(|error| format!("Cannot resolve asset: {error}"))?;

    let canonical_document_dir = dunce::canonicalize(document_dir)
        .map_err(|error| format!("Cannot canonicalize document directory: {error}"))?;

    if !canonical_candidate.starts_with(&canonical_document_dir) {
        return Err(format!(
            "Asset path escapes the Markdown directory: {}",
            canonical_candidate.display()
        ));
    }

    Ok(canonical_candidate)
}

pub fn resolve_asset_to_data_url(document_path: &Path, asset_src: &str) -> Result<String, String> {
    if asset_src.starts_with("http://")
        || asset_src.starts_with("https://")
        || asset_src.starts_with("data:")
    {
        return Ok(asset_src.to_string());
    }

    let path = resolve_local_asset_path(document_path, asset_src)?;
    let bytes = std::fs::read(&path).map_err(|error| format!("Cannot read asset: {error}"))?;
    let mime = mime_type_for_path(&path);
    let encoded = STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}
