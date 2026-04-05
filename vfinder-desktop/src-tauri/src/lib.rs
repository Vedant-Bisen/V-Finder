use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

/// Holds the Python backend process so we can kill it on exit
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
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            // Try to spawn the sidecar binary (production mode)
            // If it doesn't exist, fall back to the Python script (dev mode)
            let child = match app.shell().sidecar("vfinder-server") {
                Ok(sidecar_cmd) => {
                    match sidecar_cmd.spawn() {
                        Ok((_, child)) => {
                            println!("VFinder server started via sidecar.");
                            Some(child)
                        }
                        Err(e) => {
                            println!("Sidecar spawn failed: {}, trying dev mode...", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    println!("Sidecar not found: {}, trying dev mode...", e);
                    None
                }
            };

            // Dev mode fallback: try spawning python directly
            let child = if child.is_none() {
                // Try common Python locations
                let python_candidates = vec![
                    // Project venv (dev mode)
                    format!("{}/.venv/bin/python3", env!("CARGO_MANIFEST_DIR").replace("/src-tauri", "")),
                    // System Python
                    "python3".to_string(),
                ];

                let server_script = format!("{}/server.py", 
                    env!("CARGO_MANIFEST_DIR").replace("/src-tauri", ""));

                let mut spawned = None;
                for python in &python_candidates {
                    if let Ok(c) = StdCommand::new(python)
                        .arg(&server_script)
                        .spawn() {
                        println!("VFinder server started via Python: {}", python);
                        spawned = Some(c);
                        break;
                    }
                }
                spawned
            } else {
                // Convert the tauri CommandChild to a std process handle is not directly
                // possible, so for sidecar mode we track it differently.
                // The sidecar is managed by Tauri and will be killed when the app exits.
                None
            };

            if let Some(c) = child {
                let state = app.state::<ServerProcess>();
                *state.0.lock().unwrap() = Some(c);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_status])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| match event {
            RunEvent::Exit => {
                let state = app_handle.state::<ServerProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    println!("VFinder server stopped.");
                }
            }
            _ => {}
        });
}
