/* La page des soins, images d'intention (#3935, #4411) : le patient, son mal, les actes ; le pied dit ce que l'acte
   coûte et le lance. Le médecin du lieu (`services-du-lieu-medecin.js`) et les soins entre héros
   (`../exploration-et-recit/recit.js`) la posent. Se charge après `commun.js`. Maquette hors du jeu. */
/* un acte de soin : `prix` chez un médecin payant, `ferme` quand personne ne peut le tenter */
const acteDeSoin = (icone, nom, competence, texte, { pris = false, prix = '', ferme = false } = {}) => `<div class="soin ${pris ? 'pris' : ''} ${ferme ? 'ferme' : ''}"><div class="ic">${picto(icone, 19, '#5a2a12')}</div><div class="t"><b>${nom}</b><span class="c">${competence}</span><i>${texte}</i></div>${prix ? `<span class="px lin">${prix}</span>` : ''}</div>`;
const pageDesSoins = ({ ruban, patient, blessures, max, mal = '', actes, pied }) => `<div id="soins" class="page cadre bois" data-piece="soins"><div class="fond parchemin">
  <div class="patient"><div class="etat"><div class="l"><h3 data-texte="patient">${patient}</h3><span class="sous rubrique">Blessures <span class="lin">${blessures} / ${max}</span></span></div><div class="vie"><i style="width:${Math.round(100 * blessures / max)}%"></i></div></div></div>
  ${mal ? `<div class="mal">${sceau('goutte', 12)}<span>${mal}</span></div>` : ''}
  <div class="filet"></div>
  ${actes}
  <div class="filet"></div>
  ${pied}
</div><div class="ruban gothique">${ruban}</div>${ferrures}</div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { acteDeSoin, pageDesSoins });
