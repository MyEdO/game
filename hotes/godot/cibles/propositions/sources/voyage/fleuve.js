/* Le voyage fluvial et son péril (cible écrite `ecrites/voyage.md`). Vent : MSRC 7 l.23-39 ; barrage de débris :
   MSRC 7 l.128 ; `src/noyau/riverVoyageFlow.ts`, `fleuve.*` de `src/i18n/messages/fr.ts`. Cadence :
   `src/noyau/voyageEnVue.ts:56`, `ecran.cadence.*`. */
const ETAT = document.getElementById('ecran').dataset.etat;
const PERIL = ETAT === 'voyage-fluvial-peril';
poser(interieur(D.fleuve({ barrage: PERIL })));
if (PERIL) assombrir();
fermer();
const pieces = [];
pieces.push(temps({ teinte: 'jour', jour: 'Festag', date: '16 Pflugzeit · 1ᵉʳ jour de descente', meteo: 'Vent modéré, de côté', icone: 'vent', cadence: PERIL ? null : 'commande' }));
pieces.push(carteDuTrajet({ titre: 'Le Reik', de: 'Grünburg', vers: 'Altdorf', part: PERIL ? .62 : .4, eau: 'fleuve-voie' }));
if (PERIL) {
  const vignette = `<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#d8c493"/>${V.sapins(0, 250, 96, 46, '#8c7446', 6, 14)}<rect y="94" width="250" height="156" fill="#b9a26c"/>
    <g fill="none" stroke="#8c7446" stroke-width="2"><path d="M10 120q30 -8 60 0t60 0M120 230q30 -8 60 0t60 0M20 208q24 -6 48 0"/></g>
    <g fill="#2a1d12"><path d="M20 176l96-40 12 12-88 44zM80 196l150-30 6 14-146 34zM150 150l60-46 12 10-52 50zM36 214h190l14 16H26z"/><path d="M110 138l-16-44 8-3 18 44zM196 160l22-50 9 4-20 50z"/></g>
    <circle cx="52" cy="46" r="20" fill="#9c2a1a" opacity=".85"/></svg>`;
  pieces.push(`<div id="evenement" class="cadre bois" data-piece="evenement"><div class="fond parchemin">
    <div class="vignette">${vignette}</div>
    <div class="corps"><div class="tete"><h2 data-texte="titre de l'événement">Barrage de débris</h2><span class="rubrique">Sur le Reik · 1ᵉʳ jour</span></div>
      <p data-texte="texte du livre">Là où le cours d’eau est étroit ou l’eau est peu profonde, les débris se sont peut-être agglomérés et forment un barrage qui doit être dégagé avant de continuer.</p>
      <div class="choix">${carte('Forcer au bélier', '+10 Dégâts à la coque · 60 / 60', { armee: true })}${carte('Déblayer à la main', 'Du temps perdu · la coque est épargnée')}</div>
      ${plaque('Enfoncer le barrage', { armee: true, icone: 'coque', classe: 'commet' })}
    </div>
  </div><div class="ruban gothique">Péril du fleuve</div>${ferrures}</div>`);
  pieces.push(bandeau({
    bjorn: { texte: 'jauge le courant à la perche' },
    mira: { texte: 'Barre : tient la barge bout au courant' },
    aldric: { texte: 'compte les troncs pris dans le barrage' },
    greta: { texte: 'a déjà ôté ses bottes' },
  }));
} else {
  pieces.push(recit('Sur le Reik · Journée de descente', 'Le vent prend la barge par le travers. Mira louvoie et le capte : la voile porte, le courant fait le reste.').replace('id="recit"', 'id="recit" class="route"'));
  pieces.push(frise({ de: 'Grünburg', vers: 'Altdorf', fait: .4, reste: 27 }));
  pieces.push(billet({ x: 575, y: 374, largeur: 300, nom: 'Navigation', qui: 'Mira · à la barre', lignes: [['Voile', 'Accessible (+20) · 54'], ['Dé', '31'], ['Réussite', '+2 degrés'], ['Vent de côté capté', '+5 % de vitesse']], pied: chanceDe('mira') }));
  pieces.push(bandeau({
    bjorn: { texte: 'sonde le chenal à la perche' },
    mira: { icone: 'barre', texte: 'Barre : louvoie et capte le vent de côté' },
    aldric: { texte: 'suit les bornes du chemin de halage' },
    greta: { texte: 'veille sur la cargaison, à l’avant' },
  }));
}
pieces.push(coins());
monter(pieces);
