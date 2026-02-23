/**
 * QuestTube - Dungeon Map Module
 * Renders a pixel-art overworld map from quiz history.
 * Each quizzed video = a node on a winding snake path.
 */

// ── Layout constants ────────────────────────────────────
const MAP_CONFIG = {
  COLS: 3,
  COL_SPACING: 118,    // px between column centers
  ROW_HEIGHT: 80,      // px between row centers
  PADDING_LEFT: 60,    // px from left edge to first column center
  PADDING_TOP: 72,     // px from top to first row center (room for biome label)
  NODE_SIZE: 32,       // px square per node
  PATH_DOT_SPACING: 10, // px between path dots
};

// ── Biomes by row range ─────────────────────────────────
const BIOMES = [
  { name: 'meadow',  rows: [0, 2],  pathColor: '#4ade80', label: 'Meadow' },
  { name: 'cave',    rows: [3, 5],  pathColor: '#807a6e', label: 'Caverns' },
  { name: 'dungeon', rows: [6, 8],  pathColor: '#a78bfa', label: 'Dungeon' },
  { name: 'abyss',   rows: [9, 999], pathColor: '#ef4444', label: 'Abyss' },
];

function getBiome(rowIndex) {
  return BIOMES.find(b => rowIndex >= b.rows[0] && rowIndex <= b.rows[1]) || BIOMES[0];
}

// ── Data helpers ────────────────────────────────────────

/** Deduplicate quiz attempts into one node per video */
function aggregateNodes(attempts) {
  const byVideo = {};
  for (const a of attempts) {
    const id = a.videoId;
    if (!byVideo[id]) {
      byVideo[id] = {
        videoId: id,
        title: a.title || 'Unknown Video',
        bestScore: a.score || 0,
        attemptCount: 0,
        firstAttempt: a.timestamp,
        lastAttempt: a.timestamp,
        weakConcepts: [],
      };
    }
    const n = byVideo[id];
    n.attemptCount++;
    n.bestScore = Math.max(n.bestScore, a.score || 0);
    if (a.timestamp < n.firstAttempt) n.firstAttempt = a.timestamp;
    if (a.timestamp > n.lastAttempt) n.lastAttempt = a.timestamp;
    if (Array.isArray(a.weakConcepts)) {
      n.weakConcepts = [...new Set([...n.weakConcepts, ...a.weakConcepts])];
    }
  }
  return Object.values(byVideo).sort((a, b) =>
    new Date(a.firstAttempt) - new Date(b.firstAttempt)
  );
}

/** Check if any of a node's weak concepts are due for review */
function isReviewDue(node, conceptModel) {
  if (!conceptModel || node.weakConcepts.length === 0) return false;
  const now = new Date();
  for (const concept of node.weakConcepts) {
    const info = conceptModel[concept];
    if (info && Array.isArray(info.dueDates)) {
      if (info.dueDates.some(d => new Date(d) <= now)) return true;
    }
  }
  return false;
}

// ── Layout algorithm ────────────────────────────────────

/** Snake-pattern position: even rows L→R, odd rows R→L */
function getNodePosition(index) {
  const row = Math.floor(index / MAP_CONFIG.COLS);
  const colInRow = index % MAP_CONFIG.COLS;
  const col = row % 2 === 0 ? colInRow : (MAP_CONFIG.COLS - 1 - colInRow);
  return {
    x: MAP_CONFIG.PADDING_LEFT + col * MAP_CONFIG.COL_SPACING,
    y: MAP_CONFIG.PADDING_TOP + row * MAP_CONFIG.ROW_HEIGHT,
    row,
    col,
  };
}

/** Generate path dots between two node centers (L-shaped for row changes) */
function generatePathDots(from, to, biome) {
  const dots = [];
  const sp = MAP_CONFIG.PATH_DOT_SPACING;

  if (from.y === to.y) {
    // Same row — horizontal line
    const dir = to.x > from.x ? 1 : -1;
    for (let x = from.x + sp * dir; Math.abs(x - to.x) >= sp; x += sp * dir) {
      dots.push({ x, y: from.y, color: biome.pathColor });
    }
  } else {
    // Different rows — vertical then horizontal
    const vDir = to.y > from.y ? 1 : -1;
    for (let y = from.y + sp * vDir; Math.abs(y - to.y) >= sp; y += sp * vDir) {
      dots.push({ x: from.x, y, color: biome.pathColor });
    }
    const hDir = to.x > from.x ? 1 : -1;
    if (from.x !== to.x) {
      for (let x = from.x + sp * hDir; Math.abs(x - to.x) >= sp; x += sp * hDir) {
        dots.push({ x, y: to.y, color: biome.pathColor });
      }
    }
  }
  return dots;
}

// ── Rendering ───────────────────────────────────────────

async function loadMap() {
  const canvas = document.getElementById('mapCanvas');
  const viewport = document.getElementById('mapViewport');
  const emptyState = document.getElementById('mapEmpty');
  const countEl = document.getElementById('mapNodeCount');
  if (!canvas) return;

  const data = await chrome.storage.local.get(['quizAttempts', 'conceptModel']);
  const attempts = data.quizAttempts || [];
  const conceptModel = data.conceptModel || {};
  const nodes = aggregateNodes(attempts);

  // Empty state
  if (nodes.length === 0) {
    canvas.innerHTML = '';
    if (emptyState) emptyState.style.display = '';
    if (viewport) viewport.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (viewport) viewport.style.display = '';
  if (countEl) countEl.textContent = `${nodes.length} quest${nodes.length !== 1 ? 's' : ''}`;

  // Compute positions
  const positions = nodes.map((_, i) => getNodePosition(i));
  const maxRow = Math.max(...positions.map(p => p.row));
  canvas.style.height = `${MAP_CONFIG.PADDING_TOP + (maxRow + 1) * MAP_CONFIG.ROW_HEIGHT + 40}px`;

  let html = '';

  // ── Biome background strips (rendered first, behind everything)
  const totalHeight = MAP_CONFIG.PADDING_TOP + (maxRow + 1) * MAP_CONFIG.ROW_HEIGHT + 40;
  const biomesPresent = [];
  for (const biome of BIOMES) {
    const startRow = biome.rows[0];
    const endRow = Math.min(biome.rows[1], maxRow + 1);
    if (startRow > maxRow + 1) continue;
    const y = startRow === 0 ? 0 : MAP_CONFIG.PADDING_TOP + startRow * MAP_CONFIG.ROW_HEIGHT - 40;
    const yEnd = endRow >= 999 ? totalHeight : MAP_CONFIG.PADDING_TOP + (endRow + 1) * MAP_CONFIG.ROW_HEIGHT + 40;
    const h = yEnd - y;
    if (h <= 0) continue;
    biomesPresent.push({ name: biome.name, y, h });
    html += `<div class="map-biome-bg map-biome-bg--${biome.name}" style="top:${y}px;height:${h}px;"></div>`;
  }

  // ── Path dots between consecutive nodes
  for (let i = 0; i < positions.length - 1; i++) {
    const biome = getBiome(positions[i + 1].row);
    const dots = generatePathDots(positions[i], positions[i + 1], biome);
    for (const d of dots) {
      html += `<div class="map-path-dot" style="left:${d.x - 2}px;top:${d.y - 2}px;background:${d.color}"></div>`;
    }
  }

  // ── Placeholder path + "?" at the end
  if (positions.length > 0) {
    const lastPos = positions[positions.length - 1];
    const nextPos = getNodePosition(positions.length);
    const biome = getBiome(nextPos.row);
    const placeholderDots = generatePathDots(lastPos, nextPos, biome);
    for (const d of placeholderDots.slice(0, 4)) {
      html += `<div class="map-path-dot map-path-placeholder" style="left:${d.x - 2}px;top:${d.y - 2}px;background:${d.color}"></div>`;
    }
    html += `<div class="map-next-label" style="left:${nextPos.x}px;top:${nextPos.y}px;">?</div>`;
  }

  // ── Nodes
  nodes.forEach((node, i) => {
    const pos = positions[i];
    const reviewDue = isReviewDue(node, conceptModel);
    const completed = node.bestScore >= 70;
    const isLatest = i === nodes.length - 1;

    let stateClass = 'needs-work';
    if (reviewDue) stateClass = 'review-due';
    else if (completed) stateClass = 'completed';

    const biome = getBiome(pos.row);
    const halfNode = MAP_CONFIG.NODE_SIZE / 2;

    html += `
      <div class="map-node ${stateClass} biome-${biome.name}"
           data-node-index="${i}" data-video-id="${node.videoId}"
           style="left:${pos.x - halfNode}px;top:${pos.y - halfNode}px;">
        <div class="map-node-icon"></div>
        <div class="map-node-score">${node.bestScore}%</div>
      </div>`;

    // Player marker on the latest node
    if (isLatest) {
      html += `
        <div class="map-player" style="left:${pos.x - 8}px;top:${pos.y - 38}px;">
          <div class="map-player-sprite"></div>
        </div>`;
    }
  });

  // ── Biome labels (centered inside top of each biome background)
  const biomesUsed = new Set(positions.map(p => getBiome(p.row).name));
  for (const biome of BIOMES) {
    if (!biomesUsed.has(biome.name)) continue;
    // Place label inside the biome background strip, near the top
    const bgY = biome.rows[0] === 0 ? 0 : MAP_CONFIG.PADDING_TOP + biome.rows[0] * MAP_CONFIG.ROW_HEIGHT - 40;
    const y = bgY + 10;
    html += `<div class="map-biome-label biome-${biome.name}" style="top:${y}px">~ ${biome.label} ~</div>`;
  }

  canvas.innerHTML = html;

  // Auto-scroll to latest node
  if (viewport && positions.length > 0) {
    const latestY = positions[positions.length - 1].y;
    viewport.scrollTop = Math.max(0, latestY - viewport.clientHeight / 2);
  }

  // ── Click handlers (attach once)
  if (!canvas._mapClickBound) {
    canvas._mapClickBound = true;
    canvas.addEventListener('click', (e) => {
      const nodeEl = e.target.closest('.map-node');
      if (!nodeEl) {
        document.getElementById('mapDetail').style.display = 'none';
        return;
      }
      const idx = parseInt(nodeEl.dataset.nodeIndex, 10);
      if (nodes[idx]) showNodeDetail(nodes[idx], conceptModel);
    });
  }

  // Detail panel actions (attach once)
  const detail = document.getElementById('mapDetail');
  if (detail && !detail._mapClickBound) {
    detail._mapClickBound = true;
    detail.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close-detail"]')) {
        detail.style.display = 'none';
      }
      if (e.target.closest('[data-action="map-review"]')) {
        const videoId = detail.dataset.videoId;
        if (!videoId) return;
        // Always navigate to the correct video so the quiz targets the right content
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (tab && tab.url && tab.url.includes(`v=${videoId}`)) {
            // Already on the right video — just trigger the quiz
            chrome.tabs.sendMessage(tab.id, { type: 'START_REVIEW_QUIZ' });
          } else if (tab && tab.url && tab.url.includes('youtube.com')) {
            // On YouTube but wrong video — navigate to the right one
            chrome.tabs.update(tab.id, { url: videoUrl });
          } else {
            // Not on YouTube — open the video in a new tab
            chrome.tabs.create({ url: videoUrl });
          }
          window.close();
        });
      }
    });
  }
}

function showNodeDetail(node, conceptModel) {
  const detail = document.getElementById('mapDetail');
  if (!detail) return;
  detail.style.display = '';
  detail.dataset.videoId = node.videoId;

  document.getElementById('mapDetailTitle').textContent =
    node.title.length > 45 ? node.title.slice(0, 42) + '...' : node.title;
  document.getElementById('mapDetailScore').textContent = `Best: ${node.bestScore}%`;
  document.getElementById('mapDetailAttempts').textContent =
    `${node.attemptCount} quest${node.attemptCount !== 1 ? 's' : ''}`;

  const reviewDue = isReviewDue(node, conceptModel);
  const statusEl = document.getElementById('mapDetailStatus');
  if (reviewDue) {
    statusEl.textContent = 'Review due now!';
    statusEl.className = 'map-detail-status due';
  } else if (node.bestScore >= 70) {
    statusEl.textContent = 'Mastered';
    statusEl.className = 'map-detail-status mastered';
  } else {
    statusEl.textContent = 'Needs practice';
    statusEl.className = 'map-detail-status needs-work';
  }
}
