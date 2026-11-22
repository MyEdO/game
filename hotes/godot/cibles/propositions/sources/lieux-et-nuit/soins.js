/* La page des soins, images d'intention (#3935, #4411) : le patient, son mal, les actes ; ce que l'acte coûte au pied
   du corps (`pied`, `colonne`), le geste qui le lance au pied fixe. Le médecin du lieu et les soins entre héros (`../rendu.js`, écran `soins`)
   la posent. Se charge après `commun.js`. Maquette hors du jeu. */
/* un acte de soin : son Test, son prix, ce qu'il fait (ou la raison qui le ferme) dans la bulle du survol (fiche
   `user-doctrine-icone-identifie-survol-detaille`) ; `prix` chez un médecin payant, `ferme` quand personne ne peut le tenter */
const acteDeSoin = (icone, nomme, competence, texte, { pris = false, prix = '', ferme = false } = {}) => `<div class="soin ${pris ? 'pris' : ''} ${ferme ? 'ferme' : ''}"><div class="ic">${picto(icone, 19, '#5a2a12')}</div><div class="t">${nom({ texte: nomme })}<span class="c">${competence}</span></div>${prix ? `<span class="px chiffres">${prix}</span>` : ''}${raison(texte, { survolee: false })}</div>`;
const pageDesSoins = ({ ruban: intitule, patient, blessures, max, mal = '', actes, paie = '', geste, note = '' }) => `<div id="soins" class="page cadre bois" data-piece="page"><div class="fond parchemin">${colonne('page', {
  tete: `<div class="patient"><div class="etat"><div class="l">${titre({ texte: patient, cle: 'patient' })}${sousTitre({ texte: `Blessures <span class="chiffres">${blessures} / ${max}</span>` })}</div>${jauge(blessures / max, { taille: 'forte' })}</div></div>`,
  corps: `${mal ? `<div class="mal">${sceau('goutte', 'menu')}<span>${mal}</span></div>` : ''}${filet()}${actes}`,
  pied: paie && `<div class="paie">${paie}</div>`, geste, note })}</div>${ruban(intitule)}${ferrures}</div>`;
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { acteDeSoin, pageDesSoins });
