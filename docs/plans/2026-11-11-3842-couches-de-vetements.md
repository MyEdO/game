# Couches de vêtements qui se traversent : la pile résolue au montage (#3842, 2026-11-11)

Ticket: #3842

Archive datée du plan, pas une référence vivante. Les mesures et l'état du chantier sont aux commentaires du ticket.

## But, livrable, critère de fini

- **But** : toute tenue à plusieurs couches reste ordonnée en clip et sous silhouette, par une seule solution commune
  à toutes les pièces, sans réglage pièce par pièce.
- **Critère de fini** : celui du ticket, inchangé. Une solution commune ; la porte du Sorcier ne garde que l'écart
  admis de la tête (#3761) sur ses cinq passes ; une garde mesure la main qui traverse un vêtement d'une autre zone ;
  la procédure `creer-un-personnage-3d` à jour.
- **Livrable** : une fonction pure `resoudreLaPile` (`hotes/godot/asset/pile.ts`), appliquée par l'évaluateur (lot 1)
  et par le montage Godot (lot 2). La pile ferme la classe « deux couches empilées portent des poids différents ».
  Elle ne ferme pas à elle seule le critère : ce qui reste est nommé plus bas, avec sa suite.

## Ce que font les jeux à personnages personnalisables

Aucun ne règle la traversée pièce par pièce chez l'auteur. Tous résolvent la pile à l'équipement, depuis ce qui est
réellement porté :

| Jeu ou moteur | Technique | Ce qu'on en retient |
|---|---|---|
| Roblox, Layered Clothing | cages intérieure et extérieure, `WrapLayer.AutoSkin` reprend les poids du corps, Hidden Surface Removal | la couche du dessous reprend la déformation de celle qui la couvre ; ce qui est couvert ne se dessine pas ; l'échec documenté est le poids pris à la mauvaise partie du corps |
| Unreal, Mutable | Mesh Reshape, Remove Unseen, Clip Mesh With Mesh, à la composition | la résolution est un calcul de composition, pas une donnée d'auteur |
| Cyberpunk 2077, Garment Support | chaque vêtement porte de quoi rentrer sous le suivant | le recul sous la couche du dessus |
| World of Warcraft, geosets | les parties couvertes se cachent | masquer plutôt que réconcilier |
| Epic, « Robust Skin Weights Transfer via Weight Inpainting » (SIGGRAPH Asia 2023) | transfert des poids là où la correspondance est sûre, lissage ailleurs | ne retenir que les correspondances sûres, fondre le reste |

Notre masque par zones (`couvre`) est le geoset de WoW. Il manquait les trois autres gestes : la reprise des poids, le
recul, et le masque au triangle.

## La méthode

Une fois par composition, sur la tenue posée au repos (formes cuites, sans gabarit : ce que le montage fond), de la
pièce la plus extérieure à la plus intérieure. Elle ne lit d'une pièce que sa géométrie et ses poids ; d'un manifeste
que la couche, la catégorie et les chaînes de la base, déjà déclarées.

1. **Couvrir.** Un point est couvert par le triangle le plus proche d'une pièce qui couvre la sienne, tourné du même
   côté, à 3 cm derrière lui au plus ou 1 cm devant. C'est le test de couverture des gardes (`visiterLaCouverture`),
   écrit une seule fois.
2. **Retenir.** Il reprend, au point couvrant, les poids de peau de sa couverture, tout entier jusqu'à 1 cm d'elle, de
   moins en moins jusqu'à 3 cm. Sous plusieurs couvertures, la plus extérieure passe d'abord. Réduit à quatre os,
   chaque os gardé perd le poids du plus fort os écarté : deux voisins qui n'écartent pas le même os gardent des poids
   voisins.
3. **Ne pas retenir à tort.** Une couverture qui flotte sur une chaîne (jupe, cape) ne retient pas ce qu'une chaîne ne
   porte pas. Une couverture qui tient à une autre partie du corps (ni les mêmes os, ni un os et son parent) ne retient
   rien : c'est l'échec documenté de Roblox.
4. **Suivre.** Les points de la même pièce à moins de 3 cm d'un point plus retenu qu'eux le suivent, en fondu avec la
   distance : la part retenue ne varie pas plus vite, d'un voisin à l'autre, que ce fondu.
5. **Garder rigide ce qui l'est.** Des points que leur auteur a liés aux mêmes poids par leurs arêtes forment un bloc,
   qui ne cède qu'autant que le moins retenu de ses points : à moitié couvert, il garde les poids de son auteur.
6. **Reculer.** Un point retenu devant sa couverture, ou à moins de 3 mm derrière elle, recule vers 3 mm, à proportion
   de ce qu'elle le retient ; ses voisins d'arête reculent avec lui, d'un écart borné par la moitié de la hauteur de
   leurs triangles.
7. **Masquer.** Un triangle dont les trois points sont retenus tout entiers ne se dessine plus.

À couche égale, un accessoire couvre ce qui n'en est pas un ; sinon l'ordre se mesure au repos neutre
(`ordreDesCouches`).

Par contrat : une pièce qui perce sa couverture de plus de 1 cm au repos est en défaut chez son auteur, la porte le
nomme (`couche-percee-au-repos`).

## Lot 1 : le cœur pur et l'évaluateur

- `hotes/godot/asset/pile.ts` : `resoudreLaPile(pieces, couvre, squelette)`, sans dépendance, sur des tableaux typés ;
  il porte aussi le test de couverture que les gardes `traversee` et `membreDansUnVetement` importent.
- `hotes/godot/asset/evaluateur/pile.ts` : la pile posée sur la scène three de l'évaluateur, avant toute mesure en clip.
- L'étirement se mesure contre les longueurs d'auteur, relevées avant la pile. Le bilan de la pile (points retenus,
  suiveurs, reculés, triangles masqués) entre au rapport (`mesures.pile`).
- Correction de donnée : le manifeste publié de `baudrier-sur-armure` déclarait la couche `tenue` ; porté sur le
  plastron, il est de couche `armure`. La pièce n'a pas de source au dépôt (#3761) : la déclaration se corrige au
  manifeste publié.

## Lot 2 : le montage Godot

- **Une seule fonction.** La page résout la pile par `resoudreLaPile`, la fonction de l'évaluateur ; le montage ne
  recode rien. L'ordre des couches (`ordreDesCouches`, dont la règle de l'accessoire et le vote de même couche) est au
  cœur pur (`asset/pile.ts`), que la page et l'évaluateur appellent tous deux, sur des surfaces neutres sans forme ni
  gabarit.
- **Une pièce de pile** est le corps de la base, ou un élément monté qui déclare une couche, par ses surfaces skinnées
  visibles et fondues. Godot fond toute pièce skinnée publiée : aucune des 120 pièces skinnées du projet n'a de
  transformation propre ni de second jeu d'influences, que la porte refuse (`influences-au-dela-de-4`). Les deux
  résolvent donc le même ensemble.
- **Où.** Dans `MontageDeComposition.refondre`, sur ce qu'il fond : positions (formes cuites par `cuire_les_formes`),
  indices, os et poids de chaque surface, positions sans forme (le mesh gardé en `FORMES`), rang de couche et accessoire
  de son élément (`couches` de `modeles`), parents du squelette et os de chaîne de la base (`osDeChaine`). La fusion
  porte le résultat ; les meshes propres des pièces restent ceux de leur auteur.
- **Sans geler l'image.** Le calcul coûte 1,4 s pour le Soldat sous Node, 4 à 6 s dans l'export (Chromium sans carte
  graphique, demande et réponse d'environ 1 Mo chacune). La page le fait hors du fil de l'image, dans un fil de fond
  (`pile.worker.ts`, embarqué dans le bundle du pont) : `wfrpPont.resoudreLaPile(demande, rendre)`. `refondre` fond
  tout de suite sans la pile, la demande, et refond à la réponse si ce qui est fondu n'a pas changé. La réponse se
  garde tant que la demande ne change pas : un habillage ou une couleur ne recalcule rien.
- **Sans page** (recette autonome, hors Web) : la fusion se fait sans pile.
- **Échange.** Tableaux typés encodés en base64 dans le JSON, pas des nombres JSON (`CONTRAT.md`, « Pile des
  couches »).
- **Os gagnés.** Une pièce reprend des os absents de son skin : la fusion les lie au repère que leur donne la
  première pièce fondue qui les porte.
- **Preuve.** La recette autonome `pile-des-couches.gd` prouve la pose d'une pile reçue sur la fusion (sommets, os,
  poids, triangles). La recette d'export (`recette.mjs --parcours preset`) prouve que Godot demande la bonne pile : le
  bilan que porte la fusion est celui de l'évaluateur sur les mêmes éléments et les mêmes formes, à 1 % près (Godot
  quantifie les poids sur 16 bits).

## Ce que la pile ne ferme pas

- **La main dans un vêtement pendant un clip** (`membre-dans-un-vetement`, 91 à 306 lignes par passe au Sorcier,
  toutes des mains). Deux cas, deux suites :
  - la main traverse un vêtement qui pend à une chaîne (cape, jupe de la robe) : les pistes de chaîne sont cuites par
    clip dans la base (`scripts/personnage-3d/base/chaines.py`) sans connaître les mains ; la suite générale est de
    les cuire en s'écartant des mains et des avant-bras ;
  - la main se pose sur un vêtement ajusté (torse, bras, capuche) : le clip est écrit pour le corps nu, la main entre
    de l'épaisseur du vêtement.
  Le critère de fini du ticket les compte. Qu'en faire est une décision de l'utilisateur, à lui poser.
- **Les traversées qui restent** après la pile, mesurées aux portes et consignées au ticket.
- **Les défauts de géométrie au repos** au-delà de 1 cm : à corriger à la pièce.

## Hypothèses

- Toute pièce qui couvre est opaque : un triangle couvert ne se voit pas. C'est le cas de toutes les pièces publiées.
- Les réglages (3 cm, 1 cm, 3 mm, moitiés) sont des constantes de la méthode, les mêmes pour toute pièce, réglées sur
  six clips des trois tenues puis vérifiées aux portes complètes.
- L'ordre de même couche se vote sur le repos neutre, sans forme ni gabarit, dans l'évaluateur comme dans Godot.
