## Design — l'op `grantTrait` porte l'instance de Trait (#1463, #1473, lot L1c #1468), 2026-09-24, v1

Signalement d'origine : fil des sorts (#1897), 2026-09-24 10:33 et 10:35 (juge de cumul 5, #1897 c.5812428730). Le fil
#1463 a pris la forme ET la migration (réponse du 2026-09-24 10:37) ; le fil des sorts ne pose que `range` sur l'op dans
`polymorph.ts` en attendant, et laisse `count` et `natural` à cette forme.

## Invariant

1. `src/data/schemas/grammaire/reference.ts` (tête `6a55a5d7c`, doc de `traitInstanceSchema`, verbatim) : « `TraitInstance`
   (`src/engine/statEntry.ts`) — Trait STRUCTURÉ partagé entre le bestiaire […] et l'espèce jouable […]. MÊME forme
   partout — jamais recopiée. » Question à laquelle il répond : combien de formes pour une instance de Trait ?
   Réponse : une, composée partout où une instance est décrite.
2. `src/engine/statEntry.ts:70-74` (verbatim) : « `id` = identifiant STABLE (slug du libellé canonique) […] ; `value` =
   numérique (Indice ou bonus signé) ; `arg` = parenthèse non-numérique ; `count` = compte en tête ; `range` = portée. »
   Question : que porte chaque champ d'une instance ? Réponse : ces cinq sens, plus `natural` et `hidden` (`:81-92`).
3. Credo, `.claude/credo.md` (verbatim) : « Réutiliser l'existant — le CANONIQUE, pas le voisin. […] Étendre le général
   et le paramétrer plutôt que créer un parallèle ». Question : une op qui octroie une chose déjà décrite par un schéma
   d'instance re-liste-t-elle ses champs ? Réponse : non, elle compose le schéma et n'ajoute que ce qui n'appartient qu'à
   l'op.

## Cas canonique déjà couvert

- `summon.addTraits: z.array(traitInstanceSchema).optional()` (`src/data/schemas/grammaire/mecanique.ts:211-219`,
  `6a55a5d7c`) : une op qui pose des instances de Trait compose le schéma d'instance, sans rien re-lister.
- `grantTalent: { op, talent: aChoix('talent') }` (`mecanique.ts:183`, train 2a1) : une op d'octroi compose la
  référence canonique de ce qu'elle octroie (`{ id, spec? }`), au lieu d'un `talentId` et d'une `spec` à plat.

`grantTrait` en est une instance : l'op octroie une instance de Trait, elle compose donc l'instance, et seuls les
champs qui n'existent pas sur une instance restent au niveau de l'op.

## Constat (mesures du lecteur, 2026-09-24, `6a55a5d7c` et `42eeb9306`, à attaquer)

- Forme actuelle (`src/engine/ops.ts:582`) : `{ op; traitId; arg?; argFrom?: 'obsessions'; indice?: Formula; indicePerSL?;
  onlyGroups?; durationRounds?; durationMinutes?; durationHours? }` ; ni `count`, ni `natural`, ni `range` (la branche des
  sorts ajoute `range?` à `42eeb9306`). `grantTrait` est dans `OPS_NON_TYPEES` (`mecanique.ts:365`) : payload LOOSE,
  `{"op":"grantTrait","traitId":"demoniaque","arg":"8+"}` passe le parse.
- L'instance est reconstruite champ par champ à trois sites : `ops.ts:2078` (case `grantTrait`), `corruption.ts:206` et
  `:232` (attache et détache de mutation), et `polymorph.ts:43` recopie `arg` et `value→indice` depuis la créature
  source. `count` (3 occurrences au bestiaire, dont `pieuvre-des-tourbieres`), `range` (13) et `natural` (34) sont perdus
  en chemin.
- `traitInstanceSchema.id` est un `z.string()`, pas une feuille `idDe('trait')` (commentaire de `summon`, `mecanique.ts`).
- Donnée : 132 occurrences de `grantTrait` (`mutations` 43, `spells` 37, `tables` 37, `maneuvers` 6, `symptoms` 3,
  `trappings` 3, `traits` 2, `domains` 1), aucune dans `src/scenes`. Une seule diverge entre les branches : la Langue
  préhensile de `tables.json:294-300` porte `arg: "6 mètres"` sur `6a55a5d7c` et `range: 6` au niveau de l'op sur
  `42eeb9306`.
- Éditeur : le panneau `grantTrait` de `GameOpEditor.tsx:1041-1047` n'expose que `traitId`, `arg` et `indice` ; les
  instances de statbloc passent par `TraitListField` (`src/ui/compendium/StructFields.tsx:695-725`,
  `formatTrait`⇄`parseTraitInstance`), qui voit tous les champs.
- `refusDArgDeTrait` n'existe que sur `42eeb9306` (`reference.ts:34-40`), branché sur `traitInstanceSchema` par un
  `superRefine`.

## Design

**D1 — La forme.** `grantTrait: { op, trait, indice?, indicePerSL?, argFrom?, onlyGroups?, <durée> }`. `trait` est
l'instance octroyable : le schéma d'instance canonique moins `value`, DÉRIVÉ de `traitInstanceSchema` (jamais re-listé),
refus d'`arg` compris. L'Indice n'a qu'une graphie sur l'op : `indice` (Formula, constante ou calculée, plus
`indicePerSL`). `argFrom` exclut `trait.arg`. `src` n'est jamais authoré.

**D2 — Un seul refus d'`arg`.** Le refus d'un `arg` qui n'est qu'un Indice ou une Portée vient de l'instance composée :
aucun second prédicat sur l'op. Il arrive avec la branche des sorts ; ce design exige que la dérivation de D1 le garde
(question Q6).

**D3 — Une seule construction d'instance.** Le moteur construit l'instance accordée en étalant `o.trait`, puis en posant
`value` (Indice résolu), `arg` tiré (`argFrom`) et `src`. `ops.ts` (case `grantTrait`) et `corruption.ts` (attache,
détache) passent par une seule fonction ; `polymorph.ts` émet `trait` depuis l'instance de la créature (sans `value`) et
`indice` depuis sa `value`, si bien que `count`, `range` et `natural` survivent.

**D4 — Typée.** `grantTrait` quitte `OPS_NON_TYPEES` et entre dans `OP_DEFS` ; le type `GameOp` de l'op suit le schéma
selon le patron que les trains 1 et 2a1 de la ligne ont posé pour les ops typées (à citer en sortie).

**D5 — L'éditeur compose aussi.** Le panneau `grantTrait` édite `trait` avec l'éditeur d'UNE instance de Trait que
`TraitListField` utilise par élément (extrait s'il n'existe pas seul), plus les champs propres à l'op. Le champ Portée
que la branche des sorts ajoute au panneau se replie dans cet éditeur à la fusion.

**D6 — Le rendu compose aussi.** `opRows`/`humanize` et tout lecteur d'affichage de l'op rendent `o.trait` par
`TraitChip` (`src/ui/EntityChip.tsx:45`).

**D7 — Migration.** Script daté sous `scripts/migrations/`, au patron de `2026-08-24-give-trapping-label-vers-id.mjs`
(fail-fast, idempotent, compte textuel confronté au compte structurel), sur `src/data/**/*.json`, `src/scenes/**/*.json`
et `scripts/arene/*.mjs`. Il reconnaît les deux formes de départ, `traitId`/`arg` à plat et le `range` au niveau de l'op
(`42eeb9306`), pour qu'on le rejoue après la fusion de la branche des sorts ; une rejouée est sans effet.

## Questions (réponse citée en sortie, jamais présumée)

- **Q1 — `trait.id` en feuille `idDe('trait')` ?** Sonde : tous les `id` d'instance de Trait (bestiaire, espèces,
  scènes, `summon.addTraits`, `grantTrait`) résolvent-ils au catalogue des Traits ? Si oui, l'instance se type par
  référence dans ce lot (strate Référence, #1463) ; sinon, lister les ids qui ne résolvent pas, avec leur raison.
- **Q2 — `value` hors de l'instance octroyable.** Toutes les occurrences `indice` des 132 disent-elles un Indice (pas un
  « bonus signé » d'une autre nature, `statEntry.ts:73`) ? Sonde sur les valeurs.
- **Q3 — `onlyGroups`.** Quels Groupes nomme-t-il (sonde), quel est leur vocabulaire ou leur espace d'ids, et comment se
  type-t-il ?
- **Q4 — durée.** `durationRounds`/`durationMinutes`/`durationHours` ici, `rounds`/`minutes`/`hours`/`days` sur
  `castPenalty` (`mecanique.ts:170-180`) : un concept, deux graphies ? Mesurer les ops qui portent une durée ; si c'est
  un seul concept, dire ce que D1 adopte sans ouvrir une troisième graphie.
- **Q5 — la classe.** `grantWeapon`/`grantNaturalWeapon` (`ops.ts:789-805`, contre `weaponSchema`) et `grantPsychTrait`
  (`ops.ts:594`) re-listent-ils un schéma d'instance existant ? Si oui, ce design pose-t-il la règle générale et quel
  lot solde chacun ; une garde mécanique de la classe (op d'octroi qui re-liste les champs d'un schéma d'instance) est-elle
  possible sous `scripts/guards/lib/` ?
- **Q6 — dériver sans perdre le refus.** Comment dériver « l'instance moins `value` » de `traitInstanceSchema` sans
  re-lister ses champs ni perdre son `superRefine` (sonde du comportement de zod 4.4.3, `package.json`) ?
- **Q7 — `polymorph.ts`.** Le texte narratif de `polymorph.ts` dit « — arbitrage MJ. » ; règle 7 de `CLAUDE.md` : « Pas
  de MJ — tout se modélise. » Que dit le livre du sort (citation), et qu'est-ce qui se modélise dans ce lot ?

## Critère N+1

Un champ neuf d'instance de Trait coûte une ligne dans `traitInstanceSchema` : l'op, le moteur, la migration et
l'éditeur le portent sans autre geste.

## Périmètre et séquence

Ligne `chantier/1473-t2` (ops à référence), train après le commit de 2a2, jugé sur l'arbre de ce commit (2a2 touche
`GameOpEditor.tsx`, `mecanique.ts` et `ops.ts`). La branche des sorts garde ses gestes (`range` dans `polymorph.ts`,
champ Portée, `opRows`/`humanize`, commentaire de `reference.ts:30-32`) ; la première branche publiée impose sa base, et
la migration de D7 se rejoue après la fusion. Le fil des sorts est prévenu quand la forme est posée.

## Lexique

« instance octroyable » (l'instance de Trait qu'une op accorde, sans `value`) naît dans le commit qui pose D1.
