# Couches de vêtements qui se traversent : état du chantier à la reprise (#3842, 2026-11-11)

Ticket: #3842

Date : 2026-11-11. Branche `chantier/3842`, base `d4b44ce6a`. Ce document est une archive datée du chantier, pas une référence vivante. Les mesures détaillées sont dans les commentaires du ticket, et le chantier reprend par un autre fil.

## But et définition de fini (ticket)
- Toute tenue à plusieurs couches (Sorcier, Prêtre, Soldat, les carrières suivantes) reste ordonnée en clip et sous silhouette.
- Une seule solution, commune à toutes les couches, sans réglage pièce par pièce.
- La porte du Sorcier n'a qu'un seul écart, celui de la tête (#3761), sur les 5 passes.
- Une garde mesure un membre qui traverse un vêtement d'une autre zone.
- La procédure `creer-un-personnage-3d` est à jour.

## Ce qui est publié sur la branche
- `fcbb35b5d` : les gardes de l'évaluateur `couche-percee-au-repos`, même couche (`ordreDeMemeRang`) et `membre-dans-un-vetement`. La sortie de `evaluer.mjs --porte` n'est plus tronquée. La procédure nomme les trois écarts.
- Le commit de ce document, travail en cours compris :
  - `scripts/personnage-3d/element/champ.py`, `repeser.py` et `scripts/personnage-3d/test_champ.py` : le « champ de peau », dans sa version de l'essai 2. C'est une expérience **non retenue**, gardée pour la reprise ; aucun appelant du kit.
  - `docs/plans/2026-11-11-3842-masquage-evaluateur.md` : le diff de l'expérience de masquage des faces couvertes dans l'évaluateur, non appliqué.

## Mesures de référence (tenues publiées, évaluateur de `fcbb35b5d`)
Les valeurs se lisent par passe, dans l'ordre neutre / feminin / corpulence / carrure_moins / carrure_plus.

| | Sorcier | Soldat |
|---|---|---|
| `couche-traversee` | 3 / 45 / 225 / 1 / 225 | 547 / 632 / 543 / 715 / 967 |
| `couche-percee-au-repos` (neutre) | 41 | 60 |
| `membre-dans-un-vetement` | 128 / 131 / 153 / 93 / 306 | 1 / 1 / 1 / 1 / 5 |
| étirement | 0 | 2 |

## Ce qui a été essayé, et pourquoi ça ne ferme pas la classe
1. **Champ de peau**, versions v2 à v13. Les poids et les décalages de clé de toute pièce skinnée y sont une fonction de la position au repos, tirée de la peau du corps.
   - Au Sorcier, sur l'ancien évaluateur : 194 → 87 traversées, mais 26 lignes d'étirement.
   - Au Soldat : traversées en forte baisse, mais 576 lignes d'étirement (haut-de-chausses, gants).
   - Deux essais « peau connexe » n'ont rien gagné au Sorcier, et ont donné 202 lignes d'étirement et 130 traversées au Soldat.
   - Cause mesurée : une pièce lâche (plastron, haut-de-chausses, cape au torse) lit la peau d'une autre partie du corps que la couche réellement posée dessous.
   - Commentaires 6778174054 et 6779502815. Les comptes du Soldat qui y figurent sont tronqués (voir 6782370653).
2. **Masquage** des faces intérieures entièrement couvertes au repos, dans l'évaluateur seul.
   - Seul : 115 → 113 et 70 → 45 traversées.
   - Avec le champ : meilleur, mais il découvre des sommets en mouvement (`couche-decouverte`).
   - Rien n'est fait côté Godot.
3. **Constat :** deux couches proches qui portent les mêmes poids et les mêmes décalages ne se croisent plus (robe/cape : 111 → 0 ; plastron avec ses propres clés sur le pourpoint : −89,7 mm → 0). La bonne référence est donc la couche posée dessous.

## Méthode proposée, ni jugée en mesure ni décidée : reprise au montage depuis la couche dessous (plan v4)
- **Règle.** À la composition, dans l'ordre des rangs `COUCHES`, chaque sommet d'une pièce skinnée se lie à la couche de rang inférieur (corps compris) par projection normale, du même côté, à portée.
  - Il reprend `λ(d)·W(q) + (1 − λ(d))·W_propre`, en gardant les 4 plus forts, et le décalage cuit de forme mélangé de même.
  - `λ = 1 − smoothstep(BANDE, BANDE + LARGEUR, d)`.
  - Deux pièces de même rang s'ordonnent par `ordreDeMemeRang`.
- **Source unique.**
  - Une fonction TS pure calcule des tables par paire (pièce, pièce dessous possible : triangle, barycentres, d). L'évaluateur les calcule à la volée ; le build Godot les génère pour le catalogue.
  - Godot ne fait que choisir la plus proche visible et mélanger, après `poser_les_morphes` et avant `refondre`, avec un cache par ensemble visible et le rang servi par le pont.
- **Risques relevés par le juge.**
  - Saut de poids à l'axe médian et aux frontières entre pièces dessous : compter les sauts |ΔW| par arête.
  - zone(q) ≠ zone(v).
  - Chaîne sur chaîne (cape sur jupe).
  - Os absents du skin de la pièce (65 joints contre 99) : étendre le skin.
  - Normales à recalculer.
  - Le gabarit cuit diffère entre Godot (silhouettes seules) et l'évaluateur (`poidsDuGabarit`) : à vérifier.
- **Coût.** Une recherche du plus proche en GDScript par composition est estimée à 1 à 13 s : c'est ce qui motive les tables précalculées.

## Problèmes ouverts que la reprise des poids ne ferme pas
- **Contacts prévus par l'animation.** La main posée sur le corps (bras croisés, main à la hanche) traverse le vêtement qui couvre cet endroit : robe, cape, capuche, bandoulière, bas. C'est l'essentiel des 128 à 306 lignes `membre-dans-un-vetement` du Sorcier. Pistes : un clip qui garde la main au-dessus du vêtement (IK, décalage par épaisseur de la tenue), ou un écart admis par clip.
- **Même couche.** Au Sorcier, la ceinture est enfoncée sous la robe dès le repos (114 sommets, saturés à −30 mm). Au Soldat, le pourpoint traverse le baudrier (jusqu'à −53 mm) et le haut-de-chausses, et les gants traversent le pourpoint. C'est un défaut de géométrie au repos ou d'ordre de couche à trancher.
- **Perçage au repos.** Au Soldat, le haut-de-chausses perce le plastron (78 sommets, jusqu'à −30 mm). C'est la géométrie publiée.
- **Profondeur.** Au-delà de 3 cm (`PORTEE_DE_COUVERTURE_M`), elle n'est pas mesurée : beaucoup de valeurs sont saturées.
- **Hors périmètre, déjà relevés.**
  - `etirement.ts:166` `piresAretes` : le top-5 par clip est rempli par les mains de la base et masque les arêtes des éléments.
  - `construire.py:6` et `:69` citent `npm run caches-3d`, qui n'existe pas.

## Rejouer
- La tenue du Sorcier et celle du Soldat se composent depuis le cache `~/.cache/wfrp-modeles-3d/<sha256>.glb`, aux empreintes épinglées des manifestes de `hotes/godot/projet/modeles/`. Les GLB manquants se tirent par `npm run godot:sonde`, ou depuis la Release `modeles-3d`.
- Porte : `node hotes/godot/asset/evaluer.mjs <GLB de la tenue…> --base <humanoide.glb> --manifeste hotes/godot/projet/modeles/humanoide.manifeste.json --porte`. Elle prend environ 8 min. Jouer une porte à la fois : deux en parallèle dépassent la mémoire du conteneur.
- Re-pesée d'un GLB publié par le champ (expérience) : `node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/element/repeser.py <element.glb> --base <base.glb> --manifeste <base.manifeste.json> --sortie <dossier>`.
- **Archive du dossier de travail** (journaux des portes, outils de mesure, briefs, plans, avis Fable), sans les GLB : `/mnt/project-files/3842/3842-scratchpad.tgz`, dans le dossier partagé du projet.

## Dépendance
Le fil « Construire le prêtre en 3D » (#3867, `chantier/3867`) attendait ce chantier. Il est repris lui aussi par un autre fil.
