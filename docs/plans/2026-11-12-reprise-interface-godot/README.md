# Reprise du chantier « interface finale Godot » (#3935), 2026-11-12

Ticket: #3935, #4005, #4006

Archive datée d'une passation, pas une référence vivante. Elle sert au Claude qui reprend le chantier depuis un autre
compte : il ne voit ni le fil de projet d'origine, ni son dossier de travail, ni ses fichiers partagés. Tout ce qui
n'était pas déjà au dépôt ou aux tickets est ici. Ce dossier se supprime quand l'épique n'en a plus besoin.

## 1. La demande, en verbatims datés de Clément

**2026-11-11, demande d'origine**

> Bon on a connecté Godot au noyau et l interface est brute. J ai besoin d un fable qui s occupe de créer l interface final côté Godot à partir de tout ce qu on s est dit, et en n oubliant pas que l ancienne interface web était un échec. Par créer je ne parle pas juste de me fournir une maquette car jusqu'à maintenant Claude a toujours été incapable de le respecter une fois qu il doit l appliquer. Non il me faut un vrai plan de bout en bout

**2026-11-11, périmètre**

> Sachant que mon objectif c est de faire toutes les interfaces. Ceux qui ont déjà été créé sont justes des essais avec un modèle moins bon que toi

> Il y a une idée derrière les écrans existant, une direction que j avais fourni, mais le final c est juste un design histoire d avoir quelque chose à se mettre sous la dent et commencer à mettre en place des outils/skills/ruled/script/docs/structure/etc… et tenter une première approche dans le domaine. A l équerre fable 5.2 n etait pas encore sortie, tu hérite donc du chantier

**2026-11-11, ce qui engage**

> Ma direction principale ça reste la partie Monde. Le reste c était des détails par rapport à ce qui avait été produit, ça reste des intentions plus qu une direction. Je suis ouvert à des expériences et interface que tu me proposeras, tant que c est adapté au système de jeu et les intentions derrière le projet

**2026-11-12, 00:16 UTC, sur le voyage en scène, avec l'écran du voyage de la maquette en image**
(`maquette/ecran-du-voyage-montre-par-clement-2026-11-12.png`)

> On est encore loin de

C'est son dernier retour visuel. Aucun écran n'a été validé : `hotes/godot/etalons/valides.json` est vide, et seule
sa validation l'écrit.

**2026-11-12, consigne aux fils qui refondent un écran**

> Une refonte met à jour, dans le même geste, les outils qui lisent ce qu'elle change. Avant de publier : (1) cherche les noms, ids, clés et options que tu renommes ou supprimes dans `hotes/godot/recette.mjs`, `scripts/recette/`, `scripts/qc/`, `scripts/hote-texte.mjs`, `.claude/skills/`, `.claude/agents/`, `.claude/rules/` et `docs/` ; (2) rejoue le parcours de `hotes/godot/recette.mjs` qui couvre l'écran touché, car la CI n'en joue aucun ; (3) corrige tout de suite, pas en ticket.

**2026-11-12, la passation**

> Vu qu'on passe notre temps a taper la limite des 5 hr avec 2 processus en //, ton chantier sera repris par un autre claude mais il faut tout lui fournnir car il sera sur un autre compte, et le tout dans une branche

La direction du monde est #3534. Sa cible, mot pour mot : « Le voyage comme une scène, jamais une modale. La route
plein écran (moyen de transport, heure, météo dans le paysage), les étapes et les nuits sur une frise, les jets sur le
héros qui les fait, l'événement dans la scène avec ses seuls vrais choix (Chance, réaction, gîte) ; ce qui n'est
qu'affichage ne s'arrête pas et va au journal. Plus de « Bilan de l'étape » ni de fenêtre par-dessus. »

## 2. Où lire quoi

| Quoi | Où |
|---|---|
| Le plan de bout en bout (lots 0 à 8, mécanisme de l'étalon, hypothèses H1 à H6) | `plan-interface-finale.md` de ce dossier. Le corps de #3935 en est une version antérieure : le remplacer par ce texte. |
| Précisions de périmètre de Clément, relevé de ses directions par famille d'écran | commentaires de #3935 du 2026-11-11 |
| Lot 0 mesuré (banc), lot 1a (forme par usage), lot 1 premier incrément (écran du lieu), état du lot Monde | commentaires de #3935 du 2026-11-11 et du 2026-11-12 |
| La règle de l'étalon et le rail d'un écran | `.claude/rules/ecrans-godot.md` |
| Rencontres de voyage : design R1, verdict du juge et recadrage, relevé RAW des 26 rangées | #4005, trois commentaires du 2026-11-12 |
| Socle de cascade : défauts mesurés et design, non jugé | #4006 et son commentaire de design du 2026-11-12 |
| La maquette d'intention de #3534 (lieu, voyage) | `maquette/` : `Main.dc.html` (lieu), `Carte.dc.html` (voyage), `canvas.json`. Elle ne vaut qu'intention de disposition. |
| Ce que Clément a vu du jeu | `captures/` : le voyage (jets, jets tombés), la halte, le lieu. Les étalons du dépôt (`hotes/godot/etalons/*.png`) sont les mêmes écrans, monde caché. |
| Les sondes et leurs sorties brutes | `sondes/`, voir la section 8 |

## 3. État au 2026-11-12

| PR | Contenu | État |
|---|---|---|
| #3942 | le banc des étalons : planches, `?planche=<nom>`, `etalons.mjs`, rapport, règle `ecrans-godot.md` | fusionnée le 2026-11-11 |
| #3976 | l'écran du lieu au fini, le pied des héros, le journal ; `Zone.formes`, `Dessin`, registre des fonds en donnée | fusionnée le 2026-11-12 |
| #3987 | la description d'un lieu (`prose`), les quatre lieux de la Diligence décrits | fusionnée le 2026-11-12 |
| #4001 | le voyage et la halte en scène peinte : paysage en couches, tête de scène, carte du trajet, frise, journal dans la scène, jets sur les cartes des héros | fusionnée dans `main` le 2026-11-12 (branche `chantier/3935-voyage`), après cinq sorties de file. Sortie deux fois de la file de fusion le 2026-11-12 pour un conflit avec `main` dans `src/hote/ecran.ts` ; `main` y est refusionné deux fois, la recette du voyage corrigée, ses trois planches réenregistrées et leurs étalons reposés. Ressortie une troisième fois, rouge à l'étape « Godot, scripts et recettes autonomes » : le bouton « Quitter la partie » venu de #4010 vivait dans le panneau du journal, que la scène du voyage cache ; la scène le range maintenant, étalons reposés. Ressortie encore deux fois : mise en file avant la fin de la CI de branche (`INVALID_MERGE_COMMIT`), puis en conflit avec #4021 (#4007), placée devant elle dans la file et qui corrige le même parcours `voyage` de `hotes/godot/recette.mjs`. Le fichier est rendu à la version de `main` : le correctif de la recette est porté par #4021, et jusqu'à sa fusion le parcours `voyage` s'arrête à l'écran du lieu, comme sur `main` depuis #3987. `main` est refusionné une quatrième et une cinquième fois (son de l'hôte Godot, lexique), les trois planches réenregistrées (seuls le `canal` des pistes et la clé du monde changent). |

Cette branche (`chantier/3935-reprise`) n'ajoute que ce dossier à `main`, où #4001 a fusionné.

Avancement des lots du plan :

- **Lot 0** : l'outil est livré. La porte de CI (seconde PR) n'est pas faite : une PR qui change un écran ne rougit
  toujours pas seule.
- **Lot 1a** : tranché (la disposition choisit la forme, `Zone.formes`).
- **Lot 1b** (art d'interface, kit, planche du kit) : commencé par besoin (dessins à jetons, fonds, paysages), pas mené
  comme lot. Pas de planche du kit, pas de référence de genre rassemblée.
- **Lot 1c** : l'écran du lieu est posé, la porte de goût n° 1 n'a pas été tenue.
- **Lot 2** (monde) : lieu et description livrés ; voyage et halte dans #4001 ; l'événement de route en scène est
  bloqué par le noyau (section 4) ; restent la carte, les gens du lieu, les étapes nommées, le récit d'arrivée.
- **Lots 3 à 8** : non commencés.

## 4. En vol : pourquoi l'événement de route ne se joue pas encore

Le centre de l'écran du voyage de la maquette est l'événement de route avec ses choix. Le noyau ne le fournit pas :
`etapeRencontre` (`src/noyau/travelPostes.ts`) tire une rangée de `rencontres-edoc.json` et n'en joue presque rien.
En voulant la jouer par un `Flow` (comme la mer joue ses événements de bord), une couture du socle casse. Elle est
réelle en mer aujourd'hui.

**#4006, le socle (prérequis).** Mesuré à l'arbre `f2104fce2`, références de lignes à re-mesurer (voir plus bas) :

- `jouerLaJournee` et `piloteImmediat` (`src/noyau/cascade.ts`) jouent la journée sur un tableau local. Ils
  n'écrivent le slot que pour un vrai choix ou une étape pas prête, et ne parquent la séquence en pile
  (`suspendedCascades`) que si un combat s'ouvre en vol.
- `fenetrePour` ne ramasse sous la fenêtre de l'applier que les poussées du même `purpose`. Une séquence d'un autre
  `purpose` ouverte par l'applier (`openSkillTest`, `ouvrirLeChoixDuFlow`, `demanderLesVolontaires`,
  `ouvrirLesContagions`, tous atteints par `runFlow` de `src/noyau/combatEffects.ts`) écrit le slot sans suspendre la
  journée.
- `clotureHorsCombat` (`src/noyau/partyWipe.ts`) rend vrai quand un slot écrit par ce pilote vit : `jouerLaJournee`
  saute alors `clotureDeCascade`.
- `jetValider('test')` (`src/noyau/testsDeScene.ts`) libère le slot et joue la branche sans passer par
  `dispatchCascadeDone` (`src/noyau/combatSlice.ts`), qui est le seul à reprendre la tête de pile.

Trois défauts, une cause :

1. Mer, événement de bord tiré naturellement à nœud `choice` (graine 8, « Message dans une bouteille » ; aussi 9, 13,
   15, 21, 26) : le choix est empilé sous la journée, ressort après la halte, et sa validation rejoue `runSeaDay`
   (`daysAtSea` à 2, `pendingRest` vrai, `gameTime` inchangé).
2. Mer, nœud `test` sous l'applier : la journée meurt à `jetValider('test')`.
3. Terre, `runFlow` sous `etapeRencontre` (test, choix, volontaires, `exposeDisease`) : `pendingRest` faux,
   `travelPlan` orphelin.

Le design est au commentaire de #4006 : le pilote immédiat obéit à la doctrine du slot (après `commitStep`, si
l'applier a écrit le slot, la séquence entière est parquée et le pilote rend la main), les clôtures de Test de scène
finissent par la même reprise que `dispatchCascadeDone`, et la relance de `runSeaDay` ne se joue que si aucune journée
n'est parquée. **Il n'a pas été jugé** (le juge a été coupé par la limite d'usage, puis arrêté pour la passation) et
rien n'est codé. Six points à attaquer y sont listés.

**Avant tout code sur #4006** : `main` a reçu depuis #3892 (« Le Destin et le Piège-lame rendent la main à la série
subie hors bataille ») et le lexique français #3938, qui ont touché `cascade.ts`, `combatSlice.ts`, `partyWipe.ts`,
`testsDeScene.ts`, `combatEffects.ts` et `seaVoyageFlow.ts`. Rejouer les sondes de `sondes/4005-4006-lecteur/` sur
l'arbre courant, re-mesurer les lignes et les trois défauts, puis faire juger le design.

**#4005, les Rencontres de voyage.** Le premier design a été réfuté par le juge puis recadré (commentaires du ticket) :

- Lot R1 : « Voyage fatigant ! » (EDOC 08 l.225) et « Conditions répugnantes ! » (EDOC 08 l.232) joués par un champ
  `consequence` (`Flow`, même `flowSchema` que `sea-events`) sur le seul schéma des Rencontres ; « Voyage tranquille »
  inchangé ; l'événement du jour en cours servi d'un seul endroit à tous les médias, avec un seul lecteur ; les issues
  typées en sous-ensemble avec une table totale. Prérequis : #4006.
- Lot R2 : « Très mauvais temps » (l.230) et « Temps libre » (l.195). Leurs valeurs de `stageOutcome`
  (`worsenWeather`, `extraActivity`, et `skipStage` du Raccourci) sortent de la donnée tant qu'aucun lecteur ne les
  joue, avec leurs entrées au manifeste (`src/data/raw.manifest.json`).
- Questions de règle à poser à Clément quand R2 se conçoit, pas avant : Territoire hostile (qui est pris en
  embuscade), Raccourci (ce que vaut une Étape sautée en jours et en kilomètres), Équipement essentiel endommagé
  (quelle pièce, quel porteur), Route à péage (valeur maison).
- Corrections de références faites au relevé : « une Rencontre par Étape » est EDOC 09 l.5 (un conseil), pas
  EDOC 08 l.9 ni l.18 ; le relevé compte 16 rangées hors lots, pas 15.

**Côté écran**, à prévoir avec le lot Godot de l'événement : `src/hote/gestes.ts` donne à une étape à jet la
disposition `<clé>/<jet>`, donc un Test de scène en route s'affiche en `cascade/test`, la fenêtre générique, et non
dans la scène du voyage. `voyageEnVue` ne sert aucun événement, `RecapEvent` n'a pas de catégorie, et la terre n'a pas
de champ d'événements (la mer recopie les siens au bilan du jour seulement).

## 5. Suite proposée, dans l'ordre

1. #4001 a fusionné : rien à reprendre. Quand #4021 aura fusionné, rejouer les parcours `voyage` et `repos` de
   `hotes/godot/recette.mjs` sur un export de `main` : ils n'ont pas tourné jusqu'au bout depuis #3987.
2. #4006 : re-mesure sur l'arbre courant, un juge sur le design, un codeur, les tests listés au design, PR sur
   `chantier/4006`.
3. #4005 lot R1, puis le lot Godot : l'événement dans la scène du voyage avec ses choix, sa planche, son étalon.
4. Les griefs d'écran restants (section 6) et les étapes nommées de la frise (le relais comme lieu, #3534).
5. La porte de CI du banc (seconde moitié du lot 0).
6. Montrer à Clément, sur des captures du jeu, le lieu et le voyage : c'est la porte de goût n° 1, qui n'a pas eu lieu.
7. #4005 lot R2 avec ses questions de règle, puis la carte et les gens du lieu, puis les lots 3 à 8 du plan.

## 6. Griefs d'écran et constats ouverts

- La hauteur des cartes des héros déplace la frise d'environ 47 pixels entre la route et la halte.
- À la halte, la puce « Exténué » décale les listes Logement et Nourriture d'une carte à l'autre ; la nuit des
  dormeurs est encore en listes sur leurs cartes.
- La mini-carte du voyage ne nomme aucun lieu ; la frise n'a pas d'étapes nommées.
- `rf.pleinAirDispense` s'affiche une nuit à l'auberge par temps sec (`tempsDeLaNuit`, `src/noyau/reposEnVue.ts`).
- Textes du noyau montrés tels quels : « Postes de l'Étape », « Tout résoudre », « Cartographie : 2/4 DR. », le
  résultat de table recopié. Le journal n'a pas de voix de narrateur, aucune phrase de récit par poste.
- Parcours `repos` de la recette : la disposition lue après « Dormir » est `null`. Non analysé.
- L'en-tête de `hotes/godot/recette.mjs` ne donne pas de commande d'exemple pour `--parcours voyage` ni `inventaire`.
- Écran du lieu (commentaire de #3935 du 2026-11-11) : gens du lieu absents, « Nouveau héros » grisé en permanence,
  « Entrer » contre des gestes directs, planche du lieu pauvre (deux services, un trajet).
- **Banc, capture instable** : sur l'export de l'arbre fusionné, la planche `lieu` a donné 1204 pixels d'écart dans la
  zone (699,708)-(1046,751), au pied des héros, au premier passage, puis « conforme » au second, sans rien changer. À
  comprendre avant de poser la porte de CI.
- **Les planches et les étalons de `main` sont périmés** (mesuré à `f2fb861c3`). #4010 (la campagne sous Godot)
  ajoute à toute vue les zones `partie.gestes` (« Quitter la partie »), `groupe.pretires` et `groupe.campagnes` sans
  réenregistrer les planches ni reposer les étalons ; le lexique (#3938) avait déjà périmé `bataille-entre-rounds`,
  `bataille-scenes` et `document`. `node hotes/godot/etalons.mjs --enregistrer` réécrit donc les 38 planches, et sur
  l'export de l'arbre fusionné le banc rend `lieu`, `echoppe` et `recit-d-arrivee` à 60 020, 78 995 et 60 021 pixels
  de leurs étalons. #4001 ne reprend que ses trois planches (`voyage-jets`, `voyage-jets-tombes`, `repos` : 4, 14 et
  7 pixels d'écart à un niveau de couleur près une fois réenregistrées, étalons reposés). Les 35 autres sont à
  réenregistrer et à reposer : signalé au fil du projet d'origine pour l'auteur de #4010, à vérifier sur `main`
  avant de s'y fier. C'est le coût mesuré de l'absence de porte de CI.

## 7. Mode d'emploi

```bash
echo '{}' | node scripts/hooks/bootstrap-conteneur.mjs      # conteneur neuf : avant le premier commit
node hotes/godot/construire.mjs --export --sortie <web>      # export Web (tire l'éditeur et les modèles épinglés)
node hotes/godot/etalons.mjs --enregistrer                   # réécrit les planches depuis le pont
node hotes/godot/etalons.mjs --web <web> [--planche <nom>]... [--rapport <dossier>]   # le banc
node hotes/godot/etalons.mjs --web <web> --poser --planche <nom>                      # pose un étalon (il n'est plus validé)
node hotes/godot/recette.mjs --parcours voyage --scenario voyage --web <web> --captures <dossier>
node hotes/godot/recette.mjs --parcours repos --scenario voyage --web <web> --captures <dossier>
node hotes/godot/recette.mjs --parcours inventaire --scenario porte-close --web <web> --captures <dossier>
npm run typecheck:fast
npx vitest run --config vitest.noyau.config.ts hotes/godot/pont/route.hors-store.test.ts hotes/godot/pont/repos.hors-store.test.ts hotes/godot/pont/voyage.hors-store.test.ts src/noyau/voyageEnVue.hors-store.test.ts
npm run godot:sonde ; npm run comptes:plage ; npm run lint ; npm run deps:unused ; npm run docs:check
```

Durées mesurées dans un conteneur à 4 cœurs sans carte graphique : l'export prend plusieurs minutes (l'étape
`godot --import` peut dépasser 580 s après une grosse fusion : la lancer en fond) ; banc environ 30 s par planche, 12 min pour 38 planches sur
deux processus ; parcours `voyage` 4 min, `repos` 1 min 40 ; `npm run test:perimetre` 8 à 10 min.

## 8. Les sondes

Fichiers de test jetables, renommés en `.txt` pour qu'aucun outil du dépôt ne les ramasse. Ils portent les chemins
absolus du conteneur d'origine (`/home/user/game`, et un dossier de travail sous `/tmp`) : pour en rejouer un, le
copier hors du dépôt, lui rendre son nom (`*.sonde.test.ts`, `vitest.config.ts`), corriger les chemins, puis
`npx vitest run --config <dossier>/vitest.config.ts`. Les `*.sortie.txt` sont leurs sorties brutes à `f2104fce2`.

| Dossier | Ce que ça mesure |
|---|---|
| `sondes/route/` | ce que la vue sert pendant une journée de route à pied, graine par graine (`route`), la voie d'un passage en barge (`barge`, `voie`) |
| `sondes/4005-juge/` | `a1`, `a1b` : `runFlow` sous `etapeRencontre`, la journée qui ne reprend pas (défaut 3) |
| `sondes/4005-4006-lecteur/` | `q5` : un événement de bord forcé par rangée ; `q5nat`, `q5nat2` : tirage naturel par graine (défaut 1) ; `q5inj` : un nœud `test` injecté (défaut 2) ; `a6` : la terre ; l'inventaire des nœuds de `sea-events.json` |
| `sondes/4006-juge/` | travail partiel du juge interrompu : `inv` instrumente 130 appliers et relève qui écrit le slot en vol (seul `mer-evenement-de-bord`, toujours en `choixDeFlux`) ; `espion-setup` trace les appels de `clotureHorsCombat` sous slot vivant sur toute la suite du noyau (non mené au bout) |

## 9. Ce que la pratique a appris, et que le dépôt ne dit pas en un seul endroit

- La CI de branche (job « branche ») ne joue pas toute la suite Vitest ; la file de fusion, si. Une garde peut donc
  ne rougir qu'en file : #4001 y a échoué sur `matieres-en-donnee` (un littéral `terre` ; la voie d'un trajet reprend
  maintenant `terrestre | fluvial | maritime`).
- `npm run godot:sonde` (la recette native de l'écran, entre autres) ne tourne qu'en file de fusion. La rejouer
  après chaque fusion de `main` : une zone ajoutée par un autre lot dans un panneau que ta disposition cache y fait
  « n'a aucune zone », et rien d'autre ne le dit avant la file.
- Une PR en file se fusionne avec les PR placées devant elle, pas seulement avec `main` : un `git merge-tree` propre
  contre `origin/main` ne prouve pas l'absence de conflit. Deux PR qui portent le même correctif se sortent l'une
  l'autre de la file ; avant de corriger un outil partagé, chercher la PR ouverte qui le corrige déjà et lui laisser.
- La fusion automatique ne se réactive qu'une fois la CI de branche verte sur la nouvelle tête : mise en file plus
  tôt, la PR en ressort en `INVALID_MERGE_COMMIT`.
- Activer la fusion automatique juste après un push, avant que GitHub ait calculé la fusionnabilité, sort la PR de la
  file (`INVALID_MERGE_COMMIT`). Attendre la CI de branche verte, ou la réactiver. Une PR sortie de file ne s'y remet
  pas seule.
- Un worktree neuf n'a pas les fichiers `*.generated` ni les modèles épinglés : son typecheck et ses tests du pont y
  sont pollués. Travailler dans l'arbre principal, ou bâtir d'abord.
- Après une fusion de `main` qui touche `hotes/godot/` ou `src/hote/`, réenregistrer les planches et rejouer le banc
  sur celles que la PR touche : un étalon ne bouge que si l'interface bouge, et il faut pouvoir le dire.
- Le portrait et l'interface sont reproductibles au pixel, le monde 3D ne l'est pas : le banc capture monde caché.
- Un écran n'est jamais montré à Clément par une maquette ni par une description : par une capture du jeu.
- Les agents coûtent : le type `juge` tourne sur le plus gros modèle à effort élevé. Deux processus en parallèle ont
  suffi à atteindre la limite d'usage de cinq heures. Un juge par jugement dû (règle de jeu, socle), pas davantage, et
  un seul agent en vol.
- L'hôte texte (`docs/hote-texte.md`) joue le noyau sans navigateur : c'est le moyen le moins cher de voir ce qu'une
  journée de voyage sert à la vue, avant tout export.
