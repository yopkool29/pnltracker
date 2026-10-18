// Code commun aux runtimes desktop (src-tauri = Tauri 2/WebKitGTK,
// tauri-cef-linux = Tauri 3/CEF). Inclus via #[path] dans chaque crate :
// compilé contre la version de tauri de l'hôte, les modules desktop sont
// donc référencés par `crate::` (déclarés à la racine de chaque lib.rs).

// Langue courante de l'app, mise à jour par le frontend via set_app_language
pub(crate) struct AppLanguage(pub(crate) std::sync::Mutex<String>);

// Un seul dialogue de confirmation à la fois : chaque clic sur fermer
// déclenche un CloseRequested — sans garde ils s'empilent.
static CLOSE_DIALOG_PENDING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// Ferme le splashscreen et montre la fenêtre principale
// Appelée par le frontend quand le DOM est prêt
#[tauri::command]
pub(crate) fn close_splashscreen(app: tauri::AppHandle) {
	use tauri::Manager;
	if let Some(splash) = app.get_webview_window("splashscreen") {
		let _ = splash.close();
	}
	if let Some(main) = app.get_webview_window("main") {
		let _ = main.show();
		let _ = main.set_focus();
	}
}

// Arrête les services backend et ferme l'application
// Appelée par le frontend après avoir affiché l'overlay de fermeture
#[tauri::command]
pub(crate) fn quit_app(app: tauri::AppHandle) {
	#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "linux"))]
	crate::desktop::stop(&app);
	#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "windows"))]
	crate::desktop_windows::stop(&app);
	app.exit(0);
}

// Textes de la confirmation de fermeture (les boutons Oui/Non sont
// localisés par l'impl native sous gtk4 ; rfd les localise déjà).
pub(crate) struct QuitLabels {
	pub(crate) message: &'static str,
	pub(crate) title: &'static str,
	// yes/no ne sont utilisés que par l'impl GTK4 (rfd a ses propres boutons)
	#[allow(dead_code)]
	pub(crate) yes: &'static str,
	#[allow(dead_code)]
	pub(crate) no: &'static str,
}

fn close_confirm_labels(lang: &str) -> QuitLabels {
	match lang {
		"fr" => QuitLabels {
			message: "Voulez-vous vraiment quitter PnlTracker ?",
			title: "Confirmation",
			yes: "Oui",
			no: "Non",
		},
		_ => QuitLabels {
			message: "Are you sure you want to quit PnlTracker?",
			title: "Confirmation",
			yes: "Yes",
			no: "No",
		},
	}
}

// Commande appelée par le frontend pour synchroniser la langue courante
#[tauri::command]
pub(crate) fn set_app_language(lang: String, state: tauri::State<AppLanguage>, app_handle: tauri::AppHandle) {
	#[cfg(all(not(debug_assertions), feature = "desktop-production", any(target_os = "linux", target_os = "windows")))]
	{
		use tauri::Manager;
		if let Some(data_dir) = app_handle.path().app_data_dir().ok() {
			crate::desktop_common::app_log(&data_dir, &format!("set_app_language: received lang={lang}"));
		}
	}
	#[cfg(not(all(not(debug_assertions), feature = "desktop-production", any(target_os = "linux", target_os = "windows"))))]
	{
		let _ = app_handle;
		println!("[set_app_language] received lang={lang}");
	}
	if let Ok(mut current) = state.0.lock() {
		*current = lang;
	}
}

// Handler on_window_event commun : confirmation avant fermeture de la fenêtre
// principale. Les runtimes peuvent ajouter leurs propres checks avant
// (ex. focus webview sous CEF) puis délèguer à cette fonction.
pub(crate) fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
	if window.label() != "main" {
		return;
	}
	if let tauri::WindowEvent::CloseRequested { api, .. } = event {
		use tauri::Manager;
		let lang = window
			.app_handle()
			.try_state::<AppLanguage>()
			.and_then(|state| state.0.lock().ok().map(|l| l.clone()))
			.unwrap_or_else(|| "en".to_string());
		#[cfg(all(not(debug_assertions), feature = "desktop-production", any(target_os = "linux", target_os = "windows")))]
		{
			if let Some(data_dir) = window.app_handle().path().app_data_dir().ok() {
				crate::desktop_common::app_log(&data_dir, &format!("close_dialog: current lang={lang}"));
			}
		}
		#[cfg(not(all(not(debug_assertions), feature = "desktop-production", any(target_os = "linux", target_os = "windows"))))]
		{
			println!("[close_dialog] current lang={lang}");
		}
		// Empêcher la fermeture par défaut
		api.prevent_close();
		// Ignore les CloseRequested répétés tant qu'une confirmation est ouverte
		use std::sync::atomic::Ordering;
		if CLOSE_DIALOG_PENDING.swap(true, Ordering::SeqCst) {
			return;
		}
		// Délégué par runtime : AlertDialog gtk4 modale sous CEF, rfd sinon.
		crate::quit_dialog::show(window, close_confirm_labels(&lang));
	}
}

// Réponse à la confirmation de fermeture, appelée par les impls quit_dialog
pub(crate) fn on_quit_answer(app_handle: &tauri::AppHandle, confirmed: bool) {
	use std::sync::atomic::Ordering;
	CLOSE_DIALOG_PENDING.store(false, Ordering::SeqCst);
	if confirmed {
		// Émettre un événement pour que le frontend affiche un overlay
		// de fermeture avant d'arrêter les services.
		use tauri::Emitter;
		let _ = app_handle.emit("app:shutdown", ());
		// Arrêter les services dans un thread séparé pour ne pas
		// bloquer le main thread et laisser l'overlay s'afficher.
		let handle = app_handle.clone();
		std::thread::spawn(move || {
			// Laisser le temps à l'overlay de s'afficher
			std::thread::sleep(std::time::Duration::from_millis(600));
			#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "linux"))]
			crate::desktop::stop(&handle);
			#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "windows"))]
			crate::desktop_windows::stop(&handle);
			handle.exit(0);
		});
	}
}

// Handler app.run() commun : arrêt des services backend sur ExitRequested
pub(crate) fn on_run_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
	#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "linux"))]
	if matches!(event, tauri::RunEvent::ExitRequested { .. }) {
		crate::desktop::stop(app);
	}
	#[cfg(all(not(debug_assertions), feature = "desktop-production", target_os = "windows"))]
	if matches!(event, tauri::RunEvent::ExitRequested { .. }) {
		crate::desktop_windows::stop(app);
	}
	#[cfg(not(all(not(debug_assertions), feature = "desktop-production")))]
	let _ = (app, event);
}
