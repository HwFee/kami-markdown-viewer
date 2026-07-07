#![cfg_attr(not(test), windows_subsystem = "windows")]

use std::path::Path;

use kami_markdown_viewer_lib::document::{self, LoadedDocument};
use serde_json::json;
use tauri::{Emitter, Manager};

#[cfg(windows)]
mod webview_scrollbar {
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_SCROLLBAR_STYLE_DEFAULT;
    use webview2_com::CoreWebView2EnvironmentOptions;

    pub fn create_environment_options_with_classic_scrollbar() {
        let options = CoreWebView2EnvironmentOptions::default();
        unsafe {
            options.set_scroll_bar_style(COREWEBVIEW2_SCROLLBAR_STYLE_DEFAULT);
        }
    }
}

fn first_markdown_arg() -> Option<String> {
    std::env::args().skip(1).find(|arg| {
        let lower = arg.to_ascii_lowercase();
        lower.ends_with(".md") || lower.ends_with(".markdown")
    })
}

#[derive(Debug, Clone)]
struct StartupState {
    path: Option<String>,
}

#[tauri::command]
fn get_startup_path(state: tauri::State<StartupState>) -> Option<String> {
    state.path.clone()
}

#[tauri::command]
fn load_document(path: String) -> Result<LoadedDocument, String> {
    document::load_markdown_file(Path::new(&path))
}

#[tauri::command]
fn resolve_asset(document_path: String, asset_src: String) -> Result<String, String> {
    document::resolve_asset_to_data_url(Path::new(&document_path), &asset_src)
}

fn main() {
    let startup_path = first_markdown_arg();

    #[cfg(windows)]
    webview_scrollbar::create_environment_options_with_classic_scrollbar();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(StartupState {
            path: startup_path.clone(),
        })
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
        .expect("failed to run Kami Markdown Viewer");
}
