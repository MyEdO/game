# Ajouter / curer un sort

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-sort.mjs` (`npm run docs:sort`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les 18 champs propres
d'une entrée et leurs libellés d'édition (AST du def zod `src/data/schemas/defs/spells.ts`), les
4 formes de portée, 5 de cible et 5 de durée (les
`z.discriminatedUnion('kind', …)` du même def), les 9 rubriques d'un Rituel, les
3 issues de `spellSupport` (type de retour de `src/engine/spellspec.ts`), et l'INVENTAIRE
mesuré sur les 576 entrées de `src/data/spells.json` (curées, familles, population de chaque
forme). **Angles morts** : l'état d'implémentation SORT PAR SORT n'est pas ici — il vit dans le
tableau de bord `docs/sorts-implementation.md` (généré à part, avec ses propres angles morts, dont
le fait que la mesure est STRUCTURELLE et non une preuve d'exécution) ; le vocabulaire des `GameOp`
utilisables dans `effects` vit dans `docs/vocabulaire-mecanique.md` ; la FIDÉLITÉ d'une `desc` à
sa source ne se mesure pas — elle se relit au `Source/` ; l'ordre de la curation et les pièges de
vocabulaire sont de l'ÉDITORIAL fixé dans le script.

Un sort — ou une Prière, une Bénédiction, un Miracle, un **Rituel** — vit **entièrement en donnée**
dans `src/data/spells.json`, sous le document déclaré par `src/data/schemas/defs/spells.ts`. Il n'y a
aucun fichier de moteur par sort : métadonnées de résolution ET effets mécaniques sont dans la même
entrée, éditée au Compendium en jeu (Codex → catégorie « Sorts »).

## 0. Tableau de bord — `docs/sorts-implementation.md`

Fichier **généré** (`npm run docs:sorts`) : chaque sort avec son état ✅ mécanique / 🟡 partiel /
📜 narratif, sa colonne « Curé », et le texte « arbitrage MJ » restant à journaliser. C'est le point
d'entrée pour repérer un sort à curer, ou vérifier qu'un ajout a bien basculé.

**État du catalogue au moment de cette génération** : 576 entrées, dont 438 curées
(`curated: true`), 17 Rituels (`isRitual`), 576 portant un `effects`.
Répartition par `family` : `arcane` 359 · `invocation` 117 · `mineure` 50 · `chaos` 26 · `beni` 24.

## 1. La forme d'une entrée

L'enveloppe commune (`id`, `label`, `desc`, `source`, `variants`…) est posée par la fabrique de
document — cf. `docs/ajouter-une-donnee.md`. Les champs PROPRES d'un sort, avec le libellé sous
lequel le Codex les édite :

| Champ | Libellé au Codex | Rôle |
|---|---|---|
| `ecole` | École | ÉCOLE — libellé d'affichage hérité (dépotoir : 18 valeurs, casse double 'Magie mineure' / 'Magie Mineure') ; le discriminant de logique reste `family` + `domainId`. |
| `subType \| null` | Sous-type | — |
| `domainId?` | Domaine | Domaine arcanique ou de culte auquel le sort appartient |
| `isRitual?` | Est un Rituel | `VDM 02 l.363` / `l.377-393` — TAG lu par `castingNumberOf` (`src/engine/magic.ts`) et `effectiveSpellOf` (`src/state/combatFlow.ts`) pour composer un `CastingNumberSubject` dont le `kind` départage les portées `kinds:['sort'\|'rituel']` (`VDM 12 l.646-647`, `VDM 14 l.489`). |
| `ritual?` | Rubriques de Rituel | Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) — présentes sur les seules entrées taguées `isRitual`. |
| `family` | Famille de sort | Mineure/Arcane/Invocation/Béni/Chaos — discriminant de logique |
| `cn \| null` | Niveau d’Incantation | — |
| `range \| null` | Portée | — |
| `target \| null` | Cible | — |
| `duration \| null` | Durée | — |
| `missile?` | Est un projectile magique | — |
| `damage?` | Dégâts (projectile magique) | Bonus additif de Dégâts du projectile magique |
| `ignorePA?` | Ignore les PA | Le projectile magique ignore les Points d’armure de la cible |
| `ignoreBE?` | Ignore le Bonus d’Endurance | Le projectile magique ignore le Bonus d’Endurance de la cible |
| `curated?` | Entrée officielle curée | Vrai pour une entrée complète de la base officielle ; absent/faux pour un sort homebrew |
| `breathAttack?` | Sort Souffle | Délégué à l’attaque de zone du Trait Souffle |
| `opposed?` | Test opposé | Le sort exige un Test de résistance ou de contact de la cible |
| `effects?` | Effets déclenchés | — |

**`desc`** est un **copié/collé VERBATIM** de la source (Markdown conservé, jamais reformulé ni
résumé — règle 5 de `CLAUDE.md`) : le texte affiché doit pouvoir être recollé tel quel dans
`Source/`. Rendu en jeu par l'unique primitive `<Prose>`.

## 2. Portée / Cible / Durée — des unions STRUCTURÉES

Plus aucune prose n'est re-parsée au runtime : les trois champs sont des unions discriminées par
`kind`. La colonne de droite est la population RÉELLE de chaque forme dans `src/data/spells.json` — une
forme à 0 est déclarée mais jamais exercée par la donnée.

### `range` — d'où le sort part (`src/engine/spellRange.ts`)

| Forme (`kind`) | Champs | Entrées de `spells.json` |
|---|---|---|
| `self` | — | 146 |
| `touch` | — | 77 |
| `distance` | `value`, `unit` | 263 |
| `special` | `text` | 37 |

53 entrées portent `range: null` (portée non applicable ou non renseignée).

### `target` — qui/quoi il affecte (`src/engine/spellRange.ts`)

| Forme (`kind`) | Champs | Entrées de `spells.json` |
|---|---|---|
| `self` | — | 127 |
| `count` | `n` | 179 |
| `area` | `span`, `meters`, `excludesCaster?`, `affects?`, `maison?` | 99 |
| `cone` | `lengthMeters`, `widthMeters`, `affects?`, `maison?` | 1 |
| `special` | `text` | 117 |

### `duration` — combien de temps (`src/engine/spellDuration.ts`)

| Forme (`kind`) | Champs | Entrées de `spells.json` |
|---|---|---|
| `instant` | — | 137 |
| `rounds` | `value`, `plus?` | 197 |
| `clock` | `value`, `unit` | 129 |
| `untilDawn` | — | 4 |
| `special` | `text`, `plus?` | 56 |

`value`/`n`/`meters` sont des `Formula` (`src/engine/ops.ts`) : littéral `number`,
`{charOf}` (« (Force Mentale) ») ou `{bonusOf}` (« (Bonus de FM) »). Les `parseSpellRange`/
`parseSpellTarget`/`parseSpellDuration` ne servent qu'à la MIGRATION prose → structure
(authoring), jamais au runtime ni à l'affichage — l'affichage est dérivé par
`src/engine/spellRangeFormat.ts`. Pour un sort neuf : écrire directement la forme structurée.

## 3. Effets mécaniques — `effects`

`effects` est le **Flow ÉDITABLE** (do / if / test) dont les feuilles sont des `EffectOp`
(`{ type: 'ops', on, ops: GameOp[] }`) — SOURCE UNIQUE des effets appliqués à l'incantation. Rien
d'autre ne porte d'effet mécanique : le vocabulaire complet des ops disponibles est catalogué dans
`docs/vocabulaire-mecanique.md`, à consulter **avant** de conclure qu'une op manque.

Au Codex, ce champ a un éditeur dédié qui réutilise le `FlowEditor` de l'éditeur de scène ; chaque
feuille pose sa cible et sa liste de `GameOp` via `GameOpEditor` — la même primitive que
traits/mutations/talents/consommables. **Ne jamais réinventer un widget de liste d'ops** (`docs/primitives.md`).

Cas particuliers, mesurés sur la donnée :

- **Projectile magique** — pas un `GameOp` : champs dédiés `missile`, `damage`, `ignorePA`,
  `ignoreBE`, lus par `missileDamage`/`isMagicMissile` (`src/engine/magic.ts`) et résolus comme
  une attaque. 40 entrées aujourd'hui.
- **Souffle** — `breathAttack`, délégué à l'attaque de zone du Trait Souffle, pas un `GameOp`.
  2 entrées.
- **Opposition** — `opposed` : `resist` 4.
- ⚠ **Deux vocabulaires de mitigation à ne pas confondre** : l'op `wounds` porte `ignoreTB`/
  `ignoreAP`, tandis que les champs de Projectile de l'entrée portent `ignorePA`/`ignoreBE`.
- Toute référence vers un autre dataset (invocation, sort de créature, liste d'un culte) se fait par
  **id stable**, jamais par libellé.

## 4. Rituels (`VDM`) — les rubriques en plus

Une entrée taguée `isRitual` imprime, en plus des champs d'un sort, les rubriques d'anatomie d'un
Rituel (`ritual`) — 17 entrées aujourd'hui :

| Rubrique | Rôle |
|---|---|
| `type` | Rubrique **Type** (`l.381`) VERBATIM — l'énoncé imprimé de qui peut y prendre part. |
| `domains` | Le même **Type** en ids de `domains.json`, part EXÉCUTABLE de la rubrique (`l.381` : « Un lanceur de sorts qui ne pratique pas l'un des Domaines listés ne peut pas y prendre part »), lue par `arcaneDomainsOf`/`eligibleTalent` (`src/engine/grimoire.ts`). |
| `cnFrom?` | Rubrique **NI** (`l.379`) lorsqu'elle n'imprime PAS un nombre mais une formule sur la CIBLE (« Force Mentale du démon ») : `cn` reste `null`, et la fiche Codex affiche ce texte au lieu d'un NI muet. |
| `xp` | Rubrique **PX d'apprentissage** (`l.383`). |
| `reduced?` | DIFFICULTÉ RÉDUITE imprimée entre parenthèses (`VDM 02 l.398` : « **NI :** 50 (25) », `l.400` : « **PX d'apprentissage :** 200 (100) »), dont la rubrique `type` nomme les bénéficiaires. |
| `components` | Rubrique **Composants** (`l.385`) VERBATIM. |
| `conditions` | Rubrique **Conditions** (`l.387`) VERBATIM. |
| `sacrifices` | Rubrique **Sacrifices** (`l.389`) VERBATIM. |
| `consequences` | Rubrique **Conséquences** (`l.391`) VERBATIM. |

## 5. Classification mécanique — `spellSupport`

`spellSupport(ops, spell, missile)` (`src/engine/spellspec.ts:30`) rend l'une des
3 issues `mecanique` / `partiel` / `narratif`. Elle alimente le tableau de bord et le
badge affiché en jeu. `ops` est l'union des feuilles du Flow pour la cible ET pour le lanceur : un
effet de lanceur (téléportation, poussée, chaîne, invocation, zone, vol de vie) compte autant qu'un
effet de cible.

## 6. Curer un sort narratif → mécanique

1. Repérer le sort dans `docs/sorts-implementation.md` (📜 ou 🟡, colonne « Curé » = repli).
2. Ouvrir le Codex en jeu → catégorie « Sorts » → l'entrée.
3. Relire la `desc` VERBATIM (ne pas la réécrire) et identifier l'effet mécanisable ; l'exprimer en
   `GameOp` du catalogue existant plutôt qu'en champ ad hoc.
4. Compléter `range`/`target`/`duration` structurés s'ils sont absents (§2).
5. Éditer `effects` au `FlowEditor` ; ce qui reste irréductible (arbitrage laissé au MJ par la
   source) reste une feuille `narrative` — jamais inventé, jamais supprimé en silence.
6. Poser `curated: true` quand la spec est jugée complète — ce marqueur n'a de sens que pour une
   entrée de la base officielle.
7. Enregistrer, puis régénérer le tableau de bord (`npm run docs:sorts`) et lancer les gardes.

## Gardes

| Garde | Ce qu’elle verrouille (son propre `describe`) |
|---|---|
| `src/state/spell-flow-completeness.test.ts` | Complétude : tout sort porte ses effets dans un Flow exécutable (SpellData.effects) |
| `src/engine/spellspec.test.ts` | specs curées — résolution |
| `src/engine/spellRange.test.ts` | spellRange — round-trip parse∘format = identité (valeurs parsables) |
| `src/engine/spellDuration.test.ts` | spellDuration — round-trip parse∘format = identité |
| `src/data/fixed-damage-spells.test.ts` | sorts à dégâts FIXES (frenchy) — VERBATIM desc + BE selon LDB 13 (id-based) |
| `src/state/spell-impure-ops.test.ts` | effets « lourds » présents dans le Flow éditable (données app-owned) |
| `src/data/vdm-spells-variantes.test.ts` | donnée — 18 Sorts révisés par VDM, gatés par la RÈGLE (jamais par le livre) |
| `src/ui/compendium/no-json-fields.test.ts` | Codex — aucun champ éditable n’infère kind:json (E3b) |
| `src/data/id-collisions.test.ts` | intégrité des ids de données |

`npm run typecheck` en plus : les unions de portée/cible/durée et `Formula` sont strictement
typées — une valeur mal formée casse la compilation avant le runtime.
<!-- sources-empreinte: 529393c3c516ec68c18e03191f703766ccf93ea9 (16 fichiers, 0 dossiers) corps: 70173aa62e9514f2f9294dc3d9d232ebdf6e9ac3 -->
