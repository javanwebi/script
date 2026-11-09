"""Bounded local query preparation and geometric evidence, not a SKU classifier."""
import base64
import csv
import io
import re
import subprocess
from collections import OrderedDict
from PIL import Image
import cv2
import numpy as np

PIPELINE = 'local-lens-v2'
_cache = OrderedDict()


def regions(image, limit=3):
    """Return bounded, class-agnostic object proposals for the query encoder.

    The full frame is always retained by the caller. These boxes are only crops
    to compare against the catalogue; they are not product classifications.
    Border foreground and coarse Lab components complement one another so that
    multiple separated objects can be selected independently.
    """
    h, w = image.shape[:2]
    if min(h, w) < 24 or limit < 1:
        return []

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    scale = 128 / max(h, w)
    small = cv2.resize(
        lab,
        (max(16, round(w * scale)), max(16, round(h * scale))),
        interpolation=cv2.INTER_AREA,
    )
    cv2.setRNGSeed(11)
    _, labels, centers = cv2.kmeans(
        small.reshape(-1, 3).astype(np.float32),
        8,
        None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 1),
        1,
        cv2.KMEANS_PP_CENTERS,
    )
    labels = cv2.resize(
        labels.reshape(small.shape[:2]).astype(np.uint8),
        (w, h),
        interpolation=cv2.INTER_NEAREST,
    )
    edges = np.concatenate((lab[0], lab[-1], lab[:, 0], lab[:, -1]))
    background = np.median(edges, axis=0)
    proposals = []

    # Keep a conservative whole-foreground proposal when the border is clean.
    base = foreground(image)
    if base:
        area = base['width'] * base['height']
        if 0.02 < area < 0.72 and base['width'] >= 0.03 and base['height'] >= 0.03:
            proposals.append((0.35 * np.sqrt(area), base))

    for index, center in enumerate(centers):
        contrast = float(np.linalg.norm(center - background))
        if contrast < 12:
            continue
        count, _, stats, _ = cv2.connectedComponentsWithStats(
            (labels == index).astype(np.uint8)
        )
        for x, y, bw, bh, area in stats[1:count]:
            ratio = area / (h * w)
            aspect = bw / max(1, bh)
            if not 0.002 < ratio < 0.62 or min(bw, bh) < 12:
                continue
            if not 0.10 < aspect < 10.0:
                continue
            fill = area / max(1, bw * bh)
            if fill < 0.10:
                continue

            centrality = 1 - float(np.hypot((x + bw / 2) / w - 0.5, (y + bh / 2) / h - 0.5))
            score = contrast * np.sqrt(ratio) * min(1.0, fill * 1.4) * (0.85 + 0.15 * centrality)
            margin = max(2, round(max(bw, bh) * 0.07))
            x0, y0 = max(0, x - margin), max(0, y - margin)
            x1, y1 = min(w, x + bw + margin), min(h, y + bh + margin)
            candidate = {
                'x': x0 / w,
                'y': y0 / h,
                'width': (x1 - x0) / w,
                'height': (y1 - y0) / h,
            }
            if candidate['width'] >= 0.03 and candidate['height'] >= 0.03:
                proposals.append((score, candidate))

    chosen = []
    for _, candidate in sorted(proposals, key=lambda item: -item[0]):
        def overlaps(other):
            intersection = (
                max(0, min(candidate['x'] + candidate['width'], other['x'] + other['width']) - max(candidate['x'], other['x']))
                * max(0, min(candidate['y'] + candidate['height'], other['y'] + other['height']) - max(candidate['y'], other['y']))
            )
            union = candidate['width'] * candidate['height'] + other['width'] * other['height'] - intersection
            return union > 0 and intersection / union > 0.58

        if not any(overlaps(other) for other in chosen):
            chosen.append(candidate)
        if len(chosen) >= limit:
            break
    return chosen


def select_region(image, point):
    """Segment the object under a normalized tap; return its padded crop bounds.

    This is a click-prompted GrabCut refinement, not a semantic classifier.
    It deliberately returns no region when the selected component is too small
    or consumes almost the whole frame, so a background tap cannot replace the
    last known-good crop.
    """
    h, w = image.shape[:2]
    if min(h, w) < 24 or not isinstance(point, dict):
        return None
    try:
        nx, ny = float(point['x']), float(point['y'])
    except (KeyError, TypeError, ValueError):
        return None
    if not np.isfinite([nx, ny]).all() or not 0 <= nx <= 1 or not 0 <= ny <= 1:
        return None

    px = min(w - 1, max(0, round(nx * (w - 1))))
    py = min(h - 1, max(0, round(ny * (h - 1))))
    margin = max(2, round(min(h, w) * 0.012))
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    if w > 2 * margin and h > 2 * margin:
        mask[margin:h-margin, margin:w-margin] = cv2.GC_PR_FGD

    # A small sure-foreground seed anchors GrabCut to the exact touched object.
    seed = max(3, round(min(h, w) * 0.018))
    cv2.circle(mask, (px, py), seed, cv2.GC_FGD, -1)
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(
            image, mask, None, background_model, foreground_model,
            5, cv2.GC_INIT_WITH_MASK,
        )
    except cv2.error:
        return None

    foreground_mask = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground_mask, 8)
    target = int(labels[py, px])
    if target == 0:
        # Antialiasing can leave the exact tap pixel outside the final mask.
        # Accept only a very close component; never jump to a distant proposal.
        radius = max(4, round(min(h, w) * 0.035))
        x0, x1 = max(0, px-radius), min(w, px+radius+1)
        y0, y1 = max(0, py-radius), min(h, py+radius+1)
        nearby = labels[y0:y1, x0:x1]
        ys, xs = np.where(nearby > 0)
        if not len(xs):
            return None
        distances = (xs + x0 - px) ** 2 + (ys + y0 - py) ** 2
        nearest = int(np.argmin(distances))
        target = int(nearby[ys[nearest], xs[nearest]])

    if target <= 0 or target >= count:
        return None
    x, y, bw, bh, area = map(int, stats[target])
    area_ratio = area / float(h * w)
    box_ratio = (bw * bh) / float(h * w)
    if area < max(24, int(h * w * 0.0025)) or not 0.0025 < area_ratio < 0.82 or box_ratio > 0.90:
        return None

    padding = max(3, round(max(bw, bh) * 0.07))
    x0, y0 = max(0, x-padding), max(0, y-padding)
    x1, y1 = min(w, x+bw+padding), min(h, y+bh+padding)
    if (x1-x0) / w < 0.03 or (y1-y0) / h < 0.03:
        return None
    return {
        'x': x0 / w,
        'y': y0 / h,
        'width': (x1-x0) / w,
        'height': (y1-y0) / h,
    }



def refine_regions(image, boxes):
    """Tighten automatic proposals with a center-prompted foreground crop.

    Keep the original deterministic proposal whenever GrabCut cannot refine it
    confidently or the refined box no longer overlaps the proposal sufficiently.
    """
    refined = []
    for box in boxes[:3]:
        point = {
            'x': box['x'] + box['width'] / 2,
            'y': box['y'] + box['height'] / 2,
        }
        candidate = select_region(image, point)
        if candidate is None:
            refined.append(box)
            continue
        intersection_width = max(
            0.0,
            min(box['x'] + box['width'], candidate['x'] + candidate['width'])
            - max(box['x'], candidate['x']),
        )
        intersection_height = max(
            0.0,
            min(box['y'] + box['height'], candidate['y'] + candidate['height'])
            - max(box['y'], candidate['y']),
        )
        overlap = (intersection_width * intersection_height) / max(
            1e-9,
            min(box['width'] * box['height'], candidate['width'] * candidate['height']),
        )
        candidate_area = candidate['width'] * candidate['height']
        proposal_area = box['width'] * box['height']
        if overlap < 0.55 or candidate_area > proposal_area * 2.5:
            refined.append(box)
        else:
            refined.append(candidate)
    return refined

def decode(value):
    raw = base64.b64decode(value, validate=True)
    header = Image.open(io.BytesIO(raw))
    if max(header.size)>2048 or header.width*header.height>4_000_000:
        raise ValueError('image too large')
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None or max(image.shape[:2]) > 2048:
        raise ValueError('invalid image')
    return image


def foreground(image):
    """Propose one crop only on a consistent background; otherwise retain full frame."""
    h, w = image.shape[:2]
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    edges = np.concatenate((lab[0], lab[-1], lab[:, 0], lab[:, -1]))
    background = np.median(edges, axis=0)
    if np.percentile(np.linalg.norm(edges-background, axis=1), 85) > 18:
        return None
    mask = (np.linalg.norm(lab-background, axis=2) > 28).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    valid = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > max(16, h*w*0.002)]
    if not valid:
        return None
    ys, xs = np.where(np.isin(labels, valid))
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()+1), int(ys.min()), int(ys.max()+1)
    margin = max(4, round(max(x1-x0, y1-y0)*0.08))
    x0, y0, x1, y1 = max(0, x0-margin), max(0, y0-margin), min(w, x1+margin), min(h, y1+margin)
    area = (x1-x0)*(y1-y0)/(h*w)
    if not 0.02 < area < 0.85:
        return None
    return {'x': x0/w, 'y': y0/h, 'width': (x1-x0)/w, 'height': (y1-y0)/h}


def crop(image, box):
    h, w = image.shape[:2]
    return image[round(box['y']*h):round((box['y']+box['height'])*h),
                 round(box['x']*w):round((box['x']+box['width'])*w)]


def jpeg(image):
    ok, raw = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        raise ValueError('encode failed')
    return base64.b64encode(raw).decode()


def markings(image):
    # Sparse Latin industrial markings; timeout bounds worst-case CPU use.
    ok, raw = cv2.imencode('.png', image)
    if not ok:
        return [], False
    try:
        result = subprocess.run(['tesseract', 'stdin', 'stdout', '-l', 'eng', '--psm', '11', 'tsv'],
                                input=raw.tobytes(), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                timeout=0.8, check=True)
        words = csv.DictReader(io.StringIO(result.stdout.decode('utf8')), delimiter='\t')
        found = []
        for word in words:
            text = word.get('text', '').strip()
            confidence = float(word.get('conf', '-1'))
            if confidence >= 85 and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9./_-]{2,31}', text) and re.search(r'\d', text):
                found.append({'text': text, 'confidence': confidence})
        return found[:12], True
    except (FileNotFoundError, subprocess.SubprocessError, UnicodeError, ValueError):
        return [], False


def features(value):
    import hashlib
    key = hashlib.sha256(value.encode()).digest()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    gray = cv2.cvtColor(decode(value), cv2.COLOR_BGR2GRAY)
    points, descriptors = cv2.ORB_create(nfeatures=800).detectAndCompute(gray, None)
    result = (np.float32([p.pt for p in points]), descriptors, gray.shape)
    _cache[key] = result
    while len(_cache) > 96:
        _cache.popitem(last=False)
    return result


def geometric(query, candidate):
    q, qd, qs = features(query)
    c, cd, cs = features(candidate)
    empty = {'supported': False, 'inliers': 0, 'coverage': 0}
    if qd is None or cd is None or min(len(q), len(c)) < 8:
        return empty
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(qd, cd, k=2)
    good = [m for pair in pairs if len(pair) == 2 for m, n in [pair] if m.distance < 0.72*n.distance]
    # Repeating teeth/logos cannot all claim the same candidate keypoint.
    unique = {m.trainIdx: m for m in sorted(good, key=lambda m: -m.distance)}
    good = list(unique.values())
    if len(good) < 8:
        return empty
    src = np.float32([q[m.queryIdx] for m in good])
    dst = np.float32([c[m.trainIdx] for m in good])
    matrix, mask = cv2.findHomography(src, dst, cv2.RANSAC, 3.0, maxIters=500, confidence=0.99)
    if matrix is None or mask is None:
        return empty
    valid = mask.ravel().astype(bool)
    inliers = int(valid.sum())
    if inliers < 8 or inliers/len(good) < 0.45:
        return empty
    spread = min(float(np.prod(np.ptp(src[valid], axis=0)) / (qs[0]*qs[1])),
                 float(np.prod(np.ptp(dst[valid], axis=0)) / (cs[0]*cs[1])))
    # Reject a tiny shared badge or a spatially collapsed/repeated pattern.
    corners = np.float32([[[0, 0], [qs[1], 0], [qs[1], qs[0]], [0, qs[0]]]])
    projected = cv2.perspectiveTransform(corners, matrix)[0]
    supported = spread >= 0.08 and np.isfinite(projected).all() and cv2.isContourConvex(projected)
    return {'supported': bool(supported), 'inliers': inliers, 'coverage': round(spread, 4)}
