//! 文本编码的探测、解码与编码。
//!
//! **策略：UTF-8 是一等公民，其余只是「顺带能读」。**
//!
//! - 保存一律按打开时探明的编码写回；新文件一律 UTF-8。
//! - 打开时按 BOM → 严格 UTF-8 → GBK 的顺序探测。前两步覆盖绝大多数文件。
//! - GBK 那一步是**零额外成本**的顺带支持：`encoding_rs` 已经提供解码器，
//!   我们只是多试一次。它救的是「用记事本存过的老中文文件」这类场景。
//! - 探测失败一律按有损 UTF-8 处理，保证文件能打开、内容不丢，
//!   只是可能显示替换字符。不假装支持我们没验证过的编码。
//!
//! 不做的：置信度评分、手动切换编码的 UI、以及为每种编码写专门逻辑。
//! 这些都需要持续的维护与测试，换不来实际收益。

use crate::model::{AppError, AppResult};
use encoding_rs::Encoding;

/// 判定「这根本不是文本」时允许的坏字节比例上限。
///
/// 远超编码探测用的 `MAX_BAD_RATIO`（1%）：正常文本即使编码判错，
/// 替换字符也只是零星几个；而可执行文件、压缩包、数据库这类二进制内容
/// 会有大比例字节解不出来。实测 PNG 头 + 随机数据有 48% 的替换字符。
const MAX_TEXT_BAD_RATIO: f32 = 0.10;

/// 一次解码的结果。
pub struct Decoded {
    pub text: String,
    /// 规范化小写的编码名，例如 `utf-8`、`gbk`、`utf-16le`。
    /// 值为 `binary` 表示「这不是文本」，**不允许用文本编辑器保存**。
    pub label: &'static str,
    pub has_bom: bool,
}

/// 该编码名是否代表「非文本」。
///
/// 前端与 `save_file` 都据此拒绝写入，避免把有损解码的结果写回原文件。
pub fn is_binary_label(label: &str) -> bool {
    label.eq_ignore_ascii_case("binary")
}

/// BOM 只会来自这三种编码，`Encoding::for_bom` 的返回值也仅限这三者。
fn label_of_bom(enc: &'static Encoding) -> &'static str {
    if enc == encoding_rs::UTF_8 {
        "utf-8"
    } else if enc == encoding_rs::UTF_16LE {
        "utf-16le"
    } else {
        "utf-16be"
    }
}

/// 把编码名解析回 `encoding_rs` 对象，未知名称回落到 UTF-8。
pub fn encoding_for(label: &str) -> &'static Encoding {
    match label.to_ascii_lowercase().as_str() {
        "utf-8" | "utf8" => encoding_rs::UTF_8,
        "utf-16le" | "utf16le" => encoding_rs::UTF_16LE,
        "utf-16be" | "utf16be" => encoding_rs::UTF_16BE,
        "gbk" => encoding_rs::GBK,
        "gb18030" => encoding_rs::GB18030,
        "big5" => encoding_rs::BIG5,
        "shift_jis" | "shift-jis" | "sjis" => encoding_rs::SHIFT_JIS,
        "euc-kr" | "euckr" => encoding_rs::EUC_KR,
        "windows-1252" | "cp1252" => encoding_rs::WINDOWS_1252,
        _ => encoding_rs::UTF_8,
    }
}

/// 判定「几乎可以确定是这种编码」时允许的坏字节比例。
///
/// 不能要求零错误：探测窗口是从文件中间截断的，
/// 边界处很可能把一个多字节字符切成两半，产生一两个替换字符。
/// 实测 64 KB 的窗口里只有 1 个（0.0015%），却足以让「零错误」的严格判断
/// 把整个 GBK 文件误判成 UTF-8。
const MAX_BAD_RATIO: f32 = 0.01;

/// 允许的坏字节绝对数量下限。
///
/// 只看比例在极小输入上会误判：6 字节里坏 1 个就是 16.7%。
/// 而边界残片最多只有「最大字符宽度 - 1」个（UTF-8 为 3），
/// 因此用一个小的绝对额度覆盖它，比例阈值则负责拦截真正不匹配的编码。
const MAX_BAD_ABSOLUTE: usize = 4;

/// 统计一段文本里的替换字符数量，用于估算解码错误比例。
fn replacement_count(text: &str) -> usize {
    text.matches('\u{FFFD}').count()
}

/// 把 `encoding_rs` 对象映射回**规范化的静态标签**。
///
/// `Encoding::name()` 返回的也是 `&'static str`，但大小写与拼写不一定与
/// 本项目的标签一致（它给 `"Big5"`，本项目用 `"big5"`）。
/// 统一走这张表，保证 `decode_as` 返回的 label 能被 `encoding_for` 认回来——
/// 否则「用户指定 big5 打开 → 保存」这条链会因为 label 对不上而退回 UTF-8，
/// 把文件按错误编码写回去。
fn label_for(enc: &'static Encoding) -> &'static str {
    if enc == encoding_rs::UTF_8 {
        "utf-8"
    } else if enc == encoding_rs::UTF_16LE {
        "utf-16le"
    } else if enc == encoding_rs::UTF_16BE {
        "utf-16be"
    } else if enc == encoding_rs::GBK {
        "gbk"
    } else if enc == encoding_rs::GB18030 {
        "gb18030"
    } else if enc == encoding_rs::BIG5 {
        "big5"
    } else if enc == encoding_rs::SHIFT_JIS {
        "shift_jis"
    } else if enc == encoding_rs::EUC_KR {
        "euc-kr"
    } else if enc == encoding_rs::WINDOWS_1252 {
        "windows-1252"
    } else {
        // `encoding_for` 只可能返回上表里的编码；走到这里说明两张表不同步
        "utf-8"
    }
}

/// 所有可供用户手动选择的编码标签。
///
/// 顺序即界面展示顺序：UTF 系在前（最常用），其余按地区常见度排。
/// 这份列表同时被前端的编码选择器使用（通过 `list_encodings` 命令），
/// 避免两边各维护一份而漂移。
pub const SELECTABLE_ENCODINGS: &[&str] = &[
    "utf-8",
    "utf-16le",
    "utf-16be",
    "gbk",
    "gb18030",
    "big5",
    "shift_jis",
    "euc-kr",
    "windows-1252",
];

/// 按**指定**编码解码，跳过一切探测。
///
/// 用于「用户手动指定编码重新打开」：探测不可能全对，必须给一个纠正的出口。
///
/// 与 `decode` 的两点不同：
/// 1. **完全跳过探测**，即使用户选的编码与内容不匹配也照办——用户是权威。
/// 2. **保留 BOM 判定**：若内容带 BOM 且与用户所选一致，仍按 BOM 处理，
///    否则会把 BOM 本身当成正文内容显示出来（一个不可见字符）。
///
/// 有损解码是刻意的：指定错编码时会出现替换字符，但**不会**因为
/// 解码失败而让文件打不开。用户可以再换一个编码。
pub fn decode_as(bytes: &[u8], label: &str) -> Decoded {
    if bytes.is_empty() {
        return Decoded {
            text: String::new(),
            label: label_for(encoding_for(label)),
            has_bom: false,
        };
    }

    let enc = encoding_for(label);

    // 内容带 BOM 且与所选编码一致时，剥掉 BOM 再解码
    if let Some((bom_enc, bom_len)) = Encoding::for_bom(bytes) {
        if bom_enc == enc {
            let (cow, _) = enc.decode_without_bom_handling(&bytes[bom_len..]);
            return Decoded {
                text: cow.into_owned(),
                label: label_of_bom(enc),
                has_bom: true,
            };
        }
    }

    // 用户指定的编码与 BOM 不符（或没有 BOM）：按用户所选整体解码
    let (cow, _) = enc.decode_without_bom_handling(bytes);
    Decoded {
        text: cow.into_owned(),
        label: label_for(enc),
        has_bom: false,
    }
}

/// Replacement characters introduced by decoding must never be written back silently.
pub fn decoding_is_lossy(bytes: &[u8], label: &str) -> bool {
    let enc = encoding_for(label);
    let skip = Encoding::for_bom(bytes)
        .filter(|(bom, _)| *bom == enc)
        .map(|(_, len)| len)
        .unwrap_or(0);
    enc.decode_without_bom_handling(&bytes[skip..]).1
}

/// 判断**探测窗口**的解码是否有损，容忍末尾被切断的半个字符。
///
/// 大文件的编码探测只读前 64 KB（`ENCODING_PROBE_BYTES`），窗口边界很可能
/// 正好落在某个多字节字符中间。那不是文件损坏，只是「我们没读完整」。
/// 若直接套用 `decoding_is_lossy`，任何长度不是字符宽度整数倍的探测窗口都会
/// 被判成有损，于是**所有**大文件都变成只读——把一个大文件变成打不开，
/// 比原本要修的问题更糟。
///
/// 因此这里退而求其次：整段严格解码失败时，逐字节裁掉末尾最多 3 个字节
/// （UTF-8 单字符最大 3 字节残片；UTF-16 只要裁 1 字节）再试一次。
/// 裁完能严格解出来，说明坏的就是那半个字符。
pub fn probe_is_lossy(bytes: &[u8], label: &str) -> bool {
    let enc = encoding_for(label);
    let skip = Encoding::for_bom(bytes)
        .filter(|(bom, _)| *bom == enc)
        .map(|(_, len)| len)
        .unwrap_or(0);
    let body = &bytes[skip..];

    if enc
        .decode_without_bom_handling_and_without_replacement(body)
        .is_some()
    {
        return false;
    }

    // 末尾残片最多 3 字节；不裁到空，避免把「整段都是坏字节」误判成干净。
    for trim in 1..=3usize {
        if body.len() <= trim {
            break;
        }
        if enc
            .decode_without_bom_handling_and_without_replacement(&body[..body.len() - trim])
            .is_some()
        {
            return false;
        }
    }

    true
}

/// 探测并解码字节流。
///
/// 顺序：BOM → 严格 UTF-8 → GBK（容错）→ 有损 UTF-8 兜底 → 二进制判定。
pub fn decode(bytes: &[u8]) -> Decoded {
    if bytes.is_empty() {
        return Decoded {
            text: String::new(),
            label: "utf-8",
            has_bom: false,
        };
    }

    // 1. BOM 优先，最可靠
    if let Some((enc, bom_len)) = Encoding::for_bom(bytes) {
        let (cow, _) = enc.decode_without_bom_handling(&bytes[bom_len..]);
        return Decoded {
            text: cow.into_owned(),
            label: label_of_bom(enc),
            has_bom: true,
        };
    }

    // 2. 严格 UTF-8——绝大多数文件走这条路径
    // UTF-16 BOMs were handled above; NUL-containing buffers are not ordinary text.
    if bytes.contains(&0) {
        return Decoded {
            text: String::new(),
            label: "binary",
            has_bom: false,
        };
    }

    if let Ok(s) = std::str::from_utf8(bytes) {
        return Decoded {
            text: s.to_owned(),
            label: "utf-8",
            has_bom: false,
        };
    }

    // 3. 中文环境最常见的非 UTF-8 编码。
    //    用「坏字节数量」而不是「有无坏字节」判断：
    //    少量坏字节是窗口边界把多字节字符切断造成的，不代表编码不匹配。
    let (gbk_text, _, _) = encoding_rs::GBK.decode(bytes);
    let bad = replacement_count(&gbk_text);
    let ratio = bad as f32 / bytes.len().max(1) as f32;

    if bad <= MAX_BAD_ABSOLUTE || ratio <= MAX_BAD_RATIO {
        return Decoded {
            text: gbk_text.into_owned(),
            label: "gbk",
            has_bom: false,
        };
    }

    // 4. 兜底：有损 UTF-8。
    //
    //    这里必须再判一次「是不是文本」：非 UTF-8 且非 GBK 的**二进制文件**
    //    （exe、zip、db……）也会走到这里。若直接当成 UTF-8 文本交给编辑器，
    //    用户按一次 Ctrl+S 就会把满篇 U+FFFD 写回原文件，**原文件被永久毁掉**。
    //    实测 PNG 内容有 48% 的替换字符。
    //
    //    图片另有扩展名白名单拦截，但二进制不止图片一种，因此在这里兜住。
    let (cow, _, _) = encoding_rs::UTF_8.decode(bytes);
    let lossy = cow.into_owned();
    let bad = replacement_count(&lossy);
    let ratio = bad as f32 / bytes.len().max(1) as f32;

    if bad > MAX_BAD_ABSOLUTE && ratio > MAX_TEXT_BAD_RATIO {
        return Decoded {
            text: String::new(),
            label: "binary",
            has_bom: false,
        };
    }

    Decoded {
        text: lossy,
        label: "utf-8",
        has_bom: false,
    }
}

/// A bounded probe may end in the middle of a valid UTF-8 sequence.
pub fn decode_probe(bytes: &[u8]) -> Decoded {
    if let Err(error) = std::str::from_utf8(bytes) {
        if error.error_len().is_none() && error.valid_up_to() > 0 {
            return decode(&bytes[..error.valid_up_to()]);
        }
    }
    decode(bytes)
}

/// 把文本按目标编码编码为字节，并按需补 BOM。
pub fn encode(text: &str, label: &str, with_bom: bool) -> AppResult<Vec<u8>> {
    let enc = encoding_for(label);
    // encoding_rs deliberately encodes UTF-16 output as UTF-8. Use Rust's
    // standard UTF-16 conversion and serialize code units in the required order.
    if enc == encoding_rs::UTF_16LE || enc == encoding_rs::UTF_16BE {
        let little = enc == encoding_rs::UTF_16LE;
        let mut out = Vec::with_capacity(text.len().saturating_mul(2) + 2);
        if with_bom {
            out.extend_from_slice(if little { &[0xFF, 0xFE] } else { &[0xFE, 0xFF] });
        }
        for unit in text.encode_utf16() {
            out.extend_from_slice(&if little {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            });
        }
        return Ok(out);
    }
    let (body, _, had_errors) = enc.encode(text);
    if had_errors {
        return Err(AppError::Unsupported(format!(
            "编码 {label} 无法表示部分字符，请选择 UTF-8 后保存"
        )));
    }
    let mut out = Vec::with_capacity(body.len() + 3);

    if with_bom {
        match enc.name() {
            "UTF-8" => out.extend_from_slice(&[0xEF, 0xBB, 0xBF]),
            "UTF-16LE" => out.extend_from_slice(&[0xFF, 0xFE]),
            "UTF-16BE" => out.extend_from_slice(&[0xFE, 0xFF]),
            _ => {}
        }
    }

    out.extend_from_slice(&body);
    Ok(out)
}

/// 探测换行风格。以第一个出现的换行符为准，与主流编辑器一致。
pub fn detect_line_ending(text: &str) -> &'static str {
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'\r' => {
                return if bytes.get(i + 1) == Some(&b'\n') {
                    "crlf"
                } else {
                    "cr"
                };
            }
            b'\n' => return "lf",
            _ => i += 1,
        }
    }
    "lf"
}

/// 把文本统一为 `\n`，便于编辑器内部处理。
pub fn normalize_newlines(text: &str) -> String {
    if !text.contains('\r') {
        return text.to_owned();
    }
    text.replace("\r\n", "\n").replace('\r', "\n")
}

/// 按目标风格还原换行。
pub fn apply_line_ending(text: &str, style: &str) -> String {
    let normalized = normalize_newlines(text);
    match style {
        "crlf" => normalized.replace('\n', "\r\n"),
        "cr" => normalized.replace('\n', "\r"),
        _ => normalized,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audit_double_bom_preserves_literal_leading_character() {
        let bytes = b"\xef\xbb\xbf\xef\xbb\xbftext";
        let decoded = decode(bytes);
        assert_eq!(decoded.text, "\u{feff}text");
        assert_eq!(
            encode(&decoded.text, decoded.label, decoded.has_bom).unwrap(),
            bytes
        );
    }

    #[test]
    fn audit_probe_keeps_utf8_with_truncated_final_character() {
        let mut bytes = "普通 UTF8 文本".repeat(40).into_bytes();
        bytes.extend_from_slice(&[0xf0, 0x9f]);
        let decoded = decode_probe(&bytes);
        assert_eq!(decoded.label, "utf-8");
        assert!(!decoded.text.contains('\u{fffd}'));
    }

    #[test]
    fn audit_utf16_round_trip_preserves_bytes() {
        let text = "中文🙂\r\nsecond line";
        for (label, bom) in [("utf-16le", [0xFF, 0xFE]), ("utf-16be", [0xFE, 0xFF])] {
            let mut expected = bom.to_vec();
            for unit in text.encode_utf16() {
                expected.extend_from_slice(&if label == "utf-16le" {
                    unit.to_le_bytes()
                } else {
                    unit.to_be_bytes()
                });
            }
            assert_eq!(
                encode(text, label, true).unwrap(),
                expected,
                "{label} writeback changed encoding"
            );
        }
    }

    #[test]
    fn audit_nul_binary_is_not_writable_text() {
        assert_eq!(decode(b"MZ\0\0binary header").label, "binary");
    }

    #[test]
    fn audit_unmappable_characters_are_rejected() {
        assert!(encode("emoji 🙂", "gbk", false).is_err());
        assert!(encode("中文", "windows-1252", false).is_err());
    }

    #[test]
    fn detects_utf8_without_bom() {
        let d = decode("你好，世界".as_bytes());
        assert_eq!(d.label, "utf-8");
        assert!(!d.has_bom);
        assert_eq!(d.text, "你好，世界");
    }

    #[test]
    fn detects_utf8_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("hi".as_bytes());
        let d = decode(&bytes);
        assert!(d.has_bom);
        assert_eq!(d.text, "hi");
    }

    #[test]
    fn falls_back_to_gbk_for_invalid_utf8() {
        // “中文” 的 GBK 编码
        let bytes = [0xD6, 0xD0, 0xCE, 0xC4];
        let d = decode(&bytes);
        assert_eq!(d.label, "gbk");
        assert_eq!(d.text, "中文");
    }

    #[test]
    fn gbk_survives_a_truncated_multibyte_tail() {
        // 探测窗口从文件中间截断时，末尾会留下半个双字节字符。
        // 这必须仍然判定为 GBK——早先「零错误」的严格判断在这里会误判成 UTF-8，
        // 导致整个 GBK 大文件显示为乱码。
        let mut bytes = vec![0xB5, 0xDA, 0x20, 0xD0, 0xD0]; // “第 行”
        bytes.push(0xB1); // “编”的第一个字节，缺后半

        let d = decode(&bytes);
        assert_eq!(d.label, "gbk", "末尾残缺不应导致判定失败");
        assert!(d.text.starts_with("第 行"));
    }

    #[test]
    fn genuinely_binary_data_is_not_claimed_as_gbk() {
        // 大量随机高位字节：GBK 解码会产生大量替换字符，
        // 比例远超阈值，不应被判成 gbk。
        let bytes: Vec<u8> = (0..512u32)
            .map(|i| (i.wrapping_mul(97) % 256) as u8)
            .collect();
        let d = decode(&bytes);
        assert_ne!(d.label, "gbk");
    }

    #[test]
    fn empty_input_is_utf8() {
        let d = decode(&[]);
        assert_eq!(d.label, "utf-8");
        assert_eq!(d.text, "");
    }

    #[test]
    fn round_trips_gbk() {
        let bytes = encode("中文", "gbk", false).unwrap();
        assert_eq!(bytes, vec![0xD6, 0xD0, 0xCE, 0xC4]);
    }

    #[test]
    fn detects_line_endings() {
        assert_eq!(detect_line_ending("a\nb"), "lf");
        assert_eq!(detect_line_ending("a\r\nb"), "crlf");
        assert_eq!(detect_line_ending("a\rb"), "cr");
        assert_eq!(detect_line_ending("no newline"), "lf");
    }

    #[test]
    fn normalizes_and_restores_newlines() {
        assert_eq!(normalize_newlines("a\r\nb\rc"), "a\nb\nc");
        assert_eq!(apply_line_ending("a\nb", "crlf"), "a\r\nb");
        assert_eq!(apply_line_ending("a\r\nb", "lf"), "a\nb");
    }

    #[test]
    fn binary_content_is_not_treated_as_text() {
        // PNG 文件头 + 随机高位字节：坏字节比例远超阈值，必须判为 binary。
        // 若判成 utf-8，编辑器会把满篇 U+FFFD 显示出来，
        // 用户一次 Ctrl+S 就把原文件写坏了。
        let mut png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&[0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
        for i in 0..400u32 {
            png.push(((i * 37 + 11) % 256) as u8);
        }

        let d = decode(&png);
        assert_eq!(d.label, "binary", "二进制内容被当成了文本");
        assert!(d.text.is_empty());
        assert!(is_binary_label(d.label));
    }

    #[test]
    fn all_high_bytes_are_binary() {
        let d = decode(&vec![0xFFu8; 512]);
        assert_eq!(d.label, "binary");
    }

    #[test]
    fn normal_text_is_never_flagged_binary() {
        // 正常中文、日文、含少量乱码的文本都不该被判成二进制
        for s in [
            "这是一段普通的中文文本。",
            "こんにちは世界",
            "hello world\nsecond line",
            "emoji 也行 🙂🎉",
        ] {
            let d = decode(s.as_bytes());
            assert_ne!(d.label, "binary", "误判为二进制：{s}");
            assert_eq!(d.text, s);
        }
    }

    #[test]
    fn few_replacement_chars_stay_text() {
        // 少量坏字节（截断的多字节字符）不该让整个文件被判成二进制
        let mut bytes = "正常的文本内容".as_bytes().to_vec();
        bytes.push(0xE4); // 一个不完整的 UTF-8 起始字节
        let d = decode(&bytes);
        assert_ne!(d.label, "binary");
    }

    /// 编码被误判成 GBK 后，原文件是否会被写坏？
    ///
    /// 结论（实测）：**不会**。GBK 的编解码可逆，误判只导致**显示为乱码**，
    /// 保存时字节完全一致。因此这是「观感问题」，不是「数据安全问题」——
    /// 但用户看不到正确内容，仍然需要「手动指定编码」的出口。
    ///
    /// 依据：Big5 / Shift_JIS / 无 BOM 的 UTF-16LE 样本都判成 gbk，
    /// 而 `encode(decode(x)) == x` 对三者都成立。
    #[test]
    fn misdetected_encoding_still_round_trips() {
        let cases: [(&str, Vec<u8>); 3] = [
            ("Big5", vec![0xA4, 0xA4, 0xA4, 0xE5, 0xB4, 0xFA, 0xB8, 0xD5]),
            ("Shift_JIS", vec![0x93, 0xFA, 0x96, 0x7B, 0x8C, 0xEA]),
            ("UTF-16LE 无 BOM", vec![0x2D, 0x4E, 0x87, 0x65]),
        ];

        for (name, original) in cases {
            let d = decode(&original);
            assert_eq!(d.label, "gbk", "{name} 的判定前提变了，请重新评估本测试");
            let written = encode(&d.text, d.label, d.has_bom).unwrap();
            assert_eq!(
                written, original,
                "{name} 误判后写回字节不一致，属于数据损坏"
            );
        }
    }

    /// 手动指定编码能纠正误判，且**写回仍是原字节**。
    ///
    /// 这是「手动指定编码」功能的正确性基础：
    /// 用正确编码解码 → 文本正确 → 按同一编码写回 → 字节与原文一致。
    #[test]
    fn manual_encoding_override_restores_correct_text() {
        // Big5「中文測試」：A4A4=中 A4E5=文 B4FA=測 B8D5=試
        let big5 = [0xA4, 0xA4, 0xA4, 0xE5, 0xB4, 0xFA, 0xB8, 0xD5];

        // 自动探测会误判成 GBK
        assert_eq!(decode(&big5).label, "gbk");

        // 手动指定 big5 后文本正确
        let fixed = decode_as(&big5, "big5");
        assert_eq!(fixed.label, "big5");
        assert_eq!(fixed.text, "中文測試");

        // 按同一编码写回，字节与原文一致（不会损坏文件）
        assert_eq!(
            encode(&fixed.text, fixed.label, fixed.has_bom).unwrap(),
            big5
        );
    }

    /// `decode_as` 返回的 label 必须能被 `encoding_for` 认回来。
    ///
    /// 否则「指定编码打开 → 保存」这条链会在保存时退回 UTF-8，
    /// 把文件按错误编码写回去。
    #[test]
    fn decode_as_label_round_trips_through_encoding_for() {
        for label in SELECTABLE_ENCODINGS {
            let bytes = "test".as_bytes();
            let d = decode_as(bytes, label);
            // 认回来的编码必须与请求的是同一个
            assert_eq!(
                encoding_for(d.label),
                encoding_for(label),
                "label {label} 经 decode_as 后变成 {}，保存时会写错编码",
                d.label
            );
        }
    }

    /// 指定编码时若内容带**匹配**的 BOM，应剥掉 BOM 而不是当成正文。
    #[test]
    fn decode_as_strips_matching_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("hi".as_bytes());

        let d = decode_as(&bytes, "utf-8");
        assert_eq!(d.text, "hi", "BOM 被当成了正文内容");
        assert!(d.has_bom);
    }

    /// 指定编码时若内容带**不匹配**的 BOM，按用户所选整体解码。
    #[test]
    fn decode_as_ignores_mismatched_bom() {
        // UTF-16LE BOM + 数据，但用户坚持按 utf-8 解
        let mut bytes = vec![0xFF, 0xFE];
        bytes.extend_from_slice(&[0x41, 0x00]);

        let d = decode_as(&bytes, "utf-8");
        // 不匹配时不去剥 BOM，因此会看到替换字符——这是用户自己选的
        assert_eq!(d.label, "utf-8");
        assert!(!d.has_bom);
    }
}
