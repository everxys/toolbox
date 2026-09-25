use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBook {
    pub path: String,
    pub relative_path: String,
    pub title: String,
    pub priority: i64,
    pub read: bool,
    pub book_type: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataUpdate { pub path: String, pub priority: i64, pub book_type: String, pub description: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult { pub source: String, pub status: String, pub message: String }
