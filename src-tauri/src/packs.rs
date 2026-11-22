//! Premium skin packs + seasonal free windows (China UTC+8).

use crate::config::AppSettings;

pub const PACK_OFFICE: &str = "office";
pub const PACK_STUDY: &str = "study";
pub const PACK_NIGHT: &str = "night";
pub const PACK_FESTIVAL: &str = "festival";

/// Which pack gates this cat id? `None` = free forever.
pub fn cat_pack(id: &str) -> Option<&'static str> {
    match id {
        "worker" | "coder" | "slack" => Some(PACK_OFFICE),
        "kaoyan" | "gaokao" => Some(PACK_STUDY),
        "nightowl" => Some(PACK_NIGHT),
        "spring" => Some(PACK_FESTIVAL),
        _ => None,
    }
}

pub fn pack_label(pack: &str) -> String {
    match pack {
        PACK_OFFICE => "打工包".to_string(),
        PACK_STUDY => "学霸包".to_string(),
        PACK_NIGHT => "夜猫包".to_string(),
        PACK_FESTIVAL => "节日包".to_string(),
        _ => pack.to_string(),
    }
}

/// Civil Y-M-D in UTC+8 without extra deps (Howard Hinnant algorithm).
pub fn china_ymd() -> (i32, u32, u32) {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
        + 8 * 3600;
    let z = secs.div_euclid(86_400) + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = (yoe as i64 + era * 400) as i32;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Seasonal free windows (no sponsorship required).
pub fn is_seasonally_free(id: &str) -> bool {
    let (_y, m, d) = china_ymd();
    match id {
        // 春节档：1–2 月免费体验
        "spring" => m == 1 || m == 2,
        // 高考档：6 月 1–15 日免费体验
        "gaokao" => m == 6 && d <= 15,
        _ => false,
    }
}

pub fn has_pack(settings: &AppSettings, pack: &str) -> bool {
    if settings.sponsor_unlocked {
        return true;
    }
    settings
        .unlocked_packs
        .iter()
        .any(|p| p == pack || p == "all")
}

pub fn can_use_cat(id: &str, settings: &AppSettings) -> bool {
    match cat_pack(id) {
        None => true,
        Some(pack) => has_pack(settings, pack) || is_seasonally_free(id),
    }
}

pub fn unlock_pack(settings: &mut AppSettings, pack: &str) {
    let pack = pack.trim();
    if pack.is_empty() {
        return;
    }
    if pack == "all" {
        settings.sponsor_unlocked = true;
        for p in [PACK_OFFICE, PACK_STUDY, PACK_NIGHT, PACK_FESTIVAL] {
            if !settings.unlocked_packs.iter().any(|x| x == p) {
                settings.unlocked_packs.push(p.to_string());
            }
        }
        return;
    }
    if matches!(
        pack,
        PACK_OFFICE | PACK_STUDY | PACK_NIGHT | PACK_FESTIVAL
    ) && !settings.unlocked_packs.iter().any(|x| x == pack)
    {
        settings.unlocked_packs.push(pack.to_string());
    }
}
