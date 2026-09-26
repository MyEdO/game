## Design — le foyer d'une règle est UNE référence polymorphe `{ type, id }` (#1463 Référence, #1473), 2026-09-24, v1

Origine : question du fil Couche layout (2026-09-24, lot modales #1920) sur `flow-stakes.json`. Réponse du fil #1463 :
`flow` et `phase` sont des vocabulaires (le fil Couche layout les type), et le foyer `rule` + `ruleCategory` est une
référence polymorphe dont la forme se conçoit ici pour toute sa classe. Cartographie : lecteur du 2026-09-24,
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/lecteur-foyer/rendu.md`.

## Invariant

1. En-tête de `src/data/schemas/grammaire/ref.ts` (verbatim) : « FABRIQUE DE RÉFÉRENCE (#1466) — la seule façon de
   désigner une entité par son id. `ref(type)` construit ET ENREGISTRE le nœud FINAL : l'id est refiné AU PARSE contre
   l'INDEX DES IDS […], si bien qu'une référence morte casse au chargement […] sans qu'aucune garde nominative n'ait à
   l'énumérer ». Question à laquelle il répond : par où passe toute désignation d'une entité ? Réponse : par la
   fabrique, qui la vérifie au parse.
2. `ref.ts:36` (verbatim) : « Un type s'ajoute avec le lot qui le migre, jamais « au cas où ». » Question : quand un
   type d'entité entre-t-il à `TYPES` ? Réponse : dans le lot qui migre ses références.
3. Lexique des structures, `scripts/docs/lib/structures-lexique.mts:275` (verbatim) : « `{ sig: 'id,type', statut:
   'cible', note: 'référence de dotation polymorphe' }` ». Question : quelle est la forme cible d'une référence dont le
   type varie ? Réponse : un objet `{ id, type }`.

## Cas canonique déjà couvert

- `idDe(type)` et `ref(type)` (`ref.ts:237-262`, `:393`) : une référence MONOMORPHE, dont le type est fixé à la position
  du schéma, résout au parse contre l'espace de `TYPES[type]`.
- La référence polymorphe en est une instance : le type n'est plus fixé à la position, il est porté par la valeur, et
  chaque type possible est une branche `idDe(type)`. Rien d'autre ne change : même résolution, même message de
  référence morte, même repère au parse de mesure.

## Constat (mesures du lecteur, arbre `61fef43d7`, à attaquer)

- Sept datasets portent le foyer : `actions`, `activities`, `combat-stakes`, `flow-stakes`, `night-stakes`,
  `voyage-stakes` (`rule` + `ruleCategory`, deux `z.string().optional()`), et `crew-test-types` (`rule` seul, foyer
  toujours `regles.json`, `defs/crew-test-types.ts:24-26`). Stock : 148 occurrences en `id-nu` historique
  (`structuresStock.mjs:176, 199, 304, 331, 370, 444, 647`).
- Le `superRefine` « rule sans ruleCategory » est recopié mot pour mot à quatre sites (`actions.ts:173`,
  `activities.ts:302`, `combat-stakes.ts:86`, `flow-stakes.ts:81`) et absent de `night-stakes`, `voyage-stakes`.
- Donnée : les 100 et quelques `rule` vérifiés résolvent tous dans le dataset que leur catégorie désigne (0 référence
  morte) ; catégories employées : `regles`, `skills`, `talents`, `etats`, `qualities`, `characteristics`, `spells`,
  `symptoms`, `psychologies`, `steamBreakdowns`.
- `ruleCategory` est une clé du registre du Codex (`CODEX_SPECS`, `src/ui/compendium/registry.ts:1150`, 133 clés) :
  la donnée nomme un vocabulaire déclaré dans l'UI. `TYPES` (`ref.ts:38-68`, 24 types) n'a pas `regle`
  (`regles.json`), `quality`, `characteristic`, `psychology`, `steamBreakdown`.
- Lecteurs : `stakeEntry`/`kindRule` (`src/data/index.ts:556-630`, défaut `'regles'`), `actionRegistry.ts:70-75`
  (`ruleCategory === 'etats'`), `CombatConsole.tsx:731`, type moteur recopié `engine/activities.ts:447-449`.
- Le même concept, « une entité désignée avec son type », a quatre graphies : `{ category, id }` (`CodexTarget`),
  `{ kind, id }` (`EffectSource`, `engine/types.ts:745-748`, 17 genres, traduits par `CATEGORY_BY_SOURCE_KIND`,
  `:691-698`), `{ categorie, id, spec? }` (`ProvenanceDAjout`, train 2a2 sur `chantier/1473-t2`), et `rule` +
  `ruleCategory`.

## Design

**F1 — Une fabrique de référence polymorphe.** `ref.ts` gagne une fabrique qui construit `{ type, id }` : `type` est un
membre de `TypeEntite` (restreint, s'il le faut, à une liste passée par le site), `id` est vérifié par la branche
`idDe(type)` de ce type. Nom et signature en sortie, alignés sur `ref`/`idDe`.

**F2 — Un seul vocabulaire des types d'entité.** Le type d'une référence est un `TypeEntite`, jamais une catégorie du
Codex. `TYPES` gagne, dans CE lot, les types que le foyer désigne et qu'il n'a pas (`regle`, `quality`,
`characteristic`, `psychology`, `steamBreakdown`, à confirmer par la donnée). Le passage type → catégorie du Codex est
UNE table, déclarée côté UI (chaque entrée de `CODEX_SPECS` qui projette un type d'entité le nomme), lue par tout
lecteur d'affichage.

**F3 — Le foyer migre.** `rule` + `ruleCategory` deviennent un seul champ au format de F1, dans les sept datasets ;
`crew-test-types` aussi (le type y est `regle` dans la donnée, pas implicite). Les quatre `superRefine` « rule sans
ruleCategory » meurent. Nom du champ : `foyer` (le mot des commentaires des defs), à contester en sortie.

**F4 — Les lecteurs lisent la référence.** `stakeEntry`/`kindRule` (son défaut `'regles'` meurt), `actionRegistry.ts`
(`foyer.type === 'etat'`), `CombatConsole.tsx` et le type moteur recopié de `engine/activities.ts` passent par la forme
de F1 et par la table de F2.

**F5 — Les autres graphies du concept.** `ProvenanceDAjout` (train 2a2, à nous) prend la forme de F1 dans le train qui
suit la pose de F1. `EffectSource` et `CodexTarget` : question Q3.

**F6 — Migration.** Script daté sous `scripts/migrations/`, au patron de
`2026-08-24-give-trapping-label-vers-id.mjs` (fail-fast, idempotent, compte textuel contre compte structurel), sur
`src/data/**/*.json`, `src/scenes/**/*.json` et `scripts/arene/*.mjs`. La traduction catégorie → type est lue dans la
table de F2, jamais recopiée dans le script.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — `entryCategory` et `entryFromSource`.** `combat-stakes` et `flow-stakes` exigent « un foyer OU une entrée »
  (`combat-stakes.ts:82-84`, `flow-stakes.ts:77-79`). Qu'est-ce qu'une entrée (`entryCategory`, `entryFromSource`),
  est-ce une autre référence au Codex, et prend-elle la même forme ?
- **Q2 — `psychologie` et `psychologies`.** Deux catégories du Codex pour la psychologie (`registry.ts:1674`, filtre de
  `traits` ; `:2143`, `psychology.json`). Quel type d'entité correspond à chacune ?
- **Q3 — `EffectSource` et `CodexTarget`.** `EffectSourceKind` (17 genres, dont `prayer`, `miscastMinor`,
  `miscastMajor`, `miscastWrath`, `tavernGame`) : chaque genre est-il un type d'entité, un sous-ensemble d'un type, ou
  autre chose ? Si c'est la même chose que F1, dire ce que coûte la convergence et quel train la porte ; sinon, dire
  pourquoi deux formes restent.
- **Q4 — un seul type ?** Quand un site n'admet qu'un type (`crew-test-types`, foyer toujours `regle`), la forme de F1
  (type porté) ou une référence monomorphe `ref('regle')` ? Trancher avec la règle « un concept, une forme ».
- **Q5 — le reste de la classe.** D'autres champs de `src/data` et `src/scenes` écrivent-ils une paire id + catégorie
  ou id + type à plat (sonde sur les noms `*Category`, `*Kind`, `*Type` voisins d'un id) ?

## Critère N+1

Un dataset de plus qui désigne un foyer coûte un champ au format de F1 ; un type d'entité de plus coûte une ligne à
`TYPES` et une à la table de F2.

## Périmètre et séquence

`chantier/1473-r2` (Référence), après C4 (C4a et C4b) : F2 touche `TYPES` et les espaces de la phase 2. Le fil Couche
layout monte `flow-stakes › rule` au stock avec une ligne `CLIQUET:` en attendant (accord du 2026-09-24) ; il est
prévenu quand la forme est posée. `ProvenanceDAjout` suit sur la ligne `chantier/1473-t2`.

## Lexique

« foyer » (l'entité qui porte la règle qu'un enjeu ou une action applique) et « référence polymorphe » (une référence
qui porte son type) entrent au lexique dans le commit qui pose F1.
