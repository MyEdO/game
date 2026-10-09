# Spec HUD de combat — zones et adresses (sur Invariant V2) — RÉVISION 2 post-juge

Ticket: #1348

> Plan daté, à supprimer une fois exécuté. BASE : `docs/plans/2026-08-16-hud-combat.md`
> (Invariant V2). Toute contradiction avec les arbitrages §1 se résout POUR le §1.
> RÉVISION 2 (2026-08-16) : les corrections b1/b3 du juge-de-spec sont INTÉGRÉES ; les
> Les 4 décisions b2 sont TRANCHÉES (AskUserQuestion 2026-08-16, toutes sur la
> recommandation) : gauche déduite du set · touche = CASE · console lecture + bandeau ·
> écran de capacités. La spec est PRÊTE À BRIEFER.
> Sondes du juge à PROMOUVOIR en tests au premier lot concerné : (i) co-occurrence G6
> (`fleau-d-armes`+`lance-harpon` → 2 gestes disponibles ensemble, prouvé) ; (ii) charge de
> grille par pré-tiré (Anselm = 14 capacités non-sort candidates > 12 cases) ; (iii) débord
> `StateChips` qui masque un remède (`en-flammes` 5ᵉ chip → « Se rouler » invisible).

---

## Zone 1 — LA CONSOLE (dock bas)

Une seule surface, géométrie IMMUABLE (position, hauteur, comptes de cases fixes).
Remplace l'actuel `.action-bar`/`.ab-bar` recomposé par condition. ⚠ Géométrie mobile À
MESURER au lot console : à 360px, une rangée de 8×52+7×4 = 444px > 336px utiles — la travée
gauche se plie en 2×4.
✅ BUDGET DE HAUTEUR — CONTRAT (arbitrage user 2026-08-17, capture à ~1998px, verbatim :
« avoir 1/4 de l'interface qui est une barre d'action, ça ne va pas etre possible, surtout
avec tout ce vide et ces icones disproportionnés ») : mesuré chez lui ~28-29 % de viewport
là où LA PLANCHE budgétise **20,1 %** (pont 217px / 1080). Contrats :
- **Hauteur du pont ≤ ~21 % du viewport à ≥1280** (le ratio de la planche), garde promue
  (mesure en recette à chaque largeur ; le budget mobile ≤560 reste celui de l'arbitrage
  compact ~40-45 %).
- **Cases PAYSAGE à l'échelle de la planche** (~90×66 à 1920, plus larges que hautes —
  jamais des carrés de 84px) ; les plafonds de `--cc-cell` se recalent en conséquence.
- **Icône PROPORTIONNELLE à sa case** (≈ moitié de la hauteur utile, jamais une taille
  figée en px qui rend une vignette de 22px dans une case de 84).
- Le VIDE se paie au prix des cases : les LIBRE suivent la même échelle — la densité
  augmente encore quand les défauts de remplissage (§1b) peupleront la grille.
- COMPLÉMENT (user 2026-08-17, verbatim : « il y a encore enormement de vide je trouve
  sous les barres d action et au dessus du portrait dans l arche ») — **le vide INTERNE se
  comprime à budget constant** : (a) la BANDE MORTE sous les travées disparaît — la
  rangée munition quitte son bandeau réservé, la munition chargée vit dans l'EN-TÊTE de
  travée à côté du nom du set (« ARBALÈTE · Carreau ×12 » — l'en-tête existe déjà, la
  hauteur du pont ne réserve plus ces ~12px+bande) ; (b) le FAÎTE de l'arche se serre et
  le PORTRAIT remplit l'arche à l'échelle de la planche (chez elle le portrait domine la
  région — chez nous il flotte petit sous un sommet creux).
✅ MAQUETTE MESURÉE (2026-08-16, worktree `agent-ac9da5df07ad973dd` = BRANCHE DE BASE du
lot console — composant réel `CombatConsole.tsx` + `combat-console.css`, monté sur le store,
captures + DOM) : **1280×800 TIENT** (console 185px = 23 % du viewport, zéro débordement,
géométrie immuable PROUVÉE — 8/12 cases constantes entre la sorcière 211 sorts et un tireur
nu) ; **360×640 : 69 %** (442px) — le budget ~40 % explose en portrait.
✅ MATIÈRE VISUELLE (2026-08-16) : l'ébauche de maquettes est récupérée (artefact
« Maquettes UI Warhammer Fantasy Web », auto-contenu, se rend au navigateur ;
11 captures au scratchpad de session). ⚠ STATUT
(verbatim user : « cette maquette a été faite avant l'invariant ») : c'est la MATIÈRE de
départ — plaques acier/laiton, gouttières, conduit, plaquettes, cartouche de cible — PAS la
cible de conformité. La STRUCTURE vient de cette spec ; toute divergence se résout POUR
l'invariant (zone J refusée ; clavier lettres/F1-F4 remplacé par touche=case ; « Se
cacher » sans moteur — dette à trancher avant toute case ; G6 → pastilles d'entité). La
CIBLE visuelle du lot console = **LA PLANCHE USER du 2026-08-17** (bloc ✅ PLANCHE du §1c-bis),
reproduite sur le worktree, VALIDÉE PAR L'UTILISATEUR avant tout commit d'écran.
✅ ARBITRAGE mobile (AskUserQuestion 2026-08-16) : **composition COMPACTE dédiée à ≤560px**,
sans rien perdre — arche réduite à une ligne (portrait mini + jauges fines), conduit fondu
dans le bord de la grille, commutateur replié sur l'icône du set actif, coin intégré —
cible ~40-45 % (~280px), à re-mesurer sur la même maquette.
⚠ RÈGLES DE COMPOSITION MOBILE (montée d'altitude après 3 passes vision sur la même classe
— l'écrêtage ne se corrige plus au CSS, il s'interdit par RÈGLE) :
- **R-M1 Bandeau = le GROUPE seul** (loi 1 : « bandeau du groupe ») — jamais les ennemis
  (l'ordre du tour appartient à la frise). À ≤560px : tuiles PLEINES à largeur minimale
  digne (portrait reconnaissable + PV lisibles, ≥44px) ; si ça ne tient pas, DÉFILEMENT à
  tuiles pleines — jamais des tranches. Le pire cas mesuré (13 tuiles à 22,7px) était un
  bug de contenu ET de forme.
- **R-M2 Aucun mot tranché, nulle part** : un libellé se rend en entier, ou s'ellipse à la
  FRONTIÈRE DE MOT (une ligne + `title`), ou coupe entre mots (2 lignes max) — jamais
  `overflow-wrap:anywhere` sur du texte de libellé. S'applique aussi aux noms du bandeau
  À 1280 (13/13 ellipsés = défaut : la tuile se dimensionne pour son contenu type).
- **R-M3 Tout élément rendu est ENTIER** : une rangée qui ne tient pas ne se tronque pas —
  la géométrie se recalcule (garde de recette : sonde pixel bord-bas, promue).
- **R-M4 L'épinglage d'une capture = un HASH GIT RÉEL** : HEAD du worktree + marqueur
  dirty/hash du diff (`git stash create` ou hash de `git diff | sha1`), vérifiable par
  `git cat-file` — le filigrane « arbre 3844e9be » de la V3 n'était pas un objet git.
Écarts maquette → ITEMS du lot console : bandeau de phase à couvrir AUSSI pour les
interludes (`pendingCleave`/`pendingDualStrike`/`pickingTargets`/`battery`) ; fin de tour
gatée sur le même prédicat que le store (`combatBusy`/cascade) avec sa RAISON (`GatedAction`)
— aujourd'hui clic muet ; pont clavier de console (l'actuel `hotbarBridge` meurt avec
`ActionBar`) ; purge d'`ActionBar` + knip ; dé-tripler l'Avantage (le conduit REMPLACE les
2 rendus d'`ActiveFrame`) ; touches des cases 9-12 à régler au volet clavier (1-8 posées).
Griefs VISION (juge sur écrans réels du lot munitions, 2026-08-16 — contrastes MESURÉS) →
ITEMS du lot console : slot désactivé ILLISIBLE (« Recharger » 2,94:1 vs 12,33:1 pour ses
voisins — le style disabled des slots passe sous AA) et indisponibilité MUETTE (la raison
n'est qu'en title — patron `GatedAction` exigé par la charte) ; statut « chargée » porté
par la COULEUR SEULE (rangée rouge danger `#8F271B`, aucun mot — a11y daltoniens) et le
slot « Munition ▾ » ne dit pas SA valeur chargée ; tiroir NON ANCRÉ à son slot (démarre
670px à gauche du déclencheur — RT : « les panneaux naissent de leur déclencheur ») ;
DEUX idiomes pour le même choix (rangées colorées au HUD vs `<select>` en fiche) ; onglets
de postes HOMONYMES (« Tribord Pierrier 1 » ×2) ; libellé de munition opaque (« pour 1
tir ×10 ») ; l'arme du tireur ne dit ni son état déchargé ni sa munition sur la barre
(l'info n'existe qu'au naval). Méthode : toute capture de recette s'accompagne du HASH de
l'arbre qui l'a produite (grief d'épinglage du juge vision — il n'a pas pu identifier le
worktree).

### 1a. Travée GAUCHE — l'arsenal et le nécessaire (compte FIXE : 8 cases, 2×4 à 360px)

✅ TRANCHÉ (2026-08-16) : G1-G6 sont DÉDUITES du set au poing (changer de set change la
travée — c'est sa logique) ; le placement joueur vaut pour la grille + les cases objets.
« Entièrement à la main » visait les sorts/capacités, pas l'arsenal.

| Case | Contenu | Mécanisme |
|---|---|---|
| G1 | ✅ RÉVISÉ 2026-08-17 (demande user verbatim : « si on a 2 armes, genre une pistolet et une dague ou deux dague, on doit pouvoir attaquer avec au choix le pistolet ou la dague (bien sur il y a le malus de la main directrice) depuis un des boutons d'actions ») : **UNE CASE D'ATTAQUE PAR ARME DU SET** — set à 2 armes = 2 cases, chacune arme SON attaque (`weaponUid` porté par le flux, couture `attackSetWeapon` existante) ; la case de la MAIN SECONDAIRE affiche son **−20** (RAW LDB 14 l.138-139 : « Vous pouvez utiliser n'importe quelle main pour effectuer une attaque. Les attaques effectuées avec votre main secondaire subissent une pénalité de -20 sur tous les Tests applicables » ; armes admises à deux armes : « n'importe quelle arme de combat rapproché à une main ou n'importe quel pistolet » l.138) ; attaquer avec LES DEUX dans le Round reste le talent Maniement de deux armes (l.140, `attackSetDualMode` en modale, zone 5). Bouton d'intention (mode `attaque`) ; clic-ennemi direct inchangé | alvéole ×2 + `TargetingMode 'attaque'` |
| G2 | Charge — bouton d'intention (mode `charge`, `chargeReach` M×2 dans la bande Course) | alvéole + patron `pushEngine` |
| G3 | Viser (existant) | alvéole |
| G4 | Recharger + progression | alvéole |
| G5 | **Postures de tir** « Tir immobile » / « Dans le tas » — SEUL ACCÈS (verbatim « plutôt qu'une option dans la modale ») : la fenêtre de jet AFFICHE la posture armée et sa valeur calculée (lecture seule), elle ne porte plus le contrôle. ⚠ Les setters `attackSet*` sont des NO-OP sans `pendingAttack` (`combatSlice.ts:2210-2219`, `if (!pa) return`) → NOUVEAU champ de POSTURE PRÉ-ARMÉE (sur `battle` côté hôte, posé par intent — c'est un choix de JEU, pas d'affichage), consommé à la construction du `PendingAttack` (`combatFlow.ts:367`), remis à zéro au tir/fin de tour | alvéoles-toggle + champ `battle.stances` + intent |
| G6-G6bis | ✅ TRANCHÉ (matrice mesurée + AskUserQuestion 2026-08-16) : max prouvé = 5 gestes simultanés → **les gestes ouverts par une ENTITÉ adjacente sortent de la barre** : Monter → pastille sur la MONTURE, Servir la pièce / Pousser l'engin → pastille sur la PIÈCE (patron pastille-ⓘ, zone 4). La barre garde **2 cases fixes** : G6 = geste d'ARME (Repousser — jauge d'ARSENAL standing, `canPushback` sur `active.weapons`) ; G6bis = geste d'ÉTAT du héros (Quitter la pièce / Descendre / Manœuvrer le navire — résiduel mesuré ~2, priorité rare affichée, tous atteignables au focus). ⚠ CORRIGÉ 2026-08-17 (question user « empoignade ce n est pas une action à main nue ? », RAW re-vérifié) : **l'Empoignade N'EST PAS un geste d'arme** — LDB 14 l.155 : « Un Test de Corps à corps (Bagarre) réussi pour un combat **à mains nues** […] vous pouvez prendre part à une Empoignade ! », déclarée AVANT le jet (l.159) ; le gate moteur réel l'impose déjà (`useAttackJetProps.tsx:96` `canGrapple = melee && isUnarmed`). La case-maquette « Empoigner » en fallback de `canPush` (worktree `CombatConsole.tsx:260-263`, non branchée) est FAUSSE deux fois (déduite de l'arme, affichée armé) → elle DISPARAÎT ; l'option Empoignade reste dans la modale d'attaque à mains nues (zone 5), et une posture pré-armée n'est envisageable QUE set mains nues. Sonde `g6-sonde.ts` promue en test au lot | matrice consignée |
| G7 | ✅ FUSION ACTÉE PAR LA MAQUETTE (la travée écrite faisait 9 cases pour 8 annoncées) : Consommables + Soin + Asperger d'eau = **UNE case objets/soin** à placement joueur (débord → inventaire ; le « panneau de débord » reste SUPPRIMÉ, garde anti-liste) | alvéole + `ItemIcon` |

**Sous la travée** : commutateur de sets (⚠ 4 `style={{…}}` en dur à purger — le 4ᵉ est
dans le tiroir munitions `ActionBar.tsx:568`, l'invariant n'en comptait que 3) + choix de
munition adossé à l'arme de tir. Munition FIXÉE AU CHARGEMENT (arbitrage) : le lot
munitions PRÉCÈDE le lot console (b3.20) pour ne jamais exposer une sémantique double.

✅ ARBITRAGE SET STRICT (2026-08-17, question user « l arbalétrier il n est pas à main
nue, il est équipé d une arbalete » puis verbatim : « Proposer main nue par defaut c'est
un peu difficile, sachant que la plupart des gens ont une arme de base, et que certains
armes a distance fonctionnent même en étant engagé avec l'atout pistolet […] donc je
prefere que le joueur change lui même son set ») — **l'attaque passe par les armes du SET
ACTIF uniquement** :
- Le fallback moteur « Mains nues toujours dans `c.weapons` » (`items.ts:661`) SE CORRIGE :
  Mains nues n'est une arme QUE du combattant réellement désarmé (le set sans arme portée).
  ⚠ CORRECTION D'ATTRIBUTION (lot moteur 2026-08-17, Source relu) : la phrase « Les Mains
  nues sont l'arme par défaut de tout combattant désarmé » est une ligne ÉDITORIALE de
  l'Atlas (`combat.md:1157`), ABSENTE du Source — le RAW est MUET sur « qui a les Mains
  nues » ; la décision tient sur le VERBATIM USER de ce bloc, pas sur une règle (l'Atlas
  est à requalifier en note d'édition — dette consignée). Fini le coup de poing
  AUTOMATIQUE de l'arbalétrier au clic-ennemi adjacent (chemin mesuré :
  `pickAttackWeaponList`→`meleeWeaponInRangeList`, `mount.ts:92-148`).
- **AUCUNE proposition automatique de commutation** : le geste illégal est simplement
  refusé avec sa raison ; le joueur commute lui-même (X — `battleSwitchLoadout`, action
  gratuite 1×/round déjà en place, plafond tagué maison).
- **L'Atout d'arme Pistolet reste la voie RAW du tir au contact** : « Vous pouvez utiliser
  cette arme pour attaquer en Combat rapproché » (LDB 62 l.284-285) ; « Il est impossible
  d'effectuer une attaque à distance alors qu'on est *Engagé*, à moins que vous ne
  disposiez d'une arme à distance qui possède le trait d'arme Pistolet » (LDB 14 l.41) —
  le gate moteur du tir Engagé se vérifie/complète au lot, jamais une commutation forcée.

### 1b. Travée DROITE — la grille de capacités (compte FIXE : 12 cases, 2×6)

2×6, gap 4 (332px ≤ 336px utiles à 360px — mesuré). Touche imprimée (zone 8), coût en
crans (⚠ coûts VARIABLES à prévoir : Se désengager gratuit `canFreeDisengage`, Frénésie
`freeFrenzy` — le cran s'affiche selon l'état, la donnée vient des gates existants).
Cases vides dessinées. Placement JOUEUR, remplissage par défaut fourni.

✅ TRANCHÉ (2026-08-16) : plancher non-sort mesuré = 14 candidats > 12 cases → l'exhaustif
des capacités NON posées vit dans l'ÉCRAN DE CAPACITÉS (zone 6 : le grimoire ÉTENDU —
sorts + manœuvres + talents à activation, sections par famille, PLACE et LANCE). La
grille reste 12 ; le panneau-liste reste banni de la barre.

**Défauts de remplissage** : keyés sur des CAPACITÉS MESURABLES (`spells.length`,
`combatAdvantageSkills`, `hasBattement`…, JAMAIS une pseudo-classe — les 9 classes réelles
de `careers.json` ne sont pas l'axe). Donnée : `src/data/console-defaults.json` + schéma
`src/data/schemas/defs/consoleDefaults.ts`, éditable Compendium.

**Conduit d'Avantage** branché sur la grille (10 colliers, plaque chiffrée, reflux).
⚠ Anti-sur-affichage : le conduit REMPLACE les rendus d'Avantage d'`ActiveFrame`
(jauge crantée l.63 + texte l.71) — jamais 3 écritures de la même donnée (défaut RT).

### 1c-bis. CONTRATS DE CONTENU PAR ZONE (arbitrage user 2026-08-17, verbatim : « Le design
ne fonctionnera pas si le contenu n'est pas respecté. Tu as mis l'habillage mais pas le
fonctionnement attendu, donc certaines zones plus beaucoup plus grosse que prévu »)

La V4 posait la peau sur le CONTENU LEGACY des composants — chaque zone rendait le double
de son dessin. Règle : **une zone rend EXACTEMENT la liste de son spécimen, rien d'autre** ;
la taille DÉCOULE du contenu. Listes fermées — la **PLANCHE USER 2026-08-17** (bloc ✅
ci-dessous) fait foi sur la COMPOSITION (zones, géométrie, hiérarchie, ce que chaque zone
MONTRE) ; **son contenu détaillé n'a PAS valeur de règle** (arbitrage user 2026-08-17,
verbatim : « Les icônes proposées n ont pas valeur de règle, cette spec n a pas toute
notre historique ») — icônes (placeholders), listes d'actions, libellés et touches de la
planche sont des SPÉCIMENS illustratifs : le contenu réel reste régi par §1a/§1b, les
arbitrages du programme et les registres du dépôt :

- **ARCHE (D)** — RÉTABLI 2026-08-17 (j'avais INVERSÉ le sens du signalement user : « pas
  de zone visible pour les états » désignait un DÉFAUT des captures — la zone MANQUE — pas
  une correction du dessin ; verbatim de rappel : « Je te dit qu il n y a pas de zone
  d état et c est un défaut dans l arche ») : portrait + NOM + jauge Mouvement en gouttière
  + jauge Action en gouttière, chaque jauge avec sa VALEUR CHIFFRÉE VISIBLE au pied (socle
  franc — planche : « 3 / MOUV. », « 1 / ACTION ») + Blessures chiffrées en barre pleine
  (« 9 / 9 BLESSURES ») + **NICHE D'ÉTATS VISIBLE : COLONNE d'alvéoles réservées au flanc
  DROIT du portrait (cases toujours dessinées, icône + INDICE chiffré par État)**
  (`StateChips reserve`). ⚠ Une gouttière à 0/0 RESTE DESSINÉE (bug ArchGutter
  `max<=0 → null` = violation de la géométrie immuable, à corriger dans la même passe).
  — Interdits : liste texte A/M/Av, Avantage (conduit seul), `MovementIntent`,
  chips d'identité/carrière.
- **BANDEAU (B)** — RÉVISÉ PAR LA PLANCHE 2026-08-17 : par tuile — portrait (initiales) +
  barre PV CHIFFRÉE (« 11/11 ») + **colonne d'alvéoles d'États réservées au flanc du
  portrait (planche : 1 colonne × 3 cases, CHIFFRÉES, vides dessinées — « zéro État ne
  rétrécit pas la carte »)** + **NOM VISIBLE SOUS LA TUILE** (la planche l'affiche en
  permanence — l'interdit « nom au survol » du contrat précédent TOMBE). **Le bandeau ne
  marque PAS l'actif** (arbitrage user 2026-08-17, verbatim : « Je ne suis pas fan du cadre
  blanc en haut, pourquoi il y en a un en combat ? On a déjà ce qu il fait dans
  l initiative a gauche » — l'ordre du tour et l'acteur vivent à la FRISE seule ; le cadre
  blanc de la planche était un spécimen sans valeur de règle). — Interdits : carrière,
  jauges annexes, marqueur d'actif. Tuile petite et DENSE comme le dessin.
- **FRISE (A)** : par entrée — vignette + liseré de camp + (pause : score en débord,
  pointe de préemption, pastille de fin) + regroupement ×N des identiques (planche : ✕ de
  mort, éclair de préemption, « ×3 », actif encadré, « Round I » en tête). C'EST TOUT. —
  Interdits : PV, nom, états (ils vivent au bandeau/à l'arche).
- **TRAVÉE GAUCHE (C)** — COMPOSITION DE LA PLANCHE : **colonne latérale de SETS**
  (3 vignettes verticales : set actif en relief, set distance avec mention d'état
  « déch. », set vide) + **2×3 cases** (rangée haute DÉDUITE du set, rangée basse LIBRE à
  placement joueur, cases vides dessinées « LIBRE » — le CONTENU déduit reste le §1a :
  G1-G7, dont G2 Charge ; le trio de la planche est un spécimen illustratif) + rubrique
  **ACCÈS RAPIDE 2×2** (consommables à compteur ×N —
  planche : Potion ×2 — + cases LIBRES dessinées). En-tête de travée = le set au poing
  (« ÉPÉE + DAGUE »). — Interdits : tout slot legacy non listé au §1a, le débord
  « Capacités N » (l'exhaustif est l'écran de capacités, zone 6).
- **GRILLE (E)** : 12 cases (icône + libellé + touche + crans) + conduit AVANTAGE
  AU-DESSUS (colliers + valeur chiffrée) + **onglets de PAGES I/II/III** (planche —
  fonctionnement annoté : II = épinglages joueur, III éteinte tant qu'aucun contexte ;
  la géométrie 2×6 est CONSTANTE par page) [pages NON retenues au lot A — annotation de
  planche (cf. l.260), déviation de la référence RT à faire valider à l'écran]. C'EST TOUT.
- **COIN (F)** : icône + libellé (« Fin du tour ») + touche (ESPACE) + ligne d'ÉTAT
  (planche : « Action non dépensée » — l'avertissement garde-fou existant). C'EST TOUT.

### 1c-ter. CONTRAT D'ASSEMBLAGE — LA CONSOLE EST UN OBJET UNIQUE (arbitrage user
2026-08-17, verbatim : « Tu garde le même défaut remonte que la maquette était sensé
mettre en évidence: tes blocs sont tous déconnecté »)

Le défaut que la planche devait mettre en évidence n'est PAS dans les zones — il est
ENTRE elles : l'UI actuelle rend des boîtes flottantes déconnectées, le terrain visible
entre chacune. La planche répond par UN PONT (mesures relevées sur la planche rendue) :

- **UN PONT CONTINU pleine largeur** : bande unique de bord à bord (planche :
  `[0,863,1920,217]`, ~20 % du viewport) avec son LISERÉ HAUT continu (`[0,873,1920,8]`).
  Les travées, les pages, le conduit d'Avantage et le coin Fin du tour sont des RÉGIONS
  du pont — jamais des boîtes soeurs flottantes. **Le terrain n'est JAMAIS visible entre
  deux zones de console.**
- ✅ **MATIÈRE UNIQUE DU PONT** — ARBITRAGE (AskUserQuestion 2026-08-17, verbatim : « une
  matière unique, fidèle à la planche : tout le pont dans la même teinte bronze/bois, les
  régions se distinguent par leurs alvéoles et liserés, pas par des plaques de couleurs
  différentes »).
- **L'ARCHE est le FRONTON du pont** : même matière, continue avec lui, elle S'ÉLÈVE
  au-dessus du bord (planche : arche `[781,811,357,269]`, ~52px au-dessus du liseré) —
  pas un panneau posé devant.
- **Le JOURNAL flotte SUR le terrain** au-dessus du pont, côté gauche, en texte nu
  (planche : `[170,779,330,57]`, aucun cadre) — il n'appartient pas au pont.
- **Chaque zone périphérique est UNE PLAQUE unique** : bandeau = une plaque cadrée
  contenant les tuiles (`[723,10,475,119]`), frise = une plaque (`[0,132,133,472]`),
  rail = une plaque (`[1857,160,63,279]`) — jamais des éléments épars.
- Garde à promouvoir : un élément-pont UNIQUE porte les zones de console (structure), et
  la sonde pixel « aucun pixel de terrain sous le bord haut du pont » passe en recette.

Vérification : à contenu conforme, re-mesurer chaque zone CONTRE la planche assemblée —
et l'ASSEMBLAGE (pont, fronton, liseré continu) se juge comme un contrat à part entière,
AVANT le goût.

✅ **PLANCHE USER 2026-08-17 — CIBLE DE CONFORMITÉ** (artefact claude.ai
`f2baf8fc…`, annoncée « Bon je te prépare du Claude design ») :
planche auto-contenue (se rend au navigateur, UNIQUE et fixe 1920×1080) + sa capture de
référence. C'est l'ÉCRAN ASSEMBLÉ complet
(frise + bandeau + rail + journal + console 6 zones + terrain avec previews).
⚠ **CONTENU UI vs ANNOTATIONS** (arbitrage user 2026-08-17, verbatim : « Certains textes
sont juste des explications de fonctionnement plutôt que des informations à afficher ») :
la planche embarque des notes de FONCTIONNEMENT qui ne se rendent JAMAIS à l'écran —
identifiées : « II : épinglages · III éteinte, aucun contexte », « ▪ icône provisoire »
(les glyphes de la planche sont des placeholders, pas la cible d'iconographie),
« X FAIT TOURNER » dans l'en-tête de travée (= la touche X commute les sets, pas un
libellé). Classement à CONFIRMER pour : « Action non dépensée » (coin) et
« masqué par le décor » (terrain) — lus ici comme du VRAI contenu d'état/preview.
Le terrain de la planche dessine la Vague 2 (déjà validée) : carte de prévisualisation
d'attaque (« Score à atteindre 64 », décomposition, fourchette « 3 à 8 », restantes,
chips « de flanc +10 / assailli −10 » = lot 3), plaquette de conséquence
(« Terenz · touché · bras gauche · 4 Blessures » = lot 2), coût de déplacement
(« 3 cases · 1 point de Mouvement » = lot 4) + attaque gratuite encourue
(« rompre l'engagement — attaque gratuite pour Terenz » = lot 3), badges « deux
assaillants »/« 3+ », portée en nappe, anneaux de camp sous pions, ligne d'attaque
pointillée. Clavier de la planche : lettres AZERTY (A/Z/E/R/T/Y) sur la travée gauche +
F1-F4 sur l'accès rapide + 1-0/−/= sur la grille — compatible « touche = CASE »
(la touche s'imprime PAR CASE) ; le mapping exact se règle au volet clavier du lot.

### 1c-quater. CONTRAT D'INFORMATION — JAMAIS DE `title` SEUL, LE CANON EST `CodexRef`
(arbitrages user 2026-08-17, verbatims en test réel : « J'hallucine que tu ai osé mettre
des titles d'ailleurs, c'est une honte » puis « Mais c'est surtout qu'on gere les title
autrement dans l'application !!! »)

La charte l'exigeait déjà (grief du juge vision du lot munitions : « la raison n'est
qu'en title — patron `GatedAction` exigé ») et des micro-briefs d'orchestrateur l'ont
quand même violée, jusqu'à inventer une primitive (« HoverTip ») alors que LE CANON
EXISTE : **`CodexRef`** (`src/ui/compendium/CodexRef.tsx`) — popover de survol/focus qui
affiche l'entrée du CODEX (le verbatim de la donnée), mode `tooltipOnly`, épinglage,
tokens `--tooltip-*` de `base.css`, 16 consommateurs. Contrats :
- **Aucune information de la console portée par un `title` seul** (invisible au tactile,
  latent, inaccessible) ; un `title` natif ne survit qu'en redondance stricte.
- **Règle affichée = `CodexRef` vers l'entrée de donnée** (`regles/charger`, qualité
  `recharge`…) — le verbatim vient de la DONNÉE par id (règle 5, jamais une phrase
  composée en composant — précédent du même jour corrigé sur question user « les
  infobulles c'est du verbatim non ? ») ; un mode manquant s'ajoute DANS `CodexRef`,
  jamais un fork.
- **Raison de gate = patron `GatedAction`/`aria-describedby`** (visible), pas un popover.
- Garde committée : `console-no-title-only` (liste nominative, exemptions vides).
### 1c. Coin FIN DE TOUR + chrome de l'arche — PRÊT À BRIEFER

`end-turn` isolé + garde-fou existant. `undo-move` adossé à la jauge de Mouvement
d'`ActiveFrame` (⚠ `ActiveFrame` est pur-à-props — il gagne 1 prop de callback, pas un
accès store). Les chips `.ab-actor-top` (Assailli ×N, Cloué, Renfort — `ActionBar.tsx:646-657`)
restent le chrome d'état de l'arche, inchangées. `MovementIntent` (`:625-631`) reste le
porteur du coût de déplacement (loi 1 amendée) — ancré en bas, son apparition ne déplace
pas la console (à contractualiser en test de géométrie).

### 1d. Ce qui DISPARAÎT / se RELOGE (adresses COMPLÈTES)

- Tiroir sorts → grille (posés) + GRIMOIRE. **`cast` disparaît comme slot** ; son
  `castBlockReason` (`:265-269`, #516) migre en `GatedAction` sur CHAQUE alvéole de sort.
  **Focaliser** (`battleFocusSpell`, `:514-527`) : action PAR SORT → affordance secondaire
  de l'alvéole du sort (appui long / clic droit, geste précisé au lot grimoire) ET rangée
  de la fiche-sort du grimoire. **Chip Vents de Magie** (`:479-488`) → l'arche
  (`ActiveFrame`, à côté de l'Avantage-conduit) pour les lanceurs, porteur déclaré.
- Tiroir dissipation → alvéole Dissiper + **nouveau `DISPEL_MODE`** au registre
  `targetingModes.ts` ; cible = le PORTEUR (clic token), puis si N sorts sur le porteur, le
  panneau-PARAMÈTRE naît de l'alvéole (choix du sort à dissiper = paramètre, borné) ; la
  **progression du Test étendu** (`prog/ni DR`, `:537`) s'affiche sur l'alvéole.
- Tiroir Avantage → alvéoles par Compétence (posées ; exhaustif : b2.15).
- Tiroir munitions → commutateur (lot munitions d'abord).
- Tiroir attaques → G1/G2 + grille (naturelles). Tiroir Détermination → alvéole + pastilles.
- `pickup-*` → pastille ⓘ (zone 4). `raise-hand` → frise. `mount`/`man-poste`/
  `push-engine` → pastilles sur l'ENTITÉ (zone 4, tranché) ; `dismount`/`leave-poste`/
  `maneuver-ship` → G6bis (état du héros).

---

## Zone 2 — LA FRISE : pause de Round jouable — volet RAW PRÊT

- Insertion par Chance à RANG LIBRE (#1332, verbatim LDB 17 l.21-27 re-vérifié par le
  juge) : interstices déposables ET focusables (la frise gagne `role="listbox"` + roving —
  elle n'a AUCUN role aujourd'hui, c'est un ajout d'a11y, pas une surface neuve).
  `roundStartPromote(heroId, rank)` — 2ᵉ argument TRANSPORTÉ PAR L'INTENT
  (`net/intents.ts:120`) ; la garde `combatSlice.ts:1656` (`order[0] → return`) SE LÈVE
  (retarder depuis la tête est un droit RAW).
- Coop : pendant le choix d'interstice, les autres clients voient l'état INCHANGÉ (le
  choix est local jusqu'au commit de l'intent) ; le ready-check existant reste la surface
  d'attente.
- Tir rapide : inchangé (armement frise → cible au champ → fenêtre de jet).

## Zone 3 — PASTILLES D'ÉTAT : remède sur la chip

Affordance DISTINCTE du clic Codex, surfaces de combat seulement, `GatedAction`, cible
tactile ≥ 44px (`pointer: coarse`). **RÈGLE NOUVELLE : une chip porteuse de REMÈDE n'entre
jamais dans le débord** — le tri de `summarizeEffects` place les États à remède AVANT le
`max=4` (sonde du juge : aujourd'hui `en-flammes` en 5ᵉ position cache « Se rouler »).
Sonde (iii) promue en test au lot.

## Zone 4 — LE CHAMP : intentions, portées, objets

- Gestes par défaut INCHANGÉS. Patron d'intention généralisé (modes `attaque`/`charge`/
  `course`, `chargeReach` pur, 3ᵉ `kind` de highlight, annulation Échap+re-clic).
- **Coop — le mode d'intention est LOCAL et a un PORTEUR NOMMÉ** : nouveau champ
  `localIntent` à la RACINE du store (HORS `battle`, hors allowlist d'intents, hors
  snapshot — `applyHostSnapshot` écrase `battle`, `src/state/netFlow.ts:140-142`) ; les
  overlays de portée lisent `localIntent` ; seul le COMMIT du geste part en intent. ⚠ Les
  POSTURES G5, elles, sont du JEU → `battle` + intent (zone 1a).
- **Pastilles d'ENTITÉ** (patron unique, tranché 2026-08-16) : objets au sol (ramasser),
  MONTURE (Monter), PIÈCE de siège/navire (Servir / Pousser l'engin) — le geste vit sur ce
  qui l'offre, adjacence évidente, coût de l'Action affiché + `GatedAction` ; N choix d'une
  même entité → panneau-paramètre né de la pastille (borné à CETTE entité).

## Zone 5 — LA FENÊTRE DE JET : inventaire STATUÉ (10/10)

| Option | Statut V2 |
|---|---|
| `attackSetLocation` / `attackSetWeapon` / `attackSetDualMode` (LDB 10 l.767-773) | RESTENT en modale |
| `attackSetIntoCrowd` / `attackSetHeldGround` | CONTRÔLE = G5 seul (verbatim §1) ; la modale AFFICHE posture + valeur, lecture seule |
| `attackSetHarpoonRopeCut` / `attackSetWithhold` / `attackSetGrapple` | RESTENT en modale — ⚠ CORRIGÉ 2026-08-17 : l'Empoignade est une option de l'attaque À MAINS NUES (LDB 14 l.155, l.159 — déclarée avant le jet), JAMAIS un geste de G6 (l'ancienne mention « via G6 » tombe, cf. §1a) |
| `attackSetCritLocation` (LDB 17 l.68) | RESTE (post-jet) |
| **`attackSetForcedRoll`** (`store.ts:1122`, LDB 17 l.68 — manquait à l'inventaire) | RESTE (pré-jet, réussite forcée) |
| Défense (mode/arme de parade/Porte-Bouclier/Détermination) | INCHANGÉS (pas de médaillons) |
| Incantation (9 options `CastModal`) | INCHANGÉES cette vague |
| Autres pendings (désengagement, au-contact, empoignade, monture, chute) | INCHANGÉS |

## Zone 6 — ÉCRAN DE CAPACITÉS (grimoire étendu) + RAIL D'OUTILS — PRÊT

Le grimoire devient l'ÉCRAN DES CAPACITÉS du personnage (tranché 2026-08-16) : sorts ET
manœuvres ET talents à activation, sections par famille (`ScreenShell` +
`MasterDetail`/`GroupedPickGrid` + `SearchFilterField`), il PLACE (glisser vers une case)
et LANCE (le ban ne vise que la barre), ferme après lancement. ⚠ ORDONNANCEMENT : se
livre DANS le même lot que la purge des tiroirs (b3.16) — jamais un lot entre les deux
sans surface exhaustive.

✅ RÉVISIONS 2026-08-17 (échange user sur l'éditabilité) :
- **« Déduite » = DÉFAUT, plus une loi** (correction user, verbatim : « "rangée haute est
  déduite du set au poing", comment ca ? J'ai dit que les raccourcis étaient dépendante
  de l'arme équipée ») : la barre est ENTIÈREMENT ÉDITABLE, gauche comprise. La
  dépendance à l'arme est une dépendance d'ÉLIGIBILITÉ (une action d'arme n'est
  proposable/active que si l'arme est au poing) ; la déduction ne fait que PRÉ-REMPLIR.
  **Le placement de la travée gauche est PAR SET** : chaque set a sa disposition,
  pré-remplie par déduction, rééditable, mémorisée AU PORTEUR (`Combatant.barre.arsenal`,
  indéxée par `WeaponLoadout.id` — zone 9) ; commuter (X) affiche la disposition du set.
  Proposé sans objection user.
- **L'édition = GLISSER-DÉPOSER SUR LA BARRE ELLE-MÊME** (⚠ CORRIGÉ 2026-08-17 sur
  contrôle user « c'est comme ca que les jeux videos font normalement ou tu réinvente la
  roue ? » — ma 1ʳᵉ version « écran-éditeur avec sélecteur de héros » était une roue
  réinventée) : état de l'art unanime (BG3/Pathfinder/POE/MMO) — AUCUN écran d'édition
  de barre n'existe ; l'écran de capacités s'ouvre EN PANNEAU PAR-DESSUS le jeu, la
  console reste visible dessous et REÇOIT le drag & drop, en combat comme hors combat
  (verbatim user à l'origine : « Faudra un moyen d'éditer tout cela oui, et pas obliger
  l'utilisateur a etre en combat ») ; tactile = appui long + glisser. Le choix du héros
  = la SÉLECTION DE PERSONNAGE (Zone 13), pas un picker d'éditeur : hors combat, la
  console affichée est celle du héros SÉLECTIONNÉ. Conséquence : **Zone 13 devient le
  PRÉREQUIS de l'édition hors combat**, plus un chantier optionnel.

## Zone 13 — SÉLECTION DU PERSONNAGE EN EXPLORATION (PRÉREQUIS de l'édition hors combat)

Constat user (verbatim : « on ne peut pas choisir le personnage (vu que c'est toujours
le premier en vie qu'on controle). Faudrait surement modifier ce comportement ») —
aujourd'hui l'exploration contrôle le premier vivant. Modèle état de l'art (BG3 :
sélection d'un membre → SA barre s'affiche, SON grimoire s'ouvre) : clic sur un portrait
du BANDEAU en exploration = SÉLECTIONNER ce héros (il prend la tête, les autres
suivent ; sa console hors combat s'affiche pour l'édition ; ses écrans s'ouvrent sur
lui). Périmètre réel à cadrer AVANT le lot : leader de marche, interactions/dialogues,
coop (qui a le droit de mener), sauvegarde du choix — à CONFIRMER par l'user.

✅ ARBITRAGE CAMÉRA (AskUserQuestion 2026-08-17, sur question user verbatim : « Je ne suis
pas fan de ces boutons de map en haut à droite, je ne connais aucun jeu vidéo qui offre ce
genre de bouton. Ils font comment les jeux avec des vues tactique ou pov ? ») : **gestes +
clavier seuls — la plaque `ViewControls` QUITTE le jeu** (l'ÉDITEUR la garde, c'est un
outil). État de l'art appliqué (BG3/Solasta/XCOM : aucun bouton caméra à l'écran).
Grounding mesuré (lecteur 2026-08-17) : molette=zoom (`useStageCamera.ts:58-63`),
drag-gauche=panoramique et drag-milieu=rotation libre (`useStagePointer.ts:362-388`),
Q/E=rotation, C=recentrage (combat), F=POV (exploration) EXISTENT déjà — la plaque était
redondante au desktop. Le lot ajoute : touches pour la bascule de projection iso↔top et
l'inspection (clés libres du registre `keybindings.ts`, source de vérité unique) ; C
recentrage étendu hors combat ; **tactile : pinch=zoom + deux-doigts=panoramique dans le
stage** (zéro support aujourd'hui, sonde grep `touch|pinch` = 0 sur `src/gameIso/stage/*` ;
porter le motif éprouvé de `MapCanvas.tsx:78-151`, garde du même patron que
`MapCanvas-pinch-race.test.tsx`) — la plaque était le seul contrôle caméra tactile, elle
ne part pas sans son remplaçant. Le rail droit ne garde que les OUTILS (tiroir de journal
aujourd'hui ; à terme les écrans de la planche : fiche/grimoire/journal/vision — zone 6).
⚠ Bug WIP relevé au passage : la version worktree de `CampaignView` omet
`onRotateRelease={relacherCamera}` (la version main l'a) — sans objet une fois la plaque
retirée du jeu, à ne PAS reporter.

✅ COMPLÉMENT 2026-08-17 — **LA BOUSSOLE-HORLOGE** (arbitrage user, verbatim : « Minimap,
vu la taille de nos map, ca n'a pas trop de sens, mais la boussole c'est souvent un
élément qui sert aussi a afficher l'heure et la date dans les jeux ») : PAS de minimap
(cartes d'un écran) ; UN médaillon de coin de carte, patron Kingmaker — la BOUSSOLE
(nord visible, clic = réorienter la caméra au nord — indispensable depuis la rotation
libre sans plaque) qui PORTE l'heure et la date (le domicile canonique que la date avait
perdu en quittant la barre haute — `ScreenMeta` reste la méta des écrans plein-champ).
Exploration ET combat (l'heure de campagne se lit partout). ÉTENDUE (2026-08-17, suite
de l'audit) : le médaillon porte AUSSI **le NOM DU LIEU** (l'en-tête de minimap du genre,
sans minimap) — le nom QUITTE la barre haute, qui se réduit à ☰ + bannière d'objectif
contextuelle ; et l'ARRIVÉE dans une zone nommée gagne son **ANNONCE TRANSITOIRE**
(titre en grand au centre, s'efface — le standard du genre, l'entrée dans un lieu de
campagne est un événement narratif). ⚠ Le module minimap EXISTANT (`TopoScene`, POC des
combats de masse/armes de siège/stations navales) RESTE à ses contextes — verbatim user :
« On a un module de minimap qu'on utilise pour les combats de masse et arme de siege, en
POC, mais pour le moment je ne pense pas que cela soit utile sur le HUD ». À dessiner au
lot de matière ; le contrat de composition (un seul médaillon, coin de carte, jamais une
plaque de boutons) vaut dès maintenant.

## Zone 7 — LES PHASES

✅ TRANCHÉ (2026-08-16) : l'interlude de ciblage (`ActionBar.tsx:234-245`) et la pause de
Round (`:139-164`) cessent de REMPLACER la barre — console en LECTURE (géométrie tenue,
cases inertes) + BANDEAU fin par-dessus portant le message de phase et sa sortie
(Terminer/Renoncer ; pause : le ready-check). Les deux sites se réécrivent au lot console.
Le reste : tour adverse/autre joueur/auto-combat = console en LECTURE (mêmes cases,
inertes) ; tour du NAVIRE = la console charge le contenu navire dans la MÊME géométrie
(6 ids mesurés : `maneuver-ship`, `battery`, `crew-test`, `sing-shanty`, `ship-reload`,
`end-turn` — `battery` reste un interlude) ; placement navire : AUCUNE clé à part — le navire
EST un porteur, sa disposition vit sur LUI comme celle d'un héros (zone 9, b3.19) ; combat
fini = console retirée (transition).

## Zone 8 — LE CLAVIER

✅ TRANCHÉ (2026-08-16, RÉVISION EXPLICITE de l'arbitrage « touche par ID ») : **la touche
suit la CASE** (position apprise, état de l'art MMO — le joueur pose sa capacité sur
« sa » touche) : 1-8 = cases de la grille visible. Les HORS-CASE gardent leurs touches
dédiées existantes (`Space` = fin de tour…) ; le contrat « aucune action légale ne
disparaît » gagne un volet CLAVIER : toute action doit conserver AU MOINS un accès
clavier ou être atteignable au focus (remèdes de pastille, pickup, navire — roving).
Acquis hors arbitrage : table sans modificateur, badge = touche réelle, réfs
`LDB 10 → LDB 11 l.97-103` + `raw:implemente` (lot 1 réduit).

## Zone 9 — PERSISTANCE

`saveId` N'EXISTE PAS (sonde négative ; saves par SLOT 1-3, `SAVE_VERSION = 27` — la
mention « v12→v13 » de l'invariant était fausse). ✅ TRANCHÉ (juge de design 2026-08-24, lot
A1) : **la disposition est un CHAMP DU PORTEUR** — `Combatant.barre: DispositionConsole`
(`src/engine/types.ts`), lu/écrit par `src/state/dispositionConsole.ts`. Elle voyage donc
GRATUITEMENT partout où le porteur voyage : save (snapshot zéro-maintenance de `saves.ts`,
aucun bump — le champ est optionnel), roster, snapshot réseau. **Aucune clé de partie, aucune
table annexe, aucun `localStorage`** : ni `partyKey` ni `(partyKey, actorId)` — l'identité du
porteur EST l'adresse, et la question des ids de héros non stables ne se pose plus.
En COOP, la disposition est PARTAGÉE avec l'état du personnage (un siège possède ses
personnages) : elle n'est pas un réglage local de client.
Une ZONE est un objet CREUX (`Record<rang, entrée|null>`), jamais un tableau à trous : la
sérialisation JSON de la save rendrait un trou en `null`, c'est-à-dire « case VIDÉE ».

## Zone 10 — MIGRATION (ordre CORRIGÉ, b3)

1. **Lot réfs** (ex-lot 1 réduit) : `LDB 10 → LDB 11 l.97-103` (`keybindings.ts:76,122`)
   + `raw:implemente`. Trivial, autonome.
2. **Lot munitions** (avancé, b3.20) : munition fixée au chargement (moteur + tests) —
   AVANT toute UI de barre.
3. **Lot console** (gros lot unique, b3.16-17) : travées + grille + coin + conduit +
   clavier (mapping livré AVEC les cases) + purge tiroirs + GRIMOIRE + placement/
   persistance (champ du porteur, zone 9) + phases lecture/navire. Prérequis internes : matrice G6
   (b3.18), maquette 360px validée, arbitrages b2 tranchés.
4. **Lot intentions** : modes + `chargeReach` + 3ᵉ kind + annulation + `localIntent`.
5. **Lot pastilles + pickup ⓘ** (avec la règle anti-débord des remèdes).
6. **Lot frise jouable** (#1332).
7. **Solde** : réfs design 2026-07-31 migrées + suppression des docs plans, cliquets,
   recette d'ensemble (héros nu, tireur, mage 211 sorts, prêtre, monté, poste, naval,
   coop invité, 360px).

Gardes au fil des lots : contrat « aucune action légale ne disparaît » (DOM **et
CLAVIER**, par scénario — promotion de la sonde 2) ; garde de géométrie (comptes constants
par viewport, y compris pendant interlude/pause selon b2.14) ; garde anti-liste (panneau
borné au paramètre : munition, localisation, objets d'UNE pastille, sort à dissiper d'UN
porteur) ; les 3 sondes du juge promues en tests (co-occurrence G6, charge de grille,
débord des remèdes).

## Zone 11 — HUD HORS COMBAT : LE PONT D'EXPLORATION (ouvert 2026-08-17)

Constat user (verbatims) : « Il va clairement aussi adapter l Interface hors combat. Les
Possessions ça ressemble à un bouton de menu qui irait dans le bloc à gauche non ? La date
ça n a rien à faire là non plus globalement » ; « Pareil le bouton de repos n a pas sa
place à cet endroit. Ils mettent ces informations ou les jeux vidéos ? »

Inventaire MESURÉ de la barre haute d'exploration (`CampaignView.tsx:218-290`) : ☰ menu +
nom du lieu + **date (`ScreenMeta`)** + jusqu'à **7 boutons flottants conditionnels**
(Possessions, dossier du navire, carnet d'enquête, voyage réduit, carte du monde, hub de
ville, dormir/camper — tous en `.worldmap-btn`) — le patron « chacun flotte dans son
coin » que l'analyse RT condamnait.

✅ ARBITRAGE (AskUserQuestion 2026-08-17, état de l'art BG3/Pathfinder/POE exposé : repos
= bouton de barre basse, ouvreurs d'écrans = rangée d'icônes au bout droit de la barre
basse + touches, date contextuelle jamais permanente) : **LE PONT EXISTE AUSSI HORS
COMBAT, allégé** — une seule loi d'assemblage pour tout le jeu (§1c-ter) :
- Extrémité DROITE du pont d'exploration = la rangée d'icônes-écrans (Possessions, carnet,
  dossier navire, voyage, carte du monde, lieu-hub, repos/camp — mêmes conditions
  d'apparition qu'aujourd'hui, cases dessinées stables quand la condition est fréquente).
- Barre haute = ☰ + lieu + objectif SEULEMENT. **La date QUITTE le HUD** (elle vit déjà
  au menu ☰ et sur tous les écrans plein-champ `ScreenMeta` — zéro perte).
- Même matière/liseré que le pont de combat (tokens `--cc-*` remontés au `:root` par le
  lot centrage) ; le combat garde sa console pleine, l'exploration son pont léger — la
  transition combat↔exploration change le CONTENU du pont, jamais son existence.
- Touches d'ouvreurs d'écrans (I/J/M-style, registre `labelKey`) : volet ultérieur,
  consigné — pas dans le premier lot.

✅ RÉVISION MAJEURE 2026-08-17 — **LE PONT UNIFIÉ : la barre ne disparaît JAMAIS**
(question user : « dans les jeux, la barre d'action disparait hors combat ou c'est une
invention de notre part ? » — vérifié : invention de notre part, contraire au genre
entier — NWN/BG3/Pathfinder/POE/MMO gardent la barre hors combat pour buffs/soins/objets/
sorts utilitaires ; puis directive de méthode : « je suis en train de remettre en cause
chaque partie de notre interface en te poussant a regarder vers ce qui se fait
ailleurs ») :
- `CombatConsole` et `ExplorationDock` = **UN SEUL composant-pont à deux ÉTATS** (le
  composant d'exploration né le jour même FUSIONNE avant de devenir une dette). Mêmes
  emplacements, mêmes touches, même placement dans les deux modes — le contexte change
  l'ÉLIGIBILITÉ des actions (« Charger » grisée hors combat, « Descendre » grisée sans
  monture), jamais les cases. Le CHROME de combat (gouttières, frise, Avantage, coin Fin
  du tour) apparaît/disparaît AUTOUR de la barre constante.
- Hors combat : l'arche montre le héros SÉLECTIONNÉ (Zone 13) ; en combat, l'acteur du
  tour. Les ouvreurs d'écrans restent l'extrémité droite du pont.
- Les actions HORS COMBAT aujourd'hui enterrées dans la fiche (soins, prières,
  consommables, sorts utilitaires — flux `ooc*`) remontent sur la barre et ENTRENT AU
  REGISTRE (`actions.json` couvre les deux contextes ; la garde d'atteignabilité vérifie
  l'exploration aussi) — au lot 2, le lot 1 en vol transcrit le manifeste combat sans
  être déstabilisé.
- X commute les sets hors combat aussi (dégainer existe déjà hors combat).

## Zone 12 — REGISTRE DES ACTIONS (design SCELLÉ 2026-08-17 : jugé + grounding exhaustif)

Demande user (verbatim : « il faut un fichier .json qui liste toutes ces "capacités"
plutot que les avoir un peu partout dans l'application ») ; mandat « Ok, je compte sur
toi ». Design attaqué par juge (6 lentilles) + 2 groundings (inventaire complet).

**FAITS ÉTABLIS** : ~44 méthodes `battle*`, ZÉRO orpheline — toutes routent par le FOYER
UNIQUE `ActionBar.tsx` (slots :417-496, sous-panneaux cast/dispel/advantage/resolve/ammo,
sous-menu Attaque via `availableAttacks`) ou `targetingModes.ts` (dispatch de clic).
L'ActionBar = le MANIFESTE exhaustif (~31 ids, icônes et coûts en texte dur) ; la console
n'en couvre ~6 → **~20 actions sans surface vivante** (sonde du juge, pas 7). Cause
racine mécanique : `hotbarBridge` positionnel par closures (meurt avec le composant) + 4
espaces d'ids forkés (`KEYBINDINGS`, union `BattleState.action`, clés de console
préfixées position, ciblages). `maneuvers.json` (27 entrées) et `crew-test-types.json`
(11) sont les embryons data existants ; 37 icônes combat dorment au registre
(`action/*` 20 — mount/dismount/serve-engine/leave-post/steer-ship/water comprises,
`melee/*` 7, `creature/*` 10) ; `spells.json` : 0 icône sur 576.

**FORME (verdicts du juge intégrés)** — `src/data/actions.json`, une entrée par action :
`id` stable (sans préfixe de position) · `label` (affichage, minteur `dataLabel` — patron
`activities.json`) · `icon` (id du registre) · `rule?` (cible Codex, liaison gardée) ·
`source` · `cost` + **`maison: true` + `costNote` quand le coût est notre arbitrage**
(RAW re-vérifié AU SOURCE : PAS de catalogue d'Actions en LDB 13 — verbatim l.106 :
« C'est le MJ qui va décider ce qui vous coûtera votre Action, et ce que vous pouvez
faire au cours d'un Round. On part en général du principe que si un acte nécessite un
Test, c'est que c'est une Action plutôt qu'une Action gratuite. » — et la clause suivante
regarde le plafond maison de la commutation : « Le fait de se retrouver *Engagé* en
Combat peut interdire l'utilisation d'une Action gratuite qui nécessite une certaine
concentration » ; arbitrage user 2026-08-17 verbatim : « le LDB indique que si y'a un
jet, c'est une action comme une guideline pour décider ce genre de chose, mais qu'au
final c'est le MJ qui décide » → la guideline = DÉFAUT de remplissage des coûts, tout
écart = maison explicite — règle 7, le MJ c'est la donnée) · `surface` par défaut
(`deduite-du-set`/`grille`/`pastille-entite`/`hors-console`) · `gate` = ID DE PRÉDICAT
enregistré (⚠ `Condition[]` RÉFUTÉ par le juge : algèbre d'acteur à 4 champs numériques,
0/10 actions exprimables — patron retenu = `resolver` d'`activities.json`) ·
`candidates` = id de SÉLECTEUR impur (sortie injectée dans `AiInput` — l'IA reste pure
et perd sa liste manuscrite) · `mode?` (id `TargetingMode` existant) · `run` = id du
dispatcher (JAMAIS de code en JSON).

**CODE** : `ACTION_GATES`/`ACTION_CANDIDATES`/`runAction(id, ctx)` ; **`KEYBINDINGS`
devient CONSOMMATEUR** (pas un 5ᵉ registre : `run: runAction(id)`, libellé résolu du
registre) ; `BattleState.action` se type DEPUIS le registre ; les clés de console
deviennent des ids d'action (la POSITION sort de l'id — l'arbitrage « touche = CASE »
reste : la touche suit la case, la case porte un id) ; le pont hotbar publie des paires
(actionId, run) dérivées du registre, plus des closures anonymes.

**GARDES (les sondes du juge promues)** : atteignabilité — itère `actions.json`, toute
action éligible a une surface vivante (case/pastille/touche/focus), baseline GELÉE
DÉCROISSANTE (~20 au départ, patron knip/raw-blind-refs) ; RÉCIPROQUE fail-closed — tout
slot/case/id d'action NON déclaré au registre = rouge (sans elle la classe « action
perdue » se reforme par un slot manuscrit).

**POISON à corriger au 1ᵉʳ lot** : `turnEconomy.ts:11-14` — commentaire « réutilise
EXACTEMENT les prédicats de l'ActionBar … une seule source de vérité » = FAUX (2ᵉ
dérivation manuscrite, divergence déjà vécue : bug Détermination corrigé aux 2 sites,
commit `0e14119b`) — les prédicats passent au registre (`ACTION_GATES`), les 2 sites le
consomment.

**ORDRE DES LOTS** : (1) registre + dispatcher + transcription du manifeste ActionBar
(~31 entrées, icônes existantes réutilisées) + les 2 gardes — AUCUN pixel ne change ;
(2) branchements des surfaces AVEC icônes (console/clavier par id, pastilles d'entité,
grille + défauts de remplissage) — baseline d'atteignabilité décroît à chaque lot ;
(3) purge `ActionBar` (b3.16) quand la baseline atteint 0 + réécriture
`hud-clickables.mjs` ; (4) passe de matière.

---

## Vague 2 — RETOUR VISUEL (validée par l'utilisateur le 2026-08-16, 5 éléments)

Grounding mesuré (lecteur du 2026-08-16, arbre `98d72164`) : la couture pure unique est
`HoverTargeting` (registre `TargetingMode.affordance` — même donnée que le clic, mensonge
impossible) ; `battle.preview` est la source unique du coût (aperçu/commit/IA) ;
`AimOverlay.tsx:97-140` est déjà l'infobulle pré-jet à 80 %. Les silhouettes d'occultés
sont DÉJÀ LIVRÉES (#1297 LOT C, WebGL) — hors vague.

Lots, dans l'ordre (chacun : recette + juge vision) :
1. **Réparer #1327** — les flottants typés (`FxLayer`/`useCombatFx`) sont câblés SEULEMENT
   dans `IsoStage.tsx:130,513` → muets en volumique alors qu'`ANIM_IMPACT` y est bien émis
   (`GameStage3D.tsx:1213`). Le volet « SFX muets » du ticket est INFIRMÉ (audio global,
   `main.tsx:33`) — commenté au ticket. Préalable de canal à toute la vague.
2. **Plaquette de conséquence** — extension des flottants typés existants (`FloatKind`) :
   réaction (parée/esquivée/encaissée) + localisation + Blessures en langage joueur
   (« ✓ Touché · Bras gauche · 5 Blessures ») sur le pion touché. Le journal garde
   l'historique, la fenêtre garde le choix.
3. **Infobulle-contrat enrichie** — `AimOverlay` + l'ATTAQUE GRATUITE ENCOURUE annoncée
   avant le geste (`freeAttackSourcesOf` pure, `triggeredEffects.ts:147` — zéro consommateur
   UI aujourd'hui) + palier de Difficulté nommé. Le sous-point RT « Réaction restante du
   défenseur » TOMBE : sans objet RAW (pas d'épuisement de réaction par Round chez WFRP ;
   seul `usedShieldReactionRound` existe, spécifique Porte-Bouclier).
4. **Curseur porteur du coût** — le coût du geste (Action/Mouvement/palier) au survol en
   permanence, lu de `battle.preview`/`previewResourceDelta` (`combatFlow.ts:1010-1026`) —
   aujourd'hui seulement au tap-1 (`TapPreview`, `MoveOverlays.tsx:57-87`).
5. **Prévision de zone par créature** — badge PAR cible affectée au placement d'un gabarit
   (jamais un total) : fonction « affectés par cette position candidate » À ÉCRIRE sur
   `zoneCovers`/`sceneZoneTiles` (`zones.ts:114-116`) — câblage, pas vocabulaire.

⚠ Canal : (3)(4) sont SVG-only SANS seam builder (composants React directs) — le canal
volumique exige soit un builder pur nouveau (patron `buildHighlights`/`tokenChromes`,
déjà bi-backend), soit un peintre monté par `GameStage3D` ; à articuler avec le GO/NO-GO
WebGL (#1160). La vague livre le SVG d'abord, le canal volumique passe par le lot 1 (#1327)
qui décide du patron.

## ARBITRAGE 2026-08-19 — MODÈLE DE GESTES RÉVISÉ (supplante le verbatim « actions par défaut du grid » du 2026-08-16)

Instruit par l'état de l'art (panel 9 jeux, rendu de recherche du 2026-08-19 : RT/XCOM/JA3 = attaque-capacité ; BG3 = Dash explicite ; grille = zones peintes d'office ; partout : hors-max = refus net, jamais de partiel silencieux). Question ouverte par l'utilisateur (verbatim) : « Rogue Trader demande a cliquer explicitement d'un l'attaque que tu souhaite faire pour attaquer, ce n'est jamais choisi automatiquement ? Par défaut seul la zone de déplacement est affiché, et BG3 demande a cliquer sur la course pour dépasser la zone de mouvement normal, ce n'est pas automatique ? »

Réponses AskUserQuestion du 2026-08-19 (options choisies, assertions intégrales) :

1. **Clic-ennemi nu = « Attaque auto À PORTÉE seulement »** — à portée = attaque de l'arme équipée ; hors portée = refus dit (ou simple sélection/examen) — le déplacement reste un geste séparé, cohérent avec la Course à armer.
2. **Clic-sol au-delà de la Marche = « Course à ARMER (école BG3) »** — cliquer au-delà de la Marche = refus dit ; il faut armer la case Course pour débloquer la zone étendue.
3. **Zones par défaut = « Marche seule »** — par défaut seule la zone de déplacement est affichée ; la Course ne se peint qu'à l'armement de sa case.

Lois d'accompagnement (fondées par la même recherche) :
- **Refus VISIBLE par construction** — jamais un refus muet au journal (doctrine #516 ; le journal n'est pas affiché en combat, `LogDrawer`) ; le refus se dit à l'écran au point du geste.
- **Annulation gratuite par construction** — Échap/désarmement n'a JAMAIS de coût (contre-exemple documenté : Solasta, Échap consomme l'action, défaut dénoncé forum officiel).
- Une intention armée ne bloque JAMAIS les modes de ciblage (`cast`/`teleport`/`push`/zone) — verrouillé par `intention-geste-par-defaut.test.ts` (contrat (b), à conserver sous le nouveau modèle).

Conséquence : le verbatim du 2026-08-16 porté par `src/state/localIntent.ts:4-9` est SUPPLANTÉ sur le point « actions par défaut du grid » — le lot d'implémentation met à jour ce commentaire et réécrit le contrat (a)/(c) de `intention-geste-par-defaut.test.ts` sur le présent arbitrage.
