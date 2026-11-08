import "/assets/scripts/graph.js";

const template_entities = {
  "Empty Entity": {
    "components": [
      {
        "type": "renderer",
        "p": {
          "img": `
2d2d2
2c2c2
d222d
2ddd2
22222`.toString().replaceAll("\n", ""),
          "size": {
            "x": 5,
            "y": 5
          }
        }
      },
      {
        "type": "visual",
        "p": {
          "vars": {
            "hello": "world"
          },
          "nodes": [
            {
              "t": "onClick",
              "to": {
                "t": "changeProp",
                "inputs": {
                  "n": "x",
                  "val": {
                    "t": "add",
                    "inputs": {
                      "a": {
                        "t": "getProp",
                        "inputs": {
                          "n": "x"
                        }
                      },
                      "b": 1.2
                    }
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
}

const game = {
  "bg-col": 1,
  "v": 1,
  "pallete":1,
  "entities": {},
  "scene": []
}

const classes = ["panel-de", "panel-vc", "panel-play"];
const cnv = document.getElementById("editor-canvas");
const ctx = cnv.getContext('2d');

var camera = { "x": -1, "y": -0.5, "z": 0.8 }
let ispanning = false;
let lastmouse = { x: 0, y: 0 };
let selectedentity = null;
let isloadingengine = false;
let selectedinstances = [];
let dragmode = null;
let dragstart = null;
let selectionstart = null;
const palette = [
  "#141414", "#28292b", "#625565", "#a46868", "#b99a76", "#6a4460", "#7f708a", "#9bb2bc", "#c9e4d5", "#ffffff",
  "#721919", "#bf241b", "#ff492b", "#ff804a", "#ba0d22", "#ff2e2e", "#ff7023", "#ff9b19", "#ffc82f", "#7f213c",
  "#a73526", "#e5652f", "#fd9341", "#ffbe5a", "#4c3a1a", "#696827", "#a9b234", "#eaf73e", "#fbff90", "#0a5c4b",
  "#119860", "#06ca6f", "#92ee60", "#dbf263", "#313638", "#2e4d48", "#47815d", "#95b682", "#bcc68e", "#005e66",
  "#008a90", "#00b39d", "#1ffcca", "#92ffe8", "#282953", "#3b3e7a", "#4362c8", "#40a0fd", "#99d7ff", "#44203c",
  "#6b3178", "#9957ba", "#ab82ff", "#f4acf8", "#782e4e", "#aa3968", "#e25c7d", "#fe7a98", "#8a0b5b", "#d20b47",
  "#ff4a78", "#ff8282", "#ffad97", "#ffd1b8"
];
const spritecache = {};
const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";


//utils 
function getentitysprite(entityname) {
  if (spritecache[entityname]) return spritecache[entityname];
  const entity = game.entities[entityname];
  if (!entity) return null;

  const renderercomp = entity.components?.find(c => c.type === "renderer");
  if (!renderercomp) return null;

  const imgstr = renderercomp.p.img;
  const size = renderercomp.p.size;
  const canvas = document.createElement("canvas");
  canvas.width = size.x;
  canvas.height = size.y;
  const sctx = canvas.getContext("2d");
  const imgdata = sctx.createImageData(size.x, size.y);

  for (let i = 0; i < imgstr.length; i++) {
    const index = charset.indexOf(imgstr[i]);
    if (index !== -1 && index < palette.length) {
      const hex = palette[index];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const idx = i * 4;
      imgdata.data[idx] = r;
      imgdata.data[idx + 1] = g;
      imgdata.data[idx + 2] = b;
      imgdata.data[idx + 3] = 255;
    }
  }
  sctx.putImageData(imgdata, 0, 0);
  spritecache[entityname] = canvas;
  return canvas;
}

function getviewport() {
  const rect = cnv.getBoundingClientRect();
  const boardsize = Math.min(rect.width, rect.height);
  const unit = boardsize / 10;

  return {
    width: rect.width,
    height: rect.height,
    boardSize: boardsize,
    unit,
    offsetX: (rect.width - boardsize) / 2,
    offsetY: (rect.height - boardsize) / 2
  };
}

function worldtopixel(x, y) {
  const v = getviewport();
  return {
    x: v.offsetX + (x - camera.x) * v.unit * camera.z + (v.boardSize / 2) * (1 - camera.z),
    y: v.offsetY + (y - camera.y) * v.unit * camera.z + (v.boardSize / 2) * (1 - camera.z)
  };
}

function pixeltoworld(x, y) {
  const v = getviewport();
  return {
    x: camera.x + (x - v.offsetX - (v.boardSize / 2) * (1 - camera.z)) / (v.unit * camera.z),
    y: camera.y + (y - v.offsetY - (v.boardSize / 2) * (1 - camera.z)) / (v.unit * camera.z)
  };
}

function switcharoo(i) {
  for (let j = 0; j < classes.length; j++) {
    const panel = document.querySelector("." + classes[j]);
    if (j === i) {
      panel.className = classes[j] + " block";
    } else {
      panel.className = classes[j] + " hide";
    }
  }
  if (i === 2) {
    window.dispatchEvent(new Event('resize'));
  }
}

function selectentity(name) {
  selectedentity = name;
  window.selectedentity = name;

  const items = document.querySelectorAll(".entity-list .entity-item");
  items.forEach(item => {
    if (item.textContent === name) {
      item.style.background = "#8b8b8b5e";
    } else {
      item.style.background = "";
    }
  });

  if (window.onentityselected) {
    window.onentityselected(name);
  }
}

function refreshentitylist() {
  const er = document.querySelector(".entity-list");
  er.innerHTML = "";

  for (const name in game.entities) {
    const element = document.createElement("div");
    //element.textContent = name;
    element.className = "entity-item flex";
    element.draggable = true;
    const ppp = document.createElement("p");
    ppp.textContent=name;
    ppp.style="margin-top:10px; margin-bottom:10px;"
    element.appendChild(ppp)
    const delbut = document.createElement("button")
    delbut.className="btn ghost-btn"
    delbut.onclick=()=>{
      delete game.entities[name];
      game.scene = game.scene.filter(item => item.t !== name);
      refreshentitylist();
    }
    const delico = document.createElement("img")
    delico.src="/assets/a/icons/trash.png"
    delico.className="icon pix-img"
    delbut.appendChild(delico)
    element.appendChild(delbut)
    const editbut = document.createElement("button")
    editbut.className="btn ghost-btn"
    editbut.onclick=()=>{
      switcharoo(1);
      selectentity(name);
    }
    const editico = document.createElement("img")
    editico.src="/assets/a/icons/edit.png"
    editico.className="icon pix-img"
    editbut.appendChild(editico)
    element.appendChild(editbut)
    if (selectedentity === name) {
      element.style.background = "#8b8b8b5e";
    }

    element.onclick = () => {
      selectentity(name);
    };

    element.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("entity", name);
    });

    er.appendChild(element);
  }
}


function addentity(i) {
  let name = i;
  let count = 2;
  while (game.entities[name]) {
    name = `${i} (${count})`;
    count++;
  }
  const entity = structuredClone(template_entities[i]);
  const renderer = entity.components.find(c => c.type === "renderer");
  if (renderer) {
    const img = renderer.p.img.replace(/\s/g, "");
    const uniqueChars = [...new Set(img)];
    const indexes = Array.from(
      { length: palette.length },
      (_, i) => i
    );
    for (let j = indexes.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [indexes[j], indexes[k]] = [indexes[k], indexes[j]];
    }
    const mapping = new Map();
    uniqueChars.forEach((char, index) => {
      mapping.set(char, charset[indexes[index]]);
    });
    renderer.p.img = [...img]
      .map(char => mapping.get(char))
      .join("");
  }

  game.entities[name] = entity;

  delete spritecache[name];

  refreshentitylist();
}

function rundisc() {
  if (window.savegraphtoentity) {
    window.savegraphtoentity();
  }
  switcharoo(2);
  if (isloadingengine) return;
  isloadingengine = true;
  const tryload = () => {
    const glcanvas = document.getElementById("glcanvas");
    if (window.SKEngine && window.SKEngine.is_ready()) {
      isloadingengine = false;
      try {
        window.SKEngine.load_json(JSON.stringify(game));
        console.log(JSON.stringify(game))
        console.log("game data successfully streamed to sk-engine via rundisc()");
      } catch (err) {
        console.error("failed to load json into sk-engine:", err);
      }
    } else {
      setTimeout(tryload, 500);
    }
  };
  tryload();
}
function mousepos(e) {
  const rect = cnv.getBoundingClientRect();

  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}
function getlocalmouse(inst, mx, my) {
  const center = getinstcenter(inst);
  const angle = -(inst.p.r || 0) * Math.PI / 180;

  const dx = mx - center.x;
  const dy = my - center.y;

  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle)
  };
}

function isrotationhandle(inst, mx, my) {
  const local = getlocalmouse(inst, mx, my);
  const h = inst.p.h * getviewport().unit * camera.z;

  return (
    Math.abs(local.x) < 12 &&
    Math.abs(local.y + h / 2 + 25) < 12
  );
}
function getinstcenter(inst) {
  return worldtopixel(
    inst.p.x + inst.p.w / 2,
    inst.p.y + inst.p.h / 2
  );
}
function getselectionhandle(inst, mx, my) {
  const local = getlocalmouse(inst, mx, my);
  const scale = getviewport().unit * camera.z;
  const w = inst.p.w * scale;
  const h = inst.p.h * scale;
  const hit = 10;
  if (
    Math.abs(local.x) <= hit &&
    Math.abs(local.y - (-h / 2 - 25)) <= hit
  ) {
    return "rotate";
  }
  const handles = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ];

  for (const handle of handles) {
    const hx = handle.x * w / 2;
    const hy = handle.y * h / 2;

    if (
      Math.abs(local.x - hx) <= hit &&
      Math.abs(local.y - hy) <= hit
    ) {
      return handle;
    }
  }

  return null;
}


// courtesy of our fav ram eating evil black box
function hitinstance(inst, mx, my) {
  const center = getinstcenter(inst);
  const p = inst.p;
  const angle = -(p.r || 0) * Math.PI / 180;
  const dx = mx - center.x;
  const dy = my - center.y;
  const localx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localy = dx * Math.sin(angle) + dy * Math.cos(angle);
  const w = p.w * getviewport().unit * camera.z;
  const h = p.h * getviewport().unit * camera.z;
  return (
    Math.abs(localx) <= w / 2 &&
    Math.abs(localy) <= h / 2
  );
}
function findinst(mx, my) {
  for (let jj = game.scene.length - 1; jj >= 0; jj--) {
    if (hitinstance(game.scene[jj], mx, my)) {
      return jj;
    }
  }

  return -1;
}

// for rendering in the play 
function drawselection() {
  if (selectedinstances.length === 0) return;

  const index = selectedinstances[0];
  const inst = game.scene[index];

  if (!inst) return;

  const p = inst.p;
  const center = getinstcenter(inst);
  const scale = getviewport().unit * camera.z;
  const w = p.w * scale;
  const h = p.h * scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate((p.r || 0) * Math.PI / 180);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  const handleSize = 7;
  ctx.fillStyle = "#707070";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(0, -h / 2 - 25);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -h / 2 - 25, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#707070";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();


  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      if (x === 0 && y === 0) continue;

      const hx = x * w / 2;
      const hy = y * h / 2;

      ctx.fillRect(
        hx - handleSize / 2,
        hy - handleSize / 2,
        handleSize,
        handleSize
      );

      ctx.strokeRect(
        hx - handleSize / 2,
        hy - handleSize / 2,
        handleSize,
        handleSize
      );
    }
  }


  ctx.restore();
}

function renderr() {
  const dpr = window.devicePixelRatio || 1;
  const width = cnv.width / dpr;
  const height = cnv.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette[game["bg-col"]];
  ctx.fillRect(0, 0, width, height);

  const p0 = worldtopixel(0, 0);
  const p10 = worldtopixel(10, 10);

  ctx.beginPath();
  ctx.strokeStyle = "green";
  ctx.lineWidth = 2;
  ctx.moveTo(p0.x, -10000);
  ctx.lineTo(p0.x, 10000);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.moveTo(-10000, p0.y);
  ctx.lineTo(10000, p0.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(p0.x, p0.y, p10.x - p0.x, p10.y - p0.y);

  if (game.scene) {
    for (const inst of game.scene) {
      const topleft = worldtopixel(inst.p.x, inst.p.y);
      const bottomright = worldtopixel(inst.p.x + inst.p.w, inst.p.y + inst.p.h);
      const wpx = bottomright.x - topleft.x;
      const hpx = bottomright.y - topleft.y;

      const sprite = getentitysprite(inst.t);
      //console.log(inst)

      if (sprite) {
        ctx.save();

        ctx.imageSmoothingEnabled = false;
        const cx = topleft.x + wpx / 2;
        const cy = topleft.y + hpx / 2;
        ctx.translate(cx, cy);
        ctx.rotate((inst.p.r || 0) * Math.PI / 180);
        ctx.drawImage(sprite, -wpx / 2, -hpx / 2, wpx, hpx);

        ctx.restore();

      } else {
        ctx.fillStyle = "#ff492b";
        ctx.fillRect(topleft.x, topleft.y, wpx, hpx);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
  drawselection()
  requestAnimationFrame(renderr);
}

renderr();

function resizecanvas() {
  const rect = cnv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  cnv.width = Math.floor(rect.width * dpr);
  cnv.height = Math.floor(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const resizeobserver = new ResizeObserver(resizecanvas);
resizeobserver.observe(cnv);
window.addEventListener("resize", resizecanvas);
resizecanvas();

cnv.addEventListener("mousedown", (e) => {
  if (e.button === 1) {
    e.preventDefault();
    ispanning = true;
    lastmouse.x = e.clientX;
    lastmouse.y = e.clientY;
  }
  // this is the part for the 8 point sleetcion tool
  if (e.button === 0) {
    const mouse = mousepos(e);
    if (selectedinstances.length > 0) {
      const selectedindex = selectedinstances[0];
      const selectedinst = game.scene[selectedindex];

      if (selectedinst) {
        const handle = getselectionhandle(
          selectedinst,
          mouse.x,
          mouse.y
        );
        if (handle === "rotate") {
          const center = getinstcenter(selectedinst);

          dragmode = "rotate";
          dragstart = {
            index: selectedindex,
            startangle: Math.atan2(
              mouse.y - center.y,
              mouse.x - center.x
            ),
            rotation: selectedinst.p.r || 0
          };

          e.preventDefault();
          return;
        }

        if (handle) {
          const center = getinstcenter(selectedinst);
          dragmode = "resize";
          dragstart = {
            index: selectedindex,
            handle,
            center,
            x: selectedinst.p.x,
            y: selectedinst.p.y,
            w: selectedinst.p.w,
            h: selectedinst.p.h,
            rotation: selectedinst.p.r || 0
          };

          e.preventDefault();
          return;
        }
      }
    }
    const index = findinst(mouse.x, mouse.y);

    if (index === -1) {
      selectedinstances = [];
      dragmode = null;
      return;
    }

    if (e.shiftKey) {
      if (!selectedinstances.includes(index)) {
        selectedinstances.push(index);
      }
    } else if (!selectedinstances.includes(index)) {
      selectedinstances = [index];
    }

    dragmode = "move";

    dragstart = {
      x: mouse.x,
      y: mouse.y
    };

    selectionstart = selectedinstances.map(i => ({
      index: i,
      x: game.scene[i].p.x,
      y: game.scene[i].p.y
    }));

    e.preventDefault();
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 1) {
    ispanning = false;
  }
  if (e.button === 0) {
    dragmode = null;
    dragstart = null;
    selectionstart = null;
  }
});

cnv.addEventListener("mousemove", (e) => {
  if (ispanning) {
    const v = getviewport();
    const dx = e.clientX - lastmouse.x;
    const dy = e.clientY - lastmouse.y;

    camera.x -= dx / (v.unit * camera.z);
    camera.y -= dy / (v.unit * camera.z);

    lastmouse.x = e.clientX;
    lastmouse.y = e.clientY;
    return;
  }

  if (dragmode) {
    const mouse = mousepos(e);

    if (dragmode === "move") {
      const startworld = pixeltoworld(
        dragstart.x,
        dragstart.y
      );

      const currentworld = pixeltoworld(
        mouse.x,
        mouse.y
      );

      const dx = currentworld.x - startworld.x;
      const dy = currentworld.y - startworld.y;

      for (const item of selectionstart) {
        const inst = game.scene[item.index];

        inst.p.x = item.x + dx;
        inst.p.y = item.y + dy;
      }
    } else if (dragmode === "rotate") {
      const inst = game.scene[dragstart.index];
      const center = getinstcenter(inst);

      const angle = Math.atan2(
        mouse.y - center.y,
        mouse.x - center.x
      );

      const delta = angle - dragstart.startangle;

      inst.p.r = dragstart.rotation + delta * 180 / Math.PI;
    } else if (dragmode === "resize") {
      const inst = game.scene[dragstart.index];

      const angle = -dragstart.rotation * Math.PI / 180;

      const dx = mouse.x - dragstart.center.x;
      const dy = mouse.y - dragstart.center.y;

      const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

      const scale = getviewport().unit * camera.z;

      let left = -dragstart.w / 2;
      let right = dragstart.w / 2;
      let top = -dragstart.h / 2;
      let bottom = dragstart.h / 2;

      const handle = dragstart.handle;

      if (handle.x === -1) left = localX / scale;
      if (handle.x === 1) right = localX / scale;
      if (handle.y === -1) top = localY / scale;
      if (handle.y === 1) bottom = localY / scale;

      const minSize = 0.1;

      if (right - left < minSize) {
        if (handle.x === -1) left = right - minSize;
        else right = left + minSize;
      }

      if (bottom - top < minSize) {
        if (handle.y === -1) top = bottom - minSize;
        else bottom = top + minSize;
      }

      const newWidth = right - left;
      const newHeight = bottom - top;
      const worldCenter = pixeltoworld(
        dragstart.center.x,
        dragstart.center.y
      );

      const localCenterX = (left + right) / 2;
      const localCenterY = (top + bottom) / 2;

      const rotation = dragstart.rotation * Math.PI / 180;

      const offsetX =
        localCenterX * Math.cos(rotation) -
        localCenterY * Math.sin(rotation);

      const offsetY =
        localCenterX * Math.sin(rotation) +
        localCenterY * Math.cos(rotation);

      inst.p.w = newWidth;
      inst.p.h = newHeight;

      inst.p.x = worldCenter.x + offsetX - newWidth / 2;
      inst.p.y = worldCenter.y + offsetY - newHeight / 2;
    }

    e.preventDefault();
  }
});

cnv.addEventListener("auxclick", (e) => {
  if (e.button === 1) e.preventDefault();
});

cnv.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = cnv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const beforezoom = pixeltoworld(mx, my);
  const zoomfactor = Math.exp(-e.deltaY * 0.001);
  camera.z = Math.max(0.1, Math.min(5, camera.z * zoomfactor));
  const afterzoom = pixeltoworld(mx, my);

  camera.x += beforezoom.x - afterzoom.x;
  camera.y += beforezoom.y - afterzoom.y;
}, { passive: false });

cnv.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});

cnv.addEventListener("drop", (e) => {
  e.preventDefault();
  const entityname = e.dataTransfer.getData("entity");
  if (!entityname || !game.entities[entityname]) return;

  const rect = cnv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const worldpos = pixeltoworld(mx, my);

  game.scene.push({
    "t": entityname,
    "p": {
      "x": worldpos.x - 0.5,
      "y": worldpos.y - 0.5,
      "w": 1,
      "h": 1,
      "r": 90,
    }
  });
});

window.switcharoo = switcharoo;
window.addentity = addentity;
window.selectentity = selectentity;
window.rundisc = rundisc;
window.game = game;
window.getentitysprite=getentitysprite;