# Propositions : accueil et système (2026-11-16, #3935)

Compte rendu des six écrans, sans cible écrite, dessinés dans le style des maquettes validées. Contenu lu au code, pas
le design. Sources HTML hors dépôt : `/mnt/project-files/interface-3935/maquettes/accueil-et-systeme/`. Rien n'est
validé.

Pièces neuves : registre relié et ses signets ; contrôles de réglage (oui/non, réglette, segments, pas-à-pas) ;
affiche et avis cloués ; feuillet de sauvegarde ; titre gothique en dégradé laiton.

## accueil
- La compagnie de dos sur une crête, Altdorf au couchant, la comète à deux queues ; titre gothique doré ; trois
  entrées de jeu en plaques ; les outils en pastilles libellées en bas à droite.
- Entrées : Reprendre, Jouer, Jouer en ligne, Combat, Atelier, Éditeur, Compendium (`src/hote/accueil.ts:22-30`),
  Options (`:39`) ; titre `fr.ts:1223`.
- À valider : sur-titre et sous-titre ajoutés ; « Reprendre » en premier et armé (le code liste « Jouer » d'abord) ;
  ligne de la dernière sauvegarde sous « Reprendre » ; hiérarchie jeu et outils ; état « aucune sauvegarde » non
  dessiné.

## nouvelle-partie
- La salle d'une auberge-relais : le groupe attablé, une chaise libre, les voyageurs à recruter debout avec leur
  étiquette ; les campagnes en avis cloués, l'avis choisi déplié avec « Lancer » ; bandeau avec « Renvoyer » et
  « Place libre ».
- Entrées : pré-tirés (`src/hote/groupe.ts:83`, `src/data/pregens.json`), onglets Pré-tirés et Mes personnages,
  « Créer un personnage », « Importer un personnage… » (`groupe.ts:89`), « Recruter », « Renvoyer », « Lancer » ;
  campagnes (`groupe.ts:91-93`, `src/scenes/campaign.ts:171-182`) et campagne publiée (`src/hote/bibliotheque.ts`).
- À valider : cinq voyageurs visibles à la fois ; espèce absente de l'étiquette ; Supprimer et Exporter du roster non
  dessinés ; textes ajoutés (« La Compagnie », « Place libre ») ; nom de campagne publiée d'exemple.

## sauvegardes
- Quatre feuillets sur la table, l'automatique d'abord : vignette du lieu, lieu en gothique, date impériale, groupe,
  heure réelle ; avis de retrait scellé.
- Entrées : emplacements (`src/hote/sauvegardes.ts:32-34`, `:139`), Charger si plein (`:146`), Sauvegarder sur les
  manuels (`:147`), avis de retrait (`:153`).
- À valider : portraits du groupe et vignette du lieu, que la sauvegarde ne porte pas (`src/noyau/persistance/save.ts:26-34`) ;
  états sans partie et sauvegarde refusée non dessinés.

## menu-de-la-partie
- Le jeu flouté et assombri ; la colonne de l'accueil : Sauvegardes, Options, Jouer en ligne, Quitter la partie
  (`src/hote/groupe.ts:72-75`).
- À valider : geste « Reprendre » absent du jeu ; sur-titre « Partie en pause » ; colonne à gauche plutôt qu'au
  centre.

## options
- Préférences sur un volet de bois toujours visible (son, volumes, cadence de combat, dés fixés :
  `src/noyau/preferences.ts:36-83`) ; règles maison dans un registre relié, quinze signets (un domaine chacun, avec
  son compte), douze règles par feuillet ; l'aide se déplie sur la règle pointée ; une règle modifiée passe au rouge
  avec « Défaut » (`src/hote/reglages.ts:59-92`, `docs/regles-optionnelles.md`).
- À valider : un signet par domaine ; douze règles par feuillet ; libellés lisibles des options de liste (le jeu
  montre les ids) ; volumes en pourcentage ; règles verrouillées en combat non dessinées.

## ouverture-de-chapitre
- Carton plein écran : l'auberge-relais, les deux lunes, la diligence ; sur-titre, titre, tome, chapitre sur toile
  rouge, texte du chapitre (`src/scenes/diligence/diligence-projet.json:3755-3775`) ; la compagnie au bandeau ;
  « Commencer ».
- À valider : la compagnie affichée (le bloc d'ouverture ne la porte pas) ; mention de la page source ; texte posé
  sur l'image plutôt que sur parchemin.
