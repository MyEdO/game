# Authoring de campagne — la carte des coutures d'auteur

Référence VIVANTE (maintenue au fil du code). Une **campagne** = un projet multi-scènes relié par une
carte du monde (`{ schema: SCHEMA_PROJET, scenes, worldMap, narratif }`), COMMITÉ, manuscrit ou possédé par un générateur (§1). Pour le
pas-à-pas « par où commencer », voir le skill `creer-une-campagne`. Ce document cartographie CHAQUE
système qu'un auteur mobilise. Règle d'or transverse : **on n'authore que des IDS stables** (le libellé
est de l'affichage multilangue — CLAUDE.md, encadré « id STABLE ») ; **personne ne lit le journal**
(tout dénouement doit être VISIBLE au moment) ; **aucun texte technique dans un texte joueur**.

## 1. Pipeline

- **Paquet MANUSCRIT** `src/scenes/<campagne>/<campagne>-projet.json`, commité (fiche
  `user-doctrine-campagne-jamais-generee-par-script`), édité à l'éditeur ou comme document JSON. « Ouvrir »
  une campagne du jeu en fait une COPIE de travail libellée « Copie de <label> ». L'aller-retour vers le
  paquet est « Fichier → Exporter forme dépôt (dev) » (offert en DEV pour une campagne livrée,
  `origineLivree`) : le fichier `BuiltinCampaign.fichier`, au format du dépôt (`projetVersDepot`, §10ter),
  libellé d'origine tant que le projet n'est pas renommé, ordre des scènes et scène d'entrée conservés
  (`src/ui/editor/Editor.tsx`, `exportDepot` ; garde `src/ui/editor/export-forme-depot.test.tsx`).
  « Fichier → Exporter JSON » télécharge l'export portable `<id du projet>-projet.json`, libellé de la
  copie de travail. Les deux passent la porte du document (`parseProject`). Tout paquet neuf se
  déclare dans `MANUSCRITS` de `src/scenes/generateurs-byte-stables.test.ts` (volet couverture). Modèle :
  `src/scenes/diligence/`.
- **Chargement et validation** : `parseProject()` (`src/state/worldMap.ts`) est la porte UNIQUE — relit
  le JSON, résout les réfs sparse (ports, cf. §5), refuse un document mal formé. `validateScene()`
  (`src/state/validateScene.ts`) et `src/scenes/bundled-projects.test.ts` (tout `*-projet.json` au glob)
  confrontent le contenu. Un bump de forme (`SCHEMA_PROJET`) migre les paquets par un script daté de
  `scripts/migrations/` (banc `src/scenes/migrations-format-projet.test.ts`).
- **Générateurs** `scripts/<dossier>/generate.mjs` + lib `scripts/campagne/lib.mjs` : contrat byte-stable
  (`src/scenes/generateurs-byte-stables.test.ts`, #1522 — `build()` PUR et chemin `OUT`, artefact comparé
  à l'octet) qui fait du script le propriétaire exclusif de son paquet ; leur `scene()` compile un `MapSpec` par
  `buildScene()` (`src/state/mapSpec.ts`), comme les scénarios de test, et une option que `scene()` ne lit pas
  LÈVE en se nommant. Régime réservé au contenu CALCULÉ
  non authorable à la main, jamais à un projet de campagne : `barge-du-sel` et `loup-et-saumure` sont la
  dette #1601 (« Campagnes possédées par un GÉNÉRATEUR … statuer la migration vers MANUSCRIT »), `arene`
  vit sous le même régime (#1601). Les validateurs id-only de la lib (`creatureId`/`skillId`/`spellId`/`speciesId`/
  `tenueId`/`weaponId`) FAIL-FAST pour ses seuls consommateurs.

## 2. Navire de campagne (`state.vessel`)

Câblé par des **Effects** (`src/state/scene.ts`), jamais en dur :

- `setVessel` — POSE/REMPLACE le navire de campagne (`vehicleId`, `name`, `morale`, `hullCurrent`/
  `hullMax`, `saboteurDR`, `crew`). REMPLACE tout `state.vessel` : un second `setVessel` efface Humeur de
  Manann, dégâts de coque et Moral accumulés — pour un patch, utiliser `adjustVessel`.
- `adjustVessel` — patch INCRÉMENTAL (`name`/`morale`/`hullCurrent`/`saboteurDR`…) sans réinitialiser le
  reste (ex. `saboteurDR` remis à 0 quand un sabotage est levé, sans toucher la coque).
- `adjustManann` — décale l'Humeur de Manann par `factorId` RÉEL de `src/data/sea-events.json` (validé par
  `findManannFactor()`, `src/engine/seaVoyage.ts`), jamais un delta brut anonyme.
- `saboteurDR` (dans `[-5,0]`) — malus discret aux Tests d'équipage de COMBAT ; s'authore SUR le
  `setVessel`. Effet de combat SEULEMENT : le pipeline de voyage ne lit aucun `GameOp`.
- `crew` — roster SALARIÉ (`{ roleId, count }`, barème `wage`). `roleId` ∈ ids RÉELS de
  `src/data/crew-roles.json` : `capitaine` · `timonier` · `vigie` · `mousse` · `navigateur` · `artilleur` ·
  `cuisinier` · `chirurgien` · `chansonnier`. **Aucun id `matelot`** : le rang-et-fichier (marin de base) est
  le `mousse` — ne pas inventer de rôle générique, prendre l'id existant.

**Bridge campagne ⇄ combat** : au DÉBUT du combat, toute coque spawnée dont `creatureId === vessel.vehicleId`
repart de l'état persisté (`src/state/combatSlice.ts`) ; à la FIN, ses dégâts sont réécrits dans le navire
de campagne (`src/state/combatFlow.ts`). Sans `setVessel` (ou avec un autre `vehicleId`), aucune
persistance — chaque combat spawn une coque fraîche.

## 3. Routes et voyage (`worldMap.routes`, `MapRoute`)

- `a`/`b` bidirectionnels, `km` (MILLES si `sea`), `modes`, `perils` (péripéties d'auteur `chancePct`),
  `perilDie` (seuil d10 RAW). DEUX routes entre les mêmes lieux sont OK (seul `id` est une clé) — le
  « sens » n'est qu'un nommage d'auteur, pas une contrainte mécanique.
- `ambush: { scene, encounter, at? }` — cible du « Attaqués ! ». En MER, `at` (fraction 0-1, défaut 0.5)
  ANCRE l'embuscade de façon DÉTERMINISTE : elle se déclenche quand la distance franchit `at × km`, une
  fois par traversée, hors RNG (#212).
- `sea: true` → voyage joué sur le navire de campagne (`src/state/seaVoyageFlow.ts`, cap `seaHeading`) ;
  `river: true` → descente jouée jour par jour (`src/state/riverVoyageFlow.ts`, `riverPerils`/
  `riverExposure`). Terrestre = table de péripéties + `inns` (relais d'auberge).
- Une route `sea: true` REQUIERT un `seaHeading` explicite d'auteur — aucun défaut silencieux :
  `buildSeaPlan` jette si absent (#416). L'éditeur pose `'est'` (neutre) à l'activation du toggle
  « mer » ; à l'auteur de régler le vrai cap. Rappel RAW : la dominante de la Mer des Griffes souffle
  DE l'OUEST (MDG ch.13 l.253) — poser `'ouest'` en cap plein donne un vent de face ~60 % des jours
  (pit #408, traversées interminables).
- `when` (`Condition`) — PRATICABILITÉ du trajet, axe ARÊTE du gating narratif (anti-backtracking) :
  absent = toujours praticable ; faux = le trajet reste À L'ÉCRAN (le lieu déjà visité ne disparaît pas)
  mais le départ est REFUSÉ — `startTravel` (`src/state/travelFlow.ts`) le revérifie au départ, au même
  niveau que `from` : la vue n'est pas le verrou.
- `refus` — raison JOUEUR de l'indisponibilité, rendue en infobulle par `GatedAction`. **EXIGÉE dès que
  `when` est posé** (`mapRouteSchema`, `src/data/schemas/defs-scenes/worldmap.ts`) : un trajet fermé MUET
  est un cul-de-sac inexplicable.
- `when` d'un LIEU (`MapPlace`, `worldMap.places`) — EXISTENCE du lieu, axe NŒUD (anti-spoiler) : absent =
  toujours visible ; faux = le lieu n'entre NI dans le rendu, NI dans le cadrage de la carte, NI dans le
  balayage du rivage d'un naufrage. Les deux axes sont INDÉPENDANTS : un tronçon se ferme sans effacer
  le lieu, un lieu se cache sans fermer les routes de ses voisins.
- Les deux `when` s'écrivent dans l'algèbre `Condition` (§ 9 : `setFlag` pose le drapeau, `evalCondition`
  — `src/engine/flowCore.ts` — l'évalue). Le contexte de la carte ne porte que drapeaux, horloge, groupe
  et bourse : les kinds qui lisent une cible, un lanceur ou un état de combat sont REFUSÉS à l'authoring
  (ils seraient FAUX en silence, et le lieu disparaîtrait sans qu'aucune donnée ne soit fautive).

## 4. Catalogues navals (data-driven, éditables)

- `src/data/naval-traits.json` — catalogue UNIQUE des Traits de coque (blindage, bélier…) ET des
  améliorations d'INSTANCE (ex. `proue-idole-de-stromfels`). `upgrades: NavalTraitRef[]` sur l'entité-coque
  accepte l'id de l'un OU l'autre kind : `findNavalTrait()`/`navalPassiveOps()` sont KIND-AGNOSTIQUES (ils
  résolvent tout id du catalogue et lisent son `passive` — un Trait intrinsèque posé en amélioration
  d'instance est licite, ex. `renforce` — MDG p.97 — sur la coque pirate de la Barge du Sel).
- `src/data/naval-ports.json` — Index des ports (Taille/Richesse/Production/Surplus/Demande RAW).
- `src/data/crew-roles.json` — rôles d'équipage salarié (`wage` hebdomadaire) ; `src/data/crew-test-types.json`
  — types de Tests d'équipage (`progression`, `manoeuvre`, `perception`, `orientation`…).

## 5. Ports par référence (`place.port`)

`place.port = { ref }` où `ref` est un id de `naval-ports.json` (#217). L'authoring JSON est SPARSE :
`resolvePortRef()` (`src/state/worldMap.ts`, appelé par `parseProject()`) fait couler Taille/Richesse/
surplus depuis le catalogue. Des champs locaux surchargent le catalogue port par port.

## 6. Postes d'artillerie par référence (`poste`, #222)

`poste(trappingId, side, crewIds?)` de la lib émet la forme de RÉFÉRENCE `{ trappingId, uid, side,
crewIds }`. La base (Dégâts/Qualités/Enc/Portée) N'est PAS matérialisée : elle est HYDRATÉE au spawn
depuis `trappingId` par `hydratePoste()` (`src/engine/items.ts`). `trappingId` doit désigner une pièce
POSABLE (trapping à art d'affût `siegeRig`) sinon `throw`. `crewIds` vide = poste servable en jeu par un
héros adjacent (`serveAtPoste()`, `src/state/shipPostes.ts`) — aucun id de héros n'est connu à l'authoring.
Garde-fou : les projets ne portent AUCUN poste en forme ancienne (base copiée), cf. la garde #222 de
`src/data/refs-migrated.test.ts`.
Formation des servants (#210) : un servant posé SUR la case de l'engin (ou sans position propre) est
AUTO-FORMÉ au spawn en anneau autour de l'empreinte (`autoFormCrews` — jamais l'avant, ADE II ch.08
l.258) ; une position de scène DISTINCTE prime toujours (placement d'auteur respecté).

## 7. Entités-coque (`ref` de véhicule)

`creatureId()` accepte créature ∪ véhicule (`findVehicleById()`, #218) : un `ref` de `vehicles.json`
(`cogue`/`langskip`/`loup-imperial`) passe en `encounters[].enemies[]` terse comme en `entities` BRUTES.
Une coque RICHE (équipage exposé `crewIds`, artillerie `postes`, améliorations `upgrades`) se pose en
`entities` + s'enrôle via `encounters[].members` (plus expressif que le terse).

**Échelle & modèle de combat naval — `metresPerTile` toggle `isMerScene`.** `metresPerTile≥4`
(`isMerScene`, `src/state/scene.ts`) bascule le combat naval en modèle NAVIRE-UNITÉ (équipage passager hors
`order`, tour de coque, action Bordée/Manœuvre — `combatOrder`/`isPassengerInBattle`). En dessous (défaut
2 m/case, PERSON-scale) : l'équipage combat individuellement, les héros SERVENT les pièces (`Servir <pièce>`)
et l'abordage se joue à la case. L'Allonge, elle, est le SEUL endroit où 2 m/case est figé : `reachTiles`
(`src/engine/engagement.ts`) traduit les mètres de LDB 62 l.163/164 en cases avec le facteur RAW
`LDB 15 l.12`, sans lire `metresPerTile`. Tout le reste SUIT l'échelle de la scène — bandes de portée,
géométrie des recettes de décor, ancres de place, rayons de lumière (#1507). Échelle de la Diligence : l’utilisateur a retenu le 2 m/case du livre (arbitrage 2026-09-04, option A de #1507 : « A — 2 m/case, RAW ») — rien ne bouge à l’écran, l’option « auberge deux fois plus petite » est écartée.
Les grilles d'ABORDAGE restent à 2 m/case : le modèle MER exige une IA de manœuvre de coque ENNEMIE qui
n'existe pas encore (`runEnemyAI` ne pilote aucun `bodyShape:'vehicule'` → la coque adverse ne s'avance ni ne
vire), et la bordée (portée en mètres) tombe hors d'atteinte sans manœuvre d'approche. L'échelle mer vaut
pour les scènes de TRAVERSÉE ; réserver le modèle navire-unité au jour où l'IA navale existe.

## 8. Objectifs de victoire (`EncounterDef.victoryCondition`)

Six formes (`VictoryCondition`, `src/state/scene.ts`), défaut `allEnemiesDead` :
`allEnemiesDead` · `destroyStructure` (arête) · `surviveRounds` · `reachZone` (rect) · `woundsThreshold`
(reddition d'une cible sous `belowPercent` de ses Blessures) · `firstBlood` (fin de rencontre au premier
sang — la première cible neutralisée clôt le combat, `threshold?` = seuil de Blessures ; le tir est banni
par défaut, duel). `onVictory` = un `Flow` (aplati en Effets).

`EncounterDef.siege` (booléen, case « Rencontre de siège » du dock Logique) est un champ **SÉPARÉ** :
il ouvre les structures destructibles de la scène (porte, mur) au choix de cible de l'IA ennemie.
Défaut littéral `false` — un objectif `destroyStructure` ne l'active PAS. Résolu par `siegeActif`
(`src/state/combatFlow.ts`), consommé par `buildAiInput` ; sans effet sur les dégâts, l'immunité
(`structureImmune`) ni le ciblage joueur.

## 9. Flags et gating

`setFlag` pose un drapeau de scène (`Scene.flags`) ; `flagWhen` (lib) / `when` gatent un choix ou un
Trigger sur une expression « flag,!flag ». C'est le seul mécanisme d'état narratif — pas de compteur
codé en dur.

### 9bis. Dialogues (`Dialogue`, `DialogueNode.speakerId`, #669)

Un `Dialogue` (`Scene.dialogues`) est un arbre de `DialogueNode` (`id`, `desc`, `choices`) — la
réplique du nœud est de la PROSE (`desc`), l'étiquette d'un `DialogueChoice` est un LIBELLÉ (`label`),
deux rôles distincts, deux clés (#1467 L1b). **Aucun nom
en clair** n'est jamais authoré dans un nœud (doctrine id-only, CLAUDE.md « on ne MANIPULE que des
IDs ») : le portrait ET le nom de l'interlocuteur se résolvent TOUJOURS par ID d'entité, jamais par une
chaîne de nom dupliquée dans la donnée.

- **Locuteur de SESSION** — ouvrir un dialogue en interagissant avec une entité (`interactEntity`) pose
  `dialogue.speakerId = ent.id` automatiquement ; un `startDialogue.speakerId` explicite le fait pour un
  dialogue lancé par script (trigger, effet). C'est le locuteur PAR DÉFAUT de tous les nœuds.
- **Locuteur PAR NŒUD** — `DialogueNode.speakerId` (id d'une `SceneEntity` de la MÊME scène) surcharge le
  locuteur de session pour CE nœud seulement : permet d'ALTERNER les interlocuteurs dans une même
  conversation (ex. une tablée à plusieurs PNJ). Un nœud sans `speakerId` retombe sur la session.
- Le nom affiché = le `label` de l'entité résolue (`DialogueBox`, `src/ui/DialogueBox.tsx`) — jamais un
  champ `speaker` de texte (supprimé, #669).
- **Patron de reprise** — pas de mécanisme dédié : les `DialogueChoice.when` (algèbre `Condition`) gatent
  les choix d'un même nœud d'accueil sur un flag posé au premier passage (« premier contact » vs
  « on se reconnaît »). Voir `src/scenes/test-scenarios/dialogue-multi.ts` (patron complet, alternance +
  reprise).
- **Coop** — un dialogue est une décision de GROUPE (jeton d'exploration unique) : `chooseDialogue`/
  `closeDialogue`/`interactEntity` sont réservés au siège hôte/MJ (`netOwnership.intentAllowedFor`), les
  autres sièges LISENT. Un Test social DÉCLENCHÉ depuis un choix reste arbitré normalement par le
  propriétaire du héros testeur (`openSkillTest`→`pendingTest`→`modalArbiter`).
- **Ce que la réponse ANNONCE est DÉRIVÉ, jamais écrit** (#1869) — la fenêtre rend
  « `N. [Compétence — Difficulté] libellé (coût)` » : le NUMÉRO est le rang de la réponse dans la
  liste VISIBLE (une réponse masquée par son `when` ne prend pas de numéro, et la touche 1-9 adresse
  ce rang-là), le TAG vient du `flow` de la réponse (`testAnnonce`, `src/state/dialogue.ts` : nœud
  `test`, ou effet `extendedTest` — qui ajoute son DR cumulé), et la PUCE de coût vient de son `cost`
  (`Coins`). **N'écris JAMAIS la Compétence, « (Test de …) » ni le coût (« — 4 pa », « (4 sous) »)
  dans le `label`** : la mention ment au premier changement de flux ou de prix, et le joueur la lit
  deux fois. Garde ABSOLUE : `src/scenes/dialogue-label-sans-test.test.ts`. Le `label` du
  `FlowTest`, lui, NOMME légitimement la fenêtre de jet (« Intuition — quelque chose cloche »).
- **SESSION de conversation** — chaque ouverture pose un `dialogue.session` monotone
  (`ouvrirDialogue`), recopié sur chaque tour archivé : c'est LUI qui regroupe une conversation à la
  relecture. Deux visites au même PNJ sont donc deux conversations distinctes, rien à authorer.

### 9ter. Choix gatés sur le GROUPE (`when` skill/career/species/status, #711)

Un `DialogueChoice.when` accepte, en plus des kinds génériques (§9), 4 kinds PARTY-LEVEL — vrai si UN
héros VIVANT du groupe (`who: 'any'`, défaut) ou TOUS (`who: 'all'`) satisfont la condition
(`evalCondition`, `src/engine/flowCore.ts`) :

- `{ kind: 'skill', id, spec?, advances? }` — un héros possède la Compétence `id` (`spec` éventuelle,
  ex. Langue) avec au moins `advances` avances (défaut 0 = simple possession).
- `{ kind: 'career', id }` — un héros exerce la carrière `id` (`Combatant.career`).
- `{ kind: 'species', id }` — un héros est de l'espèce `id` (`Combatant.species`, id de `species.json`).
- `{ kind: 'status', atLeast }` — un héros a un Statut (LDB 08) au moins `atLeast` (« Argent 2 »,
  `parseStatus`/`statusMeets`, `src/engine/social.ts`).

**Convention d'affichage** — un choix gaté par un `when` de ce type se PRÉFIXE dans le `text` du
descripteur entre crochets, pour que le joueur voie POURQUOI ce choix lui est offert :
« **[Crochetage]** Forcer la serrure », « **[Halfling]** Se glisser par le soupirail »,
« **[Statut : Argent+]** Négocier d'égal à égal ». Le préfixe reste PROSE de fixture/campagne (pas de
mécanisme dédié de rendu) — voir le patron complet dans
`src/scenes/test-scenarios/98-conditions-etendues.ts`.

### 9quater. Persistance d'état des scènes au revisit (#707)

Quand le groupe QUITTE puis REVIENT dans une scène déjà visitée, ses mutations de jeu sont conservées
— une couche d'INSTANCE par `sceneId` (`sceneInstances`, `src/state/store.ts`) capture le delta au
départ et le réapplique au clone frais du document à l'entrée (`transitionTo`). Le document projet
reste la SOURCE (rééditable) ; l'instance est superposée, sérialisée dans la save, répliquée en coop.

**Ce qui PERSISTE au revisit** : les entités RETIRÉES (décor `interact.consume` fouillé, PNJ tués en
combat), les portes/structures/tuiles OUVERTES/ABATTUES/EFFONDRÉES (flags de `scene.flags`), et les
fouilles non-consommées (flags `__fouille` globaux).

**Ce qui NE persiste PAS (limite ASSUMÉE)** : une entité SPAWNÉE au runtime (présente en jeu mais
ABSENTE du document authored) disparaît au revisit — un auteur qui veut un objet/PNJ persistant le
PLACE dans le document de scène, il ne le spawne pas. Patron de recette :
`src/scenes/test-scenarios/99-revisit.ts` (fouiller un coffre + ouvrir une porte, aller-retour de
scène, tout reste en l'état).

## 10. Objectifs courants (`setObjective` / `clearObjective`)

Réponse à « je fais quoi maintenant ? » (#238, corollaire de « personne ne lit le journal ») : une PILE
d'objectifs (`store.objectives`, `{ id, text }[]`) affichée par un bandeau discret mais TOUJOURS visible
en exploration (`src/ui/ObjectiveBanner.tsx`, masqué en combat). Le plus RÉCENT est en tête ; plusieurs →
dépliable.

- `setObjective { id, desc } & ScheduleSpec` — pose OU met à jour (re-poser le même `id` STABLE remplace
  sa `desc` et le remonte en tête). `desc` = consigne joueur verbatim (`Prose`-safe : pas d'id de code ni
  de réf RAW brute). Une `ScheduleSpec` optionnelle (#668) pose `Objective.deadline` (minute absolue) →
  compte à rebours affiché en puce par `ObjectiveBanner`.
- `clearObjective { id? }` — retire l'objectif `id`, ou TOUS si `id` absent (fin d'acte).

La pile TRAVERSE les scènes (persistée hors `stateFields`, comme `flags`) et n'est vidée qu'en nouvelle
partie (`startScene`). Chaque pose/maj/retrait est aussi archivé au `journal`. L'étalon de campagne câble
les objectifs acte par acte (passage dédié) — l'auteur n'a rien à coder en dur.

### 10bis. Échéances (`ScheduleSpec`, `delayedEffect` & `setObjective`)

`ScheduleSpec` (`src/engine/clock.ts`) est le vocabulaire UNIQUE d'échéance, partagé par `delayedEffect`
(déclenche un `Flow` à l'échéance) et `setObjective` (pose `Objective.deadline`, compte à rebours). Résolu
en minute absolue par `scheduleAt(now, spec)` — priorité `atDate` > `afterDays` > `afterMinutes` >
`atHour`/`atMinute` seuls (prochaine occurrence) :

- `afterMinutes` — dans N minutes depuis maintenant.
- `afterDays` (+ `atHour`/`atMinute` optionnels, défaut minuit) — dans N jours, à l'heure dite.
- `atDate: { year?, month, day, hour?, minute? }` — date impériale ABSOLUE ; `year` absent = année
  courante de la partie. ⚠ `month` est **0-based** (index de `IMPERIAL_MONTHS`, `src/engine/clock.ts`) —
  l'ÉDITEUR (`ScheduleSpecFields`, `src/ui/editor/ScheduleSpecFields.tsx`) MASQUE ce détail derrière un
  select de mois PAR NOM ; l'auteur ne saisit jamais l'index.
- `atHour`/`atMinute` seuls (aucun autre champ) — prochaine occurrence de cette heure du jour.

Une échéance déjà passée à la pose (date antérieure, ou `afterDays:0` avec l'heure du jour déjà écoulée)
donne `executeAt <= now` : ce n'est PAS une erreur — l'effet/l'objectif tire au tout prochain
`advanceTime` (repos, voyage, avance de temps), comme tout `delayedEffect` en retard.

## 10ter. Bloc narratif (`narratif`, paquet auto-suffisant #765)

Un paquet de campagne porte un bloc `narratif` (frère de `scenes`/`worldMap`, au NIVEAU
projet — jamais per-scène), typé `NarratifBlock` (`src/state/campaignNarratif.ts`) :

```
narratif: { affaires: Affaire[]; indices: Indice[]; presetsPnj: PresetPnj[]; objets: TrappingData[];
            ouverture?: OuvertureBlock; cloture?: ClotureBlock }
```

- **`affaires`** (`Affaire`) — fils d'enquête ; **`indices`** (`Indice`, `kind: 'indice' | 'rumeur'`)
  rattachés à une affaire (`affaireId`), révélés par `stades` (`IndiceStade`, prose verbatim quand `source` est posé, maison sans) et
  recoupés par `refs` (ids d'autres indices) ; **`presetsPnj`** (`PresetPnj`) — PNJ pré-composés (`base`
  = id d'une créature globale surchargé par `profil`/`apparence`) ; **`objets`** (`TrappingData`) —
  possessions propres à la campagne.
- **Frontière RÉFÉRENCE vs NARRATIF.** Le narratif RÉFÉRENCE la règle globale (`src/data`) PAR ID
  (`base` → id de `creatures.json`), il ne la copie PAS et n'entre JAMAIS dans `src/data` global : c'est
  du contenu EMBARQUÉ dans le JSON, révélé seulement en jeu. `narratifSchema`
  (`src/data/schemas/defs-scenes/narratif.ts`, composé par `projetSchema`) garde cet invariant
  fail-fast au parse : aucun id narratif ne peut collisionner avec un id global (créature/possession),
  `affaireId`/`refs`/`base` doivent résoudre, ids internes uniques.
- **Identité (à plat).** Le paquet porte aussi son identité de campagne (`ProjectIdentite`,
  `src/state/worldMap.ts`) — champs PLATS à la racine du document depuis #1467 L1b, sans poche
  intermédiaire : `id`/`label`/`versionContenu` forment un trio TOUT-OU-RIEN, `icon`/`desc`/`auteur`
  sont optionnels. `versionContenu` est le numéro de CONTENU de l'auteur ; la version de FORME du
  document est `schema`. Identité pour la bibliothèque (#766), REQUISE par la porte : un document sans
  `id`, `label` ou `versionContenu` est refusé en nommant le champ (#1552,
  `src/data/schemas/defs-scenes/projet-schema.test.ts` cas (d bis)).
- **Migration.** La forme courante du document est `SCHEMA_PROJET` (`src/data/schemas/defs-scenes/projet.ts`) ;
  un document d'une forme antérieure monte au format courant au chargement, un saut de forme par entrée
  de `PROJECT_MIGRATIONS` (`src/state/worldMap.ts`). La fabrique UNIQUE du document est
  `documentDeProjet` (`src/state/worldMap.ts`) : l'éditeur y passe, et les générateurs y délèguent par
  `projectDoc` (`scripts/campagne/lib.mjs`). Les paquets committés (corpus `listerProjetsLivres`,
  `scripts/guards/lib/projetsLivres.mjs`) sont produits par un générateur, sauf ceux nommés dans
  `MANUSCRITS` de `src/scenes/generateurs-byte-stables.test.ts` — « La Diligence »
  (`src/scenes/diligence/diligence-projet.json`, doctrine `user-doctrine-campagne-jamais-generee-par-script`) ;
  tous passent `parseProject` en CI (`src/scenes/bundled-projects.test.ts`).
- **Éditeur.** Le bouton « Narratif » (`src/ui/editor/EditorToolbar.tsx`) ouvre le viewer
  `src/ui/editor/NarratifEditor.tsx` (onglets Cadre/Affaires/Indices/PNJ/Objets).
- **Instancier un PNJ nommé dans une scène (`presetId`, #671).** Une `SceneEntity` (ou un `AuthoredEnemy`
  terse) porte `presetId` = l'id d'un `narratif.presetsPnj`. Présent, l'entité est INSTANCIÉE
  « base globale + surcharges du preset » (jamais depuis `ref`/`statblock`) : `resolvePresetCreature`
  (`src/state/campaignData.ts`) résout le preset, `mergeCreatureProfile` fusionne `base` (`findCreatureById`)
  et `profil` AU NIVEAU CHAMP (`char` par caractéristique ; `skills`/`talents`/`traits`/`spells` remplacés
  en bloc si présents). Au spawn de rencontre (`combatSlice`), la créature mergée et `preset.apparence` sont
  passées à `spawnEnemy` (canal `presetCreature`) ; le portrait de dialogue (`gameIso/tokenBodyKind.tsx`)
  dérive le rig de `preset.base`/`preset.apparence`. Couche non chargée / preset irrésoluble → `FicheAbsente`
  (`src/state/sceneNpc.ts`, #1882), jamais un PNJ générique. `parseProject` valide fail-fast (clause `presetId` de
  `projetSchema`) que tout `presetId` de scène résout un preset déclaré. Curation (#680) : un profil imprimé
  partagé par plusieurs PNJ = UN preset ; un statbloc complet porte `optionals: []` ; sa prose est une
  ADRESSE (`profil.descRef`, dérivée par `judge`, `scripts/source/derive-decoupes.mjs`) dans le livre de
  `source`, jamais le texte recopié.
- **Prose adressée : forme dépôt, forme servie.** Sur le disque, un nœud adressé ne porte que `descRef` ;
  le plugin `wfrp:prose-source` (`scripts/source/prose-source-plugin.mjs`) matérialise son `desc` dans le
  module servi, pour tout document de `RACINES_PROSE` (catalogues ET projets livrés). `parseProject`
  refuse la forme dépôt (cause `prose-non-materialisee`, chemins nommés) : un lecteur Node d'un projet
  livré passe par `lireProjetLivre` (`scripts/source/projetLivre.mjs`), `dev-validate` lit le disque en
  `?raw`. L'export portable garde `desc` ET `descRef` ; « Exporter forme dépôt » (§1) passe par
  `projetVersDepot` (`src/state/worldMap.ts`) : prose ET ports par référence ramenés à leur forme
  canonique.

## 10quater. Cadre du chapitre : ouverture cérémonielle et clôture (`narratif.ouverture` / `.cloture`, #717)

Deux clés OPTIONNELLES du bloc narratif encadrent un chapitre. Absentes, la campagne démarre
directement sur sa scène d'entrée et ne se ferme jamais — aucun paquet existant n'est touché.

- **`ouverture`** (`OuvertureBlock`, `src/state/campaignNarratif.ts`) : `surtitre?`, `titre`,
  `sousTitre?`, `chapitre?`, `pitch` (Markdown), `source?`, `ambiance?` (`veillee` | `parchemin`,
  défaut `veillee`). `loadProject` la pose dans `pendingOuverture` **après** `startScene` (qui remet
  l'état à l'init) ; `CampaignView` monte alors `CampaignOpeningScreen` par-dessus la vue. Le `pitch`
  est verbatim quand `source` est posé (règle stricte 5) ; sans `source`, texte maison (fiche `user-doctrine-regle-5-campagne-repliques-et-narration-maison`) ;
  rendu par `<Prose>`. Un pitch sourcé se vérifie au fichier `Source/` — garde transverse sur tout paquet livré qui déclare un `source`
  (`src/scenes/bundled-projects.test.ts`, livre résolu par `books.json`), jamais à l'œil.
- **`cloture`** (`ClotureBlock`) : `when` (`Condition`), `titre`, `sousTitre?`. Le `when` est ÉVALUÉ
  au contexte HORS COMBAT (`condCtx`, `src/state/bourseFlow.ts`) — même sous-ensemble borné qu'un
  `when` de carte (`CONDITION_KINDS_CARTE`), sinon la Condition serait FAUSSE en silence. Il est relu
  APRèS CHAQUE lot d'effets appliqué (`applyEffects` → `armChapterRecapIfDue`), jamais par un
  branchement dans `setFlag` : une clôture peut dépendre de l'horloge, du groupe ou de la bourse.
- **Le récap est une DIFFÉRENCE.** « Prendre la route » pose la borne `chapitreDepuis` (PX par héros,
  vivants, date) ; l'Effet `clearObjective` DÉPLACE désormais l'objectif soldé dans `objectifsSoldes`
  au lieu de le perdre. `ChapterRecapScreen` en dérive PX du chapitre, chronique, tombés en chemin et
  lieux révélés, puis enchaîne sur la fin de séance (`SessionEndBody`, même formulaire que le menu
  système). Aucun journal parallèle n'est écrit.
- **Édition.** Onglet « Cadre » du `NarratifEditor` (champs texte, pitch, ambiance, `ConditionEditor`
  pour la clôture) — le cadre est de la DONNÉE de campagne, jamais du texte au catalogue i18n.

## 11. Règles d'or

- **IDS partout** — `ref`/`skill`/`spell`/`weapon`/`species`/`tenue`/`trappingId`/`factorId`/`roleId` sont
  des ids STABLES. Un libellé est un défaut silencieux (poison). Doctrine : CLAUDE.md, encadré « id STABLE ».
- **Personne ne lit le journal** — tout dénouement pertinent est une surface VISIBLE au moment (dialogue,
  modale, effet à l'écran), le `journal` ne fait que rappeler.
- **Aucun texte technique dans un texte joueur** — un `node.desc`/`journal` est rendu VERBATIM par
  `Prose` (`src/ui/Prose.tsx`) : ni identifiant de code, ni tag d'auteur (`[INEXPRIMABLE]`), ni citation
  RAW brute (`MDG 14 l.45`). Les constats d'authoring vont dans un journal `docs/plans/`, jamais en jeu.
- **Prose = verbatim source, Markdown** (CLAUDE.md règle 5) — jamais de reformulation ni de HTML. Exception
  du paquet de campagne : une réplique absente du livre s'authore maison, et une description destinée au MJ
  se reformule en texte lu à l'écran même quand le livre la porte — l'une et l'autre SANS `source`, et
  toutes deux passent devant un juge esprit (skill `adapter-une-campagne`, étape 8) ; le verbatim n'y
  tient plus que pour les documents et les règles (fiche
  `user-doctrine-regle-5-campagne-repliques-et-narration-maison`).

## 12. Tous les Effects de scène (carte générée)

Le vocabulaire COMPLET des `Effect` posables dans un `Flow` (choix de dialogue, `onVictory`, trigger,
`delayedEffect`…) vit dans `docs/campagne-effects.md` — carte GÉNÉRÉE depuis les schémas zod de
`src/data/schemas/defs-scenes/effets.ts` (l'union `effectSchema` ; `npm run docs:effects`, gatée par
`docs:check`), jamais écrite à la main. On y trouve notamment `givePossession` (attribue une bête/serviteur/véhicule au registre `state.possessions`,
socle possessions #615) à côté de `giveTrapping`/`giveMoney`/`giveXp`, et l'`EffectOp` (pont vers le
moteur mécanique/GameOp).
