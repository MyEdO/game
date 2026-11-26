# Propositions : hors partie et outils (2026-11-17, #3935)

Compte rendu des onze états dessinés (six d'origine, trois ajoutés par l'audit des verbes, deux par l'audit des
dispositions, #4411) pour la coop, l'éditeur
de campagne et le Compendium, des écrans sans image d'intention ni cible écrite. Contenu lu au code (`src/hote/`,
`src/noyau/`, `server/`, `src/i18n/messages/fr.ts`), jamais le design d'un écran existant. Sources au dépôt : quatre
écrans de `sources/maquettes/` et un état de la halle, chacun la liste de ses états au format de
`sources/maquettes/maquette.ts`, dessinés par `sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png>
--format 16:9 [--etat <état>]`) : `coop` (`ouvrir`, `salon`), `halle` (`la-main`), `editeur-de-scene` (`porte`,
`outil-terrain`, `supprimer`), `editeur-carte-du-monde` et `compendium` (`consultation`, `atelier`, `index`, `recherche`) ;
`maquettes/editeur.ts` porte le projet, les documents et la barre que les deux éditeurs partagent. Le plan de la scène,
la carte de l'éditeur, la ligne de liste et la tablée vivent dans `sources/outils/` (`editeur.js`, `outils.js`,
`outils.css`).
Premières maquettes : chaque « choix à valider » attend l'utilisateur.
- À valider (#4585) : les deux éditeurs sur la grille des colonnes (`dispositions.md`, « La grille intérieure ») : aux
  volets, la liste au plein et les gestes de la scène au pied fixe du volet ; à l'inspecteur, ce qui est choisi en
  tête, les propriétés au corps à écarts uniformes, la validation ou « Supprimer » au pied fixe ; la palette des
  terrains de l'outil « Terrain » défile au corps (liste longue par nature) au lieu de descendre jusqu'au bas.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (`coop.*` l.1419-1441, `ecran.salon.*` l.1484-1495,
`party.slot.invite` l.1286, `groupe.hoteSeul` l.2600, `ecran.editeur.*`, `ecran.compendium.*` l.892-932) ; talent
« Négociateur » verbatim de `src/data/talents.json:3325` ; scènes, lieux et routes de
`projets/jeu-de-role/campagnes/diligence/diligence-projet.json`.

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
  (`src/noyau/intentionsDeSiege.ts:156-163`, `src/noyau/halle.hors-store.test.ts:130`).
- « Bourses du groupe » montre la part de chacun sans − ni + (`bourse({ reglable: false })`) : l'invité ne règle rien.
- Chaque héros du bandeau dit qui le joue : « Lena (vous) » en laiton, les autres en fer, « Otto » marqué du sceau du
  réseau, en reconnexion.
- Qui tient la main : `src/noyau/netOwnership.ts:718` (le concerné de la modale, sinon le combattant actif, sinon
  l'hôte).
- À valider : « la main » posée à la place de la rumeur, sur tout écran joué à plusieurs ; la page qui défile quand
  elle est composée, sa raison au pied ; le nom du joueur sous chaque héros du
  bandeau ; les gestes de l'hôte montrés en fer à l'invité, avec leur raison ; l'invité voit la composition de l'hôte
  en direct.

## editeur-scene
- État `porte` de l'écran `editeur-de-scene`.
- Un plan de travail, pas un lieu. Barre : projet, documents « Scène », « Carte du monde », « Narratif », « Annuler »,
  « Rétablir », « Copier », « Coller », « Dupliquer », « Enregistrer », « Tester la scène »
(`src/hote/editeur.ts:136-535`).
- À gauche, un volet à onglets « Scènes » et « Outil » (« Lieux », « Routes », « Outil » sur la carte) : « 4 scènes au projet » (les quatre du projet Diligence), « Nouvelle scène », « Dupliquer la scène »,
  « Retirer la scène » ; palette des quinze outils du jeu, « Sélection » armé.
- Au centre : la scène vue de dessus, quadrillée, couches (« Couche 0 », « Couche 1 », « Ajouter une couche »), Nord ;
  une porte choisie, surlignée. Le plan est une esquisse, pas le relevé de la scène.
- À droite, l'inspecteur de la porte : Type, Fermée au départ, Porte secrète, Difficulté de Perception, Découvrable
  depuis, Matériau, Apparence ; « Déclencheurs (1) », « Dialogues (0) », « Rencontres (0) » ; la validation.
- Pied : « Arête 14, 8 E · couche 0 · Porte · Mur à ossature en bois » (`src/hote/editeur.ts:675`).
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
- État `consultation` de l'écran `compendium`, gabarit 9 « Consultation » de `dispositions.md` : un plein écran à part,
  trois cadres fixes dans les quatre états (`barre-du-compendium`, `liste-du-compendium`, `fiche-du-compendium`), parts
  de la vue : fiche 65,4 %, liste 21,0 %, barre 6,0 % (avant : fiche posée 29,6 %).
- Barre : le titre, retour et suivant (suivant fermé : aucune fiche après), une seule recherche « dans tout le
  Compendium », le fil Compétences › Talents › Négociateur, la bascule « Atelier » éteinte, la croix, seule de l'écran.
- Liste : « Talents » et son compte (187), qui ouvre l'Index ; le filtre de livre (LDB 168, VDM 8, « +6 ») ; les
  talents de `src/data/talents.json` dans l'ordre alphabétique, 24 rangées visibles qui défilent, la source à droite,
  « Négociateur » pointé ; le rail de lettres, N armé.
- Fiche : nom, genre, source, « Épingler pour comparer » ; Max, Test (« Marchandage » en lien), la description
  verbatim, « Marchandage » en lien ; les renvois en onglets comptés (Carrières 24, Créatures 19, Races 2 : les entrées
  de `careerLevels.json`, `creatures.json`, `species.json` qui désignent `negociateur`), toutes, la colonne défile ;
  « Colporteur » survolé ouvre son aperçu (genre, rang, première phrase verbatim de `careers.json`, source).
- À valider : la liste en défilement et son rail de lettres plutôt qu'en feuillets ; le filtre « Livre » réduit aux
  deux livres les plus fournis, les autres derrière « +6 » (liste déroulée, non dessinée) ; les renvois tous visibles
  en onglets comptés, une colonne qui défile, la note de rang (N1 à N4) et de livre hors du LDB ; l'aperçu du renvoi
  survolé ; « Modifier » et « Nouvelle entrée » absents de la consultation, au pied de la fiche en mode Atelier
  seulement ; la recherche au centre de la barre, curseur dedans à l'ouverture.
- Besoins du noyau que la disposition suppose (`src/noyau/codex/`) : la recherche sur tout le Compendium (elle porte sur
  la catégorie ouverte, `filterItems(cat.items…)`, `search.ts`) ; un geste de retour après `suivre` (et suivant), absent
  de `GesteDuCompendium` (`session.ts:101-119`) ; l'épingle pour comparer (la fiche épinglée sur la moitié gauche du
  rect de la fiche).

## compendium-index
- État `index` : l'Index posé par-dessus la liste et la fiche, sur leur rect commun (`index-du-compendium`, surcouche) :
  « Filtrer les 140 catégories… », les sept familles du Codex et leur nombre de catégories, « Tables » ouverte, ses
  63 catégories sur trois colonnes, sous-groupes en intertitres, compte par ligne (le registre du Codex,
  `src/noyau/codex/registry`).
- À valider : l'Index sur toute la largeur de la liste et de la fiche (la proposition de l'audit : 820 de large ; à
  cette largeur neuf libellés de « Tables » se coupent) ; les libellés longs sur deux lignes ; 14 catégories de
  « Tables » d'une seule entrée y pèsent autant que « Niveaux de carrière » (432).

## compendium-recherche
- État `recherche` : « marchand » dans la barre, « 10 résultats dans 5 catégories » à la place du fil ; la liste
  devient « Résultats » (10), groupés par catégorie avec leur compte (Compétences, Carrières, Niveaux de carrière,
  Créatures, Possessions : les noms qui portent « marchand » dans `skills.json`, `careers.json`, `careerLevels.json`,
  `creatures.json`, `trappings.json`) ; la fiche lue reste.
- À valider : les résultats à la place de la liste, même rect ; la recherche sur les noms seulement (pas la prose) ;
  la fiche lue avant la recherche reste jusqu'au choix d'un résultat.

## compendium-atelier
- État `atelier` de l'écran `compendium` : la bascule « Atelier » armée, les mêmes rects ; le corps de la fiche porte
  le formulaire de l'entrée, sous-titrée « Atelier · Talents ». Champs tirés du schéma du Talent
  (`src/data/schemas/defs/talents.ts:89-90` : « Maximum » et son aide, « Test associé » et ses correspondances),
  « Nom », « Identifiant », « Description » (le Markdown de la donnée, verbatim) sur la hauteur qui reste, livre et
  page ; « Champs que l'entrée ne porte pas » : une puce par champ facultatif absent (`ecran.formulaire.valeur.ajouter`).
- À droite, les renvois sous « Désignent cette entrée : « Supprimer » est fermé », en liens.
- Gestes de l'atelier (`GesteDuCompendium`, `src/noyau/codex/session.ts:94-111` ; `atelierDe`,
  `src/hote/compendium.ts:162-181`) : `valeur { chemin, valeur }` par champ, `identifier { id }`, `enregistrer`
  (plaque pleine, à gauche), `abandonner`, `supprimer`. « Supprimer » est fermée, sa raison au survol
  (`ecran.compendium.refus.designee`, `fr.ts:912`).
- À valider : les désignations en liens dans la colonne des renvois, la raison au survol de « Supprimer » qui les
  compte ; les champs absents en puces plutôt qu'en champs vides ; « Supprimer » ouvert se joue en deux pressions sur
  place (« Confirmer la suppression », « Annuler »), comme l'abandon d'une possession : le compendium n'a pas
  d'« Annuler » d'historique. Libellés « Nom », « Livre », « Page » : exemples, le schéma les fournit.

## editeur-outil-terrain
- État `outil-terrain` de l'écran `editeur-de-scene` : l'outil « Terrain » armé dans la palette, rien de choisi. L'inspecteur
  porte les options de l'outil : « Pinceau » (1×1, 3×3 armé, 5×5, « Rectangle ») et « Terrains », les vingt-cinq de
  `src/data/terrains.json`, « Pavés » armé. Sur le plan, le pinceau de 3×3 sous le pointeur et les cases déjà
  peintes ; au pied, « Case 10, 16 · couche 0 · Terre battue · 0 m » (`ecran.editeur.pointee`).
- Gestes (`src/noyau/edition/session.ts:582-584`, `src/hote/editeur.ts:808-812`) : `{ geste: 'outil', outil: {
  mode: 'terrain', terrain } }`, `{ geste: 'pinceau', taille }` (`PINCEAUX` 1, 3, 5), `{ geste: 'rectangle',
  actif }`.
- À valider : les options de l'outil à la place de l'inspecteur tant que rien n'est choisi, la même manière pour
  les autres outils à options (Hauteur, Murs, Crénelage, Décor, Personnage, Navire, Zone) ; les terrains en grille
  de deux colonnes.

## editeur-supprimer
- État `supprimer` de l'écran `editeur-de-scene` : un personnage choisi sur le plan (« Gustav », nom d'exemple). Inspecteur de l'entité
  (`inspecteurDEntite`, `src/hote/editeur.ts:974-998`) : « Nom », « Fiche », « Orientation », « Couche »,
  « Inventaire », « Poser une troupe » et ses « Copies » (`{ geste: 'troupe', nombre }`), puis « Supprimer » au
  pied (`{ geste: 'supprimer' }`, `src/noyau/edition/session.ts:624`, `:1387`).
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
- Compendium : la comparaison de deux fiches épinglées, le filtre de livre déroulé, une table et son dé (« Dé de la table », `enTete`), l'adresse d'un passage
  (`resceller`).
