
window.SKEngine = (() => {
    let ready = false;
    let errorPopup = null;

    function showError(error, step = "unknown") {
        const message = error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);

        const details =
            `\nstep: ${step}\n\n${message}` +
            (error?.stack ? `\n\nstack trace:\n${error.stack}` : "");

        console.error(details, error);

        if (errorPopup) {
            errorPopup.remove();
        }

        const overlay = document.createElement("div");

        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.75)",
            zIndex: "999999",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            fontFamily: "monospace"
        });

        const box = document.createElement("div");

        Object.assign(box.style, {
            background: "#000",
            color: "#fff",
            width: "100%",
            maxWidth: "550px",
        });


        const description = document.createElement("p");
        description.textContent = `something went wrong during: ${step}`;

        const errorText = document.createElement("pre");
        errorText.textContent = details;

        Object.assign(errorText.style, {
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: "250px",
            overflowY: "auto",
            color: "#fffefe"
        });

        const buttons = document.createElement("div");

        Object.assign(buttons.style, {
            display: "flex",
            gap: "10px",
            marginTop: "16px"
        });

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy Error";

        Object.assign(copyButton.style, {
            background: "#ff4444",
            color: "white",
            border: "none",
            cursor: "pointer"
        });

        copyButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(details);
                copyButton.textContent = "copied";
            } catch (copyError) {
                console.error("failed to copy error:", copyError);
                const textarea = document.createElement("textarea");
                textarea.value = details;
                document.body.appendChild(textarea);
                textarea.select();

                try {
                    document.execCommand("copy");
                    copyButton.textContent = "copied";
                } catch {
                    copyButton.textContent = "copying failed";
                }

                textarea.remove();
            }
        };

        const closeButton = document.createElement("button");
        closeButton.textContent = "close";

        Object.assign(closeButton.style, {
            color: "black",
            border: "none",
            cursor: "pointer"
        });

        closeButton.onclick = () => {
            overlay.remove();
            errorPopup = null;
        };

        buttons.append(copyButton, closeButton);
        box.append(description, errorText, buttons);
        overlay.appendChild(box);

        document.body.appendChild(overlay);
        errorPopup = overlay;

        window.alert(`error!\n\nstep: ${step}\n\n${message}`);
    }

    function handleError(error, step) {
        showError(error, step);
        throw error;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");

            script.src = new URL(src, location.href).href;
            script.async = true;

            script.onload = resolve;

            script.onerror = () => reject(
                new Error(`failed to fetch JavaScript: ${script.src}`)
            );

            document.head.appendChild(script);
        });
    }

    async function init() {
        try {
            console.log("loading mg.js...");

            try {
                await loadScript("/dist/mg.js");
            } catch (error) {
                handleError(error, "loading /dist/mg.js");
            }

            if (typeof miniquad_add_plugin !== "function") {
                handleError(
                    new Error("mg.js did not expose miniquad_add_plugin"),
                    "initializing miniquad"
                );
            }

            console.log("registering plugin..");

            miniquad_add_plugin({
                register_plugin(importobject) {
                    importobject.env.js_console_log = function (ptr, len) {
                        try {
                            const memory = new Uint8Array(wasm_memory.buffer);
                            const bytes = memory.subarray(ptr, ptr + len);

                            console.log(
                                new TextDecoder().decode(bytes)
                            );
                        } catch (error) {
                            showError(error, "WASM console logging");
                        }
                    };
                },

                on_init() {
                    ready = true;
                    console.log("engine ready");
                }
            });

            console.log("loading WASM...");

            try {
                load("/dist/sk-engine.wasm");
            } catch (error) {
                handleError(error, "loading sk-engine.wasm");
            }

        } catch (error) {
            if (!errorPopup) {
                showError(error, "engine initialization");
            }

            throw error;
        }
    }

    function load_bytes(bytes) {
        try {
            if (!ready) {
                throw new Error("engine is not ready");
            }

            const ptr = wasm_exports.alloc_json(bytes.length);

            if (!ptr) {
                throw new Error("rust allocation failed");
            }

            try {
                new Uint8Array(wasm_memory.buffer, ptr, bytes.length)
                    .set(bytes);

                const result = wasm_exports.load_json(ptr, bytes.length);

                if (result === 0) {
                    throw new Error("WASM rejected the JSON data");
                }

                return true;
            } finally {
                wasm_exports.free_json(ptr, bytes.length);
            }

        } catch (error) {
            handleError(error, "loading JSON bytes");
        }
    }

    function load_json(text, canvasid = "glcanvas") {
        try {
            JSON.parse(text);

            document.getElementById(canvasid)?.focus();

            const bytes = new TextEncoder().encode(text);

            return load_bytes(bytes);

        } catch (error) {
            if (!errorPopup) {
                showError(error, "loading JSON");
            }

            throw error;
        }
    }

    async function load_file(file) {
        try {
            if (!file) {
                throw new Error("no file was provided");
            }

            const buffer = await file.arrayBuffer();

            return load_bytes(new Uint8Array(buffer));

        } catch (error) {
            if (!errorPopup) {
                showError(error, "loading JSON file");
            }

            throw error;
        }
    }

    return {
        init,
        is_ready: () => ready,
        load_bytes,
        load_json,
        load_file
    };
})();

SKEngine.init().catch(error => {
    console.error("initialization failed:", error);
});
