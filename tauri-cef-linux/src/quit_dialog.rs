// Boîte de confirmation de fermeture sous CEF.
// rfd ne peut pas produire de modale ici : le backend gtk3 ne peut pas se
// charger dans un processus GTK4, et son chemin zenity/portal ne grab pas
// (cliquable-derrière, repasse sous la fenêtre, s'empile à chaque clic sur X).
// Une fenêtre GTK4 modale créée dans le processus fait un vrai grab X11, ce
// qui rend insensible tout l'arbre — y compris le navigateur CEF, enfant X11
// étranger à GTK que set_enabled ne couvre pas. Pendant ce temps
// _NET_WM_ALLOWED_ACTIONS retire MOVE à la fenêtre parent pour qu'elle ne
// puisse pas non plus être déplacée derrière le dialogue.
use gtk::prelude::*;
use tauri::Manager;

use crate::app_common::{self, QuitLabels};

// Actions EWMH autorisées sur la fenêtre parent pendant la modale
// (toutes sauf _NET_WM_ACTION_MOVE).
const WM_ACTIONS_LOCKED: &[&std::ffi::CStr] = &[
	c"_NET_WM_ACTION_RESIZE",
	c"_NET_WM_ACTION_MINIMIZE",
	c"_NET_WM_ACTION_SHADE",
	c"_NET_WM_ACTION_STICK",
	c"_NET_WM_ACTION_MAXIMIZE_HORZ",
	c"_NET_WM_ACTION_MAXIMIZE_VERT",
	c"_NET_WM_ACTION_FULLSCREEN",
	c"_NET_WM_ACTION_CHANGE_DESKTOP",
	c"_NET_WM_ACTION_CLOSE",
	c"_NET_WM_ACTION_ABOVE",
	c"_NET_WM_ACTION_BELOW",
];

fn set_parent_movable(xid: u64, movable: bool) {
	if xid == 0 {
		return;
	}
	unsafe {
		let Ok(xlib) = x11_dl::xlib::Xlib::open() else {
			return;
		};
		let display = (xlib.XOpenDisplay)(std::ptr::null());
		if display.is_null() {
			return;
		}
		let allowed = (xlib.XInternAtom)(display, c"_NET_WM_ALLOWED_ACTIONS".as_ptr(), x11_dl::xlib::False);
		if movable {
			// Propriété absente = toutes les actions autorisées (EWMH)
			(xlib.XDeleteProperty)(display, xid as x11_dl::xlib::Window, allowed);
		} else {
			let atoms: Vec<x11_dl::xlib::Atom> = WM_ACTIONS_LOCKED
				.iter()
				.map(|name| (xlib.XInternAtom)(display, name.as_ptr(), x11_dl::xlib::False))
				.collect();
			(xlib.XChangeProperty)(
				display,
				xid as x11_dl::xlib::Window,
				allowed,
				x11_dl::xlib::XA_ATOM,
				32,
				x11_dl::xlib::PropModeReplace,
				atoms.as_ptr() as *const u8,
				atoms.len() as i32,
			);
		}
		(xlib.XCloseDisplay)(display);
	}
}

fn finish(dialog: &gtk::Window, app: &tauri::AppHandle, xid: u64, confirmed: bool) {
	set_parent_movable(xid, true);
	dialog.destroy();
	app_common::on_quit_answer(app, confirmed);
}

pub(crate) fn show(window: &tauri::Window, labels: QuitLabels) {
	use raw_window_handle::HasWindowHandle;
	let app_handle = window.app_handle().clone();
	let Ok(parent) = window.gtk_window() else {
		app_common::on_quit_answer(&app_handle, false);
		return;
	};
	let xid = window
		.window_handle()
		.ok()
		.and_then(|handle| match handle.as_raw() {
			raw_window_handle::RawWindowHandle::Xlib(handle) => Some(handle.window as u64),
			_ => None,
		})
		.unwrap_or(0);
	set_parent_movable(xid, false);

	let dialog = gtk::Window::builder()
		.modal(true)
		.transient_for(&parent)
		.title(labels.title)
		.resizable(false)
		.build();

	let content = gtk::Box::new(gtk::Orientation::Vertical, 20);
	content.set_margin_top(22);
	content.set_margin_bottom(20);
	content.set_margin_start(28);
	content.set_margin_end(28);

	let buttons = gtk::Box::new(gtk::Orientation::Horizontal, 24);
	buttons.set_halign(gtk::Align::Center);
	let no_btn = gtk::Button::with_label(labels.no);
	let yes_btn = gtk::Button::with_label(labels.yes);
	no_btn.set_size_request(90, -1);
	yes_btn.set_size_request(90, -1);
	buttons.append(&no_btn);
	buttons.append(&yes_btn);

	content.append(&gtk::Label::new(Some(labels.message)));
	content.append(&buttons);
	dialog.set_child(Some(&content));

	no_btn.connect_clicked({
		let (dialog, app) = (dialog.clone(), app_handle.clone());
		move |_| finish(&dialog, &app, xid, false)
	});
	yes_btn.connect_clicked({
		let (dialog, app) = (dialog.clone(), app_handle.clone());
		move |_| finish(&dialog, &app, xid, true)
	});
	// X de la fenêtre de la modale = annuler
	dialog.connect_close_request({
		let app = app_handle.clone();
		move |_| {
			set_parent_movable(xid, true);
			app_common::on_quit_answer(&app, false);
			gtk::glib::Propagation::Proceed
		}
	});
	// Échap = annuler
	let keys = gtk::EventControllerKey::new();
	keys.connect_key_pressed({
		let (dialog, app) = (dialog.clone(), app_handle.clone());
		move |_, key, _, _| {
			if key == gtk::gdk::Key::Escape {
				finish(&dialog, &app, xid, false);
				gtk::glib::Propagation::Stop
			} else {
				gtk::glib::Propagation::Proceed
			}
		}
	});
	dialog.add_controller(keys);

	yes_btn.grab_focus();
	dialog.present();
}
