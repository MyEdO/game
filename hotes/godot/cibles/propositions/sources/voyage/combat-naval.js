/* Le combat naval : l'écran de combat (`combat/`), la grille sur l'eau, les navires en pièces du champ.
   Test de Manœuvre : MDG 13 l.119 ; en Test d'équipage, ses rôles : MDG 14 l.74-76 ; Mousse par défaut : MDG 14 l.15 ;
   Progression : MDG 13 l.68-75 ; Peu maniable : MDG 12 (`src/data/naval-traits.json`) ; `src/noyau/shipManeuver.ts:1-11`,
   `src/noyau/modalArbiter.ts:178` (une rangée par héros en rôle), `src/noyau/combatSlice.ts:2577` (le virage). */
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
const rangee = (genre, nom, role, seuil) => `<div class="rangee">${portrait(genre, 'heros')}<div class="q" data-texte="rangée ${nom}"><b class="gothique">${nom}</b><span class="rubrique">${role}</span></div><span class="seuil">≤ ${seuil}</span></div>`;
ui.push(bandeauDuJet('Manœuvre', 'avant', `
  ${camp({ portrait: portrait('mira', 'heros'), nom: 'Mira', carac: 'Timonier · Voile', seuil: 41, modif: 'Rôle essentiel ×2' })}
  ${reglages('Test d’équipage · la cogue', `<div class="l rubrique">Virage</div>${options([['Bâbord 45°'], ['Cap tenu'], ['Tribord 45°', { armee: true }]])}
    <div class="enjeux"><span class="modif rubrique">Man de la cogue −1 DR</span><span class="modif rubrique">Peu maniable −1 DR</span></div>`)}
  <div class="rangees"><div class="t rubrique">Chacun lance son jet, les DR s’additionnent</div>
    ${rangee('greta', 'Greta Hartmann', 'Capitaine · Commandement', 44)}${rangee('aldric', 'Aldric', 'Navigateur · Orientation', 52)}${rangee('bjorn', 'Bjorn', 'Mousse · Voile ou Ramer', 31)}</div>`,
  avantLeDe({ heros: HEROS.find((h) => h.id === 'mira') })));
monter(ui);
