import { formatTimeForExport } from './utils.js';
import { showCopyNotification, fallbackDownload, updateStaticUI, updateUI } from './ui.js';
import { Store } from './store.js';

export async function init() {
    try {
        const response = await fetch('run.json?t=' + Date.now());
        Store.config = await response.json();

        Store.config.splits.forEach(split => {
            split.pbSegmentMs = parseTime(split.pbSegment);
        });

        // Inicializamos contadores de recursos si existen
        if (Store.config.resources) Store.config.resources.forEach(r => r.count = r.count || 0);

        // Llamadas a UI
        updateStaticUI(Store, null);
        updateUI(Store, () => Store.state.elapsedTime);
    } catch (e) {
        console.error("Error cargando run.json", e);
    }
}

// Notar: usamos parseTime local para evitar importar utils por nombre específico
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

export async function saveConfig() {
    if (!Store.config) return;
    let exportConfig = JSON.parse(JSON.stringify(Store.config));

    exportConfig.splits.forEach((s, index) => {
        if (index < Store.state.splits.length) {
            s.pbSegment = formatTimeForExport(Store.state.splits[index]);
        }
        delete s.pbSegmentMs;
    });

    const jsonString = JSON.stringify(exportConfig, null, 2);

    try {
        await navigator.clipboard.writeText(jsonString);
        console.log("¡JSON copiado al portapapeles con éxito!");
        showCopyNotification();
    } catch (err) {
        console.error("Error al copiar al portapapeles:", err);
        fallbackDownload(jsonString);
    }
}
