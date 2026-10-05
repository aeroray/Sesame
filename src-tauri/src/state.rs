//! 应用运行时状态。
//!
//! 只保存「已打开文件的关键属性」，用于保存时沿用原编码与换行风格、
//! 以及拦住对二进制文件的文本写入。不缓存文件内容。

use std::collections::HashMap;
use std::sync::Mutex;

/// 文件指纹，用于检测外部修改。
///
/// 用「修改时间 + 大小」而不是内容哈希：哈希要读完整个文件，
/// 对几 MB 的文件每次保存都算一遍并不划算；而 mtime + size 已经能覆盖
/// 绝大多数实际场景（另一个编辑器改内容、Git 切分支、脚本生成文件）。
///
/// 理论上的漏网场景是「外部改动后 mtime 与大小都恰好没变」——
/// 实际几乎不可能，因为任何真实写入都会更新 mtime。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fingerprint {
    /// Unix 毫秒。文件系统缺失 mtime 时为 `None`。
    pub modified_ms: Option<u64>,
    pub size: u64,
}

/// 单个已打开文件的已知状态。
#[derive(Debug, Clone)]
pub struct OpenFile {
    /// 读取时使用的编码，保存时默认沿用。
    pub encoding: String,
    /// 读取时探测到的换行风格。
    pub line_ending: String,
    /// 读取时是否带 BOM。
    pub has_bom: bool,
    /// 上次成功打开或保存时的磁盘指纹，即「持久化基线」。
    ///
    /// 保存前会重新取一次指纹与之比对，不一致说明有外部程序动过文件。
    /// 保存成功后必须更新它，否则自己刚写盘的动作会被下次检查误判成外部修改。
    pub baseline: Fingerprint,
}

#[derive(Default)]
pub struct AppState {
    open: Mutex<HashMap<String, OpenFile>>,
    /// 启动时命令行传入的文件路径。
    ///
    /// 由前端在挂载后主动拉取，而不是由后端推送事件——
    /// 推送需要猜测前端何时就绪，拉取则没有竞态。
    startup_files: Mutex<Vec<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            open: Mutex::new(HashMap::new()),
            startup_files: Mutex::new(Vec::new()),
        }
    }

    /// 记录启动参数中的文件路径。
    pub fn set_startup_files(&self, files: Vec<String>) {
        if let Ok(mut slot) = self.startup_files.lock() {
            *slot = files;
        }
    }

    /// 取出并清空启动文件列表，避免重复打开。
    pub fn take_startup_files(&self) -> Vec<String> {
        self.startup_files
            .lock()
            .map(|mut slot| std::mem::take(&mut *slot))
            .unwrap_or_default()
    }

    /// 记录一次成功打开/保存后的文件状态。
    pub fn remember(&self, path: String, file: OpenFile) {
        if let Ok(mut map) = self.open.lock() {
            map.insert(path, file);
        }
    }

    /// 取出已知状态。
    pub fn recall(&self, path: &str) -> Option<OpenFile> {
        self.open.lock().ok()?.get(path).cloned()
    }

    /// 关闭文件时移除记录。
    pub fn forget(&self, path: &str) {
        if let Ok(mut map) = self.open.lock() {
            map.remove(path);
        }
    }
}
