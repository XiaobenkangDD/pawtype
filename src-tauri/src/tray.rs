use crate::config::AppSettings;
use crate::{
    apply_breed_and_save, apply_keyboard_layout_and_save, apply_keyboard_orientation_and_save,
    apply_scale_and_save, reset_window_position, AppState,
};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

pub fn setup_tray(app: &AppHandle, initial: &AppSettings) -> tauri::Result<()> {
    let toggle_show = MenuItem::with_id(app, "toggle_show", "显示 / 隐藏小黑猫", true, None::<&str>)?;
    let click_through = CheckMenuItem::with_id(
        app,
        "click_through",
        "锁定鼠标穿透（防误触）",
        true,
        initial.click_through_locked,
        None::<&str>,
    )?;
    let key_bubbles = CheckMenuItem::with_id(
        app,
        "key_bubbles",
        "显示悬浮按键气泡",
        true,
        initial.show_key_bubbles,
        None::<&str>,
    )?;
    let sound_toggle = CheckMenuItem::with_id(
        app,
        "sound_toggle",
        "摸头呼噜声",
        true,
        initial.sound_enabled,
        None::<&str>,
    )?;
    let always_on_top = CheckMenuItem::with_id(
        app,
        "always_on_top",
        "始终置顶显示",
        true,
        initial.always_on_top,
        None::<&str>,
    )?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "开机自动启动",
        true,
        initial.autostart,
        None::<&str>,
    )?;
    let mcp_toggle = CheckMenuItem::with_id(
        app,
        "mcp_toggle",
        "开启 MCP 扩展服务",
        true,
        initial.mcp_enabled,
        None::<&str>,
    )?;

    let breed_black = MenuItem::with_id(app, "breed_black", "经典小黑猫", true, None::<&str>)?;
    let breed_ragdoll = MenuItem::with_id(app, "breed_ragdoll", "暖奶茶布偶猫", true, None::<&str>)?;
    let breed_orange = MenuItem::with_id(app, "breed_orange", "大橘猫（虎斑）", true, None::<&str>)?;
    let breed_calico = MenuItem::with_id(app, "breed_calico", "三花猫", true, None::<&str>)?;
    let breed_tuxedo = MenuItem::with_id(app, "breed_tuxedo", "奶牛猫", true, None::<&str>)?;
    let breed_siamese = MenuItem::with_id(app, "breed_siamese", "暹罗猫", true, None::<&str>)?;
    let breed_menu = Submenu::with_items(
        app,
        "猫咪外观",
        true,
        &[
            &breed_black,
            &breed_ragdoll,
            &breed_orange,
            &breed_calico,
            &breed_tuxedo,
            &breed_siamese,
        ],
    )?;

    let scale_25 = MenuItem::with_id(app, "scale_25", "25%（迷你）", true, None::<&str>)?;
    let scale_50 = MenuItem::with_id(app, "scale_50", "50%（小巧）", true, None::<&str>)?;
    let scale_75 = MenuItem::with_id(app, "scale_75", "75%（适中）", true, None::<&str>)?;
    let scale_100 = MenuItem::with_id(app, "scale_100", "100%（默认）", true, None::<&str>)?;
    let scale_125 = MenuItem::with_id(app, "scale_125", "125%（偏大）", true, None::<&str>)?;
    let scale_150 = MenuItem::with_id(app, "scale_150", "150%（大号）", true, None::<&str>)?;
    let scale_menu = Submenu::with_items(
        app,
        "缩放大小",
        true,
        &[&scale_25, &scale_50, &scale_75, &scale_100, &scale_125, &scale_150],
    )?;

    let kb_65 = MenuItem::with_id(app, "kb_65", "65% 紧凑键盘", true, None::<&str>)?;
    let kb_108 = MenuItem::with_id(app, "kb_108", "108 键全尺寸（含小键盘）", true, None::<&str>)?;
    let kb_sep = PredefinedMenuItem::separator(app)?;
    let kb_cat = MenuItem::with_id(app, "kb_cat", "面向猫咪（180° 真实视角）", true, None::<&str>)?;
    let kb_viewer = MenuItem::with_id(app, "kb_viewer", "面向观众（正向字母易读）", true, None::<&str>)?;
    let kb_menu = Submenu::with_items(
        app,
        "键盘配列与方向",
        true,
        &[&kb_65, &kb_108, &kb_sep, &kb_cat, &kb_viewer],
    )?;

    let reset_pos = MenuItem::with_id(app, "reset_pos", "重置位置到右下角", true, None::<&str>)?;
    #[cfg(windows)]
    let desktop_shortcut =
        MenuItem::with_id(app, "desktop_shortcut", "创建桌面快捷方式 (PawType)", true, None::<&str>)?;
    let check_update = MenuItem::with_id(
        app,
        "check_update",
        format!("检查更新 (v{})", crate::updater::CURRENT_VERSION),
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "退出 PawType", true, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    #[cfg(windows)]
    let menu = Menu::with_items(
        app,
        &[
            &toggle_show,
            &sep1,
            &click_through,
            &key_bubbles,
            &sound_toggle,
            &always_on_top,
            &breed_menu,
            &kb_menu,
            &scale_menu,
            &desktop_shortcut,
            &reset_pos,
            &autostart,
            &mcp_toggle,
            &check_update,
            &sep2,
            &quit,
        ],
    )?;

    #[cfg(not(windows))]
    let menu = Menu::with_items(
        app,
        &[
            &toggle_show,
            &sep1,
            &click_through,
            &key_bubbles,
            &sound_toggle,
            &always_on_top,
            &breed_menu,
            &kb_menu,
            &scale_menu,
            &reset_pos,
            &autostart,
            &mcp_toggle,
            &check_update,
            &sep2,
            &quit,
        ],
    )?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    TrayIconBuilder::with_id("paw-tray")
        .icon(icon)
        .tooltip("PawType")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(true) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                    }
                }
            }
        })
        .on_menu_event(move |app, event| {
            let state = app.state::<AppState>();
            match event.id().as_ref() {
                "toggle_show" => {
                    if let Some(win) = app.get_webview_window("main") {
                        if win.is_visible().unwrap_or(true) {
                            let _ = win.hide();
                        } else {
                            let _ = win.show();
                        }
                    }
                }
                "click_through" => {
                    let mut s = state.settings.lock().unwrap();
                    s.click_through_locked = !s.click_through_locked;
                    let locked = s.click_through_locked;
                    crate::config::save_settings(&s);
                    let _ = click_through.set_checked(locked);
                    let _ = app.emit("paw-settings", s.clone());
                }
                "key_bubbles" => {
                    let mut s = state.settings.lock().unwrap();
                    s.show_key_bubbles = !s.show_key_bubbles;
                    let enabled = s.show_key_bubbles;
                    crate::config::save_settings(&s);
                    let _ = key_bubbles.set_checked(enabled);
                    let _ = app.emit("paw-settings", s.clone());
                }
                "sound_toggle" => {
                    let mut s = state.settings.lock().unwrap();
                    s.sound_enabled = !s.sound_enabled;
                    let enabled = s.sound_enabled;
                    crate::config::save_settings(&s);
                    let _ = sound_toggle.set_checked(enabled);
                    let _ = app.emit("paw-settings", s.clone());
                }
                "always_on_top" => {
                    let mut s = state.settings.lock().unwrap();
                    s.always_on_top = !s.always_on_top;
                    let on_top = s.always_on_top;
                    crate::config::save_settings(&s);
                    let _ = always_on_top.set_checked(on_top);
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_always_on_top(on_top);
                    }
                    let _ = app.emit("paw-settings", s.clone());
                }
                "autostart" => {
                    let mut s = state.settings.lock().unwrap();
                    let next = !s.autostart;
                    if crate::config::set_windows_autostart(next).is_ok() {
                        s.autostart = next;
                        crate::config::save_settings(&s);
                        let _ = autostart.set_checked(next);
                        let _ = app.emit("paw-settings", s.clone());
                    }
                }
                "mcp_toggle" => {
                    let mut s = state.settings.lock().unwrap();
                    s.mcp_enabled = !s.mcp_enabled;
                    let enabled = s.mcp_enabled;
                    state
                        .mcp_enabled
                        .store(enabled, std::sync::atomic::Ordering::Relaxed);
                    crate::config::save_settings(&s);
                    let _ = mcp_toggle.set_checked(enabled);
                    let _ = app.emit("paw-settings", s.clone());
                }
                "breed_black" => apply_breed_and_save(app, "black"),
                "breed_ragdoll" => apply_breed_and_save(app, "ragdoll"),
                "breed_orange" => apply_breed_and_save(app, "orange-tabby"),
                "breed_calico" => apply_breed_and_save(app, "calico"),
                "breed_tuxedo" => apply_breed_and_save(app, "tuxedo"),
                "breed_siamese" => apply_breed_and_save(app, "siamese"),
                "scale_25" => apply_scale_and_save(app, 0.25),
                "scale_50" => apply_scale_and_save(app, 0.5),
                "scale_75" => apply_scale_and_save(app, 0.75),
                "scale_100" => apply_scale_and_save(app, 1.0),
                "scale_125" => apply_scale_and_save(app, 1.25),
                "scale_150" => apply_scale_and_save(app, 1.5),
                "kb_65" => apply_keyboard_layout_and_save(app, "65"),
                "kb_108" => apply_keyboard_layout_and_save(app, "108"),
                "kb_cat" => apply_keyboard_orientation_and_save(app, "cat"),
                "kb_viewer" => apply_keyboard_orientation_and_save(app, "viewer"),
                "desktop_shortcut" => {
                    let _ = crate::config::create_desktop_shortcut();
                }
                "check_update" => {
                    let app_clone = app.clone();
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                    }
                    let _ = app_clone.emit(
                        "paw-update-status",
                        crate::updater::UpdateProgressEvent {
                            stage: "checking".to_string(),
                            message: "正在检查新版本...".to_string(),
                            info: None,
                        },
                    );
                    std::thread::spawn(move || match crate::updater::check_latest_update() {
                        Ok(info) => {
                            let (stage, msg) = if info.has_update {
                                ("available", format!("发现新版本 v{}", info.latest_version))
                            } else {
                                ("up_to_date", format!("已是最新版本 v{}", info.current_version))
                            };
                            let _ = app_clone.emit(
                                "paw-update-status",
                                crate::updater::UpdateProgressEvent {
                                    stage: stage.to_string(),
                                    message: msg,
                                    info: Some(info),
                                },
                            );
                        }
                        Err(err) => {
                            let _ = app_clone.emit(
                                "paw-update-status",
                                crate::updater::UpdateProgressEvent {
                                    stage: "error".to_string(),
                                    message: err,
                                    info: None,
                                },
                            );
                        }
                    });
                }
                "reset_pos" => reset_window_position(app),
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
