use crate::data::GameData;
use macroquad::{color::{self, Color}, texture::Image};
pub trait Render {
    fn render(&self);
}

pub struct Engi {
    pub game: GameData,
}
pub struct Entity {
    
}
impl Engi {
    pub fn new(game: GameData) -> Self {
        if let Some(table) = game.data["entities"].as_array() {
            for item in table {
                println!("{}", item);
            }
        }

        Self { game }
    }
}
pub const PALETTE: [Color; 3] = [
    Color { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    Color { r: 0.0, g: 1.0, b: 1.0, a: 1.0 },
    Color { r: 1.0, g: 0.0, b: 1.0, a: 1.0 },
];

pub fn strtoimg(img: &str, w: u16, h: u16) -> Image {
    assert_eq!(img.len(), (w as usize) * (h as usize));

    let pixels: Vec<Color> = img
        .chars()
        .map(|c| {
            let index = c.to_digit(10).expect("Invalid palette index") as usize;

            PALETTE[index - 1]
        })
        .collect();

    Image {
        width: w,
        height: h,
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
        let message = self.game.data["message"]
            .as_str()
            .unwrap_or("waiting for json...");

        macroquad::prelude::draw_text(
            message,
            400.0,
            100.0,
            40.0,
            macroquad::prelude::WHITE,
        );
    }
}