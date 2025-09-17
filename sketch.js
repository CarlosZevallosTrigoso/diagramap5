// VERSIÓN OPTIMIZADA (CARGA RÁPIDA)

// --- VARIABLES GLOBALES ---
let points = [];
let attractors;
const attractorsDefault = {
  icono:   { r: 10, name: 'Ícono',   color: [239, 68, 68] },
  indice:  { r: 10, name: 'Índice',  color: [34, 197, 94] },
  simbolo: { r: 10, name: 'Símbolo', color: [56, 189, 248] }
};

// NUEVA VARIABLE: Controla la resolución del gradiente.
// Un número más alto es más rápido pero más "pixelado". 10 es un buen balance.
const gradientResolution = 10; 

let diagramCenter;
let diagramRadius;
let gradientBuffer;
let canvas;
let draggedPoint = null;
let draggedAttractor = null;
let selectedId = null;
let calibMode = true;
let labelsVisible = true;
let sliders = {}, sliderVals = {}, listContainer;

// --- LÓGICA DE CÁLCULO (SIN CAMBIOS) ---
function computeFromSliders(vals) {
  const wI = Math.max(vals.icono, 1), wD = Math.max(vals.indice, 1), wS = Math.max(vals.simbolo, 1);
  const sum = wI + wD + wS;
  const x = (wI * attractors.icono.pos.x + wD * attractors.indice.pos.x + wS * attractors.simbolo.pos.x) / sum;
  const y = (wI * attractors.icono.pos.y + wD * attractors.indice.pos.y + wS * attractors.simbolo.pos.y) / sum;
  return createVector(x, y);
}

function slidersFromPosition(x, y) {
  const p = createVector(x, y);
  const a0 = attractors.icono.pos, a1 = attractors.indice.pos, a2 = attractors.simbolo.pos;
  const v0 = p5.Vector.sub(a1, a0), v1 = p5.Vector.sub(a2, a0), v2 = p5.Vector.sub(p, a0);
  const d00 = v0.dot(v0), d01 = v0.dot(v1), d11 = v1.dot(v1);
  const d20 = v2.dot(v0), d21 = v2.dot(v1);
  const denom = d00 * d11 - d01 * d01 || 1e-6;
  let v = (d11 * d20 - d01 * d21) / denom, w = (d00 * d21 - d01 * d20) / denom;
  let u = 1.0 - v - w;
  u = constrain(u, 0, 1); v = constrain(v, 0, 1); w = constrain(w, 0, 1);
  const s = u + v + w || 1; u /= s; v /= s; w /= s;
  const mapVal = t => Math.round(map(t, 0, 1, 1, 100));
  return { icono: mapVal(u), indice: mapVal(v), simbolo: mapVal(w) };
}

// --- INICIALIZACIÓN (SETUP) ---
function setup() {
  let container = document.getElementById('viz-container');
  canvas = createCanvas(container.offsetWidth, container.offsetHeight);
  canvas.parent('viz-container');
  canvas.drop(handleFile);

  gradientBuffer = createGraphics(width, height);

  diagramCenter = createVector(width / 2, height / 2);
  diagramRadius = min(width, height) * 0.45;

  attractors = JSON.parse(JSON.stringify(attractorsDefault));
  resetAttractors();
  
  setupDOMControls();
  updateList();
}

function resetAttractors() {
    angleMode(DEGREES);
    attractors.indice.pos = createVector(diagramCenter.x + diagramRadius * cos(30), diagramCenter.y + diagramRadius * sin(30));
    attractors.icono.pos = createVector(diagramCenter.x + diagramRadius * cos(150), diagramCenter.y + diagramRadius * sin(150));
    attractors.simbolo.pos = createVector(diagramCenter.x + diagramRadius * cos(270), diagramCenter.y + diagramRadius * sin(270));
    updateGradientBuffer();
    recalculateAllPoints();
}

// FUNCIÓN MODIFICADA: Ahora dibuja rectángulos en lugar de píxeles
function updateGradientBuffer() {
    gradientBuffer.noStroke(); // No queremos bordes en nuestros rectángulos
    
    for (let x = 0; x < gradientBuffer.width; x += gradientResolution) {
        for (let y = 0; y < gradientBuffer.height; y += gradientResolution) {
            
            if (dist(x, y, diagramCenter.x, diagramCenter.y) > diagramRadius) {
                gradientBuffer.fill(11, 11, 11);
            } else {
                const vals = slidersFromPosition(x, y);
                const total = vals.icono + vals.indice + vals.simbolo;

                const wI = vals.icono / total;
                const wD = vals.indice / total;
                const wS = vals.simbolo / total;

                const c1 = attractors.icono.color;
                const c2 = attractors.indice.color;
                const c3 = attractors.simbolo.color;

                const r = c1[0] * wI + c2[0] * wD + c3[0] * wS;
                const g = c1[1] * wI + c2[1] * wD + c3[1] * wS;
                const b = c1[2] * wI + c2[2] * wD + c3[2] * wS;
                
                gradientBuffer.fill(r, g, b);
            }
            // Dibuja el rectángulo del color calculado
            gradientBuffer.rect(x, y, gradientResolution, gradientResolution);
        }
    }
}

// --- BUCLE DE DIBUJO (DRAW) ---
function draw() {
  background(11, 11, 11);
  image(gradientBuffer, 0, 0);

  noFill();
  stroke(0);
  strokeWeight(2.5);
  circle(diagramCenter.x, diagramCenter.y, diagramRadius * 2);

  drawAttractors();
  drawPoints();
}

// --- El resto del código es idéntico a la versión anterior ---

function mouseDragged() {
    let constrainedPos = createVector(mouseX, mouseY);
    let d = dist(mouseX, mouseY, diagramCenter.x, diagramCenter.y);
    if (d > diagramRadius) {
        let v = p5.Vector.sub(constrainedPos, diagramCenter);
        v.setMag(diagramRadius);
        constrainedPos = p5.Vector.add(diagramCenter, v);
    }
    
    if (draggedAttractor) {
        draggedAttractor.pos.x = constrainedPos.x;
        draggedAttractor.pos.y = constrainedPos.y;
        recalculateAllPoints();
        updateGradientBuffer(); 
    } else if (draggedPoint) {
        draggedPoint.pos.x = constrainedPos.x;
        draggedPoint.pos.y = constrainedPos.y;
        draggedPoint.vals = slidersFromPosition(draggedPoint.pos.x, draggedPoint.pos.y);
        updateSlidersFromPoint(draggedPoint);
        updateListItem(draggedPoint);
    }
}

function windowResized() {
    let container = document.getElementById('viz-container');
    resizeCanvas(container.offsetWidth, container.offsetHeight);
    gradientBuffer = createGraphics(width, height);
    diagramCenter = createVector(width / 2, height / 2);
    diagramRadius = min(width, height) * 0.45;
    resetAttractors();
}

function drawAttractors() {
  for (const key in attractors) {
    const att = attractors[key];
    stroke(0);
    strokeWeight(1.5);
    fill(att.color);
    circle(att.pos.x, att.pos.y, att.r * 2);

    if (labelsVisible) {
      push();
      noStroke();
      fill(234, 234, 234);
      textSize(14);
      textAlign(CENTER, CENTER);
      let offset = att.r + 15;
      let angle = atan2(att.pos.y - diagramCenter.y, att.pos.x - diagramCenter.x);
      let textX = att.pos.x + offset * cos(angle);
      let textY = att.pos.y + offset * sin(angle);
      text(att.name, textX, textY);
      pop();
    }
  }
}

function drawPoints() {
  for (const p of points) {
    const isSelected = p.id === selectedId;
    
    push();
    translate(p.pos.x, p.pos.y);
    
    if (p.img) {
      const size = p.size * 2;
      imageMode(CENTER);
      image(p.img, 0, 0, size, size);
      noFill();
      stroke(255);
      strokeWeight(isSelected ? 2.5 : 1);
      rectMode(CENTER);
      rect(0, 0, size, size);
    } else {
      noFill();
      stroke('#a78bfa');
      strokeWeight(isSelected ? 3 : 1.5);
      rectMode(CENTER);
      rect(0, 0, p.size * 1.5, p.size * 1.5);
    }

    if (labelsVisible && (isSelected || (draggedPoint && draggedPoint.id === p.id))) {
        textAlign(CENTER);
        fill(11,11,11,180);
        noStroke();
        text(`${p.name}${p.locked ? ' 🔒' : ''}`, 0, -p.size - 10);
        textSize(11);
        text(`ico(${p.vals.icono}) ind(${p.vals.indice}) sim(${p.vals.simbolo})`, 0, p.size + 15);
    }
    pop();
  }
}

function mousePressed() {
  if (dist(mouseX, mouseY, diagramCenter.x, diagramCenter.y) > diagramRadius + 15) {
    draggedPoint = null;
    draggedAttractor = null;
    if(selectedId) {
        selectedId = null;
        updateList();
    }
    return;
  }
  
  if (calibMode) {
    for (const key in attractors) {
      if (dist(mouseX, mouseY, attractors[key].pos.x, attractors[key].pos.y) < attractors[key].r + 5) {
        draggedAttractor = attractors[key];
        return; 
      }
    }
  }

  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (!p.locked && dist(mouseX, mouseY, p.pos.x, p.pos.y) < p.size) {
      draggedPoint = p;
      selectedId = p.id;
      updateSlidersFromPoint(p);
      updateList();
      return;
    }
  }
  
  draggedPoint = null;
  draggedAttractor = null;
}

function mouseReleased() {
  draggedPoint = null;
  draggedAttractor = null;
}

function setupDOMControls() {
  listContainer = document.getElementById('list');
  sliders.icono = document.getElementById('icono');
  sliders.indice = document.getElementById('indice');
  sliders.simbolo = document.getElementById('simbolo');
  sliderVals.icono = document.getElementById('iconoVal');
  sliderVals.indice = document.getElementById('indiceVal');
  sliderVals.simbolo = document.getElementById('simboloVal');

  for (const key in sliders) {
      sliders[key].addEventListener('input', () => {
        updateSliderLabels();
        if (selectedId) {
            const p = points.find(pt => pt.id === selectedId);
            if(p && !p.locked) {
                p.vals[key] = parseInt(sliders[key].value);
                p.pos = computeFromSliders(p.vals);
                updateListItem(p);
            }
        }
      });
  }

  document.getElementById('addBtn').addEventListener('click', addPoint);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('fileInput').addEventListener('change', handleFileInput);
  document.getElementById('exportBtn').addEventListener('click', () => saveCanvas('mapa-semiotico', 'png'));
  document.getElementById('toggleCalib').addEventListener('click', toggleCalibMode);
  document.getElementById('toggleLabels').addEventListener('click', () => { labelsVisible = !labelsVisible; });
  document.getElementById('resetCalib').addEventListener('click', () => { resetAttractors(); });
  document.getElementById('recalcAll').addEventListener('click', recalculateAllPoints);
  
  updateSliderLabels();
}

function addPoint(name, img = null, dropPos = null) {
    const pointName = typeof name === 'string' ? name : (prompt("Dale un nombre al nuevo elemento:", "Elemento sin título") || "Elemento sin título");
    if (!pointName) return;

    let finalPos = dropPos ? createVector(dropPos.x, dropPos.y) : null;
    if (finalPos) {
        if (dist(finalPos.x, finalPos.y, diagramCenter.x, diagramCenter.y) > diagramRadius) {
            finalPos = null;
        }
    }

    const vals = {
        icono: parseInt(sliders.icono.value),
        indice: parseInt(sliders.indice.value),
        simbolo: parseInt(sliders.simbolo.value)
    };
    
    const pos = finalPos || computeFromSliders(vals);
    const finalVals = slidersFromPosition(pos.x, pos.y);

    const newPoint = {
        id: crypto.randomUUID(),
        name: pointName,
        vals: finalVals,
        pos: pos,
        locked: false,
        size: 36,
        img: img
    };

    points.push(newPoint);
    selectedId = newPoint.id;
    updateSlidersFromPoint(newPoint);
    updateList();
}

function clearAll() {
    if (confirm("¿Seguro que quieres eliminar TODOS los elementos del mapa?")) {
        points = [];
        selectedId = null;
        updateList();
    }
}

function recalculateAllPoints() {
    points.forEach(p => {
        p.pos = computeFromSliders(p.vals);
    });
    if (selectedId) {
        const p = points.find(pt => pt.id === selectedId);
        if (p) updateSlidersFromPoint(p);
    }
}

function toggleCalibMode() {
    calibMode = !calibMode;
    document.getElementById('toggleCalib').textContent = 'Calibración: ' + (calibMode ? 'ACTIVADA' : 'DESACTIVADA');
}

function updateList() {
  listContainer.innerHTML = '';
  points.forEach(p => {
    const item = document.createElement('div');
    item.className = 'item';
    if (p.id === selectedId) item.classList.add('selected-item');

    item.innerHTML = `
      <div class="item-info">
        <b>${p.name}</b>
        <span class="small" id="values-${p.id}">ico(${p.vals.icono}) ind(${p.vals.indice}) sim(${p.vals.simbolo})</span>
      </div>
      <div class="item-actions">
        <button class="btn btn-rename">Renombrar</button>
        <button class="btn btn-lock">${p.locked ? 'Desbloquear' : 'Bloquear'}</button>
        <button class="btn delete">X</button>
      </div>
    `;

    item.querySelector('.btn-rename').onclick = (e) => { e.stopPropagation(); const n = prompt('Nuevo nombre:', p.name); if(n) p.name = n; updateList(); };
    item.querySelector('.btn-lock').onclick = (e) => { e.stopPropagation(); p.locked = !p.locked; updateList(); };
    item.querySelector('.delete').onclick = (e) => { e.stopPropagation(); points = points.filter(pt => pt.id !== p.id); if(selectedId === p.id) selectedId = null; updateList(); };
    item.onclick = () => { selectedId = p.id; updateSlidersFromPoint(p); updateList(); };

    listContainer.appendChild(item);
  });
}

function updateListItem(p) {
    const itemInfo = document.getElementById(`values-${p.id}`);
    if (itemInfo) {
        itemInfo.textContent = `ico(${p.vals.icono}) ind(${p.vals.indice}) sim(${p.vals.simbolo})`;
    }
}

function updateSlidersFromPoint(p) {
  sliders.icono.value = p.vals.icono;
  sliders.indice.value = p.vals.indice;
  sliders.simbolo.value = p.vals.simbolo;
  updateSliderLabels();
}

function updateSliderLabels() {
  for (const key in sliders) {
    sliderVals[key].textContent = `${sliders[key].value}/100`;
  }
}

function handleFile(file) {
  if (file.type === 'image') {
    if (dist(mouseX, mouseY, diagramCenter.x, diagramCenter.y) <= diagramRadius) {
        loadImage(file.data, img => {
          const name = file.name.replace(/\.[^/.]+$/, "");
          addPoint(name, img, {x: mouseX, y: mouseY});
        });
    }
  }
}

function handleFileInput(event) {
    const files = event.target.files;
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadImage(e.target.result, img => {
                const name = file.name.replace(/\.[^/.]+$/, "");
                addPoint(name, img);
            });
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}
