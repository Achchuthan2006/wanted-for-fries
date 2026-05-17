// Simple Web Audio API SFX. Lazy-init on first user gesture.
let ctx = null;
let unlocked = false;

function getCtx() {
    if (!ctx) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            ctx = new AC();
        } catch {
            return null;
        }
    }
    return ctx;
}

export function unlockAudio() {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
}

function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, slide = 0 }) {
    const c = getCtx();
    if (!c || !unlocked) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

export const sfx = {
    coin: () => {
        tone({ freq: 880, type: 'square', dur: 0.08, gain: 0.12 });
        setTimeout(() => tone({ freq: 1320, type: 'square', dur: 0.1, gain: 0.12 }), 60);
    },
    crash: () => {
        tone({ freq: 220, type: 'sawtooth', dur: 0.25, gain: 0.25, slide: -180 });
        setTimeout(() => tone({ freq: 90, type: 'square', dur: 0.2, gain: 0.2 }), 80);
    },
    swerve: () => tone({ freq: 520, type: 'triangle', dur: 0.07, gain: 0.1 }),
    siren: () => {
        tone({ freq: 800, type: 'sine', dur: 0.18, gain: 0.08, slide: -300 });
        setTimeout(() => tone({ freq: 500, type: 'sine', dur: 0.18, gain: 0.08, slide: 300 }), 180);
    },
    radioStatic: () => {
        const c = getCtx();
        if (!c || !unlocked) return;
        const t0 = c.currentTime;
        const dur = 0.18;
        const bufferSize = Math.floor(c.sampleRate * dur);
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.6;
        }
        const src = c.createBufferSource();
        src.buffer = buffer;
        // Bandpass to mimic radio crackle
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2200;
        bp.Q.value = 6;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(bp).connect(g).connect(c.destination);
        src.start(t0);
        // Tiny "key click" tone at the start
        const click = c.createOscillator();
        const cg = c.createGain();
        click.type = "sine";
        click.frequency.setValueAtTime(1400, t0);
        cg.gain.setValueAtTime(0.0001, t0);
        cg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.005);
        cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        click.connect(cg).connect(c.destination);
        click.start(t0);
        click.stop(t0 + 0.06);
    },
    gameover: () => {
        tone({ freq: 600, type: 'sawtooth', dur: 0.18, gain: 0.18, slide: -200 });
        setTimeout(() => tone({ freq: 400, type: 'sawtooth', dur: 0.22, gain: 0.18, slide: -200 }), 180);
        setTimeout(() => tone({ freq: 200, type: 'sawtooth', dur: 0.35, gain: 0.2, slide: -120 }), 380);
    },
};
