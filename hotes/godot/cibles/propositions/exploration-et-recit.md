# Propositions : exploration et récit (2026-11-16, #3935)

Compte rendu des six écrans dessinés sans cible écrite, dans le style des maquettes validées, contenu lu à
`src/hote/ecran.ts` et `src/noyau/modalArbiter.ts`. Sources au dépôt : `sources/exploration-et-recit/`, sur le socle
commun de `sources/lieux-et-nuit/`. Le lot a été
interrompu avant son propre relevé : ce compte rendu est fait d'après les images et les sources, les valeurs
affichées sont des exemples non relus au livre. Rien n'est validé.

Pièces neuves : bandeau du bas en parchemin partagé par le dialogue, le jet et le butin ; colonne des héros à gauche ;
chronique en trois lignes à droite ; avis de parchemin plein écran ; carte dessinée à la plume.

## exploration
- La salle de l'auberge en vue iso, le chef du groupe et le trajet en pointillé ; infobulle de parchemin sur un PNJ
  (« Parler ») et sur un avis (« Lire ») ; bandeau des quatre héros avec « Mène le groupe » ; « Le lieu » et « Carte
  du monde » en pastilles à gauche ; chronique à droite.
- À valider : verbes du survol dans l'infobulle ; chef du groupe seul déplacé ; aucune barre d'actions hors combat.

## dialogue
- Le bandeau de parchemin : portrait du PNJ, nom, titre, réplique ; à droite les réponses numérotées, un Test de
  Charme en étiquette sur la réponse qui le demande, un prix sur celle qui coûte. La colonne des héros, à gauche,
  dit qui « portera le Test » : un clic sur un autre portrait change le testeur (`jetRegler('test','testeur', id)`).
- Retouche du 2026-11-17 (#4411) : l'en-tête « Mira répond » sort des réponses, la colonne du bandeau porte le choix ;
  la colonne des réponses s'élargit, la réponse 2 tient dans sa plaque.
- À valider : le coût d'une réponse (« 4 sc ») dit sans payeur, le noyau le prend au total des bourses
  (`src/noyau/dialogue.ts`, `partyMoneyTotal`).

## jet-de-competence
- Le même bandeau que le jet d'attaque : le héros, son seuil, les dés, le sceau de réussite et ses DR ; le PNJ en
  face ; les réserves du héros, « Appliquer », « Relancer » et « Résilience » fermées sur une réussite (LDB 17 l.23,
  l.68), « Chance : +1 DR » (LDB 17 l.24), « Pacte ». Image inchangée depuis le socle du jet (lot A).
- À valider : l'interlocuteur montré en face.

## butin
- Le corps fouillé en titre, l'argent « réparti entre les bourses » (`src/noyau/bourseFlow.ts`), chaque objet sur
  une ligne avec son Encombrement, une case par héros et une case « Laisser ». Une case donne l'objet tout de suite
  (`src/noyau/combatEffects.ts:348`) : la ligne prise quitte la liste (la lettre, prise par Aldric, est à la
  chronique). Un héros chargé à plein reste pressable, son Encombrement passe en rouge (LDB 61 l.33). « Emporter le
  reste » et sa note disent à qui va le non attribué (`src/noyau/issueDeCombat.ts:90`) ; « Évaluer ».
- À valider : « Laisser » demande un verbe au noyau (M3 de l'audit : `fC('butin','laisser', uid)`, la ligne posée au
  sol) ; tout objet va sur un héros, pas de sac de groupe.

## document
- L'avis en grand sur parchemin cloué, gothique et italique, sceau ; dans le bandeau, la mention « consigné à la
  chronique » et « Replier ».
- À valider : le document reste lisible depuis la chronique ; texte d'exemple, à remplacer par la prose verbatim du
  scénario.

## carte-du-monde
- La carte du Reikland à la plume (Reik, Talabec, Drakwald, Reikwald), les lieux connus en étiquettes, le groupe sur
  son lieu ; à gauche la destination avec ses étapes et distances, les moyens (diligence au prix par tête, à pied) et
  « Prendre la route » ; bandeau des héros et leur bourse ; « Revenir à l'auberge ».
- Retouche du 2026-11-17 (#4411) : le nom de la destination n'est plus coupé par sa ligne.
- À valider : distances, durées et tarifs d'exemple, non relus au livre ; seuls les lieux connus du groupe montrés ;
  la carte ouverte depuis le lieu, pas depuis la route ; « Reprendre le voyage » (`carteEnVue.reprendre`) non dessiné.
