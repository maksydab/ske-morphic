const cnv = document.getElementById("programming-canvas");
const ctx = cnv.getContext('2d');

const node_blueprints = {
  "onStart": { inputs: [], outputs: [{ id: "flowout", type: "flow" }] },
  "onClick": { inputs: [], outputs: [{ id: "flowout", type: "flow" }] },
  "move": {
    inputs: [{ id: "flowin", type: "flow" }, { id: "by", type: "data", default: 1.0 }],
    outputs: [{ id: "flowout", type: "flow" }]
  },
  "if": {
    inputs: [{ id: "flowin", type: "flow" }, { id: "condition", type: "data", default: true }],
    outputs: [{ id: "true", type: "flow" }, { id: "false", type: "flow" }]
  },
  "add": {
    inputs: [{ id: "a", type: "data", default: 1.0 }, { id: "b", type: "data", default: 1.0 }],
    outputs: [{ id: "out", type: "data" }]
  },
  "getProp": {
    inputs: [{ id: "n", type: "data", default: "x" }],
    outputs: [{ id: "p", type: "data" }]
  },
  "changeProp": {
    inputs: [{ id: "flowin", type: "flow" },{ id: "n", type: "data", default: "x" },{ id: "val", type: "data", default: "0" }],
    outputs: [{ id: "out", type: "data" },{ id: "p", type: "data" }]
  },
  "value": {
    inputs: [{ id: "val", type: "data", default: 0.0 }],
    outputs: [{ id: "out", type: "data" }]
  },
  "subtract": {
    inputs: [{ id: "a", type: "data", default: 1.0 }, { id: "b", type: "data", default: 1.0 }],
    outputs: [{ id: "out", type: "data" }]
  },
  "mult": {
    inputs: [{ id: "a", type: "data", default: 1.0 }, { id: "b", type: "data", default: 1.0 }],
    outputs: [{ id: "out", type: "data" }]
  },
  "div": {
    inputs: [{ id: "a", type: "data", default: 1.0 }, { id: "b", type: "data", default: 1.0 }],
    outputs: [{ id: "out", type: "data" }]
  },
};

let currententity = null;
let graphnodes = [];
let connections = [];
let nextnodeid = 1;
let draggingnode = null;
let dragoffset = { x: 0, y: 0 };
let connectingpin = null;
let mousepos = { x: 0, y: 0 };
let selectednode = null;

let camera = { x: 0, y: 0, z: 1 };
let ispanning = false;
let lastmouse = { x: 0, y: 0 };

function setupgraphui() {
  const panel = document.querySelector(".panel-vc .bg");
  if (!panel) return;
  panel.style.position = "relative";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.padding = "10px";
  panel.style.overflowY = "auto";

  panel.innerHTML = "<h1>Entity</h1><div class='graph-entity-info' style='margin-bottom:15px; color:#9bb2bc;'>no entity selected</div>";

  const addpanel = document.createElement("div");
  addpanel.style.display = "flex";
  addpanel.style.flexDirection = "column";
  addpanel.style.gap = "5px";

  Object.keys(node_blueprints).forEach(type => {
    const btn = document.createElement("button");
    btn.textContent = "+ " + type;
    btn.className = "btn";
    btn.onclick = () => {
      if (!currententity) return alert("select an entity from the sidebar firstly.");
      const centerx = camera.x + (cnv.clientWidth / 2) / camera.z;
      const centery = camera.y + (cnv.clientHeight / 2) / camera.z;
      addnode(type, centerx - 75, centery - 50);
      savegraphtoentity();
    };
    addpanel.appendChild(btn);
  });

  panel.appendChild(addpanel);

  window.onentityselected = (name) => {
    loadentitygraph(name);
  };

  if (window.selectedentity) {
    loadentitygraph(window.selectedentity);
  }
}

function screentoworld(x, y) {
  return {
    x: x / camera.z + camera.x,
    y: y / camera.z + camera.y
  };
}

function loadentitygraph(entityname) {
  currententity = entityname;
  graphnodes = [];
  connections = [];
  nextnodeid = 1;
  selectednode = null;
  camera = { x: 0, y: 0, z: 1 };

  const infodiv = document.querySelector(".graph-entity-info");
  if (infodiv) {
    infodiv.textContent = entityname ? `selected: ${entityname}` : "no entity selected";
  }

  if (!entityname || !window.game || !window.game.entities[entityname]) return;

  const entity = window.game.entities[entityname];
  let visualcomp = entity.components.find(c => c.type === "visual");
  if (!visualcomp) {
    visualcomp = { type: "visual", p: { vars: {}, nodes: [] } };
    entity.components.push(visualcomp);
  }

  const jsonnodes = visualcomp.p.nodes || [];
  let startx = 50;

  function parsenode(jsonobj, posx, posy) {
    if (!jsonobj || !jsonobj.t) return null;

    const node = addnode(jsonobj.t, jsonobj.uiX !== undefined ? jsonobj.uiX : posx, jsonobj.uiY !== undefined ? jsonobj.uiY : posy);
    if (!node) return null;

    if (jsonobj.inputs && typeof jsonobj.inputs === "object") {
      for (const key in jsonobj.inputs) {
        const val = jsonobj.inputs[key];
        if (val && typeof val === "object" && val.t) {
          const childnode = parsenode(val, posx - 180, posy + 60);
          if (childnode) {
            const outpin = childnode.outputs.find(o => o.type === "data") || childnode.outputs[0];
            if (outpin) {
              connections.push({
                fromNodeId: childnode.id,
                fromPinId: outpin.id,
                toNodeId: node.id,
                toPinId: key
              });
            }
          }
        } else {
          const inputpin = node.inputs.find(i => i.id === key);
          if (inputpin) inputpin.value = val;
        }
      }
    } else if (jsonobj.t === "getProp" && typeof jsonobj.inputs === "string") {
      const inputpin = node.inputs.find(i => i.id === "n");
      if (inputpin) inputpin.value = jsonobj.inputs;
    }

    if (jsonobj.to && typeof jsonobj.to === "object") {
      const nextnode = parsenode(jsonobj.to, posx + 180, posy);
      if (nextnode) {
        const flowoutpin = node.outputs.find(o => o.id === "true" || o.id === "flowout") || node.outputs[0];
        const flowinpin = nextnode.inputs.find(i => i.id === "flowin") || nextnode.inputs[0];
        if (flowoutpin && flowinpin) {
          connections.push({
            fromNodeId: node.id,
            fromPinId: flowoutpin.id,
            toNodeId: nextnode.id,
            toPinId: flowinpin.id
          });
        }
      }
    }

    return node;
  }

  jsonnodes.forEach((rootjson, idx) => {
    parsenode(rootjson, startx, 80 + idx * 120);
    startx += 350;
  });
}

function addnode(type, x, y, custominputs = {}) {
  const blueprint = node_blueprints[type];
  if (!blueprint) return null;

  const node = {
    id: nextnodeid++,
    type: type,
    x: x,
    y: y,
    width: 150,
    height: Math.max(blueprint.inputs.length, blueprint.outputs.length) * 24 + 35,
    inputs: blueprint.inputs.map(i => ({ ...i, value: custominputs[i.id] ?? i.default })),
    outputs: blueprint.outputs.map(o => ({ ...o }))
  };
  graphnodes.push(node);
  return node;
}

function savegraphtoentity() {
  if (!window.game || !currententity || !window.game.entities[currententity]) return;

  const entity = window.game.entities[currententity];
  let visualcomp = entity.components.find(c => c.type === "visual");
  if (!visualcomp) {
    visualcomp = { type: "visual", p: { vars: {}, nodes: [] } };
    entity.components.push(visualcomp);
  }

  const rootnodes = graphnodes.filter(n => {
    const istarget = connections.some(c => c.toNodeId === n.id);
    return !istarget;
  });

  function serializenode(node, visited = new Set()) {
    if (visited.has(node.id)) return null;
    visited.add(node.id);

    const json = {
      t: node.type,
      uiX: node.x,
      uiY: node.y
    };

    const inputconns = connections.filter(c => c.toNodeId === node.id);
    if (inputconns.length > 0 || node.inputs.some(i => i.value !== undefined)) {
      json.inputs = {};
      node.inputs.forEach(pin => {
        const conn = inputconns.find(c => c.toPinId === pin.id);
        if (conn) {
          const srcnode = graphnodes.find(n => n.id === conn.fromNodeId);
          if (srcnode) {
            const res = serializenode(srcnode, new Set(visited));
            if (res) json.inputs[pin.id] = res;
          }
        } else if (pin.value !== undefined) {
          json.inputs[pin.id] = pin.value;
        }
      });
    }

    const flowconn = connections.find(c => c.fromNodeId === node.id && (c.fromPinId === "flowout" || c.fromPinId === "true"));
    if (flowconn) {
      const targetnode = graphnodes.find(n => n.id === flowconn.toNodeId);
      if (targetnode) {
        const res = serializenode(targetnode, new Set(visited));
        if (res) json.to = res;
      }
    }

    visited.delete(node.id);
    return json;
  }

  visualcomp.p.nodes = rootnodes.map(n => serializenode(n)).filter(Boolean);
}

function getpinpos(node, pinid, isoutput) {
  const pins = isoutput ? node.outputs : node.inputs;
  const idx = pins.findIndex(p => p.id === pinid);
  const y = node.y + 35 + idx * 22;
  const x = isoutput ? node.x + node.width : node.x;
  return { x, y };
}

function getinputboxrect(node, pin) {
  const idx = node.inputs.findIndex(p => p.id === pin.id);
  const y = node.y + 35 + idx * 22 - 8;
  const x = node.x + 45;
  return { x, y, w: 55, h: 16 };
}

cnv.addEventListener("mousedown", (e) => {
  const rect = cnv.getBoundingClientRect();
  const rawx = e.clientX - rect.left;
  const rawy = e.clientY - rect.top;
  const worldpos = screentoworld(rawx, rawy);
  const mx = worldpos.x;
  const my = worldpos.y;

  if (e.button === 1) {
    e.preventDefault();
    ispanning = true;
    lastmouse.x = e.clientX;
    lastmouse.y = e.clientY;
    return;
  }

  for (const node of graphnodes) {
    for (const pin of node.inputs) {
      if (pin.type === "data" && !connections.some(c => c.toNodeId === node.id && c.toPinId === pin.id)) {
        const r = getinputboxrect(node, pin);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          const valstr = prompt(`enter value for ${pin.id}:`, pin.value ?? "");
          if (valstr !== null) {
            let parsed = valstr;
            if (valstr === "true") parsed = true;
            else if (valstr === "false") parsed = false;
            else if (!isNaN(valstr) && valstr.trim() !== "") parsed = Number(valstr);
            pin.value = parsed;
            savegraphtoentity();
          }
          return;
        }
      }

      const pos = getpinpos(node, pin.id, false);
      if (Math.hypot(mx - pos.x, my - pos.y) < 10 / camera.z) {
        connections = connections.filter(c => !(c.toNodeId === node.id && c.toPinId === pin.id));
        connectingpin = { nodeId: node.id, pinId: pin.id, isOutput: false, pinType: pin.type, x: pos.x, y: pos.y };
        return;
      }
    }

    for (const pin of node.outputs) {
      const pos = getpinpos(node, pin.id, true);
      if (Math.hypot(mx - pos.x, my - pos.y) < 10 / camera.z) {
        connectingpin = { nodeId: node.id, pinId: pin.id, isOutput: true, pinType: pin.type, x: pos.x, y: pos.y };
        return;
      }
    }
  }

  for (const node of graphnodes) {
    if (mx >= node.x && mx <= node.x + node.width && my >= node.y && my <= node.y + node.height) {
      draggingnode = node;
      selectednode = node;
      dragoffset = { x: mx - node.x, y: my - node.y };
      return;
    }
  }

  selectednode = null;
});

cnv.addEventListener("mousemove", (e) => {
  const rect = cnv.getBoundingClientRect();
  const rawx = e.clientX - rect.left;
  const rawy = e.clientY - rect.top;
  const worldpos = screentoworld(rawx, rawy);
  mousepos.x = worldpos.x;
  mousepos.y = worldpos.y;

  if (ispanning) {
    const dx = e.clientX - lastmouse.x;
    const dy = e.clientY - lastmouse.y;
    camera.x -= dx / camera.z;
    camera.y -= dy / camera.z;
    lastmouse.x = e.clientX;
    lastmouse.y = e.clientY;
    return;
  }

  if (draggingnode) {
    draggingnode.x = mousepos.x - dragoffset.x;
    draggingnode.y = mousepos.y - dragoffset.y;
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 1) {
    ispanning = false;
  }

  if (connectingpin) {
    for (const node of graphnodes) {
      const pins = connectingpin.isOutput ? node.inputs : node.outputs;
      pins.forEach(pin => {
        const pos = getpinpos(node, pin.id, !connectingpin.isOutput);
        if (Math.hypot(mousepos.x - pos.x, mousepos.y - pos.y) < 12 / camera.z) {
          if (node.id !== connectingpin.nodeId && pin.type === connectingpin.pinType) {
            const from = connectingpin.isOutput ? connectingpin : { nodeId: node.id, pinId: pin.id };
            const to = connectingpin.isOutput ? { nodeId: node.id, pinId: pin.id } : connectingpin;

            connections = connections.filter(c => !(c.toNodeId === to.nodeId && c.toPinId === to.pinId));

            connections.push({
              fromNodeId: from.nodeId,
              fromPinId: from.pinId,
              toNodeId: to.nodeId,
              toPinId: to.pinId
            });
          }
        }
      });
    }
    connectingpin = null;
    savegraphtoentity();
  }

  if (draggingnode) {
    draggingnode = null;
    savegraphtoentity();
  }
});

cnv.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = cnv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const worldbefore = screentoworld(mx, my);
  const zoomfactor = Math.exp(-e.deltaY * 0.001);
  camera.z = Math.max(0.2, Math.min(5, camera.z * zoomfactor));
  const worldafter = screentoworld(mx, my);

  camera.x += worldbefore.x - worldafter.x;
  camera.y += worldbefore.y - worldafter.y;
}, { passive: false });

cnv.addEventListener("auxclick", (e) => {
  if (e.button === 1) e.preventDefault();
});

window.addEventListener("keydown", (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectednode) {
    if (document.activeElement.tagName === "INPUT") return;
    graphnodes = graphnodes.filter(n => n.id !== selectednode.id);
    connections = connections.filter(c => c.fromNodeId !== selectednode.id && c.toNodeId !== selectednode.id);
    selectednode = null;
    savegraphtoentity();
  }
});

function render() {
  const dpr = window.devicePixelRatio || 1;
  const width = cnv.width / dpr;
  const height = cnv.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#28292b";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.scale(camera.z, camera.z);
  ctx.translate(-camera.x, -camera.y);

  connections.forEach(conn => {
    const fromnode = graphnodes.find(n => n.id === conn.fromNodeId);
    const tonode = graphnodes.find(n => n.id === conn.toNodeId);
    if (!fromnode || !tonode) return;

    const p1 = getpinpos(fromnode, conn.fromPinId, true);
    const p2 = getpinpos(tonode, conn.toPinId, false);

    ctx.beginPath();
    ctx.strokeStyle = conn.fromPinId.includes("flow") || conn.fromPinId === "true" || conn.fromPinId === "false" ? "#ffffff" : "#ff0000";
    ctx.lineWidth = 2;
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(p1.x + 40, p1.y, p2.x - 40, p2.y, p2.x, p2.y);
    ctx.stroke();
  });

  if (connectingpin) {
    ctx.beginPath();
    ctx.strokeStyle = connectingpin.pinType === "flow" ? "#ffffff" : "#ff0000";
    ctx.lineWidth = 2;
    ctx.moveTo(connectingpin.x, connectingpin.y);
    ctx.lineTo(mousepos.x, mousepos.y);
    ctx.stroke();
  }

  graphnodes.forEach(node => {
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = selectednode && selectednode.id === node.id ? "#ff0000" : "#ffffff";
    ctx.lineWidth = selectednode && selectednode.id === node.id ? 2 : 1;
    ctx.fillRect(node.x, node.y, node.width, node.height);
    ctx.strokeRect(node.x, node.y, node.width, node.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(node.type, node.x + 8, node.y + 16);

    node.inputs.forEach(pin => {
      const pos = getpinpos(node, pin.id, false);
      ctx.beginPath();
      ctx.fillStyle = pin.type === "flow" ? "#ffffff" : "#ff0000";
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.fillText(pin.id, pos.x + 8, pos.y + 3);

      if (pin.type === "data") {
        const hasconn = connections.some(c => c.toNodeId === node.id && c.toPinId === pin.id);
        if (!hasconn) {
          const r = getinputboxrect(node, pin);
          ctx.fillStyle = "#141414";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.strokeStyle = "#ffffff";
          ctx.strokeRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = "#ffffff";
          ctx.font = "9px sans-serif";
          ctx.fillText(pin.value !== undefined ? pin.value : "", r.x + 3, r.y + 12);
        }
      }
    });

    node.outputs.forEach(pin => {
      const pos = getpinpos(node, pin.id, true);
      ctx.beginPath();
      ctx.fillStyle = pin.type === "flow" ? "#ffffff" : "#ff0000";
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.fillText(pin.id, pos.x - 8 - ctx.measureText(pin.id).width, pos.y + 3);
    });
  });

  ctx.restore();
  requestAnimationFrame(render);
}

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

setupgraphui();
resizecanvas();
render();

window.savegraphtoentity = savegraphtoentity;