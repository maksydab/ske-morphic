use serde_json::Value;
pub struct GameData {
    pub data: Value,
}

impl GameData {
    pub fn new() -> Self {
        Self {
            data: serde_json::json!({})
        }
    }
}
