# HUD de combat — Invariant V2 (cérémonie du 2026-08-16)

Ticket: #2998

> Plan daté, à supprimer une fois exécuté (politique `docs/` du CLAUDE.md).
> Chronologie : `Analyse HUD Rogue Trader.dc.html` (référence produit) → `Spec HUD Combat.dc.html`
> (ÉBAUCHE jetable — « La spec n'est pas au niveau attendu, mais une ébauche ») →
> `Invariant HUD Combat.dc.html` (4 lois, jugé hors dépôt SANS shell) → CETTE cérémonie
> (5 sondes + juge avec shell + 3 lecteurs de grounding + arbitrages utilisateur).
> Le design `docs/superpowers/specs/2026-07-31-hud-combat-exploration-design.md` « a énormément
> de défauts, et a empiré l'interface » (user, 2026-08-16) : à REMPLACER — ses réfs vivantes
> (`combat-ui.css:881`, `hud.css` ×8, `combat-modals.css:61`, `CampaignView.tsx:224`,
> `InitiativeStrip.test.tsx:95`) se soldent au fil du chantier, puis le doc se supprime.
> Fiche mémoire : `game-arbitrage-hud-console-rt-2026-08-16`.

---

## 1. Arbitrages utilisateur (verbatim — PRIMENT sur tout le reste)

1. **Anatomie = console Rogue Trader, DEUX TRAVÉES SIMULTANÉES** (pas des pages qu'on tourne) :
   « je voulais faire une partie gauche avec consommable + nos sets d'armes et les compétences
   de combat lié a l'arme ou générale (comme la charge par exemple pour les armes de mélée,
   Recharge pour les armes a munition, on peut même imagine un bouton pour tirer sans bouger
   plutot qu'une option dans la modale, ou pour tirer dans le tas, on peut même imaginer a coté
   des consommables l'action soin), et a droite le reste des actions (Mouvement, Gain
   d'avantage, Course histoire de pouvoir faire le jet et connaitre la vrai distance, lancer un
   sort/miracle, etc ...) ». Confirmé : la règle « survit les mains nues » de l'invariant HTML
   est REMPLACÉE — gauche = ce que le matériel tenu offre et les gestes d'attaque qui en
   dépendent ; droite = le reste.
2. **Boutons = sélection VOLONTAIRE d'intention, jamais un remplacement du champ** : « Ca ne
   change pas les actions par défaut sur le grid comme le déplacement/attaque, ou la
   charge/course, c'est juste pour qu'on les selectionner volontairement depuis l'interface.
   Car actuellement pour charger, il est difficile de connaitre la distance, vu qu'elle va au
   dela de notre mouvement, alors cliquer sur l'action permettrait de mieux voir la portée. »
3. **Géométrie immuable** : « je ne veux pas que la taille de l'interface ou les boutons
   bougent. »
4. **PAS de bouton-liste** : « Je veux éviter au maximum les boutons qui ouvrent une liste de
   bouton ou d'action. […] les sorts sur un bouton, ca n'a pas de sens. […] les sorts dans une
   liste c'est un NON. » → le patron tiroir `.ab-spells` DISPARAÎT.
5. **État de l'art avant invention** : « ce n'est pas le premier RPG web sortie, les problèmes
   qu'on se pose ont deja des réponses depuis des années, et surtout on est partie d'un jeu
   existant qui réponds deja pas mal a ces questions. »
6. **Exhaustivité** : « Je n'ai donné que des exemples et c'est très loin d'etre exaustif » —
   le catalogue de la spec est l'INVENTAIRE MESURÉ (§4), jamais la liste d'exemples.
7. **Dimensionnement = scénario de magie** : « Le pire il est dans le scénario de magie » —
   pire cas MESURÉ : la Haute Sorcière (`_casters.ts:63-77`) porte **211 sorts** (25 Magie
   mineure + 56 Arcanes communs + 126 domaines Feu/Mort/Cieux/Bête/Vie + 4 Nécromancie,
   comptés dans `spells.json`). Pas de mémorisation RAW → l'exhaustif reste incantable en combat.

**Arbitrages fermés via AskUserQuestion (2026-08-16)** :
- **Clavier SANS modificateur** (AZERTY : Maj+Digit1 EST « 1 » — collision structurelle) :
  `1-9` = emplacements ; débord aux flèches (déjà câblées dans `Tabs`/`rovingKeyDown`) ou une
  touche libre (R/G/X inutilisées). L'étape « apprendre les modificateurs » disparaît.
- **Empreinte = POSITION FIXE + touche par ID d'action** (à 360px, 5 alvéoles max tiennent —
  ⚠ RÉVISÉ le même jour après juge-de-spec : « la touche suit la CASE » (AskUserQuestion,
  spec zone 8) ; et la mesure « 5 max » est tombée (2 rangées de 6 tiennent). La ligne est
  gardée pour l'historique ; la spec fait foi.
  mesure CSS) : la console ne saute jamais, chaque action garde sa touche (mapping id→touche),
  le compte visible s'adapte au viewport. Tue C2 (la touche désignait un rang de liste).
- **Réactions d'État SUR LA PASTILLE** (`StateChips` + `GatedAction`) : En flammes → Se
  rouler, Empêtré → Se libérer, À Terre → Se relever, États retirables → Détermination.
  −4 ids du catalogue, zéro alvéole morte, un seul propriétaire.
- **Sorts = GRIMOIRE + BARRE DE RACCOURCIS PLACÉE PAR LE JOUEUR** : les sorts/capacités posés
  sur la barre vivent en alvéoles directes (touche stable) ; l'exhaustif vit dans un GRIMOIRE
  — surface structurée par domaine/Vent (tuiles groupées + filtre, primitives
  `GroupedPickGrid`/`MasterDetail`), ouverte depuis la colonne d'outils. Sélectionner au
  grimoire arme le MÊME mode de ciblage que l'alvéole.
  ⚠ Correction utilisateur (verbatim) : « on "Epingle pas", on place nous mêmes nos sorts et
  capacités de sa barre de raccourci, même si on a une barre rempli par defaut » — la barre
  est ENTIÈREMENT à la main du joueur (remplissage par défaut fourni, placement libre) ; la
  clause « part garantie non modifiable » de l'invariant HTML SAUTE. La case reste un
  raccourci : le sort vit au grimoire.
- **L'ÉTAT DE CHARGEMENT VIT SUR L'ARME** (verbatim 2026-08-16 : « On est d accord que
  quand on charge une arme on sélectionne une munition ? Que si j ai 2 armes à distance
  elles gèrent chacune leur propre rechargement et munition ? » — confirmé AskUserQuestion :
  « Sur l'ARME, maintenant ») : les champs `Combatant.ammoUid`/`loaded`/`reloadProgress`/
  `chambered`/`loadedAmmoUid` migrent sur l'instance d'arme DANS le lot 2 ; chaque arme à
  distance gère son rechargement et sa munition ; le changement de set ne téléporte plus
  rien. Le modèle une-arme-à-distance (`types.ts:1588-1590`, commentaire provisoire) meurt.
- **Munitions FACILES depuis la barre** (verbatim) : « on doit pouvoir choisir ses munitions
  avec nos armes de tir facilement depuis sa barre d'action » — le choix de munition est une
  affordance DIRECTE de la travée gauche, adossée à l'arme de tir.
  ⚠ ARBITRAGE 2026-08-16 (AskUserQuestion) : « La munition se fixe au CHARGEMENT » — le
  modèle actuel (choix consommé au TIR, bascule gratuite sur arme chargée,
  `battleSelectAmmo`/`selectedAmmo`) est un contournement à MIGRER : changer de munition sur
  une arme chargée = re-recharger (coût RAW du rechargement). Dette moteur au §6.
- **La spec dix-zones a ÉTÉ REFUSÉE** (verbatim : « N'oublie pas que cette spec a été
  refusé et ca a amené a l'invariant. ») — les propositions « Chez nous » de l'analyse RT
  qui l'alimentaient ne sont PAS des acquis : chaque point se re-valide (cf. §4, matière RT).
- **Bascule de console / médaillons hors tour : REFUSÉE** (verbatim : « C'est quoi cette
  merde ? Je l'ai deja refusé cette interface qui n'a pas lieu d'etre ») — hors tour, la
  console est en LECTURE simple ; la défense (Parade/Esquive, arme de parade,
  Porte-Bouclier, Détermination) vit dans la FENÊTRE DE JET, comme aujourd'hui.
- **Le bannissement des listes vise LA BARRE D'ACTION seulement** (verbatim : « Je le
  banissait sur la barre d'action, ca ne me dérange pas de pouvoir faire des actions depuis
  l'inventaire ou le grimoire ») — le grimoire peut LANCER (et placer) ; l'inventaire aussi.
- **Travée gauche : COMPTE FIXE aussi** (AskUserQuestion) — une seule loi de géométrie pour
  toute la console ; dimension à poser en spec sur les cardinaux mesurés (~6-8).

---

## 2. Invariant V2 — les quatre lois amendées

### Loi 1 — Une donnée, un propriétaire ; des porteurs déclarés (TIENT au juge)

Inchangée sur le fond (sonde 5 : la jauge passe partout par `PortraitTile.tsx:87-95`, la barre
flottante par le peintre unique `TokenChromeMarks`, le cartouche par `InspectPanel.tsx:42`).
Périmètre : HUD DE COMBAT (les 3 surfaces hors combat — `CharacterSheet.tsx:193`,
`PossessionsRegistry.tsx:126`, `PossessionsScreen.tsx:283` — composent la même `LifeBar`,
légitimes, hors loi). Amendements de table :
- « Ce que le geste coûte et risque » : porteur DÉCLARÉ = `MovementIntent` (dock) en plus du
  curseur et du cartouche de cible (le juge l'a trouvé hors invariant).
- « Ordre du tour, préemption » : la frise PORTE deux décisions de pause — l'insertion par
  Chance (rang LIBRE, dette #1332) et l'armement du Tir rapide. Décisions déclarées, la
  propriété ne bouge pas.
- « Remède d'un État » : propriétaire = la pastille de l'État (`StateChips`), voir arbitrage.
- « L'exhaustif des sorts » : propriétaire = le GRIMOIRE (colonne d'outils) ; les alvéoles
  épinglées sont des RENVOIS.

### Loi 2 V2 — LA CONSOLE : deux travées, grille fixe, jamais de liste

Remplace « l'empreinte ne bouge jamais ; le catalogue se pagine par onglets ».

- **Deux travées SIMULTANÉES** : gauche = matériel (consommables, commutateur de sets +
  munitions, gestes de l'arme au poing) ; droite = grille de capacités du personnage.
  Fin du tour = coin ISOLÉ (arche RT), jamais dans une travée.
- **Grille de capacités : ~12 alvéoles FIXES** (l'analyse RT le propose elle-même :
  « le vocabulaire d'actions WFRP étant fini et court, douze alvéoles fixes suffisent : une
  action illégale se grise, elle ne disparaît jamais », `Analyse…dc.html:127`). Cases vides
  DESSINÉES ; touche imprimée DANS la case ; coût en crans sur le bord ; teinte par famille.
  Vérifié : le pire porteur d'actions PROPRES tient (Frère Anselm 6 bénédictions ; les 211
  sorts passent par grimoire+épinglés).
- **Conduit d'Avantage** branché sur la grille (10 colliers = plafond RAW, plaque chiffrée,
  reflux visible à l'effondrement) — l'Avantage se dépense DANS la grille, il y est adossé.
- **Géométrie immuable** : position et hauteur fixes, aucun élément n'apparaît/disparaît en
  déplaçant les autres. Compte de cases FIXE sur LES DEUX travées (arbitrage 2026-08-16).
  Le compte visible s'adapte au VIEWPORT, jamais à l'état de jeu — et à 360px, 2 rangées de
  6 à gap 4 tiennent SANS scroll (mesure juge V2) : le débord-qui-défile actuel
  (`overflow-x:auto`, `combat-ui.css:723`) est le défaut à tuer.
- **JAMAIS de bouton-liste** dans le champ de décision. Un panneau contextuel NAÎT de son
  alvéole (RT : « les panneaux naissent de leur déclencheur »), uniquement pour un CHOIX DE
  PARAMÈTRE (munition, localisation), jamais pour un catalogue d'actions.
- **Barre de raccourcis PLACÉE PAR LE JOUEUR** (arbitrage : « on place nous mêmes nos sorts
  et capacités ») : remplissage PAR DÉFAUT fourni, placement entièrement libre ensuite ; une
  case = un RACCOURCI (le sort reste au grimoire, la manœuvre sur sa travée) ; persistance
  PAR PERSONNAGE, sur le PORTEUR lui-même (`Combatant.barre` — donnée de save qui voyage avec
  lui, champ optionnel donc sans bump ; `SAVE_VERSION = 27`, la mention « v12 » était fausse ;
  `saveId` n'existe pas et aucune clé de partie n'est requise, voir spec zone 9).
- **Hors tour : la console est en LECTURE, sans surface de décision nouvelle.** La bascule
  en médaillons proposée par l'analyse RT est REFUSÉE par l'utilisateur (« cette interface
  qui n'a pas lieu d'etre », 2026-08-16 — déjà refusée dans la lignée de la spec) : la
  défense reste dans la fenêtre de jet (loi 1 : « le choix pendant un jet = la fenêtre de
  jet »), et AUCUN rail d'attente n'est superposé.

### Loi 3 — Le vocabulaire est celui de la charte (TIENT)

Inchangée : traductions imposées (alvéole → `.chip`/primitive, rack d'États → `StateChips
reserve`, plaque → `.panel`, glyphes → `<Icon>`, hex → tokens `:root`, « +2 DR » → langage
joueur). Clause de coût : N porteurs = N recettes ; token nouveau = amendement `:root`
assumé ; cliquets décroissants. Seuil ADOPTÉ en défaut d'ingénierie (>3 porteurs touchés =
chantier à part en ticket) — révisable, PAS entériné utilisateur.

### Loi 4 V2 — Toute phase déclare sa décision et sa surface (liste COMPLÉTÉE)

Clauses a/b/c inchangées (le ready-check coop reste la surface propre légitime de la clause c
corrigée). ÉTATS COUVERTS — le juge a mesuré les manquants, la liste est close :
notre tour · ouverture du combat · pause de début de Round (frise JOUABLE : insertion Chance
+ armement Tir rapide ; le ready-check coop s'y niche À CHAQUE Round, pas qu'à l'ouverture —
`ActionBar.tsx:131-165`) · interlude de ciblage (`ActionBar.tsx:187-245`) · tour adverse
(console en mode lecture) · tour d'un AUTRE joueur (coop, lecture + qui joue) · **tour d'un
héros en Auto-combat** (`.ab-enemy`, l.699 — lecture) · **tour du NAVIRE** (barre exclusive
`isShip` l.448-471 : c'est une PHASE, pas un onglet Contexte) · **combat fini**
(`battle.over` → l.127, la console disparaît — transition déclarée).

### Clause clavier V2 (remplace « Maj+1-9 »)

Table d'intentions SANS modificateur (`KeyBinding` inchangé, overrides persistés intacts).
`1-9` = emplacements de console ; la touche est attachée à l'ID D'ACTION (mapping id→touche),
plus jamais au rang (`hotbar.slots[i]` meurt — C2). Défilement du débord : flèches (`Tabs`/
`rovingKeyDown` existants) ou touche libre. Badge `.ab-key` = la touche RÉELLE de l'action.

---

## 3. Boutons d'intention → portée visible (grounding mesuré)

Sémantique actuelle (`ActionBar.tsx:283`, `store.ts:192-193`) : déplacement/attaque/charge/
course sont IMPLICITES au clic (tap-1 aperçu, tap-2 commit) ; la Charge n'est jamais un choix
— c'est le fallback géométrique d'`attackPlan` (`combatFlow.ts:1467-1524`), et sa portée M×2
n'est JAMAIS affichée (calculée au clic pour UNE cible, `combatFlow.ts:1513-1517`). Marche et
Course nominale (M×3) sont déjà des overlays permanents (`computeRunReach`,
`combatFlow.ts:1364-1388` ; `builders/highlights.ts:58-80`).

**Patron canonique à généraliser — il existe en UN exemplaire** : `battlePushEngine`
(`combatSlice.ts:1597-1616`) = bouton → `battle.action` + `battle.reachable` précalculé →
rendu par le même chemin que la Marche. Registre unifié `TargetingMode`
(`targetingModes.ts:101-117`) déjà consommé par tous les modes (cast, soin, zone, empoignade,
bordée…).

Manques mesurés (câblage UI/state uniquement — AUCUN manque de vocabulaire moteur) :
1. Modes `charge`/`course`/`attaque` absents du registre `TargetingMode`.
2. `chargeReach` : extraire le calcul M×2 d'`attackPlan` en fonction pure (parallèle à
   `computeRunReach`) précalculable avant tout clic.
3. `HighlightEl` n'a pas de 3ᵉ portée (`kind: 'walk'|'run'|…`, `builders/highlights.ts:20-26`).
4. Aucun bouton d'intention dans la barre (le seul précédent : `pushEngine`).
5. `selectedAttack` (`store.ts:200-202`) arme une attaque sans piloter d'overlay de portée.

Les gestes par défaut du champ restent INCHANGÉS (arbitrage 2) : le bouton AJOUTE un mode
volontaire avec portée visible, le clic direct continue de tout faire.

---

## 4. Catalogue exhaustif → adresses (base de la spec)

Inventaire mesuré : 35 sites `slots.push` (29 héros + 6 navire, sonde 2), 6 tiroirs
`.ab-spells`, options de modale (`useAttackJetProps.tsx`), modes de ciblage, gestes implicites.
La spec doit adresser CHAQUE ligne ; contrat hérité : aucune action légale ne disparaît.

| Élément (id/site actuel) | Adresse V2 |
|---|---|
| Attaque de l'arme (`arme` d'`availableAttacks`) | Travée GAUCHE (+ mode d'intention → portée d'allonge) |
| `aim` (Viser, déjà slot direct) | Travée GAUCHE |
| `reload`, `pushback` (Perturbante), `ammo` | GAUCHE ; munitions = affordance DIRECTE et FACILE de la barre, adossée à l'arme de tir — MAIS la munition se FIXE AU CHARGEMENT (arbitrage 2026-08-16) : en changer sur une arme chargée engage un rechargement ; migration moteur au §6 |
| « Tirer sans bouger » (`heldGround`, modale `useAttackJetProps.tsx:242-255`, LDB 14 l.101) | PROMU alvéole GAUCHE (toggle d'intention pré-jet) |
| « Tirer dans le tas » (`intoCrowd`, `:230-241`, LDB 14 l.136/146 — pilote déjà les anneaux) | PROMU alvéole GAUCHE (toggle) |
| Empoignade (`grapple`, modale `:96`, mains nues, LDB 14 l.159, `grapple.json`) | GAUCHE (mains nues = un set d'armes) |
| Charge (implicite, jamais un choix) | GAUCHE — bouton d'intention → `chargeReach` visible (§3) ; le clic direct reste |
| Consommables `item-*` + Soin (`heal`, mode de ciblage existant) + `water` (Asperger d'eau, `ActionBar.tsx:412` — réintégré par le juge V2, il manquait au catalogue) | GAUCHE (Soin et Asperger adjacents aux consommables — arbitrage 1) |
| Commutateur de sets (`ActionBar.tsx:659-683` — ⚠ 4 `style={{…}}` en dur à purger, le 4ᵉ au tiroir munitions `:568`) | GAUCHE, pièce structurante |
| Mouvement / Course (implicites ; Course = Test Athlétisme, `resolveRun`, portée M×3 déjà peinte) | DROITE — boutons d'intention (Course : « faire le jet et connaitre la vrai distance ») |
| `advantage` (tiroir → Compétences dédupliquées, petit cardinal) | DROITE — une alvéole PAR Compétence d'Avantage |
| `defend`, `disengage`, `battement`, `distraire`, `frenzy`, `aid-team` | DROITE (alvéoles directes) |
| Attaques de trait/naturelles (`availableAttacks` 1-3 : Morsure/Griffe/Caudale/Souffle/Piétinement/Tentacule…) | DROITE — arbitrage user 2026-08-16 : « C'est des actions liés aux avantages principalement » (mesuré : gates/coûts en Avantage, `combatManeuvers.ts:233-245`) → adossées au CONDUIT D'AVANTAGE branché sur la grille (RT : « l'Avantage se dépense DANS la grille »), coût en crans ; l'attaque d'ARME (à l'Action) reste à GAUCHE |
| `self-*` (manœuvres sur soi) | DROITE |
| Sorts / bénédictions / miracles | PLACÉS PAR LE JOUEUR en alvéoles DROITE (défaut fourni) + GRIMOIRE (colonne d'outils) — arbitrage fermé |
| `dispel` (tiroir → sorts permanents en scène) | DROITE (alvéole) → mode de CIBLAGE (cliquer le sort/porteur), pas une liste |
| `resolve` (Détermination : 3 usages RAW — immunité Psychologie / ignorer modifs de Blessure critique / retirer un État, `docs/raw/destin.md` LDB 17 l.57-63) | ALVÉOLE DROITE = PROPRIÉTAIRE UNIQUE des 3 usages, gate `resolve > 0` (le gate actuel `removableConditions.length > 0` est un BUG VIVANT — 2 usages inatteignables sans État, juge V2 ; correctif immédiat) ; les pastilles d'État portent le RACCOURCI « retirer cet État » (porteuses, jamais propriétaires) |
| `roll-fire`, `free-entangle`, `stand` | PASTILLE de l'État (arbitrage fermé) |
| `pickup-*` (objets au sol) | LE CHAMP : pastille ⓘ sur l'objet (RT « objet interactif ») — plus jamais un slot |
| `undo-move` | Chrome du dock, adossé à la jauge de Mouvement (`ActiveFrame`) — pas une alvéole |
| `end-turn` | Coin de fin de tour ISOLÉ + garde-fou « Action intacte » (RT, plaque qui change d'état) |
| `raise-hand` (coop) | Phase pause de Round (frise/ready-check), pas la console |
| `mount`/`dismount`, `man-poste`/`leave-poste`, `push-engine`, `maneuver-ship` (héros) | GAUCHE zone contexte OU phase — à trancher en spec par cas (exclusions mutuelles mesurées) |
| Barre navire (6 ids `isShip`) | PHASE « tour du navire » (loi 4 V2) |
| Chance / Résilience / Destin / Parade / Esquive | FENÊTRE DE JET uniquement (« on ne dépense pas son Destin par réflexe ») — y compris HORS TOUR (bascule/médaillons REFUSÉS, arbitrage §1) |
| Options restant en modale (localisation de critique, retenue, harpon…) | FENÊTRE DE JET — inventaire complet des `attackSetXxx` à faire en spec |
| Commandes carte (rotation/grille/zoom/inspection) + journal + grimoire | COLONNE D'OUTILS (RT) ; le menu système hors rail |

Matière RT — ⚠ PROPOSITIONS de l'analyse, PAS des acquis (la spec dix-zones qui en découlait
a été REFUSÉE ; la bascule/médaillons en est déjà tombée) : chaque point se RE-VALIDE en
spec, un par un — curseur porteur du coût ET du palier de Difficulté ; prévision de jet sur
la cible (cible du jet + palier + la Réaction encore disponible de la cible — sans elle le
chiffre MENT) ; prévision de zone par créature (badge par cible, jamais un total) ;
infobulle = contrat de jet AVANT le geste ; plaquette de conséquence « ✓ +2 DR · Bras
gauche · 5 Blessures » ; États chiffrés en cellules réservées ; silhouettes de menace
(≠ Caché compétence) ; défauts à ne pas reconduire (boutons-vitrine, boutons sur la carte,
sur-affichage).

---

## 5. Verdicts de cérémonie (traçabilité)

- Sondes 1-5 : toutes exécutées (épinglage `0b317fda` ; cardinal hotbar 2-6 ordinaire / 19
  extrême / 35 ids ; clavier `Maj+1-9` arrive intact MAIS l'instrument CDP ne voit pas la
  couche chrome — bannissement Ctrl/Alt = précaution documentée ; RAW Chance confirmé →
  #1332 ; porteurs PB clos en combat).
- Juge avec shell : loi 1 TIENT, loi 4c TIENT, loi 3 TIENT ; onglets permanents / règle
  « mains nues » / Maj+1-9 / empreinte-en-cases RÉFUTÉS sur mesures → fermés par les
  arbitrages du §1.
- Constats : C6 INFIRMÉ (`StateChips` plafonne déjà à 4 + débord, `StateChips.tsx:21-23`) ;
  C9 re-ancré l.2581 ; réf Tir rapide : la juste est **LDB 11 l.97-103** (chapitre vérifié au
  Source), sites faux `keybindings.ts:76,122`.
- Cardinal lanceurs : le « pire = 6 bénédictions » du lecteur ne mesurait que les pré-tirés —
  pire RÉEL = 211 sorts (scénario de magie), périmètre corrigé par l'utilisateur.

## 5bis. Juge V2 (2026-08-16, arbre 73335576) — amendements actés

- **A1/A4 — CADUQUES** : la bascule de console + médaillons hors tour est REFUSÉE par
  l'utilisateur (arbitrage §1) — hors tour = lecture, défense en fenêtre de jet.
- **A3** : la prémisse « 5 max à 360px » TOMBE — à gap 4, **2 rangées de 6 = 12 alvéoles
  tiennent sans scroll** à 360px. Le vrai défaut à tuer : le débord actuel DÉFILE
  (`overflow-x:auto`, `combat-ui.css:723`) — une case qui bouge sous le pouce viole
  l'arbitrage 3 bien plus que la taille.
- **B1** : la bascule de munition est gratuite dans le CODE (`battleSelectAmmo`,
  `combatSlice.ts:2056-2065`) mais le RAW est MUET (le choix se fait au tir chez nous) —
  c'est un ARBITRAGE MAISON à entériner, pas un fait RAW (→ question utilisateur).
- **B2** : Détermination = bug vivant (gate `ActionBar.tsx:333/444`) → correctif immédiat
  hors refonte : gate `resolve > 0`, contrat POSITIF « héros sans État, Détermination > 0 →
  immunité psy et ignore-crit atteignables ». Le test `determination-psych.test.ts:74-98`
  est un test de câblage qui masque l'inaccessibilité (poison signalé).
- **B4** : CLOS par arbitrage user postérieur au brief du juge (« C'est des actions liés aux
  avantages principalement ») → droite, adossées au conduit.
- **B5** : compte réel = **38 sites** `slots.push` (32 héros + 6 navire) ; `water`
  réintégré au catalogue.
- **B13** : grief a11y des tiroirs reformulé — de vrais `<button>` mais AUCUN conteneur
  `role`/roving ; ne pas fonder la refonte sur un fait faux.
- **D** : les toggles `heldGround`/`intoCrowd` ne sont PAS des capacités RT (valeur
  dépendante de la cible, note d'arbitrage à deux branches impossible en 52px) → la barre
  porte une INTENTION DE POSTURE sans valeur (« Tir immobile », coût affiché = Mouvement) ;
  la fenêtre de jet reste propriétaire du paramètre chiffré. Satisfait le verbatim
  (« un bouton pour tirer sans bouger ») sans double porteur menteur.
- **C** : 6ᵉ manque du patron d'intention — COOP : chez un invité, `battleSelectAction`
  passe par les intents réseau (`net/intents.ts:30`, `netFlow.ts:155-167`) → décider en
  spec si un mode d'intention est LOCAL (préférence d'affichage) ou PARTAGÉ. 7ᵉ :
  l'annulation (Échap + toggle) se généralise dans le patron, pas par mode.
- **Angles morts actés → décisions de spec** : E1 géométrie de la travée GAUCHE (→ question
  utilisateur : compte fixe ?), E2 arbitrage dock/console (`undo-move` + raccourcis d'État
  sur `ActiveFrame` — qui arbitre), E3 héros embarqué vs phase navire (à instruire, pas
  « par cas »), E4 clé de persistance de la barre (heroId seul instable — (saveId, heroId) ?).
- ⚠ `StateChips` porte déjà une sémantique de clic (`CodexRef`) et un arbitrage user
  2026-07-18 (« une pastille sans règle résolue reste nue ») — le raccourci d'État se
  spécifie comme affordance DISTINCTE sur la chip (zone/geste dédié), sur les seules
  surfaces de combat, jamais un détournement du clic Codex.

## 6. Dettes ouvertes / à solder dans le chantier

- **#1332** — Chance de début de Round : rang LIBRE sur la frise (la pause devient jouable).
- Réfs `LDB 10` → `LDB 11 l.97-103` (`keybindings.ts:76,122`) + `npm run raw:implemente` au
  même commit (règle stricte 1).
- Style en dur du commutateur de sets + tiroir munitions (4 `style={{…}}`, compte juge-de-spec) — purge dans le geste.
- Réfs du design 2026-07-31 (CSS ×10, 1 test, `CampaignView.tsx:224`) : migrer puis supprimer
  le doc. Jamais de demi-migration.
- Le tiroir `.ab-spells` disparaît AVEC son patron (grief a11y exact : conteneurs sans
  `role`/roving — les boutons eux-mêmes sont de vrais `<button>`).
- **Munition fixée au CHARGEMENT** (arbitrage 2026-08-16) : migrer `selectedAmmo`/
  `consumeAmmo` (choix au TIR aujourd'hui, `combatFlow.ts:2367`) vers un choix lié au
  rechargement ; en changer sur une arme chargée = re-recharger. UI barre : le choix reste
  facile et direct (arbitrage §1).
- **Correctif Détermination LIVRÉ en cours de cérémonie** (bug vivant juge V2) : gate slot
  `resolve > 0` + 4 contrats DOM (`src/ui/determination-reachability.test.tsx`) ; extension
  en vol : même classe dans `turnEconomy.ts:34` (`hasMeaningfulOption`) + ré-ancrage réf
  `combatSlice.ts:2817` (l.62-66 → l.59-61).
- **#1336** — `ignoreCritMods` annule aussi des pénalités de MALADIE (RAW : Blessure
  critique seulement) — frontière à trancher au Source.

## 7. Ordre de travail V2

1. **Spec des zones sur base Invariant V2** (ce doc) — chaque zone = une adresse (primitive,
   props), catalogue §4 intégralement adressé ; inventaire complet des `attackSetXxx` ;
   Détermination re-vérifiée au RAW (LDB 17 l.59-61). Passe de juge sur la spec AVANT code.
2. **Lot clavier** : touche par ID d'action (tue C2), badge réel, réfs LDB 11 corrigées +
   regen `Implemente`. Autonome, préalable à tout.
3. **Lot console** : structure deux travées + grille fixe + coin fin de tour + conduit
   d'Avantage ; purge `.ab-spells` ; épinglage (préférence locale par personnage) ; grimoire.
4. **Lot intentions** : modes `charge`/`course`/`attaque` + `chargeReach` pur + 3ᵉ kind de
   highlight + boutons (patron `pushEngine` généralisé).
5. **Lot pastilles** : remèdes d'État sur `StateChips` + `GatedAction` (−4 ids).
6. **Lot phases** : console basculée (lecture/médaillons de Réaction), pause de Round jouable
   (frise : insertion Chance #1332 + armement Tir rapide), navire = phase, combat fini.
7. **Solde** : migration des réfs 2026-07-31 + suppression des deux docs plans (celui-ci
   compris) ; recettes navigateur par lot (une par porteur touché) + juges VISION.
