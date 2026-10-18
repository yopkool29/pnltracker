// Boîte de confirmation de fermeture via tauri-plugin-dialog.
// Sous wry/WebKitGTK le backend gtk3 de rfd produit une vraie modale système
// (grab X11) ; sous Windows le backend win32 l'est aussi. Sert aussi de
// fallback pour les builds CEF non-Linux.
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::app_common::{self, QuitLabels};

pub(crate) fn show(window: &tauri::Window, labels: QuitLabels) {
	let app_handle = window.app_handle().clone();
	window
		.dialog()
		.message(labels.message)
		.title(labels.title)
		.kind(tauri_plugin_dialog::MessageDialogKind::Warning)
		.buttons(tauri_plugin_dialog::MessageDialogButtons::YesNo)
		.show(move |confirmed| {
			app_common::on_quit_answer(&app_handle, confirmed);
		});
}
