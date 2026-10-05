//! 原子写入。
//!
//! ## 为什么必须原子
//!
//! 直接 `fs::write` 覆盖目标文件时，进程若在写到一半时崩溃或断电，
//! 磁盘上留下的是「既不是旧版也不是新版」的残缺文件——用户多年的文件就此报废。
//!
//! 标准做法只有一句：**先在同目录写临时文件 → fsync 落盘 → rename 覆盖原文件**。
//! `rename` 在文件系统层面是原子的，因此任何时刻读到的要么是完整旧版、
//! 要么是完整新版，不存在中间态。
//!
//! ## 三个容易做错的细节
//!
//! 1. **临时文件必须在目标文件同目录**。跨设备的 `rename` 不是原子操作，
//!    会退化成「拷贝 + 删除」，原子性就没了。
//! 2. **rename 之前必须 fsync**。只 flush 到操作系统缓存是不够的——
//!    断电时缓存里的内容仍会丢，可能留下一个空的或截断的目标文件。
//! 3. **Windows 上目标被占用时 rename 会失败**（例如杀毒软件正在扫描、
//!    另一个程序打开了该文件）。这里做几次退避重试；仍失败则如实报错，
//!    **绝不退化成「先删目标再改名」**——那会打开一个「文件已删但新文件还没到位」
//!    的窗口，比直接失败更危险。

use std::io::Write;
use std::path::Path;
use std::time::Duration;

use crate::core::paths;
use crate::model::{AppError, AppResult};

/// rename 失败后的重试次数与起始退避时长。
const RENAME_RETRIES: u32 = 3;
const RENAME_BACKOFF_MS: u64 = 40;

/// 临时文件后缀。带上进程号，避免同一文件被并发保存时互相覆盖。
fn temp_path(target: &Path) -> std::path::PathBuf {
    let mut name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    name.push_str(&format!(".sesame-{}.tmp", std::process::id()));
    target.with_file_name(name)
}

/// 把已打开的临时文件落盘并原子替换目标。
///
/// `writer` 负责往临时文件里写内容；它返回后本函数会 flush + fsync 再 rename。
fn commit<F>(target: &Path, writer: F) -> AppResult<()>
where
    F: FnOnce(&mut std::fs::File) -> AppResult<()>,
{
    let slash = paths::to_slash(target);
    let tmp = temp_path(target);

    // 用闭包包住，确保任何一步失败都会清理临时文件
    let result = (|| -> AppResult<()> {
        let mut file = std::fs::File::create(&tmp).map_err(|e| AppError::from_io(&slash, e))?;

        writer(&mut file)?;

        // 先把用户态缓冲刷进内核，再让内核把数据真正写到盘上。
        // 少了 sync_all，断电时 rename 可能先于数据落盘，
        // 结果是「文件名对了但内容是空的」——这是最隐蔽的一种损坏。
        file.flush().map_err(|e| AppError::from_io(&slash, e))?;
        file.sync_all().map_err(|e| AppError::from_io(&slash, e))?;

        drop(file);

        rename_with_retry(&tmp, target).map_err(|e| AppError::from_io(&slash, e))
    })();

    if result.is_err() {
        // 失败时清理临时文件，避免在用户目录里留垃圾
        let _ = std::fs::remove_file(&tmp);
    }

    result
}

/// 带退避重试的 rename。
///
/// Windows 上目标文件被其他进程占用时 rename 会返回失败，
/// 但占用往往是短暂的（杀毒扫描、索引服务），重试即可成功。
fn rename_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut last_err = None;

    for attempt in 0..RENAME_RETRIES {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt + 1 < RENAME_RETRIES {
                    std::thread::sleep(Duration::from_millis(
                        RENAME_BACKOFF_MS * (attempt as u64 + 1),
                    ));
                }
            }
        }
    }

    Err(last_err.unwrap_or_else(|| std::io::Error::other("rename 失败")))
}

/// 原子地把一段字节写入目标文件。
///
/// 内容已在内存里时用这个。
pub fn write_bytes(target: &Path, bytes: &[u8]) -> AppResult<()> {
    commit(target, |file| {
        file.write_all(bytes)
            .map_err(|e| AppError::from_io(&paths::to_slash(target), e))
    })
}

/// 原子地写入：先写一段内存中的字节，再从另一个文件流式追加剩余部分。
///
/// 大文件保存用这个——编辑器只持有前缀，尾部仍在原文件里，
/// 需要把两者拼起来。全程流式搬运，内存占用恒定。
///
/// `source` 是要追加的来源文件；`from_offset` 是追加起点。
/// 注意调用方需保证 `source` 与 `target` 是同一个文件时也能正确工作：
/// 这里先把来源读到临时文件，最后才 rename，因此不会读到写了一半的目标。
pub fn write_bytes_then_copy(
    target: &Path,
    head: &[u8],
    source: &Path,
    from_offset: u64,
) -> AppResult<()> {
    use std::io::{Read, Seek, SeekFrom};

    let slash = paths::to_slash(target);

    // 先打开来源并定位。必须在 commit 之外打开，
    // 这样即使来源就是 target，也是先读后写（rename 在最后）。
    let mut src = std::fs::File::open(source).map_err(|e| AppError::from_io(&slash, e))?;
    let total = src
        .metadata()
        .map_err(|e| AppError::from_io(&slash, e))?
        .len();

    // 起点超出文件长度时（文件被外部改小）只保留可用部分，不报错
    src.seek(SeekFrom::Start(from_offset.min(total)))
        .map_err(|e| AppError::from_io(&slash, e))?;

    commit(target, |file| {
        file.write_all(head)
            .map_err(|e| AppError::from_io(&slash, e))?;

        // 分块搬运，内存占用恒定
        let mut buf = vec![0u8; 256 * 1024];
        loop {
            let n = src
                .read(&mut buf)
                .map_err(|e| AppError::from_io(&slash, e))?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n])
                .map_err(|e| AppError::from_io(&slash, e))?;
        }

        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 建一个临时目录，测试结束由调用方清理。
    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("sesame-atomic-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_new_file() {
        let dir = temp_dir("new");
        let target = dir.join("a.txt");

        write_bytes(&target, b"hello").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "hello");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn replaces_existing_file_atomically() {
        let dir = temp_dir("replace");
        let target = dir.join("a.txt");
        std::fs::write(&target, b"old").unwrap();

        write_bytes(&target, b"new content").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "new content");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn leaves_no_temp_files_behind() {
        let dir = temp_dir("clean");
        let target = dir.join("a.txt");

        write_bytes(&target, b"x").unwrap();

        // 目录里只应有目标文件，不该残留 .tmp
        let names: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names.len(), 1, "残留了临时文件：{names:?}");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_variant_joins_head_and_tail() {
        let dir = temp_dir("append");
        let target = dir.join("a.txt");
        // 索引：H0 E1 A2 D3 -4 T5 A6 I7 L8
        std::fs::write(&target, b"HEAD-TAIL").unwrap();

        // 用 "NEW-" 覆盖前 5 字节，尾部从第 5 字节（'T'）起保留，即 "TAIL"
        write_bytes_then_copy(&target, b"NEW-", &target, 5).unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "NEW-TAIL");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_offset_beyond_end_keeps_head_only() {
        let dir = temp_dir("beyond");
        let target = dir.join("a.txt");
        std::fs::write(&target, b"short").unwrap();

        // 起点远超文件长度：尾部为空，结果就是 head
        write_bytes_then_copy(&target, b"only", &target, 9999).unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "only");

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 记录 `write_bytes_then_copy` 的契约：`from_offset` 必须是**来源文件当前**
    /// 的偏移，而不是某次历史读取留下的旧值。
    ///
    /// 不变量：一次保存写出长度为 L 的前缀后，**下次的偏移就是 L**——
    /// 因为新文件的前 L 字节正是刚才写出的前缀，其后的才是未加载的尾部。
    /// 本函数本身没有错，错在调用方沿用了旧偏移。这里把契约写死，
    /// 免得后人以为「函数会自己修正偏移」。
    #[test]
    fn append_offset_is_relative_to_the_source_as_it_is_now() {
        let dir = temp_dir("contract");
        let target = dir.join("a.txt");
        std::fs::write(&target, b"ABCDEFGH").unwrap();

        // 编辑器原本只加载了 "ABCD"（4 字节），插入 "X" 后前缀变成 5 字节。
        // 尾部取原文件 bytes[4..] = "EFGH"。
        write_bytes_then_copy(&target, b"XABCD", &target, 4).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "XABCDEFGH");
        // 写出的前缀长度是 5 → 下次保存的偏移就该是 5
        let next_offset = 5u64;

        // 再插入 "Y"，前缀变 6 字节；尾部取当前文件 bytes[5..] = "EFGH"。
        // 若误用第一次的旧偏移 4，会得到 "YXABCDDEFGH"（"D" 被重复）。
        write_bytes_then_copy(&target, b"YXABCD", &target, next_offset).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "YXABCDEFGH");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
