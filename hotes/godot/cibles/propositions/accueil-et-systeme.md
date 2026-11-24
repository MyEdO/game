# Propositions : accueil et système (2026-11-16, #3935)

Compte rendu des huit écrans, sans cible écrite. Contenu lu au code, pas le design. Sources au dépôt : huit écrans de
`sources/maquettes/`, chacun la liste de ses états au format de `sources/maquettes/maquette.ts`, dessinés par
`sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png> --format 16:9 [--etat <état>]`) : `accueil`,
`nouvelle-partie` (`pretires`, `roster`, `coop`), `sauvegardes` (`sauvegardes`, `combat`), `menu-de-la-partie`,
`options` (`options`, `chance`, `verrou`), `chapitre` (`ouverture`, `fin`) et `fin-de-seance` ; `maquettes/systeme.ts`
porte l'instant et la séance qu'ils partagent. Les décors (la crête au couchant, la salle commune, l'auberge-relais,
Altdorf au matin, le jeu assombri) et les feuilles de la famille vivent dans `sources/accueil-et-systeme/`.
Premières maquettes : chaque « À valider » attend l'utilisateur.
- À valider (#4585) : le grand titre libre a une taille (80) et une grille pour l'accueil, le menu de la partie et le
  chapitre (sur-titre, nom, filet, suite ; au chapitre la toile et le corps), monté de 20 ; la fin de chapitre porte le
  nom de la campagne et son tome comme l'ouverture ; la colonne des entrées pose sous la principale l'instant qu'elle
  reprend (la dernière sauvegarde à l'accueil, l'instant de la partie au menu, qui le portait sous son titre).

Pièces neuves : registre relié et ses signets ; contrôles de réglage (oui/non, réglette, segments, pas-à-pas) ;
affiche et avis cloués ; feuillet de sauvegarde ; titre gothique en dégradé laiton ; case à cocher et son octroi
(`seance.js`, `seance.css`, communs aux deux écrans de fin de séance).

## accueil
- La compagnie de dos sur une crête, Altdorf au couchant, la comète à deux queues ; titre gothique doré ; trois
  entrées de jeu en plaques ; les outils en pastilles libellées en bas à droite.
- Entrées : Continuer (l'entrée `reprendre`), Jouer, Jouer en ligne, Combat, Atelier, Éditeur, Compendium (`src/hote/accueil.ts:22-30`),
  Options (`:39`) ; titre `fr.ts:1234`.
- « Continuer » charge la dernière sauvegarde, dite sous la plaque ; « Reprendre » reste la fin d'un arrêt de jeu.
- À valider : sur-titre et sous-titre ajoutés ; « Continuer » en premier et armé (le code liste « Jouer » d'abord) ;
  l'entrée `reprendre` ouvre aujourd'hui le panneau des sauvegardes (`src/hote/elements.ts:93-95`) : l'hôte doit
  servir le chargement de l'emplacement le plus récent ; hiérarchie jeu et outils ; état « aucune sauvegarde » non
  dessiné.

## nouvelle-partie
- La salle d'une auberge-relais : le groupe attablé, une chaise libre, les voyageurs à recruter debout avec leur
  étiquette ; les campagnes en avis cloués, l'avis choisi déplié avec « Lancer » ; bandeau avec « Renvoyer » et
  « Place libre ». L'écran se ferme par la croix.
- Entrées : pré-tirés (`src/hote/groupe.ts:83`, `src/data/pregens.json`), onglets Pré-tirés et Mes personnages,
  « Créer un personnage », « Importer un personnage… » (`groupe.ts:89`), « Recruter », « Renvoyer », « Lancer » ;
  campagnes (`groupe.ts:91-93`, `src/scenes/campaign.ts`) et campagne publiée (`src/hote/bibliotheque.ts`).
- État `roster` : onglet « Mes personnages » ; sous « Recruter » du personnage pointé, deux
  pastilles « Exporter » et « Supprimer » (`{roster:{exporter}}`, `{roster:{retirer}}`, `src/hote/groupe.ts:86-90`).
- État `coop` : la « Place libre » porte le choix de son siège
  (`affecterLEmplacementAuSiege(emplacement, siege)`, `src/noyau/sieges.ts:143` ; refus « Cet emplacement est déjà
  occupé. », « Ce siège n’est pas à la table. »), décidé par l'hôte seul.
- Dans ces deux états, « Modifier » à côté de « Renvoyer » ouvre la création sur le héros. Verbe à modifier :
  `{creation:{geste:'ouvrir', args:[heroId?]}}` (brouillon de `draftFromHero`, `src/noyau/creation/brouillon.ts:227`) ;
  l'engagement émet déjà `remplacerLeHeros(heroId, heros)`.
- À valider : cinq voyageurs visibles à la fois ; espèce absente de l'étiquette ; « Modifier » vaut pour tout
  l'écran, l'image de base est laissée telle quelle ; noms de personnages et de joueurs d'exemple ; textes ajoutés
  (« La Compagnie », « Place libre », « Siège ») ; nom de campagne publiée d'exemple.

## sauvegardes
- Quatre feuillets sur la table, l'automatique d'abord : ce que la sauvegarde porte, rien d'autre (lieu en
  gothique, date impériale, heure réelle : `src/noyau/persistance/save.ts:26-34`) ; avis de retrait scellé.
- Entrées : emplacements (`src/hote/sauvegardes.ts:32-34`, `:139`), Charger si plein (`:146`), Sauvegarder sur les
  manuels (`:147`), avis de retrait (`:153`).
- État `combat` : chaque « Sauvegarder » fermé, « Impossible de sauvegarder en plein combat. »
  au survol (`MESSAGE_DU_REFUS`, `src/hote/sauvegardes.ts`) ; chez l'invité, « Seul l’hôte de la partie sauvegarde. ».
- À valider : état sans partie non dessiné.

## menu-de-la-partie
- Le jeu flouté et assombri ; la colonne de l'accueil : Sauvegardes, Options, Jouer en ligne, Quitter la partie
  (`src/hote/groupe.ts:72-75`), et « Terminer la séance » (`ouvrirLaFinDeSeance`, `src/noyau/actionsDuNoyau.ts:224`).
- À valider : la plaque ouvre `fin-de-seance` ; son refus hors exploration ou chez l'invité (`refusDeFinDeSeance`,
  `src/noyau/partyFlow.ts:682`) non dessiné ; geste « Reprendre » absent du jeu ; sur-titre « Partie en pause » ; colonne à gauche plutôt qu'au
  centre.

## options
- Préférences sur un volet de bois toujours visible (son, volumes, cadence de combat, dés fixés :
  `src/noyau/preferences.ts:36-83`) ; règles maison dans un registre relié, quinze signets (un domaine chacun, avec
  son compte), douze règles par feuillet ; l'aide se déplie sur la règle pointée ; une règle modifiée passe au rouge
  avec « Défaut » (`src/hote/reglages.ts:59-92`, `docs/regles-optionnelles.md`).
- À valider (#4585) : chaque signet a la boîte de l'ouvert (176) ; un signet fermé ne montre que ses 160 premiers.
- À valider (#4585) : l'étiquette d'un voyageur de la salle a une largeur fixe de 148.
- À valider : un signet par domaine ; douze règles par feuillet ; libellés lisibles des options de liste (le jeu
  montre les ids) ; volumes en pourcentage ; « hors du livre » marque une valeur que le livre laisse au MJ et que le jeu
  fixe (le tag `maison` de la donnée).
- État `verrou` : en combat, chaque contrôle de règle est fermé ; la raison du noyau au survol
  (`houseRules.lockedInBattle`, `src/hote/reglages.ts:81-82`) ; chez l'invité, « L’hôte règle les règles maison. ».
  Les préférences restent ouvertes.
- État `chance` : signet « Destin & Résistance », règle `chance-en-cours-de-session` sur `manual`
  (`src/data/reglesOptionnelles.json:128-147` ; LDB 17 l.47) et sa plaque « Regagner la Chance maintenant »
  (`restaurerLaFortune()`). Besoin : `zonesDesReglages` sert `OptionalRule.action` en bouton quand la règle vaut
  `action.when`. Les valeurs `off | manual | auto` sont celles que le noyau sert en libellé (`reglages.ts:62`).

## ouverture-de-chapitre
- État `ouverture` de l'écran `chapitre`.
- Carton plein écran : l'auberge-relais, les deux lunes, la diligence ; sur-titre, titre, tome, chapitre sur toile
  rouge, texte du chapitre (`src/scenes/diligence/diligence-projet.json:3755-3775`) ; la compagnie au bandeau ;
  « Commencer ».
- À valider : la compagnie affichée (le bloc d'ouverture ne la porte pas) ; la page source non mentionnée ; texte posé
  sur l'image plutôt que sur parchemin.

## fin-de-seance
- Ouverte du menu de la partie, par-dessus le jeu assombri : un feuillet par héros avec ce qu'il a écrit (Motivation,
  Ambitions à court et à long terme), ses trois cases et ce que chacune octroie, sa Détermination sur son maximum, et
  en tête ce que la séance lui vaut ; le groupe en bande, ses deux cases ; « Terminer la séance » ; la croix referme
  sans rien octroyer. Une Ambition cochée ouvre le champ de la suivante.
- Règles : Ambition à court terme accomplie +50 PX, à long terme +500 PX, et une nouvelle se choisit en fin de séance
  (LDB 05 l.795-799) ; Ambitions de groupe, +50 et +500 PX à chaque héros (LDB 05 l.837-841) ; +1 Détermination pour
  qui a agi selon sa Motivation, plafonnée (LDB 17 l.81, `src/engine/session.ts:28-45`) ; la Chance revient à la
  séance suivante (LDB 17 l.41). Libellés des cases : `verbe.finDeSeance.*`.
- Verbes : `ouvrirLaFinDeSeance()` (plaque du menu), `fenetreChoisir('finDeSeance', axe, booléen, heroId?)` par case,
  `fenetreValider('finDeSeance')` sur « Terminer la séance », `fenetreFermer('finDeSeance')` sur la croix,
  `ecrireLHistorique(heroId, { ambitionShort | ambitionLong | motivation })` pour le champ ouvert
  (`src/noyau/partyFlow.ts:650-716`).
- À valider : la croix plutôt que la plaque « Continuer » du jeu (`verbe.finDeSeance.fermer`) ; le gain par héros en
  tête du feuillet, qu'aucune vue de `src/hote` ne sert (`heroSessionXp`) ; Motivations et Ambitions d'exemple, celles
  de LDB 05 l.444, l.776-778, l.786-788 ; « Aucune Ambition … notée » (`src/ui/SessionEndModal.tsx:70-74`) ; la
  retraite du héros à l'Ambition à long terme accomplie (LDB 05 l.799) n'est pas offerte, le jeu ne l'a pas.
- Verbe qui manque : l'Ambition de groupe n'est écrite nulle part (ni champ d'état, ni verbe) : l'écran ne montre que
  ses cases ; l'écrire et la réécrire demande un verbe neuf.

## fin-de-chapitre
- État `fin` de l'écran `chapitre`, pendant de l'ouverture : Altdorf au petit matin, le titre de clôture sur toile rouge et son sous-titre
  (`src/scenes/diligence/diligence-projet.json:3775-3789`), « Ce que la route retiendra » (les objectifs soldés et les
  PX du chapitre), « Lieux révélés », « Tombés en chemin » (`src/noyau/chapitreRecap.ts:34-68`, `chap.*`) ; dessous, la
  fin de séance que le récap ouvre : une colonne par héros et celle du groupe, les mêmes cases que `fin-de-seance` ;
  « Clore le chapitre » et « Plus tard ».
- Verbes : `fenetreChoisir('finDeSeance', …)` par case, `fenetreValider('finDeChapitre')` sur « Clore le chapitre »
  (termine la séance, consomme la clôture, borne le chapitre suivant : `chapitreRecap.ts:105-112`),
  `fenetreFermer('finDeChapitre')` sur « Plus tard » (ajourne, rien n'est appliqué : `:118`).
- À valider : un seul écran quand le jeu en fait deux volets (`chap.poursuivre`) ; les Ambitions écrites absentes des
  colonnes, lisibles sur `fin-de-seance` ; le champ de l'Ambition suivante (`ecrireLHistorique`) n'y est pas ;
  « +140 PX » d'exemple ; l'état de l'invité (« Masquer », `chap.refusHote`) non dessiné.
