
const SKEngine = (() => {
    let ready = false;

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
            console.log("[sk engine]: engine ready!");
        }
    });

    function is_ready() {
        return ready;
    }

    function load_bytes(bytes) {
        if (!ready) {
            throw new Error("engine is not ready");
        }

        const ptr = wasm_exports.alloc_json(bytes.length);

        if (ptr === 0) {
            throw new Error("rust allocation failed");
        }

        try {
            const memory = new Uint8Array(
                wasm_memory.buffer,
                ptr,
                bytes.length
            );

            memory.set(bytes);

            return wasm_exports.load_json(ptr, bytes.length) !== 0;
        } finally {
            wasm_exports.free_json(ptr, bytes.length);
        }
    }

    function load_json(text) {
        JSON.parse(text);

        const bytes = new TextEncoder().encode(text);

        return load_bytes(bytes);
    }

    async function load_file(file) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        return load_bytes(bytes);
    }

    return {
        is_ready,
        load_bytes,
        load_json,
        load_file
    };
})();

load("dist/sk-engine.wasm");

