use std::fs;
use std::path::PathBuf;

use crate::document::{
    load_markdown_file, resolve_asset_to_data_url, resolve_local_asset_path, AssetRef,
};

/// Removes the temporary test directory when the test ends, even on panic.
struct TestDir(PathBuf);

impl TestDir {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TestDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn load_markdown_file_reads_utf8_content() {
    let root = TestDir::new("kami_md_viewer_load_test");
    let file = root.path().join("note.md");
    fs::write(&file, "# 标题\n\n正文").unwrap();

    let doc = load_markdown_file(&file).unwrap();

    assert_eq!(doc.file_name, "note.md");
    assert_eq!(doc.parent_path, root.path().to_string_lossy());
    assert_eq!(doc.markdown, "# 标题\n\n正文");
}

#[test]
fn load_markdown_file_accepts_uppercase_extension() {
    let root = TestDir::new("kami_md_viewer_upper_ext_test");
    let file = root.path().join("NOTE.MD");
    fs::write(&file, "# Upper").unwrap();

    let doc = load_markdown_file(&file).unwrap();

    assert_eq!(doc.file_name, "NOTE.MD");
    assert_eq!(doc.markdown, "# Upper");
}

#[test]
fn load_markdown_file_rejects_non_markdown_files() {
    let root = TestDir::new("kami_md_viewer_ext_test");
    let file = root.path().join("note.txt");
    fs::write(&file, "# Title").unwrap();

    let result = load_markdown_file(&file);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Not a Markdown file"));
}

#[test]
fn load_markdown_file_rejects_missing_file() {
    let root = TestDir::new("kami_md_viewer_missing_test");
    let file = root.path().join("does-not-exist.md");

    let result = load_markdown_file(&file);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Cannot open file"));
}

#[test]
fn load_markdown_file_rejects_non_utf8_content() {
    let root = TestDir::new("kami_md_viewer_non_utf8_test");
    let file = root.path().join("binary.md");
    fs::write(&file, [0xff, 0xfe, 0x00, 0x01]).unwrap();

    let result = load_markdown_file(&file);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Cannot read UTF-8 Markdown"));
}

#[test]
fn resolve_local_asset_path_uses_anchor_directory() {
    let root = TestDir::new("kami_md_viewer_asset_test");
    let assets = root.path().join("assets");
    fs::create_dir_all(&assets).unwrap();
    let image = assets.join("demo.gif");
    fs::write(&image, b"gif").unwrap();

    let resolved = resolve_local_asset_path(root.path(), "assets/demo.gif").unwrap();

    assert_eq!(
        resolved,
        AssetRef::Local(dunce::canonicalize(&image).unwrap())
    );
}

#[test]
fn resolve_local_asset_path_keeps_remote_urls_unchanged() {
    let anchor = std::env::temp_dir();

    let resolved = resolve_local_asset_path(&anchor, "https://example.com/a.png").unwrap();

    assert_eq!(
        resolved,
        AssetRef::Remote("https://example.com/a.png".to_string())
    );
}

#[test]
fn resolve_local_asset_path_rejects_traversal() {
    let root = TestDir::new("kami_md_viewer_traversal_test");
    let docs = root.path().join("docs");
    fs::create_dir_all(&docs).unwrap();
    let markdown = docs.join("note.md");
    let secret = root.path().join("secret.png");
    fs::write(&markdown, "![demo](../secret.png)").unwrap();
    fs::write(&secret, b"png").unwrap();

    // `../secret.png` really exists, so canonicalize succeeds and only the
    // containment check can reject it.
    let resolved = resolve_local_asset_path(&docs, "../secret.png");
    assert!(resolved.is_err());
    assert!(resolved
        .unwrap_err()
        .contains("escapes the Markdown directory"));
}

#[test]
fn resolve_local_asset_path_rejects_percent_encoded_traversal() {
    let root = TestDir::new("kami_md_viewer_pct_traversal_test");
    let docs = root.path().join("docs");
    fs::create_dir_all(&docs).unwrap();
    let secret = root.path().join("secret.png");
    fs::write(&secret, b"png").unwrap();

    let resolved = resolve_local_asset_path(&docs, "..%2Fsecret.png");
    assert!(resolved.is_err());
    assert!(resolved
        .unwrap_err()
        .contains("escapes the Markdown directory"));
}

#[test]
fn resolve_local_asset_path_rejects_absolute_outside_directory() {
    let root = TestDir::new("kami_md_viewer_absolute_test");
    let outside = TestDir::new("kami_md_viewer_outside");
    let image = outside.path().join("secret.png");
    fs::write(&image, b"png").unwrap();

    let resolved = resolve_local_asset_path(root.path(), image.to_string_lossy().as_ref());
    assert!(resolved.is_err());
}

#[test]
fn resolve_asset_to_data_url_returns_base64_for_local_image() {
    let root = TestDir::new("kami_md_viewer_data_url_test");
    let assets = root.path().join("assets");
    fs::create_dir_all(&assets).unwrap();
    let image = assets.join("demo.gif");
    fs::write(&image, b"GIF89a").unwrap();

    let resolved = resolve_asset_to_data_url(root.path(), "assets/demo.gif").unwrap();

    assert!(resolved.starts_with("data:image/gif;base64,"));
}

#[test]
fn resolve_asset_to_data_url_keeps_remote_urls_unchanged() {
    let anchor = std::env::temp_dir();

    let resolved = resolve_asset_to_data_url(&anchor, "https://example.com/a.png").unwrap();

    assert_eq!(resolved, "https://example.com/a.png");
}

#[test]
fn resolve_asset_to_data_url_keeps_data_urls_unchanged() {
    let anchor = std::env::temp_dir();

    let resolved = resolve_asset_to_data_url(&anchor, "data:image/png;base64,abc").unwrap();

    assert_eq!(resolved, "data:image/png;base64,abc");
}
