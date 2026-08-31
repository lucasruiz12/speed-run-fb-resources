const sounds = {
    summon: new Audio('sounds/summon.mp3'),
    split: new Audio('sounds/split.mp3'),
    start: new Audio('sounds/start.mp3'),
    reset: new Audio('sounds/reset.mp3')
};

// Ajustar volúmenes opcionalmente (de 0.0 a 1.0)
Object.values(sounds).forEach(audio => audio.volume = 0.5);

export function playLocalSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(err => {
            console.log(`Audio local '${name}' no encontrado o bloqueado aún en OBS.`, err);
        });
    }
}

export { sounds };
