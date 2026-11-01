use macroquad::prelude::*;
use serde_json::Value;
use std::cell::RefCell;

mod data;
use data::*;

mod visual;
use visual::*;

mod engine;
use engine::*;

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
        Err(e) => {
            log_to_js(&format!("JSON Parse Error: {}", e));
            return false;
        }
    };

    let game = GameData { data };

    let result = std::panic::catch_unwind(move || {
        ENGI.with(|engi| {
            *engi.borrow_mut() = Some(Engi::new(game));
        });
    });

    match result {
        Ok(_) => true,
        Err(err) => {
            if let Some(s) = err.downcast_ref::<String>() {
                log_to_js(&format!("Engine Panic: {}", s));
            } else if let Some(s) = err.downcast_ref::<&str>() {
                log_to_js(&format!("Engine Panic: {}", s));
            } else {
                log_to_js("Engine Panic: Unknown error");
            }
            false
        }
    }
}

unsafe extern "C" {
    fn js_console_log(ptr: *const u8, len: i32);
}

pub fn log_to_js(s: &str) {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        js_console_log(s.as_ptr(), s.len() as i32);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        println!("{}", s);
    }
}

#[macroquad::main("sk engine")]
async fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Panic: {}", info);
        log_to_js(&msg);
    }));

    loop {
        clear_background(DARKGRAY);

        ENGI.with(|engi| {
            if let Some(engi) = engi.borrow_mut().as_mut() {
                engi.update();
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