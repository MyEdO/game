/* Fiche, section « Possessions » : les sets d'armes, les objets du héros et la ligne pressée, ouverte, dont les
   gestes sont ceux que sert `gestesDeLObjet` (src/noyau/gestesDeLObjet.ts). États : une arme, un composant à lier
   (LDB 46 l.113), une prothèse (LDB 73 l.19-23), une Faveur (LDB 23 l.141-151). */
const ETAT = document.getElementById('ecran').dataset.etat;
const ENCRE = '#2a1d12';

/* une main d'un set : [pictogramme, nom] ou vide ; `fermee` : l'arme de l'autre main se tient à deux mains */
const mainDuSet = (libelle, arme, fermee = false) => `<div class="main ${arme ? '' : 'vide'} ${fermee ? 'refusee' : ''}"><i>${libelle}</i>${arme ? `${picto(arme[0], 16, ENCRE, 1.5)}<b>${arme[1]}</b>` : `<b>${fermee ? 'Prise' : 'Vide'}</b>`}</div>`;
/* un set d'armes : `enMain` = le set actif ; `oter` = le refus de le supprimer, `survole` le dit */
const setDArmes = ({ main, secondaire = null, enMain = false, deuxMains = false, oter = '', survole = false }) => `<div class="set ${enMain ? 'en-main' : ''}">
  ${mainDuSet('Main principale', main)}${mainDuSet('Main secondaire', secondaire, deuxMains)}
  <div class="oter">${rond('croix', 'menu', oter ? { ferme: true } : { arme: true })}${survole ? raison(oter) : ''}</div></div>`;
const sets = (liste) => `<div class="tete-de-liste">${rub("Sets d'armes", 'celui que le héros tient est cerné de laiton')}</div>
  <div class="sets">${liste.map(setDArmes).join('')}<div class="set neuf">${picto('plus', 18, '#4a3420', 1.8)}</div></div>`;
const objet = (icone, nom, etat, { vise = false, sous = '' } = {}) => `<div class="ligne ${vise ? 'choisie' : ''}">${picto(icone, 17, ENCRE, 1.5)}<span class="n" data-texte="${nom} ${sous}">${nom}${sous ? ` <small>(${sous})</small>` : ''}</span><span class="raison" style="color:#5a3a1c">${etat}</span></div>`;
const faveur = (creancier, niveau, { vise = false } = {}) => `<div class="ligne ${vise ? 'choisie' : ''}">${sceau('parchemin', 'menu')}<span class="n" data-texte="${creancier}">${creancier}</span><span class="raison">${niveau}</span></div>`;
/* la ligne pressée, ouverte : son cartouche, puis ses gestes en plaques */
const ouvert = ({ icone, nom, sous, corps = '', gestes }) => `<div class="ouvert">
  ${cartouche({ icone, nom, sous, texte: 'objet ouvert' })}
  ${corps}<div class="gestes-o">${gestes.join('')}</div></div>`;
const large = 'grid-column:1 / -1';
const mesure = (r, v) => `<div class="fait">${rub(r)}<b>${v}</b></div>`;
const palier = (fait, texte, prix) => `<div class="achat">${fait ? coche() : '<i class="trou"></i>'}<span class="n" data-texte="${texte}">${texte}</span>${fait ? `<span class="rub">${prix} · acquis</span>` : plaque(prix, { taille: 'petite' })}</div>`;

const D_ILYANWE = {
  sets: [
    { main: ['baton', 'Bâton de combat'], enMain: true, deuxMains: true },
    { main: ['dague', 'Dague'] },
  ],
  portes: [['baton', 'Bâton de combat', 'En main'], ['habit', 'Robe', 'Portée'], ['sac', 'Sac à dos', 'Porté']],
  vrac: (vise) => [
    objet('dague', 'Dague', 'Second set', { vise: vise === 'dague' }), objet('livre', 'Grimoire', 'Dans : Sac à dos'), objet('parchemin', 'Licence magique', 'Dans : Sac à dos'),
    objet('fiole', "Composant d'incantation", 'Mur de feu'), objet('fiole', "Composant d'incantation", 'À lier', { vise: vise === 'composant' }),
  ],
};
const D_BERTA = {
  sets: [{ main: ['epee', 'Arme simple'], secondaire: ['bouclier', 'Bouclier'], enMain: true, oter: "Dernier set d'armes — un héros en garde toujours un.", survole: ETAT === 'prothese' }],
  portes: (vise) => [
    objet('epee', 'Arme simple', 'En main'), objet('bouclier', 'Bouclier', 'En main'), objet('habit', 'Veste de cuir', 'Portée'),
    objet('jambe', 'Fausse jambe', 'Portée', { vise: vise === 'prothese' }), objet('sac', 'Sac à dos', 'Porté'),
  ],
  vrac: [objet('dague', 'Dague', 'Dans : Sac à dos'), objet('vivres', 'Vivres, 1 jour', '× 3')],
};
const SPELLS = [['Carreau', 4, true], ['Cautériser', 4], ['Dôme', 7], ['Mur de feu', 6]];
const OUVERTS = {
  arme: () => ouvert({ icone: 'dague', nom: 'Dague', sous: 'Arme de mêlée · Base',
    corps: `<div class="faits">${mesure('Dégâts', '+BF+2')}${mesure('Allonge', 'Très courte')}${mesure('Enc.', '<span class="chiffres">0</span>')}</div>`,
    gestes: [plaque('Main principale', { taille: 'petite' }), plaque(`Main secondaire${raison('Arme à deux mains — pas de seconde main.')}`, { fermee: true, taille: 'petite' }), plaque('Ranger dans', { prix: 'Sac à dos', taille: 'petite' }), plaque('Donner à', { prix: 'Berta', taille: 'petite' }), plaque('Poser au sol', { style: large, taille: 'petite' })] }),
  composant: () => ouvert({ icone: 'fiole', nom: "Composant d'incantation", sous: 'À lier',
    corps: `<div class="tete-de-liste">${rub('Lier à un sort', "d'Arcane ou de Domaine, connu")}</div>
      <div class="deux" style="column-gap:12px">${SPELLS.map(([n, ni, choisi]) => `<div class="ligne ${choisi ? 'choisie' : ''}">${choisi ? picto('coche', 14, ENCRE, 2) : '<i class="losange"></i>'}<span class="n" data-texte="${n}">${n}</span><span class="cout">NI ${ni}</span></div>`).join('')}</div>`,
    gestes: [plaque('Lier à Carreau', { armee: true, style: large, taille: 'petite' }), plaque('Ranger dans', { prix: 'Sac à dos', taille: 'petite' }), plaque('Donner à', { prix: 'Berta', taille: 'petite' }), plaque('Poser au sol', { style: large, taille: 'petite' })] }),
  prothese: () => ouvert({ icone: 'jambe', nom: 'Fausse jambe', sous: 'Prothèse · portée',
    corps: `<div class="tete-de-liste" style="display:flex;justify-content:space-between;align-items:center">${rub("S'entraîner")}<span class="jeton or">240 PX à dépenser</span></div>
      ${palier(true, 'récupérer le dernier Point de Mouvement perdu', '100 PX')}${palier(false, 'réapprendre à utiliser Esquive', '200 PX')}`,
    gestes: [plaque('Porter', { icone: 'coche', taille: 'petite' }), plaque('Donner à', { prix: 'Ilyanwe', taille: 'petite' }), plaque('Poser au sol', { style: large, taille: 'petite' })] }),
  faveur: () => ouvert({ icone: 'parchemin', nom: 'Faveur Majeure', sous: 'Due au capitaine Blucher',
    corps: `<p class="prose" style="font-style:italic;margin-top:9px" data-texte="nature de la Faveur">Escorter son chariot de solde jusqu’à Weissbruck.</p>
      <div class="achat" style="margin-top:6px"><span class="n">Activités consécutives à l’interlude</span><span class="val">1 / 2</span></div>`,
    gestes: [`<div class="rub" style="${large};color:#6b1c10">Rompre : Niveau de carrière réduit de 1</div>`, plaque('Rompre la Faveur', { style: large, taille: 'petite' })] }),
};

const liste = ETAT === 'arme' || ETAT === 'composant'
  ? `${rub('Porté')}<div class="lignes">${D_ILYANWE.portes.map((o) => objet(...o)).join('')}</div>
     <div class="tete-de-liste">${rub('En vrac et rangé')}</div><div class="lignes">${D_ILYANWE.vrac(ETAT).join('')}</div>`
  : `${rub('Porté')}<div class="lignes">${D_BERTA.portes(ETAT).join('')}</div>
     <div class="tete-de-liste">${rub('En vrac et rangé')}</div><div class="lignes">${D_BERTA.vrac.join('')}</div>
     <div class="tete-de-liste">${rub('Faveurs dues')}</div><div class="lignes">${faveur('Capitaine Blucher', 'Majeure · 1 / 2', { vise: ETAT === 'faveur' })}</div>`;
const D = ETAT === 'arme' || ETAT === 'composant' ? D_ILYANWE : D_BERTA;
poser(fiche(D === D_ILYANWE ? 'ilyanwe' : 'berta', 'Possessions', `${sets(D.sets)}
  <div class="possessions"><div class="liste">${liste}</div>${OUVERTS[ETAT]()}</div>`));
