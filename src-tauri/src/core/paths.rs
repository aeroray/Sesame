//! 路径规范化与安全检查。
//!
//! 前端只传字符串，所有规范化与校验都在这里完成，
//! 这是 Tauri 安全模型的要求，也是权限白名单能收紧的前提。

use std::path::{Component, Path, PathBuf};

use crate::model::{AppError, AppResult};

/// 把用户传入的路径规范化为绝对路径。
///
/// 相对路径按 `base` 解析；`..` 会被词法折叠（不访问文件系统）。
pub fn normalize(input: &str, base: Option<&Path>) -> AppResult<PathBuf> {
    let raw = input.trim();
    if raw.is_empty() {
        return Err(AppError::InvalidPath("路径为空".into()));
    }

    // 拒绝 NUL 字节，它会截断底层系统调用
    if raw.contains('\0') {
        return Err(AppError::InvalidPath("路径包含非法字符".into()));
    }

    let candidate = Path::new(raw);
    let joined = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        match base {
            Some(b) => b.join(candidate),
            None => std::env::current_dir()
                .map_err(|e| AppError::from_io(raw, e))?
                .join(candidate),
        }
    };

    Ok(lexical_fold(&joined))
}

/// 纯词法折叠：处理 `.` 与 `..`，不触碰文件系统。
///
/// 与 `canonicalize` 不同，目标文件不必存在，因此新建文件场景同样可用。
fn lexical_fold(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                // 只在能回退普通目录段时弹出；前缀/根目录保持不变
                if matches!(out.components().next_back(), Some(Component::Normal(_))) {
                    out.pop();
                } else if !out.has_root() {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    if out.as_os_str().is_empty() {
        out.push(".");
    }
    out
}

/// 取文件名用于展示。
pub fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// 转为正斜杠的字符串，跨平台一致，便于前端比较与去重。
pub fn to_slash(path: &Path) -> String {
    let s = path.to_string_lossy();
    if cfg!(windows) {
        s.replace('\\', "/")
    } else {
        s.into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_and_nul() {
        assert!(normalize("", None).is_err());
        assert!(normalize("   ", None).is_err());
        assert!(normalize("a\0b", None).is_err());
    }

    #[test]
    fn folds_parent_segments_lexically() {
        let base = Path::new(r"C:\proj");
        let got = normalize(r"src\..\lib\main.rs", Some(base)).unwrap();
        assert_eq!(to_slash(&got), "C:/proj/lib/main.rs");
    }

    #[test]
    fn keeps_absolute_paths() {
        let got = normalize(r"C:\proj\a.txt", None).unwrap();
        assert_eq!(to_slash(&got), "C:/proj/a.txt");
    }

    #[test]
    fn target_need_not_exist() {
        // 新建文件场景：路径不存在也必须能规范化
        let got = normalize(r"C:\proj\brand-new-file.txt", None).unwrap();
        assert_eq!(to_slash(&got), "C:/proj/brand-new-file.txt");
    }

    #[test]
    fn display_name_handles_both_separators() {
        assert_eq!(display_name(Path::new(r"C:\a\b\c.md")), "c.md");
        assert_eq!(display_name(Path::new("/a/b/c.md")), "c.md");
    }
}
