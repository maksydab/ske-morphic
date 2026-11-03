let ready = false;

const status = document.getElementById("status");
const button = document.getElementById("loadbutton");

miniquad_add_plugin({
    register_plugin: function (importobject) {
        importobject.env.js_console_log = function (ptr, len) {
            const memory = new Uint8Array(wasm_memory.buffer);
            const bytes = memory.subarray(ptr, ptr + len);
            const text = new TextDecoder().decode(bytes);
            console.log("[sk engine]:", text);
        };
    },

    on_init: function () {
        ready = true;
        status.textContent = "engine ready!";
        button.disabled = false;
    }
});

function load_json_bytes(bytes) {
    if (!ready) {
        throw new Error("engine is not ready");
    }

    const ptr = wasm_exports.alloc_json(bytes.length);

    if (ptr === 0) {
        throw new Error("rust allocation failed");
    }

    try {
        const memoryview = new Uint8Array(
            wasm_memory.buffer,
            ptr,
            bytes.length
        );

        memoryview.set(bytes);

        return wasm_exports.load_json(
            ptr,
            bytes.length
        ) !== 0;

    } finally {
        wasm_exports.free_json(
            ptr,
            bytes.length
        );
    }
}

function load_from_editor() {
    try {
        const text = document.getElementById("json").value;

        JSON.parse(text);

        const bytes = new TextEncoder().encode(text);

        const success = load_json_bytes(bytes);

        status.textContent = success
            ? "json load success"
            : "invalid json";

    } catch (error) {
        status.textContent = "error: " + error.message;
    }
}

async function load_from_file(file) {
    try {
        const buffer = await file.arrayBuffer();

        const bytes = new Uint8Array(buffer);

        const success = load_json_bytes(bytes);

        status.textContent = success
            ? "loaded " + file.name + " (" +
            (file.size / 1024 / 1024).toFixed(2) +
            " MB)"
            : "invalid JSON!";

    } catch (error) {
        status.textContent = "error: " + error.message;
    }
}

button.addEventListener("click", load_from_editor);

document.getElementById("fileinput")
    .addEventListener("change", function (event) {
        const file = event.target.files[0];

        if (file) {
            load_from_file(file);
        }
    });

load("dist/sk-engine.wasm");