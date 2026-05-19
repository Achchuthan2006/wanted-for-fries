"""Generate one additional Angel expression: determined."""
import asyncio, base64, os
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from PIL import Image

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
REF = Path("/app/frontend/public/_angel_ref.png")
OUT = Path("/app/frontend/public/angel_determined.png")

API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = "gemini-3.1-flash-image-preview"

PROMPT = (
    "Stylized arcade-cartoon version of the reference character: "
    "long dark hair flowing back from speed, grey beanie tilted slightly, "
    "oversized grey hoodie. Tan skin. DETERMINED CHASE FACE: confident smirk, "
    "narrowed sharp eyes with intense fire in them, eyebrows down in focus, "
    "one fist raised in pop-art 'let's GO' pose. Speed lines behind her, "
    "small flames flicking off her hair. Clean bold outlines, flat cel shading, "
    "vivid arcade colors. Front-facing portrait, centered. "
    "Background MUST be solid pure WHITE #FFFFFF. No checkered pattern. "
    "No scenery, no shadow plate. Will be chroma-keyed."
)


def chroma_key_white(path, tol=14):
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= 255 - tol and g >= 255 - tol and b >= 255 - tol:
                px[x, y] = (r, g, b, 0)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path, "PNG", optimize=True)


async def main():
    chat = LlmChat(
        api_key=API_KEY,
        session_id="wff-determined",
        system_message="Pro arcade mobile-game illustrator.",
    ).with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    with open(REF, "rb") as f:
        ref_b64 = base64.b64encode(f.read()).decode()
    msg = UserMessage(text=PROMPT, file_contents=[ImageContent(ref_b64)])
    text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        print("FAILED:", text)
        return
    OUT.write_bytes(base64.b64decode(images[0]["data"]))
    chroma_key_white(OUT)
    print(f"saved {OUT} ({OUT.stat().st_size})")


asyncio.run(main())
