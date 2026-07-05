use std::fs;

use crate::document::{load_markdown_file, resolve_asset_to_data_url, resolve_local_asset_path};

#[test]
fn load_markdown_file_reads_utf8_content() {
    let root = std::env::temp_dir().join("kami_md_viewer_load_test");
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let file = root.join("note.md");
    fs::write(&file, "# 标题\n\n正文").unwrap();

    let doc = load_markdown_file(&file).unwrap();

    assert_eq!(doc.file_name, "note.md");
    assert_eq!(doc.parent_path, root.to_string_lossy());
    assert_eq!(doc.markdown, "# 标题\n\n正文");
}

#[test]
fn load_markdown_file_rejects_non_markdown_files() {
    let root = std::env::temp_dir().join("kami_md_viewer_ext_test");
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let file = root.join("note.txt");
    fs::write(&file, "# Title").unwrap();

    let result = load_markdown_file(&file);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Not a Markdown file"));
}

#[test]
fn resolve_local_asset_path_uses_markdown_parent_directory() {
    let root = std::env::temp_dir().join("kami_md_viewer_asset_test");
    let assets = root.join("assets");
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&assets).unwrap();
    let markdown = root.join("note.md");
    let image = assets.join("demo.gif");
    fs::write(&markdown, "![demo](assets/demo.gif)").unwrap();
    fs::write(&image, b"gif").unwrap();

    let resolved = resolve_local_asset_path(&markdown, "assets/demo.gif").unwrap();

    assert_eq!(resolved, dunce::canonicalize(&image).unwrap());
}

#[test]
fn resolve_local_asset_path_keeps_remote_urls_unchanged() {
    let markdown = std::env::temp_dir().join("note.md");

    let resolved = resolve_local_asset_path(&markdown, "https://example.com/a.png").unwrap();

    assert_eq!(resolved.to_string_lossy(), "https://example.com/a.png");
}

#[test]
fn resolve_local_asset_path_rejects_traversal() {
    let root = std::env::temp_dir().join("kami_md_viewer_traversal_test");
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let markdown = root.join("note.md");
    fs::write(&markdown, "![demo](../secret.png)").unwrap();

    let resolved = resolve_local_asset_path(&markdown, "../secret.png");
    assert!(resolved.is_err());
}

#[test]
fn resolve_local_asset_path_rejects_absolute_outside_directory() {
    let root = std::env::temp_dir().join("kami_md_viewer_absolute_test");
    let outside = std::env::temp_dir().join("kami_md_viewer_outside");
    let _ = fs::remove_dir_all(&root);
    let _ = fs::remove_dir_all(&outside);
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(&outside).unwrap();
    let markdown = root.join("note.md");
    let image = outside.join("secret.png");
    fs::write(&markdown, "![demo](secret.png)").unwrap();
    fs::write(&image, b"png").unwrap();

    let resolved = resolve_local_asset_path(&markdown, image.to_string_lossy().as_ref());
    assert!(resolved.is_err());
}

#[test]
fn resolve_asset_to_data_url_returns_base64_for_local_image() {
    let root = std::env::temp_dir().join("kami_md_viewer_data_url_test");
    let assets = root.join("assets");
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&assets).unwrap();
    let markdown = root.join("note.md");
    let image = assets.join("demo.gif");
    fs::write(&markdown, "![demo](assets/demo.gif)").unwrap();
    fs::write(&image, b"GIF89a").unwrap();

    let resolved = resolve_asset_to_data_url(&markdown, "assets/demo.gif").unwrap();

    assert!(resolved.starts_with("data:image/gif;base64,"));
}

#[test]
fn resolve_asset_to_data_url_keeps_remote_urls_unchanged() {
    let markdown = std::env::temp_dir().join("note.md");

    let resolved = resolve_asset_to_data_url(&markdown, "https://example.com/a.png").unwrap();

    assert_eq!(resolved, "https://example.com/a.png");
}

#[test]
fn resolve_asset_to_data_url_keeps_data_urls_unchanged() {
    let markdown = std::env::temp_dir().join("note.md");

    let resolved = resolve_asset_to_data_url(&markdown, "data:image/png;base64,abc").unwrap();

    assert_eq!(resolved, "data:image/png;base64,abc");
}
