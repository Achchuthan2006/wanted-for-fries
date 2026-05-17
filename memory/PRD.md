# PRD - Wanted for Fries: Angel the Stunt Driver

## Original Problem Statement
Create a 2D arcade endless runner car game called "Wanted for Fries: Angel the Stunt Driver."
Based on a funny true story: Angel buys McDonald's fries, starts driving happily, one fry falls
near the pedals, she tries to grab it, accidentally presses the accelerator, and police start chasing her.
Subway-Surfers-style 3-lane endless runner with cartoony cars, police radio dialogue, fry collectibles,
obstacles (cones, civilian cars, barriers), score & fries counter, game-over ticket screen, restart.

## User Choices
- Graphics: Asset images (provided by design agent)
- Police radio: AI-generated (Claude Sonnet 4.5) + hardcoded fallback
- Controls: Keyboard + touch swipe + on-screen left/right buttons
- Sound: Web Audio API SFX (coin, crash, swerve, siren, gameover)
- 3 lanes

## Architecture
- Frontend: React (CRA) + Tailwind, DOM-based sprites inside a phone-shaped game shell
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations (Claude Sonnet 4.5)
- Endpoints:
  - POST /api/radio  -> phase-based AI police chatter with fallback
  - POST /api/scores -> save run
  - GET  /api/scores/top -> top 10

## What's Implemented (2026-02)
- Title screen (Wanted for Fries / Angel: The Stunt Driver / true fry-related incident)
- Intro story modal (Case File #4815)
- 3-lane endless runner gameplay (DOM sprites)
- Scrolling road background, speed ramp over time
- Spawning obstacles (cone, barrier, civilian car) + fry collectibles
- Police car always present at bottom with sway + siren overlay
- HUD: distance, fries, strikes (3 max)
- AI-generated police radio (phase: early / mid / late) every ~8.5s, with hardcoded fallback
- Web Audio SFX
- Keyboard (Arrow / A-D) + touch swipe + on-screen lane buttons
- Game-over ticket modal with stats + Restart + Title
- Score persistence to MongoDB

## Backlog
- P1: High-score leaderboard screen visible from title
- P1: Power-ups (fry-magnet, ketchup-shield)
- P2: Boss police helicopter event
- P2: Daily challenge / share score
- P2: Multiple unlockable cars
