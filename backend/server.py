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
    phase: str = "early"  # early | mid | late
    fries_collected: int = 0
    distance: int = 0

class RadioResponse(BaseModel):
    line: str
    source: str  # "ai" or "fallback"

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
SCRIPTED_LINES = {
    "early": [
        "Suspect accelerating rapidly!",
        "Vehicle refusing to stop!",
        "This driver is either highly trained or highly confused!",
    ],
    "mid": [
        "Dispatch... I think fries are falling out of the vehicle.",
        "Did you say fries?",
        "Suspect appears emotionally attached to french fries.",
        "She swerved across four lanes for one potato.",
        "I repeat... this may be fry-related.",
    ],
    "late": [
        "All units... pursuit appears potato-related.",
        "This pursuit is over fast food?",
        "The fries cannot be worth this.",
        "Requesting backup and possibly therapy.",
        "Ma'am please let the fry go.",
    ],
}
# Backward-compat alias
FALLBACK_LINES = SCRIPTED_LINES


@api_router.get("/")
async def root():
    return {"message": "Wanted for Fries API"}


@api_router.post("/radio", response_model=RadioResponse)
async def get_radio_line(req: RadioRequest):
    phase = req.phase if req.phase in SCRIPTED_LINES else "early"

    # 65% of the time use the scripted lines so the player reliably hears them.
    # 35% of the time spice it up with a fresh AI-generated line.
    if random.random() < 0.65:
        return RadioResponse(line=random.choice(SCRIPTED_LINES[phase]), source="scripted")

    # Try LLM
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("No LLM key configured")

        phase_desc = {
            "early": "The chase just started. Police are confused but think it's a serious pursuit.",
            "mid": "Officers are slowly realizing the suspect is reaching for a single french fry.",
            "late": "It's pure chaos. Officers are existentially questioning their careers over this fry.",
        }[phase]

        system = (
            "You write very short, single-line police radio chatter for a COMEDY arcade game called "
            "'Wanted for Fries: Angel the Stunt Driver'. A driver named Angel dropped one french fry "
            "near her pedals, accidentally hit the gas, and is now being chased by police. "
            "Output ONE single radio line of 8-18 words. No quotes. No prefixes like 'Officer:'. "
            "Just the radio line. Use callsigns like 'Dispatch', 'Unit-7', 'Air-1' occasionally. "
            "Be absurd, deadpan, escalating in confusion. End some lines with 'over.' for radio flavor."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"radio-{uuid.uuid4()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        user_msg = UserMessage(
            text=(
                f"Phase: {phase}. {phase_desc} "
                f"Distance so far: {req.distance}m. Fries collected: {req.fries_collected}. "
                "Give me ONE radio line now."
            )
        )

        line = await chat.send_message(user_msg)
        line = (line or "").strip().strip('"').strip("'")
        if line:
            # keep it short
            if len(line) > 180:
                line = line[:177] + "..."
            return RadioResponse(line=line, source="ai")
    except Exception as e:
        logger.warning(f"LLM radio failed, using scripted: {e}")

    return RadioResponse(line=random.choice(SCRIPTED_LINES[phase]), source="scripted")


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
