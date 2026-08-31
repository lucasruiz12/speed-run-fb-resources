import { formatTime } from './utils.js';

export function showCopyNotification() {
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

export function fallbackDownload(jsonString) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "run_updated.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function renderResources(Store, playLocalSound) {
    const container = document.getElementById('resources-bar');
    if (!container) return;
    container.innerHTML = '';
    const config = Store.config;

    if(!config || !config.resources) return;

    config.resources.forEach((res) => {
        const el = document.createElement('div');
        el.className = 'resource';
        el.innerHTML = `<img src="${res.image}"><span class="count">${res.count}</span>`;

        el.addEventListener('click', () => {
            // Incrementamos el contador de recurso
            res.count++;
            if (playLocalSound) playLocalSound('summon');

            // Actualizamos el contador visible en el DOM sin re-renderizar todo
            const countSpan = el.querySelector('.count');
            if (countSpan) countSpan.innerText = res.count;

            // Creamos una capa flotante para la animación y la posicionamos sobre el elemento
            const floatLayer = document.createElement('div');
            floatLayer.className = 'floating-anim-layer';
            floatLayer.style.backgroundImage = `url('${res.image}')`;

            // Posicionar la capa de forma absoluta respecto a la ventana para evitar que el re-render
            // del contenedor la elimine antes de que termine la animación
            const rect = el.getBoundingClientRect();
            floatLayer.style.position = 'fixed';
            floatLayer.style.left = (rect.left - 10) + 'px';
            floatLayer.style.top = (rect.top - 10) + 'px';

            document.body.appendChild(floatLayer);

            // Cuando termine la animación, la removemos y re-renderizamos para mantener consistencia
            setTimeout(() => {
                floatLayer.remove();
                renderResources(Store, playLocalSound);
            }, 420);
        });

        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (res.count > 0) res.count--;
            renderResources(Store, playLocalSound);
        });

        container.appendChild(el);
    });
}

export function updateStaticUI(Store, playLocalSound) {
    const config = Store.config;
    const state = Store.state;
    if (!config) return;

    document.getElementById('game-title').innerText = config.gameName || 'Speedrun';
    renderResources(Store, playLocalSound);

    const activeIndex = Math.min(state.currentIndex, config.splits.length - 1);
    const currentSplit = config.splits[activeIndex];

    document.getElementById('current-img').src = currentSplit.image;
    document.getElementById('current-name').innerText = currentSplit.name;
    document.getElementById('current-pb').innerText = `PB: ${formatTime(currentSplit.pbSegmentMs, false)}`;

    const list = document.getElementById('splits-list');
    list.innerHTML = '';

    let accumulatedPB = 0;
    let accumulatedReal = 0;

    config.splits.forEach((split, index) => {
        accumulatedPB += split.pbSegmentMs;

        let rowClass = 'future';
        if (index < state.currentIndex) rowClass = 'past';
        if (index === activeIndex) rowClass = 'active';

        const row = document.createElement('div');
        row.className = `split-row ${rowClass}`;

        if (index === activeIndex) {
            row.id = 'active-split-row';
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

    // Scroll automático centrado
    setTimeout(() => {
        const listContainer = document.getElementById('splits-list');
        const activeRow = document.getElementById('active-split-row');

        if (listContainer && activeRow) {
            const containerHeight = listContainer.clientHeight;
            const rowTop = activeRow.offsetTop;
            const rowHeight = activeRow.clientHeight;
            const targetScrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);

            listContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }
    }, 50);
}

export function updateUI(Store, getCurrentTime) {
    const currentTime = getCurrentTime();

    const msPart = Math.floor((currentTime % 1000) / 10).toString().padStart(2, '0');
    const mainTimerEl = document.getElementById('main-timer');
    const mainTimerMsEl = document.getElementById('main-timer-ms');
    if (mainTimerEl) mainTimerEl.innerText = formatTime(currentTime);
    if (mainTimerMsEl) mainTimerMsEl.innerText = '.' + msPart;

    const state = Store.state;
    const config = Store.config;
    if (!config) return;

    let previousTotal = state.splits.reduce((a, b) => a + b, 0);
    let currentSegmentTime = currentTime - previousTotal;
    let projected = previousTotal + currentSegmentTime;

    for (let i = state.currentIndex; i < config.splits.length; i++) {
        projected += config.splits[i].pbSegmentMs;
    }

    const paceEl = document.getElementById('current-pace');
    if (paceEl) paceEl.innerText = formatTime(projected);
}
