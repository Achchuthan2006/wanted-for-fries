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
    crunch: () => {
        // Crunchy: short tonal blip + filtered noise burst
        const c = getCtx();
        if (!c || !unlocked) return;
        const t0 = c.currentTime;
        // Tonal element
        const osc = c.createOscillator();
        const og = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(720, t0);
        osc.frequency.exponentialRampToValueAtTime(1240, t0 + 0.07);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        osc.connect(og).connect(c.destination);
        osc.start(t0); osc.stop(t0 + 0.14);
        // Noise burst (crunch)
        const dur = 0.08;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
        const src = c.createBufferSource();
        src.buffer = buf;
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const ng = c.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(0.16, t0 + 0.005);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(hp).connect(ng).connect(c.destination);
        src.start(t0);
    },
    heavenlyChoir: () => {
        // Stacked major chord (C E G C) sine "ahhhh"
        const c = getCtx();
        if (!c || !unlocked) return;
        const t0 = c.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        freqs.forEach((f, i) => {
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = 'sine';
            o.frequency.value = f;
            // slight detune for chorus
            const o2 = c.createOscillator();
            o2.type = 'sine';
            o2.frequency.value = f * 1.005;
            const g2 = c.createGain();
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.25 + i * 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
            g2.gain.setValueAtTime(0.0001, t0);
            g2.gain.exponentialRampToValueAtTime(0.04, t0 + 0.3 + i * 0.04);
            g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
            o.connect(g).connect(c.destination);
            o2.connect(g2).connect(c.destination);
            o.start(t0); o.stop(t0 + 1.9);
            o2.start(t0); o2.stop(t0 + 1.9);
        });
    },
    comboPing: (step = 1) => {
        // Ascending ping for combo milestones
        const base = 660;
        const f = base + step * 220;
        tone({ freq: f, type: 'square', dur: 0.09, gain: 0.14 });
        setTimeout(() => tone({ freq: f * 1.5, type: 'square', dur: 0.12, gain: 0.12 }), 70);
    },
    frenzyStart: () => {
        // Dramatic rising whoosh
        tone({ freq: 200, type: 'sawtooth', dur: 0.4, gain: 0.2, slide: 1200 });
        setTimeout(() => tone({ freq: 1500, type: 'square', dur: 0.12, gain: 0.18 }), 220);
        setTimeout(() => tone({ freq: 1100, type: 'square', dur: 0.16, gain: 0.18 }), 320);
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
