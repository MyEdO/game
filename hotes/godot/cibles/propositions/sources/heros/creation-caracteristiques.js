/* Création 3/10 : les Caractéristiques (LDB 05 l.319-464 ; pageDesCaracteristiques, src/noyau/creation/vueDeLaCreation.ts:222).
   États : les jets gardés ; `reassigner`, les dix jets réassignés (l.339) ; `points`, les 100 points répartis (l.341). */
const ETAT = document.getElementById('ecran').dataset.etat ?? '';
const NOMS = ['Capacité de Combat', 'Capacité de Tir', 'Force', 'Endurance', 'Initiative', 'Agilité', 'Dextérité', 'Intelligence', 'Force Mentale', 'Sociabilité'];
/* les dix 2d10 tirés, dans l'ordre du profil ; ce que chaque Caractéristique porte selon la méthode */
const JETS = [11, 8, 7, 13, 14, 10, 16, 12, 9, 15];
const PORTE = { '': JETS, reassigner: [9, 8, 7, 13, 14, 10, 16, 12, 11, 15], points: [9, 8, 7, 13, 14, 10, 16, 10, 4, 5] }[ETAT];
const AUGMENTATIONS = { 2: 0, 4: 2, 6: 3 };
const valeur = (i) => PORTE[i] + 20 + (AUGMENTATIONS[i] ?? 0);
const VISEE = 6;
const caseDuProfil = (i) => `<div class="c ${i === VISEE ? 'carr' : ''}"><span class="ab">${ABR[i + 1]}</span>${ETAT === 'points' ? `<span class="pts nb">${PORTE[i]}</span>` : `<div class="de petit">${PORTE[i]}</div>`}<span class="v">${valeur(i)}</span>${ETAT === 'points' ? pm(PORTE[i] === 18) : ''}</div>`;
const fixe = (ab, v, sous) => `<div class="c"><span class="ab">${ab}</span><span class="pts">${sous}</span><span class="v">${v}</span></div>`;
const blessures = Math.floor(valeur(2) / 10) + 2 * Math.floor(valeur(3) / 10) + Math.floor(valeur(8) / 10);
const repartie = (c, nom, n, sur, total, plein) => `<div class="ligne" style="height:36px">${c ? car(c) : ''}<span class="n" data-texte="${nom}">${nom}</span><div class="clous">${Array.from({ length: sur }, (_, i) => `<i class="${i < n ? 'p' : ''}"></i>`).join('')}</div>${pm(plein)}<span class="val">${total}</span></div>`;
const METHODES = [['Garder les jets', '+50 PX', ''], ['Réassigner les jets', '+25 PX', 'reassigner'], ['Répartir 100 points', '', 'points']];
const ACQUIS_ICI = { '': ['Jets gardés', '+50 PX'], reassigner: ['Jets réassignés', '+25 PX'], points: ['Cent points répartis'] }[ETAT];
const reste = 100 - PORTE.reduce((a, b) => a + b, 0);

poser([
  frise(3),
  gauche(`
    ${rub('Méthode')}
    <div class="onglets-m methodes" style="margin-top:4px">${METHODES.map(([m, px, e]) => plaque(m, { armee: e === ETAT, prix: px })).join('')}</div>
    <div class="tirage-c">${ETAT === 'points'
    ? `<span class="jeton ${reste ? 'cire' : 'or'}">À répartir &nbsp;·&nbsp; ${reste} / 100</span><span class="rub"><span class="note">De quatre à dix-huit points par Caractéristique.</span></span>`
    : `<div class="de moyen">${picto('des', 20, '#2a0906', 1.6)}</div><div style="flex:1">${rub('Les dix 2d10', 'tirés')}</div>${plaque('Relancer les dix 2d10', { prix: 'sans PX', style: 'flex:none;width:262px;height:32px' })}`}</div>
    ${filet({ fondu: true, losange: true })}
    <div style="display:flex;align-items:center;justify-content:space-between">${rub('Augmentations de carrière', 'Artiste Apprentie')}<span class="jeton or">À répartir &nbsp;·&nbsp; 0 / 5</span></div>
    <div class="lignes" style="margin-top:3px">${repartie('F', 'Force', 0, 5, valeur(2), true)}${repartie('I', 'Initiative', 2, 5, valeur(4), true)}${repartie('Dex', 'Dextérité', 3, 5, valeur(6), true)}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:17px">${rub('Destin et Résilience', 'Humains : 2 et 1')}<span class="jeton or">À répartir &nbsp;·&nbsp; 0 / 3</span></div>
    <div class="lignes" style="margin-top:3px">${repartie('', 'Destin', 1, 3, 3, true)}${repartie('', 'Résilience', 2, 3, 3, true)}</div>`),
  centre('Profil', `
    <div class="bande mini profil-c"><div class="fond" style="display:grid">${fixe('M', 4, 'Humains')}${[0, 1, 2, 3, 4].map(caseDuProfil).join('')}${[5, 6, 7, 8, 9].map(caseDuProfil).join('')}${fixe('B', blessures, 'calculé')}</div></div>
    <div class="nom" style="margin-top:13px" data-texte="titre de page">${NOMS[VISEE]}</div>
    <div class="sous">${ETAT === 'points' ? `${PORTE[VISEE]} points` : `${PORTE[VISEE]} aux dés`} + 20 des Humains + 3 Augmentations</div>
    ${ETAT === 'reassigner' ? `<div style="align-self:stretch;margin:11px 0 5px">${rub('Le jet de Dextérité', 'en prendre un autre échange les deux')}</div>
      <div class="jets">${JETS.map((j) => `<div class="jet ${PORTE.indexOf(j) === VISEE ? 'pris' : ''}"><div class="de petit">${j}</div><i>${ABR[PORTE.indexOf(j) + 1]}</i></div>`).join('')}</div>` : ETAT === 'points' ? '<div style="height:8px"></div>' : filet({ fondu: true, losange: true })}
    ${ETAT === 'reassigner' ? '' : `<p class="prose" style="margin-top:2px" data-texte="texte de la caractéristique">Elle indique votre capacité à accomplir des tâches manuelles délicates telles que jouer d'un instrument de musique ou confectionner habilement des objets. Elle vous aide aussi pour les tours de passe-passe ou pour faire les poches.</p>`}
    <div class="faits" style="margin-top:auto"><div class="fait">${rub('Blessures')}<b>BF + (2 × BE) + BFM</b></div><div class="fait">${rub('Chance, Détermination')}<b>Destin, Résilience</b></div></div>`),
  herosNeuf({ acquis: [...ACQUIS.slice(0, 2), ['Caractéristiques', ...ACQUIS_ICI]], pose: .3, refus: reste && ETAT === 'points' ? `Répartition des 100 Points : total ${100 - reste}/100 Points.` : null }),
  groupeEnCreation(),
  coins(),
]);
