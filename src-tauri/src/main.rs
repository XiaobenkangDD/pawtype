#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|a| a == "--mcp") {
        pawtype_lib::run_mcp_stdio();
        return;
    }
    pawtype_lib::run();
}
