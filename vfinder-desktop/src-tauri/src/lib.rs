use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the Python backend process (dev mode only)
pub struct ServerProcess(pub Mutex<Option<std::process::Child>>);

#[tauri::command]
fn get_server_status() -> String {
    "running".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, shortcut| {
            // We can match on the shortcut itself if we have multiple, but for one simple toggle:
            let window = app.get_webview_window("main").unwrap();
            if window.is_visible().unwrap() {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }).build())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // Register Global Shortcut: Option + Space (ALT + Space)
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, Modifiers, Code};
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            let _ = app.global_shortcut().register(shortcut);

            let resource_dir = app.path().resource_dir().unwrap_or_default();
            let prod_binary = resource_dir.join("binaries").join("vfinder-backend").join("vfinder-server");
            
            // Try to spawn the bundled python backend (production)
            if prod_binary.exists() {
                if let Ok(child) = StdCommand::new(prod_binary).spawn() {
                    println!("Python backend daemon started via bundled directory.");
                    let state = app.state::<ServerProcess>();
                    *state.0.lock().unwrap() = Some(child);
                    return Ok(());
                }
            }

            // Dev mode: fall back to spawning the Python script directly.
            println!("Bundled backend not found, using dev mode...");

            let manifest_dir = env!("CARGO_MANIFEST_DIR");
            let project_dir = manifest_dir.replace("/src-tauri", "");

            let python_candidates = vec![
                format!("{}/.venv/bin/python3", project_dir),
                "python3".to_string(),
            ];

            let server_script = format!("{}/server.py", project_dir);

            for python in &python_candidates {
                if let Ok(child) = StdCommand::new(python)
                    .arg(&server_script)
                    .spawn()
                {
                    println!("Python backend daemon started via: {}", python);
                    let state = app.state::<ServerProcess>();
                    *state.0.lock().unwrap() = Some(child);
                    break;
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_status])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let state = app_handle.state::<ServerProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    println!("Python backend daemon stopped.");
                }
            }
        });
}
