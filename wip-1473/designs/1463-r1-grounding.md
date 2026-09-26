# #1463 · concept Référence — grounding du lot R1 (famille Compétence)

Lecteur en lecture seule, `main` `b027d548d`, 2026-09-23. Rendu d'agent : ce sont des pistes à re-vérifier,
pas des sources. Points recoupés par l'orchestrateur marqués « vérifié ».

## Constat principal

- 39 couples de `SLOTS_SANS_DECLARATION` (`scripts/guards/lib/slotsStock.mjs`) référencent le type skill,
  établis par le scan (`skills.json` dans `f.cibles`), comptes du stock égaux aux comptes mesurés.
- La plupart de ces champs utilisent DÉJÀ la fabrique typée `refOuSpec('skill', …)` ou `avancement('skill')`.
  Vérifié : `activities.json | skills` est au stock (`slotsStock.mjs:67`, 64) alors que
  `src/data/schemas/defs/activities.ts:19` déclare `refOuSpec('skill', …)`. Leur présence au stock est donc
  un effet du défaut de jointure que corrige R0, pas une absence de déclaration. R1 se mesure APRÈS R0.

## Restes probables après R0 (à re-mesurer)

- Schémas non typés : `src/data/schemas/defs/sea-weather.ts:65` (`skills: z.array(z.string())`, vérifié) ;
  `src/data/schemas/defs/sea-events.ts:35` (`params: z.record(z.string(), z.unknown())`).
- `naval-traits.json`, `sea-shanties.json`, `tables.json`, `traumas.json` | `skill` : payload des ops
  `skillDRBonus` / `skillMod`, listées dans `OPS_NON_TYPEES` (`src/data/schemas/grammaire/mecanique.ts:113-127`,
  vérifié), lot de mort « L1c #1468 ».
- `skillRefSchema` redéclaré localement 4 fois (`defs/creatures.ts:43`, `defs/axes.ts:24`,
  `defs/activities.ts:19`, `defs-scenes/communs.ts:24`), chacun `refOuSpec('skill', extra)` avec un `extra`
  différent : à juger (mutualisation ou nommage).
- `tavernGames.json | skill` : la majorité des valeurs `spec` du site collisionne avec `weaponGroups.json`
  (ex. `{id:"savoir", spec:"guerre"}`, `src/data/tavernGames.json:63-65`), angle mort de site du scan.

## Fabrique

`TYPES.skill = { dataset: 'skills.json', specsOpen: true }` (`src/data/schemas/grammaire/ref.ts:47`) ;
`refOuSpec` (`ref.ts:312-323`), `specRef` (`ref.ts:298-303`), validation `noeudASpecialisation`
(`ref.ts:222-284`).

## Non couvert par le lecteur

Lecteurs `src/ui/**`, détail des scènes `src/scenes/**`, `src/data/spec-pool-contrat.test.ts`, recherche
exhaustive d'ids morts.
