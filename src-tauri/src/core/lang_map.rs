//! 扩展名 / 文件名 → 语言标识的映射表。
//!
//! 这里的语言标识必须与前端 `src/lib/editor/languages.ts` 中的键一致。

/// 扩展名映射。全部小写，不带点。
fn by_extension(ext: &str) -> Option<&'static str> {
    let lang = match ext {
        // Markdown
        "md" | "markdown" | "mdx" => "markdown",

        // 数据与配置
        "json" | "jsonc" | "json5" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "ini" | "cfg" | "conf" | "properties" => "ini",

        // Web
        "html" | "htm" | "xhtml" | "vue" | "svelte" => "html",
        "css" => "css",
        "scss" | "sass" | "less" => "css",
        "js" | "mjs" | "cjs" | "jsx" => "javascript",
        "ts" | "mts" | "cts" | "tsx" => "typescript",

        // 系统语言
        "rs" => "rust",
        "go" => "go",
        "py" | "pyw" | "pyi" => "python",
        "java" => "java",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" | "hh" | "hxx" | "ipp" => "cpp",

        // 数据与脚本
        "sql" => "sql",
        "xml" | "xsd" | "xsl" | "svg" | "plist" => "xml",
        "sh" | "bash" | "zsh" | "fish" | "ps1" | "psm1" | "bat" | "cmd" => "shell",

        // 纯文本
        "txt" | "text" | "log" | "csv" | "tsv" => "plaintext",

        _ => return None,
    };
    Some(lang)
}

/// 按文件名精确匹配（无扩展名或特殊文件名）。
fn by_filename(name: &str) -> Option<&'static str> {
    let lang = match name {
        "Dockerfile" | "Containerfile" | "Makefile" | "Rakefile" | "Gemfile" | "Procfile" => {
            "shell"
        }
        ".gitignore" | ".gitattributes" | ".editorconfig" | ".npmrc" | ".env" => "ini",
        ".prettierrc" | ".eslintrc" | ".babelrc" => "json",
        "Cargo.lock" | "package-lock.json" | "pnpm-lock.yaml" => "plaintext",
        _ => return None,
    };
    Some(lang)
}

/// 取出文件名与小写扩展名。
///
/// 抽成一处是因为 `image_mime` 与 `detect_language` 都要做这两件事，
/// 而其中的「点号位置」判断有个容易写错的细节：
/// `.gitignore` 这类**以点开头**的文件名，那个点不是扩展名分隔符；
/// 末尾是点（`a.`）也不算。两处各写一份必然会漂移。
fn split_name(path: &str) -> (&str, Option<String>) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path);

    let ext = match name.rfind('.') {
        // dot > 0：排除以点开头的隐藏文件；dot + 1 < len：排除末尾的点
        Some(dot) if dot > 0 && dot + 1 < name.len() => Some(name[dot + 1..].to_ascii_lowercase()),
        _ => None,
    };

    (name, ext)
}

/// 判断扩展名是否属于可预览的图片。
///
/// 与语言映射分开：图片不是「语言」，把它塞进 LanguageId 会让
/// 语言包加载、状态栏显示等处都要额外分支。
pub fn image_mime(path: &str) -> Option<&'static str> {
    let (_, ext) = split_name(path);
    let ext = ext?;

    match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

/// 综合文件名与扩展名判定语言。
pub fn detect_language(path: &str) -> (&'static str, f32) {
    let (name, ext) = split_name(path);

    if let Some(lang) = by_filename(name) {
        return (lang, 0.95);
    }

    if let Some(ext) = ext {
        if let Some(lang) = by_extension(&ext) {
            return (lang, 0.9);
        }
    }

    ("plaintext", 0.4)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_common_extensions() {
        assert_eq!(detect_language("a/b/notes.md").0, "markdown");
        assert_eq!(detect_language("main.rs").0, "rust");
        assert_eq!(detect_language("App.svelte").0, "html");
        assert_eq!(detect_language("data.json").0, "json");
        assert_eq!(detect_language("script.py").0, "python");
    }

    #[test]
    fn is_case_insensitive() {
        assert_eq!(detect_language("README.MD").0, "markdown");
        assert_eq!(detect_language("Main.RS").0, "rust");
    }

    #[test]
    fn handles_windows_paths() {
        assert_eq!(detect_language(r"C:\proj\src\lib.rs").0, "rust");
    }

    #[test]
    fn matches_special_filenames() {
        assert_eq!(detect_language("Dockerfile").0, "shell");
        assert_eq!(detect_language(".gitignore").0, "ini");
    }

    #[test]
    fn dotfiles_are_not_treated_as_extensions() {
        // `.gitignore` 不应被解析为扩展名 “gitignore”
        assert_eq!(detect_language(".gitignore").0, "ini");
        assert_eq!(detect_language(".unknownfile").0, "plaintext");
    }

    #[test]
    fn unknown_extension_falls_back_to_plaintext() {
        assert_eq!(detect_language("data.xyz").0, "plaintext");
        assert_eq!(detect_language("noext").0, "plaintext");
    }

    #[test]
    fn maps_image_extensions() {
        assert_eq!(image_mime("a.png"), Some("image/png"));
        assert_eq!(image_mime("a.JPG"), Some("image/jpeg"));
        assert_eq!(image_mime("a.jpeg"), Some("image/jpeg"));
        assert_eq!(image_mime("a.webp"), Some("image/webp"));
        assert_eq!(image_mime("a.svg"), Some("image/svg+xml"));
    }

    #[test]
    fn image_mime_handles_paths_and_non_images() {
        assert_eq!(image_mime(r"C:\proj\assets\logo.png"), Some("image/png"));
        assert_eq!(image_mime("/a/b/pic.gif"), Some("image/gif"));
        // 文本文件不应被当作图片
        assert_eq!(image_mime("main.rs"), None);
        assert_eq!(image_mime("notes.md"), None);
        // 点开头的文件没有扩展名
        assert_eq!(image_mime(".gitignore"), None);
        assert_eq!(image_mime("noext"), None);
    }

    #[test]
    fn svg_is_distinguishable_from_binary_images() {
        // SVG 是 XML 文本，允许用编辑器保存；
        // 保存守卫靠这个区别决定是否放行。
        assert_eq!(image_mime("icon.svg"), Some("image/svg+xml"));
        assert_ne!(image_mime("icon.png"), Some("image/svg+xml"));
    }

    #[test]
    fn split_name_agrees_between_the_two_callers() {
        // 两个调用方共用同一个 basename / 扩展名判定，
        // 这里把容易分歧的边界情况固定下来。
        assert_eq!(
            split_name(r"C:\a\b\notes.md"),
            ("notes.md", Some("md".into()))
        );
        assert_eq!(split_name("/a/b/Main.RS"), ("Main.RS", Some("rs".into())));
        // 点开头的文件：那个点不是扩展名分隔符
        assert_eq!(split_name(".gitignore"), (".gitignore", None));
        // 末尾是点：不算扩展名
        assert_eq!(split_name("trailing."), ("trailing.", None));
        // 无点
        assert_eq!(split_name("noext"), ("noext", None));

        /*
         * 两边必须共用同一份判定。
         *
         * 注意不能拿 `detect_language(...).0 != "plaintext"` 来推「有扩展名」——
         * `.gitignore` 这类**按文件名**匹配的规则也会返回非 plaintext，
         * 而它确实没有扩展名。因此只对「靠扩展名才能认出」的样本做交叉验证。
         */
        for p in ["a.png", "a/b/c.svg", "notes.md", "main.rs"] {
            let (_, ext) = split_name(p);
            assert!(ext.is_some(), "{p} 应当解析出扩展名");
        }

        // 无扩展名的样本：图片与语言都应判不出来
        for p in [".gitignore", "trailing.", "noext"] {
            let (_, ext) = split_name(p);
            assert!(ext.is_none(), "{p} 不该解析出扩展名");
            assert_eq!(image_mime(p), None, "{p} 不该被当作图片");
        }
    }
}
