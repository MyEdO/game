## Design — UNE référence polymorphe `{ type, id }`, un seul vocabulaire des types d'entité (#1463 Référence, #1473), 2026-09-24, v2

v1 (`1463-foyer-polymorphe-design-v1.md`) : **RÉFUTÉ** par le workflow `juge-design-socle`, run `wf_45835b0d-496`
(verdict : `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-foyer/verdict.json`).
Structurels : la table « type → catégorie du Codex » que v1 déclarait côté UI double une dérivation qui existe dans
`src/data`, et `src/data`, `src/state` ne peuvent pas lire l'UI ; un second vocabulaire du même concept reste en place
(`EffectSourceKind` et `CATEGORY_BY_SOURCE_KIND`). v1 ne traitait qu'un champ ; v2 remonte au concept.
Mesures : lecteur du 2026-09-24,
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/lecteur-foyer-v2/rendu.md`.

## Invariant

1. En-tête de `src/data/schemas/grammaire/ref.ts` (verbatim) : « FABRIQUE DE RÉFÉRENCE (#1466) — la seule façon de
   désigner une entité par son id. » Question : par où passe toute désignation d'une entité ? Réponse : par la fabrique,
   qui la vérifie au parse.
2. `ref.ts:36` (verbatim) : « Un type s'ajoute avec le lot qui le migre, jamais « au cas où ». » Question : quand un
   type entre-t-il à `TYPES` ? Réponse : dans le lot qui migre ses références.
3. Lexique, `scripts/docs/lib/structures-lexique.mts:275` (verbatim) : « `{ sig: 'id,type', statut: 'cible', note:
   'référence de dotation polymorphe' }` ». Question : quelle forme a une référence dont le type varie ? Réponse :
   `{ id, type }`.
4. `src/engine/types.ts:686-690` (commentaire de `CATEGORY_BY_SOURCE_KIND`, verbatim) : « une copie côté state aurait
   fait DEUX vérités pour une seule question ». Question : combien de tables disent quelle page du Codex montre une
   entité ? Réponse : une, lisible par toutes les couches.

## Cas canonique déjà couvert

- `idDe(type)` / `ref(type)` (`ref.ts:237-259`, `:393`) : une référence MONOMORPHE résout au parse contre l'espace de
  `TYPES[type]`. La référence polymorphe en est une instance : une branche `idDe(type)` par type admis, même message
  de référence morte, même REPÈRE au parse de mesure (sonde du juge `sonde-f1-polymorphe.mts` : `mesureDuParse` rend
  `[{path:[0,'id'],type:'etat'},{path:[1,'id'],type:'skill'}]`).
- La page du Codex d'un type se DÉRIVE déjà : `TYPES[type].espace` → le def qui porte ce `file` →
  `exposition.codex.keys`, avec le départage « clé égale au dataset » de `src/data/schemas/exposition-derivee.ts:91-96`
  (sonde du juge `sonde-pds-b1.mts` : 25 types, un def chacun, 2 sans page, `lightLevel` et `prop`, exemptés).

## Constat (arbre `61fef43d7`, à attaquer)

Le concept « une entité désignée avec son type » a six graphies :
- `rule` + `ruleCategory` à plat dans 7 datasets (148 foyers ; 48 sans `ruleCategory`, lus `'regles'` par défaut ;
  `src/data/index.ts:584-627`) ; troisième point de conversion à l'UI (`src/ui/CombatConsole.tsx:731`).
- `entryCategory` + `entryId` (`defs/combat-stakes.ts:42-82`, `defs/flow-stakes.ts:48-77`), et les tables
  `STAKE_ENTRY_CATALOG` / `STAKE_ENTRY_POOLS` (`src/data/index.ts:442-533`).
- `EffectSource { kind, id }` (`src/engine/types.ts:674-698`, 19 genres) et `CATEGORY_BY_SOURCE_KIND` : 16 sites
  construisent `source: { kind, … }` hors tests, 9 de plus par `withSource` (`src/state/triggeredEffects.ts`) ;
  6 lecteurs de la table hors tests. `derivedStakeSchema.from` (`grammaire/mecanique.ts:544-550`) l'emploie comme
  schéma, sans aucune occurrence en donnée.
- `CodexTarget { category: string, id }` (`src/engine/ruleRefs.ts:14`, `RULE_REF` : 49 entrées, 8 catégories).
- `ProvenanceDAjout { categorie, id, spec? }` (train 2a2, non committé ; il passe à `{ type, id, spec? }` dans ses
  corrections 4).
- La dotation à plat `vehicleId` (29) / `creatureId` (60) (`grammaire/reference.ts:60-61`), alors que le lexique
  déclare `id,type` et `count,id,type` en cible, à 0 occurrence (`docs/structures-donnees.md:1094-1095`).

`EffectSourceKind` face à `TYPES` (lecteur, Q1) : 5 genres de même nom (`spell`, `talent`, `trait`, `trapping`,
`creature`) ; 3 du même catalogue sous une autre graphie (`disease`/`maladie`, `symptom`/`symptome`,
`condition`/`etat`) ; 8 sans type (`quality`, `mutation`, `psychology`, `maneuver`, `activity`, `rule` =
`regles.json`, `tavernGame`, `prayer` = une entrée de `spells.json`) ; 3 lignes de table (`miscastMinor`,
`miscastMajor`, `miscastWrath`).

Homonymes : `rule` porte aussi l'id d'une Règle optionnelle (`variantWhenSchema`, `grammaire/valeurs.ts:387`, 18
occurrences dans `spells.json`) et un terme de formule (`valeurs.ts:737` ; `talents.json` 12, `symptoms.json` 1,
`tables.json` 1). « foyer » a déjà deux sens (l'espace qui fait autorité, `reference.ts:60-61` ; le module d'une
primitive).

Et la classe voisine que le fil Couche layout confie à ce fil (verdict de design flow-stakes du 2026-09-24,
`/mnt/project-files/couche-layout/verdict-juge-design-flowstakes-2026-09-24.md:57`, point 7 du « Design corrigé ») :
`combat-stakes`, `night-stakes`, `voyage-stakes` portent un `id` ET un `kind` qui le recopie, et le code résout par
`kind` (`combatStakeRef` `src/data/index.ts:644`, 70 appels ; `voyageStakeRef` `:633` ; `nightStakeRef` `:668`).

## Design

**P1 — Une fabrique de référence polymorphe.** `ref.ts` gagne `refPolymorphe(types?)` : une union de branches
`z.strictObject({ type: z.literal(t), id: idDe(t) })`, une par type admis (tous par défaut, ou la liste du site). Un
type hors liste lève un message qui nomme les types admis (le juge a vu `invalid_union` « Entrée invalide » sans nom).
Elle sert aussi `count,id,type` (P6).

**P2 — Un seul vocabulaire : `TypeEntite`.** `EffectSourceKind` meurt : un genre qui désigne un catalogue devient le
type de ce catalogue (`disease` → `maladie`, `symptom` → `symptome`, `condition` → `etat`), et `TYPES` gagne, dans le
lot qui les migre, `regle`, `quality`, `mutation`, `psychology`, `maneuver`, `activity`, `tavernGame`, et ce que les
autres graphies désignent (`characteristic`, `seaWeather`, `steamBreakdown`…, relevé exact en Q2). Le moteur importe
déjà `src/data/schemas` (81 fichiers de `src/engine` hors tests, dont `careerSlots.ts:33` depuis `ref.ts`) : le type
vit dans `ref.ts`.

**P3 — La page du Codex se dérive, une fois.** `pageDuCodex(ref)` vit dans `src/data/schemas`, à côté de
`deriveExposition`, et lit la dérivation du cas canonique : toutes les couches la lisent (data, state, engine, UI, les
scripts de migration par `npx tsx`). `CATEGORY_BY_SOURCE_KIND`, `kindRule`, la conversion de `CombatConsole.tsx:731`
et les défauts `'regles'` meurent. Un type a UNE page (le départage existant) ; les autres clés d'un def (`psychologie`
de `traits`, `siegeEngines` de `trappings`…) sont des VUES du même type, pas des lignes d'une table.
`CodexTarget` ne survit que comme sortie de `pageDuCodex`, si le Codex a besoin d'une adresse (Q3).

**P4 — Les graphies migrent.**
- `rule` + `ruleCategory` → un champ `regle: refPolymorphe()` dans les 7 datasets. Un foyer sans catégorie devient
  `{ type: 'regle', id }`. Les 4 `superRefine` « rule sans ruleCategory », les 6 méta d'éditeur « Catégorie de la
  règle » et le type moteur recopié (`src/engine/activities.ts:440-449`) meurent ; l'éditeur rend le champ par le
  sélecteur de la fabrique.
- `entryCategory` + `entryId` → la même forme ; `STAKE_ENTRY_CATALOG` et `STAKE_ENTRY_POOLS` se relisent par type (Q4).
- `EffectSource` = la référence de P1 ; ses 25 constructeurs écrivent un type.
- `derivedStakeSchema.from` = `refPolymorphe()`.
- `ProvenanceDAjout` : fait sur la ligne `chantier/1473-t2` (corrections 4 du train 2a2).

**P5 — L'id est la clé d'un enjeu.** Dans le même train, `combat-stakes`, `night-stakes` et `voyage-stakes` perdent
`kind` ; les résolveurs `combatStakeRef`, `voyageStakeRef`, `nightStakeRef` prennent l'id, typé par l'union d'ids
générée par dataset (lot B14 du fil Couche layout, sur `main` ; phase 2 `gen-espaces.mts` sur R2, selon la branche
publiée d'abord).

**P6 — La dotation.** `vehicleId` / `creatureId` deviennent `{ type, id }` (et `count` là où il existe) par P1. Train
propre, après P4.

**P7 — Les homonymes.** Le champ du rôle « la règle qu'un enjeu ou une action applique » s'appelle `regle`. `rule`
disparaît de la donnée comme foyer ; `when.rule` de `variantWhenSchema` désigne une Règle optionnelle, et devient la
référence monomorphe de ce type (`idDe('regleOptionnelle')`, si elle ne l'est pas déjà, Q5) sous le nom
`regleOptionnelle` ; le terme `{rule}` de formule est traité en Q5. « foyer » n'entre pas au lexique.

**P8 — Migration.** Un script daté sous `scripts/migrations/`, au patron de `2026-08-24-give-trapping-label-vers-id.mjs`
(fail-fast, idempotent), lancé par `npx tsx` pour lire `pageDuCodex` et `TYPES`, jamais une table recopiée. Il ne
compte que les positions STRUCTURELLES (racine d'entrée des 6 datasets d'enjeux et d'actions, `types[]` de
`crew-test-types`), jamais le texte `"rule"`.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — `prayer` et les lignes d'incident.** Qui lit `kind === 'prayer'` (grep), et une Prière se distingue-t-elle
  d'un Sort par une donnée de `spells.json` ? `miscastMinor`/`Major`/`Wrath` : ce sont des lignes de `miscast.json`
  (hors parse, #1902) ; leur page dépend-elle de la ligne, et quel type les désigne ?
- **Q2 — le relevé des types.** Pour chaque catégorie employée par les six graphies (données, `RULE_REF`,
  constructeurs d'`EffectSource`, `STAKE_ENTRY_*`), le type qui la désigne, et les types à ajouter à `TYPES`, chacun
  avec son espace.
- **Q3 — `CodexTarget`.** Le Codex peut-il recevoir la référence et appeler `pageDuCodex` lui-même, ce qui ferait
  mourir `CodexTarget` ? Lecteurs : 11 fichiers de `src/engine`, `src/ui/CombatConsole.tsx`.
- **Q4 — les entrées jouées.** `entryCategory` + `entryId` et `STAKE_ENTRY_POOLS` (prédicats par catégorie, tables
  dérivées `shipCriticals`, `riverCriticals`) : chaque pool est-il un type, une vue d'un type (un filtre), ou autre
  chose ?
- **Q5 — `when.rule` et `{rule}`.** Forme actuelle de `variantWhenSchema.rule` (`valeurs.ts:387`) et du terme de
  formule (`valeurs.ts:737`) ; les 12 occurrences de `talents.json` sont-elles des références mortes (juge v1 :
  `variants[0].when.rule=combat-aa-avantage-groupe`) ?
- **Q6 — l'Activité elle-même.** `src/data/index.ts:623` : une Activité sans foyer montre sa propre page. Le défaut se
  déclare-t-il au def (une ligne, lue par l'unique lecteur de P3) plutôt qu'au lecteur, ou la donnée l'écrit-elle ?

## Critère N+1

Un type d'entité de plus coûte une ligne à `TYPES` : sa page vient de son def. Un champ de plus qui désigne une entité
de type variable coûte un appel à `refPolymorphe(…)`. Un enjeu de plus coûte une entrée de donnée, trouvée par son id.

## Périmètre et séquence

`chantier/1473-r2`, après C4 (C4a, C4b) et le socle des marques de nœud. Trains : P1 à P3 (fabrique, vocabulaire,
page dérivée) ; P4 et P5 (les enjeux, les actions, les effets) ; P6 (dotation) ; P7 avec P4. Le fil Couche layout (lot
B14) retire `flow` et `phase` de `flow-stakes` et y monte le stock `rule` de 33 à 37, avec une ligne `CLIQUET:` qui
cite le message du fil #1463 du 2026-09-24 : c'est une évaluation d'ingénierie révisable, pas un arbitrage de Clément,
et ce stock meurt avec P4.

## Lexique

« référence polymorphe » (une référence qui porte son type, `{ type, id }`) entre au lexique des structures dans le
commit qui pose P1. « foyer » n'y entre pas.

## Traitement du verdict v1

B1, B3, B6 (structurels) : P3. B2, B7 : P2 et Q1-Q2. B4 : P3 (une page par type, les autres clés sont des vues).
B5 : P7, P8. B8 : Périmètre et séquence. B9 : P4 (corrections 4 de 2a2). B10 : P4 et Q6. B11 : P7.
