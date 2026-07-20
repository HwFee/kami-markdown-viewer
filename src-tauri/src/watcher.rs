use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// 防抖静默期：连续文件变更事件在此期间合并为一次重载。
const DEBOUNCE: Duration = Duration::from_millis(400);

/// 启动一个针对单文件变更的监听器，返回的 `RecommendedWatcher` drop 时停止监听
/// 并结束内部事件循环线程。
///
/// 监听父目录而非文件本身，以兼容编辑器的"写临时文件再 rename 覆盖"原子保存
/// （直接 watch 单个文件在 rename 后会丢失监听）。仅当事件路径匹配目标文件时
/// 才触发，避免同目录其他文件变动产生误重载。
pub fn watch_file(app: AppHandle, file_path: PathBuf) -> Result<RecommendedWatcher, String> {
    let parent = file_path
        .parent()
        .ok_or_else(|| "Cannot resolve parent directory for watch".to_string())?
        .to_path_buf();

    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|error| format!("Watcher init failed: {error}"))?;

    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|error| format!("Watch failed: {error}"))?;

    let target = file_path.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // deadline = 最近一次匹配事件 + DEBOUNCE；到期时 emit 一次。
        // 无事件时阻塞在 recv 上（超时设为一个较长值以降低空转）。
        let idle_wait = Duration::from_secs(3600);
        let mut deadline: Option<Instant> = None;

        loop {
            let timeout = match deadline {
                Some(d) => {
                    let now = Instant::now();
                    if d <= now {
                        Duration::ZERO
                    } else {
                        d - now
                    }
                }
                None => idle_wait,
            };

            match rx.recv_timeout(timeout) {
                Ok(Ok(event)) => {
                    if event.paths.iter().any(|p| p == &target) {
                        deadline = Some(Instant::now() + DEBOUNCE);
                    }
                }
                Ok(Err(_)) => continue,
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if let Some(d) = deadline {
                        if d <= Instant::now() {
                            let _ = app_handle.emit("file-changed", ());
                            deadline = None;
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(watcher)
}
