/* Création 4/10 : le signe astral (ADE II 03 l.36-63 ; src/data/stars.json). */
const SIGNES = ["Wymund l'Anachorète", 'La Grande Croix', 'Le Trait du Peintre', 'Gnuthus le Buffle', 'Dragomas le Dragon', 'Le Crépuscule', 'Le Fourreau de Grungni', 'Mammit le Sage', 'Mummit le Fou', 'Les Deux Bœufs',
  'Le Danseur', 'Le Tambour', 'Le Flûtiste', 'Vobist le Pâle', 'La Charrette Brisée', 'La Chèvre Sauvage', 'Le Chaudron de Rhya', 'Cackelfax le Coq', 'La Scie à Os'];
/* quatre signes sous un même rang du d100, départagés au d10 (stars.json, `sub`) : [d10, variante] */
const ETOILE_DU_SORCIER = [['1-3', 'Sixième sens'], ['4-6', 'Seconde vue'], ['7-9', 'Magie mineure'], ['10', 'Sorcier !']];
const CHOISI = 'Le Trait du Peintre';
const ligneDeSigne = (s) => s === CHOISI
  ? `<div class="ligne choisie" style="height:27px">${picto('etoile', 16, '#2a1d12', 1.5)}<span class="n" data-texte="${s}">${s}</span></div>`
  : `<div class="ligne" style="height:27px"><i class="losange"></i><span class="n" data-texte="${s}">${s}</span></div>`;

/* le ciel : l'archer bandant son arc, au-dessus des toits */
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

poser([
  frise(4),
  gauche(`
    <div class="tirage">
      <div class="col">${rub('Signe au d100')}<div class="de">13</div></div>
      <div class="col" style="flex:1">${rub('Tiré')}
        <div class="ligne choisie" style="width:286px;height:34px">${picto('etoile', 17, '#2a1d12', 1.5)}<span class="n" data-texte="signe tiré">Le Trait du Peintre</span><span class="jeton or">+25 PX</span></div>
        <div class="rub" style="white-space:normal"><span class="note">Le signe gardé tel que le dé l'a tiré vaut ses PX ; un autre n'en vaut pas.</span></div>
      </div>
      <div class="col">${rub('Variante au d10')}<div style="display:flex;align-items:center;gap:9px"><div class="de petit vide"></div><span class="rub" style="white-space:normal;width:92px"><span class="note">L'Étoile du Sorcier seule</span></span></div></div>
    </div>
    ${sep()}
    ${rub('Signe astral')}
    <div class="deux" style="margin-top:4px">
      <div class="lignes">${SIGNES.slice(0, 10).map(ligneDeSigne).join('')}</div>
      <div class="lignes">${SIGNES.slice(10).map(ligneDeSigne).join('')}</div>
    </div>
    <div class="ligne" style="height:34px;border-bottom:0;padding-right:0"><i class="losange"></i><span class="n" data-texte="L'Étoile du Sorcier">L'Étoile du Sorcier</span><div class="pills" style="flex:none;flex-wrap:nowrap;gap:5px">${ETOILE_DU_SORCIER.map(([d, v]) => `<span class="pill" style="padding:0 8px"><b class="lin" style="font-size:10.5px;margin-right:5px">${d}</b>${v}</span>`).join('')}</div></div>`),
  centre('Signe de la Précision', `
    <div class="vignette laiton" style="height:140px;margin-top:10px">${ciel()}</div>
    <div class="nom" style="margin-top:9px" data-texte="nom du signe">Le Trait du Peintre</div>
    ${sep()}
    <div class="faits">
      <div class="fait">${rub('Nom classique')}<b>Verros</b></div>
      <div class="fait">${rub('Dates')}<b>9 nachhexen – 28 nachhexen</b></div>
      <div class="fait">${rub('Dans le ciel')}<b>un archer bandant son arc</b></div>
      <div class="fait">${rub('Attributs de départ')}<div style="display:flex;gap:6px;margin-top:2px"><span class="jeton or">CT +2</span><span class="jeton or">Ag +2</span><span class="jeton cire">CC −3</span></div></div>
    </div>
    <p class="prose" style="margin-top:13px" data-texte="texte du signe">Les natifs du Trait du Peintre sont faits pour devenir poètes, peintres, sculpteurs... Des artistes de toutes sortes. Ils créent de la beauté partout où ils vont, et même ceux qui, au gré des aléas de l'existence, ne se retrouvent pas à exercer dans un domaine artistique, trouvent le moyen de faire de l'œuvre de leur vie une sorte d'art.</p>`),
  herosNeuf({ acquis: ACQUIS, pose: .42 }),
  groupeEnCreation(),
  coins(),
]);
