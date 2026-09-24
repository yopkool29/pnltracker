// Workaround runtime CEF alpha : GTK4 conserve le focus X sur sa fenêtre proxy
// interne et le runtime ne fait jamais de XSetInputFocus vers la fenêtre browser
// CEF (enfant X11 la plus profonde). Sans focus X, aucune touche n'atteint CEF.
// Ce thread vérifie périodiquement _NET_ACTIVE_WINDOW : quand une fenêtre de ce
// processus est active, il redirige le focus X vers sa feuille browser CEF.
//
// Même famille de problème pour la molette : les events scroll arrivent en
// valuators XI2 livrés à la root window (rien ne les sélectionne dans la
// hiérarchie de l'app) et l'émulation Button4/5 suit le même chemin, donc CEF
// ne voit jamais la molette. Le forwarder écoute XI_RawButtonPress sur root :
// un button 4-7 flaggé "emulated" = molette perdue ; si le pointeur est au-
// dessus de la fenêtre browser CEF, on ré-injecte un vrai event via XTest,
// livré cette fois à la fenêtre CEF qui sélectionne ButtonPress. Pas de boucle :
// nos events injectés ne portent pas le flag emulated.

use std::time::Duration;

use x11_dl::{xinput2, xlib, xtest};

const POLL_INTERVAL: Duration = Duration::from_millis(200);

pub fn start_watchdog() {
    std::thread::spawn(|| unsafe { watch_loop() });
    std::thread::spawn(|| unsafe { scroll_loop() });
}

unsafe fn scroll_loop() {
    let xlib = match xlib::Xlib::open() {
        Ok(x) => x,
        Err(_) => return,
    };
    let xi = match xinput2::XInput2::open() {
        Ok(x) => x,
        Err(_) => return,
    };
    let xtest = match xtest::Xf86vmode::open() {
        Ok(x) => x,
        Err(_) => return,
    };
    let display = (xlib.XOpenDisplay)(std::ptr::null());
    if display.is_null() {
        return;
    }
    let root = (xlib.XDefaultRootWindow)(display);
    let pid_atom = (xlib.XInternAtom)(display, c"_NET_WM_PID".as_ptr(), 0);
    let our_pgid = unsafe { libc::getpgid(0) };

    let mut xi_opcode = 0;
    let mut ev_base = 0;
    let mut err_base = 0;
    if (xlib.XQueryExtension)(
        display,
        c"XInputExtension".as_ptr(),
        &mut xi_opcode,
        &mut ev_base,
        &mut err_base,
    ) == 0
    {
        return;
    }
    let mut major = 2;
    let mut minor = 0;
    if (xi.XIQueryVersion)(display, &mut major, &mut minor) != 0 {
        return;
    }

    let mut mask_bits = [0u8; 4];
    xinput2::XISetMask(&mut mask_bits, xinput2::XI_RawButtonPress);
    let mut event_mask = xinput2::XIEventMask {
        deviceid: xinput2::XIAllMasterDevices,
        mask_len: mask_bits.len() as i32,
        mask: mask_bits.as_mut_ptr(),
    };
    (xi.XISelectEvents)(display, root, &mut event_mask, 1);
    eprintln!("[cef-scroll] XI2 raw forwarder started");

    loop {
        let mut event: xlib::XEvent = std::mem::zeroed();
        (xlib.XNextEvent)(display, &mut event);
        if event.type_ != xlib::GenericEvent {
            continue;
        }
        let mut cookie = unsafe { event.generic_event_cookie };
        if cookie.extension != xi_opcode || cookie.evtype != xinput2::XI_RawButtonPress {
            continue;
        }
        if (xlib.XGetEventData)(display, &mut cookie) == 0 {
            continue;
        }
        let raw = cookie.data as *const xinput2::XIRawEvent;
        let detail = unsafe { (*raw).detail };
        let emulated = unsafe { (*raw).flags } & xinput2::XIPointerEmulated != 0;
        (xlib.XFreeEventData)(display, &mut cookie);
        // Seuls les events émulés (molette) sont ré-injectés : les vrais
        // Button4/5 atteignent déjà CEF et nos injections ne sont pas émulées.
        if !emulated || !(4..=7).contains(&detail) {
            continue;
        }
        if pointer_over_our_cef(&xlib, display, root, pid_atom, our_pgid) {
            (xtest.XTestFakeButtonEvent)(display, detail as u32, xlib::True, 0);
            (xtest.XTestFakeButtonEvent)(display, detail as u32, xlib::False, 0);
            (xlib.XFlush)(display);
        }
    }
}

// Remonte vrai si le pointeur est au-dessus de la feuille browser CEF d'une
// fenêtre de ce process-group (la frame XFWM parente n'a pas notre pid, donc
// is_our_window descend l'arbre jusqu'au toplevel GTK qui porte _NET_WM_PID).
unsafe fn pointer_over_our_cef(
    xlib: &xlib::Xlib,
    display: *mut xlib::Display,
    root: xlib::Window,
    pid_atom: xlib::Atom,
    our_pgid: libc::pid_t,
) -> bool {
    let mut root_ret = 0;
    let mut top = 0;
    let mut rx = 0;
    let mut ry = 0;
    let mut wx = 0;
    let mut wy = 0;
    let mut mask = 0;
    if (xlib.XQueryPointer)(
        display, root, &mut root_ret, &mut top, &mut rx, &mut ry, &mut wx, &mut wy, &mut mask,
    ) == 0
        || top == 0
    {
        return false;
    }
    if !is_our_window(xlib, display, top, pid_atom, our_pgid) {
        return false;
    }
    let Some(cef) = deepest_large_child(xlib, display, top) else {
        return false;
    };
    let mut current = top;
    loop {
        if current == cef {
            return true;
        }
        let mut child = 0;
        if (xlib.XQueryPointer)(
            display, current, &mut root_ret, &mut child, &mut rx, &mut ry, &mut wx, &mut wy,
            &mut mask,
        ) == 0
            || child == 0
        {
            return false;
        }
        current = child;
    }
}

unsafe fn watch_loop() {
    let xlib = match xlib::Xlib::open() {
        Ok(x) => x,
        Err(_) => return,
    };
    let display = (xlib.XOpenDisplay)(std::ptr::null());
    if display.is_null() {
        return;
    }
    let root = (xlib.XDefaultRootWindow)(display);
    let active_atom = (xlib.XInternAtom)(display, c"_NET_ACTIVE_WINDOW".as_ptr(), 0);
    let pid_atom = (xlib.XInternAtom)(display, c"_NET_WM_PID".as_ptr(), 0);
    // Les fenêtres CEF sont créées par des subprocess forkés : le _NET_WM_PID du
    // toplevel n'est pas forcément notre pid, mais tout le monde partage le pgid.
    let our_pgid = unsafe { libc::getpgid(0) };
    eprintln!("[cef-watchdog] started pgid={our_pgid}");

    loop {
        match window_property_cardinal(&xlib, display, root, active_atom) {
            Some(active) if active != 0 => {
                let ours = is_our_window(&xlib, display, active, pid_atom, our_pgid);
                let leaf = deepest_large_child(&xlib, display, active);
                let mut focus = 0;
                let mut revert = 0;
                (xlib.XGetInputFocus)(display, &mut focus, &mut revert);
                if ours {
                    if let Some(leaf) = leaf {
                        if focus != leaf && leaf != active {
                            eprintln!("[cef-watchdog] active=0x{active:x} leaf=0x{leaf:x} focus=0x{focus:x} -> set");
                            (xlib.XSetInputFocus)(display, leaf, xlib::RevertToParent, xlib::CurrentTime);
                            (xlib.XFlush)(display);
                        }
                    }
                }
            }
            _ => {}
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

unsafe fn is_our_window(
    xlib: &xlib::Xlib,
    display: *mut xlib::Display,
    window: xlib::Window,
    pid_atom: xlib::Atom,
    our_pgid: libc::pid_t,
) -> bool {
    let mut current = Some(window);
    while let Some(w) = current {
        if let Some(pid) = window_property_cardinal(xlib, display, w, pid_atom) {
            if libc::getpgid(pid as libc::pid_t) == our_pgid {
                return true;
            }
        }
        current = largest_child(xlib, display, w);
    }
    false
}

unsafe fn deepest_large_child(xlib: &xlib::Xlib, display: *mut xlib::Display, window: xlib::Window) -> Option<xlib::Window> {
    let mut current = window;
    while let Some(child) = largest_child(xlib, display, current) {
        current = child;
    }
    Some(current)
}

unsafe fn largest_child(xlib: &xlib::Xlib, display: *mut xlib::Display, window: xlib::Window) -> Option<xlib::Window> {
    let mut root = 0;
    let mut parent = 0;
    let mut children = std::ptr::null_mut();
    let mut count = 0;
    if (xlib.XQueryTree)(display, window, &mut root, &mut parent, &mut children, &mut count) == 0 {
        return None;
    }
    let mut next = None;
    let mut best_area = 4;
    if !children.is_null() {
        for i in 0..count as isize {
            let child = *children.offset(i);
            let area = window_area(xlib, display, child);
            if area > best_area {
                best_area = area;
                next = Some(child);
            }
        }
        (xlib.XFree)(children.cast());
    }
    next
}

unsafe fn window_area(xlib: &xlib::Xlib, display: *mut xlib::Display, window: xlib::Window) -> u64 {
    let mut attrs: xlib::XWindowAttributes = std::mem::zeroed();
    if (xlib.XGetWindowAttributes)(display, window, &mut attrs) == 0 {
        return 0;
    }
    attrs.width.max(0) as u64 * attrs.height.max(0) as u64
}

unsafe fn window_property_cardinal(
    xlib: &xlib::Xlib,
    display: *mut xlib::Display,
    window: xlib::Window,
    atom: xlib::Atom,
) -> Option<u64> {
    let mut actual_type = 0;
    let mut actual_format = 0;
    let mut nitems = 0;
    let mut bytes_after = 0;
    let mut prop = std::ptr::null_mut();
    let ret = (xlib.XGetWindowProperty)(
        display,
        window,
        atom,
        0,
        16,
        0,
        xlib::AnyPropertyType as xlib::Atom,
        &mut actual_type,
        &mut actual_format,
        &mut nitems,
        &mut bytes_after,
        &mut prop,
    );
    if ret != 0 {
        return None;
    }
    if prop.is_null() || nitems == 0 || actual_format != 32 {
        if !prop.is_null() {
            (xlib.XFree)(prop.cast());
        }
        return None;
    }
    let value = *(prop as *const u64);
    (xlib.XFree)(prop.cast());
    Some(value)
}
