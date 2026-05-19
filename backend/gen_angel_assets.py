"""One-time asset generation for Wanted for Fries.
Generates cartoon Angel character + Angel's car using Gemini Nano Banana
with the user's reference photo. Saves PNGs to /app/frontend/public/.
"""
import asyncio
import base64
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

REF_PATH = Path("/app/frontend/public/_angel_ref.png")
OUT_DIR = Path("/app/frontend/public")
OUT_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = "gemini-3.1-flash-image-preview"


async def gen(name: str, prompt: str, with_ref: bool = True) -> bool:
    chat = LlmChat(
        api_key=API_KEY,
        session_id=f"wff-{name}",
        system_message="You are a top-tier cartoon mobile-game illustrator. Always output a single clean PNG.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])

    file_contents = []
    if with_ref:
        with open(REF_PATH, "rb") as f:
            ref_b64 = base64.b64encode(f.read()).decode("utf-8")
        file_contents.append(ImageContent(ref_b64))

    msg = UserMessage(text=prompt, file_contents=file_contents)
    print(f"-> Generating {name}...")
    try:
        text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        print(f"   FAILED: {e}")
        return False
    if not images:
        print(f"   No images returned. Text: {(text or '')[:120]}")
        return False
    out = OUT_DIR / f"{name}.png"
    out.write_bytes(base64.b64decode(images[0]["data"]))
    print(f"   saved {out} ({out.stat().st_size} bytes)")
    return True


PROMPTS = {
    "angel_portrait": (
        "Use the person in the reference image as a character design reference. "
        "Create a STYLIZED ARCADE-CARTOON character portrait of her: "
        "long flowing dark brown hair, light grey beanie, oversized soft grey hoodie, "
        "tan/brown skin, big expressive smile with tongue out playfully, "
        "huge sparkly eyes, cute exaggerated proportions, big head small shoulders, "
        "bouncy chaotic-cheerful energy, throwing a peace-sign hand near her face. "
        "Bright vivid arcade colors, clean bold outlines, flat shading with subtle cel highlights, "
        "modern stylized mobile-game aesthetic similar to Subway Surfers / Sky Streaker. "
        "Front-facing 3/4 portrait, transparent background, no logos, no text. "
        "Single character only, centered, with a soft glow rim light around her hair."
    ),
    "angel_panic": (
        "Same stylized arcade-cartoon character as the reference: long dark hair, "
        "grey beanie, oversized grey hoodie, tan skin. But now with a COMEDIC PANIC face: "
        "wide circular shocked eyes, tiny pupils, open mouth in a dramatic 'AAAH', "
        "both hands raised. Cute funny exaggerated reaction. "
        "Clean bold outlines, flat cartoon shading, transparent background. "
        "Front-facing portrait, no text, no background elements."
    ),
    "angel_excited": (
        "Same stylized arcade-cartoon character as reference: long dark hair, "
        "grey beanie, oversized grey hoodie, tan skin. Now with a SUPER-EXCITED face: "
        "huge sparkly star-shaped eyes, giant toothy grin, both hands holding fries 🍟 in the air, "
        "celebratory pose. Confetti sparkles around her. "
        "Clean bold outlines, flat cartoon shading, transparent background, no text."
    ),
    "angel_car": (
        "Top-down view of a compact sporty arcade-cartoon car designed for the "
        "character in the reference image (a chaotic-cheerful young woman who loves fries). "
        "The car is bright cherry red with golden-yellow stripes. "
        "Slightly chubby/exaggerated proportions like Mario Kart or Subway Surfers. "
        "Roof has a sunroof showing a tiny stylized cartoon driver with long dark hair "
        "and a grey beanie peeking up. "
        "Through tinted windows you can faintly see scattered FRY BOXES, a dangling fries-shaped air freshener, "
        "loose ketchup packets, a fuzzy steering-wheel cover, and a Happy-Meal-style toy on the dash. "
        "Glossy paint highlights, neon underglow tint, clean cartoon outlines, "
        "soft shadow underneath. Pure transparent background. PNG. "
        "Centered, no other vehicles, no text, no logos, no road. Just the car asset."
    ),
}


async def main():
    for name, prompt in PROMPTS.items():
        ok = await gen(name, prompt, with_ref=True)
        if not ok:
            print(f"!! {name} skipped")


if __name__ == "__main__":
    asyncio.run(main())
