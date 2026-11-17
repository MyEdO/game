/* Le voyage en mer et ses arrêts (cible écrite `ecrites/voyage.md`). Tests d'équipage : MDG 14 l.10-32, l.61-65 ; vent : MDG 13 l.276-287 ;
   progression du jour : MDG 15 l.78 ; `src/noyau/seaVoyageFlow.ts`, `sv.*` de `src/i18n/messages/fr.ts`. Cadence :
   `src/noyau/voyageEnVue.ts:56`, `ecran.cadence.*`. Relâche à terre : MDG 15 l.245, MDG 14 l.159, l.167, l.192-202 ;
   `src/noyau/seaVoyageFlow.ts:2469`. Conseil de bord : MDG 14 l.139, l.147-179 ; `src/noyau/shipCrew.ts:402-605`,
   `src/data/crew-morale.json`. Fuite de vapeur : MDG 12 l.322-328 ; `src/noyau/seaVoyageFlow.ts:1982-1997`. */
const ETAT = document.getElementById('ecran').dataset.etat;
const ARRET = ETAT !== 'voyage-en-mer';
const AU_PORT = ETAT === 'mer-relache';
poser(interieur(D.mer(ETAT === 'mer-fuite-de-vapeur' ? { navire: false } : { x: 690 })));
if (ARRET) assombrir();
fermer();
const pieces = [];
const SEMAINE = AU_PORT || ETAT === 'mer-conseil-de-bord';
pieces.push(temps(SEMAINE
  ? { teinte: 'soir', jour: 'Aubentag', date: '26 Sigmarzeit · 8ᵉ jour en mer', meteo: AU_PORT ? 'Brise légère, à quai' : 'Brise légère, vent arrière', icone: 'vent' }
  : { teinte: 'gris', jour: 'Wellentag', date: '21 Sigmarzeit · 3ᵉ jour en mer', meteo: 'Brise fraîche, vent latéral', icone: 'vent', cadence: ARRET ? null : 'commande' }));
pieces.push(carteDuTrajet({ titre: 'La mer des Griffes', de: 'Salzenmund', vers: 'Erengrad', part: AU_PORT ? 1 : SEMAINE ? .8 : .3, eau: 'mer' }));
/* le contenant d'événement de la mer : vignette, titre, texte du livre, corps */
const arret = ({ ruban, titre: t, sous, texte, vignette, corps = '', sceau = '', court = false }) => `<div id="evenement" class="cadre bois${court ? ' court' : ''}" data-piece="evenement"><div class="fond parchemin">
    <div class="vignette"><svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#d8c493"/>${vignette}</svg></div>
    <div class="corps"><div class="tete"><h2 data-texte="titre de l'événement">${t}</h2><span class="rubrique">${sous}</span></div>
      <p data-texte="texte du livre">${texte}</p>${corps}
    </div>${sceau}
  </div><div class="ruban gothique">${ruban}</div>${ferrures}</div>`;
const ENCRE = 'fill="#2a1d12"';
if (ETAT === 'mer-relache') {
  pieces.push(arret({ ruban: 'Escale au port', titre: 'Relâche à terre', sous: 'Erengrad · à l’accostage',
    texte: 'Si l’équipage reçoit la permission de faire relâche à terre, lancez 1d100 pour chaque membre d’équipage. Sur un résultat de 04 ou moins, ce membre ne revient pas sur le bateau.',
    vignette: `<rect y="170" width="250" height="80" fill="#b9a26c"/><g ${ENCRE}><path d="M0 150h120v22H0zM18 172h10v60H18zM60 172h10v60H60zM100 172h10v60h-10z"/><path d="M20 150V96h34v54zM62 150v-76l22-22 22 22v76z"/><path d="M150 176h86l-12 26h-62z"/><path d="M190 60h5v116h-5z"/><path d="M160 84c22 6 44 6 66 0 3 26 2 50-2 70-20 6-42 6-62 0-4-20-5-44-2-70z"/></g><g fill="none" stroke="#8c7446" stroke-width="2"><path d="M124 214q16-7 32 0t32 0 32 0M130 232q14-6 28 0t28 0"/></g><circle cx="204" cy="34" r="16" fill="#9c2a1a" opacity=".85"/>`,
    corps: `<div class="choix">${carte('Accorder la relâche', 'Moral +1d10 au prochain conseil · désertion sur 04 ou moins', { armee: true })}${carte('Refuser la relâche', 'Moral –2d10 au prochain conseil · l’équipage reste à bord')}</div>
      ${plaque('Accorder la relâche', { armee: true, classe: 'commet' })}` }));
  pieces.push(bandeau({
    bjorn: { texte: 'compte les marins au bastingage' },
    mira: { texte: 'amarre la cogue au quai des Kislévites' },
    aldric: { texte: 'range les cartes, le port est levé' },
    greta: { texte: 'Capitaine : l’équipage attend sa parole' },
  }));
} else if (ETAT === 'mer-conseil-de-bord') {
  const paie = (nom, moral, solde, o) => carte(nom, `Moral ${moral} · ${solde}`, o);
  pieces.push(arret({ ruban: 'Conseil de bord', titre: 'La paie de la semaine', sous: 'La Sterne · 15 marins · 8ᵉ jour en mer, une semaine à régler',
    texte: 'Un équipage bien dirigé, bien nourri, payé régulièrement et protégé contre le danger et la maladie va sans doute rester fidèle à son capitaine.',
    vignette: `<rect y="176" width="250" height="74" fill="#b9a26c"/><g ${ENCRE}><path d="M30 176h190v14H30zM48 190h12v52H48zM190 190h12v52h-12z"/><path d="M74 176v-30h42v30zM82 146c0-10 6-16 13-16s13 6 13 16z"/><circle cx="150" cy="166" r="10"/><circle cx="172" cy="168" r="8"/><circle cx="160" cy="152" r="8"/><path d="M196 176l6-64h8l6 64z"/></g><path d="M203 104c-8-10 4-14 0-26 10 8 12 18 6 26z" fill="#9c2a1a" opacity=".85"/>`,
    corps: `<div class="reglement"><div class="choix paies">${paie('La paie est régulière', '+1d10', '46 CO 16/–', { armee: true })}${paie(`La paie est généreuse${raison('Bourse insuffisante.')}`, '+2d10', '93 CO 12/–', { fermee: true })}${paie('La paie est chiche', '–2d10', '23 CO 8/–')}${paie('Pas de paie', '–3d10', 'rien')}${plaque('Payer', { armee: true, classe: 'commet' })}</div>
      <div class="qui"><div class="cadre bois"><div class="fond bois">${bourse({ parts: [['Bjorn', '11 CO 14/–', '30 CO'], ['Mira', '11 CO 14/–', '18 CO'], ['Aldric', '11 CO 14/–', '25 CO'], ['Greta', '11 CO 14/–', '12 CO']], total: '46 CO 16/–' })}</div></div></div></div>` }));
  pieces.push(bandeau({
    bjorn: { texte: 'compte les pistoles sur le tonneau' },
    mira: { texte: 'tient le rôle d’équipage' },
    aldric: { texte: 'inscrit la solde au livre de bord' },
    greta: { texte: 'Capitaine : préside le conseil' },
  }));
} else if (ETAT === 'mer-fuite-de-vapeur') {
  const aldric = HEROS.find((h) => h.id === 'aldric');
  pieces.push(arret({ court: true, ruban: 'Panne de vapeur', titre: 'Fuite de vapeur', sous: 'À la chaudière · 3ᵉ jour en mer',
    texte: 'Fuite de vapeur : un jet de vapeur jaillit de la chaudière. La personne qui s’occupe du moteur doit réussir un Test d’Initiative sous peine d’être ébouillantée et de subir 1d10–5 Dégâts (1 minimum), qui ignorent l’Armure.',
    vignette: `<rect y="190" width="250" height="60" fill="#b9a26c"/><g ${ENCRE}><path d="M50 190v-80c0-22 16-36 40-36h30c24 0 40 14 40 36v80z"/><path d="M150 96h46v14h-46zM186 96h12v94h-12z"/><path d="M92 74V42h26v32z"/></g><circle cx="105" cy="136" r="22" fill="#d8c493"/><path d="M105 136l12-12" stroke="#2a1d12" stroke-width="4"/><g fill="none" stroke="#8c7446" stroke-width="3" stroke-linecap="round"><path d="M160 120c20-10 30 6 50-6M162 140c22-8 34 8 58-4M160 160c18-6 30 8 46 0"/></g>`,
    sceau: '<div class="sceau de"><b>47</b><i>d100</i></div>' }));
  pieces.push(bandeauDuJet('Test d’Initiative', '', `
    ${camp({ portrait: portrait('aldric'), nom: 'Aldric', carac: 'Au moteur · Initiative', seuil: 38, modif: 'Intermédiaire (+0)' })}
    ${reglages('Fuite de vapeur · 3ᵉ jour en mer', '<div class="dr gothique">Test simple</div><p>Sinon ébouillanté : 1d10–5 Dégâts (1 minimum), qui ignorent l’Armure.</p>')}
    <div></div>`, avantLeDe({ heros: aldric })));
} else {
  pieces.push(recit('En mer · Journée en mer', 'Brise fraîche par le travers : la cogue vire de bord et garde son cap. L’équipage tient la cadence, la côte du Nordland s’efface.').replace('id="recit"', 'id="recit" class="route"'));
  pieces.push(`<div id="navire" class="cadre bois bord" data-piece="le navire"><div class="fond bois">
    ${ligne('Coque', '<span class="lin">50 / 50</span>')}${jauge(1)}
    ${ligne('Moral', '<span class="lin">75</span>')}${jauge(.75)}
    ${ligne('Eau douce', '<span class="lin">2 900 L</span>')}
    ${ligne('Vivres de l’équipage', '<span class="lin">735 rations</span>')}
  </div><div class="ruban rubrique">La cogue</div>${ferrures}</div>`);
  pieces.push(ouvrir('Dossier du navire', 'coque', 452), ouvrir('Postes de bord', 'cordage', 502));
  pieces.push(frise({ de: 'Salzenmund', vers: 'Erengrad', fait: .3, nuits: [.1, .2], reste: 385, unite: 'milles' }));
  pieces.push(billet({ x: 1010, y: 350, largeur: 300, pointe: 236, nom: 'Progression', qui: 'Test d’équipage', lignes: [['Greta, Capitaine', '+2 DR ×2 = +4'], ['Mira, Timonier', '+1 DR'], ['Aldric, Navigateur', '+1 DR'], ['Somme', '+6 DR']], pied: chanceDe('greta', 'mira', 'aldric') }));
  pieces.push(bandeau({
    bjorn: { icone: 'oeil', texte: 'Vigie : rien que des mouettes à l’horizon' },
    mira: { icone: 'barre', texte: 'Timonier : vire de bord sans perdre le vent' },
    aldric: { icone: 'etoile', texte: 'Navigateur : fait le point à midi, le cap est bon' },
    greta: { icone: 'couronne', texte: 'Capitaine : tient l’équipage à la manœuvre' },
  }));
}
pieces.push(coins());
monter(pieces);
if (ETAT === 'mer-fuite-de-vapeur') clouer(document.getElementById('jet'));
