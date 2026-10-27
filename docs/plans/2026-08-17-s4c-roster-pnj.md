# S4-c — Persistance des PNJ hors combat + roster d'habitués à fiche (design)

Ticket: #2999


> **Plan DATÉ du 2026-08-17** (politique `docs/`) — à SUPPRIMER une fois exécuté ; git porte l'historique.
> Transféré du chantier #1279 (CLOS, solde `.claude/soldes/1279.md`) comme design commissionné à part.
> **Révision 3** — amendée après verdict du juge de design (voie A confirmée, 3 bloquants + 12 amendements), puis **arbitrages TRANCHÉS par l'utilisateur le 2026-08-17** (§5, repliés dans §3.2/§3.3/§3.5 et L1-L4).
> Ce document ne contient AUCUN code livré : il tranche, chiffre et nomme les gardes.
> **Lancement ARBITRÉ (utilisateur, 2026-08-18, via AskUserQuestion)** : « Après la résorption #1318 » — le chantier démarre une fois E3/E1/E6/E8 soldés, jamais en parallèle de la cible zéro.

---

## 1. La vision et ses verbatims

**Directive utilisateur (2026-08-14, verbatim, commentaire « DIRECTIVE UTILISATEUR : on joue contre des GENS, jamais contre une valeur » de #1279)** :

> « Ca a toujours été aburde pour moi qu'on joue contre une personne qui n'a qu'une valeur, c'est même contre le RAW non ? On joue forcement contre des gens ? »

Précédée de sa prise sur l'asymétrie d'attrition (même fil, verbatim) :

> « pourquoi l'adversaire n'est pas exténué comme mon personnage ? »

Recadrage antérieur du même arc (2026-08-13, verbatim, #1279) :

> « Drole de question, encore un peu et tu vas m'annoncer que la course poursuite se joue contre nos propres héros ou contre une valeur fictive plutot que des vrais adversaires »

Et les cas d'usage nominaux (2026-08-13, verbatim, #1279) :

> « Ou de jouer contre notre chere ami PNJ gnome dans NADJ dans la taverne a ses petits jeux amusant, ou contre le bretonien a la taverne du tome 1 de la campagne »

### 1bis. Ce que le RAW dit exactement (vérifié au `Source/`, pas au brief)

`Source/Warhammer v4 - Nuits agitees & dures journées/16 - JEUX DE TAVERNE.md` :

- l.11 (régime rapide) — verbatim : « effectuez un **Test opposé** de **Compétence Intermédiaire (+0)** en utilisant la Compétence indiquée dans la section « Jeu » du jeu en question. Si aucune Compétence n'est indiquée (comme pour *Al-zahr*), faites plutôt un Test opposé de **Pari Intermédiaire (+0)**. Celui qui obtient le nombre le plus élevé de DR remporte la partie. »
- l.34 (Bras de fer) — verbatim : « faites un Test opposé étendu de **Force Intermédiaire (+0)** ; à chaque tour, ajoutez votre Bonus de Force au nombre de DR que vous avez obtenus. Le gagnant de chaque tour gagne +1 Avantage […]. Le premier **Personnage** qui atteint au moins 10 DR est le vainqueur. **Pour chaque Bonus d'Endurance tours qui passent sans que personne n'ait gagné, vous gagnez + 1 État *Exténué*** (que vous pourrez récupérer après 5 minutes de repos). »
- l.17 (Al-zahr) — verbatim : « **chaque joueur** ajoute une mise égale au pot. […] les spectateurs (et les joueurs) parient sur les résultats de chaque lancer. »
- l.19 (Al-zahr, « Spécial ») — verbatim : « les Points de Chance peuvent être utilisés à votre tour pour relancer votre jet. De plus, le Talent Maîtrise des dés vous permet de lancer 1 dé supplémentaire par niveau de Maîtrise des dés […] »

**Lecture honnête** : le RAW ne connaît que des **Personnages** aux deux bouts (Test *opposé*, « chaque joueur », « le premier Personnage »), et l'attrition est écrite à la 2ᵉ personne avec un intervalle **propre au porteur** (« pour chaque Bonus d'Endurance tours ») — donc individuelle et symétrique **par construction**. Ce que le RAW ne fait PAS : interdire explicitement une valeur de difficulté fixe. La valeur nue n'est donc pas une infraction nommée ; c'est une **forme absente du RAW**, héritée du POC, qui rend inapplicables toutes les règles visant une personne. C'est cette inapplicabilité qui est le défaut, et elle est mesurable (§2).

### 1ter. ⚠ RÉFUTATION MESURÉE — la Chance n'est PAS « héros-only » au RAW

Le verdict de design demandait d'inscrire ici « la Chance reste héros-only (`types.ts:1509`, LDB 17 l.9), asymétrie RAW-correcte ASSUMÉE ». **Le `Source/` dit le contraire de sa propre réf.**

`Source/Warhammer v4 - Livre de base version corrigée/17 - Destin et Résistance.md` l.9, **verbatim** :

> « Seules certaines rares personnes possèdent des Points de Destin et de Résilience. Dans la pratique, ce sont les Personnages Joueurs. **Vous pouvez décider d'attribuer des Points de Destin et de Résilience à certains PNJ importants**, comme ce nécromant qui est une némésis des PJ, ou une sommité locale, ou un chef de culte récurrent. »

Trois conséquences :

1. **Le commentaire `src/engine/types.ts:1509` est du poison de classe (a)** (CLAUDE.md règle 6) : « Destin / Résilience (héros uniquement, LDB 17 l.9) » **paraphrase à l'envers** la ligne qu'il cite. À réduire à sa réf nue, au site, hors de ce chantier (rapporté en annexe).
2. L'asymétrie actuelle (Chance/Destin absents des PNJ) est un **fait d'implémentation**, pas une lecture du RAW — elle ne peut donc pas être « assumée comme RAW-correcte ».
3. Sous la **règle 7** (« pas de MJ »), « Vous pouvez décider » est précisément un point laissé à l'arbitre : il reçoit un arbitrage EXPLICITE en **donnée éditable** (des Points de Destin/Résilience attribuables à un PNJ nommé), jamais une interdiction structurelle silencieuse. Les champs existent déjà et sont **optionnels** sur `Combatant` (`types.ts:1510-1513`) : la donnée peut les porter sans changement de type.

L'arbitrage utilisateur porte donc sur **le contraire** de ce qui était proposé (§5, arbitrage 5).

---

## 2. L'état mesuré (arbre du 2026-08-17, post-clôture #1279)

### 2.1 Ce qui EXISTE déjà (le grounding S4-c a vieilli — la taverne joue DÉJÀ des PNJ à fiche)

| Fait mesuré | `fichier:ligne` |
|---|---|
| Trois formes d'adversaire de taverne, coexistantes : `hero` / `npc` / `abstract` | `src/state/tavernFlow.ts:83-86` |
| Un PNJ de scène est dérivé en `Combatant` par le MÊME chemin que le spawn de rencontre (`presetId` → `resolvePresetCreature` → `spawnEnemy`) | `src/state/tavernFlow.ts:137-145` |
| Résolveur d'acteur de partie : `actorIn(get(), id) ?? tavernNpc(get().scene, id)` | `src/state/tavernFlow.ts:149-152` (le brief disait « ~:144 » — écart de 5 lignes) |
| Les valeurs de Test de l'adversaire à fiche viennent des collecteurs canoniques (`testValue`/`effectiveChar`), jamais recopiées | `src/state/tavernFlow.ts:116-120`, `:344-349` |
| Ce que la CARTE décide : `SceneEntity.tavernGame = { gameId, stakeBrass? }` | `src/state/scene.ts:108-111` |
| **Seul** exemple réel authoré : Phillipe Descartes propose une partie, mise 24 sous | `src/scenes/test-scenarios/96-presets-edo.ts:202` |
| Persistance d'INSTANCE de scène (#707) : delta d'entités retirées + flags, capturé/réappliqué au revisit | `src/state/sceneInstance.ts:9-37`, `src/state/store.ts:1964-1977` |
| Manifeste UNIQUE des champs transitoires (valeur initiale + contextes de reset `scene`/`combatStart`) | `src/state/stateFields.ts:34-146`, `resetFields` `:162` |
| Couture UNIQUE de changement de scène | `src/state/store.ts:1944-2002` (`transitionTo`) |
| `snapshotSave` embarque GÉNÉRIQUEMENT toute clé de l'état initial | `src/state/saves.ts:91-115` (`for (const k of Object.keys(initial))`) |
| Précédent mesuré : une save d'AVANT l'ajout d'un slot (clé absente) restaure la valeur initiale par un vrai `loadGame`, sans entrée de migration | `src/state/sceneInstance.test.ts:169-180` |
| Notification de mutation EN PLACE : patron documenté + helper | `src/state/combatOrParty.ts:12`, `:28-31` (`touchActors`) |
| Le broadcast coop s'abonne au STORE (donc à un `set`, pas à une mutation) | `src/state/netFlow.ts:248` (`useGame.subscribe(() => scheduleBroadcast(get))`) |

> **Deux précisions de fixture** (amendement 12) : « Plantule » (`pnj-plantule`) n'est **pas** un PNJ authoré du jeu — c'est une fixture de `src/state/tavern-npc-a-fiche.test.ts:81`, à ne pas citer comme cas d'usage livré. Et l'offre de Phillipe Descartes porte `gameId: 'dominos'` (`96-presets-edo.ts:202`) alors que le scénario prescrit **L'Impératrice Écarlate** : **substitution provisoire**, à corriger quand l'entrée de catalogue le permettra — un PNJ nommé qui propose le mauvais jeu est une dette de contenu, pas un choix.

### 2.2 Le trou, mesuré

| Fait mesuré | `fichier:ligne` |
|---|---|
| **Aucun registre de personnes hors combat** : `actorIn` = `battle.combatants ?? party`, point | `src/state/combatants.ts:19-21` |
| `tavernNpc` est une dérivation **ÉPHÉMÈRE** : elle fabrique un `Combatant` neuf à chaque appel — la dette est dite au code | `src/state/tavernFlow.ts:129-135` |
| L'attrition résout ses porteurs par `actorIn` : un PNJ n'est jamais trouvé, l'op tombe dans le vide | `src/state/sequenceCore.ts:367,375-381` |
| Le dispatcher d'effets sur échec de Test résout AUSSI par `actorIn` quand on lui passe un id | `src/state/triggeredEffects.ts:449-452` (`fireOwnTestFailed`) |
| `applyOps` **mute `target` en place** — et **aucun test ne fige ce contrat** (dépendance implicite, ~65 fichiers) | `src/engine/ops.ts:1223-1229` |
| Une mutation en place **sans `set`** ne produit **ni re-rendu ni broadcast coop** | `src/state/combatOrParty.ts:12`, `src/state/netFlow.ts:248` |
| Bourse : `creditBourse`/`debitBourse` mappent `s.party` — **party-only**, et **immutables** (`withBourseMoney` clone) | `src/state/bourseFlow.ts:51-71` |
| Le versement de fin de partie ne crédite que le challenger (groupe) | `src/state/tavernFlow.ts:1524`, `:2438` |
| **Le marchand n'a même pas de fiche** : son opposition est une valeur d'archétype nue | `src/state/merchantFlow.ts:817` (`merchantValue: arch?.bargainSkill ?? 40`) |
| La Poursuite joue toujours contre des valeurs nues (`movement: number`, `skill: number`) | `src/state/pursuitFlow.ts:60-64` |
| Défaut adjacent MESURÉ : `sceneFearSources` dérive sans `presetId` — un PNJ nommé par preset y devient une fiche générique (les deux autres sites, eux, l'honorent) | `src/state/encounterPsychFlow.ts:50-53` vs `src/state/tavernFlow.ts:140` et `src/state/combatSlice.ts:2643` |

**Le trou en une phrase** : trois sites dérivent la même personne trois fois, en jetant le résultat à chaque appel ; aucun ne peut RECEVOIR quoi que ce soit (État, sou, effet déclenché), parce qu'il n'existe aucun endroit où le déposer — et même si l'on déposait, personne ne serait prévenu.

### 2.3 Dépendance dure à nommer

**#1342** — `creatures.json` porte **387 specs de Compétence par LIBELLÉ sur 1450** (≈ 27 % des specs du gisement, *pas* 27 % des créatures : la répartition par entité n'est pas mesurée), et `resolvePresetCreature` (`src/state/campaignData.ts:72`) ne valide ni ne normalise. Toute fiche d'habitué tirée de ce gisement peut porter des avances **silencieusement perdues** (`testValue` compare strictement, `src/engine/skills.ts:78`). Conséquence de séquencement au §4 (L4).

---

## 3. Le design tranché

### 3.1 La voie : **(A) slot additif `npcRoster`, + un résolveur canonique unique** — voie B écartée

**Retenu** : un slot de `GameState` additif, `npcRoster: Record<string, RosterNpc>`, déclaré au manifeste `stateFields.ts` ; et **UN** résolveur canonique `personIn(state, id)` (= `actorIn` ∪ registre), posé dans le module feuille `src/state/combatants.ts`, que les flux consomment à la place du patron ad hoc `actorIn(...) ?? tavernNpc(...)`.

**Pourquoi pas (B) élargir `actorIn`** — trois arguments mesurés :

1. **Périmètre des appelants** : **142 occurrences mesurées** de `actorIn(` dans `src/` au 2026-08-17 — **139 hors test**, réparties sur **25 fichiers de production** (dont la déclaration elle-même, `combatants.ts:19`), soit ~138 appels réels. La quasi-totalité est du combat (`rollFlowSpecs.ts:246-779`, `combatSlice.ts`, `combatEffects.ts`, `combat/triggeredTest.ts`, ciblage, IA). Élargir la sémantique fait apparaître des PNJ hors combat comme cibles/porteurs légitimes du moteur de combat **sans qu'aucun de ces sites ne l'ait demandé**.
2. **Doctrine « le socle résout, les feuilles adressent »** : le socle à faire résoudre n'est PAS « qui est ce combattant en combat » (`actorIn` le résout déjà bien), c'est « **qui est cette PERSONNE, où qu'elle siège** ». Deux questions ; les confondre, c'est faire adresser au socle du combat une question de scène. `personIn` est le socle de la NOUVELLE question ; les feuilles (taverne, marchand, poursuite, psychologie) l'adressent.
3. **Invariant d'import** : `combatants.ts` est sans import runtime (garde `netownership-import-isole.test.ts`, en-tête `:1-13`). `personIn` ne lit qu'un `Record` de l'état — **aucun** import ajouté. La dérivation depuis la scène (`spawnEnemy`/`resolvePresetCreature`, lourde) reste **hors** de ce module : elle vit au SPAWN (§3.3), pas à la lecture.

**Migration de save : AUCUNE.** `snapshotSave` itère les clés de l'état initial (`saves.ts:98`) → le slot entre au snapshot le jour où il entre au manifeste ; une save écrite avant restaure la valeur initiale par un vrai `loadGame` — **précédent mesuré et testé** (`sceneInstance.test.ts:169-180`, patron `sceneInstances`/`tradeRumours`). `SAVE_VERSION` (25, `saves.ts:49`) **ne se bump pas** : rien à transformer.

**CONTRAT GELÉ exigé (bloquant, amendement 4)** — tout ce design repose sur un comportement de `applyOps` qu'**aucun test ne nomme aujourd'hui** : `applyOps(target, …)` **mute `target` en place** (`ops.ts:1223-1229`), ce dont ~65 fichiers dépendent **implicitement**. L1 livre un test NOMMÉ qui fige ce contrat (point de départ : la sonde du juge, `scratchpad/sonde-s4c.mts`) — sinon un refactor d'`ops.ts` vers l'immutabilité casserait le registre **en silence**, et le rouge tomberait à trente endroits sans dire pourquoi.

### 3.2 Le schéma du registre

```
npcRoster: Record<string /* id de personne */, RosterNpc>

RosterNpc {
  actor: Combatant        // LA fiche vivante (l'état courant de la personne)
  origin:                 // d'où elle vient : re-dérivable, auditable, rejouable
    | { kind: 'scene'; sceneId: string; entityId: string }              // PNJ authoré
    | { kind: 'draw';  sceneId: string; tableId: string; seed: number } // habitué tiré
  persist: 'scene' | 'place' | 'campagne'
}
```

- **`actor` est la fiche, pas une copie de valeurs.** Toute valeur de Test se redemande aux collecteurs canoniques (`tavernGameValue` → `testValue`/`effectiveChar`, `tavernFlow.ts:116-120`). Aucun champ `skill: number` ne descend dans le registre — ce serait rouvrir la valeur nue par la fenêtre.
- **`persist: 'scene' | 'place' | 'campagne'` — TRANCHÉ (utilisateur, 2026-08-17)** : la portée **LIEU** entre au schéma, elle n'est plus une option. `'place'` s'ancre sur le `MapPlace` de `state.worldMap` — l'id `placeId` **existe déjà** et sert déjà d'ancre de persistance aux possessions (`engine/possession.ts:23`, `{ kind: 'au-lieu'; placeId }`) et aux écrans Port/Marché (`portFlow.ts:63`, `landMarketFlow.ts:61`) : rien n'est inventé. Le travail réel est le **rattachement d'une Scène à son `MapPlace`**, qui n'existe pas aujourd'hui (`scene.ts` n'a aucune notion de lieu) — il vit en **L1** (+1 j), parce que c'est lui qui détermine la clé de purge. Conséquence de jeu : un habitué **survit à un aller-retour entre deux scènes du même lieu** (sortir de la salle commune vers la cour de l'auberge ne le fait pas disparaître), et ne meurt qu'en quittant le lieu.
- **Frappe des ids (amendement 9)** — l'unicité doit porter sur la **PERSONNE**, pas seulement sur la chaîne :
  - `origin.kind === 'scene'` → id = **l'id d'entité de scène** (`entityId`). Une entité = une personne, garanti par le document de scène. Aucune collision possible.
  - `origin.kind === 'draw'` → id **frappé** `npc:<sceneId>:<tableId>:<n>`, où `n` est le **rang de tirage dans le lieu**, jamais l'id de créature. Conséquence voulue : deux « bateliers » tirés dans la même taverne sont **deux hommes distincts** (rangs 1 et 2 — deux entrées, deux bourses, deux Exténués) ; et le **même** homme redemandé au même rang est **le même** (idempotence). Un id dérivé du seul `creatureId` produirait l'erreur inverse — un batelier unique se dédoublant ou fusionnant selon l'ordre des appels.
  - Un id de registre ne peut jamais entrer en collision avec un id de héros : les héros n'ont pas de préfixe `npc:`, et l'ordre de résolution de `personIn` (héros d'abord) rend la préséance explicite.

### 3.3 Cycle de vie

| Moment | Geste | Couture |
|---|---|---|
| **Entrée** | **Paresseuse**, jamais un spawn de masse : la première fois qu'un flux demande une personne absente, il l'y **inscrit** (dérivation `spawnEnemy` + `presetId`, une fois — celle de `tavernNpc:137-145`, remontée en `enrollSceneNpc`). Une salle de 30 figurants ne coûte rien tant que personne ne leur parle. | nouveau `state/npcRoster.ts` |
| **Vie** | Toute écriture passe par le geste d'écriture UNIQUE `withNpc` (§3.3bis) — qui **produit un `set`**. Sans lui : ni re-rendu, ni broadcast coop (`netFlow.ts:248` s'abonne au store ; sonde du juge : **0 notification** sur mutation en place). | `npcRoster.ts` |
| **Notification** | `touchActors` (`combatOrParty.ts:29-31`) prend une **3ᵉ branche** et un paramètre `actorId?` : il ne peut pas deviner qui a muté. Il reste le **filet** des chemins hérités (Chance/Résilience) ; il n'est **pas** le régime nominal du registre. | `combatOrParty.ts` |
| **MORT** (amendement 6) | Un PNJ qui meurt **sort du registre**, et sa mort se réconcilie avec la scène : son entité rejoint `removedEntityIds` (`sceneInstance.ts:10`, déjà le canal des « PNJ tué »). Sans cette ligne, **Phillipe mort continue de proposer sa partie** (`tavernNpcOffers` lit les entités de scène, `tavernFlow.ts:159-168`) — et l'offre d'un mort est le genre de bug qui survit six mois. | `npcRoster.ts` + `transitionTo` |
| **Sortie de scène / de LIEU** | Dans `transitionTo` (`store.ts:1978`), une purge **sélective** à trois portées : `persist: 'scene'` part dès que `origin.sceneId ≠ scène cible` ; `persist: 'place'` **survit tant que la scène cible appartient au MÊME `MapPlace`** (clé de purge fournie par le rattachement Scène→`MapPlace` de L1) et part en quittant le lieu ; `'campagne'` traverse tout. Le slot est `resetOn: []` au manifeste (patron `sceneInstances`, `stateFields.ts:126`) — la purge est explicite, jamais un reset de scope. | `store.ts` + `stateFields.ts` |
| **Nouvelle partie** | Vidé avec le reste (patron `sceneInstances`, `sceneInstance.test.ts:133-141`). | `startScene` |

### 3.3bis — RÉGIME DE MUTATION UNIQUE (bloquant tranché : **IMMUTABLE**)

**Le bloquant mesuré** : la révision 1 exigeait en L1 l'**identité référentielle** — `personIn` rendant l'objet stocké, muté en place par `applyOps` (L2). L3 (bourse) est, lui, **immutable** : `withBourseMoney` clone (`bourseFlow.ts:51-58`) puis `set` remplace le tableau. Les deux régimes dans le même registre donnent une personne dont l'Exténué s'écrit sur l'objet stocké et dont la bourse s'écrit sur un **remplaçant** : la première écriture est perdue à la seconde. **L2 et L3 étaient incompatibles.**

**Tranché : le registre est IMMUTABLE, avec un geste d'écriture unique.**

```
withNpc(get, set, id, mutate: (draft: Combatant) => string[]): string[]
   // 1. clone la fiche courante          (structuredClone — patron withBourseMoney)
   // 2. laisse `mutate` la muter EN PLACE (contrat gelé d'applyOps, §3.1)
   // 3. set({ npcRoster: { ...s.npcRoster, [id]: { ...e, actor: clone } } })
```

Trois raisons, toutes mesurées, aucune esthétique :

1. **La notification devient structurelle au lieu d'être ajoutée.** Le régime en place exigeait de se *souvenir* d'appeler `touchActors` à chaque site — exactement la classe de bug que `stateFields.ts:5-8` documente pour les resets ad hoc (« ~3 copies hand-tunées et désynchronisables »). Immutable : le `set` **est** l'écriture, donc re-rendu et broadcast coop (`netFlow.ts:248`) sont acquis par construction.
2. **C'est le patron du store, déjà partout** : Zustand + `set`, `withBourseMoney` (`bourseFlow.ts:51-58`), `sceneInstances`, `tradeRumours`. La mutation en place est l'**exception** documentée (Chance/Résilience) — et `touchActors` n'existe **que** parce que c'est une exception qu'il faut rattraper à la main.
3. **`applyOps` n'a pas à changer** : il mute son argument ; on lui donne un clone. Le contrat gelé du §3.1 protège exactement ce point de jonction.

**Ce que cela corrige dans les lots** : le critère jugeable de L1 n'est **plus** l'identité référentielle (elle verrouillerait la mutation en place) mais l'**identité par ID** — `personIn(state, id)` rend **toujours l'état courant** de la personne, et deux lectures encadrant une écriture rendent des valeurs différentes. L3 n'a alors plus rien à réconcilier : il est déjà dans le régime.

### 3.3ter — Le raccord registre ⇄ combat (section de conception, amendement 7)

C'est **le point dur** : le seul endroit où **deux copies de la même personne** peuvent coexister — son entrée de registre, et son `Combatant` de `battle.combatants` (spawné par `combatSlice.ts:2643`).

Faits mesurés qui cadrent le problème :
- `actorIn` donne la **priorité au combat** (`battle?.combatants ?? party`, `combatants.ts:20`) : pendant un combat, la copie de combat est déjà la seule vue du moteur. `personIn` doit reproduire **exactement** cette préséance, sinon deux moteurs liraient deux fiches.
- La scène est ré-instanciée à chaque transition (`store.ts:1977`, clone + `applySceneMutation`) : rien ne re-dérive automatiquement le registre.

Conception retenue :
1. **À l'ouverture du combat** : si l'entité spawnée a une entrée de registre (même id), le combat part de **la fiche du registre** (blessé, Exténué, appauvri), jamais d'un re-spawn frais — sans quoi un PNJ épuisé au bras de fer entre en combat en pleine forme.
2. **Pendant le combat** : l'entrée de registre est **gelée** (la copie de combat fait foi) ; `personIn` renvoie la copie de combat, préséance identique à `actorIn`.
3. **Au teardown** : la fiche de combat **écrase** l'entrée de registre (writeback) ; un mort déclenche la ligne MORT du §3.3. Sans writeback, un PNJ sort du combat guéri de tout.
4. **Garde** : un test qui fait entrer une personne blessée du registre en combat, la blesse davantage, et vérifie son état **après** le combat — invariant « une personne, un état, quel que soit le banc ».

### 3.4 La source des fiches

Trois gisements, par ordre de priorité, **aucun nouveau format** :

1. **PNJ authoré de scène** (`SceneEntity.presetId` → `resolvePresetCreature`, ou `ref`/`statblock`) — cas nominal des PNJ nommés de campagne (Phillipe Descartes, `96-presets-edo.ts:202`).
2. **Bestiaire** (`creatures.json`, humains de taverne : batelier, soudard, marchand ambulant…) — pour l'habitué tiré. ⚠ **bloqué par #1342** (§2.3, et L4).
3. **`pregens.json`** — **écarté comme source d'habitués** : ce sont des personnages-JOUEURS pré-tirés (8 entrées, `src/data/pregens.ts:121`, motivations/ambitions LDB 05) ; les servir en figurants mélangerait deux populations et rendrait un habitué mieux fiché qu'un héros. Ils restent la source des HÉROS.

**Le tirage** : une table de tirage **en donnée** (id authorable sur le lieu — la carte décide), résolue par le RNG **seedé** (`makeRNG`, `engine/dice.ts:23`), graine consignée dans `origin.seed`, ids frappés selon §3.2. Chaque entrée de table = un id de créature + une plage de richesse. Aucun nom en dur, aucun `if (id === …)`.

### 3.5 Les rebranchements — par quelle couture existante

| Règle de personne | Couture | Ce qui change |
|---|---|---|
| **Attrition des deux camps** (NADJ 16 l.34, Exténué) | `sequenceRoundOps` (`sequenceCore.ts:367`) | `actorIn` → `personIn`, l'`applyOps` routé par `withNpc` quand le porteur est du registre. L'intervalle est déjà par-porteur (`sequenceAttritionEvery`, `:378`) : la symétrie RAW s'obtient **sans nouvelle règle**. |
| **Effets déclenchés sur échec de Test** | `fireOwnTestFailed` (`triggeredEffects.ts:449-452`) | Il résout par `actorIn` quand on lui passe un **id** — donc aujourd'hui un PNJ passé par id est **introuvable** et ses `onOwnTestFailed` ne partent jamais. Passe à `personIn`. |
| **Mises des deux bourses** (l.17) | `bourseFlow.ts:51-71` | `creditBourse`/`debitBourse`/`payWithAllocation` résolvent leur PORTEUR (party ∪ registre) au lieu de mapper `s.party`. Le pot (`tavernFlow.ts:1524`, `:2438`) verse alors des deux côtés. Régime déjà immutable → aucun conflit (§3.3bis). |
| **Talents des deux côtés** (l.19 « Spécial », #1306) | `fireTriggers` (`state/triggeredEffects.ts`) + `passiveMods` (`engine/trauma.ts`) | Ces dispatchers prennent un `Combatant` : le PNJ à fiche devient client de **la moitié TALENT de #1306** (Maîtrise des dés) sans code nouveau. |
| **Destin / Résilience d'un PNJ nommé** (LDB 17 l.9) — **TRANCHÉ « en donnée éditable » (utilisateur, 2026-08-17)** | la DONNÉE elle-même : `fate`/`fortune`/`resilience` sont **déjà optionnels** sur `Combatant` (`types.ts:1510-1513`) | Aucun type à changer : une fiche de PNJ nommé **peut porter** ses Points, et l'authoring les expose. ⚠ La **DÉPENSE** de ces Points sur un lancer hors Test (relance d'Al-zahr, NADJ 16 l.19) reste le seam manquant de **#1306** — hors périmètre S4-c, déjà ticketé : ce chantier rend la donnée possible, il ne livre pas le canal de dépense. |
| **Marchandage** (LDB 59) | `merchantFlow.ts:817` | `merchantValue` (valeur nue d'archétype) meurt : le marchand est une personne du registre, sa valeur de Marchandage se lit à sa fiche, sa bourse devient réelle et **bornée** (arbitrage 3, §5). |
| **Peur/Terreur de rencontre** | `encounterPsychFlow.ts:51-61` | `sceneFearSources` cesse de re-dériver : elle lit le registre. *(Son défaut de `presetId` a été **corrigé dans l'arbre** entre-temps — cf. annexe ; le rebranchement au registre reste dû.)* |

### 3.6 Ce qui NE change PAS — et ce que le slot revendique

**Ne change pas** :
- **Middenball 11v11 et Torchon trempé** : l'arbitrage « Coéquipiers PNJ — valeur unique, pas 7 statblocks » (utilisateur, 2026-08-13, #1279) **TIENT**. Les figurants (`tavernFlow.ts:595-600`, `:660-664`) sont une **foule**, pas des adversaires de duel : hors registre, sans bourse ni État. Seuils RAW (but à +25, 11 danseurs) intacts.
  ⚠ **Réserve nommée (amendement 11)** : **#1302** (tournoi de Middenball complet + paris sportifs) prévoit des **équipes adverses en rosters de PNJ à fiche** (verbatim #1279 : « les équipes adverses sont des rosters de PNJ à fiche »). Ce ticket **rouvrira** légitimement la frontière « foule vs personnes ». Le registre doit donc pouvoir accueillir 22 personnes sans changer de forme — c'est le cas (un `Record`, inscription paresseuse) — mais **l'arbitrage « foule » n'est pas définitif** : il est valide *jusqu'à #1302*.
- **Les seuils de table / capacités DEV & QC** : la forme « valeur » survit comme **outil**, jamais comme adversaire visible (L5 : mort au TYPE, pas suppression du nombre).
- **`actorIn`, `inBattleId`** : sémantique, signatures et invariant zéro-import inchangés.
- **`SAVE_VERSION`**, les 25 migrations, les fixtures de save : inchangés (§3.1).
- **Le socle de séquence** : aucun contrat modifié — un résolveur substitué, une écriture routée.

**Ce que le slot REVENDIQUE (universalité, amendement 11)** — `npcRoster` n'est pas un meuble de taverne. Clients naturels, **non nommés au chantier**, qui n'exigeront aucune forme nouvelle :
- **PNJ de dialogue** — un interlocuteur qui se souvient d'avoir été menacé, blessé, soudoyé (aujourd'hui : rien ne survit à la fermeture de la modale) ;
- **PNJ de quête** — le donneur d'ordre qui garde son état entre deux visites de la même scène ;
- **Marchand** (L5) et **Poursuite** (L6) — deux clients déjà chiffrés ;
- **Bataille de masse / tournoi (#1302)** — rosters adverses ;
- **Attrition hors combat en général** — le seul endroit où une personne non-héros peut porter un État dans la durée.

Le critère d'universalité hérité de #1279 s'applique tel quel : **le registre ne doit prendre la forme d'aucun de ses premiers clients** (aucun champ de taverne dans `RosterNpc`).

---

## 4. Découpage en lots (chiffré, chacun jugeable)

> Le programme **#1318 fait loi** : un verrou par lot. Ordre de préférence : **invariant mort au type > cliquet AST > baseline DÉCROISSANTE datée** ; **aucune baseline sans cible zéro nommée** (directive utilisateur 2026-08-16, verbatim : « Pas de demi-migration ou de guard qui valident l'existent »).

### L1 — Le registre + le résolveur canonique + le contrat gelé + l'ancre de LIEU · **3 j**
Slot `npcRoster` au manifeste (`resetOn: []`), `RosterNpc`, `personIn` dans `combatants.ts` (préséance combat identique à `actorIn`), `enrollSceneNpc` (dérivation remontée, `presetId` honoré), `withNpc` (§3.3bis), `touchActors(state, actorId?)` étendu au registre, purge sélective à **trois portées** + ligne MORT dans `transitionTo`, `tavernActor` supprimé au profit de `personIn`.
**+1 j — l'ancre de LIEU** (arbitrage 1, tranché) : rattacher une Scène à son `MapPlace` (`placeId`), ce qui n'existe pas aujourd'hui. Le travail vit **ICI** et nulle part ailleurs, parce que c'est cette clé qui décide de la purge : sans elle, `persist: 'place'` n'a pas de critère et la portée LIEU serait indistinguable de `'scene'`.
**Jugeable** : (a) `personIn(state,id)` rend **toujours l'état courant** — deux lectures encadrant une écriture diffèrent ; (b) une écriture par `withNpc` **notifie** (abonné de store réveillé — sonde sur `netFlow.ts:248`) ; (c) une save sans la clé charge à `{}` (test calqué sur `sceneInstance.test.ts:169`) ; (d) **test NOMMÉ figeant « `applyOps` mute `target` en place »** (§3.1 ; départ : `scratchpad/sonde-s4c.mts`).
**Verrou (amendement 13)** : viser **l'INVARIANT, pas la forme**. Un cliquet AST sur le motif `actorIn(…) ?? <dérivation>` produit **11 faux positifs mesurés** (replis de label du type `actorIn(...)?.label ?? id`) — il est **écarté**. À sa place : **mort au type** — l'inscription (`enrollSceneNpc`) rend un type *inscrit* (non assignable à un `Combatant` nu obtenu par dérivation libre), de sorte qu'un site qui re-dérive une personne hors registre **ne compile pas**.

### L2 — Attrition symétrique + horloge « le monde vit » · **1 j** *(dépend de L1)*
`sequenceRoundOps` et `fireOwnTestFailed` sur `personIn` ; écriture par `withNpc` ; raccord combat du §3.3ter.
**Horloge — TRANCHÉ « le monde vit » (utilisateur, 2026-08-17)** : les États d'un PNJ du registre **décroissent avec l'horloge du jeu, même hors champ**. Conséquence de design : la récupération ne se déclenche pas à une visite du joueur (ce serait un rattrapage paresseux, donc dépendant de l'observation) mais au **seam horodaté** qui fait déjà vieillir le monde (`advanceTime`) — le PNJ récupère son Exténué au même titre qu'un héros, que le groupe soit là ou non. Le « 5 minutes de repos » de NADJ 16 l.34 est la durée, pas un déclencheur joueur.
**Jugeable** : (a) Bras de fer long contre Phillipe — **l'adversaire gagne son Exténué**, le garde à la partie suivante, et l'écran le montre (notification) ; (b) quitter le lieu, laisser passer le temps, revenir : **il a récupéré** sans qu'aucun geste joueur ne l'ait provoqué. Tests ROUGES avant le lot (mesure de l'asymétrie), VERTS après.
**Verrou** : mort au type — le porteur d'ops de séquence ne s'obtient QUE par `personIn`.

### L3 — Bourse de personne + les deux bornes d'économie · **1,5 j** *(dépend de L1)*
`creditBourse`/`debitBourse`/`payWithAllocation` par PORTEUR ; pot d'Al-zahr symétrique.
**Économie — TRANCHÉ : LES DEUX bornes acceptées (utilisateur, 2026-08-17)**. Livrables nommés : (a) **table de richesse en DONNÉE** — la bourse initiale d'un PNJ tiré vient d'une entrée authorable (plage par entrée de table de tirage, §3.4), jamais d'une constante ; (b) **l'habitué borné cesse de jouer** quand sa bourse est vide (il quitte la table, il ne mise pas à découvert) ; (c) **le marchand ruiné ne rachète plus** jusqu'au réassort. Aucun plancher d'argent, aucun renflouement silencieux : la borne EST l'effet de jeu voulu.
**Jugeable** : (a) l'argent gagné par le héros **sort** de la bourse du PNJ (somme des deux bourses conservée) ; (b) un PNJ vidé refuse la partie suivante avec sa raison à l'écran ; (c) un marchand vidé refuse le rachat. L'asymétrie monétaire d'Al-zahr (arbitrage S2 de #1279) se résorbe **sans règle nouvelle**.
**Verrou** : cliquet à cible 0 sur `s.party.map(` dans les fonctions de bourse.

### L4 — Roster d'habitués en donnée + tirage seedé + Destin/Résilience authorables · **2 j** *(dépend de L1 ; ⚠ #1342)*
Table de tirage authorable, résolution seedée, ids frappés (§3.2), richesse initiale en donnée (table de L3).
**Destin/Résilience d'un PNJ nommé — TRANCHÉ « en donnée éditable » (utilisateur, 2026-08-17)** : livrable **sous l'epsilon de chiffrage** (aucun jour ajouté) — les champs `fate`/`fortune`/`resilience` sont **déjà optionnels** sur `Combatant` (`types.ts:1510-1513`), donc le lot ne fait qu'**exposer** ces champs à l'authoring de PNJ et les valider. Le **canal de dépense** (relance d'un lancer hors Test, NADJ 16 l.19) n'est PAS livré ici : il est le seam manquant de **#1306**. Dit franchement pour ne pas annoncer un complet incomplet — après L4, un PNJ nommé **porte** ses Points sans encore pouvoir les **dépenser**.
**⚠ Séquencement mesuré** : le lot **ne se ferme pas** avant #1342 pour les entités qu'il tire, sinon il livre des habitués aux avances silencieusement mortes (`skills.ts:78`). Options : (a) attendre #1342 ; (b) livrer avec une garde de tirage **fail-fast** refusant une créature porteuse d'une spec-libellé. **Recommandation : (b)** — le lot avance, la dette ne rentre pas. **Mais la casse se mesure AVANT de choisir** : compter combien des **humains de taverne effectivement visés** portent une spec-libellé (387/1450 ≈ 27 % des specs du gisement ; la répartition **par entité** n'est pas mesurée — `savoir/Local` ×94 laisse craindre une forte concentration sur les humains civils, précisément la population du roster). Si la plupart des candidats tombent, **la table de tirage se vide** et le fail-fast livre un lot inerte. Cette mesure est la **première tâche** de L4 et peut basculer sur (a).
**Jugeable** : deux entrées dans la même taverne avec la même graine → le même habitué, nommé, à fiche ; deux « bateliers » tirés = deux hommes distincts.

### L5 — Extinction de la valeur nue comme forme visible · **2 j** *(dépend de L1-L4)*
`TavernOpponent.abstract` (`tavernFlow.ts:86`) restreint **au TYPE** à ce qu'il est (figurant de foule / seuil DEV) ; `merchantValue` (`merchantFlow.ts:817`) meurt ; `sceneFearSources` lit le registre.
**Jugeable** : aucun écran joueur ne peut plus présenter un adversaire de duel sans nom ni fiche.
**Verrou** : **mort au type** (le kind « adversaire de duel » n'admet plus de variante à valeur) + baseline datée à **cible 0** pour les résidus, dates de mort au ticket.

### L6 — Poursuite terrestre : `PursuitFoe` à fiche · **1,5 j** *(optionnel, dépend de L1)*
`PursuitFoe { movement: number; skill: number }` (`pursuitFlow.ts:60-64`) → personne du registre. **2ᵉ client** prouvant que le registre n'a pas pris la forme de la taverne — critère d'universalité hérité de #1279.

**Totaux : 9,5 j-codeur (L1-L5) · 11 j (avec L6).** L1 est le seul lot bloquant (il porte l'ancre de LIEU dont dépend la portée `'place'`) ; L2, L3, L4 sont parallélisables une fois L1 posé.

---

## 5. Arbitrages TRANCHÉS (utilisateur, 2026-08-17, via AskUserQuestion)

Chaque entrée porte l'assertion **retenue** telle qu'elle était formulée au doc, et l'alternative écartée. Ces décisions sont repliées dans le plan (§3.2, §3.3, §3.5, L1-L4) : elles ne se re-débattent pas.

1. **PORTÉE DE LA PERSISTANCE → LIEU (+1 j).** *Retenu (2026-08-17)* : **« une Scène se rattache à son `MapPlace` (`placeId`, déjà existant : `possession.ts:23`, `portFlow.ts:63`), ce qui ouvre `persist: 'place'` — un habitué survit alors à un aller-retour entre deux scènes du même lieu. »** Le schéma porte donc **trois** portées (`'scene' | 'place' | 'campagne'`, §3.2) et le rattachement Scène→`MapPlace` est un livrable de **L1**.
   *Écarté : s'en tenir à deux portées (`'scene'` seule), où sortir vers la cour de l'auberge suffisait à faire disparaître l'habitué.*
   *(Cet arbitrage absorbe l'ancienne question 6 « id de LIEU au schéma » — c'était la même décision, fusionnée à la présentation.)*
2. **HORLOGE → LE MONDE VIT.** *Retenu (2026-08-17)* : **« l'État d'un PNJ du registre décroît avec l'horloge du jeu même quand le groupe n'est pas là. »** Replié dans **L2** : la récupération s'accroche au seam horodaté (`advanceTime`), jamais à une visite du joueur. Rappel : le « 5 minutes de repos » de NADJ 16 l.34 est un FAIT RAW (la durée), pas l'objet de l'arbitrage.
   *Écarté : le monde attend — l'État gèle à la sortie de la scène et ne reprend qu'au retour du groupe.*
3. **ÉCONOMIE → LES DEUX BORNES.** *Retenu (2026-08-17)*, les deux assertions ensemble : **« un marchand dont la bourse est vide ne rachète plus jusqu'au réassort »** ET **« un habitué tiré porte une bourse initiale tirée d'une table de richesse en donnée, et cesse de jouer quand elle est vide. »** Repliées dans **L3** comme livrables nommés (table de richesse en donnée incluse).
   *Écarté : rattraper l'une ou l'autre par un plancher d'argent ou un renflouement silencieux.*
4. **CHANCE / DESTIN DES PNJ → EN DONNÉE ÉDITABLE.** *Retenu (2026-08-17)* : **« un PNJ nommé peut porter des Points de Destin/Résilience en donnée éditable (champs déjà optionnels, `types.ts:1510-1513`) — donc Phillipe Descartes peut relancer son jet d'Al-zahr comme un héros, si sa fiche le dit. »** Conforme à la lettre de LDB 17 l.9 (verbatim §1ter) et à la règle 7 (« pas de MJ » : le point laissé à l'arbitre reçoit une donnée, pas un silence). Replié dans **L4** sous l'epsilon de chiffrage ; le canal de DÉPENSE reste #1306.
   *Écarté : aucun PNJ n'en porte — ce qui aurait été une house-rule maison contre la lettre de LDB 17 l.9.*

*(La rejouabilité du tirage seedé n'a jamais été soumise : c'est une exigence de la coop et des saves, tranchée au design — §3.4.)*

---

## Annexe — défauts rencontrés hors périmètre

**CORRIGÉS dans l'arbre depuis la rédaction** (vérifiés au code le 2026-08-17, à ne plus traiter comme dette) :

- ✅ **`src/engine/types.ts:1509`** — le commentaire disait « Destin / Résilience (**héros uniquement**, LDB 17 l.9) », paraphrase à l'envers de sa propre réf (LDB 17 l.9 autorise explicitement l'attribution à des PNJ importants — verbatim §1ter). **Réduit à sa réf nue** : le site porte désormais `// Destin / Résilience (LDB 17 l.9)`. Le poison de classe (a) est éteint ; l'arbitrage 4 du §5 peut donc s'écrire en donnée sans qu'un commentaire le contredise.
- ✅ **`src/state/encounterPsychFlow.ts:51-61`** — `sceneFearSources` ne passait ni `presetCreature` ni `appearance` à `spawnEnemy`, si bien qu'un PNJ nommé par preset y devenait une fiche générique, en divergence avec ses deux sites frères. **Corrigé au site** : la fonction résout `resolvePresetCreature(e.presetId)` et passe `{ presetCreature, appearance }` exactement comme `tavernFlow.ts:140` et `combatSlice.ts:2643` (test étendu, preuve par mutation). Ne relève **plus** de L5 : L5 ne lui doit que son rebranchement au registre.

**Restants** :

- **`src/state/bourseFlow.ts:79-84`** — `payWithAllocation` documente `recipient`/`purpose` comme **champs morts** (#1340) ; L3 les touche : les tuer plutôt que les traverser.
- **`src/scenes/test-scenarios/96-presets-edo.ts:202`** — Phillipe Descartes propose `dominos` alors que le scénario prescrit **L'Impératrice Écarlate** : substitution provisoire à solder (dette de contenu).
- **`src/engine/ops.ts:1223`** — contrat « mute en place » dont ~65 fichiers dépendent **sans qu'aucun test ne le nomme** : gelé par L1, mais le trou existe dès aujourd'hui, indépendamment de ce chantier.
