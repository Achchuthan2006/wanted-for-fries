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
    horn: () => {
        // Honk-honk
        tone({ freq: 320, type: 'sawtooth', dur: 0.15, gain: 0.18 });
        setTimeout(() => tone({ freq: 290, type: 'sawtooth', dur: 0.18, gain: 0.18 }), 160);
    },
    skid: () => {
        // Longer screech: filtered noise with descending pitch
        const c = getCtx();
        if (!c || !unlocked) return;
        const t0 = c.currentTime;
        const dur = 0.42;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
        const src = c.createBufferSource();
        src.buffer = buf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3200, t0);
        bp.frequency.exponentialRampToValueAtTime(900, t0 + dur);
        bp.Q.value = 8;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(bp).connect(g).connect(c.destination);
        src.start(t0);
    },
    bassDrop: () => {
        // Dramatic descending bass + sub-thud
        const c = getCtx();
        if (!c || !unlocked) return;
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(30, t0 + 1.2);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.34, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
        osc.connect(g).connect(c.destination);
        osc.start(t0); osc.stop(t0 + 1.35);
        // Reverse-cymbal sweep (white noise high-pass rising)
        const dur = 0.7;
        const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (i / data.length);
        const src = c.createBufferSource();
        src.buffer = buf;
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(800, t0);
        hp.frequency.exponentialRampToValueAtTime(6000, t0 + dur);
        const ng = c.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(0.18, t0 + dur);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
        src.connect(hp).connect(ng).connect(c.destination);
        src.start(t0);
        // Hard kick at the drop
        setTimeout(() => {
            const k = c.createOscillator();
            const kg = c.createGain();
            k.type = 'sine';
            k.frequency.setValueAtTime(160, c.currentTime);
            k.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.25);
            kg.gain.setValueAtTime(0.0001, c.currentTime);
            kg.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 0.005);
            kg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
            k.connect(kg).connect(c.destination);
            k.start();
            k.stop(c.currentTime + 0.4);
        }, 750);
    },
};

// ============================================================
// ===========  Procedural Music Engine  ======================
// ============================================================
// Layered chase music driven by a beat clock. Intensity 0..3.

let music = null;

class MusicEngine {
    constructor(audioCtx) {
        this.c = audioCtx;
        this.intensity = 0;          // 0..3
        this.beat = 0;
        this.bpm = 120;
        this.timer = null;
        this.master = audioCtx.createGain();
        this.master.gain.value = 0.0001;
        this.master.connect(audioCtx.destination);
        this.heartbeatOn = false;
        this.sirenLoopOn = false;
        this._sirenIntervalId = null;
    }
    fadeMasterTo(target, sec = 0.6) {
        const t = this.c.currentTime;
        const cur = this.master.gain.value || 0.0001;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(cur, t);
        this.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), t + sec);
    }
    start() {
        if (this.timer) return;
        this.beat = 0;
        this.fadeMasterTo(0.55, 0.5);
        const beatMs = (60 / this.bpm) * 1000 / 2; // 8th-note pulse
        this.timer = setInterval(() => this._tick(), beatMs);
    }
    stop() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.fadeMasterTo(0.0001, 0.4);
        this.stopHeartbeat();
        this.stopSiren();
    }
    setIntensity(n) {
        this.intensity = Math.max(0, Math.min(3, n));
    }
    // -------- single voice helpers --------
    _kick(time, gain = 0.45) {
        const o = this.c.createOscillator();
        const g = this.c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, time);
        o.frequency.exponentialRampToValueAtTime(40, time + 0.18);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
        o.connect(g).connect(this.master);
        o.start(time); o.stop(time + 0.3);
    }
    _hat(time, gain = 0.08) {
        const dur = 0.06;
        const buf = this.c.createBuffer(1, Math.floor(this.c.sampleRate * dur), this.c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
        const src = this.c.createBufferSource();
        src.buffer = buf;
        const hp = this.c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const g = this.c.createGain();
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        src.connect(hp).connect(g).connect(this.master);
        src.start(time);
    }
    _bass(time, freq, gain = 0.22) {
        const o = this.c.createOscillator();
        const g = this.c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
        o.connect(g).connect(this.master);
        o.start(time); o.stop(time + 0.28);
    }
    _lead(time, freq, gain = 0.12) {
        const o = this.c.createOscillator();
        const g = this.c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, time);
        const f = this.c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2400;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
        o.connect(f).connect(g).connect(this.master);
        o.start(time); o.stop(time + 0.35);
    }
    _chaos(time) {
        // Random high-freq stab for chaos layer (Frenzy)
        const o = this.c.createOscillator();
        const g = this.c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(900 + Math.random() * 1100, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.12, time + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
        o.connect(g).connect(this.master);
        o.start(time); o.stop(time + 0.12);
    }
    _tick() {
        if (!this.c) return;
        const time = this.c.currentTime + 0.02;
        const b = this.beat;
        const I = this.intensity;
        // Bass riff (minor pentatonic-ish A C D E G)
        const bassNotes = [55, 73.42, 82.41, 87.31, 82.41, 73.42, 65.41, 55];
        const leadNotes = [
            440, 523.25, 587.33, 659.25,
            587.33, 523.25, 659.25, 783.99,
        ];
        // Always: soft kick on every 4th 8th (downbeat) when I>=1
        if (I >= 1 && b % 4 === 0) this._kick(time);
        // Hi-hat on every 8th note when I>=1
        if (I >= 1) this._hat(time, b % 2 === 0 ? 0.06 : 0.04);
        // Bass on every other 8th when I>=0 (always plays at base level too)
        if (I >= 0 && b % 2 === 0) {
            this._bass(time, bassNotes[(b / 2) % bassNotes.length], I >= 1 ? 0.22 : 0.14);
        }
        // Lead when I>=2 (every 8th, alt pattern)
        if (I >= 2 && b % 1 === 0) {
            this._lead(time, leadNotes[b % leadNotes.length]);
        }
        // Chaos when I>=3
        if (I >= 3 && Math.random() < 0.5) {
            this._chaos(time);
        }
        this.beat = (b + 1) % 64;
    }
    // -------- Heartbeat (low-health) --------
    startHeartbeat() {
        if (this.heartbeatOn) return;
        this.heartbeatOn = true;
        const thump = () => {
            if (!this.heartbeatOn) return;
            const t = this.c.currentTime;
            const o = this.c.createOscillator();
            const g = this.c.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(70, t);
            o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
            o.connect(g).connect(this.c.destination);
            o.start(t); o.stop(t + 0.2);
            // second thump (lub-DUB)
            setTimeout(() => {
                if (!this.heartbeatOn) return;
                const t2 = this.c.currentTime;
                const o2 = this.c.createOscillator();
                const g2 = this.c.createGain();
                o2.type = 'sine';
                o2.frequency.setValueAtTime(60, t2);
                o2.frequency.exponentialRampToValueAtTime(30, t2 + 0.12);
                g2.gain.setValueAtTime(0.0001, t2);
                g2.gain.exponentialRampToValueAtTime(0.24, t2 + 0.01);
                g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.16);
                o2.connect(g2).connect(this.c.destination);
                o2.start(t2); o2.stop(t2 + 0.2);
            }, 160);
            setTimeout(thump, 820);
        };
        thump();
    }
    stopHeartbeat() {
        this.heartbeatOn = false;
    }
    // -------- Looping police siren --------
    startSiren() {
        if (this._sirenIntervalId) return;
        // Use existing sfx.siren tone, loop it
        const playOne = () => {
            const c = this.c;
            const t = c.currentTime;
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(820, t);
            o.frequency.exponentialRampToValueAtTime(520, t + 0.25);
            o.frequency.exponentialRampToValueAtTime(820, t + 0.5);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
            o.connect(g).connect(c.destination);
            o.start(t); o.stop(t + 0.6);
        };
        this._sirenIntervalId = setInterval(playOne, 700);
        playOne();
        this.sirenLoopOn = true;
    }
    stopSiren() {
        if (this._sirenIntervalId) {
            clearInterval(this._sirenIntervalId);
            this._sirenIntervalId = null;
        }
        this.sirenLoopOn = false;
    }
}

export function getMusic() {
    const c = getCtx();
    if (!c) return null;
    if (!music) music = new MusicEngine(c);
    return music;
}

