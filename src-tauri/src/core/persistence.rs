//! Serialized, durable application-data IO on the blocking pool.
use crate::model::{AppError, AppResult};
use std::sync::Mutex;

static STORE_IO: Mutex<()> = Mutex::new(());

pub async fn run<T, F>(operation: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = STORE_IO
            .lock()
            .map_err(|_| AppError::Io("应用数据写入锁失效".into()))?;
        operation()
    })
    .await
    .map_err(AppError::from_join)?
}
