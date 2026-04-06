use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, _event| {
                    // We can match on the shortcut itself if we have multiple, but for one simple toggle:
                    let window = app.get_webview_window("main").unwrap();
                    if window.is_visible().unwrap() {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                })
                .build(),
        )
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // Register Global Shortcut: Option + Space (ALT + Space)
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            let _ = app.global_shortcut().register(shortcut);

            let resource_dir = app.path().resource_dir().unwrap_or_default();
            let prod_binary = resource_dir
                .join("binaries")
                .join("vfinder-backend")
                .join("vfinder-server");

            // Only use the bundled binary in release builds
            #[cfg(not(debug_assertions))]
            {
                if prod_binary.exists() {
                    if let Ok(child) = StdCommand::new(prod_binary)
                        .stdout(std::process::Stdio::inherit())
                        .stderr(std::process::Stdio::inherit())
                        .spawn()
                    {
                        println!("Python backend daemon started via bundled directory.");
                        let state = app.state::<ServerProcess>();
                        *state.0.lock().unwrap() = Some(child);
                        return Ok(());
                    }
                }
            }

            // In debug mode or if bundled binary fails, spawn Python script directly
            println!("Starting Python backend in dev mode...");

            let manifest_dir = env!("CARGO_MANIFEST_DIR");
            let project_dir = std::path::Path::new(manifest_dir)
                .parent()
                .unwrap()
                .parent()
                .unwrap();

            let python_candidates = vec![
                project_dir
                    .join(".venv")
                    .join("bin")
                    .join("python3")
                    .to_str()
                    .unwrap()
                    .to_string(),
                "python3".to_string(),
            ];

            let server_script = project_dir.join("server.py").to_str().unwrap().to_string();

            for python in &python_candidates {
                if let Ok(child) = StdCommand::new(python)
                    .arg(&server_script)
                    .stdout(std::process::Stdio::inherit())
                    .stderr(std::process::Stdio::inherit())
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
