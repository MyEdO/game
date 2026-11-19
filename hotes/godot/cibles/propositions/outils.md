# Propositions : hors partie et outils (2026-11-17, #3935)

Compte rendu des neuf états dessinés (six d'origine, trois ajoutés par l'audit des verbes, #4411) pour la coop, l'éditeur
de campagne et le Compendium, des écrans sans image d'intention ni cible écrite. Contenu lu au code (`src/hote/`,
`src/noyau/`, `server/`, `src/i18n/messages/fr.ts`), jamais le design d'un écran existant. Sources au dépôt : quatre
écrans de `sources/maquettes/` et un état de la halle, chacun la liste de ses états au format de
`sources/maquettes/maquette.ts`, dessinés par `sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png>
--format 16:9 [--etat <état>]`) : `coop` (`ouvrir`, `salon`), `halle` (`la-main`), `editeur-de-scene` (`porte`,
`outil-terrain`, `supprimer`), `editeur-carte-du-monde` et `compendium` (`consultation`, `atelier`) ;
`maquettes/editeur.ts` porte le projet, les documents et la barre que les deux éditeurs partagent. Le plan de la scène,
la carte de l'éditeur, la ligne de liste et la tablée vivent dans `sources/outils/` (`editeur.js`, `outils.js`,
`outils.css`).
Premières maquettes : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (`coop.*` l.1419-1441, `ecran.salon.*` l.1484-1495,
`party.slot.invite` l.1286, `groupe.hoteSeul` l.2600, `ecran.editeur.*`, `ecran.compendium.*` l.892-932) ; talent
« Négociateur » verbatim de `src/data/talents.json:3325` ; scènes, lieux et routes de
`src/scenes/diligence/diligence-projet.json`.

Exemples chiffrés, sans valeur de règle : code de partie « K7M2QX », noms des joueurs (Karl, Lena, Otto), bourses de
la halle vue en coop, « Feuillet 9 sur 15 ».

Pièces neuves : tablée et sièges ; champ de saisie ; cases de code ; barre, palette d'outils, plan quadrillé et
inspecteur de l'éditeur ; feuillets de liste et de fiche du registre.

## coop-ouvrir
- État `ouvrir` de l'écran `coop`.
- Depuis l'accueil, aucune partie ouverte (`src/hote/salon.ts:67-74`). Une tablée vide au centre, quatre sièges « Un
  siège à pourvoir », inertes, : l'hôte et jusqu'à trois invités (`server/src/roomLogic.ts:6`).
- « Rejoindre une partie » : code en six cases (`src/hote/coop/salon.ts`), « Le code de room fait 6 caractères. »,
  « Votre nom », « Rejoindre » armée.
- « Héberger une partie » : aide du jeu, « Votre nom », « Héberger » en fer et son refus « Ouvrez une partie pour
  l'héberger. »
- À valider : la tablée comme image de la coop ; rejoindre et héberger en deux feuillets de part et d'autre ; le code
  saisi en six cases ; un geste refusé montré en fer avec sa raison plutôt que caché.

## coop-salon
- État `salon` de l'écran `coop`.
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
- État `la-main` de l'écran `halle` : la halle vue du siège d'un invité, la page de l'achat composée par l'hôte. « La main est à l'hôte » (qui la tient, ce qu'il fait, le code de la partie)
  à la place de la rumeur ; les gestes sur la bourse et la cale sont en fer, avec la raison du jeu : « L'hôte seul engage la bourse et la cale du groupe. »
  (`src/noyau/intentionsDeSiege.ts:154-161`, `src/noyau/halle.hors-store.test.ts:130`).
- « Bourses du groupe » montre la part de chacun sans − ni + (`bourse({ reglable: false })`) : l'invité ne règle rien.
- Chaque héros du bandeau dit qui le joue : « Lena (vous) » en laiton, les autres en fer, « Otto » marqué du sceau du
  réseau, en reconnexion.
- Qui tient la main : `src/noyau/netOwnership.ts:713` (le concerné de la modale, sinon le combattant actif, sinon
  l'hôte).
- À valider : « la main » posée à la place de la rumeur, sur tout écran joué à plusieurs ; la page qui défile quand
  elle est composée, sa raison au pied ; le nom du joueur sous chaque héros du
  bandeau ; les gestes de l'hôte montrés en fer à l'invité, avec leur raison ; l'invité voit la composition de l'hôte
  en direct.

## editeur-scene
- État `porte` de l'écran `editeur-de-scene`.
- Un plan de travail, pas un lieu. Barre : projet, documents « Scène », « Carte du monde », « Narratif », « Annuler »,
  « Rétablir », « Copier », « Coller », « Dupliquer », « Enregistrer », « Tester la scène »
(`src/hote/editeur.ts:135-534`).
- À gauche, un volet à onglets « Scènes » et « Outil » (« Lieux », « Routes », « Outil » sur la carte) : « 4 scènes au projet » (les quatre du projet Diligence), « Nouvelle scène », « Dupliquer la scène »,
  « Retirer la scène » ; palette des quinze outils du jeu, « Sélection » armé.
- Au centre : la scène vue de dessus, quadrillée, couches (« Couche 0 », « Couche 1 », « Ajouter une couche »), Nord ;
  une porte choisie, surlignée. Le plan est une esquisse, pas le relevé de la scène.
- À droite, l'inspecteur de la porte : Type, Fermée au départ, Porte secrète, Difficulté de Perception, Découvrable
  depuis, Matériau, Apparence ; « Déclencheurs (1) », « Dialogues (0) », « Rencontres (0) » ; la validation.
- Pied : « Arête 14, 8 E · couche 0 · Porte · Mur à ossature en bois » (`src/hote/editeur.ts:674`).
- À valider : l'éditeur dans les matières du jeu (bois, laiton, parchemin) plutôt qu'en outil neutre ; trois colonnes
  fixes (volet à onglets, plan, inspecteur) ; dans la barre, seul « Tester la scène » garde son libellé, les autres gestes
  leur pictogramme (« Coller » et « Dupliquer » neufs au kit) ; le Nord en bas à droite du plan ; les outils en palette
  d'icônes libellées ; les réglages d'une porte
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
- État `consultation` de l'écran `compendium`.
- Un registre relié, repris de celui des règles maison. Un signet par famille (les sept du jeu), « Compétences »
  ouverte ; volet « Catégories » : Compétences (48), Talents (187), Axes de forces (9), « Rechercher », filtre
  « Livre » et ses comptes, « Nouvelle entrée » (`src/hote/compendium.ts:43-68`).
- Page de gauche : en tête la catégorie, sous-titrée de son compte (« 187 entrées ») ; la famille est le signet ouvert ; les entrées de la catégorie avec leur source, « Négociateur » pointé, feuillets.
- Posée sur le registre, sa croix propre (gabarit 2 à 1280 de `dispositions.md`) : la fiche (Max, Test, source, description verbatim, lien « Compétence Marchandage »), ses renvois
  (Races 2, Carrières (par rang) 24, Créatures 19), « Modifier ».
- À valider : le Compendium en registre relié, familles en signets ; la fiche posée sur le registre plutôt qu'en page
  de droite ; la description coupée à la hauteur de son champ dans l'atelier ; la liste paginée en feuillets plutôt qu'en longue
  liste défilante ; les renvois en liens soulignés, tronqués avec leur reste (« et 21 autres ») ; « Modifier » et «
  Nouvelle entrée » visibles à la consultation ; le filtre « Livre » en puces à comptes.

## compendium-atelier
- État `atelier` de l'écran `compendium` : « Modifier » a ouvert l'atelier, la fiche posée porte le formulaire de
  l'entrée, sous-titrée « Atelier : Talents ». Champs tirés du schéma du Talent (`src/data/schemas/defs/talents.ts:89-90` :
  « Maximum » et son aide, « Test associé » et ses correspondances), « Nom », « Identifiant », « Description » (le
  Markdown de la donnée, verbatim), livre et page ; « Champs que l'entrée ne porte pas » : une puce « Ajouter :
  {libellé} » par champ facultatif absent (`ecran.formulaire.valeur.ajouter`).
- Gestes de l'atelier (`GesteDuCompendium`, `src/noyau/codex/session.ts:94-111` ; `atelierDe`,
  `src/hote/compendium.ts:162-181`) : `valeur { chemin, valeur }` par champ, `identifier { id }`, `enregistrer`
  (plaque pleine, à gauche), `abandonner`, `supprimer`. « Supprimer » est fermée, sa raison au survol
  (`ecran.compendium.refus.designee`, `fr.ts:912` ; la liste des désignations est un exemple). « Nouvelle entrée »
  est fermée tant que l'atelier est ouvert (`ecran.compendium.refus.atelierOuvert`).
- À valider : l'atelier sur la fiche posée, la liste restant dessous ; les champs absents en puces
  « Ajouter » plutôt qu'en champs vides ; « Supprimer » ouvert se joue en deux pressions sur place (« Confirmer la
  suppression », « Annuler »), comme l'abandon d'une possession : le compendium n'a pas d'« Annuler » d'historique.
  Libellés « Nom », « Livre », « Page » : exemples, le schéma les fournit.

## editeur-outil-terrain
- État `outil-terrain` de l'écran `editeur-de-scene` : l'outil « Terrain » armé dans la palette, rien de choisi. L'inspecteur
  porte les options de l'outil : « Pinceau » (1×1, 3×3 armé, 5×5, « Rectangle ») et « Terrains », les vingt-cinq de
  `src/data/terrains.json`, « Pavés » armé. Sur le plan, le pinceau de 3×3 sous le pointeur et les cases déjà
  peintes ; au pied, « Case 10, 16 · couche 0 · Terre battue · 0 m » (`ecran.editeur.pointee`).
- Gestes (`src/noyau/edition/session.ts:557-558`, `src/hote/editeur.ts:643-648`) : `{ geste: 'outil', outil: {
  mode: 'terrain', terrain } }`, `{ geste: 'pinceau', taille }` (`PINCEAUX` 1, 3, 5), `{ geste: 'rectangle',
  actif }`.
- À valider : les options de l'outil à la place de l'inspecteur tant que rien n'est choisi, la même manière pour
  les autres outils à options (Hauteur, Murs, Crénelage, Décor, Personnage, Navire, Zone) ; les terrains en grille
  de deux colonnes.

## editeur-supprimer
- État `supprimer` de l'écran `editeur-de-scene` : un personnage choisi sur le plan (« Gustav », nom d'exemple). Inspecteur de l'entité
  (`inspecteurDEntite`, `src/hote/editeur.ts:807-828`) : « Nom », « Fiche », « Orientation », « Couche »,
  « Inventaire », « Poser une troupe » et ses « Copies » (`{ geste: 'troupe', nombre }`), puis « Supprimer » au
  pied (`{ geste: 'supprimer' }`, `src/noyau/edition/session.ts:598`, `:1327`).
- Sur le plan, « Retirer cette couche » est fermée pour le rez, sa raison au survol (« Le rez ne se retire pas »,
  `ecran.editeur.couche.rez`).
- À valider : « Supprimer » au pied de l'inspecteur de toute sélection (entité, arête, zone, entrée,
  architecture), en une pression : « Annuler » de la barre le défait ; un retrait refusé (`refusDeRetrait`) est une
  plaque de fer, sa raison au survol.

## Non dessiné
- Coop : ouverture en cours, échec (« Service coop injoignable — réessayez. »), sans réseau, salon vu d'un invité,
  hôte déconnecté.
- Éditeur : document « Narratif », les options des outils autres que « Terrain » (même gabarit), l'architecture
  (`corps`, `batir`, `baie`), les calques (`planche`, `calque`, `caler`), validation avec défauts.
- Compendium : la recherche active, une table et son dé (« Dé de la table », `enTete`), l'adresse d'un passage
  (`resceller`).
