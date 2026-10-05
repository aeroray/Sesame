//! 全局阈值与魔法数字，集中管理，避免散落在各模块。

/// 超过此大小不再内联读取全文，改用分块模式。
pub const INLINE_READ_LIMIT: u64 = 5 * 1024 * 1024; // 5 MB

/// 分块读取的默认块大小。
pub const CHUNK_SIZE: u64 = 1024 * 1024; // 1 MB

/// 探测大文件编码时读取的字节数。
///
/// 取 64 KB：足够让 `encoding::decode` 区分 UTF-8 / GBK / UTF-16，
/// 又不至于为一次探测读入过多内容。
pub const ENCODING_PROBE_BYTES: usize = 64 * 1024;

/// 单次分块读取允许的最大块大小，防止前端传入过大的值。
pub const MAX_CHUNK_SIZE: u64 = 8 * 1024 * 1024; // 8 MB

/// 最近文件列表的最大条目数。
pub const RECENT_LIMIT: usize = 20;

/// 保存时单次写入的字节上限，超过则拒绝，避免误操作写爆磁盘。
pub const MAX_WRITE_BYTES: usize = 256 * 1024 * 1024; // 256 MB

/// 可预览图片的体积上限。
///
/// 图片以 base64 data URL 传给前端，编码后约放大 33%，
/// 上限取 32 MB 是为了避免一次注入上百 MB 的字符串把 WebView 拖垮。
pub const MAX_IMAGE_BYTES: u64 = 32 * 1024 * 1024;
