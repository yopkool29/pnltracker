#[cfg(target_os = "linux")]
mod cef_focus;
// Modules desktop partagés avec src-tauri (voir tauri-shared/)
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

pub fn run() {
	let app = tauri::Builder::default()
		// Sandbox désactivé pour le POC : le sandbox Chromium bloque l'accès au
		// driver NVIDIA (dri_gbm.so -> Permission denied) et crash le GPU process.
		// use-angle=gl-egl évite le crash GLX/EGL_CONTEXT_LOST sur NVIDIA X11.
		.runtime(
			tauri_runtime_cef::Cef::default()
				.sandbox(tauri_runtime_cef::SandboxPolicy::Disabled)
				.command_line_arg("use-gl", Some("angle".to_string()))
				.command_line_arg("use-angle", Some("gl-egl".to_string())),
		)
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_dialog::init())
		.plugin(tauri_plugin_fs::init())
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
			// Focus la fenêtre existante si on tente de relancer l'app
			use tauri::Manager;
			if let Some(window) = app.get_webview_window("main") {
				let _ = window.show();
				let _ = window.set_focus();
			}
		}))
		.manage(AppLanguage(std::sync::Mutex::new("en".to_string())))
		.on_window_event(|window, event| {
			// Workaround runtime CEF alpha : la vue web n'accepte le clavier que si le
			// host CEF reçoit SetFocus — à propager à chaque prise de focus de la fenêtre.
			if let tauri::WindowEvent::Focused(true) = event {
				use tauri::Manager;
				eprintln!("[cef-focus] window {} focused", window.label());
				match window.app_handle().get_webview(window.label()) {
					Some(webview) => eprintln!("[cef-focus] set_focus -> {:?}", webview.set_focus()),
					None => eprintln!("[cef-focus] get_webview({}) returned None", window.label()),
				}
			}
			app_common::on_window_event(window, event);
		})
		.invoke_handler(tauri::generate_handler![
			app_common::close_splashscreen,
			app_common::set_app_language,
			app_common::quit_app,
		])
		.setup(|app| {
			#[cfg(target_os = "linux")]
			cef_focus::start_watchdog();
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
						std::thread::sleep(std::time::Duration::from_millis(1500));
						if let Some(webview) = handle.get_webview("main") {
							let _ = webview.set_focus();
						}
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
