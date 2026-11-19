/* Pièces navales au-dessus du socle du combat (`../combat/socle.js`) : un navire sur la grille, la mer du combat et ce
   qu'elle porte (`MerDuCombat`, `../maquettes/maquette.ts`), les voiles du bord de l'écran. */
/* un navire sur la grille : coque le long de l'axe i, proue vers +i (sens = 1) ou −i (sens = −1) */
function navire(g, i, j, { sens = 1, coque = ['#7a5a3a', '#4a3320', '#2a1c12'], voile = '#7d2020' } = {}) {
  const q = (di, dj) => P(i + sens * di, j + sens * dj), pts = (l) => l.map(([a, b]) => q(a, b).join(',')).join(' ');
  const pont = [[2.1, 0], [1.3, -.62], [-1.6, -.62], [-1.9, 0], [-1.6, .62], [1.3, .62]], h = 20;
  el(g, 'ellipse', { cx: q(0, 0)[0], cy: q(0, 0)[1] + h + 6, rx: 120, ry: 44, fill: '#06121a', opacity: .5, filter: 'url(#f6)' });
  for (const [a, b] of [[pont[3], pont[4]], [pont[4], pont[5]], [pont[5], pont[0]], [pont[2], pont[3]], [pont[0], pont[1]]]) {
    const [x1, y1] = q(...a), [x2, y2] = q(...b); el(g, 'polygon', { points: `${x1},${y1} ${x2},${y2} ${x2},${y2 + h} ${x1},${y1 + h}`, fill: y2 + y1 > 2 * q(0, 0)[1] ? coque[1] : coque[2], stroke: '#140c06', 'stroke-width': 1 });
  }
  el(g, 'polygon', { points: pts(pont), fill: coque[0], stroke: '#140c06', 'stroke-width': 1.2 });
  for (const [a0, a1] of [[-1.6, -1], [1.3, 1.9]]) el(g, 'polygon', { points: [[a0, -.5], [a1, a1 > 1.5 ? -.12 : -.5], [a1, a1 > 1.5 ? .12 : .5], [a0, .5]].map(([a, b]) => { const [x, y] = q(a, b); return `${x},${y - 9}`; }).join(' '), fill: coque[1], stroke: '#140c06', 'stroke-width': 1 });
  const [mx, my] = q(.1, 0); el(g, 'path', { d: `M${mx} ${my}v-150`, stroke: '#1a1008', 'stroke-width': 5 });
  const [ax, ay] = q(.1, -.85), [bx, by] = q(.1, .85);
  el(g, 'polygon', { points: `${ax},${ay - 126} ${bx},${by - 126} ${bx + sens * 12},${by - 44} ${ax + sens * 12},${ay - 44}`, fill: voile, stroke: '#140c06', 'stroke-width': 1.2 });
  el(g, 'path', { d: `M${ax} ${ay - 126}L${bx} ${by - 126}`, stroke: '#1a1008', 'stroke-width': 4 });
  el(g, 'path', { d: `M${mx} ${my - 150}l${sens * 22} 6l${-sens * 22} 6z`, fill: voile });
}
/* la mer du combat, grise, quadrillée */
function merDeCombat() {
  grad('mer', [[0, '#7c8a8e'], [.3, '#4a626c'], [1, '#13232d']]);
  el(S, 'rect', { width: W, height: H, fill: 'url(#mer)' });
  const g = el(S, 'g', { fill: 'none', stroke: '#dfe9e6', 'stroke-width': 1, opacity: .13 });
  for (let i = -4; i < 30; i++) for (let j = -14; j < 22; j++) { const [x, y] = P(i, j); if (x > -60 && x < W + 60 && y > -40 && y < H + 40) el(g, 'path', { d: losange(x, y) }); }
  const r = alea(5), v = el(S, 'g', { fill: 'none', stroke: '#e6efec', 'stroke-width': 1.3, opacity: .3 });
  for (let k = 0; k < 90; k++) { const x = r() * W, y = r() * H, w = 18 + r() * 30; el(v, 'path', { d: `M${x} ${y}q${w / 4} -${w / 8} ${w / 2} 0t${w / 2} 0` }); }
}
/* la mer du combat à l'état qu'elle dessine : les cases où l'actif peut porter son navire (la dernière, où il va), celles
   où porte la batterie adverse, les navires à leur cap ; les voiles par-dessus */
const AVANCE = (k, n) => (k === n - 1 ? .5 : .34);
function merDuCombat({ navires, avance, batterie }) {
  merDeCombat();
  const a = el(S, 'g'); avance.forEach(([i, j], k) => { const [x, y] = P(i, j); el(a, 'path', { d: losange(x, y, A - 3, B - 1.5), fill: '#e2c06a', opacity: AVANCE(k, avance.length), stroke: '#f3dc93', 'stroke-width': 1.5 }); });
  const b = el(S, 'g'); for (const [i, j] of batterie) { const [x, y] = P(i, j); el(b, 'path', { d: losange(x, y, A - 3, B - 1.5), fill: '#b9412c', opacity: .22, stroke: '#b9412c', 'stroke-width': 1 }); }
  for (const n of navires) navire(el(S, 'g'), ...n.case, n.ennemi ? { sens: n.cap, coque: ['#4a4a52', '#2c2c34', '#18181e'], voile: '#16161c' } : { sens: n.cap });
  voiles();
}
const voiles = () => { el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' }); el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' }); el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)' }); };
// Partagé avec les scripts chargés après celui-ci.
Object.assign(globalThis, { merDuCombat, voiles });
