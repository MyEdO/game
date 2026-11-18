# Écarts des maquettes de la famille combat, options et bivouac (#4411, lot 4), 2026-11-18

Référence : `propositions/kit.md` et `propositions/dispositions.md` d'abord (ils priment, `dispositions.md:233-251`),
puis les premières maquettes de l'historique : `69165bf15^` pour la plupart des pages de combat, `79e39ce84^` pour
`fin-defaite`, `jet-avant-le-de` et `jet-de-defense`, `455f733c7^` pour `combat-jet-d-attaque`, `options` et
`bivouac`. « Rendu avant » : l'état `011f5c126` à 16:9. Tous les états sont rendus à 16:9 (1280 × 720 × 1,5) : 43 états,
0 erreur, aucune pièce hors, croisée, débordée ou recouverte, aucun texte coupé.

## Écarts corrigés

| Écran / pièce | Référence | Rendu avant | Correction |
|---|---|---|---|
| Tous, borne du round | `combat.css:5-8` : « Round N » gothique 30 px, « tour X / sur Y » ou « le round / débute » 13,5 px, 214 × 66 | une ligne 24 px « Round 1 · tour 1 sur 4 » | la borne de `combat.css`, la surcharge de `rendu.css` retirée |
| Tous, journal | arbitrage 11 : « Journal » | « Chronique » | « Journal » |
| Tous, fin du tour | `PICTOS.fin` (le sablier) | la flèche du registre d'icônes du jeu | `rond('fin', 'maitre')`, picto du kit |
| Tous, ordre du tour | première maquette : l'actif en bas, la borne du round suivant, les fantômes au-dessus ; `dispositions.md` (le haut se replie) | l'actif en tête, sans borne ni États | l'ordre retourné, la borne `disque` du round suivant, les États portés |
| Tous, contenu | premières maquettes : Ilyanwe, Berta, l'Orc, le Tireur gobelin au dôme | données capturées du jeu (Aelindra, journal du Round 18…) | contenu des premières maquettes, écrit en donnée |
| Détermination | première maquette : portrait de Berta, « Dépenser » / « Annuler », Détermination de Berta | sans portrait, un libellé de groupe en trop, sans gestes | portrait, trois cartes à la largeur du centre, « Dépenser » puis « Annuler » (arbitrage 16), la réserve du porteur |
| Détermination, ordre | première maquette : Berta À Terre, Orc Hémorragique 2 | États absents | États portés ; la carte choisie presse l'État |
| Jet avant le dé | première maquette : « Lancer », « Résilience », « Annuler » | « Annuler » avant « Résilience » | ordre de la première maquette (arbitrage 16 : la principale d'abord, Annuler en dernier) |
| Contre-sort, déclaration | « Déclarer » / « Annuler » | gestes du jeu | « Déclarer » puis « Annuler » |
| Dissipation, entrée | première maquette : dissipeur, Sorts du porteur, porteur | un groupe « Soutien » en plus | groupe retiré |
| Dissipation | « Dissiper » / « Annuler » | gestes du jeu | « Dissiper » puis « Annuler » |
| Dissipation, cour | première maquette : la cible visée, le dôme | marques absentes | marques `vise` et `dome` portées par l'état (`cour.marques`), dessinées par `combat/cour.js` |
| Surincantation, cour | première maquette : la cible supplémentaire cernée | absente | marque `cerne` |
| Surincantation, centre | première maquette : sort, axes, cibles (`suite.css`) | règles `.surinc`, `.axes`, `.axe`, `.cibles-du-sort`, `.c-s` retirées | règles rendues ; colonnes resserrées pour un centre de 960 (`rendu.css`) |
| Test de corruption | première maquette : exposition, points, nature en deux cartes | règles `.expose .points`, `.nature`, `.deux` retirées | règles rendues |
| Jet d'attaque (armes) | première maquette : rangées des armes, bascules, note | règles `.fond.armes`, `.bascules` retirées | règles rendues, sans les grilles fixes de 1186 |
| Incantation Critique | première maquette : `#critique p.note`, cartes d'effet | règles retirées | règles rendues, cartes à la largeur du centre |
| Début du round, trois cartes | `dispositions.md` § 6 « Dans 1280 × 720 » : le centre rétrécit | cartes de 258 px qui débordent la fenêtre | cartes flexibles dans le centre |
| Relance à la Chance | première maquette : la raison du refus au-dessus de « Relancer » sans couvrir l'issue | issue sur deux lignes, recouverte par la raison | sous-titre et phrase du verdict resserrés (11,5 / 13 px) |
| Options | première maquette `455f733c7^` : préférences, quinze signets, Combat ouvert, feuillet 1 sur 2 | panneau des zones du noyau, domaine Tests | contenu de la première maquette ; écart du titre de feuillet et de son sous-titre |
| Bivouac | première maquette : clairière de nuit, campement à droite, « Ce que la nuit jouera » avec ses pictos | paysage du registre du jeu, sans pictos de la nuit, sans retour | décor rendu (`lieux-et-nuit/bivouac.js`, `bivouac.css`), pictos du kit, retour « Reprendre la route » à 30 / 34 du coin bas-gauche (arbitrage 24, `dispositions.md:37`), libellé au-dessus sur deux lignes |
| Rendu | « le jeu envoie des données, pas la façon de les afficher » | maquettes branchées au noyau (`figerLesPlanches`, `figerLesDessins`, `zonesDesReglages`, types de `src/`) | maquettes autonomes : données écrites au format de `maquettes/maquette.ts`, aucun import de `src/` ni de `recettes`, `pont`, `projet` |

## Choix non tranchés

1. **Ordre du tour à 134 px** : « Hémorragique 2 » ne tient pas dans la colonne de 160 px de marge
   (`dispositions.md:42`). Un rang replié montre le sceau de l'État et son compte, sans le nom ; l'actif garde le nom.
   À trancher : nom abrégé, nom au survol, ou colonne plus large.
2. **Groupe « Soutien » de la Dissipation** : retiré parce que la première maquette ne l'a pas. Si le jeu l'offre, une
   règle doit dire s'il se dessine.
3. **Plafond des malus de Difficulté** : le curseur va de 0 à −100, comme sur la première maquette (la poignée à 30 %),
   et non de −100 à 0.
4. **Contenu des états** : les premières maquettes priment sur les données capturées du jeu. Aelindra et le journal du
   Round 18 sont sortis des maquettes.
5. **Pages encore en HTML** : `options-chance` et `options-verrou` (`accueil-et-systeme/options.js`) n'ont pas été
   portées au format en donnée, faute d'être dans le lot.
