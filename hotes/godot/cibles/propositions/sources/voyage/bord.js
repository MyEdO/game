/* Les postes de bord : l'affectation des héros aux rôles du navire, dans la lignée des postes de la halte.
   Rôles et compétences : MDG 14 l.17-32 ; rôles à plusieurs : MDG 14 l.37 ; Mousse facultatif : MDG 14 l.15 ; Moral : MDG 14 l.133-143 ; `src/data/crew-roles.json`, `src/noyau/shipCrew.ts`.
   Station à bord : `src/data/ship-stations.json` (MDG 13 l.714, l.730, l.751), ouverte selon les traits du navire
   (`src/engine/shipCritical.ts:208`), `src/noyau/shipCrew.ts:669`. Activités en mer : MDG 15 l.266-300 ;
   `src/noyau/seaActivities.ts`, `src/data/activities.json`, `sact.*` et `verbe.activitesEnMer.*` de `src/i18n/messages/fr.ts`. */
const ETAT = document.getElementById('ecran').dataset.etat;
poser(interieur(D.mer({ navire: false })));
poser(D.cogue(640, 520, 1.32, {}));
el(S, 'rect', { width: W, height: H, fill: '#080504', opacity: .34 });
fermer();
const pieces = [];
const STATION = ETAT === 'postes-de-bord-station';
const etatDuBord = `${ligne('Moral', '<span class="chiffres">75</span>')}${jauge(.75, { teinte: 'or', taille: 'forte' })}
  ${ligne('Coque', '<span class="chiffres">50 / 50</span>')}${jauge(1, { teinte: 'or', taille: 'forte' })}
  ${ligne('Eau douce', '<span class="chiffres">2 900 L</span>')}
  ${ligne('Vivres de l’équipage', '<span class="chiffres">735 rations</span>')}`;
if (ETAT === 'activites-en-mer') {
  pieces.push(cartouche({ icone: 'cordage', nom: 'Activités de la semaine', sous: 'La Sterne · 8ᵉ jour en mer · une Activité par héros', taille: 'titre', largeur: 492 }));
  pieces.push(`<div data-piece="postes">
  ${poste(628, 198, { nom: 'Aucune Activité', sous: 'La semaine passe', icone: 'sommeil', heros: ['bjorn', 'greta'] })}
  ${poste(360, 328, { nom: 'Commerce d’opportunité', sous: 'Marchandage · Complexe (–10)', heros: 'mira', vise: true })}
  ${poste(840, 328, { nom: 'Cartographie', sous: 'Métier (Cartographe) · Complexe (–10)', heros: 'aldric' })}
  ${poste(628, 474, { nom: `Entraînement d’équipage${raison('L’équipage du navire de campagne est tenu par les PJ — aucun équipage PNJ à entraîner.')}`, sous: 'Commandement · Difficile (–20)', icone: 'couronne', ferme: true })}
</div>`);
  pieces.push(billet({ x: 40, y: 150, largeur: 336, pointe: 272, nom: 'Commerce d’opportunité', qui: 'Test étendu', lignes: [['À atteindre', '10 DR en 3 tentatives'], ['Succès de 6 DR', 'la mise +20 %'], ['Succès', 'la mise +10 %'], ['Échec', 'la moitié de la mise'], ['Échec de 6 DR', 'la mise perdue']] }));
  pieces.push(`<div id="bord" class="cadre bois bord semaine" data-piece="le bord"><div class="fond bois">
  <div class="t rubrique">Commerce d’opportunité · Mira</div>
  <div class="reglage"><span>Mise (CO)</span>${moinsPlus({ entre: '<b class="chiffres">20 CO</b>' })}</div>
  ${ligne('Plafond de la mise', '<span class="chiffres">85 CO</span>')}${ligne('Enc libre du navire', '<span class="chiffres">170</span>')}
  ${filet({ fondu: true })}<div class="t rubrique">Cartographie · Aldric</div>
  <div class="reglage"><span>Planque gratuite (CO)</span>${moinsPlus({ moins: false, entre: '<b class="chiffres">0 CO</b>' })}</div>
  ${filet({ fondu: true })}${plaque('Valider la semaine', { armee: true })}
</div>${ruban('La semaine')}${ferrures}</div>`);
  pieces.push(bandeau({
    bjorn: { texte: 'Aucune Activité' },
    mira: { choisi: true, texte: 'Commerce d’opportunité, 20 CO de mise' },
    aldric: { texte: 'Cartographie, sans planque' },
    greta: { texte: 'Aucune Activité' },
  }));
  pieces.push(retour('Revenir à la traversée', 'route'), coins());
} else {
  pieces.push(cartouche({ icone: 'cordage', nom: 'Postes de bord', sous: 'La cogue · 15 marins · 3ᵉ jour en mer', taille: 'titre', largeur: 452 }));
  pieces.push(`<div data-piece="postes">
    ${poste(628, 58, STATION ? { nom: 'Vigie', sous: 'Perception', icone: 'oeil' } : { nom: 'Vigie', sous: 'Perception', heros: 'bjorn', plus: true })}
    ${poste(628, 198, { nom: 'Mousse', sous: 'Voile ou Ramer', icone: 'cordage' })}
    ${poste(330, 328, { nom: 'Capitaine', sous: 'Commandement', heros: 'greta', vise: true })}
    ${poste(500, 328, { nom: 'Timonier', sous: 'Voile', heros: 'mira' })}
    ${poste(790, 328, { nom: 'Navigateur', sous: 'Orientation', heros: 'aldric' })}
    ${poste(960, 328, { nom: 'Artilleur', sous: 'Projectiles (Poudre noire)', icone: 'canon' })}
    ${poste(450, 458, { nom: 'Cuisinier', sous: 'Métier (Cuisinier)', icone: 'marmite' })}
    ${poste(628, 458, { nom: 'Chirurgien', sous: 'Guérison', icone: 'soin' })}
    ${poste(806, 458, { nom: 'Chansonnier', sous: 'Divertissement (Chant)', icone: 'chant' })}
    ${poste(1010, 458, { nom: 'Repos', sous: 'Aucun rôle', icone: 'sommeil', heros: STATION ? 'bjorn' : [] })}
  </div>`);
  pieces.push(billet({ x: 60, y: 196, pointe: 236, nom: 'Capitaine', qui: 'Rôle essentiel', lignes: [['Compétence', 'Commandement'], ['Test d’équipage', 'Progression'], ['Ses degrés', 'comptent double']] }));
  pieces.push(`<div id="bord" class="cadre bois bord" data-piece="le bord"><div class="fond bois">
    ${etatDuBord}
    ${filet({ fondu: true })}<div class="t rubrique">Ce que la journée jouera</div>
    <div class="jouera">${rond('couronne', 'menu', { arme: true })}Progression<span class="rubrique">Greta · Commandement</span></div>
    <div class="jouera">${rond('etoile', 'menu', { arme: true })}Orientation<span class="rubrique">Aldric · Orientation</span></div>
    <div class="jouera">${rond('cordage', 'menu', { arme: true })}Entretien<span class="rubrique">Les Mousses · Voile ou Ramer</span></div>
  </div>${ruban('Le bord')}${ferrures}</div>`);
  pieces.push(ouvrir('Dossier du navire', 'coque', 356));
  if (STATION) pieces.push(`<div id="station" class="cadre bois bord" data-piece="station"><div class="fond bois">
    <div class="stations">${plaque('Gréement', { taille: 'petite' })}${plaque('Pont', { armee: true, taille: 'petite' })}${plaque('Avirons', { taille: 'petite' })}</div>
    <p data-texte="station">Si un Personnage se trouve sur le pont, il doit réussir un Test d’Athlétisme Accessible (+20) sous peine de subir l’État À Terre.</p>
  </div>${ruban('Station de Greta')}${ferrures}</div>`);
  pieces.push(bandeau({
    bjorn: { texte: STATION ? 'Au repos, aucun rôle' : 'Vigie, au nid-de-pie' },
    mira: { texte: 'Timonier, à la barre' },
    aldric: { texte: 'Navigateur, cartes et sablier' },
    greta: { choisi: true, texte: STATION ? 'Capitaine, sur le pont' : 'Capitaine, sur le château arrière' },
  }));
  pieces.push(retour('Revenir à la traversée', 'route'), coins());
}
monter(pieces);
