use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill { pub path: String, pub name: String, pub native_description: String, pub custom_description: String, pub parse_error: Option<String>, pub category_ids: Vec<i64> }
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCategory { pub id: i64, pub name: String, pub skill_paths: Vec<String> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadataUpdate { pub path: String, pub custom_description: String }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCategorySave { pub id: Option<i64>, pub name: String, pub skill_paths: Vec<String> }
