/* Le combat naval : l'écran de combat (`combat/`), la grille sur l'eau, les navires en pièces du champ.
   Test de Manœuvre : MDG 13 l.119 ; Progression : MDG 13 l.68-75 ; Peu maniable : MDG 12 (`src/data/naval-traits.json`) ;
   Tir de batterie : MDG 14 l.126-130 ; `src/engine/shipNavigation.ts:50`, `src/noyau/actionsDuNoyau.ts:110`. */
merDeCombat();
{ const g = el(S, 'g'); for (const [i, a] of [[12, .34], [13, .34], [14, .34], [15, .5]]) { const [x, y] = P(i, 5); el(g, 'path', { d: losange(x, y, A - 3, B - 1.5), fill: '#e2c06a', opacity: a, stroke: '#f3dc93', 'stroke-width': 1.5 }); } }
{ const g = el(S, 'g'); for (let i = 7; i <= 10; i++) for (let j = 8; j <= 9; j++) { const [x, y] = P(i, j); el(g, 'path', { d: losange(x, y, A - 3, B - 1.5), fill: '#b9412c', opacity: .22, stroke: '#b9412c', 'stroke-width': 1 }); } }
navire(el(S, 'g'), 9.5, 5, {});
navire(el(S, 'g'), 8.5, 11, { sens: -1, coque: ['#4a4a52', '#2c2c34', '#18181e'], voile: '#16161c' });
voiles();
const ui = [];
ui.push(SYSTEME);
ui.push(`<div id="round" class="cadre bois" data-piece="round"><div class="fond bois"><div class="n gothique">Round 1</div><div class="t rubrique">tour 2<br>sur 6</div></div>${ferrures}</div>`);
ui.push(`<div id="ordre" data-piece="ordre">${[
  rang('mira', 'heros', 'Mira', 11, 11, 'actif'), rang('navire', 'ennemi', 'Cogue pirate', 50, 50), rang('bjorn', 'ennemi', 'Pirate', 12, 12),
  rang('bjorn', 'heros', 'Bjorn', 16, 16), rang('greta', 'heros', 'Greta Hartmann', 8, 14), borne(2), rang('aldric', 'heros', 'Aldric', 12, 12, 'fantome'),
].join('')}</div>`);
ui.push(`<div id="journal" data-piece="journal"><div class="tete rubrique ombre">Journal ${rond('journal', 17)}</div>
  ${borneJ('Le combat commence ! (Round 1)')}${vieux('Aldric relève le cap de la Cogue pirate.')}${neuf('La bordée de la Cogue pirate manque la Cogue des aventuriers.')}</div>`);
ui.push(`<div id="fin" data-piece="fin">${rond('fin', 44)}<span class="rubrique ombre">Fin du tour</span></div>`);
ui.push(...meuble({
  genre: 'mira', nom: 'Mira', sous: 'À la barre de la cogue',
  etat: `${mesure('Blessures', '11 / 11')}${mesure('Coque de la cogue', '50 / 50', 'coque')}${JETONS}`,
  plaques: `${plaque('Manœuvrer', { armee: true, icone: 'barre' })}${plaque('Bordée', { icone: 'canon', fermee: true })}${plaque('Attaque', { icone: 'attaque' })}`,
  pastilles: [['course', 'Course'], ['defensive', 'Défensive'], ['competence', 'Compétence'], ['poser', 'Poser au sol'], ['armes', 'Armes']],
}));
ui.push(`<div id="apercu" class="parchemin" data-piece="apercu" style="left:1068px;top:268px;width:300px">
  <div class="tete"><span class="n gothique">Manœuvre</span><span class="c rubrique">La cogue</span></div>
  <div class="titre rubrique" style="margin-top:8px">Test de Manœuvre · Mira à la barre</div>
  <table>
    <tr class="seuil"><td>Voile</td><td>≤ 41</td></tr>
    <tr><td>Man de la cogue</td><td>−1 DR</td></tr>
    <tr><td>Peu maniable</td><td>−1 DR</td></tr>
    <tr><td>Mouvement de la cogue</td><td>5</td></tr>
  </table>
  <div class="pied">Les degrés de réussite donnent l’avance, de la moitié du Mouvement à Mouvement +2. Un second clic confirme.</div>
</div>`);
monter(ui);
