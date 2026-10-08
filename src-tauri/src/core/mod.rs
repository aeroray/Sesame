pub mod atomic;
pub mod encoding;
pub mod external;
pub mod lang_map;
pub mod paths;
pub mod persistence;
pub mod sniff;
// 仅 Windows：把图片设为桌面壁纸（`SystemParametersInfoW` + BMP 转换）。
#[cfg(windows)]
pub mod wallpaper;
