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

pub const PALETTE: [Color; 3] = [
    Color { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    Color { r: 0.0, g: 1.0, b: 1.0, a: 1.0 },
    Color { r: 1.0, g: 0.0, b: 1.0, a: 1.0 },
];

pub fn strtoimg(img: &str, w: i64, h: i64) -> Image {
    assert_eq!(img.len(), (w as usize) * (h as usize));

    let pixels: Vec<Color> = img
        .chars()
        .map(|c| {
            let index = c.to_digit(10).expect("invalid palette index") as usize;
            PALETTE[index - 1]
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