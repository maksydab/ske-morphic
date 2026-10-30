class AsciiImage extends HTMLElement {
  static get observedAttributes() {
    return ["src", "cols", "edge-strength", "edge-balance", "layer-offset"];
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this._rendrid = 0;
    this.canv = document.createElement("canvas");
    this.ctx = this.canv.getContext("2d", { willReadFrequently: true });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
          font-family: monospace;
          font-size: var(--ascii-size, 8px);
          line-height: 1;
          white-space: pre;
          color: var(--main, #fff);
        }
        .wrap {
          position: relative;
          display: inline-block;
          white-space: pre;
        }
        pre {
          position: absolute;
          inset: 0;
          margin: 0;
          padding: 0;
          white-space: pre;
          font: inherit;
          line-height: inherit;
          letter-spacing: inherit;
          pointer-events: none;
        }
        .backgrnd {
          color: var(--dark, #666);
          transform: translate(var(--layer-offset, 0.35px), var(--layer-offset, 0.35px));
        }
        .foregrnd {
          position: relative;
          color: var(--main, #fff);
          opacity: var(--fg-opacity, 1);
        }
      </style>
      <span class="wrap">
        <pre class="backgrnd"></pre>
        <pre class="foregrnd"></pre>
      </span>
    `;

    this.wrap = this.shadowRoot.querySelector(".wrap");
    this.backgrnd = this.shadowRoot.querySelector(".backgrnd");
    this.foregrnd = this.shadowRoot.querySelector(".foregrnd");
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  async render() {
    const rendrid = ++this._rendrid;
    const src = this.getAttribute("src");

    if (!src) {
      this.backgrnd.textContent = "";
      this.foregrnd.textContent = "";
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });
    } catch {
      return;
    }

    if (rendrid !== this._rendrid) return;

    const cols = Math.max(8, Math.min(300, Number(this.getAttribute("cols")) || 100));
    const ratio = img.naturalWidth / img.naturalHeight;
    const rows = Math.max(2, Math.round(cols / (2 * ratio)));

    this.canv.width = cols * 2;
    this.canv.height = rows * 4;
    this.ctx.clearRect(0, 0, this.canv.width, this.canv.height);
    this.ctx.drawImage(img, 0, 0, this.canv.width, this.canv.height);

    let pixls;

    try {
      pixls = this.ctx.getImageData(0, 0, this.canv.width, this.canv.height);
    } catch {
      return;
    }

    const { data, width, height } = pixls;
    const gray = new Float32Array(width * height);
    const alpha = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const p = i * 4;
      gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      alpha[i] = data[p + 3] / 255;
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const getbrightnes = (x, y) => {
      x = clamp(x, 0, width - 1);
      y = clamp(y, 0, height - 1);
      return gray[y * width + x];
    };

    const edgmap = new Float32Array(width * height);
    const edgvals = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;

        if (alpha[i] < 0.1) continue;

        const a = getbrightnes(x - 1, y - 1);
        const b = getbrightnes(x, y - 1);
        const c = getbrightnes(x + 1, y - 1);
        const d = getbrightnes(x - 1, y);
        const f = getbrightnes(x + 1, y);
        const g = getbrightnes(x - 1, y + 1);
        const h = getbrightnes(x, y + 1);
        const j = getbrightnes(x + 1, y + 1);

        const gx = -a + c - 2 * d + 2 * f - g + j;
        const gy = -a - 2 * b - c + g + 2 * h + j;
        const strenght = Math.hypot(gx, gy);

        edgmap[i] = strenght;

        if (strenght > 0) edgvals.push(strenght);
      }
    }

    if (!edgvals.length) {
      this.backgrnd.textContent = "";
      this.foregrnd.textContent = "";
      return;
    }

    edgvals.sort((a, b) => a - b);

    const percentile = (p) => edgvals[Math.floor((edgvals.length - 1) * p)];
    const lowedg = percentile(0.45);
    const highedg = Math.max(lowedg + 1, percentile(0.88));
    const maxedg = Math.max(1, percentile(0.98));

    const edgstrenght = clamp(
      Number(this.getAttribute("edge-strength")) || 1,
      0.2,
      3
    );

    const edgbalance = clamp(
      Number(this.getAttribute("edge-balance")) || 0.55,
      0.1,
      0.9
    );

    const split = lowedg + (highedg - lowedg) * edgbalance;
    const scoremap = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (alpha[i] < 0.1) continue;

        const cur = edgmap[i];
        const left = edgmap[i - 1];
        const right = edgmap[i + 1];
        const up = edgmap[i - width];
        const down = edgmap[i + width];

        const localmax = cur >= left && cur >= right && cur >= up && cur >= down;

        if (!localmax || cur < lowedg) continue;

        const norm = cur / maxedg;
        const relative = (cur - lowedg) / Math.max(1, highedg - lowedg);

        scoremap[i] = clamp(
          (norm * 0.45 + relative * 0.55) * edgstrenght,
          0,
          1
        );
      }
    }

    const dotbits = [
      [0, 0, 1],
      [0, 1, 2],
      [0, 2, 4],
      [1, 0, 8],
      [1, 1, 16],
      [1, 2, 32],
      [0, 3, 64],
      [1, 3, 128]
    ];

    const bgthresh = clamp((split / maxedg) * 0.55 + 0.13, 0.1, 0.7);
    const fgthresh = clamp(bgthresh + 0.14, 0.22, 0.92);

    let bgtext = "";
    let fgtext = "";

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const vals = [];

        for (const [dx, dy, bit] of dotbits) {
          const x = cx * 2 + dx;
          const y = cy * 4 + dy;
          const i = y * width + x;
          vals.push({ bit, score: scoremap[i] });
        }

        let bgbits = 0;
        let fgbits = 0;

        for (const dot of vals) {
          if (dot.score >= fgthresh) {
            fgbits |= dot.bit;
          } else if (dot.score >= bgthresh) {
            bgbits |= dot.bit;
          }
        }

        bgtext += String.fromCharCode(0x2800 + bgbits);
        fgtext += String.fromCharCode(0x2800 + fgbits);
      }

      if (cy < rows - 1) {
        bgtext += "\n";
        fgtext += "\n";
      }
    }

    if (rendrid !== this._rendrid) return;

    this.backgrnd.textContent = bgtext;
    this.foregrnd.textContent = fgtext;
  }
}

customElements.define("ascii-image", AsciiImage);
