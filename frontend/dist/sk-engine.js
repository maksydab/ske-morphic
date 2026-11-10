
window.SKEngine = (() => {
    let ready = false;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");

            script.src = new URL(src, document.currentScript?.src || location.href).href;
            script.async = true;

            script.onload = resolve;
            script.onerror = () => reject(
                new Error("Failed to fetch: " + script.src)
            );

            document.head.appendChild(script);
        });
    }

    async function init() {
        await loadScript("/dist/mg.js");

        if (typeof miniquad_add_plugin !== "function") {
            throw new Error("mg.js did not expose miniquad_add_plugin");
        }

        miniquad_add_plugin({
            register_plugin(importobject) {
                importobject.env.js_console_log = function (ptr, len) {
                    const memory = new Uint8Array(wasm_memory.buffer);
                    const bytes = memory.subarray(ptr, ptr + len);

                    console.log(
                        "[sk engine]:",
                        new TextDecoder().decode(bytes)
                    );
                };
            },

            on_init() {
                ready = true;
                console.log("[sk engine]: engine ready!");
            }
        });

        load("/dist/sk-engine.wasm");
    }

    function load_bytes(bytes) {
        if (!ready) throw new Error("engine is not ready");

        const ptr = wasm_exports.alloc_json(bytes.length);
        if (!ptr) throw new Error("rust allocation failed");

        try {
            new Uint8Array(wasm_memory.buffer, ptr, bytes.length)
                .set(bytes);

            return wasm_exports.load_json(ptr, bytes.length) !== 0;
        } finally {
            wasm_exports.free_json(ptr, bytes.length);
        }
    }

    function load_json(text, canvasid = "glcanvas") {
        JSON.parse(text);

        document.getElementById(canvasid)?.focus();

        return load_bytes(new TextEncoder().encode(text));
    }

    async function load_file(file) {
        return load_bytes(
            new Uint8Array(await file.arrayBuffer())
        );
    }

    return {
        init,
        is_ready: () => ready,
        load_bytes,
        load_json,
        load_file
    };
})();

SKEngine.init().catch(console.error);
