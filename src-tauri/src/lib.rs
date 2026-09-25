// Modules desktop partagés avec tauri-cef-linux (voir tauri-shared/)
#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "linux"))]
#[path = "../../tauri-shared/desktop.rs"]
mod desktop;
#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "windows"))]
#[path = "../../tauri-shared/desktop_windows.rs"]
mod desktop_windows;
#[cfg(all(not(debug_assertions), feature = "desktop-production", any(target_os = "linux", target_os = "windows")))]
#[path = "../../tauri-shared/desktop_common.rs"]
mod desktop_common;
#[path = "../../tauri-shared/app_common.rs"]
mod app_common;

use app_common::AppLanguage;

// Workarounds WebKitGTK sur NVIDIA (voir tauri-apps/tauri#9394)
// Sur NVIDIA, le DMABUF renderer peut causer des fenêtres blanches ou des crashes
#[cfg(target_os = "linux")]
fn enable_gpu_acceleration() {
	// Désactiver le DMABUF renderer (problématique sur NVIDIA)
	if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
		std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
	}
	// Fixer le crash Wayland Error 71 sur NVIDIA
	if std::env::var("__NV_DISABLE_EXPLICIT_SYNC").is_err() {
		std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
	}
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	#[cfg(target_os = "linux")]
	enable_gpu_acceleration();

	let app = tauri::Builder::default()
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_dialog::init())
		.plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
			// Focus la fenêtre existante si on tente de relancer l'app
			use tauri::Manager;
			if let Some(window) = app.get_webview_window("main") {
				let _ = window.show();
				let _ = window.set_focus();
			}
		}))
		.manage(AppLanguage(std::sync::Mutex::new("en".to_string())))
		.on_window_event(app_common::on_window_event)
		.invoke_handler(tauri::generate_handler![
			app_common::close_splashscreen,
			app_common::set_app_language,
			app_common::quit_app,
		])
		.setup(|app| {
			if cfg!(debug_assertions) {
				app.handle().plugin(
					tauri_plugin_log::Builder::default()
						.level(log::LevelFilter::Info)
						.build(),
				)?;
			}
			#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "linux"))]
			desktop::start(app)?;
			#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "windows"))]
			desktop_windows::start(app)?;
			// En dev, Tauri attend que devUrl soit disponible avant de créer les fenêtres.
			// Nitro est donc déjà démarré : naviguer main vers l'app, la montrer et fermer le splashscreen.
			#[cfg(debug_assertions)]
			{
				use tauri::Manager;
				let handle = app.handle().clone();
				std::thread::spawn(move || {
					std::thread::sleep(std::time::Duration::from_millis(500));
					if let Some(main) = handle.get_webview_window("main") {
						let dev_url = handle
							.config()
							.build
							.dev_url
							.clone()
							.unwrap_or_else(|| "http://localhost:3003".parse().expect("invalid dev url"));
						let _ = main.navigate(dev_url);
						let _ = main.show();
						let _ = main.set_focus();
					}
					if let Some(splash) = handle.get_webview_window("splashscreen") {
						let _ = splash.close();
					}
				});
			}
			Ok(())
		})
		.build(tauri::generate_context!())
		.expect("error while building tauri application");
	app.run(app_common::on_run_event);
}
