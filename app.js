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
        if(config.resources) config.resources.forEach(r => r.count = 0);
        playLocalSound('reset'); 
        updateStaticUI();
        updateUI();
    } else {
        state.isRunning = true;
        state.startTime = Date.now();
        playLocalSound('start'); // Suena el audio de inicio a full volumen
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

    playLocalSound('split'); 

    if (state.currentIndex >= config.splits.length) {
        state.isRunning = false;
        state.elapsedTime = currentTotalTime;
        cancelAnimationFrame(state.animationFrame);
        state.currentIndex = config.splits.length;
    }
    
    updateStaticUI();
    updateUI();

    // Agregar animación visual a la fila activa anterior que acaba de completarse
    setTimeout(() => {
        const rows = document.querySelectorAll('.split-row');
        const targetRow = rows[state.currentIndex - 1];
        if (targetRow) {
            targetRow.classList.add('just-split');
            setTimeout(() => targetRow.classList.remove('just-split'), 500);
        }
    }, 10);
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
    
    let hStr = h.toString().padStart(2, '0');
    let mStr = m.toString().padStart(2, '0');
    let sStr = s.toString().padStart(2, '0');
    
    return `${hStr}:${mStr}:${sStr}`;
}

async function saveConfig() {
    if (!config) return;
    let exportConfig = JSON.parse(JSON.stringify(config));

    // Actualizamos los splits con los tiempos reales logrados en la run
    exportConfig.splits.forEach((s, index) => {
        if (index < state.splits.length) {
            s.pbSegment = formatTimeForExport(state.splits[index]);
        }
        delete s.pbSegmentMs;
    });

    const jsonString = JSON.stringify(exportConfig, null, 2);

    try {
        // Intentamos copiar al portapapeles (funciona perfecto en OBS y navegadores modernos)
        await navigator.clipboard.writeText(jsonString);
        console.log("¡JSON copiado al portapapeles con éxito!");
        
        // Opcional: podés mostrar un aviso visual rápido en pantalla si querés
        showCopyNotification();
    } catch (err) {
        console.error("Error al copiar al portapapeles:", err);
        // Plan B por si falla el portapapeles: intentamos el método de descarga clásico
        fallbackDownload(jsonString);
    }
}

// Función auxiliar por si querés un pequeño aviso visual en el overlay de que se copió
function showCopyNotification() {
    let notif = document.getElementById('copy-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'copy-notification';
        notif.style.cssText = "position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: #2ecc71; color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 9999; pointer-events: none; transition: opacity 0.5s;";
        document.body.appendChild(notif);
    }
    notif.innerText = "¡JSON copiado al portapapeles!";
    notif.style.opacity = "1";
    setTimeout(() => {
        notif.style.opacity = "0";
    }, 2000);
}

// --- CONFIGURACIÓN DE AUDIOS LOCALES ---
const sounds = {
    summon: new Audio('sounds/summon.mp3'),
    split: new Audio('sounds/split.mp3'),
    start: new Audio('sounds/start.mp3'),
    reset: new Audio('sounds/reset.mp3')
};

// Ajustar volúmenes opcionalmente (de 0.0 a 1.0)
Object.values(sounds).forEach(audio => audio.volume = 0.5);

function playLocalSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(err => {
            console.log(`Audio local '${name}' no encontrado o bloqueado aún en OBS.`, err);
        });
    }
}

function fallbackDownload(jsonString) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
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
    
    if(!config.resources) return;

    config.resources.forEach((res) => {
        const el = document.createElement('div');
        el.className = 'resource';
        el.innerHTML = `<img src="${res.image}"><span class="count">${res.count}</span>`;
        
        el.addEventListener('click', () => {
            res.count++;
            playLocalSound('summon'); 

            // --- MAGIA CON DIV FLOTANTE TRANSPARENTE ---
            // Creamos un div flotante idéntico a la carta que salta por encima de todo
            const floatLayer = document.createElement('div');
            floatLayer.className = 'floating-anim-layer';
            floatLayer.style.backgroundImage = `url('${res.image}')`;
            
            // Lo metemos dentro de la celda de la carta para que nazca exactamente ahí
            el.appendChild(floatLayer);

            // Lo borramos automáticamente cuando termina la animación (0.4 segundos)
            setTimeout(() => {
                floatLayer.remove();
            }, 400);

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