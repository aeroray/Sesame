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

/// 探测并解码字节流。
///
/// 顺序：BOM → 严格 UTF-8 → GBK（容错）→ 有损 UTF-8 兜底。
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
        let (cow, _, _) = enc.decode(&bytes[bom_len..]);
        return Decoded {
            text: cow.into_owned(),
            label: label_of_bom(enc),
            has_bom: true,
        };
    }

    // 2. 严格 UTF-8——绝大多数文件走这条路径
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

/// 把文本按目标编码编码为字节，并按需补 BOM。
pub fn encode(text: &str, label: &str, with_bom: bool) -> Vec<u8> {
    let enc = encoding_for(label);
    let (body, _, _) = enc.encode(text);
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
    out
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
        let bytes: Vec<u8> = (0..512u32).map(|i| (i.wrapping_mul(97) % 256) as u8).collect();
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
        let bytes = encode("中文", "gbk", false);
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
            ("Big5", vec![0xA4, 0xA4, 0xA4, 0xE5, 0xB4, 0xFA, 0xA6, 0x72]),
            ("Shift_JIS", vec![0x93, 0xFA, 0x96, 0x7B, 0x8C, 0xEA]),
            ("UTF-16LE 无 BOM", vec![0x2D, 0x4E, 0x87, 0x65]),
        ];

        for (name, original) in cases {
            let d = decode(&original);
            assert_eq!(d.label, "gbk", "{name} 的判定前提变了，请重新评估本测试");
            let written = encode(&d.text, d.label, d.has_bom);
            assert_eq!(written, original, "{name} 误判后写回字节不一致，属于数据损坏");
        }
    }
}
