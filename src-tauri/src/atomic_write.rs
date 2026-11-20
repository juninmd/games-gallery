//! Write-then-rename with a temp file that is unique per call, so concurrent writers of the same
//! target (the UI asks for one cover from several cards at once) never share or steal a temp file.

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static SEQ: AtomicU64 = AtomicU64::new(0);

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension(format!("{}-{}.part", std::process::id(), SEQ.fetch_add(1, Ordering::Relaxed)));
    let result = std::fs::write(&tmp, bytes).and_then(|()| std::fs::rename(&tmp, path));
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concurrent_writers_of_one_target_all_succeed_and_leave_no_temp_files() {
        let dir = std::env::temp_dir().join(format!("gg-atomic-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("a.img");
        let data = vec![7u8; 256 * 1024];
        std::thread::scope(|s| {
            for _ in 0..16 {
                s.spawn(|| write_atomic(&target, &data).unwrap());
            }
        });
        assert_eq!(std::fs::read(&target).unwrap(), data);
        let leftovers = std::fs::read_dir(&dir).unwrap().filter(|e| e.as_ref().unwrap().path() != target).count();
        assert_eq!(leftovers, 0);
        let _ = std::fs::remove_dir_all(dir);
    }
}
