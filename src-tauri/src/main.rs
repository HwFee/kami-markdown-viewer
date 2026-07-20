#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use notify::RecommendedWatcher;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use vellum_lib::document::{self, LoadedDocument};
use vellum_lib::watcher;
use serde_json::json;
use tauri::{Emitter, Manager};

fn first_markdown_arg() -> Option<String> {
    std::env::args_os().skip(1).find_map(|arg| {
        let arg = arg.to_str()?;
        let lower = arg.to_ascii_lowercase();
        (lower.ends_with(".md") || lower.ends_with(".markdown")).then(|| arg.to_string())
    })
}

#[derive(Debug, Clone)]
struct StartupState {
    path: Option<String>,
}

/// Canonicalized path of the currently loaded Markdown document. It is the
/// only trusted anchor for resolving local asset paths, so the frontend can
/// never steer file reads outside the open document's directory.
#[derive(Debug, Default)]
struct AppState {
    current: Mutex<Option<PathBuf>>,
    /// 当前文档的文件监听器。drop 时自动停止监听并结束事件循环线程。
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[tauri::command]
fn get_startup_path(state: tauri::State<StartupState>) -> Option<String> {
    state.path.clone()
}

#[tauri::command]
async fn load_document(
    path: String,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<LoadedDocument, String> {
    let doc = document::load_markdown_file(Path::new(&path))?;
    let canonical = PathBuf::from(&doc.path);

    // 切换文档时重建监听器：先 drop 旧的（停止其线程），再为新路径创建。
    // 监听失败不应阻断文档加载（例如网络盘不支持 notify），仅记录错误。
    {
        let mut watcher_lock = state
            .watcher
            .lock()
            .map_err(|_| "Watcher lock poisoned".to_string())?;
        *watcher_lock = None;
        match watcher::watch_file(app_handle.clone(), canonical.clone()) {
            Ok(w) => *watcher_lock = Some(w),
            Err(e) => eprintln!("file watcher disabled: {e}"),
        }
    }

    let mut current = state
        .current
        .lock()
        .map_err(|_| "Document state lock poisoned".to_string())?;
    *current = Some(canonical);
    Ok(doc)
}

#[tauri::command]
async fn resolve_asset(
    state: tauri::State<'_, AppState>,
    asset_src: String,
) -> Result<String, String> {
    let anchor_dir = {
        let current = state
            .current
            .lock()
            .map_err(|_| "Document state lock poisoned".to_string())?;
        current
            .as_ref()
            .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
            .ok_or_else(|| "No document is loaded".to_string())?
    };
    document::resolve_asset_to_data_url(&anchor_dir, &asset_src)
}

fn main() {
    let startup_path = first_markdown_arg();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(StartupState {
            path: startup_path.clone(),
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            load_document,
            resolve_asset,
            get_startup_path
        ])
        .setup(move |app| {
            if let Some(path) = startup_path.clone() {
                if let Some(window) = app.get_webview_window("main") {
                    window.emit("open-file-from-args", json!({ "path": path }))?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run 素笺");
}
