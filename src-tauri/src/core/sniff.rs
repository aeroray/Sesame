//! 无扩展名文件的特征嗅探。
//!
//! 仅在扩展名无法判定（置信度低）时作为补充依据，
//! 依据是文件开头的 shebang 或标记行。

/// 最多检查多少个**字符**做嗅探，避免大文件浪费。
///
/// 单位是字符而非字节（早先注释写成字节，实际用 `chars().take()`，
/// 对中文而言真实窗口会大 3 倍）。这里只需要覆盖文件开头的标记行，
/// 字符数比字节数更贴近「能看多少行内容」的直觉。
pub const SNIFF_LIMIT: usize = 4096;

/// 从内容开头嗅探语言。返回 `None` 表示没有找到可靠特征。
pub fn sniff_language(content: &str) -> Option<(&'static str, f32)> {
    let head: String = content.chars().take(SNIFF_LIMIT).collect();
    let first_line = head.lines().next().unwrap_or("").trim();

    // 1. shebang
    if let Some(rest) = first_line.strip_prefix("#!") {
        let lower = rest.to_ascii_lowercase();
        let lang = if lower.contains("python") {
            "python"
        } else if lower.contains("node") || lower.contains("deno") || lower.contains("bun") {
            "javascript"
        } else if lower.contains("bash")
            || lower.contains("sh")
            || lower.contains("zsh")
            || lower.contains("fish")
        {
            "shell"
        } else if lower.contains("ruby") || lower.contains("perl") {
            return None; // 未接入对应语言包
        } else {
            return None;
        };
        return Some((lang, 0.85));
    }

    // 2. XML 声明
    if head.starts_with("<?xml") {
        return Some(("xml", 0.9));
    }

    // 3. HTML 文档类型或标签开头
    let lower_head = head.to_ascii_lowercase();
    let trimmed = lower_head.trim_start();
    if trimmed.starts_with("<!doctype html") || trimmed.starts_with("<html") {
        return Some(("html", 0.9));
    }

    /*
     * 4. JSON：以 { 或 [ 开头且能解析。
     *
     * **只在整个文件都被读进来时才尝试解析。** `head` 是被截断的前缀，
     * 超过窗口的文件永远解析失败——早先没这个判断，导致「无扩展名且超过
     * 4096 字符的 JSON」一律识别不出，静默留在纯文本模式。
     *
     * 内容更长时退而求其次：只看第一个非空白字符是不是 `{` / `[`，
     * 给一个较低的置信度，让调用方仍有机会选对语言。
     */
    let starts_like_json = trimmed.starts_with('{') || trimmed.starts_with('[');
    if starts_like_json {
        let complete = head.len() == content.len();
        if complete && serde_json::from_str::<serde_json::Value>(&head).is_ok() {
            return Some(("json", 0.75));
        }
        if !complete {
            /*
             * 完整内容不在手上，无法确认是合法 JSON，只给弱信号。
             *
             * 取 0.45 而不是 0.4：调用方用 `sniff_conf > confidence` 决定是否采纳，
             * 而「无扩展名」的兜底置信度正是 0.4，取 0.4 会因不严格大于而失效。
             * 同时它仍低于调用方 0.6 的「扩展名可信」门槛，不会盖过明确的后缀。
             */
            return Some(("json", 0.45));
        }
    }

    // 5. YAML 文档分隔符
    if first_line == "---" {
        return Some(("yaml", 0.5));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_python_shebang() {
        assert_eq!(
            sniff_language("#!/usr/bin/env python3\nprint(1)")
                .unwrap()
                .0,
            "python"
        );
    }

    #[test]
    fn detects_node_shebang() {
        assert_eq!(
            sniff_language("#!/usr/bin/env node\nconsole.log(1)")
                .unwrap()
                .0,
            "javascript"
        );
    }

    #[test]
    fn detects_bash_shebang() {
        assert_eq!(sniff_language("#!/bin/bash\necho hi").unwrap().0, "shell");
    }

    #[test]
    fn detects_xml_declaration() {
        assert_eq!(sniff_language("<?xml version=\"1.0\"?>").unwrap().0, "xml");
    }

    #[test]
    fn detects_html_doctype() {
        assert_eq!(sniff_language("<!DOCTYPE html>\n<html>").unwrap().0, "html");
    }

    #[test]
    fn detects_json_object() {
        assert_eq!(sniff_language("{\"a\": 1}").unwrap().0, "json");
    }

    #[test]
    fn detects_yaml_document_start() {
        assert_eq!(sniff_language("---\nkey: value").unwrap().0, "yaml");
    }

    #[test]
    fn returns_none_for_plain_prose() {
        assert!(sniff_language("这是一段普通的中文说明文字。").is_none());
        assert!(sniff_language("hello world").is_none());
    }

    #[test]
    fn does_not_panic_on_empty() {
        assert!(sniff_language("").is_none());
    }

    #[test]
    fn long_json_still_detected() {
        // 超过 SNIFF_LIMIT 个字符的 JSON：早先因为拿截断的前缀去解析，
        // 必然失败，于是无扩展名的大 JSON 一律识别不出。
        let mut big = String::from("{\"items\":[");
        for i in 0..8000 {
            big.push_str(&format!("{i},"));
        }
        big.push_str("]}");

        let (lang, conf) = sniff_language(&big).expect("大 JSON 应当被识别");
        assert_eq!(lang, "json");
        // 必须严格大于「无扩展名」的兜底置信度 0.4，否则调用方不会采纳
        assert!(conf > 0.4, "置信度 {conf} 太低，会被调用方丢弃");
    }

    #[test]
    fn truncated_invalid_json_is_not_overclaimed() {
        // 只是以 { 开头、内容并非合法 JSON 时，不能给高置信度
        let junk = format!("{{ this is not json {}", "x".repeat(9000));
        let got = sniff_language(&junk);
        if let Some((lang, conf)) = got {
            assert_eq!(lang, "json");
            assert!(conf < 0.6, "不该盖过扩展名判定的可信度");
        }
    }

    #[test]
    fn small_complete_json_parses() {
        let (lang, conf) = sniff_language("{\"a\": 1}").unwrap();
        assert_eq!(lang, "json");
        assert!(conf >= 0.7);
    }
}
