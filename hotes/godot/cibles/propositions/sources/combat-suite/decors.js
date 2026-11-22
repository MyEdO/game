/* Les décors de la suite du combat (`../rendu.js`, gabarit `lieu-et-voyage`) : la mer sous la chasse d'une cogue
   pirate ; la route en forêt, où les poursuivants gagnent sur le groupe à mesure que la Distance fond ; le champ de la
   bataille de masse devant les remparts. Peints à l'échelle des décors de `../voyage/voyage.js`, dans la `toile()` qui les
   rogne à la vue (`../lieux-et-nuit/commun.js`). */
{
  const { etat } = globalThis.MAQUETTE;
  const vue = (svg) => { toile().innerHTML = svg; };
  const DECORS = {
    foret: () => {
      /* les poursuivants se tiennent d'autant plus près du groupe que la Distance est courte */
      const { distance, sur } = etat.panneau;
      const coureurs = (x0, n, pas, lance) => Array.from({ length: n }, (_, k) => D.marcheur(x0 + k * pas, 566 + (k % 2) * 8, 1.05, lance)).join('');
      vue(`${D.route({ lanterne: false }).replace(D.cavalier(610, 656, 0.9), '').replace(D.diligence(860, 648, 1, false), '')}${coureurs(760 - 850 * distance / sur, 3, 46, true)}${coureurs(900, 4, 52, false)}`);
    },
    mer: () => vue(`${D.mer({ teinte: 'jour', navire: false })}${D.cogue(300, 508, .4, { coque: '#0b0a0e', voile: '#17151b', pavillon: '#0b0a0e' })}<path d="M180 518q120 12 250 0" stroke="#e6ecea" stroke-width="1.500" fill="none" opacity=".5"/>
      ${D.cogue(850, 540, .86, {})}<path d="M592 559q258 26 550 0" stroke="#e6ecea" stroke-width="2.500" fill="none" opacity=".6"/>
      <path d="M0 780V690q200 -40 420 0t440 0 420 0 427 0V780z" fill="#07111a"/>`),
    champ: () => {
      const r = V.rng(23), troupe = (n, x0, x1, y0, y1, s0, s1) => Array.from({ length: n }, () => { const t = r(), x = x0 + r() * (x1 - x0); return [y0 + (y1 - y0) * (x - x0) / (x1 - x0) + t * 46, x, s0 + (s1 - s0) * t]; }).sort((a, b) => a[0] - b[0]).map(([y, x, s]) => D.marcheur(x, y, s, r() > .45)).join('');
      const creneaux = (x0, x1, y) => Array.from({ length: Math.ceil((x1 - x0) / 36) }, (_, k) => `<rect x="${x0 + k * 36}" y="${y - 16}" width="20" height="17"/>`).join('');
      vue(`${D.ciel('gris', 430)}<defs><linearGradient id="boue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b6b52"/><stop offset=".35" stop-color="#4a3d2c"/><stop offset="1" stop-color="#15100b"/></linearGradient></defs>
        ${V.nuages(24, 30, 380, '#dfe3df', 11)}${V.monts(432, 70, '#4b545c', 5)}
        <rect y="428" width="1707" height="352" fill="url(#boue)"/>
        <path d="M0 268C180 300 420 380 760 452L0 520z" fill="#2c2a22"/><path d="M0 268C180 300 420 380 760 452" stroke="#55503f" stroke-width="2" fill="none"/>
        ${V.sapins(0, 230, 290, 90, '#14130f', 6, 20)}
        <g opacity=".92">${troupe(120, 20, 700, 300, 452, .34, .5)}</g>
        <g fill="#7c1f14"><path d="M300 300v-70h44l-10 14 10 14h-40z"/><path d="M420 352v-64h40l-9 13 9 13h-36z"/></g><g stroke="#07050a" stroke-width="3"><path d="M300 372v-142M420 410v-124"/></g>
        <g fill="#191a1e"><rect x="1110" y="300" width="597" height="190"/>${creneaux(1110, 1707, 300)}<rect x="1010" y="236" width="120" height="262"/>${creneaux(1006, 1136, 236)}<rect x="1002" y="236" width="136" height="8"/></g>
        <g fill="#0a0a0c"><path d="M1054 498v-52a16 16 0 0 1 32 0v52z"/><rect x="1058" y="290" width="8" height="26"/><rect x="1078" y="290" width="8" height="26"/></g>
        <path d="M1070 236v-64" stroke="#07050a" stroke-width="3"/><path d="M1070 172h52l-11 15 11 15h-52z" fill="#a8842f"/>
        ${V.vagues(470, 640, '#1c140e', 90, 14)}
        <g>${troupe(34, 820, 1300, 500, 520, .7, .95)}</g>
        <path d="M0 780V700q200 -30 420 0t440 0 420 0 427 0V780z" fill="#0b0806"/>`);
      el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: .2 });
    },
  };
  DECORS[etat.decor]();
  /* le haut assombri sous le cartouche et le récit, comme le décor du voyage (`peindreLeVoyage`, `../rendu.js`) */
  el(S, 'rect', { width: W, height: 520, fill: 'url(#haut)' });
  fermer();
}
