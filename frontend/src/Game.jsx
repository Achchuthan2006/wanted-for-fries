import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { sfx, unlockAudio, getMusic } from "./sounds";
import {
    pickTip,
    unlockAchievement,
    ACHIEVEMENTS,
    getDailyChallenge,
    reportChallengeProgress,
    vibrate,
    recordRun,
    getBest,
} from "./meta";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IMG = {
    player: "/angel_car.png",
    police: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/b7b450b1d49dbc9392dd76336358347391483c010d4d999683a2f8565eff1693.png",
    civilian: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/7fc8664eaa0361c1bc2f53ce3caeab361c66ad7c7b9fb096b47a15d91edebf44.png",
    cone: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/4e96c5de105a73acbc056c9b5861d1096ccbe526bebe0dbc0d29a5aac60d4b6f.png",
    barrier: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/8850e2b423502dff2314355df22ef905d73a0dc30ded68a778901aeaa46d8dc6.png",
    fry: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/4168de88d6eb27cff5a441c70c774da5dc7cb72698bd7e193a33ff3dc2eab043.png",
    angel: "/angel_portrait.png",
    angelPanic: "/angel_panic.png",
    angelExcited: "/angel_excited.png",
};

const EARLY_INTRO_LINES = [
    "Suspect accelerating rapidly!",
    "Vehicle refusing to stop!",
    "This driver is either highly trained or highly confused!",
];

// Angel's personal lines — cheerful, innocent, dramatic
const ANGEL_LINES = {
    fry: [
        "No fry left behind!",
        "I can still save it!",
        "This is still edible!",
    ],
    hit: [
        "They don't understand!",
        "I paid for LARGE fries!",
    ],
    idle: [
        "No fry left behind!",
        "I can still save it!",
        "This is still edible!",
        "They don't understand!",
        "I paid for LARGE fries!",
    ],
};
const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];

const LANES = [0.22, 0.5, 0.78]; // left, center, right (% of width)
const MAX_HITS = 3;
const OBSTACLE_TYPES = ["cone", "barrier", "civilian", "civilian"];


// ---------- Radio Subtitle (typewriter + voice filter visual) ----------
function RadioBox({ radio }) {
    const { line, callsign, stage, interjection, nonce } = radio;
    const [typed, setTyped] = useState("");
    const [showInter, setShowInter] = useState(false);

    useEffect(() => {
        if (!line) return;
        setTyped("");
        setShowInter(false);
        let i = 0;
        const speed = 24; // ms per char
        const tick = () => {
            i += 1;
            setTyped(line.slice(0, i));
        };
        const interval = setInterval(tick, speed);
        const cap = setTimeout(() => clearInterval(interval), line.length * speed + 50);
        const interT = interjection
            ? setTimeout(() => setShowInter(true), Math.max(900, (line.length * speed) / 2))
            : null;
        const hideT = interjection
            ? setTimeout(() => setShowInter(false), Math.max(900, (line.length * speed) / 2) + 1900)
            : null;
        return () => {
            clearInterval(interval);
            clearTimeout(cap);
            if (interT) clearTimeout(interT);
            if (hideT) clearTimeout(hideT);
        };
    }, [line, interjection, nonce]);

    return (
        <div className={`radio-box stage-${stage}`} data-testid="radio-box">
            <div className="radio-box-header">
                <span className="radio-led" aria-hidden />
                <span className="radio-callsign">📻 {callsign}</span>
                <span className="radio-stage">{stage}</span>
            </div>
            <div className="radio-static-overlay" aria-hidden />
            <div className="radio-line">
                {typed}
                {typed.length < (line || "").length && <span className="radio-cursor">▮</span>}
            </div>
            {showInter && interjection && (
                <div className="radio-interjection" data-testid="radio-interjection">
                    <span className="radio-led-small" aria-hidden /> Air-1: <i>{interjection}</i>
                </div>
            )}
        </div>
    );
}


// ---------- Loading Screen with Tips ----------
function LoadingScreen({ onDone, duration = 1800 }) {
    const [tip] = useState(() => pickTip());
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const start = performance.now();
        let raf;
        const tick = () => {
            const p = Math.min(1, (performance.now() - start) / duration);
            setProgress(p);
            if (p < 1) raf = requestAnimationFrame(tick);
            else setTimeout(onDone, 120);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [onDone, duration]);
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black" data-testid="loading-screen">
            <div className="loading-logo">
                <div className="loading-fry" aria-hidden>🍟</div>
                <div className="loading-spinner" aria-hidden />
            </div>
            <div className="loading-tip-eyebrow">PROTIP</div>
            <p className="loading-tip" data-testid="loading-tip">{tip}</p>
            <div className="loading-bar">
                <div className="loading-bar-fill" style={{ width: `${progress * 100}%` }} />
            </div>
        </div>
    );
}

// ---------- Pause Menu ----------
function PauseMenu({ onResume, onRestart, onTitle }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm" data-testid="pause-menu">
            <div className="pause-card">
                <div className="pause-eyebrow">⏸ PAUSED</div>
                <h3 className="pause-title">Take a breath.</h3>
                <p className="pause-sub">The fries can wait. Maybe.</p>
                <div className="pause-actions">
                    <button data-testid="resume-button" className="btn-arcade text-base" onClick={onResume}>
                        ▶ Resume
                    </button>
                    <button data-testid="pause-restart" className="btn-arcade-secondary text-sm" onClick={onRestart}>
                        ↻ Restart
                    </button>
                    <button data-testid="pause-title" className="btn-arcade-secondary text-sm" onClick={onTitle}>
                        ⌂ Title
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------- Achievement Toast ----------
function AchievementToast({ ach }) {
    if (!ach) return null;
    return (
        <div className="ach-toast" data-testid="achievement-toast" key={ach._key}>
            <div className="ach-toast-icon">{ach.emoji}</div>
            <div className="ach-toast-text">
                <div className="ach-toast-eyebrow">ACHIEVEMENT UNLOCKED</div>
                <div className="ach-toast-title">{ach.title}</div>
                <div className="ach-toast-desc">{ach.desc}</div>
            </div>
        </div>
    );
}


// ---------- Animated Title Screen ----------
function TitleScreen({ onStart }) {
    const [daily] = useState(() => getDailyChallenge());
    const [best] = useState(() => getBest());
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/70 backdrop-blur-sm overflow-hidden">
            {/* Animated background: falling fries */}
            <div className="title-fries">
                {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="title-fry" style={{
                        left: `${(i * 11 + 5) % 95}%`,
                        animationDelay: `${(i * 0.4) % 4}s`,
                        animationDuration: `${4 + (i % 3)}s`,
                    }}>🍟</span>
                ))}
            </div>

            {/* Mini chase scene */}
            <div className="title-chase">
                <img src={IMG.player} alt="" className="title-player-car" />
                <img src={IMG.police} alt="" className="title-police-car" />
                <div className="title-skid-line" />
                <div className="title-skid-line title-skid-line--two" />
            </div>

            <div className="text-center relative z-10">
                <div className="title-mascot">
                    <img src={IMG.angel} alt="Angel" className="title-mascot-img" draggable={false} />
                </div>
                <div className="title-wobble">
                    <div className="font-heading title-stroke text-5xl sm:text-6xl font-black tracking-tight uppercase leading-none">
                        Wanted<br />for Fries
                    </div>
                </div>
                <div className="mt-5 font-heading text-2xl text-white font-bold tracking-wide title-shimmer">
                    Angel: The Stunt Driver
                </div>
                <div className="mt-3 font-body text-xs text-yellow-300/80 italic title-tagline">
                    Based on a true fry-related incident.
                </div>
            </div>

            <button
                data-testid="start-button"
                className="btn-arcade text-2xl mt-8 title-cta relative z-10"
                onClick={onStart}
            >
                Start Chase
            </button>

            {/* Daily challenge card */}
            <div className="title-daily" data-testid="daily-challenge">
                <div className="title-daily-eyebrow">
                    📅 Daily Challenge {daily.completed && <span className="title-daily-done">✓ Completed</span>}
                </div>
                <div className="title-daily-text">{daily.text}</div>
            </div>

            {/* Best score */}
            {(best.distance > 0 || best.fries > 0) && (
                <div className="title-best" data-testid="title-best">
                    <span>🏆 Best: {best.distance}m · {best.fries}🍟</span>
                </div>
            )}

            <div className="absolute bottom-4 text-[10px] text-white/40 font-mono tracking-widest uppercase z-10">
                Tap / Swipe / Arrow Keys
            </div>
        </div>
    );
}

// ---------- Cinematic Opening Cutscene ----------
// 8 panels that auto-advance. Total ~20s. Skippable.
const CUTSCENE_PANELS = [
    { id: "sunset",     duration: 3000 },
    { id: "car",        duration: 2500 },
    { id: "drive",      duration: 3300 },
    { id: "eat",        duration: 2600 },
    { id: "fall",       duration: 3600 }, // slow-motion fry drop
    { id: "reach",      duration: 2200 },
    { id: "screech",    duration: 1800 },
    { id: "siren",      duration: 2400 },
];

function IntroScreen({ onContinue }) {
    const [step, setStep] = useState(0);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (step >= CUTSCENE_PANELS.length) {
            setExiting(true);
            const t = setTimeout(onContinue, 600);
            return () => clearTimeout(t);
        }
        const t = setTimeout(() => setStep((s) => s + 1), CUTSCENE_PANELS[step].duration);
        return () => clearTimeout(t);
    }, [step, onContinue]);

    const skip = () => {
        setExiting(true);
        setTimeout(onContinue, 350);
    };

    const panel = CUTSCENE_PANELS[Math.min(step, CUTSCENE_PANELS.length - 1)];

    return (
        <div
            data-testid="cutscene"
            className={`absolute inset-0 z-50 overflow-hidden bg-black ${exiting ? "cine-exit" : ""}`}
        >
            {/* Letterbox bars */}
            <div className="cine-bar cine-bar--top" />
            <div className="cine-bar cine-bar--bot" />

            {/* Panels */}
            <CutscenePanel active={panel.id === "sunset"} id="sunset">
                <div className="cine-sunset-sky" />
                <div className="cine-sunset-sun" />
                <div className="cine-mcd">
                    <span className="cine-mcd-arch">M</span>
                    <span className="cine-mcd-label">McDriveThru</span>
                </div>
                <div className="cine-angel cine-angel--walk">
                    <img src={IMG.angel} alt="Angel" className="cine-angel-img" draggable={false} />
                    <span className="cine-bag" role="img" aria-label="Bag">🛍️</span>
                </div>
                <div className="cine-caption">A perfectly normal Tuesday evening...</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "car"} id="car">
                <div className="cine-city-bg" />
                <div className="cine-car-scene">
                    <img src={IMG.angel} alt="" className="cine-angel-img cine-bounce-in" draggable={false} />
                    <img src={IMG.player} alt="" className="cine-car-img cine-bounce-in" style={{ animationDelay: "0.3s" }} />
                </div>
                <div className="cine-notes">
                    <span style={{ animationDelay: "0s"   }}>♪</span>
                    <span style={{ animationDelay: "0.4s" }}>♫</span>
                    <span style={{ animationDelay: "0.8s" }}>♪</span>
                </div>
                <div className="cine-caption">She got in her car. Fries on the seat. Big mood.</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "drive"} id="drive">
                <div className="cine-dashboard">
                    {/* Windshield with scrolling city */}
                    <div className="cine-windshield">
                        <div className="cine-cityscape" />
                        <div className="cine-cityscape cine-cityscape--two" />
                    </div>
                    {/* Dashboard */}
                    <div className="cine-dash-panel">
                        <div className="cine-steering">
                            <div className="cine-steering-spoke" />
                            <div className="cine-steering-spoke cine-steering-spoke--v" />
                        </div>
                        <div className="cine-passenger-seat">
                            <img src={IMG.fry} alt="" className="cine-fries-pack" />
                            <span className="cine-fry-float" style={{ animationDelay: "0s" }}>🍟</span>
                            <span className="cine-fry-float" style={{ animationDelay: "0.6s" }}>🍟</span>
                        </div>
                    </div>
                </div>
                <div className="cine-notes cine-notes--right">
                    <span style={{ animationDelay: "0.1s" }}>♪</span>
                    <span style={{ animationDelay: "0.5s" }}>♬</span>
                </div>
                <div className="cine-caption">Cruising. Vibing. One hand on the wheel.</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "eat"} id="eat">
                <div className="cine-closeup-bg" />
                <div className="cine-angel-closeup">
                    <img src={IMG.angelExcited} alt="" className="cine-angel-closeup-img" draggable={false} />
                    <span className="cine-fry-eat">🍟</span>
                </div>
                <div className="cine-notes cine-notes--center">
                    <span style={{ animationDelay: "0s"   }}>♪</span>
                    <span style={{ animationDelay: "0.3s" }}>♫</span>
                    <span style={{ animationDelay: "0.6s" }}>♪</span>
                </div>
                <div className="cine-caption">"Mmmm. Heaven in stick form."</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "fall"} id="fall">
                <div className="cine-slowmo-bg" />
                <div className="cine-vignette" />
                <div className="cine-pedals">
                    <div className="cine-pedal cine-pedal--brake">B</div>
                    <div className="cine-pedal cine-pedal--gas">G</div>
                </div>
                <span className="cine-falling-fry" role="img" aria-label="Falling fry">🍟</span>
                <div className="cine-radial-flash" />
                <div className="cine-caption cine-caption--dramatic">Suddenly... one fry... falls.</div>
                <div className="cine-slowmo-label">— SLOW MOTION —</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "reach"} id="reach">
                <div className="cine-zoom-bg" />
                <div className="cine-angel-zoom">
                    <img src={IMG.angelPanic} alt="" className="cine-angel-zoom-img" draggable={false} />
                </div>
                <div className="cine-zoom-lines" />
                <div className="cine-caption cine-caption--dramatic">"I CAN SAVE IT!"</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "screech"} id="screech">
                <div className="cine-white-flash" />
                <div className="cine-shake-wrap">
                    <div className="cine-impact">SCREECH!</div>
                    <div className="cine-impact cine-impact--two">VRRROOM!</div>
                    <div className="cine-skid-mark cine-skid-mark--l" />
                    <div className="cine-skid-mark cine-skid-mark--r" />
                </div>
                <div className="cine-caption">Her foot found the wrong pedal.</div>
            </CutscenePanel>

            <CutscenePanel active={panel.id === "siren"} id="siren">
                <div className="cine-night-bg" />
                <div className="cine-blur-streaks" />
                <div className="cine-siren-strobe" />
                <img src={IMG.player} alt="" className="cine-end-player" />
                <img src={IMG.police} alt="" className="cine-end-police" />
                <div className="cine-end-title">WANTED FOR FRIES</div>
                <div className="cine-caption cine-caption--dramatic">The chase has begun.</div>
            </CutscenePanel>

            {/* Progress dots */}
            <div className="cine-progress">
                {CUTSCENE_PANELS.map((p, i) => (
                    <span key={p.id} className={`cine-dot ${i <= step ? "is-on" : ""}`} />
                ))}
            </div>

            <button
                data-testid="intro-continue-button"
                className="cine-skip"
                onClick={skip}
                aria-label="Skip cutscene"
            >
                Skip ▸
            </button>
        </div>
    );
}

function CutscenePanel({ active, id, children }) {
    return (
        <div
            className={`cine-panel cine-panel--${id} ${active ? "is-active" : ""}`}
            aria-hidden={!active}
        >
            {children}
        </div>
    );
}

// ---------- World prop renderer (scrolling ambient sprites) ----------
function WorldPropView({ p, shellW }) {
    if (p.kind === "bus") {
        // bus crosses horizontally
        return (
            <div className="prop-bus" style={{ top: p.y }} data-testid="prop-bus">
                <span className="prop-bus-emoji">🚌</span>
                <span className="prop-bus-trail" aria-hidden />
            </div>
        );
    }
    // Side props (left or right edges)
    const sideStyle = p.side === "left"
        ? { left: 4, top: p.y }
        : { right: 4, top: p.y };
    if (p.kind === "billboard") {
        return (
            <div className={`prop-billboard prop-side-${p.side}`} style={sideStyle}>
                <div className="prop-billboard-pole" />
                <div className="prop-billboard-board">
                    <div className="prop-billboard-frame">
                        <span>{p.content}</span>
                    </div>
                </div>
            </div>
        );
    }
    if (p.kind === "neon") {
        return (
            <div className={`prop-neon prop-side-${p.side}`} style={sideStyle}>
                <span>{p.content}</span>
            </div>
        );
    }
    if (p.kind === "pedestrian") {
        return (
            <div className={`prop-pedestrian prop-side-${p.side}`} style={sideStyle}>
                <span className="prop-ped-emoji">{p.content}</span>
                <span className="prop-ped-reaction" aria-hidden>❗</span>
            </div>
        );
    }
    if (p.kind === "streetlight") {
        return (
            <div className={`prop-streetlight prop-side-${p.side}`} style={sideStyle}>
                <div className="prop-streetlight-pole" />
                <div className="prop-streetlight-glow" />
            </div>
        );
    }
    return null;
}

// ---------- Caught Cinematic Sequence ----------
const CAUGHT_STEPS = [
    { id: "slowdown",  duration: 2200 },
    { id: "surround",  duration: 2400 },
    { id: "spotlight", duration: 1900 },
    { id: "approach",  duration: 2800 },
    { id: "defensive", duration: 1800 },
    { id: "silence",   duration: 2600 },
    { id: "speech",    duration: 3600 },
    { id: "printer",   duration: 2800 },
];

function CaughtCutscene({ onDone }) {
    const [step, setStep] = useState(0);
    const [skipping, setSkipping] = useState(false);

    useEffect(() => {
        if (step >= CAUGHT_STEPS.length) {
            const f = setTimeout(onDone, 500);
            return () => clearTimeout(f);
        }
        const id = CAUGHT_STEPS[step].id;
        if (id === "surround") sfx.siren();
        if (id === "spotlight") sfx.bassDrop();
        if (id === "approach") {
            const m = getMusic();
            if (m) m.startHeartbeat();
        }
        if (id === "silence") {
            const m = getMusic();
            if (m) m.stopHeartbeat();
        }
        if (id === "printer") sfx.radioStatic();
        const t = setTimeout(() => setStep((s) => s + 1), CAUGHT_STEPS[step].duration);
        return () => clearTimeout(t);
    }, [step, onDone]);

    const skip = () => {
        setSkipping(true);
        const m = getMusic();
        if (m) m.stopHeartbeat();
        setTimeout(onDone, 350);
    };

    const active  = (id) => CAUGHT_STEPS[Math.min(step, CAUGHT_STEPS.length - 1)].id === id;
    const reached = (id) => step >= CAUGHT_STEPS.findIndex((s) => s.id === id);

    return (
        <div
            data-testid="caught-cutscene"
            className={`absolute inset-0 z-50 overflow-hidden bg-black ${skipping ? "cine-exit" : ""}`}
        >
            <div className="cine-bar cine-bar--top" />
            <div className="cine-bar cine-bar--bot" />

            <div className="caught-night" />
            <div className={`caught-strobe ${reached("surround") ? "is-on" : ""}`} />
            <div className={`caught-spotlight ${reached("spotlight") ? "is-on" : ""}`} />
            <div className={`caught-spotlight-cone ${reached("spotlight") ? "is-on" : ""}`} />

            {reached("spotlight") && (
                <div className="caught-chopper" data-testid="caught-chopper">🚁</div>
            )}

            {reached("surround") && (
                <>
                    <img src={IMG.police} alt="" className="caught-perim caught-perim--lt" />
                    <img src={IMG.police} alt="" className="caught-perim caught-perim--rt" />
                    <img src={IMG.police} alt="" className="caught-perim caught-perim--bk" />
                </>
            )}

            <div className={`caught-car ${active("slowdown") ? "is-slowing" : ""}`}>
                <img src={IMG.player} alt="Angel's car" className="caught-car-img" draggable={false} />
                <div className="caught-car-skid caught-car-skid--l" />
                <div className="caught-car-skid caught-car-skid--r" />
                {reached("defensive") && (
                    <div className="caught-defensive">
                        <span className="caught-defensive-fry">🍟</span>
                        <span className="caught-defensive-shield">🛡️</span>
                    </div>
                )}
            </div>

            {reached("spotlight") && (
                <div
                    className={`caught-officer ${reached("approach") ? "is-approaching" : ""} ${reached("defensive") ? "is-paused" : ""}`}
                    data-testid="cutscene-officer"
                >
                    <span className="caught-officer-emoji">👮‍♀️</span>
                </div>
            )}

            {active("silence") && (
                <div className="caught-silence" data-testid="caught-silence">
                    <span className="caught-silence-dot" />
                    <span className="caught-silence-dot" />
                    <span className="caught-silence-dot" />
                    <div className="caught-silence-label">— awkward silence —</div>
                </div>
            )}

            {reached("speech") && !reached("printer") && (
                <div className="caught-speech" data-testid="cutscene-speech">
                    <div className="caught-speech-eyebrow">Officer Mendez</div>
                    <p>"Ma'am… you caused a <b>14 car pileup</b> for potatoes."</p>
                    <div className="caught-speech-tail" />
                </div>
            )}

            {reached("printer") && (
                <div className="caught-printer" data-testid="caught-printer">
                    <div className="caught-printer-machine">
                        <div className="caught-printer-slot" />
                        <div className="caught-printer-light" />
                        <span className="caught-printer-label">CITY POLICE</span>
                    </div>
                    <div className="caught-printer-paper">
                        <div className="caught-printer-line">⚖️ CITATION ISSUED</div>
                        <div className="caught-printer-line">Charge 1: Stunt Driving</div>
                        <div className="caught-printer-line">Charge 2: Potato Endangerment</div>
                        <div className="caught-printer-line">Charge 3: Fry Recovery</div>
                        <div className="caught-printer-line">Charge 4: Emotional Attachment</div>
                        <div className="caught-printer-line">— continued —</div>
                    </div>
                </div>
            )}

            <div className="caught-caption">
                {active("slowdown") && "Engine cuts. The car coasts to a halt..."}
                {active("surround") && "Three units close in. No way out."}
                {active("spotlight") && "Air-1 overhead. Spotlight engaged."}
                {active("approach") && "An officer approaches. Slowly."}
                {active("defensive") && "Angel clutches the last fry."}
                {active("silence") && " "}
                {active("speech") && "Officer Mendez breaks the silence."}
                {active("printer") && "Issuing citation..."}
            </div>

            <div className="cine-progress">
                {CAUGHT_STEPS.map((p, i) => (
                    <span key={p.id} className={`cine-dot ${i <= step ? "is-on" : ""}`} />
                ))}
            </div>
            <button className="cine-skip" onClick={skip} aria-label="Skip">Skip ▸</button>
        </div>
    );
}

// ---------- Ticket Game Over ----------
function GameOverTicket({ distance, fries, dodged, onRestart, onTitle, onReplay }) {
    const [showSecret, setShowSecret] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShowSecret(true), 1300);
        return () => clearTimeout(t);
    }, []);

    const trafficLawsViolated = 3 + Math.floor(distance / 70);
    const propertyDamage = (distance * 47 + fries * 200 + 1437).toLocaleString();

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto py-6">
            <div className="ticket ticket-printed" data-testid="ticket-modal">
                <div className="flex justify-center mb-2">
                    <span className="badge">CITY POLICE • CITATION</span>
                </div>
                <h2>You're Busted</h2>
                <div className="text-center text-[11px] text-gray-700 uppercase tracking-widest mb-3">
                    Issued to: Angel, Stunt Driver
                </div>

                <div className="ticket-section-label">CHARGES</div>
                <ul className="ticket-charges" data-testid="ticket-charges">
                    <li>Stunt Driving</li>
                    <li>Vehicular Potato Endangerment</li>
                    <li>Dangerous Fry Recovery</li>
                    <li>Excessive Emotional Attachment to Fries</li>
                </ul>

                <div className="ticket-section-label">FINAL STATS</div>
                <div className="row"><span>Fries Saved</span><b data-testid="ticket-fries">{fries} 🍟</b></div>
                <div className="row"><span>Distance Escaped</span><b data-testid="ticket-distance">{distance} m</b></div>
                <div className="row"><span>Traffic Laws Violated</span><b data-testid="ticket-laws">{trafficLawsViolated}</b></div>
                <div className="row"><span>Property Damage</span><b data-testid="ticket-damage">${propertyDamage}</b></div>
                <div className="row"><span>Police Cars Dodged</span><b data-testid="ticket-dodged">{dodged}</b></div>
                <div className="row"><span>Lessons Learned</span><b data-testid="ticket-lessons">0</b></div>

                <div className="text-center text-[10px] mt-3 text-gray-600 italic">
                    *Officer's notes: "She just really wanted that fry."
                </div>
            </div>

            <div className="flex flex-col items-center gap-2 mt-6">
                <button data-testid="restart-button" className="btn-arcade text-lg" onClick={onRestart}>
                    🍟 One More Fry
                </button>
                <div className="flex gap-3">
                    {onReplay && (
                        <button data-testid="replay-button" className="btn-arcade-secondary text-sm" onClick={onReplay}>
                            🎬 Replay Scene
                        </button>
                    )}
                    <button data-testid="title-button" className="btn-arcade-secondary text-sm" onClick={onTitle}>
                        Main Menu
                    </button>
                </div>
            </div>

            {showSecret && (
                <div className="secret-ending" data-testid="secret-ending">
                    <span className="secret-sparkle" aria-hidden>✨🍟✨</span>
                    <p>Made for <b>Angel</b>, the original stunt driver.</p>
                    <span className="secret-heart" aria-hidden>♥</span>
                </div>
            )}
        </div>
    );
}

// ---------- Main Game ----------
export default function Game() {
    const [screen, setScreen] = useState("title"); // title | loading | intro | playing | paused | caught | gameover
    const [lane, setLane] = useState(1);
    const [distance, setDistance] = useState(0);
    const [fries, setFries] = useState(0);
    const [hits, setHits] = useState(0);
    const [dodged, setDodged] = useState(0);
    const [radio, setRadio] = useState({
        line: EARLY_INTRO_LINES[0],
        callsign: "Dispatch",
        stage: "serious",
        interjection: "",
        nonce: 0,
    });
    const [shellShake, setShellShake] = useState(false);
    const [flashes, setFlashes] = useState([]);
    const [pops, setPops] = useState([]);
    const [angelQuote, setAngelQuote] = useState(null); // {id, text}
    const [skids, setSkids] = useState([]); // {id, x, dir}
    const [sparkles, setSparkles] = useState([]); // {id, x, y, golden}
    const [slowMo, setSlowMo] = useState(false);
    const slowMoRef = useRef(false);

    // Combo / Frenzy / Turbo
    const [combo, setCombo] = useState(0);
    const [comboBanner, setComboBanner] = useState(null); // {id, text, kind}
    const [frenzy, setFrenzy] = useState(false);
    const [turbo, setTurbo] = useState(false);
    const [policePanic, setPolicePanic] = useState(false);
    const [trail, setTrail] = useState([]); // {id, x, y, color}
    const [smokes, setSmokes] = useState([]); // {id, x, y}
    const [tiltDir, setTiltDir] = useState(0); // -1 left, 0 none, 1 right
    const [isFast, setIsFast] = useState(false);
    const tiltTimerRef = useRef(null);
    const lastNearMissRef = useRef(0);

    // World + weather + events
    const [weather, setWeather] = useState("sunny"); // sunny | sunset | night | rain
    const [worldProps, setWorldProps] = useState([]); // ambient props that scroll {id, kind, side, y, content}
    const [eventBanner, setEventBanner] = useState(null); // {id, text, kind}
    const [chopper, setChopper] = useState(false);
    const weatherRef = useRef("sunny");
    const worldTimerRef = useRef(0);
    const eventTimerRef = useRef(0);
    const billboardJokesRef = useRef([
        "EAT FRESH FRIES", "1-800-LOST-FRY", "UNSALTED LIFE",
        "POTATO POWER!", "FRY GUYS LEGAL", "NO FRY LEFT BEHIND",
        "WANTED: 1 FRY", "BIG MAC, BIGGER DRAMA", "DRIVE THRU. LITERALLY.",
        "FRIES > FAME", "GRAND THEFT POTATO", "LIVE LAUGH LARGE FRY",
    ]);
    const comboRef = useRef(0);
    const comboTimerRef = useRef(0); // ms remaining before combo resets
    const frenzyRef = useRef(false);
    const turboRef = useRef(false);
    const frenzyEndAtRef = useRef(0);
    const turboEndAtRef = useRef(0);
    const lastTrailRef = useRef(0);

    // Achievement queue (toast rendering)
    const [achToast, setAchToast] = useState(null);
    const achTimerRef = useRef(null);
    const pushAchievement = useCallback((key) => {
        const meta = unlockAchievement(key);
        if (!meta) return;
        setAchToast({ ...meta, _key: key + Date.now() });
        if (achTimerRef.current) clearTimeout(achTimerRef.current);
        achTimerRef.current = setTimeout(() => setAchToast(null), 2600);
    }, []);

    // Pause flag (also gates the game loop)
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    useEffect(() => { pausedRef.current = paused; }, [paused]);

    const shellRef = useRef(null);
    const roadRef = useRef(null);
    const entitiesRef = useRef([]);
    const stateRef = useRef({
        lane: 1,
        speed: 5,
        roadOffset: 0,
        spawnTimer: 0,
        radioTimer: 0,
        distanceFloat: 0,
        running: false,
        hits: 0,
        fries: 0,
        distance: 0,
        dodged: 0,
    });
    const [, forceRender] = useState(0);

    // Keep state ref in sync with React state for game-over checks
    useEffect(() => { stateRef.current.lane = lane; }, [lane]);

    const startGame = () => {
        unlockAudio();
        const music = getMusic();
        if (music) {
            music.stop();
            music.setIntensity(0);
            music.start();
            music.startSiren();
        }
        // Dramatic bass drop at chase start
        sfx.bassDrop();
        // Reset
        entitiesRef.current = [];
        stateRef.current = {
            lane: 1,
            speed: 5,
            roadOffset: 0,
            spawnTimer: 0,
            radioTimer: 0,
            distanceFloat: 0,
            running: true,
            hits: 0,
            fries: 0,
            distance: 0,
            dodged: 0,
        };
        setLane(1);
        setDistance(0);
        setFries(0);
        setHits(0);
        setDodged(0);
        setAngelQuote(null);
        setSkids([]);
        setSparkles([]);
        setSlowMo(false);
        slowMoRef.current = false;
        // Combo / frenzy / turbo resets
        setCombo(0);
        comboRef.current = 0;
        comboTimerRef.current = 0;
        setComboBanner(null);
        setFrenzy(false);
        frenzyRef.current = false;
        frenzyEndAtRef.current = 0;
        setTurbo(false);
        turboRef.current = false;
        turboEndAtRef.current = 0;
        setPolicePanic(false);
        setTrail([]);
        setSmokes([]);
        setTiltDir(0);
        setIsFast(false);
        lastNearMissRef.current = 0;
        // World resets
        setWeather("sunny");
        weatherRef.current = "sunny";
        setWorldProps([]);
        setEventBanner(null);
        setChopper(false);
        worldTimerRef.current = 0;
        // Pre-charge event timer so the FIRST event fires around 6-7s into play
        eventTimerRef.current = 6000;
        setRadio({
            line: EARLY_INTRO_LINES[Math.floor(Math.random() * EARLY_INTRO_LINES.length)],
            callsign: "Dispatch",
            stage: "serious",
            interjection: "",
            nonce: Date.now(),
        });
        setScreen("playing");
    };

    const moveLane = useCallback((dir) => {
        if (!stateRef.current.running) return;
        const next = Math.max(0, Math.min(2, stateRef.current.lane + dir));
        if (next !== stateRef.current.lane) {
            const prevLane = stateRef.current.lane;
            stateRef.current.lane = next;
            setLane(next);
            sfx.swerve();
            sfx.skid();
            // Tire skid at OLD lane
            const shellW = shellRef.current?.clientWidth || 380;
            const shellH = shellRef.current?.clientHeight || 800;
            const skidId = Date.now() + Math.random();
            const skidX = LANES[prevLane] * shellW;
            setSkids((arr) => [...arr.slice(-6), { id: skidId, x: skidX, dir }]);
            setTimeout(() => {
                setSkids((arr) => arr.filter((s) => s.id !== skidId));
            }, 900);
            // Tire smoke puffs (2 puffs at the old lane)
            const puffY = shellH - 110;
            for (let p = 0; p < 2; p++) {
                const sid = Date.now() + Math.random();
                const offset = (p === 0 ? -1 : 1) * 14;
                setSmokes((arr) => [
                    ...arr.slice(-10),
                    { id: sid, x: skidX + offset, y: puffY + Math.random() * 10 }
                ]);
                setTimeout(() => {
                    setSmokes((arr) => arr.filter((q) => q.id !== sid));
                }, 700);
            }
            // Camera tilt
            setTiltDir(dir);
            if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
            tiltTimerRef.current = setTimeout(() => setTiltDir(0), 260);
        }
    }, []);

    const angelTimerRef = useRef(null);
    const showAngelQuote = useCallback((text) => {
        const id = Date.now() + Math.random();
        setAngelQuote({ id, text });
        if (angelTimerRef.current) clearTimeout(angelTimerRef.current);
        angelTimerRef.current = setTimeout(() => {
            setAngelQuote((q) => (q && q.id === id ? null : q));
        }, 2000);
    }, []);

    // Fetch radio line from backend with new 4-stage system
    const fetchRadio = useCallback(async () => {
        const s = stateRef.current;
        // Distance-based stage selection (matches backend thresholds)
        let phase;
        if (s.distance < 350) phase = "serious";
        else if (s.distance < 900) phase = "confused";
        else if (s.distance < 1700) phase = "exhausted";
        else phase = "existential";
        try {
            const res = await axios.post(`${API}/radio`, {
                phase,
                fries_collected: s.fries,
                distance: s.distance,
            }, { timeout: 8000 });
            if (res.data?.line) {
                sfx.radioStatic();
                setRadio({
                    line: res.data.line,
                    callsign: res.data.callsign || "Unit-7",
                    stage: res.data.stage || phase,
                    interjection: res.data.interjection || "",
                    nonce: Date.now() + Math.random(),
                });
            }
        } catch {
            // keep previous line silently
        }
    }, []);

    // Controls: keyboard
    useEffect(() => {
        const onKey = (e) => {
            if (screen !== "playing") return;
            if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
                e.preventDefault();
                moveLane(-1);
            } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
                e.preventDefault();
                moveLane(1);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [screen, moveLane]);

    // Controls: swipe
    useEffect(() => {
        const el = shellRef.current;
        if (!el) return;
        let startX = 0, startY = 0, active = false;
        const onStart = (e) => {
            const t = e.touches ? e.touches[0] : e;
            startX = t.clientX; startY = t.clientY; active = true;
        };
        const onEnd = (e) => {
            if (!active) return;
            active = false;
            const t = e.changedTouches ? e.changedTouches[0] : e;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) {
                moveLane(dx > 0 ? 1 : -1);
            }
        };
        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchend", onEnd);
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchend", onEnd);
        };
    }, [moveLane]);

    // Game loop
    useEffect(() => {
        if (screen !== "playing") return;
        let raf;
        let last = performance.now();
        let radioReqInFlight = false;

        const shell = shellRef.current;
        const width = shell.clientWidth;
        const height = shell.clientHeight;

        const playerY = height - 90 - 110; // bottom: 90px, sprite 110 tall
        const playerHalfW = 30, playerHalfH = 45;

        const triggerHit = () => {
            stateRef.current.hits += 1;
            setHits(stateRef.current.hits);
            sfx.crash();
            setShellShake(true);
            setTimeout(() => setShellShake(false), 320);
            const id = Date.now() + Math.random();
            setFlashes((f) => [...f, id]);
            setTimeout(() => setFlashes((f) => f.filter((x) => x !== id)), 350);
            stateRef.current.speed = Math.max(4, stateRef.current.speed - 1.5);
            if (stateRef.current.hits >= MAX_HITS) {
                stateRef.current.running = false;
                sfx.gameover();
                const music = getMusic();
                if (music) {
                    music.stopHeartbeat();
                    music.stop();
                }
                // Persist score
                axios.post(`${API}/scores`, {
                    player: "Angel",
                    distance: stateRef.current.distance,
                    fries: stateRef.current.fries,
                }).catch(() => {});
                // Trigger caught cutscene before ticket
                setScreen("caught");
            } else if (stateRef.current.hits >= 2) {
                // Low health → heartbeat starts
                const music = getMusic();
                if (music) music.startHeartbeat();
            }
        };

        const spawnSparkles = (x, y, golden = false) => {
            const id = Date.now() + Math.random();
            const count = golden ? 12 : 6;
            const parts = Array.from({ length: count }).map((_, i) => ({
                k: i,
                angle: (Math.PI * 2 * i) / count + Math.random() * 0.4,
                dist: golden ? 40 + Math.random() * 30 : 22 + Math.random() * 18,
            }));
            setSparkles((arr) => [...arr.slice(-12), { id, x, y, golden, parts }]);
            setTimeout(() => {
                setSparkles((arr) => arr.filter((s) => s.id !== id));
            }, golden ? 900 : 650);
        };

        const showComboBanner = (text, kind = "combo") => {
            const id = Date.now() + Math.random();
            setComboBanner({ id, text, kind });
            setTimeout(() => {
                setComboBanner((b) => (b && b.id === id ? null : b));
            }, kind === "frenzy" ? 1400 : 900);
        };

        const showEventBanner = (text) => {
            const id = Date.now() + Math.random();
            setEventBanner({ id, text });
            setTimeout(() => {
                setEventBanner((b) => (b && b.id === id ? null : b));
            }, 2400);
        };

        const startFrenzy = () => {
            frenzyRef.current = true;
            setFrenzy(true);
            frenzyEndAtRef.current = performance.now() + 6000;
            sfx.frenzyStart();
            showComboBanner("FRY FRENZY!", "frenzy");
            // Immediate chaotic radio
            fetchRadio();
        };

        const startTurbo = (durationMs = 2200) => {
            turboRef.current = true;
            setTurbo(true);
            turboEndAtRef.current = performance.now() + durationMs;
        };

        const triggerFry = (x, y) => {
            stateRef.current.fries += 1;
            setFries(stateRef.current.fries);
            sfx.crunch();
            // Combo logic
            comboRef.current += 1;
            comboTimerRef.current = 2500; // 2.5s window
            setCombo(comboRef.current);
            const c = comboRef.current;
            if (c === 2)      showComboBanner("Fry Combo x2!");
            else if (c === 5) { showComboBanner("Fry Combo x5!"); sfx.comboPing(2); }
            else if (c === 10 && !frenzyRef.current) {
                startFrenzy();
            } else if (c > 2 && c % 3 === 0) {
                sfx.comboPing(1);
            }
            const id = Date.now() + Math.random();
            setPops((p) => [...p, { id, x, y, text: `+1 🍟${c >= 2 ? ` ×${c}` : ""}`, golden: false }]);
            setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 800);
            spawnSparkles(x, y, false);
            if (Math.random() < 0.55) {
                showAngelQuote(pickLine(ANGEL_LINES.fry));
            }
        };

        const triggerGoldenFry = (x, y) => {
            stateRef.current.fries += 5;
            setFries(stateRef.current.fries);
            sfx.heavenlyChoir();
            // Combo: golden adds a big jump
            comboRef.current += 3;
            comboTimerRef.current = 3500;
            setCombo(comboRef.current);
            if (comboRef.current >= 10 && !frenzyRef.current) startFrenzy();

            const id = Date.now() + Math.random();
            setPops((p) => [...p, { id, x, y, text: "+5 ⭐🍟", golden: true }]);
            setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 1300);
            spawnSparkles(x, y, true);
            showAngelQuote("GOLDEN FRY!");

            // Slow-motion effect (existing)
            slowMoRef.current = true;
            setSlowMo(true);
            setTimeout(() => {
                slowMoRef.current = false;
                setSlowMo(false);
                // After slow-mo, turbo mode kicks in
                startTurbo(2200);
            }, 1500);

            // Police panic reaction
            setPolicePanic(true);
            setTimeout(() => setPolicePanic(false), 2200);
        };

        const spawn = () => {
            const usedLanes = new Set();
            const numItems = Math.random() < 0.4 ? 2 : 1;
            for (let i = 0; i < numItems; i++) {
                let laneIdx;
                let attempts = 0;
                do {
                    laneIdx = Math.floor(Math.random() * 3);
                    attempts++;
                } while (usedLanes.has(laneIdx) && attempts < 5);
                usedLanes.add(laneIdx);
                // Leave at least one lane open if 2 obstacles
                if (usedLanes.size >= 3) break;

                const r = Math.random();
                let type;
                if (r < 0.04) type = "golden_fry";
                else if (r < 0.38) type = "fry";
                else type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

                entitiesRef.current.push({
                    id: Math.random().toString(36).slice(2),
                    type,
                    laneIdx,
                    y: -120,
                    x: LANES[laneIdx] * width,
                });
            }
        };

        const loop = (now) => {
            const dt = Math.min(40, now - last); // ms
            last = now;
            const s = stateRef.current;
            if (!s.running) return;

            // Speed up over time (slow-motion halves movement; turbo / frenzy speed up)
            s.speed = Math.min(13, s.speed + 0.00025 * dt);
            let multiplier = 1;
            if (slowMoRef.current) multiplier = 0.35;
            else if (turboRef.current) multiplier = 1.55;
            if (frenzyRef.current) multiplier *= 1.30;
            const dy = s.speed * (dt / 16.67) * multiplier;

            // High-speed mode (motion blur + speed lines)
            const wantsFast = (s.speed * multiplier) >= 9 || turboRef.current || frenzyRef.current;
            if (wantsFast !== isFast) setIsFast(wantsFast);

            // Combo timer countdown
            if (comboRef.current > 0) {
                comboTimerRef.current -= dt;
                if (comboTimerRef.current <= 0) {
                    comboRef.current = 0;
                    setCombo(0);
                }
            }

            // Weather progression by distance
            const wantWeather =
                s.distance < 350  ? "sunny" :
                s.distance < 900  ? "sunset" :
                s.distance < 1700 ? "night" :
                                    "rain";
            if (wantWeather !== weatherRef.current) {
                weatherRef.current = wantWeather;
                setWeather(wantWeather);
            }

            // Ambient world props (billboards, pedestrians, neon signs, helicopter)
            worldTimerRef.current += dt;
            if (worldTimerRef.current > 950) {
                worldTimerRef.current = 0;
                const r = Math.random();
                let kind, side, content;
                if (r < 0.30) {
                    kind = "billboard";
                    side = Math.random() < 0.5 ? "left" : "right";
                    content = billboardJokesRef.current[
                        Math.floor(Math.random() * billboardJokesRef.current.length)
                    ];
                } else if (r < 0.55) {
                    kind = "neon";
                    side = Math.random() < 0.5 ? "left" : "right";
                    const neons = ["DINER", "OPEN", "PIZZA", "BAR", "24/7", "BURGERS", "TACOS"];
                    content = neons[Math.floor(Math.random() * neons.length)];
                } else if (r < 0.85) {
                    kind = "pedestrian";
                    side = Math.random() < 0.5 ? "left" : "right";
                    const peds = ["🚶", "🧍", "🚶‍♀️", "🧍‍♂️", "👨‍🍳"];
                    content = peds[Math.floor(Math.random() * peds.length)];
                } else {
                    kind = "streetlight";
                    side = Math.random() < 0.5 ? "left" : "right";
                    content = "";
                }
                const pid = Math.random().toString(36).slice(2);
                setWorldProps((arr) => [
                    ...arr.slice(-9),
                    { id: pid, kind, side, y: -80, content },
                ]);
            }
            // Move world props down and prune
            setWorldProps((arr) => {
                if (!arr.length) return arr;
                const updated = arr.map((p) => ({ ...p, y: p.y + dy * 0.95 }))
                                   .filter((p) => p.y < height + 100);
                return updated;
            });

            // Random world events ~every 12s after first 8s
            eventTimerRef.current += dt;
            if (eventTimerRef.current > 12000 && s.distance > 60) {
                eventTimerRef.current = 0;
                const which = Math.random();
                if (which < 0.30) {
                    // FOOD TRUCK EXPLOSION — spawn extra fries in all lanes
                    showEventBanner("🚚💥 FOOD TRUCK EXPLOSION!");
                    for (let li = 0; li < 3; li++) {
                        for (let k = 0; k < 3; k++) {
                            entitiesRef.current.push({
                                id: Math.random().toString(36).slice(2),
                                type: "fry",
                                laneIdx: li,
                                y: -200 - k * 80 - li * 25,
                                x: LANES[li] * width,
                            });
                        }
                    }
                } else if (which < 0.55) {
                    // NEWS HELICOPTER overhead for ~7s
                    showEventBanner("📺 LIVE: CHANNEL 9 ON SCENE!");
                    setChopper(true);
                    setTimeout(() => setChopper(false), 7000);
                } else if (which < 0.78) {
                    // CROSSING BUS — big visual element across the road
                    const busId = Math.random().toString(36).slice(2);
                    setWorldProps((arr) => [
                        ...arr,
                        { id: busId, kind: "bus", side: "cross", y: -60, content: "🚌" },
                    ]);
                    showEventBanner("🚌 BUS CROSSING!");
                    sfx.horn();
                    setTimeout(() => sfx.horn(), 600);
                } else {
                    // CONSTRUCTION ZONE — burst of cones + barriers
                    showEventBanner("🚧 CONSTRUCTION ZONE!");
                    const layout = [
                        { lane: 0, type: "cone",    y: -100 },
                        { lane: 2, type: "cone",    y: -200 },
                        { lane: 1, type: "barrier", y: -340 },
                        { lane: 0, type: "barrier", y: -500 },
                        { lane: 2, type: "cone",    y: -640 },
                    ];
                    layout.forEach((it) => {
                        entitiesRef.current.push({
                            id: Math.random().toString(36).slice(2),
                            type: it.type,
                            laneIdx: it.lane,
                            y: it.y,
                            x: LANES[it.lane] * width,
                        });
                    });
                }
            }

            // Frenzy / turbo expiry
            if (frenzyRef.current && performance.now() >= frenzyEndAtRef.current) {
                frenzyRef.current = false;
                setFrenzy(false);
            }
            if (turboRef.current && performance.now() >= turboEndAtRef.current) {
                turboRef.current = false;
                setTurbo(false);
            }

            // Trail particles while turbo or frenzy
            if ((turboRef.current || frenzyRef.current) && now - lastTrailRef.current > 55) {
                lastTrailRef.current = now;
                const px = LANES[s.lane] * width;
                const py = playerY + 70;
                const trailId = now + Math.random();
                const color = turboRef.current ? "gold" : "pink";
                setTrail((t) => [...t.slice(-14), { id: trailId, x: px, y: py, color }]);
                setTimeout(() => {
                    setTrail((t) => t.filter((q) => q.id !== trailId));
                }, 500);
            }

            // Road scroll
            s.roadOffset = (s.roadOffset + dy) % 1000;
            if (roadRef.current) {
                roadRef.current.style.backgroundPosition = `center ${s.roadOffset}px`;
            }

            // Distance
            s.distanceFloat += dy * 0.08;
            const newDist = Math.floor(s.distanceFloat);
            if (newDist !== s.distance) {
                s.distance = newDist;
                setDistance(newDist);
            }

            // Spawning
            s.spawnTimer += dt;
            const spawnInterval = Math.max(380, 900 - s.speed * 38);
            if (s.spawnTimer > spawnInterval) {
                s.spawnTimer = 0;
                spawn();
            }

            // Move entities
            const ents = entitiesRef.current;
            for (let i = ents.length - 1; i >= 0; i--) {
                const e = ents[i];
                e.y += dy;
                // Collision check (only if in same lane and near player y)
                if (e.laneIdx === s.lane) {
                    const dy2 = Math.abs(e.y - playerY);
                    if (dy2 < playerHalfH + 30) {
                        if (e.type === "fry") {
                            triggerFry(e.x, e.y);
                            ents.splice(i, 1);
                            continue;
                        } else if (e.type === "golden_fry") {
                            triggerGoldenFry(e.x, e.y);
                            ents.splice(i, 1);
                            continue;
                        } else {
                            // collision - remove and damage
                            ents.splice(i, 1);
                            triggerHit();
                            continue;
                        }
                    }
                } else if (
                    // Near-miss: obstacle in ADJACENT lane very close to player Y
                    Math.abs(e.laneIdx - s.lane) === 1 &&
                    e.type !== "fry" && e.type !== "golden_fry" &&
                    Math.abs(e.y - playerY) < 38 &&
                    !slowMoRef.current &&
                    now - lastNearMissRef.current > 1500
                ) {
                    lastNearMissRef.current = now;
                    if (e.type === "civilian") sfx.horn();
                    // Brief slow-mo for cinematic near-miss
                    slowMoRef.current = true;
                    setSlowMo(true);
                    setTimeout(() => {
                        slowMoRef.current = false;
                        setSlowMo(false);
                    }, 220);
                }
                if (e.y > height + 120) {
                    // count cars successfully dodged (passed off-screen without hitting)
                    if (e.type === "civilian") {
                        s.dodged += 1;
                        setDodged(s.dodged);
                    }
                    ents.splice(i, 1);
                }
            }

            // Radio chatter — faster cadence during frenzy
            s.radioTimer += dt;
            const radioInterval = frenzyRef.current ? 2800 : 5500;
            if (s.radioTimer > radioInterval && !radioReqInFlight) {
                s.radioTimer = 0;
                radioReqInFlight = true;
                fetchRadio().finally(() => { radioReqInFlight = false; });
            }

            forceRender((x) => (x + 1) % 1000);
            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        // Initial radio fetch after small delay
        const initT = setTimeout(() => fetchRadio(), 1200);
        // Music intensity scheduler (every 1.2s)
        const intensityLoop = setInterval(() => {
            const music = getMusic();
            if (!music) return;
            const s = stateRef.current;
            let lvl = 0;
            if (s.distance > 40)   lvl = 1;
            if (s.distance > 600)  lvl = 2;
            if (frenzyRef.current) lvl = 3;
            music.setIntensity(lvl);
        }, 1200);
        // Angel's idle quotes — every ~9s
        const angelLoop = setInterval(() => {
            if (stateRef.current.running) {
                showAngelQuote(pickLine(ANGEL_LINES.idle));
            }
        }, 9000);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(initT);
            clearInterval(intensityLoop);
            clearInterval(angelLoop);
            // Stop music + siren when leaving playing state
            const music = getMusic();
            if (music) {
                music.stop();
                music.stopHeartbeat();
                music.stopSiren();
            }
        };
    }, [screen, fetchRadio, showAngelQuote]);

    // Compute player x for render
    const shellWidth = shellRef.current?.clientWidth || 380;
    const playerX = LANES[lane] * shellWidth;

    return (
        <div ref={shellRef} className={`game-shell weather-${weather} ${shellShake ? "shake" : ""} ${slowMo ? "slow-mo" : ""} ${frenzy ? "frenzy" : ""} ${turbo ? "turbo" : ""} ${isFast ? "is-fast" : ""} ${tiltDir === -1 ? "tilt-left" : ""} ${tiltDir === 1 ? "tilt-right" : ""}`} data-testid="game-shell">
            {/* Road */}
            <div ref={roadRef} className="road" data-testid="road" />

            {/* Weather lighting overlays */}
            <div className={`weather-tint weather-tint--${weather}`} aria-hidden />
            {weather === "rain" && (
                <>
                    <div className="rain-layer" aria-hidden>
                        {Array.from({ length: 28 }).map((_, i) => (
                            <span key={i} className="rain-drop" style={{
                                left: `${(i * 137) % 100}%`,
                                animationDelay: `${(i * 0.07) % 1.2}s`,
                                animationDuration: `${0.5 + (i % 5) * 0.08}s`,
                            }} />
                        ))}
                    </div>
                    <div className="wet-road" aria-hidden />
                </>
            )}
            <div className="siren" />

            {/* Ambient world props (billboards, neon, pedestrians, buses, streetlights) */}
            {screen === "playing" && worldProps.map((p) => (
                <WorldPropView key={p.id} p={p} shellW={shellWidth} />
            ))}

            {/* News helicopter overhead */}
            {screen === "playing" && chopper && (
                <div className="news-chopper" data-testid="news-chopper">
                    <div className="news-chopper-emoji">🚁</div>
                    <div className="news-chopper-label">
                        <span className="news-live">🔴 LIVE</span> Ch.9 — FRY-CHASE 24/7
                    </div>
                </div>
            )}

            {/* Entities */}
            {screen === "playing" && entitiesRef.current.map((e) => {
                let style = { left: e.x, top: e.y, transform: "translate(-50%, -50%)" };
                let w = 56, h = 56;
                let extraClass = "";
                let src = IMG[e.type];
                if (e.type === "civilian") { w = 64; h = 100; }
                else if (e.type === "barrier") { w = 90; h = 30; }
                else if (e.type === "cone") { w = 48; h = 60; }
                else if (e.type === "fry") { w = 46; h = 60; extraClass = "fry-glow"; src = IMG.fry; }
                else if (e.type === "golden_fry") { w = 56; h = 72; extraClass = "fry-glow is-golden"; src = IMG.fry; }
                style.width = w; style.height = h;
                return (
                    <div key={e.id} className={`sprite ${extraClass}`} style={style}>
                        <img
                            src={src}
                            alt={e.type}
                            className="sprite-img"
                            style={{ width: "100%", height: "100%" }}
                            draggable={false}
                        />
                    </div>
                );
            })}

            {/* Tire skid marks */}
            {screen === "playing" && skids.map((s) => (
                <div key={s.id} className="skid" style={{ left: s.x }}>
                    <div className="skid-streak skid-streak--l" />
                    <div className="skid-streak skid-streak--r" />
                </div>
            ))}

            {/* Tire smoke puffs */}
            {smokes.map((s) => (
                <div key={s.id} className="tire-smoke" style={{ left: s.x, top: s.y }} />
            ))}

            {/* Speed-line overlay (high speed / frenzy / turbo) */}
            {isFast && screen === "playing" && (
                <div className="speedlines" aria-hidden>
                    <span style={{ left: "8%",  animationDelay: "0s"   }} />
                    <span style={{ left: "22%", animationDelay: "0.12s" }} />
                    <span style={{ left: "38%", animationDelay: "0.05s" }} />
                    <span style={{ left: "58%", animationDelay: "0.2s"  }} />
                    <span style={{ left: "72%", animationDelay: "0.08s" }} />
                    <span style={{ left: "88%", animationDelay: "0.16s" }} />
                </div>
            )}

            {/* Sparkles when collecting fries */}
            {sparkles.map((sp) => (
                <div key={sp.id} className={`sparkle-burst ${sp.golden ? "is-golden" : ""}`} style={{ left: sp.x, top: sp.y }}>
                    {sp.parts.map((p) => (
                        <span
                            key={p.k}
                            className="spark"
                            style={{
                                transform: `translate(-50%, -50%) rotate(${(p.angle * 180) / Math.PI}deg)`,
                                "--dist": `${p.dist}px`,
                            }}
                        >
                            {sp.golden ? "✦" : "✦"}
                        </span>
                    ))}
                </div>
            ))}

            {/* Police car */}
            {screen === "playing" && (
                <img
                    src={IMG.police}
                    alt="police"
                    className={`sprite police-car ${policePanic ? "police-panic" : ""}`}
                    style={{ left: "50%" }}
                    draggable={false}
                />
            )}

            {/* Police panic emoji */}
            {screen === "playing" && policePanic && (
                <div className="police-panic-bubble" data-testid="police-panic">
                    👀❓ WHAT?!
                </div>
            )}

            {/* Neon trail behind player car (turbo / frenzy) */}
            {trail.map((p) => (
                <div
                    key={p.id}
                    className={`car-trail car-trail--${p.color}`}
                    style={{ left: p.x, top: p.y }}
                />
            ))}

            {/* Player car */}
            {screen === "playing" && (
                <img
                    src={IMG.player}
                    alt="player"
                    className="sprite player-car"
                    style={{ left: playerX, transform: "translateX(-50%)" }}
                    draggable={false}
                    data-testid="player-car"
                />
            )}

            {/* Angel's quote bubble over the player car */}
            {screen === "playing" && angelQuote && (
                <div
                    key={angelQuote.id}
                    className="angel-quote"
                    style={{ left: playerX }}
                    data-testid="angel-quote"
                >
                    {angelQuote.text}
                </div>
            )}

            {/* Fry pop-up score */}
            {pops.map((p) => (
                <div key={p.id} className={`fry-pop ${p.golden ? "is-golden" : ""}`} style={{ left: p.x, top: p.y }}>
                    {p.text || "+1 🍟"}
                </div>
            ))}

            {/* HUD */}
            {screen === "playing" && (
                <>
                    <div className="absolute top-3 left-3 z-30 flex flex-col gap-2" data-testid="hud">
                        <div className="hud-pill" data-testid="hud-distance">
                            <span className="text-white/70 text-[10px] uppercase">Dist</span>
                            <span className="hud-num">{distance}m</span>
                        </div>
                        <div className="hud-pill" data-testid="hud-fries">
                            <span>🍟</span>
                            <span key={fries} className="hud-num hud-num--bounce">{fries}</span>
                        </div>
                        {combo >= 2 && (
                            <div className={`hud-pill hud-combo ${frenzy ? "is-frenzy" : ""}`} data-testid="hud-combo">
                                <span className="text-white/70 text-[10px] uppercase">Combo</span>
                                <span>x{combo}</span>
                            </div>
                        )}
                        <div className="hud-pill" data-testid="hud-hits">
                            <span className="text-white/70 text-[10px] uppercase">Strikes</span>
                            <span>
                                {[...Array(MAX_HITS)].map((_, i) => (
                                    <span key={i} style={{ color: i < hits ? "#DA291C" : "#374151" }}>●</span>
                                ))}
                            </span>
                        </div>
                    </div>

                    {/* Reactive Angel face badge */}
                    <div
                        className={`angel-face-badge ${
                            hits >= 2 ? "is-panic" : combo >= 5 ? "is-excited" : "is-calm"
                        }`}
                        data-testid="angel-face"
                    >
                        <img
                            src={hits >= 2 ? IMG.angelPanic : combo >= 5 ? IMG.angelExcited : IMG.angel}
                            alt="Angel"
                            draggable={false}
                        />
                    </div>

                    <RadioBox radio={radio} />

                    {/* On-screen lane buttons */}
                    <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-between px-6 pointer-events-none">
                        <button
                            className="lane-btn pointer-events-auto"
                            onClick={() => moveLane(-1)}
                            data-testid="left-button"
                            aria-label="Move left"
                        >
                            ◀
                        </button>
                        <button
                            className="lane-btn pointer-events-auto"
                            onClick={() => moveLane(1)}
                            data-testid="right-button"
                            aria-label="Move right"
                        >
                            ▶
                        </button>
                    </div>
                </>
            )}

            {/* Flash effects */}
            {flashes.map((id) => <div key={id} className="flash-red" />)}

            {/* Event banner */}
            {eventBanner && (
                <div className="event-banner" data-testid="event-banner">
                    {eventBanner.text}
                </div>
            )}

            {/* Combo banner */}
            {comboBanner && (
                <div className={`combo-banner combo-banner--${comboBanner.kind}`} data-testid="combo-banner">
                    {comboBanner.text}
                </div>
            )}

            {/* Screens */}
            {screen === "title" && (
                <TitleScreen onStart={() => { unlockAudio(); setScreen("intro"); }} />
            )}
            {screen === "intro" && (
                <IntroScreen onContinue={startGame} />
            )}
            {screen === "caught" && (
                <CaughtCutscene onDone={() => setScreen("gameover")} />
            )}
            {screen === "gameover" && (
                <GameOverTicket
                    distance={distance}
                    fries={fries}
                    dodged={dodged}
                    onRestart={startGame}
                    onTitle={() => setScreen("title")}
                    onReplay={() => setScreen("caught")}
                />
            )}
        </div>
    );
}
