/**
 * Rapport des CONSOMMATEURS PAR CHAMP — GÉNÉRÉ. Sortie : docs/consommateurs-de-champs.md.
 * Re-run : `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`).
 * Mode --check (chaîné dans `npm run docs:check`) : régénère en mémoire, compare au .md committé,
 * exit 1 si diff — jamais d'écriture en mode --check.
 *
 * Objet (#903) — la mesure INVERSE de `build-entity-orphans.mjs` : celui-ci répond « qui cite cet
 * ID d'ENTITÉ de catalogue ? », celui-ci répond « qui LIT ce CHAMP d'un TYPE de donnée structuré ? ».
 * Question fondatrice : « qui lit le champ `spec` sur une référence de dotation (`TrappingRef`) ? » —
 * affirmé « personne » sur une recherche trop étroite, sans surface pour le vérifier (cf.
 * `scripts/guards/lib/groundingCorpus.mjs`, cas `dotation-spec-consommateurs`).
 *
 * PÉRIMÈTRE MESURÉ — il n'est plus borné par la FIDÉLITÉ du détecteur : celui-ci travaille au
 * vérificateur de types (`ts.Program`/`TypeChecker`, #1620 geste (ii)) — identité par SYMBOLE de
 * propriété, porteur résolu à son type DÉCLARÉ ; la définition exacte d'une lecture et les angles
 * morts qui restent sont en tête de `scripts/guards/lib/fieldConsumers.mjs`. Les catalogues
 * `src/data/schemas/defs/*.ts` dont le `schema` d'entrée est ANONYME (`z.array(z.strictObject({…}))`)
 * ONT pour la plupart un alias TS : `src/data/index.ts` porte 41 interfaces au patron `XData`
 * (mesure 2026-09-01), dont `export interface TrappingData` (`index.ts:1113`), annotée par de vrais
 * consommateurs (`src/engine/items.ts:20`, `src/engine/activities.ts:28`/`799`/`805`/`907`) ; et la
 * liste des champs d'une entrée anonyme est dérivable sans nommage manuel
 * (`scripts/docs/lib/zod-introspect.mts#introspecterDefs`, qui descend le sceau `document()`). Les
 * y faire entrer est le geste (iii) de #1620 — dérivation de `TARGETS` par jointure `type`↔`XData`,
 * les defs sans type TS sortant par raison structurelle nommée —, pas une conséquence de ce lot.
 * Retenus (`fieldConsumerTargets.mjs`, 23 cibles) : les schémas exportés sous un nom
 * `export const xSchema` ET portant un alias TS NOMMÉ vérifiable ailleurs dans le dépôt
 * (`interface`/`type X = …`) — c'est la classe exacte où vit `TrappingRef.spec`. Candidats
 * mesurés dans `src/data/schemas/grammaire/` (formes de valeur/référence/mécanique partagées par
 * plusieurs documents) et dans les `defs/` dont les sous-schémas sont nommés (`criticals.ts`,
 * `props.ts`), réduits par les deux catégories d'exclusion ci-dessous (non un cliquet — `TARGETS`
 * est un TABLEAU statique, étendu à la main si un nouveau schéma nommé apparaît). À l'unité, le
 * geste d'auteur reste disponible : NOMMER son schéma d'entrée (et ses sous-schémas) dans SON def —
 * `export const xSchema` dans `defs/<catalogue>.ts`, patron `defs/criticals.ts`
 * (`critEscalationSchema`, `amputationSchema`) — ou dans `grammaire/` si la forme est RÉELLEMENT
 * partagée entre documents, puis l'ajouter à `TARGETS`. Un def ADOPTÉ par `document()` n'expose plus
 * son entrée en nœud zod : il publie ses clés relevées avant le sceau (`cles` du handle, patron
 * `defs/props.ts`), et `TARGETS` porte alors `cles:` au lieu de `schema:` — fait pour `props.json`
 * → `PropData`. Chaque cible doit AUSSI déclarer son `home` : c'est le module où le type est
 * cherché, et son symbole de déclaration EST l'identité de la cible (un `Ref` d'un autre module ne
 * s'y confond pas).
 *
 * QUATRE ÉTATS, jamais un « 0 » indifférencié (`fieldOwnership`, `fieldConsumers.mjs`) : LU ·
 * « 0 — JAMAIS LU » (champ PROPRE au type, aucun lecteur) · HÉRITÉ d'un ancêtre (la propriété est
 * déclarée par un type que la cible COMPOSE : son « 0 » est tautologique, les lecteurs comptent sous
 * le déclarant — la mesure du jour n'en porte aucun) · ABSENT du type TS (le champ du SCHÉMA
 * n'existe pas sur le type du `home` :
 * `AdvancementRef.table`, et 6 champs de `PropData` que `src/data/props.types.ts` ne déclare pas —
 * divergence schéma↔type, ni lue ni lisible, hors du compte des « 0 lecteur » et listée à part dans
 * le rapport).
 *
 * FIDÉLITÉ DU DÉTECTEUR (2026-09-01, #1620 geste (ii)) — les 16 champs que la version SYNTAXIQUE de
 * ce rapport donnait « 0 lecteur », échantillon COMPLET, mesurés au vérificateur de types :
 *   - 12 ont un lecteur mesuré : `DetailRecipe.tintVar`, `EntityAppearance.armurePortee`,
 *     `CritEscalation.onRepeat`, `Amputation.timing`, `FlowTest.opposed`, `CountSpec.fixed`,
 *     `CountSpec.roll`, `TrappingRef.label`, `FlowTest.argDifficulty`
 *     (`src/state/triggeredEffects.ts:73`, `f.test.argDifficulty`), `TravelTableEntry.stageOutcome`
 *     (`src/state/travelPostes.ts:363`, `enc.stageOutcome` sur un retour INFÉRÉ), `QualityRef.spec`
 *     (champ PROPRE : `qualityRefSchema` porte son propre shape) et `TraitInstance.hidden`, dont
 *     `hiddenGroupsOf` annote le porteur `TraitInstance[]` (`src/engine/groups.ts:57`). Les deux
 *     sites INFÉRÉS (`argDifficulty`, `stageOutcome`) échappent aussi à une vérification à la main,
 *     qui a le même angle mort que le scan syntaxique ;
 *   - 4 sont de VRAIS zéros : `SourceRef.note`, `CastingNumberMod.maison`/`.source`/`.desc`.
 * Sur tout le rapport (158 champs) : 6 cellules « 0 — JAMAIS LU », toutes de VRAIS zéros — les deux
 * qui ne sont pas de cet échantillon étant `PropData.type` et `PropData.label` (un décor lit sa
 * géométrie, jamais son libellé) —, 0 hérité, 7 absents du type TS. Les cardinaux du rapport sont
 * ÉMIS depuis les compteurs, jamais recopiés.
 * COÛT MESURÉ du rapport complet (23 types, 1 952 fichiers de `src/`, Program bâti UNE fois pour
 * les 23 et libéré au retour) : ~17 s et ~1,33 Go de pic, contre 1,8 s au scan syntaxique. La liste
 * des « 0 lecteur » sort NOMMÉE de cette fonction (`zeros`) et son CLIQUET vit dans
 * `src/data/field-consumers.test.ts` : liste attendue écrite champ par champ, comparée à l'identique.
 *
 * EXCLUS, avec raison :
 *   - `secondarySourceRefSchema` (`grammaire/valeurs.ts`) : aucun alias TS nommé exploitable trouvé
 *     (contrairement aux schémas retenus) — dette de nommage distincte, non traitée ici ;
 *   - `gameOpSchema`/`conditionSchema`/`effectOpSchema`/`flowSchema`/`effectTargetingSchema`/
 *     `triggeredEffectSchema`/`formulaSchema`/`combatFeatureSchema` : vocabulaire MÉCANIQUE du
 *     moteur (`GameOp`/`Condition`/`Flow`/`EffectTrigger`/`EffectTargeting`/`Formula`,
 *     `src/engine/{ops,flowCore}.ts`) déjà catalogué par `npm run docs:vocabulaire`
 *     (`docs/vocabulaire-mecanique.md`) — un second générateur ferait doublon ;
 *   - les schémas SCALAIRES/ÉNUMÉRÉS de `grammaire/valeurs.ts` (`z.enum`/`z.string()`/`z.union` de primitifs,
 *     ex. `difficultySchema`, `charKeySchema`) : aucun champ objet à consommer, hors du périmètre
 *     de la question « qui lit CE CHAMP ? ».
 */
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import { listProdFiles, scanFieldReads, fieldOwnership, groupByField } from '../guards/lib/fieldConsumers.mjs'
import { TARGETS, fieldsOf } from '../guards/lib/fieldConsumerTargets.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '').replace(/\\/g, '/')
const SRC_DIR = join(ROOT, 'src')
const OUT = 'docs/consommateurs-de-champs.md'

/** `symbole` = déclaration nommée qui ENGLOBE la lecture : l'ancre stable d'un site (le `line` bouge
 *  au premier ajout de ligne en amont). Le rapport n'en publie que `file:line` — un humain relit un
 *  site, une garde s'ancre au symbole (`src/data/field-consumers.test.ts`, table `RECOUVRES`). */
type Hit = { file: string; line: number; symbole: string }

/**
 * Le rapport, EN MÉMOIRE : le `.md` à écrire + les sites mesurés par type et par champ. UN SEUL
 * balayage du corpus nourrit les deux consommateurs — la fraîcheur du `.md` et le cas fondateur de
 * `src/data/field-consumers.test.ts`, qui appelle cette fonction EN PROCESSUS (le CLI ci-dessous
 * n'est qu'un autre appelant). `files` est INJECTABLE — le corpus par défaut est `listProdFiles`, et
 * la garde le rejoue en ordre INVERSÉ pour prouver que le `.md` ne dépend pas de l'ordre du système
 * de fichiers (le rapport est committé depuis Windows et rejoué par la CI sous Linux). Le `cache`
 * porte le `ts.Program` et l'index des accès : créé ICI,
 * partagé par les 23 cibles de `TARGETS`, et libéré au retour — ~1,33 Go ne survit pas à l'appel,
 * ce qui compte sous Vitest `isolate: false`.
 */
export function buildFieldConsumersMd(files: string[] = listProdFiles(SRC_DIR)): { md: string; byType: Map<string, Map<string, Hit[]>>; totalFields: number; totalUnread: number; zeros: string[] } {
  // Clés hétérogènes : le contexte de scan est clé par son Program (`fieldConsumers.mjs`).
  const cache = new Map<unknown, unknown>()

  let out = `# Consommateurs par champ — GÉNÉRÉ\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`npx tsx scripts/docs/build-field-consumers.mts\` (\`npm run docs:field-consumers\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (accès/déstructuration résolus au\n`
  out += `> \`TypeChecker\`, cf. \`scripts/guards/lib/fieldConsumers.mjs\`). Complète\n`
  out += `> \`docs/orphelines-donnees.md\` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.\n\n`
  out += `## Périmètre mesuré / angles morts\n\n`
  out += `Schémas NOMMÉS candidats : \`src/data/schemas/grammaire/\` (formes partagées entre documents) + les `
  out += `\`src/data/schemas/defs/\` dont les sous-schémas sont nommés (\`criticals.ts\`, \`props.ts\`) ; `
  out += `**${TARGETS.length} retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `
  out += `\`src/data/schemas/defs/*.ts\` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — non par absence de `
  out += `nom TS : l'alias existe pour la plupart (41 interfaces \`XData\` dans `
  out += `\`src/data/index.ts\`, mesure 2026-09-01 — ex. \`TrappingData\` \`index.ts:1113\`, annotée par `
  out += `\`src/engine/items.ts:20\` et \`src/engine/activities.ts:28\`) et les champs d'une entrée anonyme sont `
  out += `dérivables (\`scripts/docs/lib/zod-introspect.mts#introspecterDefs\`) —, mais parce que la DÉRIVATION `
  out += `de \`TARGETS\` (jointure \`type\`↔\`XData\`) est un geste distinct, encore à faire (#1620) ; à l'unité, `
  out += `le geste d'auteur reste ouvert (nommer `
  out += `son schéma d'entrée dans SON def — ou en \`grammaire/\` si la forme est réellement partagée — puis `
  out += `l'ajouter à \`TARGETS\`), fait pour \`props.json\` → \`PropData\`.\n\n`

  let totalFields = 0
  let totalUnread = 0
  let totalRead = 0
  let trappingRefSpecSites: string[] = []
  const herites: string[] = []
  const absents: string[] = []
  const zeros: string[] = []
  const byType = new Map<string, Map<string, Hit[]>>()
  // Les TABLES s'accumulent à part : le paragraphe de FIDÉLITÉ qui les précède cite les totaux
  // MESURÉS, et un cardinal en dur y serait faux au premier champ qui gagne ou perd son lecteur.
  let tables = ``

  // Une cible porte SOIT son nœud zod (`schema`), SOIT ses clés déjà relevées (`cles` d'un handle
  // `document()`, dont le nœud est scellé et n'expose plus de `.shape`).
  for (const { schema, cles, type, home } of TARGETS as readonly { schema?: unknown; cles?: readonly string[]; type: string; home: string }[]) {
    const fields = fieldsOf(schema ?? cles)
    const hits = scanFieldReads({ type, home }, fields, files, ROOT, cache)
    const etats = fieldOwnership({ type, home }, fields, files, ROOT, cache)
    const byField = groupByField(fields, hits)
    byType.set(type, byField)
    totalFields += fields.length
    tables += `### \`${type}\` (${home})\n\n`
    tables += `| Champ | Lecteurs | Exemple |\n|---|---|---|\n`
    for (const f of fields) {
      const list = byField.get(f) ?? []
      const uniqSites = [...new Set(list.map((h: { file: string; line: number }) => `${h.file}:${h.line}`))]
      if (type === 'TrappingRef' && f === 'spec') trappingRefSpecSites = uniqSites
      const etat = etats.get(f)
      // QUATRE états, jamais un « 0 » indifférencié : le champ ABSENT du type TS n'a rien à lire, le
      // champ HÉRITÉ vit sous son déclarant (son « 0 » y est tautologique), et seul un champ PROPRE
      // sans lecteur est une absence de lecture.
      if (etat?.etat === 'absent') {
        absents.push(`${type}.${f}`)
        tables += `| \`${f}\` | — | *absent du type TS* |\n`
      } else if (uniqSites.length > 0) {
        totalRead++
        tables += `| \`${f}\` | ${uniqSites.length} | \`${uniqSites[0]}\` |\n`
      } else if (etat?.etat === 'herite') {
        herites.push(`${type}.${f}`)
        tables += `| \`${f}\` | 0 ici — hérité de \`${etat.declarant ?? '?'}\` | — |\n`
      } else {
        totalUnread++
        zeros.push(`${type}.${f}`)
        tables += `| \`${f}\` | **0 — JAMAIS LU** | — |\n`
      }
    }
    tables += `\n`
  }

  // Une classe d'état ne s'ÉNONCE que si elle a des membres : à 0, ni parenthèse vide ni glose
  // commentant une liste inexistante — le membre disparaît de la phrase, cardinal compris (la
  // Synthèse, elle, porte TOUJOURS les quatre cardinaux, y compris les zéros). Mesuré le
  // 2026-09-01 : `QualityRef.spec` a gagné son propre shape, `hérités` est passé à 0, et la phrase
  // rendait « **0 hérité** d'un type ancêtre () — leur « 0 » est tautologique ».
  const classe = (membres: string[], tete: (n: number) => string, glose = ``) =>
    membres.length === 0
      ? null
      : `**${membres.length} ${tete(membres.length)}** (${membres.map((m) => `\`${m}\``).join(', ')})${glose}`
  const etats = [
    totalRead === 0 ? null : `**${totalRead} lus**`,
    classe(zeros, () => `« 0 — JAMAIS LU »`, ` — champ PROPRE au type, aucun lecteur`),
    classe(
      herites,
      (n) => `hérité${n > 1 ? 's' : ''} d'un type ancêtre`,
      ` — leur « 0 » est tautologique, les lecteurs comptent sous le déclarant`,
    ),
    classe(
      absents,
      (n) => `absent${n > 1 ? 's' : ''} du type TS`,
      ` — le champ du schéma n'existe pas sur le type : divergence schéma↔type, listée en fin de rapport`,
    ),
  ].filter((p): p is string => p !== null)

  out += `Détection au VÉRIFICATEUR DE TYPES (\`ts.Program\`/\`TypeChecker\`) : un lecteur est un accès dont le `
  out += `SYMBOLE de propriété est celui déclaré par le type cible, la propriété devant lui être PROPRE ou son `
  out += `porteur être DÉCLARÉ de ce type — aucune annotation littérale n'est cherchée, et un type anonyme de `
  out += `même forme ne crédite rien. Quatre états sont mesurés, dont deux ne sont pas des mesures de lecture `
  out += `(hérité, absent du type TS) ; ceux qui ont des membres ici : ${etats.join(' ; ')}, sur ${totalFields} `
  out += `champs de ${TARGETS.length} types.\n\n`
  out += `Le détecteur SYNTAXIQUE qui a précédé (annotation littérale du type) rendait 41 champs « 0 lecteur » `
  out += `sur ces mêmes ${totalFields}. Des 16 « 0 lecteur » de la première version de ce rapport `
  out += `(échantillon COMPLET), 12 ont un lecteur mesuré — dont \`argDifficulty\` et \`stageOutcome\`, `
  out += `qu'une vérification à la main manque comme le scan syntaxique, \`spec\` d'une \`QualityRef\` `
  out += `(champ PROPRE : \`qualityRefSchema\` porte son propre shape) et \`hidden\` d'un \`TraitInstance\` `
  out += `(\`hiddenGroupsOf\` annote \`TraitInstance[]\`) ; les 4 autres sont de vrais zéros. `
  out += `Coût : ~17 s et ~1,3 Go pour un rapport complet, contre 1,8 s au scan `
  out += `syntaxique. Angles morts (redéclaration structurelle, spread, clé dynamique, champ absent du type) : `
  out += `en-tête de \`fieldConsumers.mjs\`.\n\n`
  out += tables

  // La section dédiée est le RENDU d'une liste : sans membre, elle est OMISE plutôt que titrée
  // « aucun » — un titre qui ne commente rien. Le fait « 0 absent » n'est pas perdu pour autant : la
  // Synthèse émet les quatre cardinaux, zéros compris.
  if (absents.length > 0) {
    out += `## Champs du schéma ABSENTS du type TS\n\n`
    out += `${absents.length} champs déclarés au SCHÉMA n'existent pas sur le type TS de leur \`home\` : `
    out += `${absents.map((a) => `\`${a}\``).join(', ')}. `
    out += `Divergence schéma↔type — ni lus ni lisibles, hors du compte des « 0 lecteur ».\n\n`
  }

  out += `## Synthèse\n\n`
  out += `${TARGETS.length} types, ${totalFields} champs mesurés : ${totalRead} lus, **${totalUnread} avec `
  out += `« 0 lecteur » mesuré** au \`TypeChecker\`, ${herites.length} `
  out += `hérité${herites.length > 1 ? 's' : ''}, ${absents.length} absent${absents.length > 1 ? 's' : ''} du `
  out += `type TS. Ces « 0 lecteur » sont sous CLIQUET NOMINATIF (\`src/data/field-consumers.test.ts\`) : la `
  out += `liste attendue y est écrite champ par champ — un zéro apparu comme un zéro disparu est rouge, et `
  out += `la ligne ne se retire qu'avec le lecteur qui l'annule.\n\n`
  // Les lecteurs sont ÉNUMÉRÉS depuis la mesure (jamais un nom en dur) : la phrase reste vraie quand
  // le nombre de lecteurs change — #1463 L-ref-1 en a ajouté un (matérialisation de la spec sur
  // l'`ItemInstance`) et la version « l'unique lecteur est `resolveOne` » est devenue fausse en
  // silence. La clause de RENDU suit la mesure elle-même : un lecteur dans `src/data/index.ts`
  // signalerait une SECONDE définition du libellé affiché (cf. `src/data/field-consumers.test.ts`).
  const specDansLeRendu = trappingRefSpecSites.some((s) => s.startsWith('src/data/index.ts'))
  // DEUX paragraphes, et la coupure est STRUCTURELLE : la porte de commit `check-docs-vs-head.mjs`
  // exige que chaque `fichier:ligne` cité porte, à ±2 lignes du site AU COMMIT, l'un des identifiants
  // backtiqués de la MÊME ligne du doc. La ligne des SITES ne backtique donc que `spec` (présent aux
  // deux sites) ; les identifiants du RENDU (`trappingRefLabel`, `refConcrete`), qui vivent dans
  // `src/data/index.ts`, restent sur une ligne SANS `fichier:ligne`.
  out += `## Cas fondateur\n\n`
  out += `Le champ \`spec\` d'une référence de dotation a ${trappingRefSpecSites.length} lecteur(s) mesuré(s)`
  out += trappingRefSpecSites.length === 0 ? ` — aucun site.\n\n` : ` — ${trappingRefSpecSites.map((s) => `\`${s}\``).join(', ')}.\n\n`
  out += `\`trappingRefLabel\` `
  out += `(\`src/data/index.ts\`, SOURCE UNIQUE du libellé affiché d'une \`TrappingRef\`) `
  out += specDansLeRendu
    ? `LIT \`ref.spec\` : une SECONDE définition du rendu « base (spec) », qui appartient à \`refConcrete\`.\n`
    : `ne lit PAS \`ref.spec\` — le rendu « base (spec) » passe par \`refConcrete\`, partagée par toute \`RefDesignee\`.\n`

  // `zeros` sort NOMMÉ (`Type.champ`) : le cliquet de `src/data/field-consumers.test.ts` compare
  // cette liste à la sienne, écrite en dur — aucun re-parsing du `.md`, dont la table est un RENDU.
  return { md: out, byType, totalFields, totalUnread, zeros }
}

/** CLI : écriture du `.md`, ou `--check` (chaîné dans `npm run docs:check`). */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { md, totalFields, totalUnread } = buildFieldConsumersMd()
  emitOrCheck({
    out: md,
    path: OUT,
    check: process.argv.includes('--check'),
    staleMsg: `docs:field-consumers — ${OUT} est PÉRIMÉ (les schémas/le code source ont changé).`,
    rerunMsg: '  → relancer `npm run docs:field-consumers` et committer le résultat.',
    okMsg: `docs:field-consumers — OK (${OUT} à jour, ${totalUnread}/${totalFields} champs « 0 lecteur » PROPRES)`,
    writeMsg: `${OUT} — ${totalUnread}/${totalFields} champs « 0 lecteur » PROPRES sur ${TARGETS.length} types.`,
  })
}
