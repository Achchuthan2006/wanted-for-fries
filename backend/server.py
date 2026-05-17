from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---- Models ----
class RadioRequest(BaseModel):
    phase: str = "serious"  # serious | confused | exhausted | existential (legacy: early/mid/late)
    fries_collected: int = 0
    distance: int = 0

class RadioResponse(BaseModel):
    line: str
    source: str        # "scripted" or "ai"
    stage: str         # serious | confused | exhausted | existential
    callsign: str      # which voice (Dispatch / Unit-7 / Air-1 / Captain)
    interjection: str = ""  # optional overlapping line

class ScoreSubmit(BaseModel):
    player: str = "Angel"
    distance: int
    fries: int

class ScoreRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player: str
    distance: int
    fries: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---- Scripted radio chatter (primary source) ----
# 4 stages, each with a "stage" name describing the police's emotional state.
SCRIPTED_LINES = {
    # Stage 1: Serious & professional
    "serious": [
        "Suspect accelerating rapidly!",
        "Vehicle refusing to stop!",
        "All units, we have a 10-80 in progress.",
        "Dispatch, suspect heading north at high speed, over.",
        "This driver is either highly trained or highly confused!",
        "Air-1 we need eyes in the sky.",
        "Civilian vehicle, red sedan, plate unknown.",
        "Be advised: erratic acceleration on lane changes.",
        "All units converge on the suspect, code 3.",
        "Possible DUI. Engaging pursuit protocol.",
        "Suspect blew through a yellow without slowing.",
        "We are clear of civilians. Proceeding.",
    ],
    # Stage 2: Confused about the fries
    "confused": [
        "Dispatch... I think fries are falling out of the vehicle.",
        "Did you say fries?",
        "Suspect appears emotionally attached to french fries.",
        "She swerved across four lanes for one potato.",
        "I repeat... this may be fry-related.",
        "Unit-7, are those... McDonald's fries on the road?",
        "Confirming visual on multiple airborne fries, over.",
        "Sir, the suspect just blew us a kiss with a fry.",
        "Captain, are we sure this is a pursuit?",
        "She just drifted through a construction zone for one potato.",
        "The suspect remains fry-motivated.",
        "Dispatch, the suspect is screaming about a 'large'.",
        "Repeat: a large WHAT, Unit-7? Over.",
        "Wait... did she pay for those fries? Asking for legal.",
    ],
    # Stage 3: Increasingly annoyed and emotionally exhausted
    "exhausted": [
        "I left my lunch break for this.",
        "Requesting backup and possibly therapy.",
        "My coffee is getting cold, Dispatch.",
        "Captain, I want a transfer. Effective immediately.",
        "I have been on the force eleven years. ELEVEN.",
        "She just waved at me. Like we're friends.",
        "Ma'am, please let the fry go.",
        "Dispatch, my back hurts and I am tired.",
        "I have a kid's birthday party tonight, Dispatch.",
        "Sir, the helicopter is asking why we're still going.",
        "We are losing daylight. And dignity.",
        "I genuinely do not know what we're doing anymore.",
        "Air-1, can you confirm she still has fries? Over.",
        "Air-1 here. She has SO many fries. Out.",
        "I have done this for ELEVEN years and now THIS.",
    ],
    # Stage 4: Existential crisis
    "existential": [
        "We are risking taxpayer money over carbohydrates.",
        "Dispatch... I think I understand her.",
        "This pursuit is over fast food?",
        "What are any of us doing, really?",
        "If you think about it, she's the only one being honest.",
        "Is the fry the suspect... or are WE?",
        "I joined the academy to help people. Now I chase potatoes.",
        "Dispatch, define 'crime'. I'll wait.",
        "Maybe she's just trying to live. Like the rest of us.",
        "I have begun to root for her, Dispatch.",
        "The fries cannot be worth this. And yet... here we are.",
        "Captain, what if SHE is the law?",
        "If we catch her, what then? What changes?",
        "Honestly? I'd reach for the fry too.",
        "We are not chasing a suspect. We are chasing meaning.",
        "Dispatch, I have been radicalized by carbohydrates.",
        "I'd like to formally retire. Effective right now.",
    ],
}

STAGE_ORDER = ["serious", "confused", "exhausted", "existential"]

# Occasional short interjections from other units (overlapping chatter)
INTERJECTIONS = [
    "(static)",
    "...copy that.",
    "Air-1, standing by.",
    "10-4.",
    "Repeat?",
    "We hear you, Unit-7.",
    "Dispatch acknowledged.",
    "...go ahead.",
    "Roger that.",
    "Stand by, over.",
]

# Backward-compat aliases so older clients still work
SCRIPTED_LINES["early"] = SCRIPTED_LINES["serious"]
SCRIPTED_LINES["mid"] = SCRIPTED_LINES["confused"]
SCRIPTED_LINES["late"] = SCRIPTED_LINES["existential"]
FALLBACK_LINES = SCRIPTED_LINES


@api_router.get("/")
async def root():
    return {"message": "Wanted for Fries API"}


_PHASE_ALIAS = {
    "early": "serious",
    "mid": "confused",
    "late": "existential",
}
_STAGE_CALLSIGNS = {
    "serious":     ["Unit-7", "Dispatch", "Air-1", "Captain"],
    "confused":    ["Unit-7", "Dispatch", "Air-1", "Unit-12"],
    "exhausted":   ["Unit-7", "Unit-12", "Air-1", "Captain"],
    "existential": ["Unit-7", "Air-1", "Captain", "Unit-12"],
}


def _resolve_stage(phase: str, distance: int) -> str:
    """Map phase or distance to one of the 4 emotional stages."""
    if phase in STAGE_ORDER:
        return phase
    if phase in _PHASE_ALIAS:
        return _PHASE_ALIAS[phase]
    # Fallback: derive from distance
    if distance < 350:
        return "serious"
    if distance < 900:
        return "confused"
    if distance < 1700:
        return "exhausted"
    return "existential"


@api_router.post("/radio", response_model=RadioResponse)
async def get_radio_line(req: RadioRequest):
    stage = _resolve_stage(req.phase, req.distance)
    callsign = random.choice(_STAGE_CALLSIGNS[stage])
    # 25% chance of an overlapping interjection from another unit
    interjection = random.choice(INTERJECTIONS) if random.random() < 0.25 else ""

    # 70% scripted (so player reliably hears curated lines), 30% AI for spice.
    if random.random() < 0.70:
        return RadioResponse(
            line=random.choice(SCRIPTED_LINES[stage]),
            source="scripted",
            stage=stage,
            callsign=callsign,
            interjection=interjection,
        )

    # Try LLM
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("No LLM key configured")

        stage_desc = {
            "serious":     "Officers are calm, focused, professional. They believe this is a real high-speed pursuit.",
            "confused":    "Officers are slowly realizing the suspect is reaching for one french fry. Disbelief and bewilderment.",
            "exhausted":   "Officers are tired, annoyed, want to go home, complaining about their day, sighing into the radio.",
            "existential": "Officers are having a quiet career crisis. Philosophical, doubting reality and law itself over this fry chase.",
        }[stage]

        system = (
            "You write very short, single-line police radio chatter for a COMEDY arcade game called "
            "'Wanted for Fries: Angel the Stunt Driver'. A driver named Angel dropped one french fry "
            "near her pedals, accidentally hit the gas, and is now being chased by police. "
            "Output ONE single radio line of 8-20 words. No quotes. No prefixes like 'Officer:' or callsigns. "
            "Just the spoken line. Be absurd, deadpan, in-character for the emotional stage. "
            "End some lines with 'over.' for radio flavor."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"radio-{uuid.uuid4()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        user_msg = UserMessage(
            text=(
                f"Emotional stage: {stage}. {stage_desc} "
                f"Distance so far: {req.distance}m. Fries collected: {req.fries_collected}. "
                f"Speaking callsign: {callsign}. Give me ONE radio line now."
            )
        )

        line = await chat.send_message(user_msg)
        line = (line or "").strip().strip('"').strip("'")
        if line:
            if len(line) > 200:
                line = line[:197] + "..."
            return RadioResponse(
                line=line,
                source="ai",
                stage=stage,
                callsign=callsign,
                interjection=interjection,
            )
    except Exception as e:
        logger.warning(f"LLM radio failed, using scripted: {e}")

    return RadioResponse(
        line=random.choice(SCRIPTED_LINES[stage]),
        source="scripted",
        stage=stage,
        callsign=callsign,
        interjection=interjection,
    )


@api_router.post("/scores", response_model=ScoreRecord)
async def save_score(payload: ScoreSubmit):
    rec = ScoreRecord(**payload.model_dump())
    doc = rec.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.scores.insert_one(doc)
    return rec


@api_router.get("/scores/top")
async def top_scores():
    docs = await db.scores.find({}, {"_id": 0}).sort("distance", -1).to_list(10)
    return docs


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
