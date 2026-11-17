/* Le dossier d'une possession (navire, bête, véhicule), sur le modèle de la fiche lue en combat (`combat/fiche-au-clic`) :
   identité, profil, figure, sections à onglets. Registre et gestes : `src/noyau/possessionsFlow.ts:49-205` ; charge et
   place à bord : `src/engine/possession.ts:115-133`, `:208-244` ; transfert de vrac : `src/noyau/carriers.ts:171-196`,
   `src/noyau/landMarketFlow.ts:225`. Cogue : `src/data/vehicles.json` (MDG 12), traits `src/data/naval-traits.json`, état
   `src/noyau/etat.ts:282`, Moral MDG 14 l.133-143. Mule : `src/data/creatures.json`, `src/data/montures.json` (EDOC 07),
   traits `src/data/traits.json` (LDB 23). Charrette : `src/data/vehicles.json` (LDB 70). Place à bord : MDG 12 l.25-33. */
const ETAT = document.getElementById('ecran').dataset.etat;
Object.assign(BUSTES, {
  mule: '<path d="M18 90c0-20 5-33 13-41-6-8-8-17-6-27l-7-18 11 13c3-2 6-3 10-3s7 1 10 3l10-13-6 18c2 10 0 19-6 27 8 8 14 21 14 41z"/><path d="M33 22c2 8 2 16 0 24M45 22c-2 8-2 16 0 24" stroke="#1c1410" stroke-width="2" fill="none"/>',
  charrette: '<path d="M8 30h54l6 8v20H8z"/><path d="M62 44h14v4H62z"/><circle cx="26" cy="66" r="15" fill="none" stroke="#2a1f17" stroke-width="5"/><path d="M26 51v30M11 66h30M15.500 55.500l21 21M36.500 55.500l-21 21" stroke="#2a1f17" stroke-width="2.500"/>',
});
const FIGURES = {
  navire: `<svg viewBox="-330 -450 680 520">${D.ombreVoile}${D.cogue(0, 0, 1, { coque: '#2a1d12', voile: '#7d2020' })}<path d="M-300 26q60 -12 120 0t120 0 120 0 120 0 120 0" fill="none" stroke="#5f7a80" stroke-width="4"/></svg>`,
  mule: '<svg viewBox="0 0 240 520"><ellipse cx="120" cy="420" rx="92" ry="9" fill="#2a1d12" opacity=".3"/><g fill="#2a1d12"><path d="M52 300c0-34 20-50 56-52h44c22 0 36 10 40 30l4 30-12 2-6-20c-6 10-14 16-26 18H86c-10 0-18-4-22-10z"/><path d="M64 300h14v116H64zM92 318h13v98H92zM150 318h13v98h-13zM176 296h14v120h-14z"/><path d="M60 262l-16-44c-8 2-18 0-26-6l-10-24c-2-6 2-10 8-8l18 8 6-34 10 26 10-28 4 36c8 10 12 24 12 44z"/><path d="M196 290c10 14 12 34 6 60l-8-2c4-22 2-38-6-50z"/></g><path d="M96 250h56l6 40H90z" fill="#7d2020" stroke="#2a1d12" stroke-width="3"/><path d="M84 262h80" stroke="#2a1d12" stroke-width="5"/></svg>',
  charrette: '<svg viewBox="0 0 240 520"><ellipse cx="120" cy="420" rx="100" ry="9" fill="#2a1d12" opacity=".3"/><g fill="#2a1d12"><path d="M30 300h150l14 20v46H30z"/><path d="M190 334h44v8h-44z"/><path d="M36 300l-8-40h10l10 40zM172 300l8-40h-10l-10 40z"/></g><g fill="none" stroke="#2a1d12"><circle cx="96" cy="372" r="44" stroke-width="10"/><path d="M96 328v88M52 372h88M65 341l62 62M127 341l-62 62" stroke-width="5"/></g><circle cx="96" cy="372" r="9" fill="#2a1d12"/></svg>',
};
const trait = (dessin, nom, texte) => `<div class="arme trait">
    <div class="vignette laiton"><div><svg viewBox="0 0 24 24" fill="none" stroke="#e2c06a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${dessin}</svg></div></div>
    <div class="texte"><div class="n gothique">${nom}</div><p data-texte="trait ${nom}">${texte}</p></div></div>`;
const etat = (lab, val) => `<div class="etat-n"><span class="rubrique">${lab}</span><b class="lineale">${val}</b></div>`;
const barre = (nom, valeur, classe = '', style = '') => { const [a, b = 100] = valeur.split(' / '); return `<div class="mesure" style="${style}"><div class="tete rubrique"><span>${nom}</span><b class="lineale">${valeur}</b></div><div class="vie ${classe}"><i style="width:${100 * a / b}%"></i></div></div>`; };
/* le nom de l'instance : lu, ou en saisie (chaque frappe joue `renommerLaPossession`) */
const nomme = (nom, saisie) => (saisie
  ? `<div class="saisie n gothique" data-texte="nom en saisie">${nom}<i></i></div>`
  : `<div class="n gothique">${nom}</div>`);
/* où se trouve la possession, et les gestes qui la déplacent ; `confirme` : l'abandon demandé attend sa confirmation */
const lieuEtGestes = (ou, gestes, suite = '') => `<div class="ou"><div class="l"><span class="rubrique">Se trouve</span><b>${ou}</b></div>
  <div class="plaques">${gestes}</div>${suite}</div>`;
const dossier = ({ genre, nom, saisie = false, lignes, mesures, medaillons, titre, profil, onglets, ouvert, section }) => `<div id="dossier">
<div id="f-identite" class="cadre bois" data-piece="dossier-identite"><div class="fond parchemin">
  <div class="tete">${portrait(genre, 'heros')}<div>${nomme(nom, saisie)}${lignes.map((l) => `<div class="c rubrique">${l}</div>`).join('')}<div class="renommer${saisie ? ' en-saisie' : ''}">${rond('plume', 13)}<span class="rubrique">Renommer</span></div></div></div>
  ${mesures.map(([n, v, c], k) => barre(n, v, c, k ? 'margin-top:14px' : '')).join('')}
  <div class="orne"><i></i><b></b><i></i></div>
  <div class="reserves">${medaillons.map(([n, t]) => medaillon(n, t)).join('')}</div>
</div>${ferrures}</div>
<div id="f-profil" class="cadre bois" data-piece="dossier-profil"><div class="fond parchemin" style="grid-template-columns:repeat(${profil.length},1fr)">
  ${profil.map(([a, v]) => `<div class="carac"><span class="rubrique">${a}</span><b class="lineale">${v}</b></div>`).join('')}
</div><div class="ruban titre">${titre}</div>${ferrures}</div>
<div id="f-figure" class="cadre bois" data-piece="dossier-figure"><div class="fond bois"><div class="niche laiton"><div>${FIGURES[genre]}</div></div></div>${ferrures}</div>
<div id="f-sections" class="cadre bois" data-piece="dossier-sections"><div class="fond parchemin">
  ${section}
</div><div class="onglets">${onglets.map((t) => (t === ouvert ? `<div class="ruban titre">${t}</div>` : plaque(t))).join('')}</div>${ferrures}</div>
</div>`;
const STERNE = {
  genre: 'navire', nom: 'La Sterne', lignes: ['Cogue', 'Navire à voile', '25 mètres · 300 CO'],
  mesures: [['Coque', '50 / 50'], ['Moral', '75', 'or']], medaillons: [[15, 'Équipage'], [8, 'Aux voiles'], [4, 'Héros à un poste']],
  titre: 'Profil du navire', profil: [['M', 5], ['E', 45], ['B', 50], ['Man', '−1'], ['Équipage', 15], ['Capacité', 300]],
  onglets: ['État', 'Équipage', 'Cargaison', 'Améliorations'],
};
const titreDeBloc = (t, droite = '') => `<div class="bloc-t"><span class="rubrique">${t}</span>${droite}</div>`;
const DOSSIERS = {
  'dossier-du-navire': () => ({ ...STERNE, ouvert: 'État', section: `
  ${trait(PICTOS.barre, 'Peu maniable', 'Chaque niveau impose une pénalité de –1 DR sur tous les Tests de Ramer et de Voile.')}
  ${trait(PICTOS.coque, 'Robuste', 'Un navire Robuste reçoit +2 DR sur ses Tests d’équipage d’Affaler les voiles.')}
  <div class="etats">${etat('Eau douce', '2 900 L')}${etat('Vivres de l’équipage', '735 rations')}${etat('Salissures', 'aucune')}${etat('Avaries', 'aucune')}</div>` }),
  /* la cale : un lot se choisit, puis son porteur, puis la quantité ; la plaque commet (`deplacerLaCargaison`) */
  'dossier-du-navire-cargaison': () => ({ ...STERNE, ouvert: 'Cargaison', section: `
  ${barre('Cale', '130 / 300', 'or')}
  ${titreDeBloc('Lots en cale')}
  <div class="cartes">${carte('Laine', '60 Enc', { classe: 'courte' })}${carte('Sel', '40 Enc', { armee: true, classe: 'courte' })}${carte('Métaux', '30 Enc', { classe: 'courte' })}</div>
  ${titreDeBloc('Déplacer le sel vers', '<i>les porteurs qui sont là où est le navire</i>')}
  <div class="cartes">${carte('Charrette', 'de Bjorn · 0 / 25 Enc', { armee: true, portrait: portrait('charrette', 'heros') })}
    <div class="quantite">${moinsPlus({ plus: false, entre: '<b class="lineale">25 Enc</b>' })}<span class="rubrique">sur 40 · 25 de place</span>${plaque('Déplacer', { armee: true })}</div></div>
  ${titreDeBloc('À bord', '<b class="lineale">15 / 300 Enc</b>')}
  <div class="embarquee">${portrait('mule', 'heros')}<div class="qui"><div class="n gothique">Marguerite</div><div class="c rubrique">Mule de Bjorn · 15 Enc à bord</div></div>${plaque('Débarquer')}</div>` }),
  /* la bête avec le groupe, son nom en saisie ; « Embarquer » armé ouvre le choix de la cale */
  'dossier-de-la-bete': () => ({
    genre: 'mule', nom: 'Marguerit', saisie: true, lignes: ['Mule', 'Bête de Bjorn', '5 CO'],
    mesures: [['Blessures', '12 / 12'], ['Charge', '9 / 14', 'or']], medaillons: [[14, 'Enc de charge'], [6, 'Enc de place à bord'], [4, 'Mouvement']],
    titre: 'Profil de la bête', profil: [['M', 4], ['CC', 25], ['CT', '–'], ['F', 30], ['E', 45], ['I', 20], ['Ag', 30], ['Dex', '–'], ['Int', 10], ['FM', 10], ['Soc', 10], ['B', 12]],
    onglets: ['État', 'Charge'], ouvert: 'État', section: `
  ${trait('<path d="M4 17h13l3-4M6 17a2 2 0 1 0 .1 0M15 17a2 2 0 1 0 .1 0M4 13V8h9v5M13 10h4l3 3"/>', 'Dressé (Trait)', 'L’animal est entraîné à tirer un carrosse, un chariot, une charrue, une carriole ou similaire.')}
  ${trait('<path d="M12 3l2 5 5-2-3 5 5 2-5 2 2 5-5-3-3 4-1-5-5 1 4-4-4-3 5-1z"/>', 'Nerveux', 'La créature est facilement effrayée par la magie ou les bruits forts. Si cela se produit, elle gagne +3 État Brisé.')}
  ${lieuEtGestes('Avec le groupe · Salzenmund', `${plaque('Laisser ici')}${plaque('Embarquer', { armee: true })}${plaque('Abandonner')}`, `
  ${titreDeBloc('Embarquer sur', '<i>les navires du groupe qui ont la place</i>')}
  <div class="cartes">${carte('La Sterne', 'Cogue · 0 / 300 Enc à bord', { armee: true, portrait: portrait('navire', 'heros') })}
    <div class="quantite"><span class="rubrique">Marguerite et sa charge · 15 Enc</span>${plaque('Embarquer sur La Sterne', { armee: true })}</div></div>`)}` }),
  /* le véhicule remisé : « Reprendre » ; l'embarquement fermé dit sa raison au survol ; l'abandon se confirme */
  'dossier-du-vehicule': () => ({
    genre: 'charrette', nom: 'Charrette', lignes: ['Charrette', 'Véhicule de Bjorn', '20 CO'],
    mesures: [['Chargement', '0 / 25', 'or']], medaillons: [[25, 'Enc de chargement'], [10, 'Enc du véhicule'], [1, 'Bête de trait']],
    titre: 'Profil du véhicule', profil: [['Enc', 10], ['Chargement', 25], ['Attelage', '1 bête']],
    onglets: ['État', 'Chargement'], ouvert: 'État', section: `
  <p class="livre" data-texte="texte du livre">Les charrettes sont de petits véhicules à deux roues de toutes sortes, y compris les charrettes à âne, les chars et les cabriolets. Les charrettes de passagers comprennent une banquette pouvant accueillir jusqu’à deux personnes, tandis que celles qui transportent des marchandises ont un siège plus petit avec un côté ouvert pour le chargement. Les charrettes sont tirées par un seul animal. Des bras dépassent de chaque côté du châssis, auxquels est attaché un harnais, ou un collier.</p>
  ${lieuEtGestes('À l’écurie · Salzenmund', `${plaque('Reprendre')}${plaque(`Embarquer${raison('Cette possession doit être avec le groupe pour embarquer.')}`, { fermee: true })}${plaque('Abandonner', { armee: true })}`, `
  ${titreDeBloc('Abandonner la charrette')}
  <div class="plaques confirme">${plaque('Confirmer l’abandon', { armee: true })}${plaque('Annuler')}</div>`)}` }),
};
poser(interieur(D.mer({ navire: false })));
el(S, 'rect', { width: W, height: H, fill: '#06040a', opacity: .5 });
voiles();
monter([dossier(DOSSIERS[ETAT]()), croix(), SYSTEME]);
