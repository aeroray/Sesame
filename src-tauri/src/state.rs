//! 应用运行时状态。
//!
//! 只保存「已打开文件的关键属性」，用于保存时沿用原编码与换行风格、
//! 以及拦住对二进制文件的文本写入。不缓存文件内容。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, Weak};

/// 取锁，并**从中毒状态里恢复**。
///
/// 这些锁保护的都是「要么整体更新、要么没动」的普通数据（一个 `()`、
/// 一张表、一个列表），即使持锁线程 panic，留下的状态依然自洽。
/// 因此中毒后继续用比放弃更好：
///
/// - `open` 表若因中毒而读不到，`save_file` 就看不到「这是二进制文件」的记录，
///   二进制写入防护**静默失效**；
/// - `gates` 表若因中毒而报错，那个文件的每一次保存都会失败到重启为止。
///
/// 两者都是「为了防御一个已经发生的 panic，反而把功能弄坏」。
fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 文件指纹，用于检测外部修改。
///
/// 用「修改时间 + 大小」而不是内容哈希：哈希要读完整个文件，
/// 对几 MB 的文件每次保存都算一遍并不划算；而 mtime + size 已经能覆盖
/// 绝大多数实际场景（另一个编辑器改内容、Git 切分支、脚本生成文件）。
///
/// 理论上的漏网场景是「外部改动后 mtime 与大小都恰好没变」——
/// 实际几乎不可能，因为任何真实写入都会更新 mtime。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fingerprint {
    /// Unix 纳秒字符串。文件系统缺失 mtime 时为 `None`。
    pub modified_ns: Option<String>,
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
    gates: Mutex<HashMap<String, Weak<Mutex<()>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            open: Mutex::new(HashMap::new()),
            startup_files: Mutex::new(Vec::new()),
            gates: Mutex::new(HashMap::new()),
        }
    }

    /// 记录启动参数中的文件路径。
    pub fn set_startup_files(&self, files: Vec<String>) {
        lock(&self.startup_files).extend(files);
    }

    /// 取出并清空启动文件列表，避免重复打开。
    pub fn take_startup_files(&self) -> Vec<String> {
        std::mem::take(&mut *lock(&self.startup_files))
    }

    /// 记录一次成功打开/保存后的文件状态。
    pub fn remember(&self, path: String, file: OpenFile) {
        lock(&self.open).insert(Self::key(&path), file);
    }

    /// 取出已知状态。
    pub fn recall(&self, path: &str) -> Option<OpenFile> {
        lock(&self.open).get(&Self::key(path)).cloned()
    }

    /// 关闭文件时移除记录。
    pub fn forget(&self, path: &str) {
        lock(&self.open).remove(&Self::key(path));
    }

    fn key(path: &str) -> String {
        if cfg!(windows) {
            path.replace('\\', "/").to_lowercase()
        } else {
            path.to_owned()
        }
    }

    pub fn file_gate(&self, path: &std::path::Path) -> crate::model::AppResult<Arc<Mutex<()>>> {
        let identity = std::fs::canonicalize(path).unwrap_or_else(|_| {
            path.parent()
                .and_then(|parent| std::fs::canonicalize(parent).ok())
                .zip(path.file_name())
                .map(|(parent, name)| parent.join(name))
                .unwrap_or_else(|| path.to_path_buf())
        });
        let key = Self::key(&identity.to_string_lossy());
        let mut gates = lock(&self.gates);
        gates.retain(|_, weak| weak.strong_count() > 0);
        if let Some(existing) = gates.get(&key).and_then(Weak::upgrade) {
            return Ok(existing);
        }
        let gate = Arc::new(Mutex::new(()));
        gates.insert(key, Arc::downgrade(&gate));
        Ok(gate)
    }
}
