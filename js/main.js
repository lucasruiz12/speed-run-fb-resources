import { Store } from './store.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as IO from './io.js';
import { attachControls } from './controls.js';

function getCurrentTime() {
    return Store.state.isRunning ? Store.state.elapsedTime + (Date.now() - Store.state.startTime) : Store.state.elapsedTime;
}

function loop() {
    if (!Store.state.isRunning) return;
    UI.updateUI(Store, getCurrentTime);
    Store.state.animationFrame = requestAnimationFrame(loop);
}

function loopStart() {
    if (!Store.state.isRunning) return;
    loop();
}

function loopStop() {
    if (Store.state.animationFrame) {
        cancelAnimationFrame(Store.state.animationFrame);
        Store.state.animationFrame = null;
    }
}

// Attach controls, passing callbacks and helpers
attachControls({
    playLocalSound: Audio.playLocalSound,
    updateStaticUI: UI.updateStaticUI,
    updateUI: UI.updateUI,
    loopStart: () => { Store.state.isRunning = true; Store.state.startTime = Date.now(); loop(); },
    loopStop: () => { Store.state.isRunning = false; loopStop(); },
    getCurrentTime,
    saveConfig: IO.saveConfig
});

// Init after DOM ready
window.addEventListener('DOMContentLoaded', async () => {
    await IO.init();
    // ensure UI is in sync
    UI.updateStaticUI(Store, Audio.playLocalSound);
    UI.updateUI(Store, getCurrentTime);
});

// Start the module (keeps parity with previous behavior of auto-init)

export { getCurrentTime, loop };
