/* Pièces navales au-dessus du socle du combat (`../combat/socle.js`) : la compagnie du voyage (`../lieux-et-nuit/bustes.js`)
   et le buste d'un navire dans l'ordre du tour, un navire sur la grille, la mer du combat. */
Object.assign(BUSTES, COMPAGNIE, {
  navire: '<path d="M6 66h66l-9 17H16z"/><path d="M37 12h4v54h-4z"/><path d="M13 23c17 5 35 5 52 0 3 12 3 25-1 35-17 5-33 5-50 0-4-10-4-23-1-35z"/><path d="M41 12l14 4-14 4z"/>',
});
/* un navire sur la grille : coque le long de l'axe i, proue vers +i (sens = 1) ou −i (sens = −1) */
function navire(g, i, j, { sens = 1, coque = ['#7a5a3a', '#4a3320', '#2a1c12'], voile = '#7d2020' } = {}) {
  const q = (di, dj) => P(i + sens * di, j + sens * dj), pts = (l) => l.map(([a, b]) => q(a, b).join(',')).join(' ');
  const pont = [[2.1, 0], [1.3, -.62], [-1.6, -.62], [-1.9, 0], [-1.6, .62], [1.3, .62]], h = 20;
  const bas = (l) => l.map(([a, b]) => { const [x, y] = q(a, b); return `${x},${y + h}`; }).join(' ');
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
const voiles = () => { el(S, 'rect', { width: W, height: H, fill: 'url(#vignette)' }); el(S, 'rect', { x: 0, y: 0, width: 330, height: H, fill: 'url(#gauche)' }); el(S, 'rect', { x: 0, y: 500, width: W, height: 280, fill: 'url(#bas)' }); };
