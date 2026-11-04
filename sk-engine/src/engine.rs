use crate::data::*;
use crate::visual::*;
use macroquad::{
    color::Color,
    texture::Image,
    window::{screen_height, screen_width},
};
use std::collections::HashMap;

#[derive(Clone)]
pub struct Renprop {
    pub img: macroquad::texture::Texture2D,
    pub size: (i64, i64),
}

#[derive(Clone)]
pub enum Props {
    Renprop(Renprop),
    Visualprop(Visualprop),
}

#[derive(Clone)]
pub struct Component {
    pub typ: String,
    pub p: Props,
}

#[derive(Clone)]
pub struct Entity {
    pub components: HashMap<String, Component>,
}

pub struct Instance {
    pub n: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub entity: Entity,
    pub vars: HashMap<String, Var>,
    pub nodes: Vec<Noder>,
    pub activeexecutionnodes: Vec<usize>,
}

pub struct Game {
    pub entities: HashMap<String, Entity>,
    pub scene: Vec<Instance>,
}

impl Game {
    pub fn new() -> Self {
        Self {
            entities: HashMap::new(),
            scene: Vec::new(),
        }
    }
}

pub trait Render {
    fn render(&self);
}

pub struct Engi {
    pub gamed: GameData,
    pub game: Game,
}

impl Engi {
    pub fn new(gamed: GameData) -> Self {
        let mut game = Game::new();

        if let Some(entities) = gamed.data["entities"].as_object() {
            for (name, en) in entities {
                let mut components = HashMap::new();

                if let Some(comps) = en["components"].as_array() {
                    for comp in comps {
                        let typ = comp["type"].as_str().unwrap_or("unknown").to_string();

                        let p = match typ.as_str() {
                            "renderer" => {
                                let img = comp["p"]["img"].as_str().unwrap_or("");
                                let w = comp["p"]["size"]["x"].as_i64().unwrap_or(0);
                                let h = comp["p"]["size"]["y"].as_i64().unwrap_or(0);

                                let image = strtoimg(img, w, h);
                                let texture = macroquad::texture::Texture2D::from_image(&image);
                                let texture = texture;
                                texture.set_filter(macroquad::texture::FilterMode::Nearest);

                                Props::Renprop(Renprop {
                                    img: texture,
                                    size: (w, h),
                                })
                            }
                            "visual" => {
                                let mut vars = HashMap::new();
                                if let Some(v_map) = comp["p"]["vars"].as_object() {
                                    for (k, v) in v_map {
                                        let valuer = match v {
                                            serde_json::Value::String(s) => {
                                                Valuer::String(s.clone())
                                            }
                                            serde_json::Value::Number(n) => {
                                                if let Some(i) = n.as_i64() {
                                                    Valuer::Int(i)
                                                } else if let Some(f) = n.as_f64() {
                                                    Valuer::Float(f)
                                                } else {
                                                    Valuer::String(n.to_string())
                                                }
                                            }
                                            _ => Valuer::String(v.to_string()),
                                        };
                                        vars.insert(
                                            k.clone(),
                                            Var {
                                                name: k.clone(),
                                                vartype: match valuer {
                                                    Valuer::Int(_) => 0,
                                                    Valuer::Float(_) => 1,
                                                    _ => 2,
                                                },
                                                valuer,
                                            },
                                        );
                                    }
                                }

                                let mut nodes = Vec::new();
                                if let Some(node_list) = comp["p"]["nodes"].as_array() {
                                    for node_json in node_list {
                                        parse_json_node(node_json, &mut nodes);
                                    }
                                }

                                Props::Visualprop(Visualprop { vars, nodes })
                            }

                            _ => continue,
                        };

                        components.insert(typ.clone(), Component { typ, p });
                    }
                }

                game.entities.insert(name.clone(), Entity { components });
            }
        }

        if let Some(scene) = gamed.data["scene"].as_array() {
            for inst in scene {
                let entity_name = inst["t"].as_str().unwrap_or("unknown").to_string();

                let x = inst["p"]["x"].as_f64().unwrap_or(0.0);
                let y = inst["p"]["y"].as_f64().unwrap_or(0.0);
                let w = inst["p"]["w"].as_f64().unwrap_or(1.0);
                let h = inst["p"]["h"].as_f64().unwrap_or(1.0);

                if let Some(template) = game.entities.get(&entity_name) {
                    let mut inst_vars = HashMap::new();
                    let mut inst_nodes = Vec::new();

                    if let Some(Component {
                        p: Props::Visualprop(vis),
                        ..
                    }) = template.components.get("visual")
                    {
                        inst_vars = vis.vars.clone();
                        inst_nodes = vis.nodes.clone();
                    }

                    let start_nodes: Vec<usize> = inst_nodes
                        .iter()
                        .filter(|n| n.ty == 0)
                        .map(|n| n.id)
                        .collect();

                    game.scene.push(Instance {
                        n: entity_name.clone(),
                        x,
                        y,
                        w,
                        h,
                        entity: template.clone(),
                        vars: inst_vars,
                        nodes: inst_nodes,
                        activeexecutionnodes: start_nodes,
                    });
                }
            }
        }
        Self { gamed, game }
    }
}

pub const PALETTE: [Color; 64] = [
    Color { r: 0.078, g: 0.078, b: 0.078, a: 1.0 },// #141414
    Color { r: 0.157, g: 0.161, b: 0.169, a: 1.0 },// #28292b
    Color { r: 0.384, g: 0.333, b: 0.396, a: 1.0 },// #625565
    Color { r: 0.643, g: 0.408, b: 0.408, a: 1.0 },// #a46868
    Color { r: 0.725, g: 0.604, b: 0.463, a: 1.0 },// #b99a76
    Color { r: 0.416, g: 0.267, b: 0.376, a: 1.0 },// #6a4460
    Color { r: 0.498, g: 0.439, b: 0.541, a: 1.0 },// #7f708a
    Color { r: 0.608, g: 0.698, b: 0.737, a: 1.0 },// #9bb2bc
    Color { r: 0.788, g: 0.894, b: 0.835, a: 1.0 },// #c9e4d5
    Color { r: 1.000, g: 1.000, b: 1.000, a: 1.0 },// #ffffff
    Color { r: 0.447, g: 0.098, b: 0.098, a: 1.0 },// #721919
    Color { r: 0.749, g: 0.141, b: 0.106, a: 1.0 },// #bf241b
    Color { r: 1.000, g: 0.286, b: 0.169, a: 1.0 },// #ff492b
    Color { r: 1.000, g: 0.502, b: 0.290, a: 1.0 },// #ff804a
    Color { r: 0.729, g: 0.051, b: 0.133, a: 1.0 },// #ba0d22
    Color { r: 1.000, g: 0.180, b: 0.180, a: 1.0 },// #ff2e2e
    Color { r: 1.000, g: 0.439, b: 0.137, a: 1.0 },// #ff7023
    Color { r: 1.000, g: 0.608, b: 0.098, a: 1.0 },// #ff9b19
    Color { r: 1.000, g: 0.784, b: 0.184, a: 1.0 },// #ffc82f
    Color { r: 0.498, g: 0.129, b: 0.235, a: 1.0 },// #7f213c
    Color { r: 0.655, g: 0.208, b: 0.149, a: 1.0 },// #a73526
    Color { r: 0.898, g: 0.396, b: 0.184, a: 1.0 },// #e5652f
    Color { r: 0.992, g: 0.576, b: 0.255, a: 1.0 },// #fd9341
    Color { r: 1.000, g: 0.745, b: 0.353, a: 1.0 },// #ffbe5a
    Color { r: 0.298, g: 0.227, b: 0.102, a: 1.0 },// #4c3a1a
    Color { r: 0.412, g: 0.408, b: 0.153, a: 1.0 },// #696827
    Color { r: 0.663, g: 0.698, b: 0.204, a: 1.0 },// #a9b234
    Color { r: 0.918, g: 0.969, b: 0.243, a: 1.0 },// #eaf73e
    Color { r: 0.984, g: 1.000, b: 0.565, a: 1.0 },// #fbff90
    Color { r: 0.039, g: 0.361, b: 0.294, a: 1.0 },// #0a5c4b
    Color { r: 0.067, g: 0.596, b: 0.376, a: 1.0 },// #119860
    Color { r: 0.024, g: 0.792, b: 0.435, a: 1.0 },// #06ca6f
    Color { r: 0.573, g: 0.933, b: 0.376, a: 1.0 },// #92ee60
    Color { r: 0.859, g: 0.949, b: 0.388, a: 1.0 },// #dbf263
    Color { r: 0.192, g: 0.212, b: 0.220, a: 1.0 },// #313638
    Color { r: 0.180, g: 0.302, b: 0.282, a: 1.0 },// #2e4d48
    Color { r: 0.278, g: 0.506, b: 0.365, a: 1.0 },// #47815d
    Color { r: 0.584, g: 0.714, b: 0.510, a: 1.0 },// #95b682
    Color { r: 0.737, g: 0.776, b: 0.557, a: 1.0 },// #bcc68e
    Color { r: 0.000, g: 0.369, b: 0.400, a: 1.0 },// #005e66
    Color { r: 0.000, g: 0.541, b: 0.565, a: 1.0 },// #008a90
    Color { r: 0.000, g: 0.702, b: 0.616, a: 1.0 },// #00b39d
    Color { r: 0.122, g: 0.988, b: 0.792, a: 1.0 },// #1ffcca
    Color { r: 0.573, g: 1.000, b: 0.910, a: 1.0 },// #92ffe8
    Color { r: 0.157, g: 0.161, b: 0.325, a: 1.0 },// #282953
    Color { r: 0.231, g: 0.243, b: 0.478, a: 1.0 },// #3b3e7a
    Color { r: 0.263, g: 0.384, b: 0.784, a: 1.0 },// #4362c8
    Color { r: 0.251, g: 0.627, b: 0.992, a: 1.0 },// #40a0fd
    Color { r: 0.600, g: 0.843, b: 1.000, a: 1.0 },// #99d7ff
    Color { r: 0.267, g: 0.125, b: 0.235, a: 1.0 },// #44203c
    Color { r: 0.420, g: 0.192, b: 0.471, a: 1.0 },// #6b3178
    Color { r: 0.600, g: 0.341, b: 0.729, a: 1.0 },// #9957ba
    Color { r: 0.671, g: 0.510, b: 1.000, a: 1.0 },// #ab82ff
    Color { r: 0.957, g: 0.675, b: 0.973, a: 1.0 },// #f4acf8
    Color { r: 0.471, g: 0.180, b: 0.306, a: 1.0 },// #782e4e
    Color { r: 0.667, g: 0.224, b: 0.408, a: 1.0 },// #aa3968
    Color { r: 0.886, g: 0.361, b: 0.490, a: 1.0 },// #e25c7d
    Color { r: 0.996, g: 0.478, b: 0.596, a: 1.0 },// #fe7a98
    Color { r: 0.541, g: 0.043, b: 0.357, a: 1.0 },// #8a0b5b
    Color { r: 0.824, g: 0.043, b: 0.278, a: 1.0 },// #d20b47
    Color { r: 1.000, g: 0.290, b: 0.471, a: 1.0 },// #ff4a78
    Color { r: 1.000, g: 0.510, b: 0.510, a: 1.0 },// #ff8282
    Color { r: 1.000, g: 0.678, b: 0.592, a: 1.0 },// #ffad97
    Color { r: 1.000, g: 0.820, b: 0.722, a: 1.0 },// #ffd1b8
];

const CHARSET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

pub fn strtoimg(img: &str, w: i64, h: i64) -> Image {
    assert_eq!(img.len(), (w as usize) * (h as usize));

    let pixels: Vec<Color> = img
        .chars()
        .map(|c| {
            
            if let Some(index) = CHARSET.iter().position(|&x| x == c as u8) {
                PALETTE[index]
            } else {
                Color { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }
            }
        })
        .collect();
    Image {
        width: w as u16,
        height: h as u16,
        bytes: pixels
            .iter()
            .flat_map(|c| {
                [
                    (c.r * 255.0) as u8,
                    (c.g * 255.0) as u8,
                    (c.b * 255.0) as u8,
                    (c.a * 255.0) as u8,
                ]
            })
            .collect(),
    }
}

impl Engi {
    pub fn update(&mut self) {
        if macroquad::input::is_mouse_button_pressed(macroquad::input::MouseButton::Left) {
            let (mouse_x, mouse_y) = macroquad::input::mouse_position();
            let screen_w = screen_width();
            let screen_h = screen_height();
            let board_size = f32::min(screen_w, screen_h);
            let unit = board_size / 10.0;
            let offset_x = (screen_w - board_size) / 2.0;
            let offset_y = (screen_h - board_size) / 2.0;

            for instance in &mut self.game.scene {
                let inst_screen_x = offset_x + (instance.x as f32 * unit);
                let inst_screen_y = offset_y + (instance.y as f32 * unit);
                let inst_screen_w = instance.w as f32 * unit;
                let inst_screen_h = instance.h as f32 * unit;

                if mouse_x >= inst_screen_x && mouse_x <= inst_screen_x + inst_screen_w &&
                   mouse_y >= inst_screen_y && mouse_y <= inst_screen_y + inst_screen_h {
                    
                    let click_nodes: Vec<usize> = instance.nodes
                        .iter()
                        .filter(|n| n.ty == 2) 
                        .map(|n| n.id)
                        .collect();
                    
                    instance.activeexecutionnodes.extend(click_nodes);
                }
            }
        }

        for instance in &mut self.game.scene {
            if instance.activeexecutionnodes.is_empty() {
                continue;
            }

            let current_nodes = std::mem::take(&mut instance.activeexecutionnodes);
            let mut next_nodes = Vec::new();

            for node_idx in current_nodes {
                if node_idx < instance.nodes.len() {
                    let props = instance.nodes[node_idx].props.clone();
                    let nodesclone = instance.nodes.clone();
                    let subsequent = props.execute(instance, &nodesclone);
                    next_nodes.extend(subsequent);
                }
            }
            instance.activeexecutionnodes = next_nodes;
        }
    }
}

impl Render for Engi {
    fn render(&self) {
        let screen_w = screen_width();
        let screen_h = screen_height();

        let board_size = f32::min(screen_w, screen_h);
        let unit = board_size / 10.0;

        let offset_x = (screen_w - board_size) / 2.0;
        let offset_y = (screen_h - board_size) / 2.0;

        let message = format!(
            "message: {}\nentities: {}\nscene: {}",
            self.gamed.data["message"].as_str().unwrap_or(""),
            self.game.entities.len(),
            self.game.scene.len()
        );

        for ins in &self.game.scene {
            if let Some(component) = ins.entity.components.get("renderer") {
                match &component.p {
                    Props::Renprop(renderer) => {
                        let screen_x = offset_x + (ins.x as f32 * unit);
                        let screen_y = offset_y + (ins.y as f32 * unit);
                        let screen_w_px = ins.w as f32 * unit;
                        let screen_h_px = ins.h as f32 * unit;

                        macroquad::prelude::draw_texture_ex(
                            &renderer.img,
                            screen_x,
                            screen_y,
                            macroquad::prelude::WHITE,
                            macroquad::texture::DrawTextureParams {
                                dest_size: Some(macroquad::prelude::vec2(screen_w_px, screen_h_px)),
                                ..Default::default()
                            },
                        );
                    }
                    Props::Visualprop(_) => {}
                }
            }
        }

        for (i, line) in message.lines().enumerate() {
            macroquad::prelude::draw_text(
                line,
                offset_x + (0.5 * unit),
                offset_y + (1.0 * unit) + (i as f32 * 0.8 * unit),
                2.0 * unit / 3.0,
                macroquad::prelude::WHITE,
            );
        }
    }
}