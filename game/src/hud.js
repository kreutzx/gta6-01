// The HUD: DOM overlays for cash, wanted stars, health and the current objective, and
// a canvas minimap — north-up, centred on the player, with the road grid, the beach,
// mission markers in yellow, police in blue and hostiles in red.

import { CITY } from './config.js';
import { ROAD_LINES } from './city.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const wantedEl = el('wanted');
  const cashEl = el('cash');
  const clockEl = el('clock');
  const healthEl = el('health');
  const zoneEl = el('armor-row');
  const weaponEl = el('weapon');
  const objTitle = el('objective-title');
  const objText = el('objective-text');
  const toastEl = el('toast');
  const promptEl = el('prompt');
  const speedoEl = el('speedo');
  const crosshairEl = el('crosshair');
  const bustedWrap = el('busted-bar-wrap');
  const bustedFill = el('busted-fill');
  const banner = el('mission-banner');
  const mapCtx = el('minimap').getContext('2d');
  el('objective').style.display = 'none';
  let toastTimer = 0;
  let bannerTimer = 0;

  function setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) html += i < stars ? '★' : '<span class="off">★</span>';
    wantedEl.innerHTML = html;
  }

  function drawMinimap(data) {
    const S = 184;
    const scale = S / 190; // ~190 m across the map
    const cx = S / 2;
    const cy = S / 2;
    const px = data.player.x;
    const pz = data.player.z;
    const toMap = (x, z) => [cx + (x - px) * scale, cy + (z - pz) * scale];

    mapCtx.fillStyle = '#7d8b74';
    mapCtx.fillRect(0, 0, S, S);
    // Sand and sea along the south edge.
    const [, sandY] = toMap(0, CITY.beachZ);
    mapCtx.fillStyle = '#e8d194';
    mapCtx.fillRect(0, sandY, S, S - sandY);
    const [, waterY] = toMap(0, CITY.waterZ);
    mapCtx.fillStyle = '#2e7fa8';
    mapCtx.fillRect(0, waterY, S, S - waterY);
    // Blocks.
    mapCtx.fillStyle = 'rgba(226,220,204,0.5)';
    for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
      for (let j = 0; j < ROAD_LINES.length - 1; j += 1) {
        const [x0, y0] = toMap(ROAD_LINES[i] + CITY.roadHalf, ROAD_LINES[j] + CITY.roadHalf);
        const w = (CITY.pitch - CITY.roadHalf * 2) * scale;
        mapCtx.fillRect(x0, y0, w, w);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#3c4148';
    mapCtx.lineWidth = CITY.roadHalf * 2 * scale;
    mapCtx.beginPath();
    for (const line of ROAD_LINES) {
      const [vx] = toMap(line, 0);
      mapCtx.moveTo(vx, 0);
      mapCtx.lineTo(vx, S);
      const [, hz] = toMap(0, line);
      mapCtx.moveTo(0, hz);
      mapCtx.lineTo(S, hz);
    }
    mapCtx.stroke();

    function blip(x, z, color, r) {
      const [mx, my] = toMap(x, z);
      if (mx < -6 || my < -6 || mx > S + 6 || my > S + 6) return;
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
    }

    for (const v of data.traffic ?? []) blip(v.x, v.z, 'rgba(240,240,240,0.75)', 2);
    for (const v of data.police ?? []) blip(v.x, v.z, '#4da3ff', 3);
    for (const gPos of data.hostiles ?? []) blip(gPos.x, gPos.z, '#ff5a4e', 3);
    if (data.marker) {
      const pulse = 4.5 + Math.sin(performance.now() / 240) * 1.4;
      blip(data.marker.x, data.marker.z, '#ffd23e', pulse);
    }

    // The player: a white arrow turned to the heading.
    mapCtx.save();
    mapCtx.translate(cx, cy);
    mapCtx.rotate(Math.PI - data.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = 'rgba(0,0,0,0.55)';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(0, 3);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
  }

  return {
    show(on) { hud.classList.toggle('on', on); },
    setWanted,
    setCash(cash) { cashEl.textContent = '$' + Math.max(0, Math.floor(cash)).toLocaleString('en-US'); },
    setClock(text) { clockEl.textContent = text; },
    setHealth(frac) { healthEl.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; },
    setZone(name) { zoneEl.textContent = name.toUpperCase(); },
    setWeapon(name, driving) {
      weaponEl.textContent = name ?? '';
      crosshairEl.style.display = name && !driving ? 'block' : 'none';
    },
    setSpeedo(text) {
      speedoEl.textContent = text ?? '';
      speedoEl.style.display = text ? 'block' : 'none';
    },
    objective(title, text, dist) {
      const composed = (title ?? '') + '|' + (text ?? '') + '|' + (dist != null ? Math.round(dist) : '');
      if (composed === this._lastObjective) return;
      this._lastObjective = composed;
      document.getElementById('objective').style.display = title || text ? 'block' : 'none';
      objTitle.textContent = title ?? '';
      objTitle.style.display = title ? 'inline-block' : 'none';
      objText.innerHTML = text
        ? text + (dist != null ? ` &nbsp;<span id="objective-dist">${Math.round(dist)}m</span>` : '')
        : '';
    },
    toast(msg, seconds = 2.6) {
      toastEl.textContent = msg;
      toastEl.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, seconds * 1000);
    },
    prompt(key, text) {
      const composed = (key ?? '') + '|' + (text ?? '');
      if (composed === this._lastPrompt) return;
      this._lastPrompt = composed;
      if (!key) { promptEl.style.display = 'none'; return; }
      promptEl.innerHTML = `<b>${key}</b>${text}`;
      promptEl.style.display = 'block';
    },
    banner(title, sub) {
      banner.querySelector('.mb-title').textContent = title;
      banner.querySelector('.mb-sub').textContent = sub ?? '';
      banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('on'), 2800);
    },
    bustedBar(frac) {
      if (frac == null || frac <= 0.02) { bustedWrap.style.display = 'none'; return; }
      bustedWrap.style.display = 'block';
      bustedFill.style.width = (frac * 100).toFixed(0) + '%';
    },
    drawMinimap,
  };
}
