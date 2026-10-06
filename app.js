// Основные данные
let nodes = [];
let links = [];
let shapes = [];
let nextId = 1;

let mode = 'edit'; // 'edit' or 'sim'
let currentTool = 'select';
let selectedElement = null; // { type: 'node'|'link'|'shape', id }

// Состояние интерфейса
let draggingNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let linkStartNode = null;

// Настройки отрисовки
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

// Цветовые схемы
const themes = {
    'theme-blueprint': { bg: '#1e3799', grid: '#2943a3', line: '#ffffff', nodeFree: '#f1c40f', nodeFixed: '#e74c3c', poly: 'rgba(255, 255, 255, 0.2)', highlight: '#e67e22', error: '#ff0000' },
    'theme-dark': { bg: '#2c3e50', grid: '#34495e', line: '#ecf0f1', nodeFree: '#3498db', nodeFixed: '#e74c3c', poly: 'rgba(236, 240, 241, 0.1)', highlight: '#f1c40f', error: '#e74c3c' },
    'theme-light': { bg: '#ecf0f1', grid: '#bdc3c7', line: '#2c3e50', nodeFree: '#2980b9', nodeFixed: '#c0392b', poly: 'rgba(44, 62, 80, 0.1)', highlight: '#f39c12', error: '#c0392b' }
};
let currentThemeName = 'theme-blueprint';

function resizeCanvas() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    draw();
}

window.addEventListener('resize', resizeCanvas);

// Вспомогательные функции
function getId() { return nextId++; }

function dist(n1, n2) {
    return Math.hypot(n1.x - n2.x, n1.y - n2.y);
}

function getNodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        let n = nodes[i];
        if (Math.hypot(n.x - x, n.y - y) < 10) return n;
    }
    return null;
}

function getLinkAt(x, y) {
    for (let l of links) {
        let n1 = nodes.find(n => n.id === l.n1);
        let n2 = nodes.find(n => n.id === l.n2);
        if(!n1 || !n2) continue;

        let l2 = Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2);
        if (l2 === 0) continue;
        let t = ((x - n1.x) * (n2.x - n1.x) + (y - n1.y) * (n2.y - n1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        let projX = n1.x + t * (n2.x - n1.x);
        let projY = n1.y + t * (n2.y - n1.y);
        if (Math.hypot(x - projX, y - projY) < 5) return l;
    }
    return null;
}

// Функции добавления элементов
function addNode(x, y, fixed) {
    let n = { id: getId(), x, y, fixed };
    nodes.push(n);
    return n;
}

function addLink(n1, n2) {
    if (n1.id === n2.id) return null;
    // Проверка на существующий линк
    if (links.find(l => (l.n1 === n1.id && l.n2 === n2.id) || (l.n1 === n2.id && l.n2 === n1.id))) return null;
    let l = { id: getId(), n1: n1.id, n2: n2.id, len: dist(n1, n2), min: 0, max: 10000 };
    links.push(l);
    return l;
}

function addBellcrank(x, y) {
    let p = addNode(x, y, true);
    let n1 = addNode(x - 30, y + 30, false);
    let n2 = addNode(x + 30, y + 30, false);
    addLink(p, n1); addLink(p, n2); addLink(n1, n2);
    shapes.push({ id: getId(), type: 'bellcrank', nodes: [p.id, n1.id, n2.id] });
}

function addStick(x, y) {
    let p = addNode(x, y, true); // pivot
    let attach = addNode(x, y - 40, false); // тяга
    let handle = addNode(x, y - 100, false); // ручка
    addLink(p, attach); addLink(attach, handle); addLink(p, handle);
    shapes.push({ id: getId(), type: 'stick', nodes: [p.id, attach.id, handle.id], baseAngle: Math.atan2(handle.y - p.y, handle.x - p.x) });
}

function addElevator(x, y) {
    let p = addNode(x, y, true); // pivot
    let horn = addNode(x, y + 30, false); // кабанчик
    let te = addNode(x + 80, y, false); // задняя кромка
    addLink(p, horn); addLink(horn, te); addLink(p, te);
    shapes.push({ id: getId(), type: 'elevator', nodes: [p.id, horn.id, te.id] });
}

// Отрисовка
function draw() {
    let theme = themes[currentThemeName];

    // Фон
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Сетка
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    // Шейпы (заливка)
    shapes.forEach(s => {
        let ns = s.nodes.map(nid => nodes.find(n => n.id === nid)).filter(n => n);
        if (ns.length >= 3) {
            ctx.fillStyle = theme.poly;
            ctx.beginPath();
            ctx.moveTo(ns[0].x, ns[0].y);
            for(let i=1; i<ns.length; i++) ctx.lineTo(ns[i].x, ns[i].y);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Связи
    ctx.lineWidth = 3;
    links.forEach(l => {
        let n1 = nodes.find(n => n.id === l.n1);
        let n2 = nodes.find(n => n.id === l.n2);
        if(n1 && n2) {
            ctx.strokeStyle = l.hasError ? theme.error : ((selectedElement && selectedElement.type === 'link' && selectedElement.id === l.id) ? theme.highlight : theme.line);
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
        }
    });

    // Рисуем процесс создания связи
    if (linkStartNode && currentTool === 'add-link') {
        ctx.strokeStyle = theme.highlight;
        ctx.beginPath();
        ctx.moveTo(linkStartNode.x, linkStartNode.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.stroke();
    }

    // Узлы
    nodes.forEach(n => {
        ctx.fillStyle = n.fixed ? theme.nodeFixed : theme.nodeFree;
        if (selectedElement && selectedElement.type === 'node' && selectedElement.id === n.id) {
            ctx.fillStyle = theme.highlight;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.line;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// Взаимодействие
let mouseX = 0, mouseY = 0;

canvas.addEventListener('mousedown', e => {
    let rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (currentTool === 'select') {
        let n = getNodeAt(mouseX, mouseY);
        if (n) {
            selectedElement = { type: 'node', id: n.id };
            draggingNode = n;
            updatePropertiesPanel();
        } else {
            let l = getLinkAt(mouseX, mouseY);
            if (l) {
                selectedElement = { type: 'link', id: l.id };
                updatePropertiesPanel();
            } else {
                selectedElement = null;
                updatePropertiesPanel();
            }
        }
    } else if (currentTool === 'add-pivot') {
        addNode(mouseX, mouseY, true);
    } else if (currentTool === 'add-node') {
        addNode(mouseX, mouseY, false);
    } else if (currentTool === 'add-bellcrank') {
        addBellcrank(mouseX, mouseY);
    } else if (currentTool === 'add-stick') {
        addStick(mouseX, mouseY);
    } else if (currentTool === 'add-elevator') {
        addElevator(mouseX, mouseY);
    } else if (currentTool === 'add-link') {
        let n = getNodeAt(mouseX, mouseY);
        if (n) linkStartNode = n;
    }

    draw();
});

canvas.addEventListener('mousemove', e => {
    let rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (draggingNode && mode === 'edit') {
        // Перемещение узла или всего шейпа
        let dx = mouseX - draggingNode.x;
        let dy = mouseY - draggingNode.y;
        draggingNode.x = mouseX;
        draggingNode.y = mouseY;

        // Обновляем длины связей в режиме редактирования
        links.forEach(l => {
            if (l.n1 === draggingNode.id || l.n2 === draggingNode.id) {
                let n1 = nodes.find(n => n.id === l.n1);
                let n2 = nodes.find(n => n.id === l.n2);
                l.len = dist(n1, n2);
            }
        });

        if (selectedElement && selectedElement.type === 'node') updatePropertiesPanel();
    }

    draw();
});

canvas.addEventListener('mouseup', e => {
    if (currentTool === 'add-link' && linkStartNode) {
        let n = getNodeAt(mouseX, mouseY);
        if (n && n !== linkStartNode) {
            let l = addLink(linkStartNode, n);
            if (l) {
                selectedElement = { type: 'link', id: l.id };
                updatePropertiesPanel();
            }
        }
        linkStartNode = null;
    }
    draggingNode = null;
    draw();
});

// UI
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTool = e.target.dataset.tool;
        linkStartNode = null;
    });
});

document.getElementById('theme-select').addEventListener('change', e => {
    document.body.className = e.target.value;
    currentThemeName = e.target.value;
    draw();
});

function updatePropertiesPanel() {
    const panel = document.getElementById('properties-content');
    if (!selectedElement) {
        panel.innerHTML = '<p style="font-size: 0.9em; color: #555;">Выберите элемент на схеме.</p>';
        return;
    }

    if (selectedElement.type === 'node') {
        let n = nodes.find(nd => nd.id === selectedElement.id);
        panel.innerHTML = `
            <div class="property-group">
                <label>Тип узла:</label>
                <select id="prop-node-fixed">
                    <option value="false" ${!n.fixed ? 'selected' : ''}>Свободный</option>
                    <option value="true" ${n.fixed ? 'selected' : ''}>Опора (Земля)</option>
                </select>
            </div>
            <div class="property-group">
                <label>X: ${n.x.toFixed(1)}</label>
                <label>Y: ${n.y.toFixed(1)}</label>
            </div>
            <button id="prop-delete" style="width:100%; padding:5px; background:#e74c3c; color:white; border:none; cursor:pointer;">Удалить узел</button>
        `;
        document.getElementById('prop-node-fixed').addEventListener('change', e => {
            n.fixed = e.target.value === 'true';
            draw();
        });
        document.getElementById('prop-delete').addEventListener('click', () => {
            nodes = nodes.filter(nd => nd.id !== n.id);
            links = links.filter(l => l.n1 !== n.id && l.n2 !== n.id);
            // Удалить шейпы, если узел был в них
            shapes = shapes.filter(s => !s.nodes.includes(n.id));
            selectedElement = null;
            updatePropertiesPanel();
            draw();
        });
    } else if (selectedElement.type === 'link') {
        let l = links.find(lk => lk.id === selectedElement.id);
        panel.innerHTML = `
            <div class="property-group">
                <label>Длина тяги:</label>
                <input type="number" id="prop-link-len" value="${l.len.toFixed(1)}" step="1">
            </div>
            <div class="property-group">
                <label>Мин. длина (ограничение):</label>
                <input type="number" id="prop-link-min" value="${l.min}" step="1">
            </div>
            <div class="property-group">
                <label>Макс. длина (ограничение):</label>
                <input type="number" id="prop-link-max" value="${l.max}" step="1">
            </div>
            <button id="prop-delete" style="width:100%; padding:5px; background:#e74c3c; color:white; border:none; cursor:pointer;">Удалить тягу</button>
        `;
        document.getElementById('prop-link-len').addEventListener('change', e => {
            l.len = parseFloat(e.target.value);
            // При изменении длины в режиме редактирования можно попытаться сдвинуть свободный узел,
            // но пока оставим это для симуляции
            draw();
        });
        document.getElementById('prop-link-min').addEventListener('change', e => l.min = parseFloat(e.target.value));
        document.getElementById('prop-link-max').addEventListener('change', e => l.max = parseFloat(e.target.value));

        document.getElementById('prop-delete').addEventListener('click', () => {
            links = links.filter(lk => lk.id !== l.id);
            selectedElement = null;
            updatePropertiesPanel();
            draw();
        });
    }
}

// Запуск
resizeCanvas();


// === Кинематический решатель (Position Based Dynamics - PBD) ===
const SIM_ITERATIONS = 50;

function solveKinematics() {
    let isValid = true;

    for (let iter = 0; iter < SIM_ITERATIONS; iter++) {
        // Сохраняем длины жестких тел (шейпов)
        shapes.forEach(s => {
            if (savedState) {
                let n0 = nodes.find(n => n.id === s.nodes[0]);
                let n1 = nodes.find(n => n.id === s.nodes[1]);
                let n2 = nodes.find(n => n.id === s.nodes[2]);

                let orig0 = savedState.nodes.find(n => n.id === s.nodes[0]);
                let orig1 = savedState.nodes.find(n => n.id === s.nodes[1]);
                let orig2 = savedState.nodes.find(n => n.id === s.nodes[2]);

                if (n0 && n1 && n2 && orig0 && orig1 && orig2) {
                    enforceDistance(n0, n1, Math.hypot(orig0.x - orig1.x, orig0.y - orig1.y));
                    enforceDistance(n0, n2, Math.hypot(orig0.x - orig2.x, orig0.y - orig2.y));
                    enforceDistance(n1, n2, Math.hypot(orig1.x - orig2.x, orig1.y - orig2.y));
                }
            }
        });

        // Сохраняем длины тяг
        links.forEach(l => {
            let n1 = nodes.find(n => n.id === l.n1);
            let n2 = nodes.find(n => n.id === l.n2);
            if (n1 && n2) {
                enforceDistance(n1, n2, l.len, l.min, l.max);
            }
        });
    }

    // Проверка сходимости и выхода за пределы
    links.forEach(l => {
        let n1 = nodes.find(n => n.id === l.n1);
        let n2 = nodes.find(n => n.id === l.n2);
        if (n1 && n2) {
            let currentLen = Math.hypot(n1.x - n2.x, n1.y - n2.y);
            // Если разница больше 1 пикселя - значит заклинило (не удалось сохранить длину). Либо вышло за min/max.
            let isLenError = Math.abs(currentLen - l.len) > 1.0;
            let isMinMaxError = false;

            // Если мы пытались применить min/max, l.len - это целевая длина,
            // но min/max проверяются относительно l.len при симуляции?
            // Ограничения применяются к исходной l.len?
            // В режиме симуляции тяга не должна менять свою длину. Если l.len < l.min или l.len > l.max
            // это означает, что пользователь задал неверные ограничения.
            // Но в контексте задачи "выход за ограничения" значит, что мы хотим,
            // чтобы тяга могла свободно менять длину (например пружина или гидроцилиндр),
            // пока не упрется в упор. Но в обычных схемах тяги жесткие.
            // Если тяга жесткая, то её длина всегда l.len.

            if (l.len < l.min || l.len > l.max) {
                isMinMaxError = true;
            }

            if (isLenError || isMinMaxError) {
                l.hasError = true;
                isValid = false;
            } else {
                l.hasError = false;
            }
        }
    });

    return isValid;
}

function enforceDistance(n1, n2, targetLen, minLen = 0, maxLen = 10000) {
    if (!n1 || !n2) return true;

    let dx = n2.x - n1.x;
    let dy = n2.y - n1.y;
    let currentLen = Math.hypot(dx, dy);

    if (currentLen === 0) return true;

    // Проверка ограничений (для тяг)
    let isError = false;
    let enforcedLen = targetLen;
    if (targetLen < minLen) { enforcedLen = minLen; isError = true; }
    if (targetLen > maxLen) { enforcedLen = maxLen; isError = true; }

    let diff = (currentLen - enforcedLen) / currentLen;
    let offsetX = dx * diff * 0.5;
    let offsetY = dy * diff * 0.5;

    if (!n1.fixed && !n2.fixed) {
        n1.x += offsetX;
        n1.y += offsetY;
        n2.x -= offsetX;
        n2.y -= offsetY;
    } else if (!n1.fixed) {
        n1.x += offsetX * 2;
        n1.y += offsetY * 2;
    } else if (!n2.fixed) {
        n2.x -= offsetX * 2;
        n2.y -= offsetY * 2;
    }

    return !isError;
}


// === Логика переключения режимов ===
const modeRadios = document.querySelectorAll('input[name="mode"]');
const simControls = document.getElementById('sim-controls');
const toolBtns = document.querySelectorAll('.tool-btn');
const simSlider = document.getElementById('sim-slider');

// Сохранение состояния перед симуляцией
let savedState = null;

function saveState() {
    savedState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        links: JSON.parse(JSON.stringify(links))
    };
}

function restoreState() {
    if (savedState) {
        nodes = JSON.parse(JSON.stringify(savedState.nodes));
        links = JSON.parse(JSON.stringify(savedState.links));
        draw();
    }
}

modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        mode = e.target.value;
        if (mode === 'sim') {
            simControls.style.display = 'block';
            toolBtns.forEach(btn => {
                if(btn.dataset.tool !== 'select') btn.disabled = true;
            });
            saveState();
            simSlider.value = 0; // Сбрасываем слайдер
            updateSim(); // Применяем
        } else {
            simControls.style.display = 'none';
            toolBtns.forEach(btn => btn.disabled = false);
            restoreState();
        }
        selectedElement = null;
        updatePropertiesPanel();
        draw();
    });
});


// === Управление симуляцией ===
function updateSim() {
    if (mode !== 'sim') return;

    let angleDeg = parseFloat(simSlider.value);
    let angleRad = angleDeg * Math.PI / 180;

    // Находим РУС и поворачиваем его
    let stick = shapes.find(s => s.type === 'stick');
    if (stick && savedState) {
        let p = nodes.find(n => n.id === stick.nodes[0]);
        let attach = nodes.find(n => n.id === stick.nodes[1]);
        let handle = nodes.find(n => n.id === stick.nodes[2]);

        let pOrig = savedState.nodes.find(n => n.id === p.id);
        let attachOrig = savedState.nodes.find(n => n.id === attach.id);
        let handleOrig = savedState.nodes.find(n => n.id === handle.id);

        // Вращаем attach и handle вокруг pivot на angleRad
        let cosA = Math.cos(angleRad);
        let sinA = Math.sin(angleRad);

        attach.x = p.x + (attachOrig.x - pOrig.x) * cosA - (attachOrig.y - pOrig.y) * sinA;
        attach.y = p.y + (attachOrig.x - pOrig.x) * sinA + (attachOrig.y - pOrig.y) * cosA;

        handle.x = p.x + (handleOrig.x - pOrig.x) * cosA - (handleOrig.y - pOrig.y) * sinA;
        handle.y = p.y + (handleOrig.x - pOrig.x) * sinA + (handleOrig.y - pOrig.y) * cosA;

        // Фиксируем РУС на время шага решателя
        p.fixed = true;
        attach.fixed = true;
        handle.fixed = true;
    }

    let isValid = solveKinematics();

    if (!isValid && isPlaying) {
        // Остановка симуляции при заклинивании
        let btn = document.getElementById('play-sim');
        btn.textContent = 'Воспроизвести';
        clearInterval(playInterval);
        isPlaying = false;
    }

    // Возвращаем флаг fixed обратно
    if (stick) {
        let attach = nodes.find(n => n.id === stick.nodes[1]);
        let handle = nodes.find(n => n.id === stick.nodes[2]);
        attach.fixed = false;
        handle.fixed = false;
    }

    draw();
}

simSlider.addEventListener('input', updateSim);

let isPlaying = false;
let playInterval;
let playDirection = 1;

document.getElementById('play-sim').addEventListener('click', (e) => {
    if (isPlaying) {
        clearInterval(playInterval);
        e.target.textContent = 'Воспроизвести';
        isPlaying = false;
    } else {
        e.target.textContent = 'Остановить';
        isPlaying = true;
        playInterval = setInterval(() => {
            let val = parseFloat(simSlider.value);
            val += playDirection * 2;
            if (val >= 30) { val = 30; playDirection = -1; }
            if (val <= -30) { val = -30; playDirection = 1; }
            simSlider.value = val;
            updateSim();
        }, 50);
    }
});


// === Панель свойств и ограничений (Обновление) ===
// Функция updatePropertiesPanel уже была частично реализована.
// Убедимся, что она вызывается при клике и правильно обрабатывает изменения.
// (Она уже есть в коде, мы её писали ранее. Там есть prop-link-min и prop-link-max).
// Добавим в solveKinematics остановку симуляции, если есть ошибки.

// === Экспорт данных ===
document.getElementById('export-csv').addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,ID,Length,MinLength,MaxLength\n";

    links.forEach(l => {
        csvContent += `Link,${l.id},${l.len.toFixed(2)},${l.min},${l.max}\n`;
    });

    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kinematics_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('export-png').addEventListener('click', () => {
    let dataURL = canvas.toDataURL("image/png");
    let link = document.createElement("a");
    link.setAttribute("href", dataURL);
    link.setAttribute("download", "kinematics_scheme.png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
