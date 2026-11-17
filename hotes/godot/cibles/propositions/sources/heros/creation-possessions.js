/* Création 8/10 : les possessions (LDB 05 l.542-583 ; classes.json courtisans, careerLevels.json artiste-1). */
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
const objet = (dessin, nom, { note = '', choisi = false } = {}) => `<div class="objet ${choisi ? 'choisi' : ''}"><div class="img laiton"><div><svg width="62" height="62" viewBox="0 0 64 64" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DESSINS[dessin]}</svg></div></div><b>${nom}</b>${note ? `<i>${note}</i>` : ''}</div>`;
const option = (nom, choisie = false) => `<div class="ligne ${choisie ? 'choisie' : ''}">${choisie ? picto('coche', 15, '#2a1d12', 2) : '<i class="losange"></i>'}<span class="n" data-texte="${nom}">${nom}</span></div>`;
const dot = (nom, note = '') => `<div class="dot">${nom}${note ? `<small>${note}</small>` : ''}</div>`;

poser([
  frise(8),
  gauche(`
    <div class="tirage">
      <div class="col">${rub('Bourse')}<div class="de">7</div></div>
      <div class="col" style="flex:1;padding-top:23px">
        <div style="display:flex;align-items:baseline;gap:12px"><span class="lin" style="font-size:25px;font-weight:600;color:#2a1d12">7/–</span><span class="fell" style="font-size:16px;color:#2a1d12">sept pistoles d'argent</span></div>
        <div class="rub">Statut · Argent 1 <span class="note">1d10 pistoles d'argent × Standing</span></div>
      </div>
    </div>
    ${sep()}
    ${rub("Au choix · Artiste Apprentie", 'un seul')}
    <div class="deux" style="margin-top:4px;grid-template-columns:1fr 1fr 1fr;column-gap:14px">${option('Pinceau <small>(brosse)</small>', true)}${option('Ciseau')}${option("Plume d'oie")}</div>
    <div style="margin-top:24px">${rub('Dotation des Courtisans')}</div>
    <div class="deux" style="margin-top:3px">
      <div>${dot('Vêtements <small style="font-family:Fell;font-size:13.500px;letter-spacing:0;color:#4a3420">(costume luxueux)</small>', 'Raffiné')}${dot('Dague')}${dot('Bourse')}</div>
      <div>${dot('Pince à épiler')}${dot('Cure-oreille', '× 2')}${dot('Peigne')}</div>
    </div>
    <div style="margin-top:24px">${rub("Dotation de l'Artiste Apprentie")}</div>
    <div class="deux" style="margin-top:3px"><div>${dot('Pinceau <small style="font-family:Fell;font-size:13.500px;letter-spacing:0;color:#4a3420">(brosse)</small>', 'Choisi')}</div><div></div></div>`),
  centre('Possessions', `
    <div class="nom" style="margin-top:12px" data-texte="titre de page">Le bagage</div>
    <div class="sous">Sept possessions · bourse 7/–</div>
    ${sep()}
    <div class="objets" style="margin-top:4px">
      ${objet('costume', 'Vêtements', { note: 'Raffiné' })}${objet('dague', 'Dague')}${objet('bourse', 'Bourse', { note: '7/–' })}${objet('pinceau', 'Pinceau', { note: 'Au choix', choisi: true })}
      ${objet('pince', 'Pince à épiler')}${objet('cure', 'Cure-oreille', { note: '× 2' })}${objet('peigne', 'Peigne')}
    </div>
    <div class="cartouche"><div class="medaillon petit laiton"><div>${picto('palette', 19)}</div></div><div><b>Pinceau (brosse)</b><i>Outils et nécessaires · Encombrement 0</i></div><span class="lin">4/–</span></div>`),
  herosNeuf({ acquis: [...ACQUIS, ['Compétences', 'Six de race, huit de carrière'], ['Talents', 'Six acquis'], ['Possessions', 'Sept, et 7/– en bourse']], pose: .8 }),
  groupeEnCreation(),
  coins(),
]);
