#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ALV — Aided Line Vision engine.

Design notes (why this file exists)
===================================
A vision model looks at a picture, not at a coordinate system.  When the task is
"which row of this table is wrong", "where exactly does this line end", "read the
part number printed at (x=1130, y=740)", the model needs *scaffolding*: crop,
grid, ruler, guide lines, edge positions.  ALV builds that scaffolding
deterministically (pure geometry, no ML) and hands the model

  * a JSON geometry description it can reason about, plus
  * a rendered copy of the image carrying the scaffolding it asked for.

Almost everything here is "hardcoded": the caller states the coordinates or the
thresholds, ALV draws/measures exactly that.  The only ML-ish step is OCR, and
even that is delegated to the OS engine (Windows.Media.Ocr) so results are
reproducible and offline.

Protocol
========
stdin : one JSON object  {"op": "<name>", "args": {...}}
stdout: exactly one JSON line {"ok": true, ...} or {"ok": false, "error": "..."}

Runs on the python312 environment shipped with DLT/DET (Pillow + numpy + cv2).
"""

from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
import tempfile
import traceback

# ─── optional deps: degrade with a clear message instead of a stack trace ──────
try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
except Exception as exc:  # pragma: no cover - environment guard
    print(json.dumps({"ok": False, "error": "Pillow 不可用: %s" % exc}))
    sys.exit(0)

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None

try:
    import cv2
except Exception:
    cv2 = None


HERE = os.path.dirname(os.path.abspath(__file__))
OCR_PS1 = os.path.join(HERE, "alv_ocr.ps1")


# ═════════════════════════════════════════════════════════════════════════════
# helpers
# ═════════════════════════════════════════════════════════════════════════════


def fail(message: str) -> dict:
    return {"ok": False, "error": str(message)}


def clamp(value, low, high):
    return max(low, min(high, value))


def as_int(value, default=0):
    try:
        return int(round(float(value)))
    except Exception:
        return default


def as_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def load_image(path: str) -> "Image.Image":
    if not path:
        raise ValueError("缺少图片路径")
    if not os.path.exists(path):
        raise ValueError("图片不存在: %s" % path)
    img = Image.open(path)
    img.load()
    return img


def ensure_dir(path: str) -> str:
    if path:
        os.makedirs(path, exist_ok=True)
    return path


def out_path(args: dict, source: str, suffix: str) -> str:
    """Resolve the output file: explicit `out`, else cache dir with a stable name."""
    explicit = str(args.get("out") or "").strip()
    if explicit:
        ensure_dir(os.path.dirname(os.path.abspath(explicit)))
        return explicit
    cache = str(args.get("cacheDir") or "").strip()
    if not cache:
        cache = os.path.join(tempfile.gettempdir(), "dsh-alv")
    ensure_dir(cache)
    stem = os.path.splitext(os.path.basename(source))[0] or "image"
    stem = "".join(ch for ch in stem if ch.isalnum() or ch in "-_")[:60] or "image"
    return os.path.join(cache, "%s.%s.png" % (stem, suffix))


def font_of(size: int):
    """A font that actually has CJK glyphs, falling back to the bitmap default."""
    for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default()
    except Exception:  # pragma: no cover
        return None


def text_size(draw, text, font):
    try:
        box = draw.textbbox((0, 0), text, font=font)
        return box[2] - box[0], box[3] - box[1]
    except Exception:
        return (len(str(text)) * 6, 12)


def parse_box(box):
    """Accept [x, y, w, h] or [x0, y0, x1, y1] or "x,y,w,h" / {x,y,w,h}."""
    if box is None:
        return None
    if isinstance(box, str):
        parts = [p for p in box.replace("，", ",").split(",") if p.strip() != ""]
        box = [as_float(p) for p in parts]
    if isinstance(box, dict):
        return (
            as_int(box.get("x", box.get("x0", 0))),
            as_int(box.get("y", box.get("y0", 0))),
            as_int(box.get("w", 0), 0),
            as_int(box.get("h", 0), 0),
        )
    if not isinstance(box, (list, tuple)) or len(box) < 4:
        return None
    x, y, a, b = (as_float(v) for v in box[:4])
    w, h = a, b
    if bool(box[4]) if len(box) > 4 else False:
        w = a - x
        h = b - y
    return (as_int(x), as_int(y), max(1, as_int(w, 1)), max(1, as_int(h, 1)))


def to_gray_np(img: "Image.Image"):
    if np is None:
        raise RuntimeError("缺少 numpy，无法做像素分析")
    return np.asarray(img.convert("L"), dtype=np.uint8)


def image_summary(img: "Image.Image") -> dict:
    gray = to_gray_np(img) if np is not None else None
    out = {
        "width": img.size[0],
        "height": img.size[1],
        "mode": img.mode,
        "format": img.format or "PNG",
        "dpi": list(img.info.get("dpi", ())) or None,
    }
    if gray is not None:
        out["mean"] = round(float(gray.mean()), 2)
        out["std"] = round(float(gray.std()), 2)
        # share of near-black pixels: a cheap "is this a scanned/inked page?" test
        out["darkRatio"] = round(float((gray < 96).mean()), 4)
        # a 16-bin histogram is enough for exposure triage and costs nothing
        hist, _ = np.histogram(gray, bins=16, range=(0, 256))
        out["histogram"] = [int(v) for v in hist]
    return out


# ═════════════════════════════════════════════════════════════════════════════
# op: info
# ═════════════════════════════════════════════════════════════════════════════


def op_info(args: dict) -> dict:
    img = load_image(args.get("path"))
    info = image_summary(img)
    if np is not None and bool(args.get("noise", False)):
        gray = to_gray_np(img)
        # noise estimate: median absolute deviation of the laplacian
        lap = np.abs(np.gradient(np.gradient(gray.astype(np.float32), axis=0), axis=1))
        info["noise"] = round(float(np.median(lap)), 3)
    return {"ok": True, "path": os.path.abspath(str(args.get("path"))), **info}


# ═════════════════════════════════════════════════════════════════════════════
# op: crop  (also used as the "zoom into the interesting region" primitive)
# ═════════════════════════════════════════════════════════════════════════════


def op_crop(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src)
    box = parse_box(args.get("box"))
    pad = as_int(args.get("pad", 0), 0)
    if box is None:
        # auto: trim uniform borders (screenshots of dialogs, scans on white paper)
        gray = to_gray_np(img)
        bg = int(np.median(gray))
        mask = np.abs(gray.astype(np.int16) - bg) > as_int(args.get("threshold", 12), 12)
        rows = np.where(mask.any(axis=1))[0]
        cols = np.where(mask.any(axis=0))[0]
        if len(rows) and len(cols):
            box = (int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1))
        else:
            box = (0, 0, img.size[0], img.size[1])
    x, y, w, h = box
    x = clamp(x - pad, 0, img.size[0])
    y = clamp(y - pad, 0, img.size[1])
    w = clamp(w + pad * 2, 1, img.size[0] - x)
    h = clamp(h + pad * 2, 1, img.size[1] - y)
    crop = img.crop((x, y, x + w, y + h))
    scale = as_float(args.get("scale", 1.0), 1.0)
    if scale and abs(scale - 1.0) > 1e-3:
        crop = crop.resize(
            (max(1, int(crop.size[0] * scale)), max(1, int(crop.size[1] * scale))),
            Image.LANCZOS,
        )
    dest = out_path(args, src, "crop")
    if str(dest).lower().endswith((".jpg", ".jpeg")):
        crop.convert("RGB").save(dest, quality=as_int(args.get("quality", 92), 92))
    else:
        crop.save(dest)
    return {
        "ok": True,
        "out": os.path.abspath(dest),
        "box": [x, y, w, h],
        "sourceSize": list(img.size),
        "outSize": list(crop.size),
        "scale": scale,
        # how to map a coordinate seen in the crop back onto the original:
        "toSource": {"x": x, "y": y, "scale": scale},
    }


# ═════════════════════════════════════════════════════════════════════════════
# op: grid  (rulers + guide lines: THE coordinate scaffold)
# ═════════════════════════════════════════════════════════════════════════════


def op_grid(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src).convert("RGB")
    cell = max(4, as_int(args.get("cell", 64), 64))
    major = max(1, as_int(args.get("majorEvery", 5), 5))
    color = str(args.get("color") or "#ff3b30")
    major_color = str(args.get("majorColor") or "#0a84ff")
    width = max(1, as_int(args.get("width", 1), 1))
    margin = max(0, as_int(args.get("margin", 26), 26)) if bool(args.get("labels", True)) else 0

    w, h = img.size
    canvas = Image.new("RGB", (w + margin, h + margin), (255, 255, 255))
    canvas.paste(img, (margin, margin))
    draw = ImageDraw.Draw(canvas)
    font = font_of(max(9, min(14, margin - 8)))

    xs, ys = [], []
    x = 0
    while x <= w:
        xs.append(x)
        x += cell
    y = 0
    while y <= h:
        ys.append(y)
        y += cell

    for i, x in enumerate(xs):
        is_major = (i % major) == 0
        cx = margin + x
        draw.line([(cx, margin), (cx, margin + h)], fill=major_color if is_major else color,
                  width=width + (1 if is_major else 0))
        if margin:
            label = str(x)
            tw, th = text_size(draw, label, font)
            draw.text((cx - tw / 2, max(0, margin - th - 2)), label, fill=major_color if is_major else (90, 90, 90), font=font)
    for j, y in enumerate(ys):
        is_major = (j % major) == 0
        cy = margin + y
        draw.line([(margin, cy), (margin + w, cy)], fill=major_color if is_major else color,
                  width=width + (1 if is_major else 0))
        if margin:
            label = str(y)
            tw, th = text_size(draw, label, font)
            draw.text((max(0, margin - tw - 3), cy - th / 2), label, fill=major_color if is_major else (90, 90, 90), font=font)

    # explicit guide lines: {"vertical":[x...], "horizontal":[y...]} — "辅助线"
    guides = args.get("guides") or {}
    guide_color = str(args.get("guideColor") or "#00b894")
    drawn = {"vertical": [], "horizontal": []}
    for gx in (guides.get("vertical") or []):
        g = as_int(gx, -1)
        if 0 <= g <= w:
            draw.line([(margin + g, margin), (margin + g, margin + h)], fill=guide_color, width=max(2, width + 1))
            drawn["vertical"].append(g)
    for gy in (guides.get("horizontal") or []):
        g = as_int(gy, -1)
        if 0 <= g <= h:
            draw.line([(margin, margin + g), (margin + w, margin + g)], fill=guide_color, width=max(2, width + 1))
            drawn["horizontal"].append(g)

    dest = out_path(args, src, "grid")
    canvas.save(dest)
    return {
        "ok": True,
        "out": os.path.abspath(dest),
        "cell": cell,
        "margin": margin,
        "columns": xs,
        "rows": ys,
        "count": {"cols": len(xs), "rows": len(ys)},
        "guidesDrawn": drawn,
        # coordinate transform for anything measured on the gridded copy
        "toSource": {"x": -margin, "y": -margin, "scale": 1.0},
        "note": "画布比原图四周各多出 margin 像素；栅格线坐标已标注在边距上。",
    }


# ═════════════════════════════════════════════════════════════════════════════
# op: edges  (hardcoded edge/line extraction → coordinates, not vibes)
# ═════════════════════════════════════════════════════════════════════════════


def op_edges(args: dict) -> dict:
    if cv2 is None or np is None:
        return fail("缺少 opencv/numpy，无法做边缘提取")
    src = str(args.get("path") or "")
    img = load_image(src)
    box = parse_box(args.get("box"))
    if box:
        x, y, w, h = box
        img = img.crop((x, y, x + w, y + h))
        origin = (x, y)
    else:
        origin = (0, 0)
    gray = to_gray_np(img)
    # upscale small images first: Canny on a 300px-wide screenshot is noise
    scale = as_float(args.get("scale", 1.0), 1.0) or 1.0
    if scale > 1.0:
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    blur = as_int(args.get("blur", 3), 3)
    if blur >= 3:
        gray = cv2.GaussianBlur(gray, (blur | 1, blur | 1), 0)

    low = as_int(args.get("low", 60), 60)
    high = as_int(args.get("high", 180), 180)
    edges = cv2.Canny(gray, low, high)
    dilate = as_int(args.get("dilate", 1), 1)
    if dilate > 0:
        edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=dilate)

    min_len = max(8, as_int(args.get("minLineLen", 60), 60))
    max_gap = max(1, as_int(args.get("maxLineGap", 4), 4))
    lines_raw = cv2.HoughLinesP(edges, 1, math.pi / 180.0, threshold=max(20, min_len // 2),
                                minLineLength=min_len, maxLineGap=max_gap)
    angle_tol = as_float(args.get("angleTol", 2.5), 2.5)
    lines = []
    if lines_raw is not None:
        for row in lines_raw[: as_int(args.get("maxLines", 400), 400)]:
            # OpenCV 4 returns (N, 1, 4), OpenCV 5 returns (N, 4) - normalise both.
            flat = np.asarray(row).reshape(-1)
            if flat.size < 4:
                continue
            x1, y1, x2, y2 = (int(v) for v in flat[:4])
            dx, dy = x2 - x1, y2 - y1
            length = math.hypot(dx, dy)
            if length < min_len:
                continue
            angle = math.degrees(math.atan2(dy, dx))
            if abs(angle) <= angle_tol:
                kind = "h"
            elif abs(abs(angle) - 90) <= angle_tol:
                kind = "v"
            else:
                kind = "d"
            lines.append({
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "len": round(length, 1), "angle": round(angle, 2), "kind": kind,
            })

    # project lines onto axes → "this table's rows sit at y = 112, 168, 224 …"
    def merge_positions(values, tol):
        values = sorted(values)
        groups = []
        for v in values:
            if groups and abs(v - groups[-1][-1]) <= tol:
                groups[-1].append(v)
            else:
                groups.append([v])
        return [(int(round(sum(g) / len(g))), len(g)) for g in groups]

    tol = as_float(args.get("mergeTol", 4), 4)
    h_lines = [l for l in lines if l["kind"] == "h"]
    v_lines = [l for l in lines if l["kind"] == "v"]
    h_pos = merge_positions([round((l["y1"] + l["y2"]) / 2 / scale) for l in h_lines], tol) if scale else []
    v_pos = merge_positions([round((l["x1"] + l["x2"]) / 2 / scale) for l in v_lines], tol) if scale else []
    if scale and scale != 1.0:
        for l in lines:
            for key in ("x1", "x2"):
                l[key] = int(round(l[key] / scale))
            for key in ("y1", "y2"):
                l[key] = int(round(l[key] / scale))
            l["len"] = round(l["len"] / scale, 1)

    # annotated copy: draw what was found so the model can eyeball the result
    out_img = load_image(src).convert("RGB")
    draw = ImageDraw.Draw(out_img)
    for l in lines:
        color = (255, 59, 48) if l["kind"] == "h" else ((10, 132, 255) if l["kind"] == "v" else (255, 159, 10))
        draw.line([(l["x1"] + origin[0], l["y1"] + origin[1]), (l["x2"] + origin[0], l["y2"] + origin[1])],
                  fill=color, width=2)
    font = font_of(12)
    for pos, votes in h_pos[: int(args.get("labelLimit", 40) or 40)]:
        draw.text((2, pos + origin[1]), "y=%d(%d)" % (pos, votes), fill=(255, 59, 48), font=font)
    for pos, votes in v_pos[: int(args.get("labelLimit", 40) or 40)]:
        draw.text((pos + origin[0], 2), "x=%d(%d)" % (pos, votes), fill=(10, 132, 255), font=font)
    dest = out_path(args, src, "edges")
    out_img.save(dest)

    return {
        "ok": True,
        "out": os.path.abspath(dest),
        "box": list(box) if box else None,
        "scale": scale,
        "counts": {"lines": len(lines), "h": len(h_lines), "v": len(v_lines),
                   "hPositions": len(h_pos), "vPositions": len(v_pos)},
        "horizontalPositions": [{"y": p, "votes": v} for p, v in h_pos],
        "verticalPositions": [{"x": p, "votes": v} for p, v in v_pos],
        "lines": lines[: as_int(args.get("maxLinesOut", 120), 120)],
        "note": "坐标已换算回原图；horizontalPositions/verticalPositions 是合并后的边线位置（votes=支持该位置的线段数）。",
    }


# ═════════════════════════════════════════════════════════════════════════════
# op: ocr  (OS engine, offline; words + boxes, optionally per grid cell)
# ═════════════════════════════════════════════════════════════════════════════


def run_windows_ocr(path: str, lang: str = "", scale: float = 1.0) -> dict:
    if not os.path.exists(OCR_PS1):
        return {"ok": False, "error": "OCR 桥不存在: %s" % OCR_PS1}
    cmd = [
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", OCR_PS1,
        "-Path", path,
        "-Lang", lang or "",
        "-Scale", str(scale),
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, timeout=90)
    except Exception as exc:
        return {"ok": False, "error": "调用 OCR 桥失败: %s" % exc}
    out = (res.stdout or b"").decode("utf-8", "replace").strip()
    err = (res.stderr or b"").decode("utf-8", "replace").strip()
    if not out:
        return {"ok": False, "error": "OCR 桥无输出（exit=%s）%s" % (res.returncode, err[:400])}
    try:
        return json.loads(out)
    except Exception:
        return {"ok": False, "error": "OCR 桥输出不是 JSON: %s" % out[:400]}


def rows_from_words(words, y_tol=0.6):
    """Group word boxes into visual lines (top→bottom, left→right)."""
    if not words:
        return []
    words = sorted(words, key=lambda w: (w["y"], w["x"]))
    rows: list[list[dict]] = []
    for word in words:
        placed = False
        for row in rows:
            ref = row[0]
            h = max(ref["h"], word["h"], 1)
            if abs((ref["y"] + ref["h"] / 2) - (word["y"] + word["h"] / 2)) <= h * y_tol:
                row.append(word)
                placed = True
                break
        if not placed:
            rows.append([word])
    out = []
    for row in rows:
        row.sort(key=lambda w: w["x"])
        text = " ".join(w["text"] for w in row).strip()
        if not text:
            continue
        x0 = min(w["x"] for w in row)
        y0 = min(w["y"] for w in row)
        x1 = max(w["x"] + w["w"] for w in row)
        y1 = max(w["y"] + w["h"] for w in row)
        out.append({"text": text, "box": [x0, y0, x1 - x0, y1 - y0], "words": len(row)})
    return out


_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")

# Full-width punctuation that OCR loves to emit inside numbers / units.
_FW_MAP = {"．": ".", "，": ",", "：": ":", "；": ";", "％": "%", "　": " ", "－": "-"}


def compact_cjk(text: str) -> str:
    """Make Windows OCR output readable without destroying English spacing.

    1. Re-join CJK runs: Windows OCR emits one "word" per glyph for Chinese
       ("型 号 数 量"), so collapse spaces that sit *between two CJK chars* -
       that rule can never damage an English word, so no ratio gate is needed.
    2. Normalise full-width punctuation, then remove the spaces OCR inserts
       around decimal points ("41 ． 00" -> "41.00").
    """
    text = str(text or "")
    if not text:
        return text
    for _ in range(4):  # collapse repeatedly: "a b c" -> "abc"
        text = re.sub(r"(?<=[\u3400-\u9fff\uf900-\ufaff]) +(?=[\u3400-\u9fff\uf900-\ufaff])", "", text)
    text = re.sub(r" +(?=[，。、；：？！」』）】》,.;:!?)\]}])", "", text)
    text = re.sub(r"(?<=[（【「『《]) +", "", text)
    for src, dst in _FW_MAP.items():
        text = text.replace(src, dst)
    text = re.sub(r"(?<=\d) +(?=[.,%])", "", text)
    text = re.sub(r"(?<=[.,%]) +(?=\d)", "", text)
    return text.strip()


def op_ocr(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src)
    box = parse_box(args.get("box"))
    langs = str(args.get("lang") or "").strip()
    scale = as_float(args.get("scale", 0.0), 0.0)
    mode = str(args.get("mode") or "lines").strip()

    if mode == "cells":
        # grid-aware OCR: the caller supplies cell rectangles (or a uniform grid)
        rects = []
        cells = args.get("cells")
        if isinstance(cells, list) and cells:
            for c in cells:
                b = parse_box(c)
                if b:
                    rects.append(b)
        else:
            x0, y0, w, h = box or (0, 0, img.size[0], img.size[1])
            cols = max(1, as_int(args.get("cols", 1), 1))
            rows_n = max(1, as_int(args.get("rows", 1), 1))
            cw, ch = w / cols, h / rows_n
            for r in range(rows_n):
                for c in range(cols):
                    rects.append((int(x0 + c * cw), int(y0 + r * ch), int(cw), int(ch)))
        table, details = [], []
        for idx, (x, y, w, h) in enumerate(rects):
            pad = as_int(args.get("pad", 4), 4)
            crop = img.crop((max(0, x - pad), max(0, y - pad),
                             min(img.size[0], x + w + pad), min(img.size[1], y + h + pad)))
            if crop.size[0] < 8 or crop.size[1] < 8:
                table.append("")
                details.append({"box": [x, y, w, h], "text": "", "skipped": "too small"})
                continue
            tmp = os.path.join(tempfile.gettempdir(), "dsh-alv-ocr-%d.png" % idx)
            crop.save(tmp)
            cell_scale = scale if scale > 0 else clamp(160.0 / max(1, crop.size[1]), 1.0, 4.0)
            res = run_windows_ocr(tmp, langs, cell_scale)
            try:
                os.remove(tmp)
            except OSError:
                pass
            text = ""
            if res.get("ok"):
                text = str(res.get("text") or "").replace("\r", " ").replace("\n", " ").strip()
                if args.get("compactCjk", True) is not False:
                    text = compact_cjk(text)
            table.append(text)
            details.append({"box": [x, y, w, h], "text": text,
                            "words": (res.get("words") or [])[:12] if res.get("ok") else None,
                            "error": None if res.get("ok") else res.get("error")})
        cols_n = max(1, as_int(args.get("cols", 1), 1))
        matrix = [table[i:i + cols_n] for i in range(0, len(table), cols_n)]
        return {"ok": True, "mode": "cells", "cols": cols_n, "matrix": matrix,
                "flat": table, "cells": details,
                "note": "每格单独 OCR（内边距 + 自动放大）；空串表示该格没识别到文字。"}

    # whole-image / region OCR
    target = img
    origin = (0, 0)
    if box:
        x, y, w, h = box
        target = img.crop((x, y, x + w, y + h))
        origin = (x, y)
    auto_scale = scale if scale > 0 else clamp(1200.0 / max(1, target.size[0]), 1.0, 3.0)
    tmp = os.path.join(tempfile.gettempdir(), "dsh-alv-ocr-full.png")
    target.save(tmp)
    res = run_windows_ocr(tmp, langs, auto_scale)
    try:
        os.remove(tmp)
    except OSError:
        pass
    if not res.get("ok"):
        return {"ok": False, "error": res.get("error") or "OCR 失败"}

    used_scale = as_float(res.get("scale", auto_scale), auto_scale) or 1.0
    words = []
    for w in res.get("words") or []:
        try:
            words.append({
                "text": str(w.get("text") or ""),
                "x": int(round(float(w.get("x", 0)) / used_scale)) + origin[0],
                "y": int(round(float(w.get("y", 0)) / used_scale)) + origin[1],
                "w": int(round(float(w.get("w", 0)) / used_scale)),
                "h": int(round(float(w.get("h", 0)) / used_scale)),
            })
        except Exception:
            continue
    lines = rows_from_words(words, as_float(args.get("rowTol", 0.6), 0.6))
    if args.get("compactCjk", True) is not False:
        for line in lines:
            line["text"] = compact_cjk(line["text"])
    text = "\n".join(l["text"] for l in lines) if lines else str(res.get("text") or "")
    payload = {
        "ok": True,
        "mode": "lines",
        "lang": res.get("lang") or langs or None,
        "scale": used_scale,
        "box": list(box) if box else None,
        "text": text,
        "lines": lines[: int(args.get("maxLinesOut", 400) or 400)],
        "wordCount": len(words),
    }
    if bool(args.get("annotate", False)):
        out_img = img.convert("RGB")
        draw = ImageDraw.Draw(out_img)
        font = font_of(11)
        for w in words:
            draw.rectangle([w["x"], w["y"], w["x"] + w["w"], w["y"] + w["h"]], outline=(0, 122, 255), width=1)
        for l in lines:
            x, y, w, h = l["box"]
            draw.rectangle([x, y, x + w, y + h], outline=(255, 149, 0), width=2)
            draw.text((x, max(0, y - 13)), l["text"][:40], fill=(255, 59, 48), font=font)
        dest = out_path(args, src, "ocr")
        out_img.save(dest)
        payload["out"] = os.path.abspath(dest)
    return payload


# ═════════════════════════════════════════════════════════════════════════════
# op: tile  (feed a big image to a vision model in legible pieces)
# ═════════════════════════════════════════════════════════════════════════════


def op_tile(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src)
    cols = max(1, as_int(args.get("cols", 2), 2))
    rows_n = max(1, as_int(args.get("rows", 2), 2))
    overlap = clamp(as_int(args.get("overlap", 24), 24), 0, 400)
    scale = as_float(args.get("scale", 1.0), 1.0) or 1.0
    w, h = img.size
    tw, th = w / cols, h / rows_n
    tiles = []
    for r in range(rows_n):
        for c in range(cols):
            x0 = max(0, int(c * tw) - overlap)
            y0 = max(0, int(r * th) - overlap)
            x1 = min(w, int((c + 1) * tw) + overlap)
            y1 = min(h, int((r + 1) * th) + overlap)
            piece = img.crop((x0, y0, x1, y1))
            if abs(scale - 1.0) > 1e-3:
                piece = piece.resize((max(1, int(piece.size[0] * scale)), max(1, int(piece.size[1] * scale))),
                                     Image.LANCZOS)
            dest = out_path(args, src, "tile-r%dc%d" % (r + 1, c + 1))
            piece.save(dest)
            tiles.append({"row": r + 1, "col": c + 1, "box": [x0, y0, x1 - x0, y1 - y0],
                          "out": os.path.abspath(dest), "size": list(piece.size)})
    return {"ok": True, "cols": cols, "rows": rows_n, "overlap": overlap, "scale": scale,
            "sourceSize": [w, h], "tiles": tiles}


# ═════════════════════════════════════════════════════════════════════════════
# op: annotate  (deterministic drawing the caller specifies coordinate by coordinate)
# ═════════════════════════════════════════════════════════════════════════════


def op_annotate(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src).convert("RGB")
    draw = ImageDraw.Draw(img)
    default_color = str(args.get("color") or "#ff3b30")
    width = max(1, as_int(args.get("width", 2), 2))
    font = font_of(as_int(args.get("fontSize", 14), 14))
    drawn = 0
    for item in (args.get("ops") or []):
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "box")
        color = str(item.get("color") or default_color)
        w = max(1, as_int(item.get("width", width), width))
        if kind == "box":
            b = parse_box(item.get("box"))
            if not b:
                continue
            x, y, bw, bh = b
            draw.rectangle([x, y, x + bw, y + bh], outline=color, width=w)
            label = item.get("label")
            if label:
                tw, th = text_size(draw, str(label), font)
                draw.rectangle([x, max(0, y - th - 4), x + tw + 6, y], fill=color)
                draw.text((x + 3, max(0, y - th - 3)), str(label), fill=(255, 255, 255), font=font)
        elif kind == "line":
            draw.line([(as_int(item.get("x1")), as_int(item.get("y1"))),
                       (as_int(item.get("x2")), as_int(item.get("y2")))], fill=color, width=w)
            label = item.get("label")
            if label:
                draw.text((as_int(item.get("x1")) + 4, as_int(item.get("y1")) - 16), str(label), fill=color, font=font)
        elif kind == "arrow":
            x1, y1 = as_int(item.get("x1")), as_int(item.get("y1"))
            x2, y2 = as_int(item.get("x2")), as_int(item.get("y2"))
            draw.line([(x1, y1), (x2, y2)], fill=color, width=w)
            ang = math.atan2(y2 - y1, x2 - x1)
            size = max(8, w * 5)
            for delta in (math.radians(155), math.radians(-155)):
                draw.line([(x2, y2), (x2 + size * math.cos(ang + delta), y2 + size * math.sin(ang + delta))],
                          fill=color, width=w)
        elif kind == "cross":
            cx, cy = as_int(item.get("x")), as_int(item.get("y"))
            rad = max(3, as_int(item.get("r", 8), 8))
            draw.line([(cx - rad, cy), (cx + rad, cy)], fill=color, width=w)
            draw.line([(cx, cy - rad), (cx, cy + rad)], fill=color, width=w)
            label = item.get("label")
            if label:
                draw.text((cx + rad + 3, cy - rad), str(label), fill=color, font=font)
        elif kind == "text":
            draw.text((as_int(item.get("x")), as_int(item.get("y"))), str(item.get("text") or ""),
                      fill=color, font=font)
        elif kind == "circle":
            cx, cy = as_int(item.get("x")), as_int(item.get("y"))
            rr = max(2, as_int(item.get("r", 20), 20))
            draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=color, width=w)
        else:
            continue
        drawn += 1
    dest = out_path(args, src, "anno")
    img.save(dest)
    return {"ok": True, "out": os.path.abspath(dest), "drawn": drawn, "size": list(img.size)}


# ═════════════════════════════════════════════════════════════════════════════
# op: enhance  (make a legible crop out of a bad one)
# ═════════════════════════════════════════════════════════════════════════════


def op_enhance(args: dict) -> dict:
    src = str(args.get("path") or "")
    img = load_image(src)
    box = parse_box(args.get("box"))
    if box:
        x, y, w, h = box
        img = img.crop((x, y, x + w, y + h))
    mode = str(args.get("mode") or "auto")
    scale = as_float(args.get("scale", 2.0), 2.0)
    gray = img.convert("L")
    steps = []
    if mode in ("auto", "gray"):
        img = gray.convert("RGB")
        steps.append("gray")
    if mode in ("auto", "contrast"):
        img = ImageOps.autocontrast(img, cutoff=as_int(args.get("cutoff", 1), 1))
        steps.append("autocontrast")
    if mode in ("auto", "binarize"):
        if np is not None:
            arr = np.asarray(img.convert("L"), dtype=np.uint8)
            if cv2 is not None:
                block = as_int(args.get("block", 31), 31) | 1
                arr = cv2.adaptiveThreshold(arr, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                            cv2.THRESH_BINARY, max(3, block), as_int(args.get("c", 10), 10))
            else:  # fallback: global Otsu-ish threshold at the mean
                arr = ((arr > arr.mean()) * 255).astype(np.uint8)
            img = Image.fromarray(arr).convert("RGB")
            steps.append("adaptiveThreshold")
    if mode in ("auto", "sharpen"):
        img = img.filter(ImageFilter.UnsharpMask(radius=1.4, percent=140, threshold=3))
        steps.append("unsharp")
    if scale and abs(scale - 1.0) > 1e-3:
        img = img.resize((max(1, int(img.size[0] * scale)), max(1, int(img.size[1] * scale))), Image.LANCZOS)
        steps.append("resize x%.2f" % scale)
    dest = out_path(args, src, "enh")
    img.save(dest)
    return {"ok": True, "out": os.path.abspath(dest), "mode": mode, "steps": steps,
            "size": list(img.size), "box": list(box) if box else None}


# ═════════════════════════════════════════════════════════════════════════════
# dispatch
# ═════════════════════════════════════════════════════════════════════════════


OPS = {
    "info": op_info,
    "crop": op_crop,
    "grid": op_grid,
    "edges": op_edges,
    "ocr": op_ocr,
    "tile": op_tile,
    "annotate": op_annotate,
    "enhance": op_enhance,
}


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"ok": False, "error": "空输入：期望 JSON {op, args}"}))
        return
    try:
        payload = json.loads(raw)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": "输入不是合法 JSON: %s" % exc}))
        return
    op = str(payload.get("op") or "")
    args = payload.get("args") or {}
    fn = OPS.get(op)
    if fn is None:
        print(json.dumps({"ok": False, "error": "未知 op: %s（可用：%s）" % (op, ", ".join(sorted(OPS)))}, ensure_ascii=False))
        return
    try:
        result = fn(args)
    except Exception as exc:
        detail = traceback.format_exc(limit=3)
        print(json.dumps({"ok": False, "error": "%s: %s" % (type(exc).__name__, exc), "detail": detail},
                         ensure_ascii=False))
        return
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
