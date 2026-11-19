/* Création 7/10 : les Talents (LDB 05 l.484, l.514-531, l.535 ; species.json, careerLevels.json, talents.json).
   États : `doublon`, un Talent tiré déjà possédé (l.484) ; `sorts-mineurs`, les sorts que Magie mineure inclut (LDB 10 l.714 ;
   pageDesTalents, src/noyau/creation/vueDeLaCreation.ts:306). */
const ETAT = document.getElementById('ecran').dataset.etat ?? '';
const SORCIERE = ETAT === 'sorts-mineurs';
const tire = (jet, nom, extra = '') => `<div style="display:flex;align-items:center;gap:11px;height:47px"><div class="de petit">${jet}</div><div class="ligne" style="flex:1;border-bottom:1px solid rgba(60,40,20,.28)"><span class="n" data-texte="${nom}">${nom}</span>${extra}</div></div>`;
const option = (nom, { choisie = false, refus = '' } = {}) => `<div class="ligne ${choisie ? 'choisie' : ''} ${refus ? 'refusee' : ''}">${choisie ? picto('coche', 15, '#2a1d12', 2) : '<i class="losange"></i>'}<span class="n" data-texte="${nom}">${nom}</span>${refus ? raison(refus) : ''}</div>`;
const MINEURS = ['Alerte', 'Amitié animale', 'Bruits', 'Choc', 'Conservation', 'Coup de vent', 'Créer un petit animal', 'Drain', 'Éblouissant', 'En catimini', 'Feux follets', 'Flamme magique', 'Fléchette', 'Lumière', 'Murmures', 'Pas léger', 'Protection contre la pluie', 'Purification de l\'eau', 'Putréfaction', 'Repères', 'Secousse', 'Serrure ouverte', 'Sommeil', 'Source', 'Tendre l\'oreille'];
const RETENUS = ['Fléchette', 'Lumière', 'Sommeil'];
const pageDuTalent = `
    <div style="margin-top:16px">${medaillon('poing')}</div>
    <div class="nom" style="margin-top:8px" data-texte="titre de page">Infatigable</div>
    <div class="sous">Artiste Apprentie</div>
    ${filet({ fondu: true, losange: true })}
    <div class="faits" style="margin-top:2px">
      <div class="fait">${rub('Maxi')}<b>Bonus de Force</b></div>
      <div class="fait">${rub('Tests')}<b>Ramer et Natation</b></div>
    </div>
    <p class="prose" style="margin-top:15px" data-texte="texte du talent">Vous avez l'échine solide, rompue au dur labeur. Vous pouvez ajouter vos Niveaux d'Infatigable à votre DR dans tous les Tests opposés de Force et vous pouvez porter un nombre de Points supplémentaires d'Encombrement (voir p293) équivalent à votre Niveau d'Infatigable.</p>
    <svg class="filigrane" width="92" height="92" viewBox="0 0 100 100" fill="none" stroke="rgba(90,58,28,.45)" stroke-width="1"><circle cx="50" cy="30" r="22"/><circle cx="50" cy="70" r="22"/><circle cx="30" cy="50" r="22"/><circle cx="70" cy="50" r="22"/><path d="M50 38l12 12-12 12-12-12z"/></svg>`;
const pageDesSorts = `
    <div class="nom" style="margin-top:22px" data-texte="titre de page">Magie mineure</div>
    <div class="sous">Sorcière novice</div>
    <div style="align-self:stretch;display:flex;align-items:center;justify-content:space-between;margin-top:14px">${rub('Magie mineure (3 sorts)')}<span class="jeton or">À répartir &nbsp;·&nbsp; 0 / 3</span></div>
    <div class="pills mineurs" style="align-self:stretch;margin-top:9px">${MINEURS.map((m) => (RETENUS.includes(m) ? `<span class="pill prise">${m}</span>` : `<span class="pill fermee">${m}${m === 'Secousse' ? raison('Plus rien à répartir.') : ''}</span>`)).join('')}</div>
    <p class="prose" style="margin-top:auto" data-texte="texte du talent">Quand vous prenez ce Talent, vous pratiquez, et mémorisez de façon permanente, un nombre de Sorts égal à votre Bonus de Force Mentale.</p>`;
const ACQUIS_ICI = SORCIERE ? [ACQUIS[0], ['Carrière · Lettrés', 'Sorcière', '+50 PX'], ...ACQUIS.slice(2)] : ACQUIS;

poser([
  frise(7),
  gauche(`
    ${rub('Talents de race')}
    <div class="deux" style="margin-top:3px;align-items:end">
      <div class="ligne">${coche()}<span class="n">Destinée</span><span class="raison" style="color:#5a3a1c">Acquis</span></div>
      <div></div>
    </div>
    <div style="margin-top:13px">${rub('Au choix')}</div>
    <div class="deux" style="margin-top:3px">${option('Affable')}${option('Perspicace', { choisie: true })}</div>
    <div style="margin-top:15px">${rub('Trois Talents au d100')}</div>
    ${tire(15, 'Artiste <small>(Peinture)</small>', `<span class="pill" style="height:20px">Utilisation ${picto('chevron_d', 12, '#3a2a18', 2)}</span>`)}
    ${ETAT === 'doublon' ? tire(68, 'Perspicace', `<span class="raison">Maxi atteint : sans effet si gardé</span>${plaque('Relancer Perspicace', { style: 'flex:none;width:168px', taille: 'petite' })}`) : tire(24, 'Chanceux')}
    ${tire(99, 'Vivacité')}
    ${filet({ fondu: true, losange: true })}
    ${rub('Talent de carrière', 'un seul')}
    <div class="deux" style="margin-top:3px">
${SORCIERE
    ? `<div class="lignes">${option('Harmonisation aethyrique')}${option('Lire/Écrire')}</div>
      <div class="lignes">${option('Magie mineure', { choisie: true })}${option('Seconde vue')}</div>`
    : `<div class="lignes">${option('Artiste <small>(Au choix)</small>')}${option('Infatigable', { choisie: true })}</div>
      <div class="lignes">${option('Persévérant')}${option('Vivacité', { refus: 'Maxi atteint' })}</div>`}
    </div>`),
  centre('Talent de carrière', SORCIERE ? pageDesSorts : pageDuTalent),
  herosNeuf({ acquis: [...ACQUIS_ICI, ['Compétences', 'Six de race, huit de carrière'], ['Talents', 'Six acquis']], pose: .7 }),
  groupeEnCreation(SORCIERE ? { car: 'Sorcière' } : {}),
  coins(),
]);
