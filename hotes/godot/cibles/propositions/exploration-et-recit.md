# Propositions : exploration et récit (2026-11-16, #3935)

Compte rendu des quatorze états dessinés sans cible écrite, contenu lu à `src/hote/ecran.ts` et
`src/noyau/modalArbiter.ts`. Sources au dépôt : neuf écrans de `sources/maquettes/`, chacun la liste de ses états au
format de `sources/maquettes/maquette.ts`, dessinés par `sources/rendu.html`
(`node sources/rendre.mjs <écran> <sortie.png> --format 16:9 [--etat <état>]`) : `exploration` (`exploration`,
`exploration-gestes`, `exploration-dessus`, `exploration-premiere-personne`), `dialogue`, `jet-de-competence`,
`butin`, `designation-d-un-heros`, `document` (`document`, `document-relu`), `carnet`, `carte-du-monde`
(`carte-du-monde`, `carte-du-monde-depart-de-nuit`) ; les soins entre héros sont un état de `soins`
(`soins-entre-heros`). Les décors peints vivent dans `sources/exploration-et-recit/` : la salle de La Diligence sous
ses trois regards et la route d'Altdorf (`scene.js`), le Reikland (`carte.js`) ; les pièces propres à la famille dans
`recit.css` et `carte.css`. Les valeurs affichées sont des exemples non relus au livre. Premières maquettes : rien
n'est validé.

Pièces : la fenêtre du bas du kit pour le dialogue, le jet, le butin, la désignation et le départ de nuit ; le
journal au bord droit ; les gestes du groupe en colonne au bord gauche, les écrans à ouvrir au bord droit ; le
document en carton au-dessus du bandeau ; la carte dessinée à la plume.

## exploration
- La salle de l'auberge en vue iso, le chef du groupe et le trajet en pointillé, sans case d'arrivée (en exploration
  aucune case ne se dessine au sol, décision citée à `exploration-premiere-personne`) ; infobulle de parchemin sur un
  PNJ (« Parler ») et poste sur l'avis (« Lire ») ; bandeau des quatre héros avec « Mène le groupe » ; « Le lieu » en
  bas à gauche, « Carte du monde » au bord droit ; journal à droite.
- À valider : verbes du survol dans l'infobulle ; chef du groupe seul déplacé ; aucune barre d'actions hors combat.

## dialogue
- La fenêtre du bas : à gauche le héros qui « portera le Test », au centre ses réponses numérotées, un Test
  de Charme en étiquette sur la réponse qui le demande, un prix sur celle qui coûte ; à droite le PNJ, son titre et
  sa réplique. Le testeur se change au bandeau du jet (`jetRegler('test','testeur', id)`).
- À valider : le coût d'une réponse (« 4 sc ») dit sans payeur, le noyau le prend au total des bourses
  (`src/noyau/dialogue.ts`, `partyMoneyTotal`).

## jet-de-competence
- Le même bandeau que le jet d'attaque : le héros, son seuil, les dés, le sceau de réussite et ses DR ; le PNJ en
  face ; les réserves du héros, « Appliquer », « Relancer » et « Résilience » fermées sur une réussite (LDB 17 l.23,
  l.68), « Chance : +1 DR » (LDB 17 l.24), « Pacte ».
- À valider : l'interlocuteur montré en face.
- À valider : la grande ligne dit « Réussite », aucune conséquence, le DR en petit (`combat.md`, « Bandeau du
  jet »).

## butin
- Le corps fouillé en titre, l'argent « réparti entre les bourses » (`src/noyau/bourseFlow.ts`), chaque objet sur
  une ligne avec son Encombrement, une case par héros et une case « Laisser ». Une case donne l'objet tout de suite
  (`src/noyau/combatEffects.ts:348`) : la ligne prise quitte la liste (la lettre, prise par Aldric, est au
  journal). Un héros chargé à plein reste pressable, son Encombrement passe en rouge (LDB 61 l.33). « Emporter le
  reste » et sa note disent à qui va le non attribué (`src/noyau/issueDeCombat.ts:90`) ; « Évaluer ».
- Sur la route, le corps garde son halo, sans case au sol, ici et sur `designation-d-un-heros`.
- À valider : « Laisser » demande un verbe au noyau (M3 de l'audit : `fC('butin','laisser', uid)`, la ligne posée au
  sol) ; tout objet va sur un héros, pas de sac de groupe.

## document
- L'avis en carton de parchemin au-dessus du bandeau, gothique et italique, sur deux colonnes, sceau ; au pied, la
  note « Consigné au carnet : il se relit quand on veut. » et « Replier ».
- À valider : le carton de 960 plutôt qu'une page plein écran ; « lu par Mira » ; texte d'exemple, à remplacer par
  la prose verbatim du scénario.

## exploration-gestes (2026-11-17, #4411)
- Les gestes que la situation ouvre s'empilent au bord gauche au-dessus de « Le lieu » : « Soigner », « Se
  reposer », « Fouiller la pièce ». Une dague au sol porte son infobulle « Ramasser » ; la croisée porte un poste
  « Enjamber la fenêtre » ; « Carnet d'enquête » s'ouvre sous « Carte du monde ».
- Verbes : `fouillerLaPiece()`, `ramasserLObjet(entityId, key, heroId?)`, `franchirLArete(vers)`,
  `ouvrirLeRepos(hebergementId?)`, `ouvrirLeMedecin(patientId?)` (`src/noyau/actionsDuNoyau.ts`). L'ouverture du
  carnet est un geste d'hôte. Libellés : `fouille.geste`, `usable.ramasser`, `arete.enjamberFenetre`,
  `ecran.offre.soins` (`src/i18n/messages/fr.ts`).
- RAW : LDB 12 l.200 ; LDB 15 l.55 ; LDB 18 l.296-298.
- À valider : les gestes du groupe en pastilles empilées, absentes quand la situation les ferme ; le ramassage par
  le héros qui mène ; l'arête franchissable dite sur la scène, pas dans une liste.

## exploration-dessus (2026-11-17, #4411)
- La salle de `exploration-gestes`, vue du dessus. Seule la caméra change : mêmes pions (anneau des héros, halo de
  celui qui mène), mêmes pastilles sur la porte, le coffre, le cocher et la dague, même infobulle « Ramasser », même
  poste « Enjamber la fenêtre » sur la croisée, mêmes gestes à gauche, carnet, journal et bandeau des héros. Les
  trois vues lisent la même salle (`SALLE`, `sources/exploration-et-recit/scene.js`), et chaque chose y a sa marque
  sous chaque regard (`pointDe`).
- En haut à droite, le cartouche « Regard » : « Isométrique », « Dessus », « Première personne », le regard tenu doré,
  et sa touche (V, exemple : la touche par défaut de `changer_de_regard`, `hotes/godot/projet/project.godot:52`).
- Verbes : ceux de `exploration-gestes`. Le regard se change par la méthode du pont `regarder({ regard })`
  (`hotes/godot/pont/pont.ts:1432`), l'un de `REGARDS` = `tactique`, `plateau`, `immersion`
  (`src/noyau/monde/aretes.ts:125`) ; la touche joue `plateau.regardSuivant` (`src/noyau/monde/aretes.ts:269`,
  `hotes/godot/projet/scripts/combat.gd:464`). Aucun verbe à créer : le regard est un état de l'hôte, pas du noyau
  (à l'hôte web : `toggleViewMode`, `togglePov`, `src/state/store.ts:248`).
- Décision : « les trois vues restent supportées » (utilisateur, 2026-11-17, consignée sur #3935).
- À valider : le cartouche « Regard » à trois segments cliquables, que le pont ne sert pas encore (seul le regard
  suivant se joue, à la touche) ; sa pose sur les quatre états, `exploration` compris ; les libellés « Isométrique »,
  « Dessus », « Première personne » pour `tactique`, `plateau`, `immersion` ; en vue du dessus, l'infobulle de la
  dague couvre le groupe.

## exploration-premiere-personne (2026-11-17, #4411)
- La même salle par les yeux de Mira, qui mène le groupe, tournée vers le mur de l'âtre. Marche libre, comme l'immersion de l'hôte Godot (`hotes/godot/projet/scripts/immersion.gd`) : la souris,
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
- Un état de l'écran `soins` (`sources/maquettes/soins.ts`), la page des soins du médecin posée sur la salle, sans
  prix ni docteur : Greta à 8 / 14, « Panser
  les Blessures » (Guérison), « Arrêter l'Hémorragie » fermée (elle ne saigne pas), plaque « Soigner » ; au bandeau,
  la patiente et le héros qui possède Guérison ; « Explorer » ramène.
- Verbes : `ouvrirLeMedecin(patientId?)`, `fenetreChoisir('infirmerie','patient', id)`, `jetRegler('soins','mode')`,
  `jetLancer('soins')` (`src/noyau/medicFlow.ts`).
- RAW : LDB 09 l.260.
- À valider : le soigneur choisi dans le bandeau du jet, pas sur la page ; la Chirurgie entre héros non dessinée.

## designation-d-un-heros (2026-11-17, #4411)
- Sur la route, l'invite de la donnée en parchemin (verbatim de `src/scenes/diligence/diligence-projet.json`), et
  dans la fenêtre du bas les quatre héros, en liste (quatre choix), Aldric armé, plaque « Désigner ». Aucune sortie : la fenêtre reste
  tant qu'un héros vivant n'est pas désigné.
- Verbe : `fenetreChoisir('designationHeros','heros', id)` (`src/noyau/campagne.ts:57-73`). Libellés
  `fenetre.designationHeros`, `verbe.designationHeros.heros` (`src/i18n/messages/fr.ts:451`, `:302`).
- RAW : EDO 02 l.89-91.
- À valider : carte puis plaque, quand le verbe désigne d'un seul geste ; le bandeau à cartes repris du combat.

## document-relu (2026-11-17, #4411)
- Le même avis, la note « Relu depuis le carnet : « Replier » y ramène. » ; le carnet est le seul endroit dessiné
  où un document se relit.
- Verbe : `fenetreFermer('document')`. Verbe à créer : `relireLeDocument(documentId)`, qui rouvre la fenêtre
  `document` sans rejouer sa suite, et la liste des documents remis à tenir au noyau (M7 de l'audit ;
  `src/noyau/campagne.ts:35-46` ne garde que le document ouvert).
- À valider : la relecture depuis le carnet plutôt que depuis le journal.

## carnet (2026-11-17, #4411)
- Le carnet d'enquête, au gabarit de gestion posé sur la salle : rail « Affaires » (« Épinglés », « Un héritage à
  Bögenhafen »), boîte « Documents remis », et la page de l'affaire : l'indice « L'héritage », ses étiquettes
  « Indice » et « Nouveau », « Épingler », la dernière lecture (« L'affidavit ») et les lectures précédentes
  (« L'héritage », manuscrite), prose verbatim du paquet (EDO 02, Documents 3 et 4) ; croix de sortie.
- Verbes : `epinglerLIndice(indiceId, epingle)`, `marquerLesIndices(affiches)` (`src/noyau/campagne.ts:13-29`) ;
  `carnet.nouveau` (`src/i18n/messages/fr.ts:1811`).
- À créer : un lecteur `carnetEnVue` (affaires, indices visibles, stades, épingle, nouveauté), aucun lecteur d'hôte
  ne sert le carnet ; `relireLeDocument(documentId)` pour la boîte « Documents remis ».
- À valider : rail et page de parchemin plutôt que le livre ouvert du Compendium (son gabarit vit dans
  `outils`) ; la page commence à 76 sous la croix, et non à 60 (`../dispositions.md`, gabarit 2) ; les lectures
  défilent dans la page ; un indice caché ne se lit pas ; « Nouveau » levé à l'affichage.

## carte-du-monde-depart-de-nuit (2026-11-17, #4411)
- « À pied » choisi de nuit, et la porte « Départ de nuit » en fenêtre du bas, à la place du bandeau : sa consigne,
  « Attendre l'aube » armée, « Rester ».
- Verbes : `fenetreValider('depart')`, `fenetreFermer('depart')` (`src/noyau/modalArbiter.ts:362`).
- Règle maison `voyage-heure-de-depart` (#340) : aucune heure de départ aux livres.
- À valider : la porte en fenêtre du bas plutôt qu'en billet sur la carte ; ce que l'attente coûte (heures) non
  montré.

## carte-du-monde
- La carte du Reikland à la plume (Reik, Talabec, Drakwald, Reikwald), les lieux connus en étiquettes, le groupe sur
  son lieu ; au coin haut-droit la destination avec ses étapes et distances, les moyens (diligence au prix par tête, à
  pied) et « Prendre la route » ; bandeau des héros et leur bourse ; « Revenir à l'auberge ».
- À valider : distances, durées et tarifs d'exemple, non relus au livre ; seuls les lieux connus du groupe montrés ;
  la carte ouverte depuis le lieu, pas depuis la route ; « Reprendre le voyage » (`carteEnVue.reprendre`) non dessiné.
