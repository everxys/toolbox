#[path = "../commands/storage.rs"]
mod storage;
#[path = "../commands/library.rs"]
mod library;

fn main() {
    let mut args = std::env::args().skip(1);
    let Some(path) = args.next() else {
        eprintln!("用法：library_state_cli <Library 中的图书完整路径> <read|unread>");
        std::process::exit(2);
    };
    let Some(state) = args.next() else {
        eprintln!("缺少目标阅读状态：read 或 unread");
        std::process::exit(2);
    };
    if args.next().is_some() {
        eprintln!("参数过多。用法：library_state_cli <路径> <read|unread>");
        std::process::exit(2);
    }
    let read = match state.as_str() {
        "read" => true,
        "unread" => false,
        _ => {
            eprintln!("目标阅读状态必须为 read 或 unread");
            std::process::exit(2);
        }
    };

    match library::library_set_read_status(path.clone(), read) {
        Ok(()) => println!("OK: {} 已标记为 {}", path, state),
        Err(error) => {
            eprintln!("ERROR: {error}");
            std::process::exit(1);
        }
    }
}
