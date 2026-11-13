---
name: ajouter-un-effet
description: Ajouter ou changer un effet Godot (coup, sort, zone, souffle, lumière, son) : rendu en donnée, son CC0, visuel, recette.
---
<!-- GENERATED: agents:sync; source=.claude/skills/ajouter-un-effet/SKILL.md -->

# Ajouter un effet visuel ou sonore

Le noyau résout chaque effet au catalogue ; Godot dessine et joue ce qu'il reçoit, sans rien décider.
Contrat : `hotes/godot/pont/CONTRAT.md`, sections « Effets », « Musique » et « Lumière ». Épique #3770.

## 1. Le rendu, en donnée
- Un coup, une incantation, une zone : un rendu de `src/data/rendus.json` (schéma `src/data/schemas/defs/rendus.ts`) porte
  la couleur, les phases `depart`, `impact`, `manque`, `parade`, `zone` (un visuel et un son chacune) et le trajet
  (`projectile`, `vitesseMs`, `cloche`). Réutiliser un rendu existant avant d'en créer un.
- Le lier par `rendu` à ce qui le joue : Groupe d'arme (`weaponGroups.json`), objet du Groupe hétérogène
  `machine-de-guerre` (`trappings.json`), Domaine (`domains.json`), manœuvre (`maneuvers.json`), Type de Souffle
  (`breath-types.json`). La résolution vit dans `src/noyau/effetsDeLAppel.ts` ; ne jamais lire un libellé.
- Ce que le groupe ne voit pas ne se montre pas (#3950) : `effetsDeLAppel` passe chaque effet par la vision du groupe
  (`src/noyau/visionDuGroupe.ts`). Un coup, une incantation ou une zone dont l'auteur est hors de vue arrive avec `de`,
  `depart` et `trajet` à `null` : seule son arrivée ou sa nappe joue. Tout visuel et tout son neufs acceptent donc un
  effet sans auteur (`Effets._partir`, recette `projet/recettes/vision-du-combat.gd`).
- Une lumière : son ton (`lightTones.json`) porte `visuel` (feu, flammèche, lueur) et `son` en boucle ; posée hors de vue, elle arrive sans l'un ni l'autre (`lumiereDeLaScene`).
- Un flottant : son texte est un message de `src/i18n/messages/fr.ts` (clés `fx.*`), sa teinte `TEINTE_DU_FLOTTANT` ;
  un son de la partie (pas, heurt, victoire, dés) : son id dans `SONS_DE_LA_PARTIE` (`effetsDeLAppel.ts`).
- Une zone qui dure (`battle.zones`) : la nappe de son rendu, son son en boucle `zoneBoucle` ; une zone de scène
  ne se voit qu'avec son `rendu`. Ses cases changent sous la même `cle` (`caseDeZoneEnVue`) : réconcilier par case ; une zone qui coupe la vue se
  montre entière dès que le groupe en voit le bord. Un État : sa marque (`etats.json` : `marqueCouleur`, `marqueVisuel` de lumière, `marqueSon` en boucle).
  Une météo : son `son` en boucle (`ambiance.json › iso.weather`).
- Une musique : une définition `music: true` du registre (`src/data/sons/defs/`) ; le noyau la choisit
  (`musiqueDeLaPartie`), la scène peut l'imposer (`music.combat`, `music.ambient`).
- Un JSON édité à la main se réécrit par `serializeDataset` (`src/data/serialize.ts`) : le test de round-trip
  l'exige à l'octet.

## 2. Le son
- Un son CC0 seulement (OpenGameArt, Kenney, Freesound filtré CC0), téléchargé hors du dépôt.
- `npm run godot:son -- <fichier> <nom>.ogg --source "<page (archive : fichier), auteur>" --licence CC0-1.0
  [--filtre <filtres ffmpeg>] [--debut <s>] [--duree <s>]` le convertit en Ogg Vorbis mono 44,1 kHz, le dépose sous
  `hotes/godot/projet/sons/` (ignoré par git) et l'inscrit à `provenance.json` ; elle refuse une autre licence ou un nom
  déjà épinglé. Plusieurs variantes d'un même son : `souffle-1.ogg`, `souffle-2.ogg`…
- Sa définition sous `src/data/sons/defs/<id>.ts` (`files` : ses variantes, `volume`, `canal` : `ambiance` pour une
  boucle d'ambiance, `interface` pour un son d'interface, absent pour un effet ; une `music` joue sur `musique`), puis
  `npm run gen`. Godot le joue sur le bus d'`AudioServer` nommé par son canal
  (`hotes/godot/projet/default_bus_layout.tres`, recette `mixage.gd`), au volume que le joueur y règle.
- Le verser à la Release `modeles-3d` : branche `transfert/<x>` partie de `main`, fichiers ajoutés par `git add -f` ;
  `.github/workflows/transfert.yml` vérifie les empreintes, verse sans écraser et supprime la branche.

## 3. Le visuel, s'il est neuf
Le vocabulaire est fermé des deux côtés, à étendre ensemble :
- schéma : `visuelDEffetSchema` et `projectileSchema` (`rendus.ts`), `visuelDeLumiereSchema` (`lightTones.ts`), puis le
  stock nommé de `src/data/schemas/grammaire/valeurs-de-champ.test.ts` ;
- Godot : une scène sous `hotes/godot/projet/effets/<famille>/<id>.tscn` (`visuels`, `projectiles`, `flammes` ; le nom
  du fichier est l'id de la donnée), réglée dans l'éditeur par `npm run godot:ouvrir`. Un éclat : ses gerbes
  `CPUParticles3D` en enfants directs, son `OmniLight3D` `Eclair`, son `AnimationPlayer` dont l'animation `eclat`
  (jouée à la pose) pose l'émission à 0, éteint l'éclair et retire la scène au bout de sa vie. Une flamme : ses gerbes
  enregistrées continues. Un projectile : `Corps`, sa maille, et s'il luit sa traînée et sa lampe. Les gerbes prennent
  leur quad dans `effets/particule_lumineuse.tres` ou `particule_mate.tres`.

## 4. Le voir et le prouver
- L'atelier le montre sans liste propre : la vitrine (`vitrineDesEffets`) parcourt les catalogues, l'onglet Effets
  offre un bouton par effet (règle `.claude/rules/hote-godot.md`).
- `src/noyau/vitrineDesEffets.test.ts` pour la donnée ; une recette Godot (`hotes/godot/projet/recettes/effets.gd`,
  `foyers.gd`, `atelier-du-vehicule.gd`) pour le rendu. `npm run godot:sonde` les joue toutes, et vérifie que chaque
  visuel, projectile et fichier de la vitrine est connu de Godot : sa scène existe (`Effets.chemin_de_l_effet`).
- Ce qui change l'image se prouve sous les deux rendus, Forward+ hors d'une page et compatibilité dans la page
  (#3951) : une recette `const RECETTE_RENDUE := true`, lue aux pixels, que `npm run godot:rendus` joue sous chacun.

## Pièges connus
- Sous le rendu de compatibilité, une particule `CPUParticles3D` pas encore née se peint en noir : un éclat naît d'un
  coup (`explosiveness` 1), une gerbe continue naît d'avance (`preprocess`). Une gerbe lumineuse se fond par addition.
  Une zone qui dure pose l'éclat de son visuel en continu (`Effets.pose_continue`) : chaque gerbe émet sans fin, née
  d'avance, et tout autre enfant (éclair, `AnimationPlayer`) est retiré ; un éclat ne règle donc que des gerbes en
  enfants directs.
- La `taille` d'une gerbe est sa vraie mesure, en mètres (#3832) : une particule ne garde son échelle que par
  `billboard_keep_scale`, réglé dans les ressources partagées `effets/particule_*.tres`. Juger une taille au rendu
  réel, par une recette rendue (`npm run godot:rendus`) : la sonde headless ne peint rien.
- Un son en boucle (`Effets.son_en_boucle(son)`) libéré juste avant la sortie fuit : attendre
  `Foyer.SON_LIBERE_S` après avoir libéré son lecteur.
- Un nœud qui prend la couleur de l'effet est du groupe `teinte`, enregistré dans la scène : une gerbe garde son dégradé
  blanc à son opacité et reçoit la teinte par `color`, une lampe par `light_color`, une maille par une copie de sa
  matière en surcharge (`Effets.teinter`, qui ne modifie jamais une ressource de la scène).
- Rejouer l'animation `eclat` dans l'éditeur rejoue l'éclat ; son dernier geste (`queue_free` de la racine, à la fin
  exacte de l'animation) retire la scène en jeu.
- Plusieurs éclats d'un même visuel posés ensemble : `add_child(eclat, true)`, sinon Godot les renomme.
- Toute arithmétique, comparaison d'ordre ou mesure GDScript vit dans `mise_en_page.gd` (garde
  `src/hote/derive-du-noyau.hors-store.test.ts`).
- Une recette ne contrôle un projectile qu'après le temps de son vol (`trajet.dureeS`), jamais au nombre d'images.
