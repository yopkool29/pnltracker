fn main() {
    // Build hosts with an older glibc than the one used to compile the
    // linked shared libs (e.g. gtk4 4.14 built against glibc 2.38 on a
    // glibc 2.35 build server) fail at link time on the .so's internal
    // deps. Those are resolved at runtime on the target machine, so allow
    // unresolved symbols inside shared libraries.
    println!("cargo:rustc-link-arg=-Wl,--allow-shlib-undefined");
    tauri_build::build()
}
