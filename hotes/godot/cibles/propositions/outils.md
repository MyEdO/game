# Propositions : hors partie et outils (2026-11-17, #3935)

Compte rendu des six états dessinés pour la coop, l'éditeur de campagne et le Compendium, des écrans sans image
d'intention ni cible écrite. Contenu lu au code (`src/hote/`, `src/noyau/`, `server/`, `src/i18n/messages/fr.ts`),
jamais le design d'un écran existant. Sources au dépôt : `sources/outils/` ; elles lient le socle commun de
`sources/lieux-et-nuit/`, les pièces de `sources/accueil-et-systeme/systeme.js` et, pour `coop-la-main`, la halle de
`sources/commerce/`.
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (`coop.*` l.1408-1430, `ecran.salon.*` l.1466-1477,
`party.slot.invite` l.1275, `groupe.hoteSeul` l.2580, `ecran.editeur.*`, `ecran.compendium.*` l.887-898) ; talent
« Négociateur » verbatim de `src/data/talents.json:3309` ; scènes, lieux et routes de
`src/scenes/diligence/diligence-projet.json`.

Exemples chiffrés, sans valeur de règle : code de partie « K7M2QX », noms des joueurs (Karl, Lena, Otto), bourses de
la halle vue en coop, « Feuillet 9 sur 15 ».

Pièces neuves : tablée et sièges ; champ de saisie ; cases de code ; barre, palette d'outils, plan quadrillé et
inspecteur de l'éditeur ; feuillets de liste et de fiche du registre.

## coop-ouvrir
- Depuis l'accueil, aucune partie ouverte (`src/hote/salon.ts:67-74`). Une tablée vide au centre, quatre sièges « Un
  siège à pourvoir », inertes, : l'hôte et jusqu'à trois invités (`server/src/roomLogic.ts:6`).
- « Rejoindre une partie » : code en six cases (`src/hote/coop/salon.ts`), « Le code de room fait 6 caractères. »,
  « Votre nom », « Rejoindre » armée.
- « Héberger une partie » : aide du jeu, « Votre nom », « Héberger » en fer et son refus « Ouvrez une partie pour
  l'héberger. »
- À valider : la tablée comme image de la coop ; rejoindre et héberger en deux feuillets de part et d'autre ; le code
  saisi en six cases ; un geste refusé montré en fer avec sa raison plutôt que caché.

## coop-salon
- L'hôte en session (`src/hote/salon.ts:24-36`). Volet « Inviter — partagez le code » : le code en grand, « Joueurs
  connectés » (« (vous) », « — reconnexion… »), « Quitter le salon ».
- La tablée : un siège par joueur, les héros qu'il tient posés devant lui, le siège absent marqué de cire, un siège
  à pourvoir (`src/noyau/sieges.ts:41`) en simple mention, sans médaillon : il ne se presse pas, l'invité entre par
  le code. Un emplacement vide du groupe aurait sa rangée sur la page (`affecterLEmplacementAuSiege`,
  `sieges.ts:180`) ; le groupe dessiné est complet.
- Page « Attribution des héros » : une rangée par héros, un segment par siège ; « Maître du Jeu » : « IA (aucun MJ) »
  ou un siège (`src/noyau/sieges.ts:169`). Fermer en haut à droite.
- À valider : l'attribution lue deux fois, sur la tablée et sur la page ; un segment par siège plutôt qu'une liste
  déroulante ; le rôle de Maître du Jeu sous les héros ; le joueur en reconnexion gardé à sa place, marqué de cire.

## coop-la-main
- La halle vue du siège d'un invité. Cartouche « La main est à l'hôte » en haut ; les gestes sur la bourse et la cale
  sont en fer, avec la raison du jeu : « L'hôte seul engage la bourse et la cale du groupe. »
  (`src/noyau/intentionsDeSiege.ts:154-161`, `src/noyau/halle.hors-store.test.ts:130`).
- « Bourses du groupe » montre la part de chacun sans − ni + (`bourse({ reglable: false })`) : l'invité ne règle rien.
- Chaque héros du bandeau dit qui le joue : « Lena (vous) » en laiton, les autres en fer, « Otto — reconnexion… ».
- Qui tient la main : `src/noyau/netOwnership.ts:713` (le concerné de la modale, sinon le combattant actif, sinon
  l'hôte).
- À valider : un cartouche « la main » en haut de tout écran joué à plusieurs ; le nom du joueur sous chaque héros du
  bandeau ; les gestes de l'hôte montrés en fer à l'invité, avec leur raison ; l'invité voit la composition de l'hôte
  en direct.

## editeur-scene
- Un plan de travail, pas un lieu. Barre : projet, documents « Scène », « Carte du monde », « Narratif », « Annuler »,
  « Rétablir », « Copier », « Coller », « Dupliquer », « Enregistrer », « Tester la scène »
(`src/hote/editeur.ts:135-534`).
- À gauche : « 4 scènes au projet » (les quatre du projet Diligence), « Nouvelle scène », « Dupliquer la scène »,
  « Retirer la scène » ; palette des quinze outils du jeu, « Sélection » armé.
- Au centre : la scène vue de dessus, quadrillée, couches (« Couche 0 », « Couche 1 », « Ajouter une couche »), Nord ;
  une porte choisie, surlignée. Le plan est une esquisse, pas le relevé de la scène.
- À droite, l'inspecteur de la porte : Type, Fermée au départ, Porte secrète, Difficulté de Perception, Découvrable
  depuis, Matériau, Apparence ; « Déclencheurs (1) », « Dialogues (0) », « Rencontres (0) » ; la validation.
- Pied : « Arête 14, 8 E · couche 0 · Porte · Mur à ossature en bois » (`src/hote/editeur.ts:674`).
- À valider : l'éditeur dans les matières du jeu (bois, laiton, parchemin) plutôt qu'en outil neutre ; trois colonnes
  fixes (scènes et outils, plan, inspecteur) ; les outils en palette d'icônes libellées ; les réglages d'une porte
  secrète grisés tant qu'elle ne l'est pas ; la validation au pied de l'inspecteur ; la scène vue de dessus plutôt
  qu'en isométrie pour l'édition.

## editeur-carte-du-monde
- Même plan de travail, document « Carte du monde ». À gauche : « Lieux (4) », « Routes (3) » avec distance et
  modes, outils « Sélection », « Lieu », « Route », « Point d'intérêt ».
- Au centre : la carte « La route d'Altdorf », les quatre lieux à leurs positions du projet, trois routes à sens
  unique (40, 35, 115 km).
- Inspecteur du lieu : « Nom », « Scène », « Plan du lieu » (« Aucun point d'intérêt désigné sur le plan. »),
  « Établissements (0) », « Ajouter un établissement », sa route et son « Sens » (« Les deux sens », « Depuis … »).
- À valider : la carte du monde sur parchemin dans le même cadre que la scène ; lieux et routes listés à gauche et
  choisis aussi sur la carte ; la route d'un lieu éditée dans l'inspecteur du lieu ; le sens d'une route montré par
  une flèche sur son étiquette.

## compendium
- Un registre relié, repris de celui des règles maison. Un signet par famille (les sept du jeu), « Compétences »
  ouverte ; volet « Catégories » : Compétences (48), Talents (187), Axes de forces (9), « Rechercher », filtre
  « Livre » et ses comptes, « Nouvelle entrée » (`src/hote/compendium.ts:43-68`).
- Page de gauche : en tête la catégorie, sous-titrée de sa famille et de son compte (« Famille Compétences · 187
  talents ») ; les entrées de la catégorie avec leur source, « Négociateur » pointé, feuillets.
- Page de droite : la fiche (Max, Test, source, description verbatim, lien « Compétence Marchandage »), ses renvois
  (Races 2, Carrières (par rang) 24, Créatures 19), « Modifier ».
- À valider : le Compendium en registre relié, familles en signets ; la liste paginée en feuillets plutôt qu'en longue
  liste défilante ; les renvois en liens soulignés, tronqués avec leur reste (« et 14 autres ») ; « Modifier » et «
  Nouvelle entrée » visibles à la consultation ; le filtre « Livre » en puces à comptes.

## Non dessiné
- Coop : ouverture en cours, échec (« Service coop injoignable — réessayez. »), sans réseau, salon vu d'un invité,
  hôte déconnecté.
- Éditeur : document « Narratif », outils autres que « Sélection » et leurs options, validation avec défauts.
- Compendium : l'atelier (édition d'une entrée), la recherche active, une table et son dé.
