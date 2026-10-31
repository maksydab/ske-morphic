
use macroquad::prelude::*;
use serde_json::Value;
use std::cell::RefCell;
mod engine;
use engine::*;
mod data;
use data::*;
thread_local! {
    static GAME: RefCell<GameData> =
        RefCell::new(GameData::new());

    static ENGI: RefCell<Option<Engi>> =
        RefCell::new(None);
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc_json(size: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();

    std::mem::forget(buffer);

    ptr
}
#[unsafe(no_mangle)]
pub extern "C" fn free_json(ptr: *mut u8, size: usize) {
    if ptr.is_null() {
        return;
    }

    unsafe {
        drop(Vec::from_raw_parts(ptr, 0, size));
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn load_json(ptr: *const u8, size: usize) -> bool {
    if ptr.is_null() {
        return false;
    }

    let bytes = unsafe {
        std::slice::from_raw_parts(ptr, size)
    };

    let data: Value = match serde_json::from_slice(bytes) {
        Ok(data) => data,
        Err(_) => return false,
    };

    let game = GameData { data };

    ENGI.with(|engi| {
        *engi.borrow_mut() = Some(Engi::new(game));
    });

    true
}
#[macroquad::main("sk Engine")]
async fn main() {
    loop {
        clear_background(DARKGRAY);

        ENGI.with(|engi| {
            if let Some(engi) = engi.borrow().as_ref() {
                engi.render();
            } else {
                draw_text(
                    "waiting for game data...",
                    40.0,
                    100.0,
                    30.0,
                    WHITE,
                );
            }
        });

        next_frame().await;
    }
}