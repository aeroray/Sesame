use serde::{Deserialize, Serialize};

/// 文件元数据。字段以 camelCase 序列化，前端直接拿到 JS 习惯的命名。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    pub path: String,
    pub name: String,
    pub size: u64,
    /// 修改时间，Unix 毫秒时间戳。
    pub modified: Option<u64>,
    pub modified_ns: Option<String>,
    pub readonly: bool,
}

/// 打开文件后的完整负载。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePayload {
    pub meta: FileMeta,
    /// 文本内容。大文件模式下为空字符串，需改用 `read_chunk` 分块读取。
    pub content: String,
    /// 语言标识，例如 `markdown` / `rust` / `plaintext`。
    pub language: String,
    /// 实际解码所用的编码名，例如 `utf-8` / `gbk` / `utf-16le`。
    pub encoding: String,
    /// 源文件是否带 BOM，保存时据此还原。
    pub has_bom: bool,
    /// 换行风格：`lf` / `crlf` / `cr`。
    pub line_ending: String,
    /// 内容是否被截断（超大文件未内联读取）。
    pub truncated: bool,
    pub decode_lossy: bool,
}

/// 分块读取结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextChunk {
    pub content: String,
    /// 本次读取的起始字节偏移（已对齐到字符边界）。
    pub offset: u64,
    /// 下一次应读取的字节偏移。
    pub next_offset: u64,
    /// 是否已到达文件末尾。
    pub eof: bool,
}

/// 保存结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub path: String,
    pub size: u64,
    pub modified: Option<u64>,
    pub modified_ns: Option<String>,
    /// 大文件保存时**实际写入的前缀字节数**；普通保存为 `None`。
    ///
    /// 前端必须用它更新「已加载字节数」，**不能沿用保存前的旧值**。
    /// 用户在前缀里增删字符后，新文件中前缀的长度已经变了；
    /// 若下次保存仍用旧偏移，尾部就会从错误位置开始复制，内容被重复——
    /// 实测每保存一次文件就变长一截。
    pub prefix_bytes: Option<u64>,
}

/// 最近打开记录。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub path: String,
    pub name: String,
    /// 最近一次打开时间，Unix 毫秒时间戳。
    pub opened_at: u64,
}

/// 上次会话中的一个标签页。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTab {
    pub path: String,
    /// 光标行号，从 1 开始。
    #[serde(default = "one")]
    pub line: u32,
    /// 光标列号，从 1 开始。
    #[serde(default = "one")]
    pub column: u32,
    /// 滚动位置（像素）。
    #[serde(default)]
    pub scroll_top: f64,
}

fn one() -> u32 {
    1
}

/// 上次会话的完整快照。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
    /// 打开过的标签页，按标签栏顺序。
    #[serde(default)]
    pub tabs: Vec<SessionTab>,
    /// 上次激活的标签路径。
    #[serde(default)]
    pub active_path: Option<String>,
}

/// 图片读取结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePayload {
    /// 可直接用于 `<img src>` 的 data URL。
    pub data_url: String,
    pub mime: String,
    pub size: u64,
    pub name: String,
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_snapshot_defaults_are_tolerant() {
        // 缺字段的旧快照必须能解析，否则用户升级后会丢掉整个会话
        let json = r#"{"tabs":[{"path":"a.md"}]}"#;
        let snapshot: SessionSnapshot = serde_json::from_str(json).unwrap();
        assert_eq!(snapshot.tabs.len(), 1);
        assert_eq!(snapshot.tabs[0].line, 1);
        assert_eq!(snapshot.tabs[0].column, 1);
        assert_eq!(snapshot.tabs[0].scroll_top, 0.0);
        assert!(snapshot.active_path.is_none());
    }

    #[test]
    fn session_snapshot_round_trips() {
        let snapshot = SessionSnapshot {
            tabs: vec![SessionTab {
                path: "D:/a/b.md".into(),
                line: 12,
                column: 3,
                scroll_top: 40.0,
            }],
            active_path: Some("D:/a/b.md".into()),
        };

        let text = serde_json::to_string(&snapshot).unwrap();
        // 前端读的是 camelCase
        assert!(text.contains("\"scrollTop\""));
        assert!(text.contains("\"activePath\""));

        let back: SessionSnapshot = serde_json::from_str(&text).unwrap();
        assert_eq!(back.tabs.len(), 1);
        assert_eq!(back.tabs[0].line, 12);
        assert_eq!(back.active_path.as_deref(), Some("D:/a/b.md"));
    }

    #[test]
    fn empty_snapshot_is_valid() {
        let snapshot: SessionSnapshot = serde_json::from_str("{}").unwrap();
        assert!(snapshot.tabs.is_empty());
    }
}
