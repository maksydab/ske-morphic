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

#[derive(Clone, Debug)]
pub enum Valuer {
    Int(i64),
    Float(f64),
    String(String),
    Bool(bool),
    List(Vec<Valuer>),
}

#[derive(Clone, Debug)]
pub struct Var {
    pub name: String,
    pub vartype: i64,
    pub valuer: Valuer,
}