let config = null;
let state = {
    isRunning: false,
    startTime: 0,
    elapsedTime: 0,
    splits: [],
    currentIndex: 0,
    animationFrame: null
};

function parseTime(str) {
    if (!str) return 0;
    const parts = str.split(':');
    let ms = 0;
    if (parts.length === 3) {
        ms += parseInt(parts[0]) * 3600000;
        ms += parseInt(parts[1]) * 60000;
        ms += parseFloat(parts[2]) * 1000;
    } else if (parts.length === 2) {
        ms += parseInt(parts[0]) * 60000;
        ms += parseFloat(parts[1]) * 1000;
    }
    return ms;
}

function formatTime(ms, isGap = false) {
    if (isNaN(ms)) return "0:00";
    let isNegative = ms < 0;
    ms = Math.abs(ms);

    let totalSeconds = Math.floor(ms / 1000);
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;

    let hStr = h > 0 ? h + ':' : '';
    let mStr = h > 0 ? m.toString().padStart(2, '0') + ':' : m + ':';
    let sStr = s.toString().padStart(2, '0');

    let sign = isGap ? (isNegative ? '-' : '+') : (isNegative ? '-' : '');
    return sign + hStr + mStr + sStr;
}

function getCurrentTime() {
    return state.isRunning ? state.elapsedTime + (Date.now() - state.startTime) : state.elapsedTime;
}

async function init() {
    try {
        // Añadimos un timestamp para forzar al navegador a leer el json fresco sin caché
        const response = await fetch('run.json?t=' + Date.now());
        config = await response.json();

        config.splits.forEach(split => {
            split.pbSegmentMs = parseTime(split.pbSegment);
        });

        updateStaticUI();
        updateUI();
    } catch (e) {
        console.error("Error cargando run.json", e);
    }
}

function handleF1() {
    if (state.isRunning) {
        state.isRunning = false;
        state.elapsedTime += (Date.now() - state.startTime);
        cancelAnimationFrame(state.animationFrame);
        updateUI();
    } else if (state.elapsedTime > 0 || state.splits.length > 0) {
        state.elapsedTime = 0;
        state.splits = [];
        state.currentIndex = 0;
        if (config.resources) config.resources.forEach(r => r.count = 0);

        updateStaticUI();
        updateUI();
    } else {
        state.isRunning = true;
        state.startTime = Date.now();
        loop();
    }
}

function doSplit() {
    if (!state.isRunning || state.currentIndex >= config.splits.length) return;

    const currentTotalTime = getCurrentTime();
    const previousTotal = state.splits.reduce((a, b) => a + b, 0);
    const thisSegmentTime = currentTotalTime - previousTotal;

    state.splits.push(thisSegmentTime);
    state.currentIndex++;

    // Si llegamos al último split o lo superamos, detenemos el timer automáticamente
    if (state.currentIndex >= config.splits.length) {
        state.isRunning = false;
        state.elapsedTime = currentTotalTime;
        cancelAnimationFrame(state.animationFrame);
        state.currentIndex = config.splits.length; // Mantiene el índice en el último
    }

    updateStaticUI();
    updateUI();
}

function undoSplit() {
    if (state.splits.length === 0) return;

    if (!state.isRunning) {
        state.isRunning = true;
        state.startTime = Date.now();
        loop();
    }

    state.splits.pop();
    state.currentIndex--;
    updateStaticUI();
}

function formatTimeForExport(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    let totalSeconds = Math.floor(ms / 1000);
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    
    // Si querés que conserve el formato con milisegundos o solo segundos:
    let hStr = h.toString().padStart(2, '0');
    let mStr = m.toString().padStart(2, '0');
    let sStr = s.toString().padStart(2, '0');
    
    return `${hStr}:${mStr}:${sStr}`;
}

function saveConfig() {
    if (!config) return;
    let exportConfig = JSON.parse(JSON.stringify(config));

    // Recorremos los splits para actualizar su pbSegment con los tiempos reales logrados
    exportConfig.splits.forEach((s, index) => {
        // Si el split se completó en esta run, usamos ese tiempo real
        if (index < state.splits.length) {
            s.pbSegment = formatTimeForExport(state.splits[index]);
        } else {
            // Si el split quedó sin hacer, podemos dejar su pbSegment original o en ceros
            // (acá mantiene el original que ya tenía)
        }
        delete s.pbSegmentMs;
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportConfig, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "run_updated.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function renderResources() {
    const container = document.getElementById('resources-bar');
    container.innerHTML = '';

    if (!config.resources) return;

    config.resources.forEach((res) => {
        const el = document.createElement('div');
        el.className = 'resource';
        el.innerHTML = `<img src="${res.image}"><span class="count">${res.count}</span>`;

        el.addEventListener('click', () => {
            res.count++;
            renderResources();
        });

        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (res.count > 0) res.count--;
            renderResources();
        });

        container.appendChild(el);
    });
}

function updateStaticUI() {
    document.getElementById('game-title').innerText = config.gameName || 'Speedrun';
    renderResources();

    const activeIndex = Math.min(state.currentIndex, config.splits.length - 1);
    const currentSplit = config.splits[activeIndex];

    document.getElementById('current-img').src = currentSplit.image;
    document.getElementById('current-name').innerText = currentSplit.name;
    document.getElementById('current-pb').innerText = `PB: ${formatTime(currentSplit.pbSegmentMs, false)}`;

    const list = document.getElementById('splits-list');
    list.innerHTML = '';

    let accumulatedPB = 0;
    let accumulatedReal = 0;

    // Nos aseguramos de que activeIndex se mantenga dentro de los límites del array

    config.splits.forEach((split, index) => {
        accumulatedPB += split.pbSegmentMs;

        let rowClass = 'future';
        if (index < state.currentIndex) rowClass = 'past';
        if (index === activeIndex) rowClass = 'active'; // <--- Acá aseguramos que el activo sea el correcto, incluso el último

        const row = document.createElement('div');
        row.className = `split-row ${rowClass}`;

        if (index === activeIndex) {
            row.id = 'active-split-row'; // Identificador para el scroll centrado
        }

        let gapHtml = `<span class="split-gap gap-neutral">-</span>`;
        let timeHtml = `<span class="split-time">${formatTime(accumulatedPB, false)}</span>`;

        if (index < state.currentIndex) {
            accumulatedReal += state.splits[index];
            const gap = accumulatedReal - accumulatedPB;
            const gapClass = gap <= 0 ? 'gap-green' : 'gap-red';
            gapHtml = `<span class="split-gap ${gapClass}">${formatTime(gap, true)}</span>`;
            timeHtml = `<span class="split-time">${formatTime(accumulatedReal, false)}</span>`;
        } else if (index === activeIndex) {
            timeHtml = `<span class="split-time">${formatTime(accumulatedPB, false)}</span>`;
        }

        row.innerHTML = `
            <img src="${split.image}">
            <span class="split-name">${split.name}</span>
            ${gapHtml}
            ${timeHtml}
        `;
        list.appendChild(row);
    });

    // SCROLL AUTOMÁTICO CENTRADO (Mantiene el split activo en el medio)
    setTimeout(() => {
        const listContainer = document.getElementById('splits-list');
        const activeRow = document.getElementById('active-split-row');

        if (listContainer && activeRow) {
            // Calculamos la posición para centrar el elemento activo dentro del contenedor
            const containerHeight = listContainer.clientHeight;
            const rowTop = activeRow.offsetTop;
            const rowHeight = activeRow.clientHeight;

            // Centramos restando la mitad de la altura del contenedor y sumando la mitad de la fila
            const targetScrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);

            listContainer.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            });
        }
    }, 50);
}

function updateUI() {
    const currentTime = getCurrentTime();

    const msPart = Math.floor((currentTime % 1000) / 10).toString().padStart(2, '0');
    document.getElementById('main-timer').innerText = formatTime(currentTime);
    document.getElementById('main-timer-ms').innerText = '.' + msPart;

    let previousTotal = state.splits.reduce((a, b) => a + b, 0);
    let currentSegmentTime = currentTime - previousTotal;
    let projected = previousTotal + currentSegmentTime;

    for (let i = state.currentIndex; i < config.splits.length; i++) {
        projected += config.splits[i].pbSegmentMs;
    }

    document.getElementById('current-pace').innerText = formatTime(projected);
}

function loop() {
    if (!state.isRunning) return;
    updateUI();
    state.animationFrame = requestAnimationFrame(loop);
}

// Función para cargar un JSON local mediante un input de archivos
function handleLoadCustomJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            config = JSON.parse(event.target.result);

            // Pre-calculamos los milisegundos de los splits del nuevo JSON
            config.splits.forEach(split => {
                split.pbSegmentMs = parseTime(split.pbSegment);
            });

            // Reiniciamos el estado de la run para adaptarlo al nuevo JSON
            state.isRunning = false;
            state.startTime = 0;
            state.elapsedTime = 0;
            state.splits = [];
            state.currentIndex = 0;
            if (state.animationFrame) cancelAnimationFrame(state.animationFrame);

            updateStaticUI();
            updateUI();
        } catch (err) {
            console.error("El archivo JSON no es válido.", err);
            alert("Error al parsear el archivo JSON.");
        }
    };
    reader.readAsText(file);
}

// Vinculamos el evento change del input oculto
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleLoadCustomJson);
    }
});

window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'F1': e.preventDefault(); handleF1(); break;
        case 'F2': e.preventDefault(); doSplit(); break;
        case 'F3': e.preventDefault(); undoSplit(); break;
        case 'F4': e.preventDefault(); saveConfig(); break;
        case 'F6':
            e.preventDefault();
            const fileInput = document.getElementById('json-file-input');
            if (fileInput) fileInput.click(); // Simula el click para abrir el explorador de Windows
            break;
    }
});

init();