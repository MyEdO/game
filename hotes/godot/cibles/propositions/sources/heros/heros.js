/* Héros : création, fiche et progression, images d'intention (#3935, #4411). Les dessins de la famille, que
   `../rendu.js` pose : la figure du héros qui se dessine, le ciel du signe astral, les objets du bagage, le filigrane
   et la signature d'une page. Maquette hors du jeu. */
const SANG = '#8f2a1a';

/* la figure du héros neuf : `pose` dit jusqu'où la sanguine est posée (0 = tout au trait, 1 = achevée) */
const figure = (pose, { palette = false } = {}) => {
  const bas = Math.round(40 + pose * 380);
  return `<svg viewBox="0 0 200 430" preserveAspectRatio="xMidYMid meet">
  <defs><linearGradient id="sang" gradientUnits="userSpaceOnUse" x1="0" y1="${Math.max(30, bas - 150)}" x2="0" y2="${bas}"><stop offset="0" stop-color="#7c2416" stop-opacity=".92"/><stop offset="1" stop-color="#7c2416" stop-opacity="${pose >= 1 ? .92 : 0}"/></linearGradient></defs>
  <g fill="none" stroke="${SANG}" stroke-width=".8" stroke-dasharray="3 4" opacity="${pose >= 1 ? .35 : .8}"><path d="M100 22v386M38 122h124"/><circle cx="100" cy="76" r="29"/></g>
  <ellipse cx="100" cy="398" rx="64" ry="9" fill="none" stroke="${SANG}" stroke-width="1"/>
  <ellipse cx="100" cy="398" rx="44" ry="5.500" fill="none" stroke="${SANG}" stroke-width=".7" opacity=".7"/>
  <g fill="url(#sang)" stroke="${SANG}" stroke-width="1.400" stroke-linejoin="round">
    <path d="M74 300l-3 86-11 8h36l3-94zM126 300l3 86 11 8h-36l-3-94z"/>
    <path d="M100 100c-17 0-34 8-40 22l-10 112 12 4 5-74-4 142h74l-4-142 5 74 12-4-10-112c-6-14-23-22-40-22z"/>
    <circle cx="100" cy="76" r="21"/>
    <path d="M70 64c-3-20 22-27 40-25 17 2 26 12 21 24-19-6-41-6-61 1z"/>
    ${palette ? '<path d="M150 226c14-3 26 5 26 16 0 9-8 14-17 13-5-1-4-6-9-7-6-1-9-5-8-10 1-6 4-11 8-12z"/><path d="M48 240l-16 46" stroke-width="2.200"/>' : ''}
  </g>
  ${palette ? `<g fill="#e9dcc0"><circle cx="158" cy="236" r="2.200"/><circle cx="166" cy="242" r="2.200"/><circle cx="164" cy="250" r="2.200"/></g>` : ''}
</svg>`;
};

/* le ciel du signe astral : l'archer bandant son arc, au-dessus des toits */
const ciel = () => {
  const r = alea(41);
  const etoiles = Array.from({ length: 90 }, () => `<circle cx="${(r() * 430).toFixed(1)}" cy="${(r() * 118).toFixed(1)}" r="${(.3 + r() * .9).toFixed(2)}" fill="#e9dcc0" opacity="${(.25 + r() * .6).toFixed(2)}"/>`).join('');
  const P = { tete: [196, 34], epaule: [200, 52], hanche: [206, 82], pied1: [192, 108], pied2: [222, 106], main: [236, 50], arcH: [246, 26], arcM: [254, 50], arcB: [246, 76], coude: [178, 48], pointe: [286, 51] };
  const trait = (a, b) => `<path d="M${P[a]}L${P[b]}"/>`;
  const liens = [['tete', 'epaule'], ['epaule', 'hanche'], ['hanche', 'pied1'], ['hanche', 'pied2'], ['epaule', 'main'], ['epaule', 'coude'], ['coude', 'arcH'], ['coude', 'arcB'], ['arcH', 'arcM'], ['arcM', 'arcB'], ['coude', 'pointe']];
  return `<svg viewBox="0 0 430 134" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="nuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0f1a"/><stop offset=".7" stop-color="#1c1a2a"/><stop offset="1" stop-color="#3a2a2a"/></linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".95"/><stop offset=".35" stop-color="#f3c86a" stop-opacity=".4"/><stop offset="1" stop-color="#f3c86a" stop-opacity="0"/></radialGradient></defs>
  <rect width="430" height="134" fill="url(#nuit)"/>${etoiles}
  <g transform="translate(-72 -22) scale(1.28)"><g stroke="#e2c06a" stroke-width=".7" opacity=".8" fill="none" stroke-dasharray="1 2.500">${liens.map(([a, b]) => trait(a, b)).join('')}</g>
  ${Object.values(P).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="url(#halo)"/><circle cx="${x}" cy="${y}" r="1.500" fill="#fff6d8"/>`).join('')}</g>
  <path d="M0 134V116l18-9 16 9v-12l22-13 22 13v9l14-7 14 7v-16l8-22 8 22v16l26 3 10-10 16 10v-8l30-14 30 14v10l22-12 22 12v-18l6-18 6 18v14l28-8 26 12v-10l24-10 24 10V134z" fill="#07060a"/>
  <g fill="#f3c86a" opacity=".8"><rect x="60" y="112" width="3" height="4"/><rect x="214" y="118" width="3" height="4"/><rect x="330" y="110" width="3" height="4"/></g>
</svg>`;
};

/* les objets du bagage, dessinés à la plume d'or sur leur vignette */
const O = '#e9d7a4';
const DESSINS = {
  costume: `<path d="M22 10l10 6 10-6 12 8-5 12-5-3v27H20V27l-5 3-5-12z"/><path d="M32 16v38M26 24h0M38 24h0M22 10c3 5 17 5 20 0"/>`,
  dague: `<path d="M46 10L22 40l-3 7 7-3 24-30zM18 36l10 10M14 50l6-6"/>`,
  bourse: `<path d="M25 18h14l-3-7h-8zM25 18c-8 6-12 14-12 22 0 8 8 12 19 12s19-4 19-12c0-8-4-16-12-22M25 18c4 3 10 3 14 0"/>`,
  pinceau: `<path d="M12 52l22-22M34 30l6 6M34 30l4-4 6 6-4 4M42 24c4-8 10-12 14-12-1 5-4 11-12 14"/>`,
  pince: `<path d="M14 50L44 14c4-3 8 1 5 5L14 50zM14 50l22-34"/>`,
  cure: `<path d="M14 50l32-32M46 18c2-5 8-5 8 0s-5 6-8 4"/><path d="M22 54l30-30" opacity=".55"/>`,
  peigne: `<path d="M10 20h44v10H10zM14 30v20M20 30v20M26 30v20M32 30v20M38 30v20M44 30v20M50 30v20"/>`,
};
const dessinDObjet = (id) => `<svg width="62" height="62" viewBox="0 0 64 64" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DESSINS[id]}</svg>`;
/* le filigrane au pied d'une page, la signature d'un feuillet */
const FILIGRANE = '<svg class="filigrane" width="92" height="92" viewBox="0 0 100 100" fill="none" stroke="rgba(90,58,28,.45)" stroke-width="1"><circle cx="50" cy="30" r="22"/><circle cx="50" cy="70" r="22"/><circle cx="30" cy="50" r="22"/><circle cx="70" cy="50" r="22"/><path d="M50 38l12 12-12 12-12-12z"/></svg>';
const SIGNATURE = '<svg width="120" height="34" viewBox="0 0 120 34" fill="none" stroke="#2b1a3a" stroke-width="1.300" stroke-linecap="round"><path d="M4 24c8-14 14-18 16-10 2 8-6 14-8 6-1-8 14-14 20-6 4 6 8 8 12 0 3-6 8-6 10 0 2 6 6 6 10-2 3-6 8-8 12-2 3 5 10 6 28-6M10 30c30-4 60-4 96-6"/></svg>';
// Partagé avec `../rendu.js`, chargé avant ce script.
Object.assign(globalThis, { figure, ciel, dessinDObjet, FILIGRANE, SIGNATURE });
