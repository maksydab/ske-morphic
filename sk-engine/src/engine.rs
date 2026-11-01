use crate::data::GameData;
use macroquad::{color::Color, texture::Image, window::{screen_height, screen_width}};
use serde_json::to_string;
use std::{any::Any, collections::HashMap, vec};

//GAME STRUCTURE

#[derive(Clone)]
pub struct Renprop {
    pub img: macroquad::texture::Texture2D,
    pub size: (i64, i64),
}

#[derive(Clone)]
pub enum Props {
    Renprop(Renprop),
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

//ENGINE


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
                                let mut texture = macroquad::texture::Texture2D::from_image(&image);

                                texture.set_filter(macroquad::texture::FilterMode::Nearest);

                                Props::Renprop(Renprop {
                                    img: texture,
                                    size: (w, h),
                                })
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
                    game.scene.push(Instance {
                        n: entity_name.clone(),
                        x,
                        y,
                        w,
                        h,
                        entity: template.clone(),
                    });
                }
            }
        }
        Self { gamed, game }
    }
}
pub const PALETTE: [Color; 3] = [
    Color {
        r: 1.0,
        g: 1.0,
        b: 1.0,
        a: 1.0,
    },
    Color {
        r: 0.0,
        g: 1.0,
        b: 1.0,
        a: 1.0,
    },
    Color {
        r: 1.0,
        g: 0.0,
        b: 1.0,
        a: 1.0,
    },
];

pub fn strtoimg(img: &str, w: i64, h: i64) -> Image {
    assert_eq!(img.len(), (w as usize) * (h as usize));

    let pixels: Vec<Color> = img
        .chars()
        .map(|c| {
            let index = c.to_digit(10).expect("invalid palttee index") as usize;

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
                                dest_size: Some(macroquad::prelude::vec2(
                                    screen_w_px,
                                    screen_h_px,
                                )),
                                ..Default::default()
                            },
                        );
                    }
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