import { Store } from './store.js';

export function attachControls({
    playLocalSound,
    updateStaticUI,
    updateUI,
    loopStart,
    loopStop,
    getCurrentTime,
    saveConfig
}) {
    function handleF1() {
        if (Store.state.isRunning) {
            // stop
            Store.state.isRunning = false;
            Store.state.elapsedTime += (Date.now() - Store.state.startTime);
            if (Store.state.animationFrame) cancelAnimationFrame(Store.state.animationFrame);
            updateUI(Store, getCurrentTime);
        } else if (Store.state.elapsedTime > 0 || Store.state.splits.length > 0) {
            // reset
            Store.state.elapsedTime = 0;
            Store.state.splits = [];
            Store.state.currentIndex = 0;
            if(Store.config && Store.config.resources) Store.config.resources.forEach(r => r.count = 0);
            if (playLocalSound) playLocalSound('reset');
            updateStaticUI(Store, playLocalSound);
            updateUI(Store, getCurrentTime);
        } else {
            // start
            Store.state.isRunning = true;
            Store.state.startTime = Date.now();
            if (playLocalSound) playLocalSound('start');
            loopStart();
        }
    }

    function doSplit() {
        if (!Store.state.isRunning || Store.state.currentIndex >= Store.config.splits.length) return;

        const currentTotalTime = getCurrentTime();
        const previousTotal = Store.state.splits.reduce((a, b) => a + b, 0);
        const thisSegmentTime = currentTotalTime - previousTotal;

        Store.state.splits.push(thisSegmentTime);
        Store.state.currentIndex++;

        if (playLocalSound) playLocalSound('split');

        if (Store.state.currentIndex >= Store.config.splits.length) {
            Store.state.isRunning = false;
            Store.state.elapsedTime = currentTotalTime;
            if (Store.state.animationFrame) cancelAnimationFrame(Store.state.animationFrame);
            Store.state.currentIndex = Store.config.splits.length;
        }

        updateStaticUI(Store, playLocalSound);
        updateUI(Store, getCurrentTime);

        setTimeout(() => {
            const rows = document.querySelectorAll('.split-row');
            const targetRow = rows[Store.state.currentIndex - 1];
            if (targetRow) {
                targetRow.classList.add('just-split');
                setTimeout(() => targetRow.classList.remove('just-split'), 500);
            }
        }, 10);
    }

    function undoSplit() {
        if (Store.state.splits.length === 0) return;

        if (!Store.state.isRunning) {
            Store.state.isRunning = true;
            Store.state.startTime = Date.now();
            loopStart();
        }

        Store.state.splits.pop();
        Store.state.currentIndex--;
        updateStaticUI(Store, playLocalSound);
    }

    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'F1': e.preventDefault(); handleF1(); break;
            case 'F2': e.preventDefault(); doSplit(); break;
            case 'F3': e.preventDefault(); undoSplit(); break;
            case 'F4': e.preventDefault(); if (saveConfig) saveConfig(); break;
            case 'F6':
                e.preventDefault();
                const fileInput = document.getElementById('json-file-input');
                if (fileInput) fileInput.click();
                break;
        }
    });

    // input file change handler
    const fileInput = document.getElementById('json-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    Store.config = JSON.parse(event.target.result);
                    // precalculate ms
                    Store.config.splits.forEach(split => {
                        const parts = split.pbSegment.split(':');
                        let ms = 0;
                        if (parts.length === 3) {
                            ms += parseInt(parts[0]) * 3600000;
                            ms += parseInt(parts[1]) * 60000;
                            ms += parseFloat(parts[2]) * 1000;
                        } else if (parts.length === 2) {
                            ms += parseInt(parts[0]) * 60000;
                            ms += parseFloat(parts[1]) * 1000;
                        }
                        split.pbSegmentMs = ms;
                    });

                    Store.state.isRunning = false;
                    Store.state.startTime = 0;
                    Store.state.elapsedTime = 0;
                    Store.state.splits = [];
                    Store.state.currentIndex = 0;
                    if (Store.state.animationFrame) cancelAnimationFrame(Store.state.animationFrame);

                    updateStaticUI(Store, playLocalSound);
                    updateUI(Store, getCurrentTime);
                } catch (err) {
                    console.error("El archivo JSON no es válido.", err);
                    alert("Error al parsear el archivo JSON.");
                }
            };
            reader.readAsText(file);
        });
    }
}
