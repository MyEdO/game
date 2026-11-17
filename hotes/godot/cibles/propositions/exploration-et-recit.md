# Propositions : exploration et récit (2026-11-16, #3935)

Compte rendu des quatorze états dessinés sans cible écrite, dans le style des maquettes validées, contenu lu à
`src/hote/ecran.ts` et `src/noyau/modalArbiter.ts`. Sources au dépôt : `sources/exploration-et-recit/`, sur le socle
commun de `sources/lieux-et-nuit/`. Le lot a été
interrompu avant son propre relevé : ce compte rendu est fait d'après les images et les sources, les valeurs
affichées sont des exemples non relus au livre. Rien n'est validé.

Pièces neuves : bandeau du bas en parchemin partagé par le dialogue, le jet et le butin ; colonne des héros à gauche ;
chronique en trois lignes à droite ; avis de parchemin plein écran ; carte dessinée à la plume.

## exploration
- La salle de l'auberge en vue iso, le chef du groupe et le trajet en pointillé, sans case d'arrivée (retirée le
  2026-11-17 : en exploration aucune case ne se dessine au sol, décision citée à `exploration-premiere-personne`) ; infobulle de parchemin sur un PNJ
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
- Sur la route, le corps garde son halo ; la case pointillée qui l'entourait est retirée, ici et sur
  `designation-d-un-heros` (2026-11-17 : aucune case au sol en exploration).
- À valider : « Laisser » demande un verbe au noyau (M3 de l'audit : `fC('butin','laisser', uid)`, la ligne posée au
  sol) ; tout objet va sur un héros, pas de sac de groupe.

## document
- L'avis en grand sur parchemin cloué, gothique et italique, sceau ; dans le bandeau, la mention « consigné à la
  chronique » et « Replier ».
- À valider : le document reste lisible depuis la chronique ; texte d'exemple, à remplacer par la prose verbatim du
  scénario.

## exploration-gestes (2026-11-17, #4411)
- Écran 13, nouvel état de la page d'exploration. Les gestes que la situation ouvre s'empilent au-dessus de « Le
  lieu » et « Carte du monde » : « Soigner », « Se reposer », « Fouiller la pièce ». Une dague au sol porte son
  infobulle « Ramasser » ; la croisée porte un poste « Enjamber la fenêtre » ; pastille « Carnet d'enquête ».
- Verbes : `fouillerLaPiece()`, `ramasserLObjet(entityId, key, heroId?)`, `franchirLArete(vers)`,
  `ouvrirLeRepos(hebergementId?)`, `ouvrirLeMedecin(patientId?)` (`src/noyau/actionsDuNoyau.ts`). L'ouverture du
  carnet est un geste d'hôte. Libellés : `fouille.geste`, `usable.ramasser`, `arete.enjamberFenetre`,
  `ecran.offre.soins` (`src/i18n/messages/fr.ts`).
- RAW : LDB 12 l.200 ; LDB 15 l.55 ; LDB 18 l.296-298.
- À valider : les gestes du groupe en pastilles empilées, absentes quand la situation les ferme ; le ramassage par
  le héros qui mène ; l'arête franchissable dite sur la scène, pas dans une liste.

## exploration-dessus (2026-11-17, #4411)
- Nouvel état de la page d'exploration : la salle de `exploration-gestes`, vue du dessus. Seule la caméra change : mêmes
  pions (anneau des héros, halo de celui qui mène), mêmes pastilles sur la porte, le coffre, le cocher et la dague, même
  infobulle « Ramasser », même poste « Enjamber la fenêtre » sur la croisée, mêmes gestes à gauche, carnet, chronique
  et bandeau des héros. Les trois vues lisent la même salle (`SALLE`, `sources/exploration-et-recit/scene.js`).
- En haut à droite, le cartouche « Regard » : « Isométrique », « Dessus », « Première personne », le regard tenu doré,
  et sa touche (V, exemple : la touche par défaut de `changer_de_regard`, `hotes/godot/projet/project.godot:52`).
- Verbes : ceux de `exploration-gestes`. Le regard se change par la méthode du pont `regarder({ regard })`
  (`hotes/godot/pont/pont.ts:1432`), l'un de `REGARDS` = `tactique`, `plateau`, `immersion`
  (`src/noyau/monde/aretes.ts:125`) ; la touche joue `plateau.regardSuivant` (`src/noyau/monde/aretes.ts:269`,
  `hotes/godot/projet/scripts/combat.gd:464`). Aucun verbe à créer : le regard est un état de l'hôte, pas du noyau
  (à l'hôte web : `toggleViewMode`, `togglePov`, `src/state/store.ts:248`).
- Décision : « les trois vues restent supportées » (utilisateur, 2026-11-17, consignée sur #3935).
- À valider : le cartouche « Regard » à trois segments cliquables, que le pont ne sert pas encore (seul le regard
  suivant se joue, à la touche) ; sa pose sur `exploration` et `exploration-gestes`, où il n'est pas dessiné ; les
  libellés « Isométrique », « Dessus », « Première personne » pour `tactique`, `plateau`, `immersion`.

## exploration-premiere-personne (2026-11-17, #4411)
- Nouvel état de la page d'exploration : la même salle par les yeux de Mira, qui mène le groupe, tournée vers le mur de
  l'âtre. Marche libre, comme l'immersion de l'hôte Godot (`hotes/godot/projet/scripts/immersion.gd`) : la souris,
  captive, mène le regard ; le clavier marche en continu (`avant`, `arriere`, `gauche`, `droite`, `courir` tenu) ; le
  point de mire reste au centre de l'écran. Aucune case au sol, ni boussole, ni flèche : l'immersion n'en a pas. Les
  héros ne se voient pas (`hotes/godot/projet/scripts/plateau.gd:80`). Le chrome est celui de `exploration-gestes`.
- Désigner : ce que vise le point de mire prend l'infobulle des autres vues, dont le geste se joue par `agir`, « E ou
  clic » (touche d'exemple : celle de `agir`, `hotes/godot/projet/project.godot`). Ici la dague, « Ramasser ». La porte
  de la cour et la voyageuse attablée portent la pastille des choses à portée.
- Verbes : `agir` joue la case visée par le clic du champ (`case_jouee`, `immersion.gd`), donc `jouerAction(entityId,
  actionId)` ou `ramasserLObjet(entityId, key, heroId?)` selon ce qu'elle porte. `ui_cancel` libère la souris pour le
  chrome, un clic la reprend. Regard : comme `exploration-dessus`.
- Décision : « Pourquoi faut réinventer le mode libre ? Pour moi les cases n ont de sens qu en combat mais c est
  tout » (utilisateur, 2026-11-17). `pivoterLeGroupe` et `avancerDUnPas` (`src/noyau/actionsDuNoyau.ts:254`, `:258`)
  sont donc à retirer du noyau : aucune vue ne les joue.
- À valider : l'infobulle sur ce que vise le point de mire et les pastilles des choses à portée, que l'immersion
  n'affiche pas aujourd'hui ; les PNJ visibles dans cette vue.

## soins-entre-heros (2026-11-17, #4411)
- La page des soins du médecin (`sources/lieux-et-nuit/soins.js`), sans prix ni docteur : Greta à 8 / 14, « Panser
  les Blessures » (Guérison), « Arrêter l'Hémorragie » fermée (elle ne saigne pas), plaque « Soigner » ; au bandeau,
  la patiente et le héros qui possède Guérison ; « Explorer » ramène.
- Verbes : `ouvrirLeMedecin(patientId?)`, `fenetreChoisir('infirmerie','patient', id)`, `jetRegler('soins','mode')`,
  `jetLancer('soins')` (`src/noyau/medicFlow.ts`).
- RAW : LDB 09 l.260.
- À valider : le soigneur choisi dans le bandeau du jet, pas sur la page ; la Chirurgie entre héros non dessinée.

## designation-d-un-heros (2026-11-17, #4411)
- Sur la route, l'invite de la donnée en parchemin (verbatim de `src/scenes/diligence/diligence-projet.json`), et
  dans le bandeau du jet quatre cartes de héros, Aldric armé, plaque « Désigner ». Aucune sortie : la fenêtre reste
  tant qu'un héros vivant n'est pas désigné.
- Verbe : `fenetreChoisir('designationHeros','heros', id)` (`src/noyau/campagne.ts:57-73`). Libellés
  `fenetre.designationHeros`, `verbe.designationHeros.heros` (`src/i18n/messages/fr.ts:451`, `:302`).
- RAW : EDO 02 l.89-91.
- À valider : carte puis plaque, quand le verbe désigne d'un seul geste ; le bandeau à cartes repris du combat.

## document-relu (2026-11-17, #4411)
- Nouvel état de la page du document : le même avis, la note « Relu depuis le carnet : « Replier » y ramène. ».
- Changement voulu de l'image `document` : sa note dit « Consigné au carnet » au lieu de « à la chronique », le
  carnet étant le seul endroit dessiné où un document se relit.
- Verbe : `fenetreFermer('document')`. Verbe à créer : `relireLeDocument(documentId)`, qui rouvre la fenêtre
  `document` sans rejouer sa suite, et la liste des documents remis à tenir au noyau (M7 de l'audit ;
  `src/noyau/campagne.ts:35-46` ne garde que le document ouvert).
- À valider : la relecture depuis le carnet plutôt que depuis la chronique.

## carnet (2026-11-17, #4411)
- Le carnet d'enquête : rail « Affaires » (« Épinglés », « Un héritage à Bögenhafen »), boîte « Documents remis »,
  et la page de l'affaire : l'indice « L'héritage », ses étiquettes « Indice » et « Nouveau », « Épingler », la
  dernière lecture (« L'affidavit », EDO p. 28) et les lectures précédentes (« L'héritage », EDO p. 27), prose
  verbatim du paquet (EDO 02, Documents 3 et 4) ; croix de sortie.
- Verbes : `epinglerLIndice(indiceId, epingle)`, `marquerLesIndices(affiches)` (`src/noyau/campagne.ts:13-29`) ;
  `carnet.nouveau` (`src/i18n/messages/fr.ts:1811`).
- À créer : un lecteur `carnetEnVue` (affaires, indices visibles, stades, épingle, nouveauté), aucun lecteur d'hôte
  ne sert le carnet ; `relireLeDocument(documentId)` pour la boîte « Documents remis ».
- À valider : rail et page de parchemin plutôt que le livre ouvert du Compendium (son gabarit vit dans
  `outils`) ; un indice caché ne se lit pas ; « Nouveau » levé à l'affichage.

## carte-du-monde-depart-de-nuit (2026-11-17, #4411)
- Nouvel état de la carte : « À pied » choisi de nuit, « Prendre la route » fermée, et le billet « Départ de nuit »
  pointé sur elle, « Attendre l'aube » armée, « Rester ».
- Verbes : `fenetreValider('depart')`, `fenetreFermer('depart')` (`src/noyau/modalArbiter.ts:362`).
- Règle maison `voyage-heure-de-depart` (#340) : aucune heure de départ aux livres.
- À valider : la porte en billet sur la carte plutôt qu'en fenêtre ; ce que l'attente coûte (heures) non montré.

## carte-du-monde
- La carte du Reikland à la plume (Reik, Talabec, Drakwald, Reikwald), les lieux connus en étiquettes, le groupe sur
  son lieu ; à gauche la destination avec ses étapes et distances, les moyens (diligence au prix par tête, à pied) et
  « Prendre la route » ; bandeau des héros et leur bourse ; « Revenir à l'auberge ».
- Retouche du 2026-11-17 (#4411) : le nom de la destination n'est plus coupé par sa ligne.
- À valider : distances, durées et tarifs d'exemple, non relus au livre ; seuls les lieux connus du groupe montrés ;
  la carte ouverte depuis le lieu, pas depuis la route ; « Reprendre le voyage » (`carteEnVue.reprendre`) non dessiné.
