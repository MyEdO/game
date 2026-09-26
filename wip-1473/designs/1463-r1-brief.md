# #1463 · concept RÉFÉRENCE — brief du lot R1, v1.1 (socle : le DÉCLARÉ se mesure AU PARSE)

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par
#1466 ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept
(L2/L3) et gameOpRefFk.mjs ». Épique : #1463.
Grounding : `chantier/1473-r0` `4dc682a33` (lot R0 committé, run CI vert, pas encore sur `main`), 2026-09-23.
Diagnostic du lot : `/mnt/project-files/dettes/1463-r1-diagnostic.md` (rendu d'agent, points recoupés marqués).
Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour
une structure plus adapté ».
Consigne de l'utilisateur, 2026-09-23 : « Dit leur de penser a intégrer les chantiers en cours qui sont en
rapport avec leur sujet et qui traine surement dans un worktree avec possiblement du travail en cours et non
fini. Si c'est le cas, surtout relire les tickets concernés mais aussi les commentaires ».
Historique du design : la v1 a été jugée FRAGILE par le run `wf_1fcddf84-798` (8 bloquants, aucun
structurel, aucun écarté). Ses 8 corrections sont intégrées dans cette v1.1 (section « Design jugé »).
Texte de la v1 : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/1463-r1-brief-v1.md`.

## Invariant

1. Verbatim : le titre de #1473, cité ci-dessus. Source : `gh api repos/cgauche/game/issues/1473 --jq .title`.
   Question : qu'est-ce qu'une référence DÉCLARÉE dans le programme #1463 ? Une référence validée AU PARSE
   contre le registre d'ids généré.
2. Verbatim : « Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire #1466
   du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ». »
   Source : `scripts/docs/lib/structures-lexique.mts:135-136` (`MANDAT_SLOTS`).
   Question : que doit mesurer le volet SLOTS ? La jointure DÉCLARÉ × OBSERVÉ. Le côté déclaré s'y nomme
   « slot ».
3. Verbatim : « Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. C'est
   la FEUILLE porteuse de la référence — elle porte la marque que la marche des slots retrouve
   (`slots.ts`), jamais l'enveloppe `ref()`/`specRef()` qui la compose. »
   Source : `src/data/schemas/grammaire/ref.ts:136-138` (JSDoc de `idDe`, `:147`).
   Question : quel nœud porte une référence ? La feuille `idDe`, dont le `superRefine` la valide contre le
   registre à chaque parse. Cette JSDoc se réécrit dans le lot : la marche des slots ne sert plus la jointure.
4. Verbatim : « Marche UNIQUE d'un schéma composé : visite chaque nœud MARQUÉ avec son path. Les cycles sont
   coupés par la PILE D'ANCÊTRES, jamais par un ensemble global de nœuds vus — une instance partagée par 3
   champs vaut 3 slots, pas 1. »
   Source : `src/data/schemas/grammaire/slots.ts:132-134`.
   Question à laquelle elle répondait : comment ÉNUMÉRER les nœuds marqués d'un schéma composé sans boucler
   sur un `z.lazy` ni fusionner une instance partagée. Elle ne répond PAS à la question que R0 lui fait porter :
   où tombent les références dans la DONNÉE. Sous un schéma récursif, la coupe à l'ancêtre (`:146`) perd tout
   slot au-delà du premier niveau de `flowSchema` (`grammaire/mecanique.ts:556`, qui se référence par
   `steps`, `then`, `else`, `yes`, `no`). La citation est donc ÉTIRÉE quand `valeursAuPath` s'en sert pour
   la jointure.
5. Verbatim (première phrase de l'angle mort 3) : « Une référence que le parse valide HORS de la marche de
   `slotsDe` ne déclare aucun slot, et son couple reste au stock `SLOTS_SANS_DECLARATION` bien que la
   fabrique soit adoptée ». Source : `scripts/docs/lib/structures-lexique.mts:145` (`ANGLES_MORTS_SLOTS`).
   Question : pourquoi une fabrique adoptée laisse-t-elle son couple au stock ? Parce que le côté déclaré
   se mesure par une marche du SCHÉMA, et non par le parse que nomment les invariants 1 et 3.

Invariant de ce lot, déduit de 1 à 5 :
- **Le côté DÉCLARÉ est ce que le PARSE valide.** On parse chaque document par son schéma réel, en mode de
  mesure. Chaque case `(porteur, clé)` dont la valeur est validée contre le registre devient un SLOT, avec son
  type. Une occurrence observée est ATTEINTE quand toutes ses cases sont des slots. Le reste de la jointure R0
  ne change pas : atteinte stricte, couples, stocks.
- **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** C'est la seule
  feuille qui émet le repère de mesure, et `idsDe(` n'a qu'un appelant, `idDe`. Une vérification qui
  contournerait `idDe` rouvrirait l'angle mort 3 au premier lot qui l'adopterait.

## Vocabulaire (un concept, un terme)

- **Slot** (sens REDÉFINI par ce lot) : une case `(porteur, clé)` du document parsé par le scan (`brutParNom`)
  dont la valeur est validée par `idDe` au parse de mesure, avec son type. Le mandat (invariant 2) nomme ainsi
  le côté déclaré : `SLOTS_SANS_DECLARATION`, `SLOTS_INATTEIGNABLES` et « registre des slots » gardent leur
  nom, et changent de sens.
- **Path d'un slot** : le path de DONNÉE rendu par le parse, indices normalisés en `[]` (par exemple
  `[].effects.steps[].steps[].test.skill`). C'est la clé des lignes du §6.1 du doc.
- **Parse de mesure** : le parse d'un document par son schéma réel, dans le mode où `idDe` émet un repère.
  **Repère** : l'issue que `idDe` émet alors à chaque validation réussie.
- Le mot « relevé » n'est PAS employé : `scripts/docs/lib/zod-introspect.mts:36-37` et `:75-85` le portent
  déjà, pour une marche du schéma.
- **Case, occurrence, touché, atteint, joint, couple** : sens du lot R0, inchangés
  (`structures-scan.mts`, `inscrireReference` ; `slots-registre.mts:81-146`). « Touché » veut désormais
  dire : « est un slot ».
- L'ancien sens de « slot » (nœud marqué retrouvé par la marche du schéma, à son path de SCHÉMA) meurt au
  commit 2 de ce lot. Entre les deux commits, le code qui le porte est un fossile, inscrit au registre des
  fossiles de #1463.

## Cas canonique déjà couvert, et les nouveaux cas comme instances

- Couvert : la jointure par occurrence du lot R0. `couplesDeReference`
  (`scripts/docs/lib/slots-registre.mts:116`) compte une occurrence atteinte quand toutes ses cases sont
  touchées. Les cases touchées viennent de `casesTouchees` (`:81`), qui lit `valeursAuPath(document,
  slot.path)` (`:84`). Cas verrouillés : `merchants.json › curated` (`refs('trapping')`,
  `src/data/schemas/defs/merchants.ts:32`) et `buildings.json › roofMaterial` (`idDe('material', 'roof')`,
  `src/data/schemas/defs/buildings.ts:34`), par `JOINTURES_PLANCHER` (`src/data/slots-contrat.test.ts`).
- R1 ne change que la SOURCE des cases touchées : le parse de mesure remplace `valeursAuPath`. Instances de
  la même règle :
  - Récursion : `test.skill` sous un flux imbriqué (`flowTestSchema.skill`, `grammaire/mecanique.ts:370`).
  - Payload d'op validé dans le `superRefine` de `gameOpSchema` (`grammaire/mecanique.ts:200-216`), qui
    reporte l'issue du payload « TELLE QUELLE » (`{ ...issue, message }`, `:207`) : `tables.json | of`,
    `activities.json | factor`.
  - Ref de décor : elle DEVIENT une instance par la décision 1 ci-dessous. Aujourd'hui, elle n'en est pas
    une : `defs-scenes/scene.ts:182-185` re-parse la ref et RECRÉE l'issue, sans ses `params`.

Sonde de l'orchestrateur, zod 4.4.3, fichier
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r1d/sonde-zod.mjs` :

```
1. clés du ctx de superRefine :
   [ 'value', 'issues', 'addIssue' ] false
  superRefine parent exécuté après relevé ? true
2. success false
   custom ["f","skill"] skill releve
   custom ["f","steps",0,"steps",0,"skill"] skill releve
   custom ["ops",0,"skill"] skill GameOp : releve
   custom ["after","s"] skill releve
```

Le path de DONNÉE sort du parse à travers la récursion et à travers le report `{...issue}`. Le contexte d'un
`superRefine` n'expose aucun path. Le repère de l'union (`u.k`) est perdu quand une branche postérieure sans
ref accepte la même donnée.

## Mesures du juge (run `wf_1fcddf84-798`), à RE-MESURER par le codeur

Le juge a émulé l'option A sur les schémas RÉELS, sans rien muter : il a enveloppé `_zod.run` des feuilles
`idDe`, et un collecteur descend dans `invalid_union` (première branche propre), `invalid_key` et
`invalid_element`. Sondes et sorties : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/r1j/`
(`sonde-releve.mts`, `sonde-diff.mts` → `out5.txt`, `out7.txt`). Ce sont des rendus d'agent : ils orientent,
ils ne font pas foi.

- 128 defs pour 128 documents scannés ; parse normal : 0 document en faute ; parse de mesure : environ 0,4 s.
- Validations `idDe` réussies au parse normal : 29 908 ; repères rendus au `ZodError` : 29 574 (78 sous union,
  6 sous clé de record) ; 6 paths non résolus sur le JSON brut.
- Non-régression PAR OCCURRENCE : les 11 276 occurrences atteintes à `4dc682a33` le restent (différence vide).
- Couples joints : 58 → 65 (`activities.json | factor`, `loup-et-saumure-projet.json | skill`,
  `maladies.json | ops`, `maladies.json | otherwise`, `maneuvers.json | skill`, `qualities.json | skill`,
  `tables.json | of`), 66 avec la ref de décor (`diligence-projet.json | ref` 20/20).
- Restent partiels, sous des payloads d'ops non typées (lot R1-bis) : `spells.json | skill` 31/50,
  `traits.json | skill` 1/18, `trappings.json | skill` 10/29.
- Unions : 597 visitées, aucune ne place une branche permissive sans ref APRÈS une branche à ref
  (`sonde-unions.mts`). Les 20 repères émis et non rendus, hors projets, sont des doublons de la même case
  (branche `ref` stricte avortée sur `spec`, rendue par `specRef`).
- Test RÉSOLUTION (`src/data/slots-contrat.test.ts:196-215`) : son message est RÉFUTÉ. Le parse refuse une FK
  morte (`sonde-fkmorte.mts` → `out10.txt`). Le test est aussi plus faible que le parse : il compare au
  dataset entier (`idsDuType`), là où `idDe` compare la sous-liste (`idDe('material', 'roof')`).

## Design retenu

**Option A : slots mesurés au parse.** Aucune lentille ne l'a réfutée. L'option B (marche de la donnée guidée
par le schéma) recopierait dans le marcheur l'aiguillage d'`OP_DEFS` et le `kind` d'une entité : c'est une
garde de synchronisation, et le credo la déclare smell. L'option C (notation récursive du path de schéma)
resterait aveugle aux `superRefine` et aux unions.

Contraintes du mécanisme :
- Le mode de mesure est borné PAR CONSTRUCTION. Aucun état exporté, aucun drapeau qu'une garde surveillerait.
  Aucun parse de production (`CodexEdit.save`, `parseProject`, `dev-validate`, `validateDataset`) ne peut
  émettre un repère. Il n'y a pas d'async sous `src/data/schemas` (mesure du juge).
- Le repère traverse le pipe de la feuille (`handlePipeResult`, `node_modules/zod/v4/core/schemas.js:1969-1976`,
  qui avorte le côté `out` sur toute issue). Il garde son type dans ses `params`.
- Le collecteur rend chaque repère en case `(porteur, clé)` du document du scan. Il prend, dans un
  `invalid_union`, la PREMIÈRE branche dont toutes les issues sont des repères (celle que le parse normal
  choisit). Il descend dans `invalid_key` et `invalid_element`.

## Décisions prises par défaut (révisables sur mesure contraire, citée au rendu)

1. **`sceneEntitySchema` devient une union discriminée sur `kind`** (`defs-scenes/scene.ts:89`,
   `entityKindSchema` `:61`). Les champs communs forment une base ; la branche `prop` porte
   `ref: idDe('prop')`. Le re-parse de `:182-185` et `refDeDecor` (`:69`) meurent. Le cap volumique
   (`:186-191`) reste dans le `superRefine`. Les refs `personnage` arriveront par une ligne dans leur branche,
   à #1882 « Personnage sans type : le profil EN DUR « Ennemi » B 10 est JOUÉ comme fiche d'opposant (reste
   de #877, 32 PNJ livrés) ».
2. **`typedRef` (`grammaire/ref.ts:192-203`) est supprimé.** Il lit le registre par `idsDe` (`:196`) sans
   passer par `idDe`, et il n'a aucun consommateur de production (grep du juge sur `src/` et `scripts/` : tests
   seuls, `grammaire.test.ts:1017-1021`, `grammaire-guard.test.ts:137`). S'il en a un, il se recompose sur
   `idDe`, une branche par type. La promesse « se solde par `typedRef` » (`slotsStock.mjs:17-19`,
   `structures-lexique.mts:144`, `slots-contrat.test.ts:222`) est incohérente : `SLOTS_INTERNES` vise des types
   INCONNUS du registre, et `typedRef` n'accepte que des `TypeEntite`. Elle se corrige dans le même commit.
3. **`idsDAxes` (`defs-scenes/projet.ts:31`, `:86`, `activeAxes` contre `IDS_PAR_DATASET['axes.json']`) passe
   par `idDe('axe')`**, avec `axe` ajouté à `TYPES`, si les consommateurs des clés de `TYPES` l'absorbent
   (liste au rendu). Sinon, le rendu dit pourquoi il reste hors mesure, sonde à l'appui. Aucun couple observé
   n'y tombe aujourd'hui (`sonde-axes.mts`).
4. **Report d'une issue imbriquée.** Après la décision 1, `gameOpSchema` (`mecanique.ts:207`) est le seul site
   qui re-parse. Son report `{ ...issue, message }` reste la seule façon de faire. Un test garde qu'une issue
   de payload y garde son `code`, son `path` et ses `params`.
5. **Le test RÉSOLUTION meurt**, avec `valeursAuPath`. Le §6.1 du doc (`scripts/docs/build-structures.mts:584`)
   se reconstruit sur le parse de mesure : une ligne par (document, path de slot, type), avec le nombre de
   valeurs et les couples touchés. L'angle mort 3 (`structures-lexique.mts:145`) et celui de l'union `|N`
   (`:147`) meurent, avec leur plancher dans la garde.
6. **Garde des unions** : `sonde-unions.mts` est promue en test committé. Aucune union ne place une branche
   permissive sans ref après une branche à ref. Une telle union perdrait le slot en mesure, et laisserait
   passer un id invalide au parse normal. La garde doit survivre au commit 2 : le rendu dit comment elle
   reconnaît une feuille `idDe` si les marques de schéma meurent.
7. **Clés de record validées par `idDe`** (6 repères, `ship-criticals.json`,
   `tablesDeChute[0].bandes[0..2].hauteurs.{greement|nid-de-pie}`) : le rendu dit comment le slot représente
   une référence portée par une CLÉ, et si le scan l'observe. Défaut : une ligne au §6.1, sans effet sur la
   jointure si le scan ne l'observe pas.
8. **`z.ZodIssueCode.custom` → `'custom'`** sur les 23 sites de `src/` (API dépréciée,
   `node_modules/zod/v4/classic/compat.d.ts:10-11` « @deprecated Use the raw string literal codes instead »).
   Une garde mécanique interdit l'API dépréciée : étendre la garde canonique d'API interdites si elle existe
   (à chercher sous `scripts/guards/lib/`), sinon en poser une. Commit 2.
9. **Démolition de la marche des slots par le schéma** (commit 2). Meurt tout ce qui ne répond plus à une
   question que le parse de mesure ne couvre pas : `slotsDe`, `slotsDeclares`, le type `Slot` au sens du path
   de schéma, `marque` et ses lectures (`marqueDe`, `marquesPosées`, `marquesRetrouvées`, espèce `acteur`
   comprise), `profondeurDe` et son test de marge, le stock `SLOTS_INTERNES` et les angles morts 1 et 2.
   Attention : `marque(` et `marqueDe` désignent AUSSI d'autres fonctions dans le dépôt (`scripts/ops/*.mjs`,
   `src/gameIso/stage/*.test.tsx`) ; seules celles de `grammaire/slots.ts` sont visées.
10. **Descente canonique du schéma** (commit 2). Inventaire : `descendreArbre` (`slots.ts:139`), les trois tests
    qui la re-codent (`src/data/grammaire-guard.test.ts:113-130`,
    `src/data/schemas/grammaire/records-de-libelles.test.ts:50-62`,
    `src/data/schemas/grammaire/valeurs-de-champ.test.ts:50-66`), `marcherMemoise`
    (`scripts/docs/lib/zod-introspect.mts:40`) et la descente par valeur bornée par `PROFONDEUR_RELEVE`
    (`:75`). Défaut : `defDe`, `enfantsDe` et la descente bornée à pile d'ancêtres forment UNE primitive
    exportée, dans un module nommé pour la descente (plus « slots »). Les trois tests la composent. Les
    consommateurs de `PROFONDEUR_MAX` suivent (`scripts/hooks/segments-profonds.test.mjs`,
    `scripts/hooks/solde-ticket-guard.mjs`). `marcherMemoise` reste à part, pour sa raison : la mémo par
    identité est une autre sémantique, et son défaut est porté par #1687. Le rendu confirme ou réfute ce
    défaut par la mesure.

## Ce que le lot doit établir (questions posées, réponse citée au rendu)

1. **Mécanisme.** Comment le mode de mesure est borné par construction (schéma de mesure dérivé, fermeture
   d'`idDe` avec `try/finally`, ou autre), avec la preuve qu'aucun parse de production n'émet de repère.
2. **Perturbations**, re-mesurées sur les schémas réels des deux racines (`DEFS_DE_DOCUMENT`,
   `src/data/schemas/validate.ts:21`) : la règle de la première branche propre ; les `pipe`, `transform`,
   `preprocess` ; l'inventaire des `.catch` et `.default` au-dessus d'une feuille `idDe` ; les 6 paths non
   résolus, expliqués un par un.
3. **Non-régression par occurrence** : toute occurrence atteinte à `4dc682a33` le reste, preuve par sonde
   (ensembles avant/après, différence vide). Sinon, chaque exception est nommée avec sa cause.
4. **Consommateurs de la forme de `sceneEntitySchema`** (décision 1) : type `SceneEntity`, `noeudObjet` et
   `editFields`, éditeur de scène, `chargeDiscriminee`. Liste au rendu, chacun vert.
5. **Couples qui sortent et qui entrent** de `SLOTS_SANS_DECLARATION`, calculés par sonde, jamais affirmés,
   avec leurs comptes atteints / observés.
6. **Consommateurs hors périmètre** à relire : `scripts/guards/lib/structuresStock.mjs:59` et `:258`,
   `scripts/hooks/stocks-nominatifs.test.mjs:843`. Les pointeurs `fichier:ligne` des commentaires de
   `slotsStock.mjs` qui survivent sont recalés ou retirés (l'en-tête cite `scene.ts:89` pour un site qui est
   en `:166-185`).

## Registre des fossiles (#1463)

- Entre le commit 1 et le commit 2 : `slotsDe`, `slotsDeclares`, `Slot` (path de schéma), les marques de
  `grammaire/slots.ts`, `SLOTS_INTERNES`. Ils ne servent plus la jointure. Le commit 2 les tue.

## Périmètre

Commit 1 (socle) :
- `src/data/schemas/grammaire/ref.ts` (`idDe`, `typedRef`, `TYPES` si la décision 3 tient),
  `src/data/schemas/defs-scenes/scene.ts`, `src/data/schemas/defs-scenes/projet.ts:31-94`,
  `src/data/schemas/grammaire/mecanique.ts:200-216`.
- `scripts/docs/lib/slots-registre.mts`, `scripts/docs/lib/structures-lexique.mts` (`ANGLES_MORTS_SLOTS`,
  `:144`), `scripts/docs/build-structures.mts` (§6).
- `scripts/guards/lib/slotsStock.mjs` et `.d.mts`, `src/data/slots-contrat.test.ts`,
  `src/data/schemas/grammaire/grammaire.test.ts:1017-1021`, `src/data/grammaire-guard.test.ts:137`.
- Docs régénérés, jamais à la main : `npm run docs:structures`, puis `npm run docs:build` pour les empreintes.

Commit 2 (démolition) : `src/data/schemas/grammaire/slots.ts` et son test, les trois tests de la décision 10,
`scripts/docs/lib/zod-introspect.mts` si la descente y est reprise, les consommateurs de `PROFONDEUR_MAX`, les
23 sites de `z.ZodIssueCode`, la garde d'API dépréciée.

Primitives réutilisées : `idDe` (`ref.ts:147`), `couplesDeReference` et `casesTouchees`
(`slots-registre.mts:116`, `:81`), `scanDuCorpus` (`structures-scan.mts:1105`), `DEFS_DE_DOCUMENT` et
`fautesDe` (`validate.ts:21`, `:25`), `ecartsDeStock` (`scripts/guards/lib/stock.mjs`), `defDe` et
`enfantsDe` (`slots.ts`).

Hors lot : toute donnée JSON ; le typage des ops d'`OPS_NON_TYPEES` dans `OP_DEFS` (lot R1-bis, part de
#1468) ; `sea-weather.ts:65`, `sea-events.ts:35`, `corruptionExposure` (R1-bis) ; les classements du scan
(`STRUCTURES_FORMES` et `HORS_STRATE_RATCHET` identiques à l'octet).

## DoD

Commit 1 :
- [ ] La jointure lit les slots du parse de mesure. `valeursAuPath` et le test RÉSOLUTION n'existent plus.
- [ ] `git grep -n "idsDe(" -- src/data/schemas` : un seul appelant, `idDe`. Aucun `safeParse` de ref imbriqué
      dans `defs-scenes/scene.ts`.
- [ ] Non-régression par occurrence : sonde avant/après jointe au rendu.
- [ ] `SLOTS_SANS_DECLARATION` : liste exhaustive des couples sortis et entrés, avec leurs comptes ; compte de
      clôture `307 → N` ; `DETTE_ADOPTION_MAX = N` ; un `CLIQUET:` par entrée, avec son motif.
      `JOINTURES_PLANCHER` étendu aux couples qui deviennent joints.
- [ ] La sonde zod de l'orchestrateur et la sonde des unions sont promues en tests committés (flux imbriqué
      sur deux niveaux, payload d'op, union, garde des unions). Chaque test neuf ou réécrit a sa preuve par
      mutation : rouge débranché, vert rebranché, `git hash-object` avant et après.

Commit 2 :
- [ ] Plus aucune marche du schéma ne produit de slot.
      `git grep -nE "slotsDe|slotsDeclares|marquesPosées|marquesRetrouvées|valeursAuPath|typedRef"` ne rend
      rien hors `docs/plans/`.
- [ ] Une seule descente bornée à pile d'ancêtres, composée par les trois tests ; `marcherMemoise` nommé à part
      avec sa raison.
- [ ] `git grep -c "ZodIssueCode" -- src` rend 0, et la garde d'API dépréciée est rouge sur une mutation.

Les deux : la zone touchée sort aux normes (un concept, un terme ; aucun sens ancien de « slot » dans les
fichiers du périmètre, grep joint). Portes du périmètre, sortie brute jointe : `npm run typecheck` complet,
`npx vitest run` sur les tests du périmètre et `src/comment-poison-guard.test.ts`,
`node scripts/docs/build-all.mjs --empreinte`. Les gates complètes sont jouées par le run CI de la branche.

## Exécution

- Branche `chantier/1473-r1`, créée depuis `chantier/1473-r0` (`4dc682a33`), worktree
  `/home/claude/game/.wt-1473-r1`.
- Deux codeurs SÉQUENTIELS (`codeur`, opus, medium), 2 h chacun, un livrable chacun (diff et rendu brut) :
  commit 1, puis commit 2 sur le commit 1 committé. Interdit : tout `git checkout/restore/reset/stash/add/commit`.
- L'orchestrateur relit chaque diff, rejoue les portes, committe et pousse la branche. Un juge de diff tourne
  pendant chaque run CI. `main` n'est touché que par `ops:publier`, avec l'accord de Clément.

## Design jugé :

**FRAGILE** — workflow `juge-design-socle`, run `wf_1fcddf84-798`, 2026-09-23. 8 bloquants survivants, aucun
structurel, aucun écarté par réfutation. Corrections portées plus haut :
1. `typedRef` lit le registre hors `idDe` → invariant « toute vérification passe par `idDe` », décision 2,
   grep `idsDe(` au DoD, troisième lecteur `projet.ts:31` en décision 3.
2. La ref de décor restait une variante à branche par `kind` → décision 1 (union discriminée, composition).
3. « Validé par `idDe` » contre « validé au parse » → invariant réécrit, périmètre élargi à `ref.ts:192` et
   `projet.ts`.
4. « Relevé » déjà pris par `zod-introspect.mts` → terme abandonné, section « Vocabulaire ».
5. « Slot » à deux sens → sens redéfini, l'ancien meurt au commit 2 (décision 9), fossile inscrit.
6. `valeursAuPath` interdit par la DoD et gardé par la question 4 → décision 5, test RÉSOLUTION et
   `valeursAuPath` morts, §6.1 reconstruit.
7. Mise aux normes du report conditionnelle, API dépréciée → décisions 4 et 8, inconditionnelles.
8. Duplication de la descente laissée au ticket → décision 10, inventaire complet et socle désigné.
Texte intégral du bloc : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/bloc-r1-v1.md`.
Dits des juges : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/dits-r1-v1.md`.
