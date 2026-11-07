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
    """Class-agnostic proposals, never product predictions. Bounded, deterministic CPU work.

    Uniform backgrounds use the existing object box. In clutter, coarse Lab colour
    components propose compact objects of any colour; the catalogue encoder decides
    which, if any, is relevant. No colour or object name is a recognition rule.
    """
    box = foreground(image)
    if box:
        return [box]
    h, w = image.shape[:2]
    if min(h, w) < 24:
        return []
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    scale = 128/max(h, w)
    small = cv2.resize(lab, (max(16, round(w*scale)), max(16, round(h*scale))), interpolation=cv2.INTER_AREA)
    cv2.setRNGSeed(11)
    _, labels, centers = cv2.kmeans(small.reshape(-1, 3).astype(np.float32), 8, None,
                                  (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 15, 1), 1, cv2.KMEANS_PP_CENTERS)
    labels = cv2.resize(labels.reshape(small.shape[:2]).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    background = np.median(lab.reshape(-1, 3), axis=0)
    proposals = []
    for index, center in enumerate(centers):
        contrast = float(np.linalg.norm(center[1:]-background[1:]))
        if contrast < 12:
            continue
        count, _, stats, _ = cv2.connectedComponentsWithStats((labels == index).astype(np.uint8))
        for x, y, bw, bh, area in stats[1:count]:
            if not 0.003 < area/(h*w) < 0.20 or min(bw, bh) < 15 or not 0.35 < bw/bh < 2.8:
                continue
            if x < 3 or y < 3 or x+bw > w-3 or y+bh > h-3:
                continue
            centrality = 1-float(np.hypot((x+bw/2)/w-0.5, (y+bh/2)/h-0.5))
            score = contrast*centrality*np.sqrt(area/(bw*bh))
            margin = max(2, round(max(bw, bh)*0.06))
            x0, y0, x1, y1 = max(0, x-margin), max(0, y-margin), min(w, x+bw+margin), min(h, y+bh+margin)
            proposals.append((score, {'x': x0/w, 'y': y0/h, 'width': (x1-x0)/w, 'height': (y1-y0)/h}))
    chosen = []
    for _, candidate in sorted(proposals, key=lambda p: -p[0]):
        def overlaps(other):
            intersection = max(0, min(candidate['x']+candidate['width'], other['x']+other['width'])-max(candidate['x'], other['x']))*max(0, min(candidate['y']+candidate['height'], other['y']+other['height'])-max(candidate['y'], other['y']))
            return intersection/(candidate['width']*candidate['height']+other['width']*other['height']-intersection) > 0.6
        if not any(overlaps(other) for other in chosen):
            chosen.append(candidate)
        if len(chosen) == limit:
            break
    return chosen


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
