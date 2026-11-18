/* L'interlude en ville : entre deux aventures, les activités sont des lieux et des gens de Bögenhafen. */
const LIEUX = [
  { id: 'taverne', nom: 'Taverne d’Altstadt', quoi: 'Dernières nouvelles', choisi: true, fantome: 'mira' },
  { id: 'temple', nom: 'Temple de Verena', quoi: 'Recherche de savoir', heros: 'aldric' },
  { id: 'forge', nom: 'La forge', quoi: 'Passer commande' },
  { id: 'caserne', nom: 'Caserne du Guet', quoi: 'Entraînement au combat', heros: 'greta' },
  { id: 'comptoir', nom: 'Comptoir de change', quoi: 'Opérations bancaires' },
  { id: 'quais', nom: 'Les quais', quoi: 'Revenus', heros: 'bjorn' },
  { id: 'armes', nom: 'Le maître d’armes', quoi: 'Entraînement' },
].map((l) => ({ ...LIEUX_DE_LA_VILLE[l.id], ...l }));
const pieces = [];
pieces.push(cartouche({ icone: 'ville', nom: 'Bögenhafen', sous: 'Entre deux aventures', taille: 'titre', largeur: 400 }));
pieces.push(`<div id="lieu" class="cadre bois" data-piece="lieu"><div class="fond bois">
  <h3 data-texte="lieu">Taverne d’Altstadt</h3>
  <div class="pnj">${portrait('hote')}<div><b>Le tenancier</b><p>Les bateliers parlent, pour peu qu’on paie la tournée.</p></div></div>
  <div class="activite prise">${medaillon('bulle', { taille: 'moyen' })}<div><b>Dernières nouvelles</b><span class="c rubrique">Ragot · une Activité</span><i>Une rumeur venue de loin, et une de plus par degré de réussite.</i></div></div>
  <div class="activite">${medaillon('goutte', { taille: 'moyen' })}<div><b>Semer la dissension</b><span class="c rubrique">Ragot, puis Charme · deux Activités</span><i>Monter le quartier contre un homme, une guilde ou le Guet.</i></div></div>
  ${plaque('Envoyer Mira à la taverne', { armee: true, icone: 'route', classe: 'envoyer' })}
</div>${ruban('Altstadt')}${ferrures}</div>`);
pieces.push(`<div id="carte" class="cadre bois" data-piece="carte"><div class="fond parchemin"><svg viewBox="0 0 844 572" preserveAspectRatio="none"></svg>
  ${LIEUX.map((l) => `<div class="lieu bois ${l.choisi ? 'choisi' : ''}" style="left:${l.x}px;top:${l.y}px">${medaillon(l.icone, { taille: 'petit' })}<div><b>${l.nom}</b><span class="rubrique">${l.quoi}</span></div>${l.heros ? portrait(l.heros, { taille: 'petit' }) : ''}${l.fantome ? portrait(l.fantome, { taille: 'petit', classe: 'fantome' }) : ''}</div>`).join('')}
</div>${ferrures}</div>`);
/* LDB 22 l.5 ; LDB 23 l.5, l.15 ; `src/noyau/interludeEnVue.ts:48-52` */
const restantes = (n) => `<div class="pips">${[0, 1, 2].map((k) => `<i class="${k < n ? '' : 'vide'}"></i>`).join('')}</div>`;
const activites = (id, nom, evenement, n, choisi) => rang(id, { taille: 'petit', choisi, nom, gothique: true, sous: `Événement · ${evenement}`, fin: `<div class="r">${restantes(n)}<span class="rubrique">${n} sur 3</span></div>` });
pieces.push(`<div id="interlude" class="cadre bois" data-piece="interlude"><div class="fond bois">
  <h3>Activités restantes</h3><div class="s rubrique">Une par semaine, trois au plus</div>
  <div class="rangs">
    ${activites('bjorn', 'Bjorn', 'Profits abondants', 1)}
    ${activites('mira', 'Mira', 'Rien à signaler', 2, true)}
    ${activites('aldric', 'Aldric', 'Enchères ésotériques', 1)}
    ${activites('greta', 'Greta', 'Festivités', 2)}
  </div>
  ${filet({ fondu: true })}
  <div class="avis">${sceau('pieces')}<span>À la reprise, les bourses seront vides : seul l’argent déposé au comptoir est gardé.</span></div>
</div>${ruban('L’interlude')}${ferrures}</div>`);
pieces.push(bandeau({
  bjorn: { icone: 'ancre', texte: 'décharge les barges sur les quais' },
  mira: { choisi: true, html: '<span class="attend rubrique">À envoyer en ville</span>' },
  aldric: { icone: 'livre', texte: 'fouille les registres du temple' },
  greta: { icone: 'epee', texte: 's’exerce avec les hommes du Guet' },
}, { bourses: true }));
pieces.push(retour('Reprendre la route', 'sablier'), coins());
monter(pieces);
dessinerLaVille(document.querySelector('#carte svg'), LIEUX);
