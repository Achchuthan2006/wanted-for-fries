"""Regenerate Angel assets with solid pure-white background, then chroma-key
out the white pixels using Pillow to produce real transparent PNGs.
"""
import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from PIL import Image
import io

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

REF_PATH = Path("/app/frontend/public/_angel_ref.png")
OUT_DIR = Path("/app/frontend/public")

API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = "gemini-3.1-flash-image-preview"


# Tighter prompts: solid white background that we will chroma-key
COMMON = (
    "IMPORTANT BACKGROUND RULES: "
    "1) The background MUST be pure, uniform, solid WHITE #FFFFFF. "
    "2) DO NOT draw any checkered/transparency-indicator pattern. "
    "3) DO NOT draw any sky, room, shadow plate, gradient or scenery. "
    "4) The character must NOT cast any shadow on the white background. "
    "Only the character on flat pure white. The white background will be removed in post-processing."
)

PROMPTS = {
    "angel_portrait": (
        "Use the person in the reference image as a character design reference. "
        "Stylized arcade-cartoon character portrait of her: "
        "long flowing dark brown hair, light grey beanie, oversized soft grey hoodie, "
        "tan/brown skin, big expressive smile with tongue out playfully, "
        "huge sparkly eyes, cute exaggerated proportions, bouncy chaotic-cheerful energy, "
        "throwing a peace-sign hand near her face. "
        "Bright vivid arcade colors, clean bold outlines, flat cel shading, "
        "modern stylized mobile-game aesthetic (Subway Surfers / Sky Streaker vibe). "
        "Front-facing 3/4 portrait, single character, centered. "
        + COMMON
    ),
    "angel_panic": (
        "Stylized arcade-cartoon version of the reference character: "
        "long dark hair flowing wildly, grey beanie tilted, oversized grey hoodie, tan skin. "
        "COMEDIC PANIC FACE: wide circular shocked eyes with tiny pupils, "
        "open mouth in a dramatic 'AAAH', both hands raised in panic. "
        "Cute funny exaggerated reaction. Sweat drop above forehead. "
        "Clean bold outlines, flat cel shading. Front-facing portrait, centered. "
        + COMMON
    ),
    "angel_excited": (
        "Stylized arcade-cartoon version of the reference character: "
        "long dark hair, grey beanie, oversized grey hoodie, tan skin. "
        "SUPER-EXCITED CELEBRATION FACE: huge star-shaped sparkly eyes, "
        "giant toothy grin, both hands raised holding a fries box overhead, "
        "celebratory leap pose, cartoon sparkles around her head. "
        "Clean bold outlines, flat cel shading. Front-facing portrait, centered. "
        + COMMON
    ),
    "angel_car": (
        "Top-down arcade-cartoon view of a compact sporty car designed for the "
        "reference character (a chaotic-cheerful young woman who loves fries). "
        "Cherry red body with golden-yellow racing stripes. "
        "Mario-Kart-style chubby proportions. Sunroof showing a tiny "
        "stylized driver with long dark hair and a grey beanie peeking up waving. "
        "Through tinted windows you can faintly see scattered fry boxes, a "
        "dangling fries-shaped air freshener, loose ketchup packets, and a fuzzy "
        "steering-wheel cover. Glossy paint highlights, neon underglow tint. "
        "Clean cartoon outlines. Centered, single car only, no road. "
        + COMMON
    ),
}


def chroma_key_white(path: Path, tolerance: int = 18):
    """Make near-white pixels transparent. tolerance: 0-255 distance from #FFFFFF."""
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # near-white?
            if r >= 255 - tolerance and g >= 255 - tolerance and b >= 255 - tolerance:
                pixels[x, y] = (r, g, b, 0)
    # crop alpha bbox to remove empty border
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path, "PNG", optimize=True)


async def gen_one(name: str, prompt: str):
    chat = LlmChat(
        api_key=API_KEY,
        session_id=f"wff2-{name}",
        system_message="You are a professional arcade mobile-game illustrator. Always output a single high-quality PNG.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    with open(REF_PATH, "rb") as f:
        ref_b64 = base64.b64encode(f.read()).decode("utf-8")
    msg = UserMessage(text=prompt, file_contents=[ImageContent(ref_b64)])
    print(f"-> {name}")
    text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        print(f"   no image. text={text[:120] if text else ''}")
        return False
    out = OUT_DIR / f"{name}.png"
    out.write_bytes(base64.b64decode(images[0]["data"]))
    print(f"   wrote {out} ({out.stat().st_size}). chroma-keying...")
    chroma_key_white(out, tolerance=14)
    print(f"   transparent PNG ready ({out.stat().st_size} bytes)")
    return True


async def main():
    for name, prompt in PROMPTS.items():
        try:
            await gen_one(name, prompt)
        except Exception as e:
            print(f"!! {name} failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
