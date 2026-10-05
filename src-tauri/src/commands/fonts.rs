//! 系统字体枚举。
//!
//! 用 `fontdb` 而不是让前端用 `queryLocalFonts()`：
//! 后者是实验性 API，需要用户授权、且各平台支持度不一致；
//! `fontdb` 是纯 Rust 实现，在 Rust 侧枚举一次即可，行为跨平台一致。
//!
//! 枚举结果带缓存：扫描系统字体目录是 IO 密集操作，
//! 而字体列表在一次会话内不会变，没必要每次打开设置都重扫。

use std::sync::OnceLock;

use serde::Serialize;

use crate::model::{AppError, AppResult};

/// 一个可选字体。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFamily {
    /// 传给 CSS `font-family` 的名称。
    pub name: String,
    /// 是否为等宽字体。用于「编辑器字体」列表优先展示。
    pub monospaced: bool,
}

/// 全局缓存。字体列表在一次会话内视为不变。
static CACHE: OnceLock<Vec<FontFamily>> = OnceLock::new();

/// 扫描系统字体。
fn scan() -> Vec<FontFamily> {
    let mut db = fontdb::Database::new();
    // 只加载元信息（family / monospace 标志），不解析字形数据，因此很快
    db.load_system_fonts();

    let mut families: Vec<FontFamily> = db
        .faces()
        .filter_map(|face| {
            face.families
                .first()
                .map(|(name, _)| FontFamily {
                    name: name.clone(),
                    monospaced: face.monospaced,
                })
        })
        .collect();

    /*
     * 同一 family 会有多个 face（常规/粗体/斜体），去重并合并等宽标志。
     *
     * 排序与去重**必须用同一个等价关系**：早先排序用 `to_lowercase()`（Unicode）
     * 而去重用 `eq_ignore_ascii_case`（仅 ASCII），非 ASCII 的大小写变体
     * 会排在一起却去不掉，字体列表里就出现重复条目。
     *
     * `sort_by_cached_key` 顺带解决另一个问题：`sort_by` 每次比较都调两次
     * `to_lowercase()`，是 O(n log n) 次字符串分配。
     */
    families.sort_by_cached_key(|f| f.name.to_lowercase());
    families.dedup_by(|a, b| {
        if a.name.to_lowercase() == b.name.to_lowercase() {
            // 只要有一个 face 是等宽，就认为该字体是等宽的
            b.monospaced = b.monospaced || a.monospaced;
            true
        } else {
            false
        }
    });

    families
}

/// 列出系统已安装的字体。
#[tauri::command]
pub async fn list_fonts() -> AppResult<Vec<FontFamily>> {
    // 首次调用会扫描字体目录，可能耗时数十到数百毫秒，
    // 因此放到阻塞线程池，避免卡住异步运行时。
    //
    // 走 `AppError` 而不是裸 `String`：其余命令都返回结构化 `{code, message}`，
    // 前端才能统一处理。裸字符串会被 ipc 层兜成笼统的 `io`。
    let fonts = tauri::async_runtime::spawn_blocking(|| CACHE.get_or_init(scan).clone())
        .await
        .map_err(AppError::from_join)?;

    Ok(fonts)
}
