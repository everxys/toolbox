use std::{fs, path::Path};

pub fn value_from_front_matter(contents: &str, key: &str) -> Option<String> {
    let lines: Vec<&str> = contents.lines().collect(); if lines.first()?.trim() != "---" { return None; }
    let prefix = format!("{key}:");
    for (index, line) in lines.iter().enumerate().skip(1) {
        let trimmed = line.trim(); if trimmed == "---" { break; }
        let Some(value) = trimmed.strip_prefix(&prefix) else { continue; }; let value = value.trim();
        if !matches!(value, ">" | ">-" | "|" | "|-") { return Some(value.trim_matches(['\'', '"']).to_string()); }
        let mut block = vec![];
        for next in lines.iter().skip(index + 1) { if next.trim() == "---" { break; } if !next.trim().is_empty() && !next.starts_with(char::is_whitespace) { break; } block.push(*next); }
        let indent = block.iter().filter(|line| !line.trim().is_empty()).map(|line| line.len() - line.trim_start().len()).min().unwrap_or(0);
        let block: Vec<&str> = block.iter().map(|line| line.get(indent..).unwrap_or("")).collect();
        if value.starts_with('>') { let mut output = String::new(); for line in block { if line.trim().is_empty() { if !output.ends_with('\n') { output.push('\n'); } } else { if !output.is_empty() && !output.ends_with('\n') { output.push(' '); } output.push_str(line.trim()); } } return Some(output.trim().to_string()); }
        return Some(block.join("\n").trim().to_string());
    }
    None
}

pub fn parse_skill_manifest(path: &Path) -> (String, String, Option<String>) {
    let fallback = path.file_name().and_then(|part| part.to_str()).unwrap_or("未命名 skill").to_string();
    match fs::read_to_string(path.join("SKILL.md")) {
        Ok(contents) if contents.trim_start().starts_with("---") => { let name = value_from_front_matter(&contents, "name").filter(|value| !value.is_empty()).unwrap_or(fallback); let description = value_from_front_matter(&contents, "description").unwrap_or_default(); (name, description, None) }
        Ok(_) => (fallback, String::new(), Some("SKILL.md 缺少 YAML front matter".into())),
        Err(error) => (fallback, String::new(), Some(format!("无法读取 SKILL.md：{error}"))),
    }
}
