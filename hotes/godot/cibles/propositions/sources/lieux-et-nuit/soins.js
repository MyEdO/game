/* La page des soins, images d'intention (#3935, #4411) : le patient, son mal, les actes ; le pied dit ce que l'acte
   coûte et le lance. Le médecin du lieu et les soins entre héros (`../rendu.js`, écran `soins`)
   la posent. Se charge après `commun.js`. Maquette hors du jeu. */
/* un acte de soin : `prix` chez un médecin payant, `ferme` quand personne ne peut le tenter */
const acteDeSoin = (icone, nom, competence, texte, { pris = false, prix = '', ferme = false } = {}) => `<div class="soin ${pris ? 'pris' : ''} ${ferme ? 'ferme' : ''}"><div class="ic">${picto(icone, 19, '#5a2a12')}</div><div class="t"><b>${nom}</b><span class="c">${competence}</span><i>${texte}</i></div>${prix ? `<span class="px chiffres">${prix}</span>` : ''}</div>`;
const pageDesSoins = ({ ruban: intitule, patient, blessures, max, mal = '', actes, pied }) => `<div id="soins" class="page cadre bois" data-piece="soins"><div class="fond parchemin">
  <div class="patient"><div class="etat"><div class="l"><h3 data-texte="patient">${patient}</h3><span class="sous rubrique">Blessures <span class="chiffres">${blessures} / ${max}</span></span></div>${jauge(blessures / max, { taille: 'forte' })}</div></div>
  ${mal ? `<div class="mal">${sceau('goutte', 'menu')}<span>${mal}</span></div>` : ''}
  ${filet()}
  ${actes}
  ${filet()}
  ${pied}
</div>${ruban(intitule, { gothique: true })}${ferrures}</div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { acteDeSoin, pageDesSoins });
