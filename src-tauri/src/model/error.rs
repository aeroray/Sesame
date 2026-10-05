use serde::{Serialize, Serializer};
use thiserror::Error;

/// 领域错误：统一携带机器可读的 `code` 与面向用户的中文 `message`。
///
/// 序列化后前端收到的是 `{ code, message }`，而不是裸字符串，
/// 这样 UI 可以按 code 决定处理方式，同时直接展示 message。
#[derive(Debug, Error)]
pub enum AppError {
    #[error("文件不存在：{0}")]
    NotFound(String),

    #[error("没有访问权限：{0}")]
    PermissionDenied(String),

    #[error("这是一个文件夹，不是文件：{0}")]
    NotAFile(String),

    #[error("文件过大（{size} 字节），超过可内联读取的上限 {limit} 字节")]
    TooLarge { size: u64, limit: u64 },

    #[error("路径无效：{0}")]
    InvalidPath(String),

    /// 文件类型不支持当前操作。
    ///
    /// 与 `InvalidPath` 分开是必要的：路径完全合法，是**文件类型**不合适
    /// （例如对 PNG 按 Ctrl+S）。早先复用 `InvalidPath`，
    /// 用户看到的是「路径无效：这是一个二进制文件…」，既误导，
    /// 也让前端无法按 code 区分处理。
    #[error("不支持以文本方式保存：{0}")]
    Unsupported(String),

    #[error("读写失败：{0}")]
    Io(String),

    /// 保存前复核发现文件已被外部程序改动。
    ///
    /// 单独成一种错误而不是笼统的 Io，因为前端要据此弹出冲突对话框
    /// （覆盖 / 重新加载 / 另存为），而不是只显示一条失败提示。
    #[error("文件已被外部修改：{0}")]
    Conflict(String),
}

impl AppError {
    /// 稳定的机器可读错误码，供前端分支处理。
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::PermissionDenied(_) => "permission_denied",
            Self::NotAFile(_) => "not_a_file",
            Self::TooLarge { .. } => "too_large",
            Self::InvalidPath(_) => "invalid_path",
            Self::Unsupported(_) => "unsupported",
            Self::Io(_) => "io",
            Self::Conflict(_) => "conflict",
        }
    }

    /// 把 `std::io::Error` 归类为更具体的中文错误，避免把原始英文 io 信息抛给用户。
    pub fn from_io(path: &str, err: std::io::Error) -> Self {
        use std::io::ErrorKind;
        match err.kind() {
            ErrorKind::NotFound => Self::NotFound(path.to_string()),
            ErrorKind::PermissionDenied => Self::PermissionDenied(path.to_string()),
            ErrorKind::InvalidInput | ErrorKind::InvalidData => Self::InvalidPath(path.to_string()),
            /*
             * 其余情况（磁盘写满、卷只读、文件被锁……）保留原始信息——
             * 这些原因对用户有诊断价值，翻译成笼统的中文反而丢信息。
             *
             * 但**必须带上路径**：只给「磁盘空间不足」而不说哪个文件，
             * 用户无从下手。早先这里丢掉了 path，与函数自己的约定相矛盾。
             */
            _ => Self::Io(format!("{path}：{err}")),
        }
    }

    /// 后台任务（spawn_blocking）失败时的统一包装。
    pub fn from_join(err: impl std::fmt::Display) -> Self {
        Self::Io(format!("后台任务异常：{err}"))
    }
}

#[derive(Serialize)]
struct ErrorPayload<'a> {
    code: &'a str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        ErrorPayload {
            code: self.code(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;
