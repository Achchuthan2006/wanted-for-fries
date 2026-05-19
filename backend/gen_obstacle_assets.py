"""Generate clean transparent obstacle/collectible sprites for the game.

Generates top-down arcade-style PNGs with a pure-white background, then
chroma-keys the white out so each sprite has a real transparent background.
"""
import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

OUT_DIR = Path("/app/frontend/public")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = "gemini-3.1-flash-image-preview"

COMMON = (
    " IMPORTANT BACKGROUND RULES: "
    "1) The background MUST be pure, uniform, solid WHITE #FFFFFF. "
    "2) DO NOT draw any checkered/transparency-indicator pattern. "
    "3) DO NOT draw any road, asphalt, scenery, sky, gradient, or shadow plate. "
    "4) The object must NOT cast any shadow on the white background. "
    "Single object only, centered, no labels, no captions, no text. "
    "Stylized mobile-arcade aesthetic, clean bold cartoon outlines, vivid saturated colors, flat cel shading."
)

PROMPTS = {
    "police_car": (
        "Top-down view of a chubby cartoon POLICE CAR for a Subway-Surfers-style mobile arcade game. "
        "Black and white classic police paint (white body, black hood and doors), with two glowing roof lights "
        "(one bright red, one bright blue) on top, a small chrome push-bumper at the front, "
        "tinted windshield with a tiny silhouette of a frustrated officer, and visible 'POLICE' star badge on the hood. "
        "Mario-Kart proportions, slight perspective so the car points UP (front of car facing top of image). "
        "Glossy paint highlights, no road, no shadow." + COMMON
    ),
    "civilian_car": (
        "Top-down view of a chubby cartoon CIVILIAN SEDAN for a Subway-Surfers-style mobile arcade game. "
        "Bright teal blue paint, tinted windshield, four little rounded wheels visible, "
        "tiny rear-view mirror details, small white roof. "
        "Mario-Kart proportions, slight perspective so the car points DOWN (front of car facing bottom of image, "
        "as if oncoming traffic on the road). Glossy paint highlights." + COMMON
    ),
    "cone": (
        "Top-down 3/4 perspective view of a SINGLE TRAFFIC CONE for an arcade game. "
        "Bright orange with two reflective white horizontal stripes, sitting on a black square base. "
        "Glossy stylized cartoon shading. Just the cone, centered." + COMMON
    ),
    "barrier": (
        "Top-down 3/4 perspective view of a SHORT WIDE CONSTRUCTION BARRIER for an arcade game. "
        "Wide rectangular wooden plank barrier painted with bold yellow and black diagonal hazard stripes, "
        "two small reflective amber lamps on the top edge, "
        "two stubby grey supports at each end. Cartoon proportions, glossy highlights." + COMMON
    ),
    "fry": (
        "Top-down 3/4 perspective view of a SINGLE McDonald's-style FRIES CARTON for an arcade game. "
        "Iconic red rectangular carton with a bold golden-yellow 'M' arches logo on the front, "
        "stuffed full of bright golden-yellow french fries sticking up out of the top, "
        "fries have a subtle warm glow. Glossy stylized cartoon shading, chubby cartoon proportions, "
        "centered, single carton only." + COMMON
    ),
}


def chroma_key_white(path: Path, tolerance: int = 16):
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= 255 - tolerance and g >= 255 - tolerance and b >= 255 - tolerance:
                pixels[x, y] = (r, g, b, 0)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path, "PNG", optimize=True)


async def gen_one(name: str, prompt: str):
    chat = LlmChat(
        api_key=API_KEY,
        session_id=f"wff-obs-{name}",
        system_message="You are a professional arcade mobile-game illustrator. Always output a single high-quality PNG.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    msg = UserMessage(text=prompt)
    print(f"-> {name}")
    text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        print(f"   no image. text={text[:120] if text else ''}")
        return False
    out = OUT_DIR / f"{name}.png"
    out.write_bytes(base64.b64decode(images[0]["data"]))
    print(f"   wrote {out} ({out.stat().st_size}). chroma-keying...")
    chroma_key_white(out, tolerance=14)
    print(f"   ready ({out.stat().st_size} bytes)")
    return True


async def main():
    for name, prompt in PROMPTS.items():
        try:
            await gen_one(name, prompt)
        except Exception as e:
            print(f"!! {name} failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
