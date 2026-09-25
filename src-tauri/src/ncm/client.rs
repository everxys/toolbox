use std::{sync::OnceLock, time::Duration};

pub fn ncm_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::builder().timeout(Duration::from_secs(15)).connect_timeout(Duration::from_secs(10)).pool_idle_timeout(Duration::from_secs(90)).user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36").build().expect("reqwest client"))
}
