use serde_json::Value;
pub struct GameData {
    pub data: Value,
}

impl GameData {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            data: serde_json::json!({})
        }
    }
}
