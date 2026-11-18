/* Progression : l'identité de la fiche, portant l'expérience et ce que le niveau exige (LDB 07 l.118-131). */
const exige = (fait, texte, cpt = '') => `<div class="exige">${fait ? coche() : '<i class="trou"></i>'}<span>${texte}</span>${cpt ? `<span class="cpt">${cpt}</span>` : ''}</div>`;
const identite = ({ px, apres = '', niveau, rang, exigences, pied }) => cadre('identite', 26, 20, 400, 588, 'parchemin', `
  <div class="tete">${portrait('ilyanwe', { taille: 'affiche' })}
    <div style="flex:1;min-width:0"><div class="nom" data-texte="nom">Ilyanwe<br>la Voilée</div><div class="l" style="margin-top:8px">Hauts elfes</div><div class="l">${niveau}</div><div class="l">Lettrés · niveau ${rang}</div></div>
  </div>
  <div class="bourse-px" style="margin-top:18px"><div class="px laiton"><div>${px}</div></div><div><b>PX à dépenser</b>${apres ? `<span class="rub"><span class="note">${apres}</span></span>` : ''}</div></div>
  ${filet({ fondu: true, losange: true })}
  ${rub(`Pour achever ${niveau}`)}
  <div style="margin-top:5px">${exigences.map((e) => exige(...e)).join('')}</div>
  <div style="margin-top:14px">${pied}</div>`, { classe: 'pan ident' });
// Partagé avec les scripts de page chargés après celui-ci.
Object.assign(globalThis, { identite });
