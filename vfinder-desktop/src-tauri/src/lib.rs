use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

// Keep track of the server process so we can kill it
pub struct PythonServerState(pub Mutex<Option<std::process::Child>>);

#[tauri::command]
fn get_server_status() -> String {
    "running".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PythonServerState(Mutex::new(None)))
        .setup(|app| {
            let project_dir = "/Users/vedantbisen/Documents/VFinder";
            let python_bin = format!("{}/.venv/bin/python3", project_dir);
            let script_path = format!("{}/server.py", project_dir);
            
            // Spawn the python daemon
            if let Ok(child) = Command::new(&python_bin)
                .arg(&script_path)
                .current_dir(project_dir)
                .spawn() {
                
                let state = app.state::<PythonServerState>();
                *state.0.lock().unwrap() = Some(child);
                println!("Python backend daemon started.");
            } else {
                println!("Failed to start python daemon.");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_status])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| match event {
            RunEvent::Exit => {
                let state = app_handle.state::<PythonServerState>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    println!("Python backend daemon stopped.");
                }
            }
            _ => {}
        });
}
