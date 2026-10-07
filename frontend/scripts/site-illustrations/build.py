"""Regenerate the marketing-site illustrations: `python scripts/site-illustrations/build.py` (from frontend/).

Writes public/images/site/product/*.svg and public/images/site/industries/*.svg — original artwork, no third-party images.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from draw import FRONTEND  # noqa: E402
from industries import INDUSTRIES  # noqa: E402
from product import PRODUCT  # noqa: E402

OUT = FRONTEND / "public" / "images" / "site"

for folder, scenes in (("product", PRODUCT), ("industries", INDUSTRIES)):
    d = OUT / folder
    d.mkdir(parents=True, exist_ok=True)
    for name, fn in scenes.items():
        (d / f"{name}.svg").write_text(fn().render(), encoding="utf-8")
        print(f"{folder}/{name}.svg")
