//! 文件系统相关命令：打开、保存、读取元数据、分块读取。
//!
//! 所有涉及真实磁盘 IO 的命令都把同步实现放进 `spawn_blocking`，
//! 避免阻塞 Tauri 的异步运行时（大文件读写尤其明显）。

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::constants::{
    CHUNK_SIZE, ENCODING_PROBE_BYTES, INLINE_READ_LIMIT, MAX_CHUNK_SIZE, MAX_WRITE_BYTES,
};
use crate::core::{encoding, lang_map, paths, sniff};
use crate::model::{AppError, AppResult, FileMeta, FilePayload, SaveResult, TextChunk};
use crate::state::{AppState, Fingerprint, OpenFile};

/// 把 `SystemTime` 转为 Unix 毫秒时间戳。
fn to_millis(t: std::time::SystemTime) -> Option<u64> {
    t.duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

/// 在阻塞线程池上执行同步 IO，并把它可能发生的 panic 转成领域错误。
async fn blocking<T, F>(f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(AppError::from_join)?
}

/// 读取文件元数据。
fn read_meta(path: &Path) -> AppResult<FileMeta> {
    let meta = std::fs::metadata(path).map_err(|e| AppError::from_io(&paths::to_slash(path), e))?;

    if !meta.is_file() {
        return Err(AppError::NotAFile(paths::to_slash(path)));
    }

    Ok(FileMeta {
        path: paths::to_slash(path),
        name: paths::display_name(path),
        size: meta.len(),
        modified: meta.modified().ok().and_then(to_millis),
        modified_ns: meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos().to_string()),
        readonly: meta.permissions().readonly(),
    })
}

/// 取文件指纹（mtime + 大小），用于外部修改检测。
///
/// 对 crate 内可见：图片写回（`commands/media.rs`）要用同一套判定，
/// 另写一份必然与这里漂移。
pub(crate) fn fingerprint(path: &Path) -> AppResult<Fingerprint> {
    let meta = std::fs::metadata(path).map_err(|e| AppError::from_io(&paths::to_slash(path), e))?;
    Ok(Fingerprint {
        modified_ns: meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos().to_string()),
        size: meta.len(),
    })
}

/// 打开文件的同步实现。
///
/// `forced` 是用户**手动指定**的编码。为 `None` 时按 BOM → UTF-8 → GBK 自动探测；
/// 有值时完全跳过探测，直接按该编码解码。
///
/// 为什么需要手动指定：探测不可能全对。实测 Big5、Shift_JIS 与无 BOM 的
/// UTF-16LE 都会被判成 GBK，显示为乱码。GBK 的编解码可逆，所以保存不会
/// 损坏文件，但用户看不到正确内容——必须给一个纠正的出口。
fn open_file_sync(resolved: PathBuf, forced: Option<String>) -> AppResult<FilePayload> {
    use std::io::Read;

    let slash = paths::to_slash(&resolved);
    let meta = read_meta(&resolved)?;

    // 用户指定编码时跳过探测。用 BOM 与内容一致的方式解码。
    let decode_with = |bytes: &[u8]| -> encoding::Decoded {
        match forced.as_deref() {
            Some(label) => encoding::decode_as(bytes, label),
            None => encoding::decode(bytes),
        }
    };

    // 超大文件不内联读取，交给分块模式
    if meta.size > INLINE_READ_LIMIT {
        let (language, _) = lang_map::detect_language(&slash);

        // 编码与换行风格都必须在这里探明：
        // - 分块读取要按正确编码逐块解码。早先硬编码 utf-8，GBK 大文件每块都
        //   解不出内容、next_offset 永不前进，加载卡在 0%（实测的死循环）。
        // - 保存时要用原换行风格写回。早先硬编码 lf，CRLF 文件被写成混合行尾，
        //   且「前缀字节数」与实际写出的字节数不再一致，导致尾部错位、
        //   整段内容被跳过（实测 90000 行变成 78482 行）。
        let mut head = vec![0u8; ENCODING_PROBE_BYTES];
        let read = std::fs::File::open(&resolved)
            .and_then(|mut f| f.read(&mut head))
            .map_err(|e| AppError::from_io(&slash, e))?;
        head.truncate(read);
        let probed = match forced.as_deref() {
            Some(label) => encoding::decode_as(&head, label),
            None => encoding::decode_probe(&head),
        };
        let line_ending = encoding::detect_line_ending(&probed.text);

        return Ok(FilePayload {
            meta,
            content: String::new(),
            language: language.to_string(),
            encoding: probed.label.to_string(),
            has_bom: probed.has_bom,
            line_ending: line_ending.to_string(),
            truncated: true,
            decode_lossy: false,
        });
    }

    let mut bytes = Vec::new();
    std::fs::File::open(&resolved)
        .and_then(|f| f.take(INLINE_READ_LIMIT + 1).read_to_end(&mut bytes))
        .map_err(|e| AppError::from_io(&slash, e))?;
    if bytes.len() as u64 > INLINE_READ_LIMIT {
        return Err(AppError::Conflict(slash));
    }
    let decoded = decode_with(&bytes);
    let line_ending = encoding::detect_line_ending(&decoded.text);

    // 扩展名判定置信度低时，用内容特征补充
    let (mut language, confidence) = lang_map::detect_language(&slash);
    if confidence < 0.6 {
        if let Some((sniffed, sniff_conf)) = sniff::sniff_language(&decoded.text) {
            if sniff_conf > confidence {
                language = sniffed;
            }
        }
    }

    Ok(FilePayload {
        meta,
        // 统一换行，编辑器内部只处理 \n
        content: encoding::normalize_newlines(&decoded.text),
        language: language.to_string(),
        encoding: decoded.label.to_string(),
        has_bom: decoded.has_bom,
        line_ending: line_ending.to_string(),
        truncated: false,
        decode_lossy: encoding::decoding_is_lossy(&bytes, decoded.label),
    })
}

/// 打开文件：读取内容、探测语言与编码。
///
/// `encoding` 为用户**手动指定**的编码。为 `None` 时自动探测；
/// 有值时跳过探测直接按它解码（用于纠正误判，见 `open_file_sync`）。
#[tauri::command]
pub async fn open_file(
    path: String,
    encoding: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<FilePayload> {
    let resolved = paths::normalize(&path, None)?;
    let slash = paths::to_slash(&resolved);

    let payload = blocking({
        let probe = resolved.clone();
        move || {
            let before = fingerprint(&probe)?;
            let payload = open_file_sync(resolved, encoding)?;
            // 连同指纹一起返回，作为本次编辑的「持久化基线」
            let after = fingerprint(&probe)?;
            if before != after {
                return Err(AppError::Conflict(paths::to_slash(&probe)));
            }
            Ok((payload, after))
        }
    })
    .await?;
    let (payload, baseline) = payload;

    state.remember(
        slash,
        OpenFile {
            encoding: if payload.decode_lossy {
                "binary".into()
            } else {
                payload.encoding.clone()
            },
            line_ending: payload.line_ending.clone(),
            has_bom: payload.has_bom,
            baseline,
        },
    );

    Ok(payload)
}

/// 列出可供用户手动选择的编码。
///
/// 由后端提供而不是前端硬编码：真实可用的编码由 `encoding_for` 决定，
/// 两边各写一份必然漂移。前端拿到的是能保证解码成功的标签。
#[tauri::command]
pub fn list_encodings() -> Vec<String> {
    encoding::SELECTABLE_ENCODINGS
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// 保存文件的同步实现（内容即全文）。
fn save_file_sync(
    resolved: PathBuf,
    content: String,
    enc: String,
    ending: String,
    bom: bool,
) -> AppResult<SaveResult> {
    let slash = paths::to_slash(&resolved);

    if content.len() > MAX_WRITE_BYTES {
        return Err(AppError::TooLarge {
            size: content.len() as u64,
            limit: MAX_WRITE_BYTES as u64,
        });
    }

    let text = encoding::apply_line_ending(&content, &ending);
    let bytes = encoding::encode(&text, &enc, bom)?;
    if bytes.len() > MAX_WRITE_BYTES {
        return Err(AppError::TooLarge {
            size: bytes.len() as u64,
            limit: MAX_WRITE_BYTES as u64,
        });
    }

    /*
     * 原子写入。
     *
     * 早先直接 `fs::write` 覆盖目标：写到一半崩溃或断电，
     * 用户文件会变成「既不是旧版也不是新版」的残缺内容。
     * 现在统一走 `atomic::write_bytes`（临时文件 + fsync + rename）。
     */
    crate::core::atomic::write_bytes(&resolved, &bytes)?;

    let meta = read_meta(&resolved)?;
    Ok(SaveResult {
        path: slash,
        size: meta.size,
        modified: meta.modified,
        modified_ns: meta.modified_ns,
        // 普通保存：内容即全文，没有「前缀边界」这回事
        prefix_bytes: None,
    })
}

/// 大文件保存：把「编辑器持有的前缀」与「磁盘上未加载的尾部」拼成完整文件。
///
/// 这是大文件保存的正解：编辑器只持有前 N 字节，其余仍在磁盘上，
/// 因此写出前缀后，把原文件从 `prefix_bytes` 起的内容原样追加即可。
/// 既不需要把整个文件读进内存，也不会丢内容。
///
/// 先写临时文件再原子替换，避免中途失败把原文件毁掉。
#[cfg(test)]
fn save_large_file_sync(
    resolved: PathBuf,
    prefix: String,
    prefix_bytes: u64,
    enc: String,
    ending: String,
    bom: bool,
) -> AppResult<SaveResult> {
    save_large_file_from_sync(
        resolved.clone(),
        prefix,
        prefix_bytes,
        enc,
        ending,
        bom,
        resolved,
    )
}

fn save_large_file_from_sync(
    resolved: PathBuf,
    prefix: String,
    prefix_bytes: u64,
    enc: String,
    ending: String,
    bom: bool,
    source: PathBuf,
) -> AppResult<SaveResult> {
    let slash = paths::to_slash(&resolved);

    // 先编码编辑器持有的部分
    let text = encoding::apply_line_ending(&prefix, &ending);
    let head = encoding::encode(&text, &enc, bom)?;

    if head.len() as u64 > MAX_WRITE_BYTES as u64 {
        return Err(AppError::TooLarge {
            size: head.len() as u64,
            limit: MAX_WRITE_BYTES as u64,
        });
    }

    /*
     * 正确性依据：`prefix_bytes` 是「首个未加载字节」在原文件中的偏移，
     * 因此从该处复制的尾部与编辑器持有的前缀正好拼成完整内容。
     *
     * 这里**不能**要求 `head.len() == prefix_bytes`：用户在前缀里增删字符后，
     * 两者本来就会不等，而结果依然正确（前缀 = 编辑后的内容，尾部 = 原始未加载部分）。
     * 唯一的前提是调用方传的 `prefix_bytes` 确实是加载边界，这一点由前端
     * 依据 `read_chunk` 返回的 `nextOffset` 保证。
     *
     * 换行风格必须按原样写回（见 `open_file_sync` 的探测）：若原文件是 CRLF
     * 却按 LF 写回，前缀会短一截，整个文件变成混合行尾。
     *
     * 拼接同样走原子写入：临时文件 + fsync + rename。
     * 来源就是目标本身也没问题——`write_bytes_then_copy` 先把来源读进临时文件，
     * rename 放在最后，因此不会读到写了一半的目标。
     */
    let source_size = std::fs::metadata(&source)
        .map_err(|e| AppError::from_io(&paths::to_slash(&source), e))?
        .len();
    if prefix_bytes > source_size {
        return Err(AppError::Conflict(paths::to_slash(&source)));
    }
    let output_size = head.len() as u64 + source_size - prefix_bytes;
    if output_size > MAX_WRITE_BYTES as u64 {
        return Err(AppError::TooLarge {
            size: output_size,
            limit: MAX_WRITE_BYTES as u64,
        });
    }
    crate::core::atomic::write_bytes_then_copy(&resolved, &head, &source, prefix_bytes)?;

    let meta = read_meta(&resolved)?;
    Ok(SaveResult {
        path: slash,
        size: meta.size,
        modified: meta.modified,
        modified_ns: meta.modified_ns,
        /*
         * 回传**新文件中前缀的真实长度**（即 `head.len()`），而不是调用方传来的
         * `prefix_bytes`。
         *
         * 两者在用户编辑过前缀之后就不相等了：`prefix_bytes` 是旧文件的加载边界，
         * 而新文件里前缀已经变成 `head`。前端必须拿这个新值作为下次保存的偏移，
         * 否则尾部会从错误位置复制，内容重复——实测每保存一次文件就变长一截。
         */
        prefix_bytes: Some(head.len() as u64),
    })
}

/// 保存文件。按读取时记录的编码与换行风格写回。
///
/// 两条防御性检查：
/// - **拒绝对已知的二进制文件写入文本**。前端图片查看器本不该调用保存，
///   但这条判断放在 Rust 侧才真正安全——曾经真的发生过图片标签按 Ctrl+S
///   把 PNG 截成 0 字节。
/// - **大文件只写前缀**：`prefix_bytes` 有值时表示编辑器只持有文件的前一部分，
///   此时把旧文件从该偏移起的尾部原样追加，而不是用前缀覆盖整个文件。
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOptions {
    encoding_label: Option<String>,
    line_ending: Option<String>,
    has_bom: Option<bool>,
    prefix_bytes: Option<u64>,
    source_path: Option<String>,
    force: Option<bool>,
    expected: Option<Fingerprint>,
}

#[tauri::command]
pub async fn save_file(
    path: String,
    content: String,
    options: Option<SaveOptions>,
    app: AppHandle,
) -> AppResult<SaveResult> {
    let options = options.unwrap_or_default();
    blocking(move || {
        let resolved = paths::normalize(&path, None)?;
        let source = options
            .source_path
            .as_deref()
            .map(|p| paths::normalize(p, None))
            .transpose()?
            .unwrap_or_else(|| resolved.clone());
        let state = app.state::<AppState>();
        let first = state.file_gate(&resolved)?;
        let second = state.file_gate(&source)?;
        let mut gates = vec![first];
        if !std::sync::Arc::ptr_eq(&gates[0], &second) {
            gates.push(second);
        }
        // Every two-path operation takes locks in pointer order, preventing deadlocks.
        gates.sort_by_key(|gate| std::sync::Arc::as_ptr(gate) as usize);
        let _guards = gates
            .iter()
            .map(|gate| {
                gate.lock()
                    .map_err(|_| AppError::Io("文件写入锁失效".into()))
            })
            .collect::<AppResult<Vec<_>>>()?;
        let slash = paths::to_slash(&resolved);
        let source_slash = paths::to_slash(&source);
        let known = state.recall(&source_slash);
        let target_known = state.recall(&slash);
        if known
            .as_ref()
            .is_some_and(|k| encoding::is_binary_label(&k.encoding))
            || target_known
                .as_ref()
                .is_some_and(|k| encoding::is_binary_label(&k.encoding))
            || options
                .encoding_label
                .as_deref()
                .is_some_and(encoding::is_binary_label)
        {
            return Err(AppError::Unsupported(format!(
                "这是一个二进制文件：{slash}"
            )));
        }
        if lang_map::image_mime(&slash).is_some_and(|mime| mime != "image/svg+xml") {
            return Err(AppError::Unsupported(format!("这是一个图片文件：{slash}")));
        }
        let enc = options
            .encoding_label
            .or_else(|| known.as_ref().map(|k| k.encoding.clone()))
            .unwrap_or_else(|| "utf-8".into());
        let ending = options
            .line_ending
            .or_else(|| known.as_ref().map(|k| k.line_ending.clone()))
            .unwrap_or_else(|| "lf".into());
        let bom = options
            .has_bom
            .unwrap_or_else(|| known.as_ref().is_some_and(|k| k.has_bom));
        if !options.force.unwrap_or(false) {
            if let Some(expected) = options
                .expected
                .as_ref()
                .or_else(|| known.as_ref().map(|k| &k.baseline))
            {
                if fingerprint(&source).ok().as_ref() != Some(expected) {
                    return Err(AppError::Conflict(source_slash));
                }
            }
            if source != resolved {
                if let Some(target) = target_known.as_ref() {
                    if fingerprint(&resolved).ok().as_ref() != Some(&target.baseline) {
                        return Err(AppError::Conflict(slash));
                    }
                }
            }
        }
        let result = match options.prefix_bytes {
            Some(prefix) => save_large_file_from_sync(
                resolved.clone(),
                content,
                prefix,
                enc.clone(),
                ending.clone(),
                bom,
                source,
            )?,
            None => save_file_sync(resolved.clone(), content, enc.clone(), ending.clone(), bom)?,
        };
        state.remember(
            slash,
            OpenFile {
                encoding: enc,
                line_ending: ending,
                has_bom: bom,
                baseline: Fingerprint {
                    modified_ns: result.modified_ns.clone(),
                    size: result.size,
                },
            },
        );
        Ok(result)
    })
    .await
}
/// 读取文件元数据。
#[tauri::command]
pub async fn stat_file(path: String) -> AppResult<FileMeta> {
    let resolved = paths::normalize(&path, None)?;
    blocking(move || read_meta(&resolved)).await
}

/// 分块读取的同步实现。
///
/// 两个关键点，缺一不可：
///
/// 1. **按文件真实编码解码**，而不是假定 UTF-8。非 UTF-8（如 GBK）文件若按
///    UTF-8 解析，整块都是「非法序列」，什么都解不出来。
/// 2. **保证 `next_offset` 一定前进**。否则调用方会一直请求同一位置，
///    形成死循环——这正是早先 GBK 大文件卡在 0% 的原因。
fn read_chunk_sync(
    resolved: PathBuf,
    offset: u64,
    want: u64,
    encoding_label: Option<String>,
) -> AppResult<TextChunk> {
    use std::io::{Read, Seek, SeekFrom};

    let slash = paths::to_slash(&resolved);
    let meta = read_meta(&resolved)?;

    let mut file = std::fs::File::open(&resolved).map_err(|e| AppError::from_io(&slash, e))?;

    let start = offset.min(meta.size);
    file.seek(SeekFrom::Start(start))
        .map_err(|e| AppError::from_io(&slash, e))?;

    // 多读若干字节，供解码器处理跨块的残缺多字节序列
    let mut buf = vec![0u8; want as usize + 8];
    let read = file
        .read(&mut buf)
        .map_err(|e| AppError::from_io(&slash, e))?;
    buf.truncate(read);

    let eof = start + read as u64 >= meta.size;

    if read == 0 {
        return Ok(TextChunk {
            content: String::new(),
            offset: start,
            next_offset: start,
            eof: true,
        });
    }

    // Allocate for the decoder's worst-case UTF-8 expansion, not input bytes.
    // Non-final chunks must end in a complete character because each IPC read
    // creates a fresh decoder. Probe its pending tail by flushing an empty input.
    let label = encoding_label.unwrap_or_else(|| "utf-8".to_string());
    let enc = encoding::encoding_for(&label);
    let bom_len = if start == 0 {
        encoding_rs::Encoding::for_bom(&buf)
            .filter(|(bom, _)| *bom == enc)
            .map(|(_, len)| len)
            .unwrap_or(0)
    } else {
        0
    };
    let mut end = buf.len();
    loop {
        let mut decoder = enc.new_decoder_without_bom_handling();
        let capacity = decoder
            .max_utf8_buffer_length(end)
            .unwrap_or(end.saturating_mul(3) + 16);
        let mut text = String::with_capacity(capacity);
        let (result, consumed, malformed) =
            decoder.decode_to_string(&buf[bom_len..end], &mut text, eof);
        if malformed {
            return Err(AppError::Unsupported(
                "此块无法按所选编码完整解码，请重新选择编码".into(),
            ));
        }
        if result == encoding_rs::CoderResult::OutputFull || consumed != end - bom_len {
            return Err(AppError::Io("分块解码未消费全部输入".into()));
        }
        if !eof {
            let mut tail = String::with_capacity(16);
            let (_, _, incomplete) = decoder.decode_to_string(&[], &mut tail, true);
            let trailing_cr = text.ends_with('\r');
            if incomplete || trailing_cr {
                let step = if trailing_cr
                    && (enc == encoding_rs::UTF_16LE || enc == encoding_rs::UTF_16BE)
                {
                    2
                } else {
                    1
                };
                if end <= step {
                    // A requested block is too small to contain a complete character.
                    return Err(AppError::InvalidPath("分块长度不足以容纳完整字符".into()));
                }
                end -= step;
                continue;
            }
        }
        return Ok(TextChunk {
            content: text,
            offset: start,
            next_offset: start + end as u64,
            eof: eof && start + end as u64 >= meta.size,
        });
    }
}

/// 分块读取：按字节偏移读取一段文本。
///
/// `encodingLabel` 由前端传入（打开文件时已探明）；缺省按 UTF-8 处理。
#[tauri::command]
pub async fn read_chunk(
    path: String,
    offset: u64,
    length: Option<u64>,
    encoding_label: Option<String>,
    expected: Option<Fingerprint>,
    state: State<'_, AppState>,
) -> AppResult<TextChunk> {
    let resolved = paths::normalize(&path, None)?;
    let want = length.unwrap_or(CHUNK_SIZE).min(MAX_CHUNK_SIZE);
    let baseline = expected.or_else(|| {
        state
            .recall(&paths::to_slash(&resolved))
            .map(|known| known.baseline)
    });
    blocking(move || {
        let before = fingerprint(&resolved)?;
        if baseline
            .as_ref()
            .is_some_and(|expected| *expected != before)
        {
            return Err(AppError::Conflict(paths::to_slash(&resolved)));
        }
        let part = read_chunk_sync(resolved.clone(), offset, want, encoding_label)?;
        if fingerprint(&resolved)? != before {
            return Err(AppError::Conflict(paths::to_slash(&resolved)));
        }
        Ok(part)
    })
    .await
}

/// 关闭文件时清理状态记录。
#[tauri::command]
pub async fn close_file(path: String, state: State<'_, AppState>) -> AppResult<()> {
    let resolved = paths::normalize(&path, None)?;
    state.forget(&paths::to_slash(&resolved));
    Ok(())
}

/// 取出启动时命令行传入的文件路径。
///
/// 前端挂载后调用一次；返回后列表即被清空，重复调用不会重复打开。
#[tauri::command]
pub async fn take_startup_files(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    Ok(state.take_startup_files())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audit_invalid_utf8_with_bom_is_readonly_and_not_silently_rewritten() {
        let dir = temp_dir("audit-lossy");
        let target = dir.join("text.txt");
        let bytes = b"\xef\xbb\xbfvalid text \xff";
        std::fs::write(&target, bytes).unwrap();
        let payload = open_file_sync(target.clone(), None).unwrap();
        assert!(payload.decode_lossy);
        assert_eq!(payload.encoding, "utf-8");
        assert!(read_chunk_sync(target.clone(), 0, 4096, Some("utf-8".into())).is_err());
        assert_eq!(std::fs::read(target).unwrap(), bytes);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn audit_chunks_preserve_utf16_surrogates_and_crlf() {
        for label in ["utf-8", "gbk", "utf-16le", "utf-16be"] {
            let dir = temp_dir(&format!("audit-boundary-{label}"));
            let target = dir.join("text.txt");
            let expected = if label == "gbk" {
                "中文\r\n"
            } else {
                "中文🙂\r\n"
            }
            .repeat(60);
            std::fs::write(
                &target,
                encoding::encode(&expected, label, label != "gbk").unwrap(),
            )
            .unwrap();
            let mut offset = 0;
            let mut actual = String::new();
            loop {
                let part = read_chunk_sync(target.clone(), offset, 13, Some(label.into())).unwrap();
                assert!(part.eof || part.next_offset > offset);
                actual.push_str(&encoding::normalize_newlines(&part.content));
                offset = part.next_offset;
                if part.eof {
                    break;
                }
            }
            assert_eq!(actual, encoding::normalize_newlines(&expected), "{label}");
            std::fs::remove_dir_all(dir).unwrap();
        }
    }

    #[test]
    fn audit_save_as_keeps_the_source_tail_and_source_file() {
        let dir = temp_dir("audit-save-as");
        let source = dir.join("source.txt");
        let target = dir.join("target.txt");
        std::fs::write(&source, b"HEAD-UNREAD-TAIL").unwrap();
        let result = save_large_file_from_sync(
            target.clone(),
            "EDITED".into(),
            4,
            "utf-8".into(),
            "lf".into(),
            false,
            source.clone(),
        )
        .unwrap();
        assert_eq!(std::fs::read(&source).unwrap(), b"HEAD-UNREAD-TAIL");
        assert_eq!(std::fs::read(&target).unwrap(), b"EDITED-UNREAD-TAIL");
        assert_eq!(result.prefix_bytes, Some(6));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn audit_unmappable_save_leaves_original_bytes_intact() {
        let dir = temp_dir("audit-unmappable");
        let target = dir.join("text.txt");
        std::fs::write(&target, b"original").unwrap();
        assert!(save_file_sync(
            target.clone(),
            "emoji 🙂".into(),
            "gbk".into(),
            "lf".into(),
            false
        )
        .is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"original");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn audit_chunk_boundaries_preserve_multibyte_text() {
        let dir = temp_dir("audit-chunks");
        let target = dir.join("text.txt");
        let expected = "中文🙂".repeat(30);
        std::fs::write(&target, expected.as_bytes()).unwrap();
        let mut offset = 0;
        let mut actual = String::new();
        loop {
            let part = read_chunk_sync(target.clone(), offset, 9, Some("utf-8".into())).unwrap();
            actual.push_str(&part.content);
            offset = part.next_offset;
            if part.eof {
                break;
            }
        }
        assert_eq!(actual, expected);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn audit_eof_gbk_chunk_does_not_drop_decoded_output() {
        let dir = temp_dir("audit-gbk");
        let target = dir.join("text.txt");
        let expected = "中文".repeat(50);
        std::fs::write(&target, encoding::encode(&expected, "gbk", false).unwrap()).unwrap();
        let part = read_chunk_sync(target, 0, 4096, Some("gbk".into())).unwrap();
        assert_eq!(part.content, expected);
        std::fs::remove_dir_all(dir).unwrap();
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sesame-fs-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// 大文件连续保存两次，内容必须保持一致、文件不能变长。
    ///
    /// 这是回归测试：`SaveResult.prefix_bytes` 必须回传**新文件中前缀的真实长度**。
    /// 早先前端沿用保存前的旧 `loadedBytes`，用户在前缀里增删字符后，
    /// 第二次保存会把尾部复制到错误位置，内容重复、文件每次保存都变长。
    #[test]
    fn repeated_large_file_save_does_not_duplicate_content() {
        let dir = temp_dir("repeat");
        let target = dir.join("big.txt");
        // 原始内容：前缀 "ABCD" + 尾部 "EFGH"
        std::fs::write(&target, b"ABCDEFGH").unwrap();

        // 第一次保存：前缀里插入 "X"，偏移是原文件的加载边界 4
        let first = save_large_file_sync(
            target.clone(),
            "XABCD".to_string(),
            4,
            "utf-8".to_string(),
            "lf".to_string(),
            false,
        )
        .unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "XABCDEFGH");

        // 关键：后端回传的新偏移应是写出的前缀长度 5
        let next = first.prefix_bytes.expect("大文件保存必须回传 prefixBytes");
        assert_eq!(next, 5, "回传的前缀长度不对，前端会拿旧偏移去追加");

        // 第二次保存：再插入 "Y"，用回传的偏移
        let second = save_large_file_sync(
            target.clone(),
            "YXABCD".to_string(),
            next,
            "utf-8".to_string(),
            "lf".to_string(),
            false,
        )
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(&target).unwrap(),
            "YXABCDEFGH",
            "第二次保存内容错位（内容被重复）"
        );
        assert_eq!(second.prefix_bytes, Some(6));

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 普通保存不涉及前缀边界，必须回传 `None`。
    #[test]
    fn normal_save_reports_no_prefix_bytes() {
        let dir = temp_dir("normal");
        let target = dir.join("a.txt");

        let r = save_file_sync(
            target.clone(),
            "hello".to_string(),
            "utf-8".to_string(),
            "lf".to_string(),
            false,
        )
        .unwrap();

        assert_eq!(r.prefix_bytes, None);
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "hello");

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// CRLF 文件按 CRLF 写回，字节完全一致。
    #[test]
    fn crlf_is_preserved_on_save() {
        let dir = temp_dir("crlf");
        let target = dir.join("a.txt");
        std::fs::write(&target, b"a\r\nb\r\n").unwrap();

        save_file_sync(
            target.clone(),
            "a\nb\n".to_string(),
            "utf-8".to_string(),
            "crlf".to_string(),
            false,
        )
        .unwrap();

        assert_eq!(std::fs::read(&target).unwrap(), b"a\r\nb\r\n");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
