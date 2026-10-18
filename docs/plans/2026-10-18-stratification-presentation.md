# Stratification de la présentation : ce qu'un moteur de jeu tiers remplacerait (2026-10-18)

Rapport du ticket #2792, sous-ticket de l'épique #2794 (« un moteur de jeu tiers gratuit plutôt que rendu et interface maison, `src/engine` conservé ? »). Il remplace l'agrégat du ticket (220 680 lignes de présentation) par une mesure par catégorie. Il ne recommande rien : la décision appartient à l'épique.

## Mesure

- **Sha mesuré** : `3d5e6ae09e013c9a97065a8264b07b927559c62e` (branche `chantier/2792`, dont `src/` est identique à `origin/main` `5a46fc12b`).
- **Commande** : `node scripts/ops/sondes/stratification-presentation/sonde.mjs <dossier-de-données> --jours 90` (mode d'emploi : `scripts/ops/sondes/stratification-presentation/README.md`).
- **Périmètre** : les 3001 fichiers `.ts`, `.tsx`, `.css` suivis sous `src/state`, `src/ui`, `src/gameIso`, tests compris (1390), le même périmètre que l'agrégat du ticket.
- **Rangement** : 52 règles ordonnées chemin → catégorie (`regles.mjs`, la première qui correspond gagne). Aucun fichier non rangé : un fichier non rangé fait sortir la sonde en code 1.
- **Lignes** : nombre de `\n`, comme `wc -l`.
- **Churn** : `git log --no-merges -M --numstat` sur les 90 jours qui précèdent la date de commit du sha mesuré (depuis le 2026-07-20T16:37:10Z). Il compte les lignes ajoutées et supprimées, code et tests. Les 216 chemins du journal absents du sha (renommés, supprimés) sont rangés par les mêmes règles.
- **Recoupement** : la commande `wc -l` du ticket et la sonde donnent les mêmes totaux par zone. `src/state` : 79 580 lignes de code et 135 986 de tests ; `src/ui` : 81 900 et 65 502 ; `src/gameIso` : 59 200 et 56 627. Le churn recompté par `awk` sur le même `git log` donne aussi 503 321 lignes et 1 291 commits.

## Tableau par catégorie

Les quatre catégories et leur colonne « Un moteur tiers la remplace ? » sont celles du ticket, verbatim.

| Catégorie | Un moteur tiers la remplace ? | Fichiers | Lignes de code | Part du code | Lignes de tests | Commits 90 j | Lignes modifiées 90 j | Part du churn |
|---|---|---|---|---|---|---|---|---|
| Moteur de jeu générique | oui | 509 | 43 165 | 19,6 % | 58 372 | 481 | 138 158 | 27,4 % |
| Interface de règles WFRP | non (réécrite dans le moteur cible) | 565 | 50 292 | 22,8 % | 40 173 | 536 | 92 723 | 18,4 % |
| Orchestration de règles | non (reste en TypeScript à côté de `src/engine`) | 779 | 66 112 | 30,0 % | 115 880 | 733 | 164 530 | 32,7 % |
| Outillage | à trancher par l'épique | 289 | 28 754 | 13,0 % | 40 007 | 678 | 86 564 | 17,2 % |
| Douteux (à part, par famille) | — | 859 | 32 357 | 14,7 % | 3 683 | 294 | 21 346 | 4,2 % |
| **Total** | — | 3001 | 220 680 | 100 % | 258 115 | 1 291 | 503 321 | 100 % |

Un commit touche souvent plusieurs catégories : les commits par catégorie ne s'additionnent pas, le total compte les commits distincts.

Rapport entre la part du churn et la part du code : moteur générique 1,40 ; outillage 1,32 ; orchestration 1,09 ; interface WFRP 0,81 ; douteux 0,29.

### Par zone (lignes de code / lignes de tests)

| Catégorie | `src/state` | `src/ui` | `src/gameIso` |
|---|---|---|---|
| Moteur de jeu générique | 5 220 / 6 041 | 5 824 / 5 867 | 32 121 / 46 464 |
| Interface de règles WFRP | 3 075 / 1 683 | 42 755 / 33 476 | 4 462 / 5 014 |
| Orchestration de règles | 66 112 / 115 880 | — | — |
| Outillage | 5 173 / 12 382 | 22 491 / 24 049 | 1 090 / 3 576 |
| Douteux | — | 10 830 / 2 110 | 21 527 / 1 573 |

## Fichiers à rangement douteux

Ces fichiers ne sont forcés dans aucune catégorie. La sonde les liste un par un, avec la raison de leur règle, dans `douteux.md` de son dossier de données.

| Famille | Fichiers | Lignes de code | Lignes de tests | Commits 90 j | Lignes modifiées 90 j | Pourquoi aucune catégorie ne tient |
|---|---|---|---|---|---|---|
| `contenu-art` | 829 | 24 666 | 1 639 | 123 | 14 155 | Art vectoriel SVG (créatures, tenues, armes, navires, engins, décors, façades, icônes, ornements) et ses registres id → définition. Un moteur fournit le rendu d'image, pas cet art : il faudrait le refaire ou le convertir dans son format. |
| `theme-visuel` | 16 | 3 983 | 0 | 54 | 2 357 | Feuilles de thème (tokens, primitives, cadres) : un `Theme` de moteur remplace le mécanisme CSS, pas la matière visuelle. |
| `codex-en-jeu` | 9 | 3 248 | 1 823 | 132 | 4 039 | `src/ui/compendium/registry` et `relations` servent le Compendium (outillage) et le jeu (liage du Codex dans `Prose`) : deux catégories tiennent. |
| `cadre-fenetre` | 5 | 460 | 221 | 18 | 795 | `Modal`, `ScreenShell`, `ParchmentCard` : mécanisme de fenêtre générique, squelette lié à WFRP (bandeau du combattant, `engine/types`, monnaie, narratif). |

Fichiers des trois petites familles : `src/ui/Modal.tsx`, `src/ui/ParchmentCard.tsx`, `src/ui/ScreenShell.tsx`, `src/ui/ScreenShell.test.tsx`, `src/ui/modal-shell-non-jet.test.tsx` (`cadre-fenetre`) ; `src/ui/compendium/registry.ts`, `src/ui/compendium/relations.ts` et leurs sept tests (`codex-en-jeu`) ; `src/ui/styles.css` et `src/ui/styles/{band,base,boite-ancree,cadre,components,frames,gauges,infobulle,layout,media-select,modal,ornaments,planche,screen-shell,tabs}.css` (`theme-visuel`).

Répartition de `contenu-art` (fichiers, lignes) : `src/gameIso/rig/parts` 389 / 10 943 ; `rig/creatures` 119 / 3 062 ; `rig/quadruped` 52 / 3 031 ; `src/ui/icons` 31 / 2 692 ; `rig/ship` 24 / 2 165 ; `catalog/decor` 125 / 1 700 ; `rig/engin` 16 / 1 150 ; `rig/land` 10 / 494 ; `src/ui/backdrops` 6 / 380 ; `rig/swarm` 12 / 248 ; `rig/races`, `rig/gabarits`, `rig/plans`, `catalog/facades` 42 / 307 ; `WaxSeal`, `Ornaments`, `GlobalSvgDefs` 3 / 133.

## Validation

Le rangement a été établi en trois temps :

1. **Trois lectures séparées**, une par zone, pour éviter qu'un agent unique se dilue sur 220 000 lignes. Elles ont proposé des règles et listé leurs fichiers douteux.
2. **Une passe de recoupement** a vérifié que des fichiers semblables sont rangés pareil dans les trois zones. Elle a corrigé onze écarts : authoring de carte, gardes de dépôt, saisie, contenu d'art, soutien de test, etc.
3. **Deux juges indépendants** ont travaillé sur des échantillons tirés dans chaque catégorie (`--echantillon`, graine fixée) :
   - **Premier juge** : 6 fichiers par catégorie et par famille douteuse. Les quatre catégories font 24/24. Il a trouvé cinq erreurs de classe, corrigées (45 fichiers déplacés, contre-épreuve fichier par fichier : 0 désaccord) :
     - gardes de corpus hors de la liste nominative → outillage ;
     - saisie câblée WFRP → interface ;
     - vision → orchestration, pièces → moteur générique ;
     - cadres sans import WFRP → moteur générique ;
     - `CodexRef` → interface.
   - **Second juge** : 20 fichiers de code dans chacune des deux règles par défaut de dossier, les plus exposées. Le défaut de `src/state` fait 19/20, `src/ui` à plat 20/20. La seule erreur est une classe (modèles-vues d'écran logés dans `src/state` : `poste`, `advancement`, `stations`, 457 lignes), corrigée.

**Fiabilité des parts.** La valeur ponctuelle tient à ±1 point de code. La borne à 95 % (Clopper-Pearson) est plus lâche : orchestration −3,9 points au pire (calcul stratifié, les 12 plus gros fichiers étant nommés par la règle) et interface WFRP ±2,2 points.

Cohérence des tests avec ce qu'ils importent : 50 tests sur 1 390 ont une catégorie absente des fichiers qu'ils importent. 30 sont des gardes de dépôt rangées en outillage, qui importent par construction le code qu'elles surveillent. La liste est dans `ecarts-tests.json`.

## Constats pour l'épique

Ce sont des faits mesurés ci-dessus, pas une recommandation.

1. **Ce qu'un moteur tiers remplacerait** : au plus 19,6 % du code de présentation (43 165 lignes), mais 27,4 % des lignes modifiées sur 90 jours. C'est la seule catégorie dont le churn dépasse nettement le poids : 37 % des commits du trimestre la touchent. Elle vit surtout dans `src/gameIso` (32 121 lignes : rendu three.js, caméra, picking, rig et animation, géométrie de scène).
2. **Ce qu'il faudrait réécrire dans le moteur cible** : l'interface de règles WFRP, 22,8 % du code (50 292 lignes, dont 42 755 dans `src/ui`). S'y ajoutent les familles douteuses qu'un moteur ne fournit pas, au premier rang le contenu d'art : 24 666 lignes de SVG à refaire ou convertir.
3. **Ce qui reste en TypeScript à côté de `src/engine`** : l'orchestration de règles, 30,0 % du code et 32,7 % du churn, tout dans `src/state`. Le prototype de #2793 montre que cette couche est liée au store Zustand : la défense automatique (`bestDefenseMode`) et l'application d'une touche y vivent.
4. **L'outillage** (13,0 % du code, 17,2 % du churn, 52 % des commits) reste à trancher par l'épique : Compendium, éditeurs, galeries QC, gardes. Le ticket range l'authoring de carte en moteur générique et les éditeurs en outillage, sans dire où passe la frontière. Ici, le canevas de carte de l'atelier est en moteur générique et le reste de l'atelier en outillage.
5. **Le churn ne mesure pas le temps passé**, il l'approche : un commit de 2 lignes et un commit de 2 000 lignes pèsent chacun un commit, et le nombre de lignes varie selon le style de chaque lot.

## Limites

- Le rangement est fait par chemin, pas ligne à ligne. Un fichier mixte est rangé selon sa nature dominante. `src/state/mapSpec.ts` et `sceneEdit.ts` portent aussi des mutations d'entités WFRP : la part générique de l'authoring de carte est surévaluée d'une quantité non mesurée.
- Les gardes de dépôt se reconnaissent par une liste nominative : une règle de chemin ne lit pas le contenu. Au plus 24 autres tests lisent le corpus de sources sans avoir été instruits un à un.
- `src/gameIso/rig/quadruped/quad-purete-rendu.test.ts` est vu comme binaire par `git --numstat` : son churn est absent (5 lignes binaires).
- La fenêtre de 90 jours suit la date du commit mesuré : rejouée sur un autre sha, la mesure décale sa fenêtre. L'histoire superficielle est gardée : sans commit antérieur à la borne, la sonde sort en code 1.
