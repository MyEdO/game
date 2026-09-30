// GARDE DE FORME du workflow d'extraction de fiches d'Atlas (#1825 lot E).
//
// L'invariant : le script ne NOMME aucun livre ni aucun DOMAINE — ni sigle, ni titre, ni dossier, ni
// édition, ni cardinal de livres/chapitres —, ni dans son code, ni dans un PROMPT. Le périmètre
// (cœur de règles, livres, dossiers, LANGUES) et le vocabulaire des DOMAINES (carte du cœur, lot à
// traiter) lui ENTRENT par le global `args`, projetés de `src/data/books.json` et de
// `scripts/raw/domaines.json` par `perimetreDeCoeur` (`workflow-args.mjs`).
//
// Un banc qui ne lirait que le CODE raterait le cas qui a coûté : une identité de livre en dur dans
// un prompt, invisible à tout grep de table. Ce banc JOUE donc le script (enveloppe partagée
// `scripts/guards/lib/jouer-workflow.mjs`, doublures pour `agent`/`parallel`/`pipeline`/`phase`/
// `log`) avec un registre de FIXTURE à deux cœurs et deux langues dont RIEN n'existe au registre
// réel, puis confronte les prompts RÉELLEMENT envoyés.
//
// COUVERTURE — deux runs : l'un « audit sec » (chemin nominal), l'autre à TROUS et à fidélité
// REFUSÉE, qui seul atteint `applyGaps` (`augmentPrompt`) et la re-vérification. Les prompts des
// deux sont FUSIONNÉS avant jugement, et un contrat exige que CHAQUE fonction `*Prompt` du SOURCE
// ait produit au moins un prompt : une phase jamais atteinte rougit, au lieu de passer en silence.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES } from './_lib.mjs'
import { assemble } from './assemble-domain.mjs'
import { lireRendu, perimetreDeCoeur } from './workflow-args.mjs'
import { coeursDeDomaines, coeursDuRegistre, domainesDe } from './_lib.mjs'
import { scanForbiddenCounts } from './check-atlas-counts.mjs'
import { jouerWorkflow } from '../guards/lib/jouer-workflow.mjs'
import { OUTILS_ECRITURE } from '../guards/lib/contratGarde.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'

const SCRIPT = fileURLToPath(new URL('./atlas-domain.workflow.js', import.meta.url))
const SOURCE = readFileSync(SCRIPT, 'utf8')

// Registre de FIXTURE : deux cœurs, deux langues, sigles/titres/dossiers/langues inventés.
// `SXX` (sans `dir`) mesure qu'un livre sans extraction ne descend pas au périmètre.
const REGISTRE_FIXTURE = [
  { id: 'base-alpha', abbr: 'BKA', label: 'Socle Alpha', dir: 'Source/Fixture - Base Alpha', language: 'Langue-A', coeur: 'alpha' },
  { id: 'base-beta', abbr: 'BKB', label: 'Socle Beta', dir: 'Source/Fixture - Base Beta', language: 'Langue-B', coeur: 'beta' },
  { id: 'supplement-gamma', abbr: 'SPG', label: 'Appendice Gamma', dir: 'Source/Fixture - Supplement Gamma', language: 'Langue-B' },
  { id: 'sans-extraction', abbr: 'SXX', label: 'Jamais Extrait', language: 'Langue-A' },
]
// Domaines de FIXTURE : clés et titres INVENTÉS, deux cœurs — rien du registre réel.
const DOMAINES_FIXTURE = {
  alpha: [
    { cle: 'domaine-un', titre: 'Premier Domaine de Fixture' },
    { cle: 'domaine-deux', titre: 'Second Domaine de Fixture' },
  ],
  beta: [{ cle: 'domaine-trois', titre: 'Troisieme Domaine de Fixture' }],
}
const LOT = ['domaine-un']
const PERIMETRE = () => perimetreDeCoeur('alpha', {
  supplements: true, lot: LOT, registre: REGISTRE_FIXTURE, registreDomaines: DOMAINES_FIXTURE,
})

/** Rendus d'agent valides ; `trous` fait passer le run par `applyGaps` et la re-vérification. */
const repondreAvec = (trous) => {
  let audits = 0
  return (_prompt, opts) => {
    switch (opts.phase) {
      case 'Cadrage': return { coverageRefs: [{ ab: 'BKA', nn: '05' }], sonnetBooks: ['SPG'] }
      case 'Cartographie': return { items: [{ item: 'Une regle de fixture', kind: 'table', ref: 'BKA 05 l.1-2', gist: 'un gist' }] }
      case 'Taxonomie': return { topics: [{ id: 'topic-un', t: 'Topic Un', hint: 'un hint', covers: ['Une regle de fixture'] }] }
      case 'Survey': return { hits: [{ topicId: 'topic-un', ref: 'BKA 05 l.1', gist: 'un gist' }] }
      case 'Synthese': return { fiche: { title: 'Topic Un', markdown: '## Topic Un\n\nUn corps.', refs: ['BKA 05 l.1'], codeHint: '' } }
      case 'Correction': return { fiche: { title: 'Topic Un', markdown: '## Topic Un\n\nCorrige.', refs: ['BKA 05 l.1'], codeHint: '' } }
      case 'Audit':
        audits += 1
        return (trous && audits === 1)
          ? { dry: false, gaps: [{ kind: 'survole', topicId: 'topic-un', what: 'une table aux bornes', ref: 'BKA 05 l.1' }] }
          : { dry: true, gaps: [] }
      // Une fidélité REFUSÉE ouvre la correction de fidélité puis la re-vérification.
      case 'Verif': return { faithful: !trous, issues: trous ? ['une valeur fausse'] : [] }
      default: throw new Error(`phase inattendue : ${opts.phase}`)
    }
  }
}

/** Les deux runs, prompts FUSIONNÉS. */
async function promptsDesDeuxRuns() {
  const fusion = new Map()
  for (const trous of [false, true]) {
    const { promptsParLabel } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(trous))
    for (const [cle, p] of promptsParLabel) fusion.set(cle, p)
  }
  return fusion
}

/** Les deux runs, OPTIONS d'agent fusionnées — ce qui PART avec le prompt (type d'agent, modèle). */
async function optionsDesDeuxRuns() {
  const fusion = new Map()
  for (const trous of [false, true]) {
    const { optionsParLabel } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(trous))
    for (const [cle, o] of optionsParLabel) fusion.set(cle, o)
  }
  return fusion
}

/** Les fonctions de prompt du SOURCE, avec l'amorce littérale de ce qu'elles rendent. DÉRIVÉ. */
const fonctionsDePrompt = [...SOURCE.matchAll(/function (\w+Prompt)\s*\([^)]*\)\s*\{[\s\S]*?return\s+'((?:[^'\\]|\\.){10,})'/g)]
  .map((m) => ({ nom: m[1], amorce: m[2].slice(0, 20) }))

/** Bordures UNICODE : `\w` laisserait passer « ZI, ÉAA, l'ACE. */
const borde = (s) => new RegExp(`(?<![\\p{L}\\p{N}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u')

/** Toute identité du registre RÉEL : sigles, libellés, dossiers, cœurs, langues, TITRES de domaine. */
const identitesReelles = () => [
  ...REGISTRE_LIVRES.flatMap((b) => [b.abbr, b.label, b.dir].filter(Boolean)),
  ...coeursDuRegistre(REGISTRE_LIVRES),
  ...new Set(REGISTRE_LIVRES.map((b) => b.language).filter(Boolean)),
  ...coeursDeDomaines().flatMap((c) => domainesDe(c).map((d) => d.titre)),
]

test('workflow Atlas : CHAQUE fonction de prompt du script a produit un prompt (aucune phase muette)', async () => {
  const prompts = [...(await promptsDesDeuxRuns()).values()]
  assert.ok(fonctionsDePrompt.length >= 7, `amorces mal dérivées du source : ${fonctionsDePrompt.length}`)
  const muettes = fonctionsDePrompt.filter((f) => !prompts.some((p) => p.includes(f.amorce)))
  assert.deepEqual(muettes.map((f) => f.nom), [], 'fonctions de prompt jamais atteintes : la garde ne les juge pas')
})

test('workflow Atlas : aucune IDENTITÉ du registre RÉEL ne part dans un prompt', async () => {
  const prompts = await promptsDesDeuxRuns()
  const fuites = []
  for (const [cle, prompt] of prompts) {
    for (const identite of identitesReelles()) {
      const m = prompt.match(borde(identite))
      if (m) fuites.push(`${cle} : « ${identite} » dans « …${prompt.slice(Math.max(0, m.index - 30), m.index + identite.length + 30)}… »`)
    }
  }
  assert.deepEqual(fuites, [], `identités du registre réel écrites en dur dans un prompt :\n${fuites.join('\n')}`)
})

/**
 * Les noms de DOMAINE qu'un prompt ÉMET, lus à leur FORME d'émission : la carte du cœur (le bloc de
 * lignes `- <cle> : <titre>` que sa phrase d'introduction porte) et l'id du domaine du run. On ne
 * CHERCHE aucune clé réelle dans le texte — une `cle` est un mot commun (« combat », « magie »,
 * « tests »), et un tel détecteur rougirait sur du français. C'est l'ENSEMBLE émis qu'on confronte.
 */
function nomsDeDomaineEmis(prompts) {
  const noms = new Set()
  for (const prompt of prompts.values()) {
    // `(id …)` est ANCRÉ à l'en-tête du cadrage : la même forme sert aussi aux id de TOPIC, qui
    // viennent du rendu d'agent, pas des `args`.
    const cadrage = /^CADRAGE du domaine "([^"]+)" \(id ([^)]+)\)/m.exec(prompt)
    if (cadrage) { noms.add(cadrage[1]); noms.add(cadrage[2]) }
    for (const m of prompt.matchAll(/le TIEN est "([^"]+)"/g)) noms.add(m[1])
    const carte = /^.*domaines de l Atlas.*$\n((?:- .+\n?)+)/m.exec(prompt)
    for (const ligne of carte ? carte[1].trim().split('\n') : []) {
      const vu = /^- (\S+) : (.+)$/.exec(ligne)
      if (vu) { noms.add(vu[1]); noms.add(vu[2]) }
    }
  }
  return noms
}

test('workflow Atlas : tout nom de DOMAINE émis dans un prompt vient des `args` de la fixture', async () => {
  const attendus = PERIMETRE().domaines.flatMap((d) => [d.cle, d.titre]).sort()
  assert.deepEqual(
    [...nomsDeDomaineEmis(await promptsDesDeuxRuns())].sort(),
    attendus,
    'la carte des domaines émise doit être EXACTEMENT celle des `args` — un nom de plus est une ' +
      'identité écrite en dur, un nom de moins une carte devenue muette (que rien ne jugerait)',
  )
})

test('workflow Atlas : aucun CARDINAL de livres ou de chapitres dans un prompt', async () => {
  const prompts = await promptsDesDeuxRuns()
  const fuites = []
  for (const [cle, prompt] of prompts)
    for (const v of scanForbiddenCounts(prompt)) fuites.push(`${cle}:${v.line} « ${v.excerpt} » — ${v.reason}`)
  assert.deepEqual(fuites, [], `cardinaux écrits en dur dans un prompt :\n${fuites.join('\n')}`)
})

test('workflow Atlas : le livre de RÉFÉRENCE est le livre de cœur du périmètre reçu', async () => {
  const prompts = await promptsDesDeuxRuns()
  const cadrage = prompts.get(`Cadrage:${LOT[0]}:cadrage`)
  assert.ok(cadrage, `prompt de cadrage absent — labels : ${[...prompts.keys()].join(' · ')}`)
  assert.match(cadrage, /Source\/Fixture - Base Alpha\/00 - Index\.md/)
  assert.match(cadrage, /livre de REFERENCE du perimetre, BKA/)
  assert.match(cadrage, /coeur de regles « alpha »/)
  // Le livre de l'AUTRE cœur n'est pas du périmètre : il n'est cité nulle part.
  assert.equal([...prompts.values()].some((p) => /\bBKB\b/.test(p)), false)
})

test('workflow Atlas : la consigne de CITATION suit la langue du livre cité', async () => {
  const prompts = await promptsDesDeuxRuns()
  assert.match(prompts.get(`Survey:${LOT[0]}:survey:BKA`), /Livre : BKA \(langue : Langue-A\)/)
  assert.match(prompts.get(`Survey:${LOT[0]}:survey:SPG`), /Livre : SPG \(langue : Langue-B\)/)
  // La clause de CITATION va à TOUTE phase qui touche au texte du livre : la carto INVENTORIE des
  // intitulés et des tables, l'audit JUGE des tables transcrites, la synthèse et l'augmentation les
  // ÉCRIVENT. Une phase muette sur la langue rendrait un inventaire ou un verdict TRADUIT.
  const citation = [
    `Cartographie:${LOT[0]}:carto:BKA-05`, `Audit:${LOT[0]}:audit#1`,
    `Synthese:${LOT[0]}:synth:topic-un`, `Correction:${LOT[0]}:augment:topic-un`,
  ]
  for (const cle of citation) {
    const p = prompts.get(cle)
    assert.ok(p, `prompt ${cle} absent — labels : ${[...prompts.keys()].join(' · ')}`)
    assert.match(p, /LANGUE DES CITATIONS : .*reste VERBATIM dans la langue de CE livre \(Langue-A, Langue-B selon le livre/)
  }
  // La clause de FICHE ne vaut que là où une SYNTHÈSE s'écrit.
  for (const cle of [`Synthese:${LOT[0]}:synth:topic-un`, `Correction:${LOT[0]}:augment:topic-un`]) {
    assert.match(prompts.get(cle), /LANGUE DE LA FICHE : la SYNTHESE que tu rediges est en FRANCAIS/)
  }
})

test('workflow Atlas : le survey parcourt EXACTEMENT les livres du périmètre reçu, et le rendu PORTE son cœur', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(rendu.domains[0].surveyCounts.map((c) => c.book), ['BKA', 'SPG'])
  assert.equal(rendu.coeur, 'alpha')
  assert.equal(rendu.supplements, true)
})

// UN DOMAINE SAUTÉ EST DIT PAR LE RENDU : un `log` ne se relit pas, et l'assemblage du reste du lot
// doit pouvoir nommer le manquant.
test('workflow Atlas : un domaine SAUTÉ sort dans `sautes`, avec sa RAISON, pour chaque cause', async () => {
  const causes = [
    ['Cadrage', { coverageRefs: [] }, /cadrage VIDE/],
    ['Cartographie', { items: [] }, /inventaire VIDE/],
    ['Taxonomie', { topics: [] }, /taxonomie VIDE/],
  ]
  for (const [phaseMuette, rendu, motif] of causes) {
    const { rendu: r } = await jouerWorkflow(SCRIPT, PERIMETRE(), (p, o) =>
      (o.phase === phaseMuette ? rendu : repondreAvec(false)(p, o)))
    assert.deepEqual(r.domains, [], `le domaine n'aurait pas dû être traité (${phaseMuette})`)
    assert.equal(r.sautes.length, 1, JSON.stringify(r.sautes))
    assert.equal(r.sautes[0].domain, LOT[0])
    assert.match(r.sautes[0].raison, motif)
  }
  // Un run NOMINAL ne saute rien : la clé existe, et elle est vide.
  const { rendu: sain } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(sain.sautes, [])
})

// La consigne de TRANSCRIPTION ne va qu'aux phases qui ÉCRIVENT une table. La carto INVENTORIE :
// lui demander de transcrire n'avait pas d'objet (elle ne rend que des `item`/`ref`/`gist`).
test('workflow Atlas : la consigne de TRANSCRIPTION ne va qu’aux phases qui écrivent une table', async () => {
  const prompts = await promptsDesDeuxRuns()
  const TRANSCRIT = /TRANSCRIPTION DES TABLES : une table se transcrit ligne par ligne/
  for (const cle of [`Audit:${LOT[0]}:audit#1`, `Synthese:${LOT[0]}:synth:topic-un`, `Correction:${LOT[0]}:augment:topic-un`]) {
    assert.match(prompts.get(cle), TRANSCRIT)
  }
  const carto = prompts.get(`Cartographie:${LOT[0]}:carto:BKA-05`)
  assert.equal(TRANSCRIT.test(carto), false, 'la cartographie ne transcrit aucune table')
  assert.match(carto, /LANGUE DES CITATIONS/)
})

// ── GRAMMAIRE DES RÉFS (#1873) ────────────────────────────────────────────────────────────────────
// `<ABBR> <NN> l.<X>` désigne un FICHIER et sa LIGNE. Rien ne le DISAIT aux agents : dès qu'un livre
// dépasse la centaine de chapitres, `<NN>` a trois chiffres et se lit comme un numéro de PAGE — un
// agent de vérif est allé chercher « la page 24 » hors du dossier du livre, puis a rendu
// `faithful:false` sur une fiche dont il reconnaissait le texte exact au mot. Faux négatif de
// CLASSE : toute phase qui écrit ou lit une réf peut le commettre. La grammaire est donc dite UNE
// fois, émise AVEC le mapping, et ce banc exige qu'elle atteigne CHAQUE prompt qui touche une réf.
const GRAMMAIRE = /GRAMMAIRE DES REFS — « <ABBR> <NN> l\.<X> »/
/** Le MAPPING tel qu'un prompt l'émet (une ligne `- <ABBR> = <dossier> (langue : …)`). */
const MAPPING = /^- [A-Z]{2,5} = \S.*\(langue : /m
/** Une RÉF telle que les prompts l'émettent : sigle, préfixe de fichier (réel ou en gabarit), `l.`. */
const REF = /(?<![\p{L}\p{N}])[A-Z]{2,5} (?:\d+|<NN>) l\./u

test('workflow Atlas : tout prompt qui porte le MAPPING des livres porte la GRAMMAIRE des réfs', async () => {
  const prompts = await promptsDesDeuxRuns()
  const avecMapping = [...prompts].filter(([, p]) => MAPPING.test(p))
  // Non-vacuité : le cadrage, la synthèse, l'audit, l'AUGMENTATION (qui relit la source aux refs des
  // trous) et la vérif portent le mapping. Un de moins, et le contrat ne jugerait plus ce prompt-là.
  assert.ok(
    ['cadrage', 'synth:topic-un', 'audit#1', 'augment:topic-un', 'verif:topic-un']
      .every((suffixe) => avecMapping.some(([cle]) => cle.endsWith(suffixe))),
    `prompts porteurs du mapping : ${avecMapping.map(([cle]) => cle).join(' · ')}`,
  )
  assert.deepEqual(avecMapping.filter(([, p]) => !GRAMMAIRE.test(p)).map(([cle]) => cle), [])
})

test('workflow Atlas : tout prompt qui ÉMET ou LIT une réf porte la GRAMMAIRE des réfs', async () => {
  const prompts = await promptsDesDeuxRuns()
  const avecRef = [...prompts].filter(([, p]) => REF.test(p))
  // Non-vacuité : la carto et le survey ÉMETTENT les refs, la synthèse/l'audit/la vérif les LISENT.
  // L'augmentation les lit aussi, mais le prompt CAPTURÉ sous ce label est celui de la correction de
  // FIDÉLITÉ, dont les points n'ont pas de ref : c'est le contrat du MAPPING qui la juge.
  assert.ok(
    ['carto:BKA-05', 'survey:BKA', 'synth:topic-un', 'audit#1', 'verif:topic-un']
      .every((suffixe) => avecRef.some(([cle]) => cle.endsWith(suffixe))),
    `prompts porteurs de refs : ${avecRef.map(([cle]) => cle).join(' · ')}`,
  )
  assert.deepEqual(avecRef.filter(([, p]) => !GRAMMAIRE.test(p)).map(([cle]) => cle), [])
})

test('workflow Atlas : la grammaire dite au juge de FIDÉLITÉ désigne un FICHIER et une LIGNE, jamais une PAGE', async () => {
  const verif = (await promptsDesDeuxRuns()).get(`Verif:${LOT[0]}:verif:topic-un`)
  assert.ok(verif, 'prompt de vérif absent')
  assert.match(verif, GRAMMAIRE)
  assert.match(verif, /le FICHIER \.md dont le nom commence par « <NN> - »/)
  assert.match(verif, /a sa LIGNE <X>/)
  assert.match(verif, /<NN> est ce PREFIXE DE NOM DE FICHIER/)
  // L'exclusion est EXPLICITE : c'est elle qui a manqué, pas la définition.
  assert.match(verif, /ce n est JAMAIS un numero de PAGE, ni du livre imprime, ni d un PDF/)
  assert.match(verif, /ni PDF, ni sortie brute d extracteur/)
})

// ── LECTURE SEULE (#1873) ────────────────────────────────────────────────────────────────
// Un agent du run a EDITÉ un fichier de `Source/` pour compléter une phrase tronquée, puis la fiche a
// CITÉ la ligne réparée comme preuve : l'extraction fabriquait sa propre source. Deux verrous, l'un
// hors du prompt (le TYPE d'agent, dont les outils n'écrivent pas), l'autre dedans (la clause). Ce
// banc mesure les OPTIONS RÉELLEMENT ENVOYÉES par le script, pas son texte.

/** Les types d'agent du dépôt qui n'ont AUCUN outil d'écriture — lus à `.claude/agents/`, jamais
 *  écrits en dur : un agent dont on ajouterait `Edit` sortirait de cette liste sans que rien ne mente. */
/** Une liste d'outils d'agent n'écrit rien : aucun canal d'écriture (`OUTILS_ECRITURE`). */
const enLectureSeule = (outils) => !outils.some((o) => OUTILS_ECRITURE.includes(o))
const typesEnLectureSeule = () => {
  const dossier = fileURLToPath(new URL('../../.claude/agents/', import.meta.url))
  const types = []
  for (const f of listerDossier(dossier).filter((n) => n.endsWith('.md'))) {
    const tete = readFileSync(join(dossier, f), 'utf8').split(/^---\s*$/m)[1] || ''
    const nom = /^name:\s*(\S+)/m.exec(tete)
    const outils = /^tools:\s*(.+)$/m.exec(tete)
    // Pas de `tools:` = l'agent hérite de TOUS les outils, écriture comprise : jamais lecture seule.
    if (!nom || !outils) continue
    const liste = outils[1].split(',').map((s) => s.trim())
    if (enLectureSeule(liste)) types.push(nom[1])
  }
  return types
}

test('workflow Atlas : un agent muni du SEUL `ctx_patch` (canal d’édition prescrit) n’est pas en lecture seule', () => {
  assert.equal(enLectureSeule(['mcp__lean-ctx__ctx_read', 'mcp__lean-ctx__ctx_patch']), false)
  assert.equal(enLectureSeule(['mcp__lean-ctx__ctx_read', 'Bash']), true)
})

test('workflow Atlas : les types d’agent en lecture seule se lisent au dépôt (sinon le contrat est vide)', () => {
  const types = typesEnLectureSeule()
  assert.ok(types.includes('lecteur') && types.includes('juge'), `types en lecture seule lus : ${types.join(', ')}`)
})

test('workflow Atlas : AUCUN agent ne part sans `agentType` en LECTURE SEULE, ni sans `model` écrit', async () => {
  const options = await optionsDesDeuxRuns()
  const lectureSeule = typesEnLectureSeule()
  assert.ok(options.size >= 7, `trop peu d'agents capturés : ${[...options.keys()].join(' · ')}`)
  const fautifs = [...options].filter(([, o]) => !lectureSeule.includes(o.agentType))
  assert.deepEqual(fautifs.map(([cle, o]) => `${cle} : agentType=${JSON.stringify(o.agentType)}`), [])
  // Le `model` reste ÉCRIT à chaque site : rien ne prouve que le modèle du script prime sur celui du
  // frontmatter de l'agent, et un étage muet retomberait sur le modèle de session.
  const sansModele = [...options].filter(([, o]) => typeof o.model !== 'string' || !o.model)
  assert.deepEqual(sansModele.map(([cle]) => cle), [])
})

test('workflow Atlas : le type suit ce que la phase FAIT — `juge` là où l’on refute, `lecteur` ailleurs', async () => {
  const options = await optionsDesDeuxRuns()
  const parType = { juge: [], lecteur: [] }
  for (const [cle, o] of options) (parType[o.agentType] ||= []).push(cle)
  // AUDIT de complétude et VÉRIF de fidélité confrontent une entrée à la source et REFUTENT ;
  // l'augmentation, elle, RÉDIGE — elle reste un lecteur, dans sa phase `Correction`.
  assert.deepEqual(parType.juge.sort(), [`Audit:${LOT[0]}:audit#1`, `Audit:${LOT[0]}:audit#2`, `Verif:${LOT[0]}:reverif:topic-un`, `Verif:${LOT[0]}:verif:topic-un`].sort())
  assert.ok(parType.lecteur.includes(`Correction:${LOT[0]}:augment:topic-un`), parType.lecteur.join(' · '))
})

test('workflow Atlas : TOUT prompt porte la clause de LECTURE SEULE, avec le refus de RÉPARER la source', async () => {
  const prompts = await promptsDesDeuxRuns()
  const muets = [...prompts].filter(([, p]) => !/LECTURE SEULE — tu n ECRIS, ne modifies, ne crees et ne supprimes AUCUN fichier/.test(p))
  assert.deepEqual(muets.map(([cle]) => cle), [])
  for (const [, p] of prompts) {
    assert.match(p, /ne se REPARE JAMAIS : tu le SIGNALES dans le champ `sourceAbimee`/)
    assert.match(p, /cites la regle TELLE QUE le fichier la porte, troncature comprise/)
  }
})

test('workflow Atlas : un signalement de source ABÎMÉE remonte au rendu du domaine', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, PERIMETRE(), (p, o) => {
    const base = repondreAvec(false)(p, o)
    return o.phase === 'Synthese'
      ? { ...base, sourceAbimee: [{ ref: 'BKA 05 l.7', constat: 'phrase tronquee en fin de fichier' }] }
      : base
  })
  assert.deepEqual(rendu.domains[0].sourceAbimee, [{ phase: 'Synthese', ref: 'BKA 05 l.7', constat: 'phrase tronquee en fin de fichier' }])
  // Un run sans signalement rend la clé, vide : l'orchestrateur lit une mesure, pas une absence.
  const { rendu: sain } = await jouerWorkflow(SCRIPT, PERIMETRE(), repondreAvec(false))
  assert.deepEqual(sain.domains[0].sourceAbimee, [])
})

test('workflow Atlas : une REPRISE ne PERD pas les signalements déjà rendus, et ajoute les siens', async () => {
  const { rendu } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), (p, o) => {
    assert.equal(o.phase, 'Verif')
    return { faithful: true, issues: [], sourceAbimee: [{ ref: 'BKA 05 l.8', constat: 'table fusionnee' }] }
  })
  assert.deepEqual(rendu.domains[0].sourceAbimee, [
    { phase: 'Synthese', ref: 'BKA 05 l.7', constat: 'phrase tronquee en fin de fichier' },
    { phase: 'Verif', ref: 'BKA 05 l.8', constat: 'table fusionnee' },
  ])
})

// ── REPRISE ───────────────────────────────────────────────────────────────────────────────────────
// Un run coûte des dizaines d'agents : il ne se jette pas parce qu'un agent de vérification est
// resté muet. Le rendu entre, seuls les topics SANS preuve de fidélité repassent, le rendu sort.
const RENDU_A_REPRENDRE = () => ({
  domain: LOT[0],
  title: 'Premier Domaine de Fixture',
  topics: [
    { topicId: 'deja-prouve', title: 'Deja Prouve', markdown: '## Deja Prouve\n\nUn corps.', refs: ['BKA 05 l.1'], codeHint: '', faithful: true, issues: [] },
    { topicId: 'jamais-juge', title: 'Jamais Juge', markdown: '## Jamais Juge\n\nUn corps.', refs: ['BKA 05 l.2'], codeHint: '', faithful: null, issues: [] },
  ],
  autre: [{ topicId: 'autre', ref: 'BKA 05 l.9', gist: 'un gist', book: 'BKA' }],
  inventoryCount: 4,
  auditLoops: 1,
  lastAuditDry: true,
  surveyCounts: [{ book: 'BKA', hits: 2 }, { book: 'SPG', hits: 0 }],
  sourceAbimee: [{ phase: 'Synthese', ref: 'BKA 05 l.7', constat: 'phrase tronquee en fin de fichier' }],
})
const ARGS_DE_REPRISE = (rendu = RENDU_A_REPRENDRE()) => ({ ...PERIMETRE(), reprise: rendu })
/** Les phases de DÉCOUVERTE : aucune ne doit être atteinte par une reprise. */
const DECOUVERTE = ['Cadrage', 'Cartographie', 'Taxonomie', 'Survey', 'Synthese']

test('workflow Atlas : une REPRISE ne lance AUCUN agent de découverte, et ne rejoue pas un topic PROUVÉ', async () => {
  const { rendu, promptsParLabel } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), (p, o) => {
    assert.equal(o.phase, 'Verif', `phase inattendue en reprise : ${o.phase}`)
    return { faithful: true, issues: [] }
  })
  const labels = [...promptsParLabel.keys()]
  assert.deepEqual(labels.filter((l) => DECOUVERTE.some((ph) => l.startsWith(`${ph}:`))), [])
  assert.deepEqual(labels.filter((l) => /:audit#/.test(l)), [])
  // Un seul agent : le topic sans verdict. Le topic prouvé fidèle n'est PAS rejoué.
  assert.deepEqual(labels, [`Verif:${LOT[0]}:verif:jamais-juge`])
  // Le rendu COMPLÉTÉ porte les MÊMES clés, et ce que le run avait mesuré est intact.
  const d = rendu.domains[0]
  assert.deepEqual(Object.keys(d).sort(), Object.keys(RENDU_A_REPRENDRE()).sort())
  assert.equal(d.inventoryCount, 4)
  assert.deepEqual(d.surveyCounts, RENDU_A_REPRENDRE().surveyCounts)
  assert.deepEqual(d.topics.map((t) => [t.topicId, t.faithful]), [['deja-prouve', true], ['jamais-juge', true]])
  assert.equal(rendu.coeur, 'alpha')
})

test('workflow Atlas : en REPRISE, une fidélité REFUSÉE ouvre la correction puis la re-vérif', async () => {
  let verifs = 0
  const { rendu, promptsParLabel } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(), (prompt, o) => {
    if (o.phase === 'Correction') return { fiche: { title: 'Jamais Juge', markdown: '## Jamais Juge\n\nCorrige.', refs: ['BKA 05 l.2'], codeHint: '' } }
    verifs += 1
    return { faithful: verifs > 1, issues: verifs > 1 ? [] : ['une valeur fausse'] }
  })
  const labels = [...promptsParLabel.keys()]
  assert.ok(labels.includes(`Correction:${LOT[0]}:augment:jamais-juge`), `augmentation absente — ${labels.join(' · ')}`)
  assert.ok(labels.includes(`Verif:${LOT[0]}:reverif:jamais-juge`))
  const t = rendu.domains[0].topics.find((x) => x.topicId === 'jamais-juge')
  assert.equal(t.faithful, true)
  assert.match(t.markdown, /Corrige\./)
})

// Le verdict se keye sur l'ENTRÉE JUGÉE : la réponse d'un vérificateur ne porte aucun id, et chaque
// verdict revient au topic dont le prompt a été envoyé, quel que soit l'ordre des rendus.
test('workflow Atlas : chaque verdict de vérif revient au topic JUGÉ, jamais à un voisin', async () => {
  const aReprendre = RENDU_A_REPRENDRE()
  aReprendre.topics.push({ topicId: 'autre-jamais-juge', title: 'Autre Jamais Juge', markdown: '## Autre Jamais Juge\n\nUn corps.', refs: ['BKA 05 l.4'], codeHint: '', faithful: null, issues: [] })
  const { rendu, promptsParLabel } = await jouerWorkflow(SCRIPT, ARGS_DE_REPRISE(aReprendre), (prompt) =>
    (prompt.includes('TITRE : Autre Jamais Juge') ? { faithful: false, issues: [] } : { faithful: true, issues: [] }))
  assert.deepEqual([...promptsParLabel.keys()], [`Verif:${LOT[0]}:verif:jamais-juge`, `Verif:${LOT[0]}:verif:autre-jamais-juge`])
  assert.deepEqual(rendu.domains[0].topics.map((t) => [t.topicId, t.faithful]), [['deja-prouve', true], ['jamais-juge', true], ['autre-jamais-juge', false]])
})

// UNE RE-VÉRIF MUETTE NE DÉTRUIT PLUS UN VERDICT. Un topic entré `faithful:false` avec ses `issues`
// en ressortait `faithful:null` sans issue dès que l'agent ne rendait rien : le verdict établi était
// effacé, et plus rien ne disait comment corriger. Ce que personne n'a jugé reste `null` ; ce qu'un
// juge a refusé reste refusé, avec ses points.
test('workflow Atlas : en REPRISE, un agent MUET laisse le verdict antérieur INTACT', async () => {
  const rendu = RENDU_A_REPRENDRE()
  rendu.topics.push({ topicId: 'juge-refuse', title: 'Juge Refuse', markdown: '## Juge Refuse\n\nUn corps.', refs: ['BKA 05 l.3'], codeHint: '', faithful: false, issues: ['une valeur fausse'] })
  const { rendu: sorti } = await jouerWorkflow(SCRIPT, { ...PERIMETRE(), reprise: rendu }, () => { throw new Error('agent mort') })
  const topics = sorti.domains[0].topics
  const refuse = topics.find((t) => t.topicId === 'juge-refuse')
  assert.equal(refuse.faithful, false, 'le refus antérieur a été effacé par une re-vérif muette')
  assert.deepEqual(refuse.issues, ['une valeur fausse'])
  assert.match(refuse.markdown, /Un corps\./)
  // Le topic JAMAIS jugé reste sans verdict : on n'en invente pas un.
  assert.equal(topics.find((t) => t.topicId === 'jamais-juge').faithful, null)
  assert.equal(topics.find((t) => t.topicId === 'deja-prouve').faithful, true)
})

test('workflow Atlas : un `args.reprise` mal formé LÈVE en nommant la cause', async () => {
  const cas = [
    [{ ...PERIMETRE(), reprise: [] }, /`args\.reprise` non-objet/],
    [{ ...PERIMETRE(), reprise: { topics: [{}] } }, /`args\.reprise\.domain` absent ou non textuel/],
    [{ ...PERIMETRE(), reprise: { domain: LOT[0] } }, /`args\.reprise\.topics` absent ou vide/],
    [{ ...PERIMETRE(), lot: ['domaine-deux'], reprise: RENDU_A_REPRENDRE() }, /une reprise ne joue QUE le domaine de son rendu/],
  ]
  for (const [argsDuRun, motif] of cas) {
    await assert.rejects(() => jouerWorkflow(SCRIPT, argsDuRun, repondreAvec(false)), motif, JSON.stringify(argsDuRun.reprise))
  }
})

// BOUT EN BOUT — c'est le chemin qu'on emprunte quand un agent de vérification est resté muet :
// run → fichier → `--reprise` → workflow → fichier → `assemble`. Chaque maillon était testé seul ;
// aucun ne prouvait que le rendu de l'un ENTRE dans le suivant sans retaille à la main.
test('reprise de BOUT EN BOUT : rendu du run → lireRendu → workflow → assemble (Atlas jetable)', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'atlas-bout-en-bout-'))
  try {
    // 1. Un run dont la vérification reste MUETTE : les topics sortent sans preuve de fidélité.
    const { rendu: duRun } = await jouerWorkflow(SCRIPT, PERIMETRE(), (p, o) => {
      if (o.phase === 'Verif') return null
      return repondreAvec(false)(p, o)
    })
    assert.deepEqual(duRun.domains[0].topics.map((t) => t.faithful), [null])
    const cheminDuRun = join(dossier, 'run.json')
    writeFileSync(cheminDuRun, JSON.stringify(duRun), 'utf8')
    // `assemble` refuse ce rendu-là : c'est bien lui qu'il faut reprendre.
    assert.throws(() => assemble(duRun.domains[0], { racine: duRun, source: cheminDuRun, rawDir: dossier }), /JAMAIS verifie/)

    // 2. La REPRISE : le rendu du RUN entre tel quel, le domaine est celui que `--domaines` nomme.
    const reprise = lireRendu(cheminDuRun, LOT[0])
    const argsDeReprise = perimetreDeCoeur('alpha', {
      supplements: true, lot: LOT, registre: REGISTRE_FIXTURE, registreDomaines: DOMAINES_FIXTURE, reprise,
    })
    const { rendu: apres, promptsParLabel } = await jouerWorkflow(SCRIPT, argsDeReprise, (p, o) => {
      assert.equal(o.phase, 'Verif', `phase de découverte rejouée en reprise : ${o.phase}`)
      return { faithful: true, issues: [] }
    })
    assert.deepEqual([...promptsParLabel.keys()], [`Verif:${LOT[0]}:verif:topic-un`])
    assert.deepEqual(apres.domains[0].topics.map((t) => t.faithful), [true])

    // 3. L'ASSEMBLAGE du rendu complété, dans un Atlas JETABLE.
    const cheminApres = join(dossier, 'apres.json')
    writeFileSync(cheminApres, JSON.stringify(apres), 'utf8')
    const relu = JSON.parse(readFileSync(cheminApres, 'utf8'))
    const r = assemble(relu.domains[0], { racine: relu, source: cheminApres, rawDir: join(dossier, 'atlas') })
    assert.equal(existsSync(r.path), true, r.path)
    assert.match(readFileSync(r.path, 'utf8'), /## Topic Un/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('workflow Atlas : un `args` absent ou mal formé LÈVE en nommant la cause', async () => {
  const { livres, domaines } = PERIMETRE()
  const cas = [
    [undefined, /`args` absent ou non-objet/],
    [{ livres }, /`args\.coeur` absent ou non textuel/],
    [{ coeur: 'alpha' }, /`args\.livres` absent ou vide/],
    [{ coeur: 'alpha', livres: [{ ab: 'BKA', dir: 'Source/Fixture - Base Alpha' }] }, /sans `language`/],
    [{ coeur: 'alpha', livres: livres.filter((l) => !l.coeur) }, /aucun livre de coeur « alpha »/],
    [{ coeur: 'alpha', livres }, /`args\.domaines` absent ou vide/],
    [{ coeur: 'alpha', livres, domaines: [{ cle: 'domaine-un' }] }, /`args\.domaines` sans `titre`/],
    [{ coeur: 'alpha', livres, domaines }, /`args\.lot` absent ou vide/],
    [{ coeur: 'alpha', livres, domaines, lot: ['domaine-jamais-declare'] }, /« domaine-jamais-declare » du lot inconnu/],
  ]
  for (const [argsDuRun, motif] of cas) {
    await assert.rejects(() => jouerWorkflow(SCRIPT, argsDuRun, repondreAvec(false)), motif, `args = ${JSON.stringify(argsDuRun)}`)
  }
})
