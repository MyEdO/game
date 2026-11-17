/* La bataille de masse sur l'écran de voyage (`../voyage/`) : le champ en décor, les Scènes du Round posées dessus.
   Puissance : ADE II 08 l.17-32 ; Round de bataille : ADE II 08 l.112-124 ; Scènes : ADE II 08 l.137-177 ;
   facteurs environnementaux : ADE II 08 l.307-322 ; `src/noyau/batailleEnVue.ts`, `src/hote/ecran.ts:597`,
   `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `mbf.*` et `ecran.bataille.*` de `src/i18n/messages/fr.ts`. */
const JOUE = document.getElementById('ecran').dataset.etat === 'bataille-de-masse-test-de-puissance';
{ const r = V.rng(23), troupe = (n, x0, x1, y0, y1, s0, s1) => Array.from({ length: n }, () => { const t = r(), x = x0 + r() * (x1 - x0); return [y0 + (y1 - y0) * (x - x0) / (x1 - x0) + t * 46, x, s0 + (s1 - s0) * t]; }).sort((a, b) => a[0] - b[0]).map(([y, x, s]) => D.marcheur(x, y, s, r() > .45)).join('');
  const creneaux = (x0, x1, y) => Array.from({ length: Math.ceil((x1 - x0) / 36) }, (_, k) => `<rect x="${x0 + k * 36}" y="${y - 16}" width="20" height="17"/>`).join('');
  poser(`${D.ciel('gris', 430)}<defs><linearGradient id="boue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b6b52"/><stop offset=".35" stop-color="#4a3d2c"/><stop offset="1" stop-color="#15100b"/></linearGradient></defs>
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
    <path d="M0 780V700q200 -30 420 0t440 0 420 0 427 0V780z" fill="#0b0806"/>`); }
el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: .2 });
fermer();
const pieces = [];
pieces.push(titre({ icone: 'epee', nom: 'Bataille de masse', sous: 'Round de bataille 1 / 3', largeur: 452 }));
const scene = (cx, y, { nom, effet, position, heros = [], icone, geste, vise = false }) => `<div class="poste scene ${heros.length ? 'occupe' : 'vide'} ${vise ? 'vise' : ''}" style="left:${cx - 115}px;top:${y}px">
  <div class="postes-de-scene">${heros.length ? heros.map((h) => portrait(h)).join('') : medaillon(icone, { taille: 21 })}</div>
  <div class="et bois"><b>${nom}</b><span class="rubrique">${effet}</span>${position ? `<span class="rubrique position">${position}</span>` : ''}${plaque(geste, { armee: vise })}</div></div>`;
const armees = (allies, ennemis, suite) => `<div id="bord" class="cadre bois bord armees" data-piece="les armées"><div class="fond bois">
  ${ligne('Armée des Personnages', `<span class="lin">${allies} · départ 50</span>`)}${jauge(allies / 100)}
  ${ligne('Tests de Puissance ce Round', '<span class="lin">+10</span>')}
  ${ligne('Horde ennemie', `<span class="lin">${ennemis} · départ 55</span>`)}${jauge(ennemis / 100, 'cire')}
  <div class="filet"></div>${suite}
</div><div class="ruban rubrique">Puissance</div>${ferrures}</div>`;
if (!JOUE) {
  pieces.push(recit('Le terrain', 'La plaine boueuse s’étend devant les remparts ; la horde dévale la pente en hurlant.').replace('id="recit"', 'id="recit" class="terrain"'));
  pieces.push(`<div data-piece="scenes">
    ${scene(1150, 96, { nom: 'Pluie de flèches', effet: '−1/touche · −2/vaincu Puiss. ennemie', icone: 'arc', geste: 'Engager le combat' })}
    ${scene(760, 398, { nom: 'Tenez votre position', effet: '−2 Puiss. ennemie', position: 'Point de rupture 0/10', heros: ['greta', 'bjorn'], geste: 'Résoudre', vise: true })}
    ${scene(1120, 446, { nom: 'Motivation', effet: '+1/DR Puiss. alliée', heros: ['aldric'], geste: 'Résoudre' })}
  </div>`);
  pieces.push(billet({ x: 596, y: 246, largeur: 328, pointe: 158, nom: 'Tenez votre position', qui: 'Postés', lignes: [['Greta Hartmann', 'Corps à corps'], ['Bjorn', 'en Soutien'], ['Test opposé', 'chaque Round'], ['Déroute', 'à 10, ou au bout de 5 Rounds']] }));
  pieces.push(armees(50, 55, `<div class="t rubrique">Ce que le Round jouera</div>
    <div class="jouera">${pastille('arc')}Pluie de flèches<span class="rubrique">Tout le groupe</span></div>
    <div class="jouera">${pastille('bouclier')}Tenez votre position<span class="rubrique">Greta, Bjorn</span></div>
    <div class="jouera">${pastille('couronne')}Motivation<span class="rubrique">Aldric</span></div>
    ${plaque('Tirer un facteur (1d10)', { icone: 'des' })}
    ${plaque('Test spectaculaire de Puissance', { armee: true, icone: 'epee', classe: 'grand' })}`));
  pieces.push(bandeau({
    bjorn: { icone: 'bouclier', texte: 'Posté : Tenez votre position' },
    mira: { html: '<span class="attend sombre rubrique">Libre · à poster</span>' },
    aldric: { icone: 'couronne', texte: 'Posté : Motivation' },
    greta: { choisi: true, icone: 'bouclier', texte: 'Postée : Tenez votre position' },
  }));
} else {
  const armee = (cote, nom, seuil, de, dr, perte) => `<div class="ost ${cote}"><div class="sceau de ${dr > 0 ? 'reussite' : ''}"><b>${de}</b><i>d100</i></div>
    <div><div class="n">${nom}</div><div class="c rubrique">Puissance ≤ ${seuil}</div><div class="issue ${dr > 0 ? 'reussite' : ''}"><b>${dr > 0 ? 'Réussite' : 'Échec'} · DR ${dr > 0 ? '+' : '−'}${Math.abs(dr)}</b> · ôte ${perte}</div></div></div>`;
  pieces.push(recit('Le terrain', 'La plaine boueuse s’étend devant les remparts ; la horde dévale la pente en hurlant.').replace('id="recit"', 'id="recit" class="terrain"'));
  pieces.push(armees(42, 35, `<div class="t rubrique">Ce que le Round a joué</div>
    <div class="jouera joue">${pastille('arc')}Pluie de flèches<span class="rubrique">Horde −5</span></div>
    <div class="jouera joue">${pastille('bouclier')}Tenez votre position<span class="rubrique">Horde −2 · rupture 3/10</span></div>
    <div class="jouera joue">${pastille('couronne')}Motivation<span class="rubrique">échouée, aucun effet</span></div>`));
  pieces.push(`<div id="epreuve" class="cadre bois" data-piece="test spectaculaire"><div class="fond parchemin">
    ${armee('', 'Armée des Personnages', '50 + 10', 31, 3, 13)}
    <div class="milieu"><div class="sous rubrique">Round de bataille 1 / 3</div><div class="dr">42 contre 35</div>
      <p data-texte="phrase d'issue">Les Personnages réduisent l’ennemi de 13, l’ennemi réduit les Personnages de 8.</p></div>
    ${armee('droite', 'Horde ennemie', 48, 67, -2, 8)}
    <div class="gestes">${plaque('Rassemblement : Bjorn', { classe: 'large' })}${plaque('Round suivant', { armee: true })}</div>
  </div><div class="ruban gothique">Test spectaculaire de Puissance</div>${ferrures}</div>`);
  pieces.push(bandeau({
    bjorn: { texte: 'a tenu la position aux côtés de Greta' },
    mira: { texte: 'trois flèches au but depuis le rempart' },
    aldric: { texte: 'n’a pas su rallier les blessés' },
    greta: { mal: true, icone: 'goutte', texte: 'blessée en tenant la position' },
  }));
}
pieces.push(coins());
monter(pieces);
