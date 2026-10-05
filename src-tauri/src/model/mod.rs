pub mod error;
pub mod file_meta;

pub use error::{AppError, AppResult};
pub use file_meta::{
    FileMeta, FilePayload, ImagePayload, RecentEntry, SaveResult, SessionSnapshot, TextChunk,
};
