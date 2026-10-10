use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ServicesConfig {
    #[serde(default)]
    pub groups: Vec<GroupConfig>,
    #[serde(default)]
    pub services: Vec<ServiceConfig>,
}

#[derive(Debug, Deserialize)]
pub struct GroupConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(default = "default_type")]
    pub r#type: String,
    pub group_id: Option<String>,
    #[serde(default = "default_expected_status")]
    pub expected_status: Vec<i32>,
    #[serde(default = "default_check_interval")]
    pub check_interval_seconds: i32,
    #[serde(default)]
    pub sort_order: i32,
}

fn default_type() -> String {
    "http".into()
}

fn default_expected_status() -> Vec<i32> {
    vec![200]
}

fn default_check_interval() -> i32 {
    300
}