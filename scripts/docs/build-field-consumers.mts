/**
 * Rapport des CONSOMMATEURS PAR CHAMP — GÉNÉRÉ. Sortie : docs/consommateurs-de-champs.md.
 * Re-run : `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`).
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 * Objet (#903) — « qui LIT ce CHAMP d'un TYPE de donnée structuré ? ».
 * Question fondatrice : « qui lit le champ `spec` sur une référence de dotation (`TrappingRef`) ? » —
 * affirmé « personne » sur une recherche trop étroite, sans surface pour le vérifier (cf.
 * `scripts/guards/lib/groundingCorpus.mjs`, cas `dotation-spec-consommateurs`).
 *
 * PÉRIMÈTRE — le détecteur travaille au vérificateur de types (`ts.Program`/`TypeChecker`) : identité
 * par SYMBOLE de propriété, porteur résolu à son type DÉCLARÉ ; la définition exacte d'une lecture et
 * les angles morts qui restent sont en tête de `scripts/guards/lib/fieldConsumers.mjs`. Ses cibles ont
 * deux sources, réunies en une liste (un type atteint des deux côtés est UNE cible, à l'union de ses
 * champs) :
 *   - CATALOGUES, DÉRIVÉES : `ciblesDeCatalogue` (`scripts/guards/lib/schemaFieldConsumers.mjs`) lit,
 *     sur la jointure des chargements de `mesurerChampsDeSchema`, le type que les chargements de chaque
 *     def de `SCHEMA_DEFS` donnent EXPLICITEMENT à son entrée (`xJson as XData[]`, annotation, porte
 *     `rangeesDe`) ; la cible est ce type, domicilié au module qui le déclare, avec les clés de l'entrée
 *     au schéma. Un catalogue chargé sous un type nommé entre au rapport sans qu'aucune liste change ;
 *     un def dont aucun chargement ne nomme l'entrée (littéral inline, intersection, `unknown`, vues de
 *     sous-chemins seules, aucun chargement typé) SORT dans la table « Catalogues sans type TS nommé »,
 *     avec la raison que la jointure mesure ;
 *   - GRAMMAIRE, DÉCLARÉES : `CIBLES_DE_GRAMMAIRE` (`scripts/guards/lib/fieldConsumerTargets.mjs`), les
 *     sous-schémas NOMMÉS sans dataset propre — formes de valeur/référence/mécanique de `grammaire/`
 *     partagées entre documents, sous-schémas nommés de `defs/criticals.ts` et `defs/props.ts` — que la
 *     dérivation ne peut pas atteindre, puisqu'aucun chargement ne les vise en propre.
 * Chaque cible porte son `home` : le module où le type est cherché, dont le symbole de déclaration EST
 * l'identité de la cible (un `Ref` d'un autre module ne s'y confond pas).
 *
 * QUATRE ÉTATS, jamais un « 0 » indifférencié (`fieldOwnership`, `fieldConsumers.mjs`) : LU ·
 * « 0 — JAMAIS LU » (champ PROPRE au type, aucun lecteur) · HÉRITÉ d'un ancêtre (la propriété est
 * déclarée par un type que la cible COMPOSE : son « 0 » est tautologique, les lecteurs comptent sous
 * le déclarant) · ABSENT du type TS (le champ du SCHÉMA n'existe pas sur le type du `home` :
 * divergence schéma↔type, ni lue ni lisible, hors du compte des « 0 lecteur » et listée à part dans
 * le rapport). Hors clés d'ENVELOPPE de `document()` (`CLES_ENVELOPPE`, classe structurelle posée
 * sur tout document, émise à part), les « 0 — JAMAIS LU » et les absents sont sous cliquet NOMINATIF
 * dans `src/data/field-consumers.test.ts` ; les cardinaux du rapport sont ÉMIS depuis les compteurs,
 * jamais recopiés.
 *
 * FIDÉLITÉ DU DÉTECTEUR (2026-09-01, #1620 geste (ii)) — les 16 champs que la version SYNTAXIQUE de
 * ce rapport donnait « 0 lecteur », échantillon COMPLET, mesurés au vérificateur de types :
 *   - 12 ont un lecteur mesuré : `DetailRecipe.tintVar`, `EntityAppearance.armurePortee`,
 *     `CritEscalation.onRepeat`, `Amputation.timing`, `FlowTest.opposed`, `CountSpec.fixed`,
 *     `CountSpec.roll`, `TrappingRef.label`, `FlowTest.argDifficulty`
 *     (`withArg` de `src/noyau/triggeredEffects.ts`, `f.test.argDifficulty`), `TravelTableEntry.stageOutcome`
 *     (`buildWeatherResistanceSteps` de `src/noyau/travelPostes.ts`, `enc.stageOutcome` sur un retour
 *     INFÉRÉ), `QualityRef.spec`
 *     (champ PROPRE : `qualityRefSchema` porte son propre shape) et `TraitInstance.hidden`, dont
 *     `hiddenGroupsOf` annote le porteur `TraitInstance[]` (`src/engine/groups.ts`). Les deux
 *     sites INFÉRÉS (`argDifficulty`, `stageOutcome`) échappent aussi à une vérification à la main,
 *     qui a le même angle mort que le scan syntaxique ;
 *   - 4 étaient de VRAIS zéros ce jour-là : `SourceRef.note`, `CastingNumberMod.maison`/`.source`/`.desc`.
 * COÛT MESURÉ du rapport complet : `COUT_MESURE` ci-dessous, émis dans le rapport.
 *
 * EXCLUS, avec raison :
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
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { listProdFiles, scanFieldReads, fieldOwnership, groupByField, libererCache } from '../guards/lib/fieldConsumers.mjs'
import { CIBLES_DE_GRAMMAIRE, fieldsOf } from '../guards/lib/fieldConsumerTargets.mjs'
import { ciblesDeCatalogue } from '../guards/lib/schemaFieldConsumers.mjs'
import { repoProgram, libererSessions, type SessionProgramme } from '../guards/lib/tsProgram.mjs'
import { SCHEMA_DEFS } from '../../src/data/schemas/_registry.generated'
import { CLES_ENVELOPPE } from '../../src/data/schemas/grammaire/document'

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '').replace(/\\/g, '/')
const SRC_DIR = join(ROOT, 'src')
const OUT = 'docs/consommateurs-de-champs.md'
/** Mesure du rapport complet sur ce dépôt (Program, dérivation et scan de toutes les cibles). */
const COUT_MESURE = '~26 s et ~2,2 Go de pic (mesure 2026-11-05)'

/** `symbole` = déclaration nommée qui ENGLOBE la lecture : l'ancre stable d'un site (le `line` bouge
 *  au premier ajout de ligne en amont). Le rapport n'en publie que `file:line` — un humain relit un
 *  site, une garde s'ancre au symbole (`src/data/field-consumers.test.ts`, table `RECOUVRES`). */
type Hit = { file: string; line: number; symbole: string }

/** Une cible du rapport : le type nommé, son module de déclaration (l'identité), ses champs, et les
 *  catalogues dont il type l'entrée (vide pour une cible de grammaire seule). */
type Cible = { type: string; home: string; champs: string[]; catalogues: string[] }

/** Un catalogue sans type TS nommé d'entrée, et la raison que la jointure mesure. */
type Sortie = { file: string; raison: string }

/** Les cibles de GRAMMAIRE, puis celles de CATALOGUE dérivées : un type atteint deux fois est UNE
 *  cible, à l'union de ses champs. */
function reunirCibles(grammaire: readonly { schema: unknown; type: string; home: string }[], catalogues: readonly { type: string; home: string; cles: string[]; files: string[] }[]): Cible[] {
  const cibles = new Map<string, Cible>()
  const poser = (type: string, home: string, champs: string[], files: string[]) => {
    const deja = cibles.get(`${home}#${type}`)
    cibles.set(`${home}#${type}`, deja
      ? { type, home, champs: [...new Set([...deja.champs, ...champs])], catalogues: [...deja.catalogues, ...files] }
      : { type, home, champs, catalogues: [...files] })
  }
  for (const { schema, type, home } of grammaire) poser(type, home, fieldsOf(schema), [])
  for (const { type, home, cles, files } of catalogues) poser(type, home, cles, files)
  return [...cibles.values()]
}

/** Une clé d'ENVELOPPE de `document()` (`CLES_ENVELOPPE`) : posée par la fabrique sur tout document,
 *  elle est une classe STRUCTURELLE, émise au rapport et hors des cliquets nominatifs. */
const estCleDEnveloppe = (champ: string): boolean => (CLES_ENVELOPPE as readonly string[]).includes(champ.slice(champ.indexOf('.') + 1))

/** Ce que les fixtures injectent : la racine, un Program EMPRUNTÉ (jamais libéré ici), les defs et les
 *  cibles de grammaire. Absent, c'est le dépôt : son registre, ses cibles, un Program bâti et libéré ici. */
type Contexte = { racine?: string; programme?: SessionProgramme; definitions?: readonly { file: string; schema: unknown }[]; grammaire?: readonly { schema: unknown; type: string; home: string }[] }

/**
 * Le rapport, EN MÉMOIRE : le `.md` à écrire + les sites mesurés par type et par champ. UN SEUL
 * balayage du corpus nourrit les deux consommateurs — le rendu du `.md` et le cas fondateur de
 * `src/data/field-consumers.test.ts`, qui appelle cette fonction EN PROCESSUS (le CLI ci-dessous
 * n'est qu'un autre appelant). `files` est INJECTABLE — le corpus par défaut est `listProdFiles`, et
 * la garde le rejoue en ordre INVERSÉ pour prouver que le `.md` ne dépend pas de l'ordre du système
 * de fichiers (le rapport est committé depuis Windows et rejoué par la CI sous Linux). UN Program,
 * bâti ICI sur `files`, sert la dérivation des cibles de catalogue et le scan de toutes les cibles ; il
 * est libéré au retour avec le contexte de scan (`cache`), ce qui compte sous Vitest `isolate: false`.
 * `zeros` et `absents` rendus sont ceux HORS clés d'enveloppe : la matière des cliquets nominatifs.
 */
export function buildFieldConsumersMd(files: string[] = listProdFiles(SRC_DIR), contexte: Contexte = {}): { md: string; byType: Map<string, Map<string, Hit[]>>; totalFields: number; totalUnread: number; zeros: string[]; absents: string[]; cibles: Cible[]; sorties: Sortie[] } {
  const { racine = ROOT, programme, definitions = SCHEMA_DEFS, grammaire = CIBLES_DE_GRAMMAIRE } = contexte
  // Clés hétérogènes : le contexte de scan est clé par son Program (`fieldConsumers.mjs`).
  const cache = new Map<unknown, unknown>()
  const erreurs: unknown[] = []
  const session = programme ?? repoProgram(racine, () => files.map((f) => resolve(f)))
  let cibles: Cible[] = []
  let sorties: Sortie[] = []

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

  try {
    const derivees = ciblesDeCatalogue(racine, session, files, definitions)
    sorties = derivees.sorties
    cibles = reunirCibles(grammaire, derivees.cibles)
    for (const { type, home, champs: fields, catalogues } of cibles) {
      if (byType.has(type)) throw new Error(`build-field-consumers : deux cibles nommées \`${type}\` — le rapport les indexe par nom`)
      const hits = scanFieldReads({ type, home }, fields, files, racine, cache, session)
      const etats = fieldOwnership({ type, home }, fields, files, racine, cache, session)
      const byField = groupByField(fields, hits)
      byType.set(type, byField)
      totalFields += fields.length
      tables += `### \`${type}\` (${home})\n\n`
      if (catalogues.length) tables += `Entrée de ${catalogues.map((c) => `\`${c}\``).join(', ')}.\n\n`
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
  } catch (erreur) { erreurs.push(erreur) }
  finally { libererSessions([{ dispose: () => libererCache(cache) }, ...(programme ? [] : [session])], erreurs) }

  const nGrammaire = cibles.filter((c) => c.catalogues.length === 0).length
  let out = `# Consommateurs par champ — GÉNÉRÉ\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`npx tsx scripts/docs/build-field-consumers.mts\` (\`npm run docs:field-consumers\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Pour chaque type de donnée NOMMÉ — entrée de catalogue ou forme de grammaire —, qui LIT chaque champ (accès/déstructuration résolus au\n`
  out += `> \`TypeChecker\`, cf. \`scripts/guards/lib/fieldConsumers.mjs\`).\n\n`
  out += `## Périmètre mesuré / angles morts\n\n`
  out += `Le cliquet des déclarations de datasets est distinct du relevé par type nommé ci-dessous. `
  out += `\`mesurerChampsDeSchema\` (\`scripts/guards/lib/schemaFieldConsumers.mjs\`) descend les schémas `
  out += `du registre des données avec \`enfantsDe\` : un champ doit être couvert par une vue TS explicite `
  out += `reliée au dataset, par le type d'une grammaire partagée, ou par une lecture reliée à ce dataset. `
  out += `La présence dans le JSON inféré et la validation du schéma ne comptent pas. Les imports JSON, `
  out += `les chargements synchrones à chemin statique, leurs alias et les projections de variantes sont suivis. `
  out += `La mesure de ce cliquet est exécutée dans \`src/data/field-consumers.test.ts\`, qui la compare `
  out += `exactement à un stock nominatif motivé : chaque chemin est déclaré individuellement, sans exemption `
  out += `de classe ; un diagnostic nouveau ou disparu impose de réviser ce stock. Le stock des champs typés `
  out += `sans lecteur du relevé ci-dessous reste distinct.\n\n`
  out += `**${cibles.length} types** mesurés : ${cibles.length - nGrammaire} entrées de CATALOGUE, DÉRIVÉES de la `
  out += `même jointure (\`ciblesDeCatalogue\`) — pour chaque def du registre, le type que ses chargements donnent `
  out += `EXPLICITEMENT à son entrée, domicilié au module qui le déclare, avec les clés de l'entrée au schéma —, et `
  out += `${nGrammaire} formes de GRAMMAIRE déclarées (\`CIBLES_DE_GRAMMAIRE\`, \`scripts/guards/lib/fieldConsumerTargets.mjs\` : `
  out += `sous-schémas nommés sans dataset propre). `
  out += sorties.length === 0
    ? `Tout catalogue du registre a un type TS nommé d'entrée.\n\n`
    : `${sorties.length} catalogue${sorties.length > 1 ? 's' : ''} sans type TS nommé d'entrée, avec la raison mesurée : `
      + `table « Catalogues sans type TS nommé » en fin de rapport.\n\n`

  // Une classe d'état ne s'ÉNONCE que si elle a des membres : à 0, ni parenthèse vide ni glose
  // commentant une liste inexistante — le membre disparaît de la phrase, cardinal compris (la
  // Synthèse, elle, porte TOUJOURS les quatre cardinaux, y compris les zéros). Mesuré le
  // 2026-09-01 : `QualityRef.spec` a gagné son propre shape, `hérités` est passé à 0, et la phrase
  // rendait « **0 hérité** d'un type ancêtre () — leur « 0 » est tautologique ».
  const classe = (membres: string[], tete: (n: number) => string, glose = ``) =>
    membres.length === 0
      ? null
      : `**${membres.length} ${tete(membres.length)}**${glose}`
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
      ` — le champ du schéma n'existe pas sur le type : divergence schéma↔type`,
    ),
  ].filter((p): p is string => p !== null)

  out += `Détection au VÉRIFICATEUR DE TYPES (\`ts.Program\`/\`TypeChecker\`) : un lecteur est un accès dont le `
  out += `SYMBOLE de propriété est celui déclaré par le type cible, la propriété devant lui être PROPRE ou son `
  out += `porteur être DÉCLARÉ de ce type — aucune annotation littérale n'est cherchée, et un type anonyme de `
  out += `même forme ne crédite rien. Quatre états sont mesurés, dont deux ne sont pas des mesures de lecture `
  out += `(hérité, absent du type TS) ; ceux qui ont des membres ici : ${etats.join(' ; ')}, sur ${totalFields} `
  out += `champs de ${cibles.length} types ; les listes nominatives sont en fin de rapport. `
  out += `Coût : ${COUT_MESURE} pour un rapport complet. Angles morts (redéclaration structurelle, spread, `
  out += `clé dynamique, champ absent du type) : en-tête de \`fieldConsumers.mjs\`.\n\n`
  out += tables

  // Une section dédiée est le RENDU d'une liste : sans membre, elle est OMISE plutôt que titrée
  // « aucun » — un titre qui ne commente rien. Le fait « 0 » n'est pas perdu pour autant : la
  // Synthèse émet les quatre cardinaux, zéros compris.
  const liste = (membres: string[]) => membres.map((m) => `\`${m}\``).join(', ')
  const zerosNommes = zeros.filter((z) => !estCleDEnveloppe(z))
  const absentsNommes = absents.filter((a) => !estCleDEnveloppe(a))
  const enveloppe = (membres: string[], etat: string) =>
    (membres.length > 0 ? ` ${membres.length} clés d'ENVELOPPE de \`document()\` (\`CLES_ENVELOPPE\`), posées par la fabrique sur tout document — classe structurelle, hors cliquet : ${etat} ${liste(membres)}.` : ``)
  if (zeros.length > 0) {
    out += `## Champs « 0 — JAMAIS LU »\n\n${zerosNommes.length} champs PROPRES hors enveloppe sans lecteur : ${liste(zerosNommes)}.`
    out += `${enveloppe(zeros.filter(estCleDEnveloppe), 'aucune n’est lue sous le type de l’entrée,')}\n\n`
  }
  if (herites.length > 0) out += `## Champs HÉRITÉS\n\n${herites.length} champs déclarés par un type ancêtre : ${liste(herites)}.\n\n`
  if (absents.length > 0) {
    out += `## Champs du schéma ABSENTS du type TS\n\n`
    out += `${absentsNommes.length} champs hors enveloppe déclarés au SCHÉMA n'existent pas sur le type TS de leur \`home\` : `
    out += `${liste(absentsNommes)}. `
    out += `Divergence schéma↔type — ni lus ni lisibles, hors du compte des « 0 lecteur ».`
    out += `${enveloppe(absents.filter(estCleDEnveloppe), 'le type de l’entrée ne les déclare pas,')}\n\n`
  }
  if (sorties.length > 0) {
    out += `## Catalogues sans type TS nommé\n\n`
    out += `Defs du registre dont aucun chargement ne donne à l'entrée un type nommé du dépôt — raison émise par `
    out += `\`ciblesDeCatalogue\` ; leurs champs restent sous la mesure des champs de schéma ci-dessus.\n\n`
    out += `| Catalogue | Raison mesurée |\n|---|---|\n`
    for (const { file, raison } of sorties) out += `| \`${file}\` | ${raison} |\n`
    out += `\n`
  }

  out += `## Synthèse\n\n`
  out += `${cibles.length} types, ${totalFields} champs mesurés : ${totalRead} lus, **${totalUnread} avec `
  out += `« 0 lecteur » mesuré** au \`TypeChecker\`, ${herites.length} `
  out += `hérité${herites.length > 1 ? 's' : ''}, ${absents.length} absent${absents.length > 1 ? 's' : ''} du `
  out += `type TS ; ${sorties.length} catalogue${sorties.length > 1 ? 's' : ''} sans type TS nommé. Hors clés d'enveloppe, `
  out += `**${zerosNommes.length} « 0 lecteur »** et **${absentsNommes.length} absents** sont sous CLIQUET NOMINATIF `
  out += `(\`src/data/field-consumers.test.ts\`) : chaque liste attendue y est écrite champ par champ — une entrée apparue `
  out += `comme une entrée disparue est rouge.\n\n`
  // Les lecteurs sont ÉNUMÉRÉS depuis la mesure (jamais un nom en dur) : la phrase reste vraie quand
  // le nombre ou le nom des lecteurs change. La clause de RENDU suit la mesure elle-même : un lecteur
  // dans `src/data/index.ts` signalerait une SECONDE définition du libellé affiché (cf. `src/data/field-consumers.test.ts`).
  const specDansLeRendu = trappingRefSpecSites.some((s) => s.startsWith('src/data/index.ts'))
  // DEUX paragraphes : un `fichier:ligne` cité porte, à ±2 lignes du site, l'un des identifiants
  // backtiqués de la MÊME ligne du doc. La ligne des SITES ne backtique donc que `spec` (présent aux
  // deux sites) ; les identifiants du RENDU (`trappingRefLabel`, `refLabel`), qui vivent dans
  // `src/data/index.ts`, restent sur une ligne SANS `fichier:ligne`.
  out += `## Cas fondateur\n\n`
  out += `Le champ \`spec\` d'une référence de dotation a ${trappingRefSpecSites.length} lecteur(s) mesuré(s)`
  out += trappingRefSpecSites.length === 0 ? ` — aucun site.\n\n` : ` — ${trappingRefSpecSites.map((s) => `\`${s}\``).join(', ')}.\n\n`
  out += `\`trappingRefLabel\` `
  out += `(\`src/data/index.ts\`, SOURCE UNIQUE du libellé affiché d'une \`TrappingRef\`) `
  out += specDansLeRendu
    ? `LIT \`ref.spec\` : une SECONDE définition du rendu « base (spec) », qui appartient à \`refLabel\`.\n`
    : `ne lit PAS \`ref.spec\` — le rendu « base (spec) » passe par \`refLabel\`, partagée par toute \`RefDesignee\`.\n`

  // `zeros` et `absents` sortent NOMMÉS (`Type.champ`) : les cliquets de `src/data/field-consumers.test.ts`
  // comparent ces listes aux leurs, écrites en dur — aucun re-parsing du `.md`, dont la table est un RENDU.
  return { md: out, byType, totalFields, totalUnread, zeros: zerosNommes, absents: absentsNommes, cibles, sorties }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre(files?: string[]): Map<string, string> {
  return new Map([[OUT, buildFieldConsumersMd(files).md]]);
}

/** CLI : écriture du `.md`, ou `--check` : `ecrireOuVerifier`, rejoué par `build-all.mjs`. */
if (import.meta.main) {
  const { md, totalFields, totalUnread, zeros, absents, cibles } = buildFieldConsumersMd()
  const cliquets = `${zeros.length} « 0 lecteur » et ${absents.length} absents hors enveloppe sous cliquet`
  ecrireOuVerifier({
    out: md,
    path: OUT,
    check: process.argv.includes('--check'),
    staleMsg: `docs:field-consumers — ${OUT} est PÉRIMÉ (les schémas/le code source ont changé).`,
    rerunMsg: '  → relancer `npm run docs:field-consumers` (dérivé jamais commité, #2203).',
    okMsg: `docs:field-consumers — OK (${OUT} à jour, ${totalUnread}/${totalFields} champs « 0 lecteur » PROPRES ; ${cliquets})`,
    writeMsg: `${OUT} — ${totalUnread}/${totalFields} champs « 0 lecteur » PROPRES sur ${cibles.length} types ; ${cliquets}.`,
  })
}
