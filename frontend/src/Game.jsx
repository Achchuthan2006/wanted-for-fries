import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { sfx, unlockAudio } from "./sounds";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IMG = {
    player: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/44c2b25b890a4bf62ce4d938079f84ea50ad336efea5d8dab04ae3d93a938b37.png",
    police: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/b7b450b1d49dbc9392dd76336358347391483c010d4d999683a2f8565eff1693.png",
    civilian: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/7fc8664eaa0361c1bc2f53ce3caeab361c66ad7c7b9fb096b47a15d91edebf44.png",
    cone: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/4e96c5de105a73acbc056c9b5861d1096ccbe526bebe0dbc0d29a5aac60d4b6f.png",
    barrier: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/8850e2b423502dff2314355df22ef905d73a0dc30ded68a778901aeaa46d8dc6.png",
    fry: "https://static.prod-images.emergentagent.com/jobs/f6836503-9171-41cb-82ba-84c20e30f37b/images/4168de88d6eb27cff5a441c70c774da5dc7cb72698bd7e193a33ff3dc2eab043.png",
};

const EARLY_INTRO_LINES = [
    "Suspect accelerating rapidly!",
    "Vehicle refusing to stop!",
    "This driver is either highly trained or highly confused!",
];

const LANES = [0.22, 0.5, 0.78]; // left, center, right (% of width)
const MAX_HITS = 3;
const OBSTACLE_TYPES = ["cone", "barrier", "civilian", "civilian"];

// ---------- Title Screen ----------
function TitleScreen({ onStart }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
            <div className="text-center">
                <div className="font-heading title-stroke text-5xl sm:text-6xl font-black tracking-tight uppercase leading-none">
                    Wanted<br />for Fries
                </div>
                <div className="mt-5 font-heading text-2xl text-white font-bold tracking-wide">
                    Angel: The Stunt Driver
                </div>
                <div className="mt-3 font-body text-xs text-yellow-300/80 italic">
                    Based on a true fry-related incident.
                </div>
            </div>

            <div className="my-7 text-5xl select-none animate-bounce">🚓💨🍟</div>

            <button
                data-testid="start-button"
                className="btn-arcade text-2xl"
                onClick={onStart}
            >
                Start Chase
            </button>

            <div className="absolute bottom-4 text-[10px] text-white/40 font-mono tracking-widest uppercase">
                Tap / Swipe / Arrow Keys
            </div>
        </div>
    );
}

// ---------- Intro Story ----------
function IntroScreen({ onContinue }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-yellow-50 border-4 border-dashed border-gray-700 rounded-xl p-6 max-w-[340px] w-full font-body shadow-2xl">
                <div className="font-heading uppercase text-red-700 font-bold text-sm tracking-wider mb-3">
                    Case File #4815
                </div>
                <p className="text-gray-900 font-bold text-base leading-relaxed">
                    Angel bought a large fries.<br />
                    Got in her car. Happy.<br />
                    <span className="text-red-600">One fry escaped.</span><br />
                    She reached down to save it...<br />
                    her foot found the gas pedal.
                </p>
                <p className="text-gray-700 italic mt-3 text-sm">
                    Now half the city's police force is in pursuit.
                    Survive as long as you can. Collect every fry.
                </p>
            </div>
            <button
                data-testid="intro-continue-button"
                className="btn-arcade mt-7 text-xl"
                onClick={onContinue}
            >
                Floor It!
            </button>
        </div>
    );
}

// ---------- Caught Cutscene ----------
function CaughtCutscene({ onDone }) {
    const [step, setStep] = useState(0); // 0: officer walking, 1: pause, 2: speech, 3: fade
    useEffect(() => {
        const t1 = setTimeout(() => setStep(1), 1100); // arrived
        const t2 = setTimeout(() => setStep(2), 1700); // speak
        const t3 = setTimeout(() => setStep(3), 5200); // fade
        const t4 = setTimeout(() => onDone(), 5900);
        return () => [t1, t2, t3, t4].forEach(clearTimeout);
    }, [onDone]);

    return (
        <div
            data-testid="caught-cutscene"
            className={`absolute inset-0 z-50 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 ${step >= 3 ? "cutscene-fade" : ""}`}
        >
            {/* spotlight on Angel's car */}
            <div className="cutscene-spotlight" />

            {/* Red/blue strobes from off-screen police car */}
            <div className="cutscene-strobe" />

            {/* Angel's car parked */}
            <div className="cutscene-car">
                <img
                    src={IMG.player}
                    alt="Angel's car"
                    className="cutscene-car-img"
                    draggable={false}
                />
                {/* Angel's hand holding one last fry */}
                <div className="cutscene-fry" aria-hidden>🍟</div>
            </div>

            {/* Officer walking up */}
            <div className={`cutscene-officer ${step >= 1 ? "is-arrived" : ""}`} data-testid="cutscene-officer">
                <span className="cutscene-officer-emoji">👮‍♀️</span>
            </div>

            {/* Speech bubble */}
            {step >= 2 && (
                <div className="cutscene-speech" data-testid="cutscene-speech">
                    <div className="cutscene-speech-tail" />
                    <div className="cutscene-speech-eyebrow">Officer Mendez</div>
                    <p>
                        “Ma'am… you caused a <b>14 car pileup</b> for potatoes.”
                    </p>
                </div>
            )}

            {/* Bottom caption */}
            <div className="cutscene-caption">
                <span>SCENE — Roadside, 11:47 PM</span>
            </div>
        </div>
    );
}

// ---------- Ticket Game Over ----------
function GameOverTicket({ distance, fries, dodged, onRestart, onTitle }) {
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto py-6">
            <div className="ticket" data-testid="ticket-modal">
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
                    <li>Dangerous Fry Recovery</li>
                    <li>Vehicular Potato Endangerment</li>
                    <li>Excessive Emotional Attachment to Fries</li>
                </ul>

                <div className="ticket-section-label">FINAL STATS</div>
                <div className="row"><span>Fries Saved</span><b data-testid="ticket-fries">{fries} 🍟</b></div>
                <div className="row"><span>Distance Escaped</span><b data-testid="ticket-distance">{distance} m</b></div>
                <div className="row"><span>Police Cars Dodged</span><b data-testid="ticket-dodged">{dodged}</b></div>
                <div className="row"><span>Lessons Learned</span><b data-testid="ticket-lessons">0</b></div>

                <div className="text-center text-[10px] mt-3 text-gray-600 italic">
                    *Officer's notes: "She just really wanted that fry."
                </div>
            </div>

            <div className="flex gap-3 mt-7">
                <button data-testid="restart-button" className="btn-arcade text-lg" onClick={onRestart}>
                    Try Again
                </button>
                <button data-testid="title-button" className="btn-arcade-secondary text-sm" onClick={onTitle}>
                    Main Menu
                </button>
            </div>
        </div>
    );
}

// ---------- Main Game ----------
export default function Game() {
    const [screen, setScreen] = useState("title"); // title | intro | playing | caught | gameover
    const [lane, setLane] = useState(1);
    const [distance, setDistance] = useState(0);
    const [fries, setFries] = useState(0);
    const [hits, setHits] = useState(0);
    const [dodged, setDodged] = useState(0);
    const [radio, setRadio] = useState(EARLY_INTRO_LINES[0]);
    const [shellShake, setShellShake] = useState(false);
    const [flashes, setFlashes] = useState([]);
    const [pops, setPops] = useState([]);

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
        };
        setLane(1);
        setDistance(0);
        setFries(0);
        setHits(0);
        setRadio(EARLY_INTRO_LINES[Math.floor(Math.random() * EARLY_INTRO_LINES.length)]);
        setScreen("playing");
    };

    const moveLane = useCallback((dir) => {
        if (!stateRef.current.running) return;
        const next = Math.max(0, Math.min(2, stateRef.current.lane + dir));
        if (next !== stateRef.current.lane) {
            stateRef.current.lane = next;
            setLane(next);
            sfx.swerve();
        }
    }, []);

    // Fetch radio line from backend
    const fetchRadio = useCallback(async () => {
        const s = stateRef.current;
        const phase = s.distance < 400 ? "early" : s.distance < 1200 ? "mid" : "late";
        try {
            const res = await axios.post(`${API}/radio`, {
                phase,
                fries_collected: s.fries,
                distance: s.distance,
            }, { timeout: 8000 });
            if (res.data?.line) setRadio(res.data.line);
        } catch {
            // backend already has fallback; if request fails entirely keep previous
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
                // Persist score
                axios.post(`${API}/scores`, {
                    player: "Angel",
                    distance: stateRef.current.distance,
                    fries: stateRef.current.fries,
                }).catch(() => {});
                // Trigger caught cutscene before ticket
                setScreen("caught");
            }
        };

        const triggerFry = (x, y) => {
            stateRef.current.fries += 1;
            setFries(stateRef.current.fries);
            sfx.coin();
            const id = Date.now() + Math.random();
            setPops((p) => [...p, { id, x, y }]);
            setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 700);
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

                const isFry = Math.random() < 0.35;
                let type;
                if (isFry) type = "fry";
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

            // Speed up over time
            s.speed = Math.min(13, s.speed + 0.00025 * dt);
            const dy = s.speed * (dt / 16.67);

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
                        } else {
                            // collision - remove and damage
                            ents.splice(i, 1);
                            triggerHit();
                            continue;
                        }
                    }
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

            // Radio chatter every ~5-6s
            s.radioTimer += dt;
            if (s.radioTimer > 5500 && !radioReqInFlight) {
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
        // Siren ambience loop
        const sirenLoop = setInterval(() => {
            if (stateRef.current.running) sfx.siren();
        }, 3500);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(initT);
            clearInterval(sirenLoop);
        };
    }, [screen, fetchRadio]);

    // Compute player x for render
    const shellWidth = shellRef.current?.clientWidth || 380;
    const playerX = LANES[lane] * shellWidth;

    return (
        <div ref={shellRef} className={`game-shell ${shellShake ? "shake" : ""}`} data-testid="game-shell">
            {/* Road */}
            <div ref={roadRef} className="road" data-testid="road" />
            <div className="siren" />

            {/* Entities */}
            {screen === "playing" && entitiesRef.current.map((e) => {
                let style = { left: e.x, top: e.y, transform: "translate(-50%, -50%)" };
                let w = 56, h = 56;
                if (e.type === "civilian") { w = 64; h = 100; }
                else if (e.type === "barrier") { w = 90; h = 30; }
                else if (e.type === "cone") { w = 48; h = 60; }
                else if (e.type === "fry") { w = 46; h = 60; }
                style.width = w; style.height = h;
                return (
                    <img
                        key={e.id}
                        src={IMG[e.type]}
                        alt={e.type}
                        className="sprite"
                        style={style}
                        draggable={false}
                    />
                );
            })}

            {/* Police car */}
            {screen === "playing" && (
                <img
                    src={IMG.police}
                    alt="police"
                    className="sprite police-car"
                    style={{ left: "50%" }}
                    draggable={false}
                />
            )}

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

            {/* Fry pop-up score */}
            {pops.map((p) => (
                <div key={p.id} className="fry-pop" style={{ left: p.x, top: p.y }}>+1 🍟</div>
            ))}

            {/* HUD */}
            {screen === "playing" && (
                <>
                    <div className="absolute top-3 left-3 z-30 flex flex-col gap-2" data-testid="hud">
                        <div className="hud-pill" data-testid="hud-distance">
                            <span className="text-white/70 text-[10px] uppercase">Dist</span>
                            <span>{distance}m</span>
                        </div>
                        <div className="hud-pill" data-testid="hud-fries">
                            <span>🍟</span>
                            <span>{fries}</span>
                        </div>
                        <div className="hud-pill" data-testid="hud-hits">
                            <span className="text-white/70 text-[10px] uppercase">Strikes</span>
                            <span>
                                {[...Array(MAX_HITS)].map((_, i) => (
                                    <span key={i} style={{ color: i < hits ? "#DA291C" : "#374151" }}>●</span>
                                ))}
                            </span>
                        </div>
                    </div>

                    <div className="radio-box" data-testid="radio-box">
                        <span className="label">📻 Police Radio</span>
                        <div className="mt-1">{radio}</div>
                    </div>

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
                />
            )}
        </div>
    );
}
