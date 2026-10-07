fn main() {
    // Native Windows icon resources must be rebuilt when the icon set changes.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
