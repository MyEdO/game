# Carte mesurée des maquettes Godot (données, rendu, primitives, variantes)

Ticket: #4585

(#4585 : vérification du contenu entre états et restes de la revue des maquettes.) Relevé du 2026-11-21 sur `chantier/4585-contenu`, qui fonde `docs/plans/2026-11-21-maquettes-en-donnees.md`. Mesures statiques (grep, import des états) ; `S/` = `hotes/godot/cibles/propositions/sources/`.


Branche `chantier/4585-contenu`, HEAD `3d2a59adcf`. Dossier `S/` = `/home/user/game/hotes/godot/cibles/propositions/sources/`. Lecture seule.
État de l'arbre : `rendre.mjs` modifié non commité (+5/−2), `passe.mjs` non suivi (`git status`) : WIP d'une autre session, non attribué.
Mesures : scripts jetables dans le scratchpad (`dump.mjs`, `compose2.mjs`, `fonctions.mjs`, `css2.mjs`, `fen.mjs`). Les états ont été évalués réellement (import des `.ts` par node 26) : 57 écrans, 170 états.

## 0. Corpus

| Gabarit | États | Écrans | Type de 1er niveau (`maquettes/maquette.ts`) |
|---|---|---|---|
| fenetre-du-bas | 49 | 18 | `EtatDeCombat` :386 |
| combat | 10 | 2 | `TourDeCombat` :483 |
| recit | 4 | 1 | `IssueDuCombat` :505 |
| lieu-et-voyage | 58 | 21 | `Poursuite` :601, `Voyage` :669, `Bord` :716, `BatailleDeMasse` :780, `Interlude` :825, `Nuit` :997, `Soins` :1017, `Commerce` :1155, `Exploration` :1288, `CarteDuMonde` :1333 |
| fiche | 25 | 5 | `Dossier` :1223, `Creation` :1591, `FicheDuHeros` :1658, `DepenseDExperience` :1727, `ChangementDeCarriere` :1758 |
| gestion | 12 | 6 | `Options` :861, `Carnet` :1355, `FinDeSeance` :1851, `Sauvegardes` :1872, `NouvellePartie` :1896, `Coop` :1976 |
| ouverture | 4 | 3 | `Accueil` :1788, `MenuDeLaPartie` :1800, `Chapitre` :1837 |
| consultation | 4 | 1 | `Compendium` :1955 |
| edition | 4 | 2 | `EditeurDeScene` :2034, `EditeurDeLaCarte` :2057 |

Union `Etat` : `maquette.ts:14-15`. `maquette.ts` fait 2063 lignes (types seuls) ; 62 fichiers `maquettes/*.ts`, chaque écran = `export default { etats: [...] }`, avec helpers de construction (`dome.ts` : `apresLeDe`, `reserves`, `COMBATTANTS`, `TOUR_D_ILYANWE`, importés par `jet-d-attaque.ts:5`).
Les 16 états de `lieu-et-voyage` qui portent une `fenetre` (choix 16, consigne 4, issue…) passent aussi par `fenetre()` : 65 états au total traversent le même code.

## 1. Forme des données

Contrat déclaré : « valeurs typées, ids, états, et les mots en chaînes simples … ne dit jamais où ni comment se dessine » (`maquette.ts:2-7`).

**Constat mesuré : les états sont sémantiques, pas des choix d'affichage.**
- Aucune chaîne HTML dans les 170 états (balayage de toutes les feuilles chaîne : 0 `<balise>`).
- Clés de type affichage (`classe|style|x|y|left|top|width|height|teinte|taille|place|rect|html|pos`) : 12 occurrences distinctes au total, dont la plupart sémantiques : `place` = fait du jeu (`{prix, classe:'à l’extérieur'}` arrivee ; `place:{dehors:48,dedans:96}` carte-du-monde, `place:true` poste de bord / scène de bataille) ; `classe` = classe de carrière (`identite.classe:'Lettrés'`, fiche) ; `lieux[].place:[302,407]` = coordonnées de carte (editeur-carte-du-monde) ; `taille:{cases:[32,38],entites:22}` (editeur-de-scene) ; seule vraie teinte : `mesures[0].teinte:'cire'` (dossier-du-navire, `Dossier`).
- Les gabarits présentent leurs états par `role` discriminant (`Centre` :281, `HerosSansDe`.`mise` :111-120…) : l'état dit *quelle situation*, le rendu choisit la pièce.
- Valeurs séparées des mots, déjà : `tour:{rang,sur}` (`maquette.ts:45`), `mouvement:{reste,sur}` (:420), `Modificateur` (:72), `LigneDeCarte` en union typée (:181), `cumul:{dr,vise}` (:273), `portee:{metres,selon}` (:435), `degats:{bonus,total}` (:448).

**Texte composé encore dans les DONNÉES** (chaînes ≤ 60 car. mêlant nombre et mot ; heuristique regex, la prose longue exclue ; occurrences / distinctes) :

| Gabarit | Occurrences | Distinctes | Exemples (chemin) |
|---|---|---|---|
| fenetre-du-bas | 68 | 25 (34 états) | `fenetre.gestes[2].libelle` « Chance : +1 DR » (`dome.ts:72`) ; `combat.journal[0]` « Berta : +2 Points de Corruption (total 7). » ; `centre.cartes[0].detail[0]` « +10 sur les Tests individuels d’un Test d’équipage » ; « Focalisation : 0/7 DR. » ; « Encore 5 DR pour dissiper le Dôme. » ; « 7 DR cumulés » |
| lieu-et-voyage | 34 | 28 (17 états) | `scenes[0].effet` « −1/touche · −2/vaincu Puiss. ennemie » ; « 25 Enc sur la charrette » ; « Acheteur ≤ 60, puis Marchandage » ; « Test de Charme · Intermédiaire (+0) » ; « Succès de 6 DR » ; « la mise +20 % » |
| fiche | 15 | 9 | `identite.note` « Changer coûte 100 PX. » ; `heros.geste.refus` « Répartition des 100 Points : total 96/100 Points. » ; « 1d10 pistoles d'argent × Standing » ; « BF + (2 × BE) + BFM » |
| consultation | 16 | 3 | `noms[].note` « N4 · AA » (3 valeurs distinctes) |
| edition | 1 | 1 | `inspecteur.ou` « Case 12, 8 · couche 0 » |
| combat | 1 | 1 | `pose.note` « Charge : +1 Avantage. Un second clic confirme. » |
| gestion, ouverture, recit | 0 | 0 | |

Autres composés dans les données : `test: 'Corps à corps (Armes d’hast)'` (mot + précision, `jet-d-attaque.ts:20`), `titre`/`dit`/`phrase` de prose (légitimes, texte source).
Lecture : la dette de la doctrine (« tour 1 sur 26 », « ≤ 48 ») est quasi absente des données ; elle est **dans le rendu** (§2) et dans quelques libellés/notes/journaux/effets (≈ 135 occurrences, 66 distinctes).

## 2. Chaîne de rendu (`S/rendu.js`, 1824 lignes, un seul bloc `{ … }` ; 211 832 octets)

Séquence : `rendre.mjs` pose `globalThis.MAQUETTE` (`rendu.js:7`), `rendu.html` charge `gestes.js` puis `rendu.js` (`rendu.html:10-12`). `(async…)` `rendu.js:1805-1823` : `GABARITS[etat.gabarit]` → `lier(feuilles)` → `rendu.css` en dernier (:1810-1811) → `charger(scripts)` → `monter(g.poser(etat))` (:1814 ; `monter` `gestes.js:383-391`, écrit `#ui.innerHTML`) → `poserLesCadres()` (:52) → `poserLesPlaces()` (:170) → `g.tracer?.(etat)` (SVG du décor) → polices → réduction du nom du cartouche (:1821).
- `CADRES` `rendu.js:19-48` : 63 rôles → rect `[x,y,l,h]` de la vue 1280×720 ; `placeDe` (:50) ancre au bord ; `CADRE_ATTENDU` (:58) sert le relevé `bouge`. Un rôle = `data-piece="<rôle>"` (56 `data-piece` dans `rendu.js`).
- `PLACES` `rendu.js:96-161` : ~74 clés littérales + générées (`PLACES_DU_REGLAGE` :86, `PLACES_DE_L_ISSUE` :95, `PLACES_DU_CAMP` :77 miroir gauche/droite :100, plaques ×6 :109, socle ×(4+4+3+5) :112-115…) ; clé `<cadre>/<place>`, rect dans le fond du cadre ; `poserLesPlaces` lève si « hors table » (:172). Fabrique : `places(cadre, contenus)` `gestes.js:320` (filtre les vides, émet `div.place[data-place]`). `PLACE_ATTENDU` (:164) sert le relevé `place`.
- `PANNEAUX` `rendu.js:893`, `CENTRES` :309-396 (13 rôles de centre), `HEROS` :237, `AUTRES` :239, `FAMILLES` :443, `POSES` :501, `HOTES_DU_COMMERCE` :1208, `BLOCS` :1230, `BLOCS_DU_DOSSIER` :1295, `ETAPES_DE_CREATION` :1507-1610 : tables rôle → fonction de rendu (dispatch par `role`/présence de champ, p. ex. `'etapes' in e` :1721, `'possession' in etat` :1738, `'domaines' in etat` :1785).
- `GABARITS` `rendu.js:1729-1800` : feuilles CSS + scripts + `poser` (+ `tracer`) par gabarit.

Fonctions de rendu, par gabarit (méthode : chaque `const f =` de 2 espaces d'indentation ; « dessine » = contient ≥ 1 balise brute ou ≥ 1 appel de pièce ; « HTML sur place » = ≥ 2 balises brutes dans son corps ; balises = ouvertures `<div|span|p|table|…` comptées dans les gabarits de gabarit chaîne, pas des nœuds DOM ; appels = appels de primitives `picto, plaque, rond, cadre, places, …`). Les bornes de section peuvent mordre sur des écrans voisins, donc découpé à la fonction près :

| Gabarit | Entrée (`rendu.js`) | Fonctions qui dessinent | dont HTML sur place | Balises brutes | Appels de pièce |
|---|---|---|---|---|---|
| fenetre-du-bas | :1731 → `combat` :423 + `fenetre` :406 | 19 (:186-413) | 10 | 120 | 60 |
| combat | `tourDeCombat` :524 (+ `combat` :423, `barre` :459, `POSES` :501) | 16 (:414-532) | 13 | 120 | 40 |
| recit | :1735 → `issue()` (kit) + `butin` :535 | 1 | 1 | 12 | 6 |
| fiche (héros) | `HEROS_EN_FICHE` :1721 → `creation` :1611, `ficheDuHeros` :1653, `depense` :1686, `changement` :1700 | 38 (:1463-1722) | 31 | 270 | 131 |
| fiche (dossier) | `dossier` :1311 | 4 (:1288-1325) | 4 | 43 | 22 |
| lieu-et-voyage | `DECORS[etat.decor]` :1748-1769 → `voyage` :973, `leBord` :1014, `poursuite` :924, `bataille` :1062, `interlude` :1082, `nuit` :1172, `soins` :1185, `commerce` :1264, `exploration` :1395, `carteDuMonde` :1436 | ≈ 80 (:863-1446 hors compendium/carnet) | ≈ 59 | ≈ 370 | ≈ 190 |
| gestion | `ecranDesOptions` :553, `sauvegardes` :588, `coop` :780, `carnet` :1450, `nouvellePartie` :697, `finDeSeance` :612 | 5+8+5+3+7 = 28 | 26 | 152 | 87 |
| ouverture | `accueil` :633, `menuDeLaPartie` :640, `chapitre` :661 | 12 (:619-672) | 10 | 41 | 10 |
| consultation | `compendium` :768 | 17 (:704-770) | 14 | 75 | 25 |
| edition | `editeurDeScene` :835 / `editeurDeLaCarte` :844 | 14 (:793-862) | 9 | 60 | 38 |

Totaux `rendu.js` : 228 fonctions dessinent, 168 avec ≥ 2 balises sur place, ~1232 balises brutes écrites sur place contre ~601 appels de pièces. Pour comparaison, les pièces elles-mêmes ne contiennent qu'environ 150 balises sources : `gestes.js:166-418` ≈ 100, `combat/jet.js` 36, `combat/socle.js` 14.
Partagées par ≥ 2 écrans de `rendu.js` (lecture de code, les homonymes écartés) : `fenetre` (7 appelants : :930, :980, :1069, :1272, :1407, :1440, :1731), `bandeauDu` :875 (≈ 9 écrans), `titreDuLieu` :1112, `railDu` :1119, `partsDu` :1121, `regle` :193 (fenêtre, options, voyage, nuit), `carteDe` :259, `jetonDe` :400, `frise` :905, `ligneDu` :888, `recitDu` :887, `chanceDu` :920, `apercuDuTest` :922, `prix` :1104, `combat` :423, `barre` :459. Fonction spécifique d'un seul écran : le reste (≈ 150 sur 228).

**Part du HTML qui sort des primitives, fenêtre du bas.** Par fonction (balises brutes / appels de pièce) : `CENTRES` 61/23 (:309-396), `AUTRES` 14/10 (:239-248), `subit` 9/2 (:228), `tableDu` 9/4 (:291), `expose` 8/2 (:235), `enjeuDu` 6/0 (:273), `sansDe` 4/1 (:222), `cartesDu` 3/2 (:269), `regle` 2/0, `carteDuCentre` 2/1, `carteDe` 1/2, `consequenceDe` 1/1 ; `testeur` 0/2, `fenetre` 0/3, `gestesDe` 0/3, `jetonDe` 0/1 sont de la pure assemblée. Les camps sont des pièces du jet (`camp`/`fiche`, `combat/jet.js:10,18`), le cadre est `bandeauDuJet` (:43) → `cadre` (kit), le centre `verdict`/`reglage` (:29, :56) rendent des places ; mais le contenu de ces places est du HTML brut de `rendu.js`. Estimation : environ 2/3 des balises sources du chemin (≈ 120 contre ≈ 36 de `jet.js` + ≈ 100 de kit réutilisé) sont brutes ; ce n'est pas un compte de nœuds DOM (Playwright absent, pas de mesure de provenance).

## 3. Primitives existantes

Fabrique unique : `Object.assign(globalThis, {...})` `gestes.js:419-423` ; `combat/jet.js:88` (`camp, fiche, verdict, reglage, consequences, bandeauDuJet, testeurs, options, bascule, reserves, silhouette`) ; `lieux-et-nuit/commun.js:82` (`bandeau, hote, rail, poste, radial, rims, sapin, perso, flammes, toile, fermer`) ; `combat/socle.js:23` (`P, losange, combattant, borne, borneJ, vieux, neuf, SYSTEME, mesure`) ; `outils/outils.js:24` (`ligneDeListe, tableDuSalon`) ; `accueil-et-systeme/systeme.js:59` (`fondDeTable, assombrirLeJeu, CLOUS, …décors`). Local à un fichier : `page` `commerce/commerce.js:7`.
Appels = occurrences `nom(` dans `rendu.js` (R) + autres `.js` des familles et `gestes.js` (A) ; classe racine → CSS.

Kit (`gestes.js` / `gestes.css`) :
- `plaque` R84 A4 — `.plaque` (+`.carte`, `.courte`) — base `gestes.css`, surcharges dans `jet.css`, `suite.css`, `heros.css`, `rendu.css`…
- `picto` R45 A9 (`svg`, pas de classe racine) ; `cadre` R40 A4 `.cadre.bois>.fond` ; `filet` R35 A1 `.filet` ; `sceau` R31 A3 `.sceau` ; `rond` R27 A12 `.bouton-rond` ; `portrait` R23 A6 `.portrait` ; `defile` R18 A4 `.defile[data-defile]` ; `medaillon` R15 A5 `.medaillon` ; `jauge` R15 A3 `.jauge` ; `raison` R15 A4 `.bulle-refus` ; `coins` R15 ; `croix` R14 `.croix` ; `cartouche` R14 A1 `.cartouche` ; `places` R22 A5 `.place` ; `colonne` R16 A2 `.colonne` ; `segments` R10 A1 `.segments` ; `ruban` R9 A7 `.ruban` ; `onglets` R8 `.onglets` ; `champ` R8 `.champ` ; `moinsPlus` R8 A3 `.moins-plus` ; `apercu` R8 `.apercu` ; `retour` R7 `.retour` ; `carte` R6 `.plaque.carte` ; `tableDApercu` R5 ; `rangDePas` R5 `.pas` ; `ouvrir` R5 `.ouvrir` ; `outil` R4 `.outil` ; `disque` R4 A3 `.disque` ; `bourse` R3 A2 `.qui-paie` ; `issue` R2 `.issue-du-combat` ; `ouiNon` R2 ; `rang` R2 A1 `.rang` ; `compteur` R1 ; `signets` R1 ; `reglette` R1 A1 ; `rangeeDeBourses` R1 `.bourses` ; `monter` R1 ; `vie` R0 A2 ; `clouer` R1 A2.
- Leur CSS de base est dans `gestes.css` (`^\.<racine>` : 31 de 33 racines vérifiées).

Familles :
- Jet (`combat/jet.js`, CSS `combat/jet.css` + `rendu.css`) : `reglage` R7, `reserves` R6, `bandeauDuJet` R3, `options` R3, `fiche` R3 A1, `silhouette` R2, `camp`/`verdict`/`consequences`/`testeurs`/`bascule` R1 chacun. Chargé par 7 configurations de gabarit (`rendu.js:1727-1747`).
- Socle combat (`combat/socle.js`, CSS `combat/combat.css`) : `mesure` R4, `combattant` R1, `SYSTEME`, `borne*`. `silhouette` : sa CSS est dans `combat/combat.css`, pas `jet.css`.
- Lieux (`lieux-et-nuit/commun.js`, CSS `commun.css`) : `hote` R6, `poste` R3, `bandeau` R2, `rail` R2 (`.rail` aussi dans `heros.css`, `outils.css`).
- Outils : `ligneDeListe` R4 (CSS `outils.css`) ; systeme : `fondDeTable` R6 (CSS `systeme.css`).
Bases de classe de pièce **re-déclarées hors `gestes.css`** (grep `^\.racine`) : `.plaque` (suite.css, jet.css, heros.css), `.apercu` (rendu.css, combat.css, recit.css, commun.css, voyage.css), `.pas` (suite.css, combat.css), `.filet` (voyage.css), `.onglets` (commun.css), `.rang` (combat.css).

## 4. Feuilles de style

Méthode (`css2.mjs`, regex sans parseur) : pour chaque règle, son sélecteur le plus à droite porte une racine du kit (« styler la primitive elle-même ») ou une racine apparaît ailleurs dans le sélecteur (« styler son contexte ») ; 33 racines : `bouton-rond plaque portrait medaillon disque sceau ruban cadre apercu issue-du-combat filet segments reglette jauge pas croix retour ouvrir moins-plus bulle-refus qui-paie bourses champ defile signets onglets colonne compteur outil cartouche rang carte cartes`. Règles = blocs `{…}`.

| Feuille | Règles | Stylent la primitive | Stylent son intérieur/contexte |
|---|---|---|---|
| gestes.css | 286 | 113 | 113 |
| heros/heros.css | 343 | 36 | 18 |
| rendu.css | 217 | 29 | 20 |
| outils/outils.css | 207 | 26 | 22 |
| combat/combat.css | 161 | 19 | 21 |
| lieux-et-nuit/commun.css | 73 | 11 | 5 |
| voyage/voyage.css | 52 | 10 | 12 |
| exploration-et-recit/recit.css | 84 | 8 | 6 |
| combat/jet.css | 72 | 6 | 5 |
| commerce/commerce.css | 92 | 6 | 8 |
| voyage/navale.css | 36 | 6 | 1 |
| accueil-et-systeme/nouvelle-partie.css | 36 | 4 | 6 |
| lieux-et-nuit/nuit.css | 36 | 3 | 7 |
| lieux-et-nuit/soins.css | 14 | 3 | 2 |
| accueil-et-systeme/ouverture.css | 29 | 3 | 2 |
| combat-suite/suite.css | 36 | 2 | 5 |
| accueil-et-systeme/options.css | 45 | 2 | 2 |
| accueil-et-systeme/sauvegardes.css | 15 | 2 | 1 |
| lieux-et-nuit/interlude.css | 34 | 2 | 1 |
| accueil-et-systeme/seance.css | 51 | 1 | 0 |
| systeme.css, carte.css | 9, 29 | 0 | 0 |

Hors `gestes.css` : **179 règles** stylent une primitive elle-même, ≈ 156 de plus son contexte : ≈ 335 règles de famille qui redéfinissent ou habillent une pièce du kit (gestes.css en porte 226 sur 286). Sélecteurs par id : `rendu.css` 179/217 règles commencent par `#`, `outils.css` ~100/207, `combat.css` 70/161, `jet.css` 32/72, `gestes.css` 18/286.
Exemples vérifiés :
- `rendu.css:8` `#verdict .dr{line-height:normal;margin:0}` écrase `combat/jet.css:39` `#verdict .dr{…line-height:36px;…margin-top:2px}` ; autres `.dr` redéfinis : `combat.css:103,110,115`, `rendu.css:24,35,40,42,133,171`.
- `.apercu` en double : base `gestes.css:139-149`, puis `combat/combat.css:59-68` (`table`, `td`, `td:last-child`, `.pied`), `lieux-et-nuit/commun.css:44-47` (`table`, `td`, `td:last-child` à 14 px au lieu de 14,5 px, `.pied`), `rendu.css:126-129` (`td:first-child`, `table{border-collapse…width:100%}` encore, `tr.somme`, `td:last-child`).
- `.pas` : base `gestes.css:171-173` ; `combat/combat.css:31` `.pas.petit{margin-left:4px}` et `combat-suite/suite.css:8-9` `.pas.petit{width/gap/margin:0}` se contredisent ; `suite.css:5-7` réécrit les gradients de `.pas i`.
- `.plaque` : `jet.css:59-60,71-75,82` (`#suites .place>.plaque{width:100%}`, `.plaque.carte.courte…`), `rendu.css:32,71-72,85-86,159-160,174`, `suite.css:4`, `heros.css` (26 règles).

## 5. Fenêtre du bas, en détail (pilote)

Chemin d'une donnée : `Etat.fenetre` (`Fenetre`, `maquette.ts:376`) → `fenetre()` `rendu.js:406-412` :
1. `CENTRES[f.centre.role](f.centre, f)` (:407) rend soit une chaîne (rôles `consigne`, `critique`, `dialogue`, `surincantation` → place `centre`/`droite`) soit une table de places (`verdict()` pour `issue`, `reglage()` pour `attaque|defense|etendu|nature|marchandage|equipage|simple`, `{large}` pour `table`, `tests`, liste paginée du `choix`) ; erreur levée si `f.autre` et le centre prend la droite (:409).
2. `HEROS[f.heros.role]` (:237 : `testeur`→`camp` jet.js:10, `heros`→`sansDe` :222, `subit` :228, `expose` :235) en `fenetre/gauche`; `AUTRES[f.autre.role]` (:239 : `testeur`, `vise`, `touche`, `rangees`, `interlocuteur`) en `fenetre/droite`; `testeurs()` (jet.js:50) si `heros.parmi`.
3. `places('fenetre', …)` (`gestes.js:320`) → `bandeauDuJet(titre, '', contenu, ...gestesDe(f))` (jet.js:43 → `cadre` kit, `piece:'fenetre'`).
4. `gestesDe` (:402) : plaques `plaque()` (la 1ʳᵉ armée = `principal`, fermée si `refus`, bulle `raison()` si `survol`) + `reserves()` (jet.js:75) avec `jetonDe` (:400).
5. `combat(e.combat)` (:423) sous la fenêtre si `combat !== null` (3 états sans combat : test-de-corruption ×4 en `cour seul`).
6. Après `monter`, `poserLesPlaces()` pose chaque place au rect `PLACES`.

Données par état (49 ; `fen.mjs`). Colonnes : héros / autre / centre / gestes / réserves.
- combat-naval/{combat-naval, -bordee} : testeur / rangees / equipage / 2 / 3 ; -chanson : testeur / – / simple (cartes) / 2 / 3.
- contre-sort/declaration : – / – / choix (3 cartes) / 2 / 0 ; contre-sort : testeur / testeur / issue (1 csq) / 5 / 3.
- corruption-mutation : heros(menace/corruption) / – / choix 2 groupes / 1 / 1. coup-critique : heros / touche / critique / 1 / 0.
- debut-du-round (+tir-rapide) : – / – / choix (1 ou 1+2 cartes, annonce round) / 1 / 1.
- defense/{avant-le-de, riposte, sociale} : testeur / testeur / defense / 2 / 3 ; defense/jet-de-defense : testeur / testeur / issue / 5 / 3.
- desengagement : heros / – / choix 3 / 2 / 0 ; determination (+etat) : heros / – / choix 3 / 2 / 1 ; sauvetage-par-le-destin : heros / – / choix 3 / 1 / 1.
- dissipation/{entree : heros/vise/choix 2+autre ; avant-le-de : testeur/vise/etendu ; dissipation : testeur/vise/issue cumul}.
- focalisation/{avant-le-de : testeur/–/etendu ; focalisation, -atteinte, -critique : testeur/–/issue + enjeu + cumul}.
- fuite (+seuil-survole) : testeur / testeur / issue / 5 / 3.
- incantation : testeur / vise / issue ; surincantation : testeur / – / surincantation ; -critique : testeur / – / choix 3 ; -imparfaite (+tirage) : subit / – / table / 1 / 0.
- jet-avant-le-de/{jet-avant-le-de, -armes, -empoigner, -harpon (vise), localisation-du-critique} : testeur / testeur|vise / attaque / 3|5 / 3.
- jet-d-attaque/{combat-jet-d-attaque, relance-a-la-chance, relance-chance-survolee} : testeur / testeur / issue ; {seconde-frappe, frappe-mortelle} : testeur / – / consigne / 1 / 0.
- maladresse (+tirage) : subit / – / table / 1 / 0.
- test-de-corruption : expose / – / nature + enjeu / 2 / 3 ; -tombe, -resistance : testeur / – / issue + enjeu / 6 / 3 ; -resilience : / 5 / 3.
- tour-de-combat/cible-montee : heros / – / choix 2 / 2 / 0 ; visee-de-siege : heros / – / consigne / 1 / 0.
Répartition : héros testeur 32 · heros 9 · subit 4 · expose 1 · aucun 3 ; autre aucun 27 · testeur 14 · vise 5 · rangees 2 · touche 1 ; centre issue 15 · choix 11 · attaque 5 · table 4 · defense 3 · consigne 3 · etendu 2 · equipage 2 · simple 1 · critique 1 · surincantation 1 · nature 1.

**Éléments visibles qui ne sortent pas d'une primitive (HTML brut, `rendu.js`)** :
- `regle` :193 (`div.regle>span.l`) ; `modif` :184 (`span.modif`) ; `libelleDuModificateur` :191 (texte composé).
- `sansDe` :224 (`div.camp>div.n/.c`) + `MISES` :209-219 (« X ≤ 48 », « Points de Corruption 3 / 6 », « Engagée · Avantage 2 · … ») ; `subit` :231-232 (`div.camp.touche.lanceur`, `div.des`, `div.issue`) ; `expose` :235-236 (`div.points>div.l`).
- `AUTRES.vise` :243 (`div.pv`) ; `.touche` :245 (`div.des`, `div.issue`) ; `.rangees` :246 (`div.rangees`, `div.rangee`, `span.seuil` « ≤ N »).
- `carteDe` :264-265 (`<br>`, `span.sep`, texte composé) ; `cartesDu` :271 (`span.pas-a-pas.page-de-liste` « 1-3 sur 6 ») ; `carteDuCentre` :303-304 (**chirurgie de chaîne** : `.replace('<div class="plaque', …title=…)`) ; `enjeuDu` :273 (`div.enjeu`, `table`).
- `tableDu` :292-294 (`div#critique`, `div.tete-c`, `div.tirage`) ; `CENTRES.critique` :348 ; `.consigne` :347 (`p.consigne`) ; `.choix` annonce :337-339 (`div.annonce`) ; `.attaque` :327-328 (`div.regle.localisation`, `div.bascules`) ; `.surincantation` :351-358 (`#verdict.surinc`, `.axe`, `.axes`, `.cibles-du-sort`) ; `.etendu` :363 (`div.dr-du-jet`) ; `.tests` :376-378 (`#verdict.tests`, `.lanceurs`, `table`) ; `.dialogue` :394 (`div.reponses`, `span.dit`, `span.annonce`).
- Textes composés par le rendu : `issue.sous/dr` :314-316 (« Cible : … », « DR net +3 · … », « 4 DR sur 7 »), `valeur` de conséquence :286 (`signe`+unité ` %`/` j`), `sorteDe`/`difficulteDe` :296-297, `lotMarchande` :307, `ligneDeCarte` :251-258 (« ≤ N contre ≤ M », « X à N m · portée N m »).
- Dans la pièce `camp` (`combat/jet.js:10-17`) : `span.seuil` « ≤ N », `div.issue` « Réussite/Échec/Critique DR n » (composition de mots dans une primitive).
- `combat()` :424-427 (`div#round` « Round n », « tour r<br>sur s », `div#journal`, `div#fin`) ; `etatPorte` :417 ; `rangDe` :418.
Primitives utilisées dans la fenêtre : `bandeauDuJet`, `cadre`, `places`, `plaque`, `reserves`, `camp`, `fiche`, `verdict`, `reglage`, `consequences`, `testeurs`, `options`, `bascule`, `silhouette`, `portrait`, `jauge`, `sceau`, `d10`, `rangDePas`, `moinsPlus`, `raison`, `defile`, `carte`.

## 6. Outillage

- `S/rendre.mjs` (326 lignes) : `node rendre.mjs <écran> <png> --format 16:9|21:9|16:10|bureau [--etat <état>]` ou `<page.html> <png> [échelle]`. `import { chromium } from 'playwright'`. Relevé par page (`return` :269) : `pieces, hors, croix, croise, deborde, coupe, bouge, place, habillage, recouvert, rogne, chevauche, cache, masque, retrecit, contenu` + `defile` page. `process.exitCode = 1` si erreur de page, `vu.erreur`, `vu.defile` ou tout tableau non vide (`:321`). `RELEVE_CONTENUS=<dossier>` écrit `<écran>--<état>.json` (`ecran, etat, gabarit, contenus`). Capture : `page.screenshot` clip 0,0 largeur×hauteur du format, facteur 1,5 (16:9) ou 1 (`bureau`).
- `S/contenus.mjs` (72 lignes) : `node contenus.mjs <dossier>` agrège par gabarit ; classes A (boîte déplacée, bloquante, code 1), B (longueur de texte), C (contenu de liste) ; exporte `classe` utilisé par `rendre.mjs`.
- `S/passe.mjs` (42 lignes, **non suivi par git**, `npm run godot:maquettes`, `package.json:43`) : rend chaque écran en 16:9 sous un `RELEVE_CONTENUS` neuf, `dist/maquettes-passe/{png,log,contenus,contenus.txt}`, sort en 1 si un écran est rouge ou si l'agrégat l'est. Garde : `scripts/guards/lib/couches.mjs:60` déclare `rendre.mjs`.
- Comparaison pixel avant/après dans le dépôt : **aucun outil pour les maquettes**. Existe `hotes/godot/etalons.mjs:35-49` (comparaison pixel à pixel PNG via `scripts/qc/lib/pngDecode.mjs`, étalons `hotes/godot/etalons/*.png`) mais pour les planches de l'export Godot ; `planches.mjs` (`MAQUETTES`, `coteACote`) pour le côte-à-côte Godot/maquette validée. Pour les maquettes de `S/` : seul `lotI/diff.sh` du scratchpad (ImageMagick `compare -metric AE -fuzz 3%` sur un rectangle ×1,5, plus 4 bandes de bois de 13,5 px) ; ImageMagick est installé (`/usr/bin/compare`, `/usr/bin/convert`). Le dossier `lotI` contient ~150 PNG `<écran>-<état>.png` (avant/après de l'ancien lot).
- Playwright : **absent de `package.json`** (grep négatif) ; seule mention `package-lock.json:7682-7702` (`@vitest/browser-playwright`) ; épinglé par `hotes/godot/planches.mjs:33` `EPINGLE = {playwright:'1.63.0', chrome:'153.0.8010.12'}`, installé à la volée par `.github/workflows/canari.yml:158` (`npx -y playwright@…`) ; `scripts/recette/lib.mjs:139` cherche un Chromium installé. Dans cette session : `import('playwright')` → `ERR_MODULE_NOT_FOUND` depuis `S/` ; `node_modules/playwright` absent ; `/opt/pw-browsers/chromium*` et `/usr/bin/google-chrome` présents. **Je n'ai donc pas pu exécuter `rendre.mjs` ni `passe.mjs`** : aucune mesure DOM/pixel faite, toutes les mesures sont statiques.

## 7. Risques d'une migration à pixel constant

1. **Cascade par ordre de feuilles** : `lier(g.feuilles)` puis `rendu.css` en dernier (`rendu.js:1810-1811`) ; les listes de feuilles varient par gabarit/décor (`:1727-1800`). `rendu.css:8` écrase `jet.css:39` ; déplacer une règle change le gagnant. ~335 règles de famille touchent une pièce (§4), dont des doublons contradictoires (`.pas.petit` combat.css:31 vs suite.css:8-9 ; `.apercu td:last-child` 14 / 14,5 px).
2. **Sélecteurs par id** : 58 ids distincts écrits par `rendu.js` (79 tous `.js`), 179/217 règles de `rendu.css`, ~100 de `outils.css`, 70 de `combat.css`, 32 de `jet.css` commencent par `#` (`#verdict`, `#jet`, `#critique`, `#suites`…). `#verdict` est posé par les primitives `verdict`/`reglage` (`jet.js:30,57`) ET par `rendu.js` (`:353,376`).
3. **Dépendances de structure HTML** : `#jet .place>.carte .c`, `#suites .place>.plaque>div` (jet.css:59-60), `.plaque.carte.courte .qui` (jet.css:73) ; la chirurgie de chaîne `rendu.js:304` (`.replace('<div class="plaque'…)`) et `voyage/voyage.js:130-132` (`.replace(D.cheval…)`) ; JS d'exécution sur classes : `ranger`/`degager`/`suites`/`paginer` (`gestes.js:234-381`, ciblent `.cartes`, `.cadre>.ruban`, `.defile`), `rendu.js:1488-1492,1714-1718` (`.etape`, `.station`, `.rail.fait`), `rendu.js:1821` (`#titre .n`), `combat/cour.js:302-303`.
4. **Relevés couplés au DOM** : `data-texte` (105 dans `rendu.js`, 122 tous `.js`) nourrit le relevé `coupe` (`rendre.mjs:98`) et la clé du relevé `contenu` (porteur + rôle + 1ʳᵉ classe + `data-texte` + `data-cle`, `rendre.mjs:~243`) ; `data-cle` : 1 seule occurrence dans les sources. Le relevé `contenu` bloquant (classe A) compare états du même gabarit : renommer une classe ou un `data-texte` change les clés. `CONTROLE` (`rendre.mjs`, `.plaque, .bouton-rond, .champ, .portrait, .jauge, .sceau, .disque, .medaillon, .pill, .facettes b`) liste des classes de pièces. `bouge`/`place` lisent `CADRES`/`PLACES` : 63 rôles, ~74 places fixés en pixels, `data-piece` (56) et `data-place` : toute nouvelle structure doit garder ces cibles.
5. **Planche du kit** : `kit/planche.js` (88 lignes) appelle directement `segments, ouiNon, reglette, rangDePas, vie, jauge, filet, rond, moinsPlus, outil, medaillon, croix, ouvrir, retour, coins, plaque, raison, onglets, carte, portrait, rang, cartouche, picto, disque, compteur, sceau, cadre, clouer, ruban, signets, issue, apercu, bourse, champ` avec leurs signatures actuelles, étiquetées par texte (`planche.js:5-6`) ; 5 pages `kit/planche-*.html` (`data-etat`). Toute évolution de signature doit y être reportée ; la planche n'est pas dans `passe.mjs`.
6. **Page de jugement** : aucune page de ce nom dans `S/` ni dans les scripts lus. Ce qui lit les noms d'états : `rendre.mjs` (`--etat`, sorties `<écran>-<état>.png`, `rendre.mjs:272-280`), `contenus.mjs` (`ecran/etat`), `passe.mjs`. Les noms d'états (`nom: 'combat-jet-d-attaque'`…) sont donc une clé externe stable ; non vérifié : tout consommateur hors dépôt (`/mnt/project-files/…` cité `kit.md:5`).
7. **Pixel constant, difficultés propres** : textures `feTurbulence` à graine (`gestes.js:12-13`), `diff.sh` tolère `-fuzz 3%` (bruit anti-aliasing) ; facteur 1,5 (`rendre.mjs:46`) ; polices locales `polices/` (Fell, Grenze, Spectral) ; `poserLesPlaces`/`poserLesCadres` mesurent `getBoundingClientRect` après montage (`rendu.js:173`), `:1821` réduit la police du cartouche par essais ; la composition de mots (`nowrap`, `-webkit-line-clamp:4` `rendu.css:5`) fait dépendre la hauteur du texte exact ; `signe()` (moins typographique `−`) et `&nbsp;` dans `ligneDeCarte` (:252-253) pèsent sur les coupures. Les 16 états `lieu-et-voyage` qui réutilisent `fenetre()` partagent ces CSS : une migration du pilote touche 65 états.
8. **Poison de commentaire** : grep d'excuses (« pour l'instant », « en attendant », « provisoire », « TODO », « déplacé vers ») sur `rendu.js/css`, `gestes.js/css`, `combat/*`, `maquette.ts` : aucune occurrence. `rendu.js:274,277,384,397` renvoient à `../combat.md`/`../voyage.md` « À valider » (renvois, non évalués comme poison).

## 8. Taille de migration par gabarit (estimation, raison mesurée)

- **recit** : petite. 4 états, 1 fonction (`butin` :535, 12 balises/6 appels) + `issue()` du kit ; quasi tout déjà pièce.
- **consultation** : petite à moyenne. 4 états, 17 fonctions, 75 balises/25 appels (`rendu.js:704-770`) ; données sans HTML ; CSS `outils/outils.css` (207 règles, 26 sur pièces).
- **ouverture** : petite à moyenne. 4 états, 12 fonctions (41 balises/10 appels), 3 décors SVG ; `ouverture.css` 29 règles, `seance.css` 51.
- **edition** : moyenne. 4 états, 14 fonctions (60/38), `outils.css` partagé avec consultation/coop.
- **gestion** : moyenne. 12 états, 6 écrans, ≈ 28 fonctions, 152 balises/87 appels, 6 feuilles distinctes (`options`, `sauvegardes`, `seance`, `nouvelle-partie`, `outils`, `recit`).
- **combat** : moyenne. 10 états, 16 fonctions (120 balises/40 appels dans `combat`/`barre`/`POSES`), `combat.css` 161 règles (19 sur pièces + 21 contexte) ; partage `combat()` avec la fenêtre.
- **fenetre-du-bas** : grosse mais la plus bornée. 49 états (+16 de `lieu-et-voyage` = 65), 13 rôles de centre, 5 rôles `autre`, 5 rôles `heros`, 19 fonctions (120 balises/60 appels) + jet.js (11 pièces) ; données déjà typées ; ~70 composés en données (25 distincts) + ≈ 11 `≤`, 16 `sur ${`, 7 `Round ${` en code ; CSS `jet.css` (72) + `rendu.css` (29 sur pièces) + `combat.css` ; relevés complets (`contenus`).
- **fiche** : grosse. 25 états, 5 écrans, 42 fonctions (313 balises/153 appels), `ETAPES_DE_CREATION` :1507-1610 (9 étapes), `heros.css` 343 règles (36 sur pièces + 18 contexte, 26 `plaque`, 10 `bulle-refus`).
- **lieu-et-voyage** : la plus grosse. 58 états, 21 écrans, ≈ 80 fonctions (≈ 370 balises/≈ 190 appels), 10 types de premier niveau, 5 feuilles de famille (`voyage`, `navale`, `commerce`, `nuit`, `recit`, `carte`…), décors dessinés en SVG par écran (`DECORS` :1748-1769) ; `lieux-et-nuit/commun.css` (11 sur pièces) + `voyage.css` (10 + 12 contexte).

## Non couvert
- Exécution de `rendre.mjs`/`passe.mjs`, comptage de nœuds DOM, provenance primitive/brute au DOM, pixels : Playwright absent ici.
- Corps de `gestes.css` ligne à ligne ; `kit.md`, `dispositions.md`, `combat.md`, `heros.md` etc. non lus en détail (seuls `kit.md:1-40` et `images.md:255-270`).
- `docs/primitives.md`, `docs/vocabulaire-mecanique.md`, `docs/index-moteur.md` : non consultés (hors périmètre de la carte `S/`, aucune conclusion d'absence moteur n'est formulée).
- `src/hote/elements.ts` (cible du contrat noyau→hôte citée par la doctrine) : non lu.
- Détail de `voyage/*.js`, `commerce.js`, `lieux-et-nuit/*.js`, `outils/editeur.js`, `exploration-et-recit/*.js`, `heros/heros.js`, `combat/cour.js` (lus par `grep` seulement).
- Heuristiques : « composé » = regex ; « fonction qui dessine » = indentation 2 espaces ; CSS sans parseur (`@media`/`@keyframes` écartés de façon grossière) ; l'appartenance fonction → gabarit approchée par plage de lignes (`ouverture` et `gestion`, `consultation`, `lieu-et-voyage` découpés à la fonction près, sans recoupement exact).

## 9. (Question 8) Variantes de rendu qui coexistent, par nature d'élément

Méthode : grep des gabarits de `rendu.js`/`*.js` (classes émises) + extraction des déclarations CSS par sélecteur (`var.mjs`, regex sans parseur) ; « kit » = lignes de `propositions/kit.md` (grep `titre|rubrique|puce|chip|pill|jeton|modif|tag|consigne|note` : seuls ruban :109, cartouche :110, signets :111, aperçu :112, filets :114, losange :115, segments :116, bulle de refus :121, jauge :126, pas :128 existent ; aucune ligne pour rubrique, sous-titre, puce, étiquette, ligne libellé+valeur, note). Classement du plus au moins dispersé (nombre de rendus coexistants, puis de tailles/couleurs).

### 1. Lignes « libellé + valeur » — aucune primitive ; ≥ 12 constructions
Variantes (gabarit `rendu.js`, écran) : `regle` :193 `div.regle>span.l.rubrique` (fenêtre du bas, options, voyage, nuit) ; `ligneDu` :888 `div.ligne>span.rubrique+span` (voyage, navire) ; `ligneDePorteur` :1200 `div.porteur-ligne>span+b.chiffres` (commerce, 12 px `commerce.css`) ; `proprieteDe` :816 `div.prop` (inspecteur, éditeur ; 14,5/13,5 px `outils.css`) ; `pref` :547 `div.pref>div.l>b` (options ; aide 13 px) ; `faitDu` :1474 `div.fait` rub+`b` (création ; `heros.css` `.fait b` 15 px) ; `acquisDe` :1496 `div.a>i+b` (progression, + `jeton`) ; `mesureDu` :1291 / `mesureDeLIdentite` :1625 / `mesure` `socle.js:21` (rubrique + `x / y` + jauge ; `.mesure` stylée dans `combat.css:28-30`, `navale.css`, `heros.css:204-206` : 3 définitions) ; `ligneDeCompte` :1227 `tr>td+td.chiffres` (page de service, commerce) ; lignes de `tableDApercu` :472 (aperçu au survol) ; `.carac` :495 (fiche lue) ; `.points .l`/`.enjeu>.l` (`suite.css`) ; `div.jeton>.v` :454 (barre de l'actif).
Distinction : balise (div/span/tr), police du libellé (Fell SC rubrique 11,5-13 px vs Fell 15 px vs Grenze 17-18 px pour la valeur, `.chiffres`), séparateur (rien, `border-top`, `border-bottom`), alignement de la valeur (`margin-left:auto`, grille `84px 96px`, `.px`), hauteur (27, 28, 34 px). Tailles de `.l` : 11,5 / 12 / 12,5 / 14 / 15 px (`seance.css`, `combat.css`, `suite.css`, `navale.css`). Contournent le kit : toutes (le kit n'a aucune pièce) ; seule `jauge` y est réutilisée.

### 2. Titres de cadre et de panneau — kit partiel (`ruban`, `cartouche`) ; ≥ 7 tailles de `h2/h3`
Variantes :
- Ruban (kit) : `ruban(` R9 A7, `cadre(…, { ruban })` R26 ; 14,5 px rubrique, 18 px `.gothique` (`gestes.css:75`) ; fenêtre du bas, journal, inspecteur.
- Cartouche (kit) : `cartouche(` R14 ; `.cartouche .n` 22 px ivoire (`gestes.css:113`), `.ouvert .cartouche .n` 20 px (`heros.css:302`) ; titre de lieu, héros.
- `<h2>`/`<h3>` écrits sur place (10 émissions : `rendu.js:823` inspecteur, :963 événement de route, :1089 et :1093 interlude, :1161 `#partie` taverne, :1246 page de service, :1374 document, :1430 destination du monde, :1457 affaire du carnet, `lieux-et-nuit/soins.js:8` soins) avec 12 règles de feuille de famille : `rendu.css:183` 23 px, `interlude.css:17` 26 px et `:27` 23 px, `commun.css:67` `.page h3` 24 px, `commerce.css:26` `#page h3` 27 px, `carte.css:16` `#destination h3` 28 px, `recit.css:89` `#affaire h3` 30 px, `nuit.css:31` `#partie h3` 30 px, `outils.css:93` `#inspecteur h3` 30 px, `recit.css:45` `#document h2` 34 px, `voyage.css:18` `#evenement h2` 34 px, `soins.css:7` sans taille. `#lieu h3` est défini deux fois (`rendu.css:183` 23 px / `interlude.css:17` 26 px).
- Intertitres de bloc : `rub()` :1465 (`heros.css:27`, 13 px rouille), `titreDeBloc` :1293 `.bloc-t` (`navale.css:22`, 12,5 px + `border-top`), `bande()` :647 `.bande` (`ouverture.css:29`, 13 px + `border-bottom` or), `h4` du journal :515 (`combat.css:119`, 13 px + trait `::after`), `.t.rubrique` (13 occurrences ; voir §3).
- Grand titre libre : `titreLibre` :624 (`.titre-libre .nom` 80 px dégradé, `ouverture.css:5-6`).
- Noms de héros/acteurs `.n.gothique` (20 émissions) : 19 px (`gestes.css:106`), 20 px (`combat.css:25`), 21 px (`jet.css:12`), 26 px (`combat.css:148`), 28 px (`combat.css:127`), 30 px (`combat.css:6`).
Distinction : taille, couleur (`#3a1a10` sur parchemin, `#f4e8ca`/ivoire sur bois), `text-shadow`, `margin` négative propre à chaque feuille (−10/−9, −8/−6, −4/−3…), `white-space`, `letter-spacing` .3/.5/0, `line-height` 26-50 px. Contournent le kit : les 10 `h2/h3`, `rub`, `titreDeBloc`, `bande`, `.n.gothique` ; `kit.md:110` met « le cartouche de titre » `À valider` (`dispositions.md:58`).

### 3. Sous-titres et rubriques — aucune primitive
Variantes : `.sous` (18 émissions) en 11 règles : 11,5 px (`rendu.css:9`), 12 px (`commun.css:68`, `heros.css:80`, `rendu.css:170`), 12,5 px (`jet.css:38,44`, `outils.css:94`), 13 px (`options.css:29`), 13,5 px (`combat.css:116`), 14 px (`outils.css:161`) ; couleurs `#4a3420`, `#5a2a12`, `#6b1c10`, `var(--rouille)`, `var(--encre-2)`. `.t` rubrique de panneau : 12 / 12,5 / 13 / 13,5 px (`rendu.css:150`, `jet.css:6`, `combat.css:76,150,209`, `suite.css:15`, `recit.css:85`, `combat.css:7`), couleurs `#5a2a12`, `#4a3420`, `var(--creme-2)`, `var(--or)`. `.l` : 11,5-12,5 px (§1). `.s.rubrique` des cartouches 11,5 px (`gestes.css:114`). La classe `.rubrique` elle-même (`gestes.css:48`, Fell SC, 1,1 px d'interlettrage) est émise 79 fois ; 14 règles de feuille lui donnent leur propre taille (9,5 / 11,5 / 12 / 12,5 / 13 px).
Distinction : taille, couleur, interlettrage (0,5 à 1,1), `border-bottom/top` éventuel, alignement (centré dans `#jet .place>.sous`). Contournent le kit : toutes ; le kit ne fixe que le ruban (14,5 px).

### 4. Notes, consignes, phrases d'aide — aucune primitive ; ≥ 9 rendus
Variantes (italique pour presque toutes) : `p.consigne` :347 (`combat.css:201`, 17 px, filet gauche, 70 px de haut) ; `.phrase-du-jet` (`jet.js:37`, `jet.css:58`, 12,5 px centré) ; `p.note` :326 et `#critique p.note` (`suite.css:31`, 14 px) ; `#page .note` (`commerce.css:29`, 12,5 px non italique, centré) ; `.apercu .pied` (`combat.css:68`, 13 px, `border-top`) ; `.regle .aide` (`options.css:36`, 13,5 px) ; `#document .pied .note` (`recit.css:54`, 13,5 px) ; `.bloc .ecrit` (`seance.css:32`, 14 px) et `.ligne-ecrite .ecrit` (`heros.css:208`, 17 px, `border-bottom`) ; `.rub .note` (`heros.css:29`, Spectral 12,5 px) ; `.prose.note` (`heros.css:379`) ; `.avis` (:690, `nouvelle-partie.css:32`, `b` 18 px) ; `colonne(… note)` place `cadre/note` (`gestes.js:326`).
Distinction : taille 12,5-17 px, police (Fell, Spectral), couleur (`#2a1d12`, `#3a2a18`, `#4a3420`, `var(--encre-2)`, `#6f6048`), filet (gauche, haut, bas, aucun), alignement. Contournent le kit : toutes ; il n'a que la place `note` de `colonne`.

### 5. Étiquettes, chips, marques — aucune primitive ; ≥ 8 rendus et 2 noms doublement définis
Variantes : `.modif` (`modif()` :184 ; `jet.css:36`, rect rayon 2, 12,5 px, `margin-top:5px`, surchargé `combat.css:190,197,198`, `commerce.css:77`, `rendu.css:13`) ; `.chip` (:1448 ; `recit.css:92`, Fell SC 12 px, rayon 2) ; `.tag` (:1466 ; `heros.css:49`, 32 px de large, 11 px) ; `.pill` (:1475, :1562, :1565 ; `heros.css:97`, hauteur 22, rayon 11, 11 px, puis 6 surcharges : 19 / 20 / 21 / 23 px et 10 / 10,5 / 12 px, `heros.css:148,164,173,178,338,378`) ; `.jeton` (:455 `combat.css:32` : ligne icône + valeur ; et `jeton()` :1469 `heros.css:51` : pastille 21 px rayon 11, teintes `or/cire/fer`, 4 surcharges `heros.css:254,272,367`) ; `.puce` (:749, `outils.css:168`, rayon 2, 14,5 px) ; `.etat-porte` (:417, `combat.css:159`, 11,5 px) ; `.marque` (cartouche `gestes.css:158`) ; `.consequence` (`jet.css:51` et `heros.css:309`).
Distinction : rayon (2 px ou 11 px), hauteur (16-23 px), taille 10-14,5 px, police (Fell SC, Chiffres, Fell), fond (`rgba(255,245,215,.35)`, `var(--voile)`, dégradé laiton, dégradé cire), pictogramme (aucun, `chevron_d` dans `.pill`). Doublons de nom : `.jeton` (combat.css:32 contre heros.css:51), `.consequence` (jet.css:51 contre heros.css:309). Contournent le kit : toutes (le kit ne connaît que `.marque` du cartouche et le jeton de réserve de `jet.js`).

### 6. Puces et listes — aucune primitive ; ≥ 9 rendus
Variantes : losange 7 px (`.losange` `gestes.css:263`, dans `filet`) et, en puce de ligne, `<i class="losange">` (:1473 `optionDe`, `heros.css:48`, création) ou `picto('coche')` (même ligne si choisie) ; `.pt` à deux sens sans rapport (`outils.css:45` 8 px or, coop :779 ; `heros.css:366` 34 px, station du changement de carrière :1698) ; `.puce` carte (rayon 2, :749 `outils.css:168`, compendium) ; `.sep` (:801 `outils.css:68`, trait vertical 1×30 px de la barre) et `span.sep` « · » de `carteDe` (:264) ; « · » en texte (110 occurrences dans `rendu.js`) ; `.dot` (:1579 `dotation`, à ne pas confondre avec une puce) ; `.point` 3 px (`rendu.css:15`, aucune émission dans les `.js` par grep) ; `.pastille-entite` (:521).
Listes : `.ligne` définie 3 fois avec trois designs (`heros.css:39` 28 px Fell 15 px `border-bottom` ; `commerce.css:95` grille `auto 1fr 84px 96px` 27 px 13,5 px `border-top` ; `outils.css:7-11` `ligneDeListe` + `.ligne.la` doré), `.ligne-b` (`combat.css:212`, 28 px 14,5 px), `.rangee` (`outils.css:148`, 23 px 14,5 px, `border-bottom` or .12), `.ligne-d-index` (:760), `.ligne-l` (plaque, `combat.css:77`), `.cartes.liste` (`gestes.css:205-217`, plaques de 36/44 px paginées).
Distinction : forme du marqueur (losange, coche, rond, aucun), hauteur de rangée (23-36 px), police, surlignage de la choisie (bordure laiton 2 px `heros.css:42`, dégradé doré `outils.css:9,150`, `.prise` `commerce.css:102`), séparateur. Contournent le kit : toutes ; seule `.cartes.liste` est de plaque du kit.

### 7. Filets — kit `filet()` (R35 A1) ; 4 constructions parallèles
Variantes : `filet({ fondu })` 22 appels, `filet({ losange })` 9, `filet()` 4 (`gestes.css:256-262`, deux traits, marge 11 px 0) ; surcharges de marge par feuille : `heros.css:30,81,105`, `rendu.css:237,284`, `nouvelle-partie.css:22`, `options.css:31`, `sauvegardes.css:7,14`, `combat.css:132`, `recit.css:48`, `ouverture.css:7` (4 px 0 à 28 px 8 px, 120 px latéraux) ; `div.trait` (4 définitions : `outils.css:12-13` .28 / .35 parchemin, `nouvelle-partie.css:11` marge 4px 2px, `options.css:7` marge 2px 0, `ouverture.css:17` dégradé .55 ; émis :559, :642, :684 ; `kit.md` ne le nomme pas) ; bordure de bloc : `h4::after` (`combat.css:120`), `.bloc-t` `border-top` (`navale.css:22`), `.bande` `border-bottom` (`ouverture.css:29`), `.axes .t` (`suite.css:15`), `.apercu .titre` (`combat.css:62`), `.ligne` `border-top/bottom`.
Distinction : trait simple/double (kit) ou unique, opacité (.5, .28, .35, .4, .45, .55), dégradé fondu ou plein, marge, losange central. Contournent le kit : `.trait` ×3 écrans, les bordures de bloc (≥ 6), les 12 surcharges de marge.

### 8. Bulles — kit `raison()` + `apercu()` ; 4 rendus
Variantes : `raison(texte)` `.bulle-refus` (R15 A4, `gestes.css:320-325`, pointe et pose par `poserLesBulles` `gestes.js:254`) avec 13 surcharges de position/taille : `heros.css:45,46,179,180,277,278,294,295,314,315`, `outils.css:203`, `voyage.css:60`, `jet.css:31` ; `apercu()` (R8, `gestes.css:139-149`, 300 px, pointe) avec doublons de corps (§4 du rapport) ; `title="…"` natif (11 émissions : :304, :377, :897, :1079, :1150, :1157, :1232, :1236…, `jet.js:40`) ; `aCote` :1343 / `survolDe` :1347 / `signaleeDe` :1353 (survols de scène de l'exploration, sur `apercu`).
Distinction : pointe (`vers-gauche`…, `.dessous`, `.cote-*`), largeur (300 px, 310 px, 340 px, `100%`), texte (Spectral italique 13 px vs aperçu structuré), mobile ou non (`data-mobile`, `data-ancre="survol"`), bulle riche ou infobulle du navigateur. Contournent le kit : les 11 `title=`, les surcharges positionnelles de `.bulle-refus`.

### 9. Plaques et boutons — kit `plaque` (R84 A4), `rond` (R27 A12), `outil`, `medaillon` ; peu de rendus parallèles
Variantes : `plaque` à 4 tailles du kit (`.petite` 28 px, défaut 40 px, `.appel` 52 px, `.carte` 92 px, `.carte.courte` 26 px, `gestes.css:171+`), surchargée en largeur par famille (44, 64, 76, 94, 110, 136, 146, 176, 190, 230 px : `combat.css`, `heros.css`, `outils.css`, `recit.css`, `rendu.css:174`) et en hauteur de carte (`voyage.css` 76 px, `navale.css` 70 px contre 92 px au kit) ; contenus de plaque ré-habillés : `#suites .place>.plaque>div` (`jet.css:60`), `rendu.css:32,72,86,160` (padding, interlettrage, 10-13 px) ; `div.geste` :1348 (`rond` menu + texte + `<kbd>`) et :818 (plaque dans `div.geste`) ; `outil` R4 ; `.case-r` :447 (plaque sans libellé + rubrique) ; `rond` et `medaillon` pour les ronds. Conteneurs de rangée `div.gestes` redéfinis par feuille (:586, :837, :1060, :1204, :1220, :1500).
Distinction : largeur, taille de libellé (10-15 px), interlettrage, nombre de lignes, pictogramme (`icone`, `numero`, `prix`). Contournent le kit : les contenants `.gestes*`, `div.geste` :1348, `.case-r` ; la pièce elle-même est unique.

### 10. Jauges — kit `jauge` (R15), `reglette`, `rangDePas`, `mesure` ; le moins dispersé
Variantes : `jauge` fine 6 px / forte 8 px, teintes `cire`/`or`, `ajout` hachuré (`gestes.css:161-168`) ; `reglette`/`curseur` (:542, `gestes.css:277-282`) ; `rangDePas` (R5, losanges, `gestes.css:171-173`) ; `clous` :1477 (`heros.css:70-73`, ronds 9 px) ; `compteur`/`disque` ; `mesure`/`mesureDu` (jauge + `x / y`, §1). Largeurs fixées par famille (`combat.css:11,14` 92/98 px, `rendu.css:152`) ; `pas.petit` contradictoire (`combat.css:31`, `suite.css:8-9`) ; 3 définitions de `.mesure`.
Distinction : forme (barre, losanges, ronds, curseur), hauteur, teinte, étiquette. Contournent le kit : `clous` (rond 9 px au lieu de `rangDePas`), la structure `.mesure` triple.

### Synthèse du classement (plus dispersé en premier)
1 lignes libellé+valeur (≥ 12 rendus, 0 primitive) · 2 titres (≥ 7 tailles de h2/h3, 2 primitives qui ne les couvrent pas) · 3 sous-titres et rubriques (5 tailles de `.sous`, 4 de `.t`, 0 primitive) · 4 notes et consignes (≥ 9 rendus, 0 primitive) · 5 étiquettes et chips (≥ 8 rendus, 2 noms doublés, 0 primitive) · 6 puces et listes (≥ 9 marqueurs, `.ligne` ×3, 0 primitive) · 7 filets (kit + `.trait` ×4 + bordures) · 8 bulles (kit + `title=` ×11 + 13 surcharges) · 9 plaques et boutons (kit unique, 10 largeurs surchargées) · 10 jauges (kit presque seul).
Non couvert pour cette question : rendu pixel réel des variantes (Playwright absent) ; mesure des couleurs/marges de chaque variante au-delà des extraits cités ; les feuilles `*.html` de `kit/` ; la liste complète des 79 émissions de `.rubrique` par écran.
