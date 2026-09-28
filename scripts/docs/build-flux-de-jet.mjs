/**
 * Génère docs/ajouter-un-flux-de-jet.md — la recette d'ajout d'un flux de jet différé
 * (« une situation = une modale »).
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - le CYCLE : les membres de `RollVerb` (`src/state/flowVerbs.ts`) ;
 *  - le REGISTRE : chaque entrée de `FLOW_VERBS` (kind, verbes, porteur du jet ou `pidIsActor`/
 *    `coop`, actions de résolution), confrontée à `FLOWS` (`src/state/rollFlowSpecs.ts`) et au
 *    registre des modales (`src/state/modalArbiter.ts`) ;
 *  - les FABRIQUES et LENTILLES partagées à réutiliser, avec leur site réel ;
 *  - les ATOMES obligatoires, lus dans la garde anti-dérive elle-même ;
 *  - les GARDES : chemin ancré + intitulé de leur `describe(...)`.
 * La part ÉDITORIALE (étapes de la recette, interdits) vit ICI, en dur.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-flux-de-jet.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import { loadSource, firstSentence, jsdocBody } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const OUTIL = 'build-flux-de-jet'
const VERBS = 'src/state/flowVerbs.ts'
const SPECS = 'src/state/rollFlowSpecs.ts'
const FACTORY = 'src/state/rollFlowFactory.ts'
const ARBITER = 'src/state/modalArbiter.ts'
const DRIFT = 'src/state/rollflow-no-drift.test.ts'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}
const ancre = (p, quoi) => {
  if (!existsSync(p)) abandon(`${quoi} : \`${p}\` introuvable (renommé/supprimé ?)`)
  return p
}
const plat = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')
for (const p of [VERBS, SPECS, FACTORY, ARBITER, DRIFT]) ancre(p, 'source du générateur')

const ligne = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1

const { text: V_SRC, sf: V_SF } = loadSource(VERBS)
const { text: S_SRC, sf: S_SF } = loadSource(SPECS)
const { text: F_SRC, sf: F_SF } = loadSource(FACTORY)

// ── Le CYCLE : `RollVerb` + son JSDoc ────────────────────────────────────────────────────────────

const CYCLE = (() => {
  let alias
  V_SF.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'RollVerb') alias = n
  })
  if (!alias || !ts.isUnionTypeNode(alias.type)) abandon(`\`RollVerb\` n'est plus une union nommée dans ${VERBS}`)
  const doc = jsdocBody(V_SRC.slice(alias.getFullStart(), alias.getStart(V_SF)))
  return {
    verbes: alias.type.types.filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).map((t) => t.literal.text),
    note: doc ? plat(firstSentence(doc)) : null,
    l: ligne(V_SF, alias.name.getStart(V_SF)),
  }
})()
if (CYCLE.verbes.length < 5) abandon(`moins de 5 verbes lus dans \`RollVerb\` — le cycle a dérivé`)

// ── Le REGISTRE : `FLOW_VERBS`, entrée par entrée ────────────────────────────────────────────────

/** Objet littéral d'un `export const NOM = { … }` (avec ou sans `as const`/`satisfies`). */
function objetExporte(sf, nom, chemin) {
  let init
  sf.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== nom) continue
      let e = d.initializer
      while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression?.(e) || ts.isParenthesizedExpression(e))) e = e.expression
      init = e
    }
  })
  if (!init || !ts.isObjectLiteralExpression(init)) abandon(`\`${nom}\` n'est plus un objet littéral dans ${chemin}`)
  return init
}

const FLUX = objetExporte(V_SF, 'FLOW_VERBS', VERBS).properties.filter(ts.isPropertyAssignment).map((p) => {
  const src = p.initializer.getText(V_SF)
  const lire = (re) => src.match(re)?.[1] ?? null
  const liste = (cle) => {
    const m = src.match(new RegExp(`${cle}:\\s*\\[([^\\]]*)\\]`))
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
  }
  return {
    cle: p.name.getText(V_SF).replace(/^['"]|['"]$/g, ''),
    kind: lire(/kind:\s*'(\w+)'/),
    verbes: liste('verbs'),
    porteur: (() => {
      const pend = lire(/pending:\s*'(\w+)'/)
      const champ = lire(/field:\s*'(\w+)'/)
      return pend && champ ? `\`${pend}.${champ}\`` : null
    })(),
    pidIsActor: lire(/pidIsActor:\s*(\w+)/),
    coop: /coop:\s*true/.test(src),
    resolution: liste('resolution'),
    l: ligne(V_SF, p.getStart(V_SF)),
  }
})
if (FLUX.length < 10) abandon(`moins de 10 flux lus dans \`FLOW_VERBS\` (${VERBS}) — le registre a dérivé`)

const CLES_FLOWS = new Set(objetExporte(S_SF, 'FLOWS', SPECS).properties.filter((p) => p.name).map((p) => p.name.getText(S_SF).replace(/^['"]|['"]$/g, '')))
const CLES_HANDLERS = new Set(objetExporte(S_SF, 'FLOW_HANDLERS', SPECS).properties.filter((p) => p.name).map((p) => p.name.getText(S_SF).replace(/^['"]|['"]$/g, '')))
const manquants = FLUX.filter((f) => !CLES_HANDLERS.has(f.cle)).map((f) => f.cle)
if (manquants.length) abandon(`flux sans handler dans \`FLOW_HANDLERS\` : ${manquants.join(', ')} — la garde d'exhaustivité a-t-elle sauté ?`)

// ── Registre des MODALES : quelles clés y sont déclarées, et sous quelle politique de Cadence ─────

const { sf: A_SF } = loadSource(ARBITER)
const MODAL_KEYS = (() => {
  let arr
  A_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== 'MODAL_DEFS') continue
      let e = d.initializer
      while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression?.(e) || ts.isParenthesizedExpression(e))) e = e.expression
      if (e && ts.isArrayLiteralExpression(e)) arr = e
    }
  })
  if (!arr) abandon(`\`MODAL_DEFS\` n'est plus un tableau littéral dans ${ARBITER}`)
  const m = new Map()
  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue
    const src = el.getText(A_SF)
    const cle = src.match(/key:\s*'([^']+)'/)?.[1]
    if (!cle) continue
    m.set(cle, src.match(/mode:\s*'(\w+)'/)?.[1] ?? null)
  }
  if (!m.size) abandon(`aucune modale lisible dans \`MODAL_DEFS\` (${ARBITER})`)
  return m
})()

// ── Fabriques et LENTILLES partagées : leur site réel ─────────────────────────────────────────────

/** Déclaration nommée d'un fichier (exportée ou non) : site + 1re phrase de JSDoc. */
function site(chemin, text, sf, nom) {
  let noeud
  const visite = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === nom) noeud = n
    n.forEachChild(visite)
  }
  sf.forEachChild(visite)
  if (!noeud) return null
  const porteur = ts.isVariableDeclaration(noeud) ? noeud.parent.parent : noeud
  const doc = jsdocBody(text.slice(porteur.getFullStart(), porteur.getStart(sf)))
  return { nom, site: `${chemin}:${ligne(sf, noeud.name.getStart(sf))}`, role: doc ? plat(firstSentence(doc)) : null }
}

const PARTAGES = [
  ['makeRollFlow', FACTORY, F_SRC, F_SF],
  ['testOutcome', SPECS, S_SRC, S_SF],
  ['cleanRollOutcome', SPECS, S_SRC, S_SF],
  ['flatRollLens', SPECS, S_SRC, S_SF],
  ['resultRollLens', SPECS, S_SRC, S_SF],
  ['opposedBinaryFlow', SPECS, S_SRC, S_SF],
  ['rollFlowActions', SPECS, S_SRC, S_SF],
  ['rollFlowActionsMulti', SPECS, S_SRC, S_SF],
  ['buildRollFlowActions', SPECS, S_SRC, S_SF],
]
  .map(([nom, chemin, text, sf]) => site(chemin, text, sf, nom))
  .filter(Boolean)
if (PARTAGES.length < 5) abandon(`moins de 5 fabriques/lentilles partagées retrouvées — le socle du système de jet a changé de forme`)

// ── ATOMES obligatoires : lus DANS la garde anti-dérive, pas recopiés ─────────────────────────────

const ATOMES = (() => {
  const src = readFileSync(DRIFT, 'utf8')
  const m = src.match(/for \(const atom of \[([^\]]*)\]\)/)
  if (!m) abandon(`la liste d'atomes n'est plus lisible dans ${DRIFT} — l'ancrage de ce doc sur sa garde est rompu`)
  const noms = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  if (!noms.length) abandon(`liste d'atomes VIDE dans ${DRIFT}`)
  // Chaque atome doit exister dans le module de Tests du moteur — sinon le doc nommerait un fantôme.
  const MOTEUR = ancre('src/engine/tests.ts', 'module des Tests')
  const { text, sf } = loadSource(MOTEUR)
  return noms.map((nom) => site(MOTEUR, text, sf, nom) ?? abandon(`atome \`${nom}\` introuvable dans ${MOTEUR}`))
})()

// ── Gardes ───────────────────────────────────────────────────────────────────────────────────────

function intituleGarde(p) {
  const m = readFileSync(p, 'utf8').match(/describe\(\s*(['"`])([\s\S]*?)\1/)
  if (!m) abandon(`\`${p}\` n'expose plus de \`describe('…')\``)
  return plat(m[2])
}
const GARDES = [
  'src/state/rollFlowWiring.test.ts',
  DRIFT,
  'src/state/maneuver-defense-cascade.test.ts',
  'src/state/jet-owner-vs-spec.test.ts',
  'src/ui/active-modal.test.ts',
].map((p) => ancre(p, 'garde citée par le doc — corriger la liste plutôt que la laisser mentir'))
const GARDES_MESUREES = GARDES.map((p) => ({ p, quoi: intituleGarde(p) }))

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, l) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(l).join('\n')}`
const MONO = FLUX.filter((f) => f.kind === 'mono')
const MULTI = FLUX.filter((f) => f.kind === 'multi')
const SANS_MODALE = FLUX.filter((f) => !MODAL_KEYS.has(f.cle)).map((f) => f.cle)

const out = `# Ajouter un flux de jet (« une situation = une modale »)

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-flux-de-jet.mjs\` (\`npm run docs:flux-de-jet\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les ${CYCLE.verbes.length} membres de
\`RollVerb\` (\`${VERBS}:${CYCLE.l}\`), les ${FLUX.length} entrées de \`FLOW_VERBS\` avec leur ligne,
leur type, leurs verbes, leur porteur de jet et leurs actions de résolution, la confrontation au
registre des modales (\`${ARBITER}\`, ${MODAL_KEYS.size} clés déclarées), les ${PARTAGES.length}
fabriques/lentilles partagées et les ${ATOMES.length} atomes obligatoires (lus dans la garde
anti-dérive, jamais recopiés), et les ${GARDES_MESUREES.length} gardes avec l'intitulé de leur
\`describe(...)\`. **Angles morts** : ce doc dit COMMENT poser un flux, pas d'où partent les jets
existants (\`docs/registre-jets.md\`) ni comment chaque consommateur remplit la coquille
(\`docs/usages-jets.md\`) ; le CONTENU d'un résolveur métier (ce que \`xConfirm\` applique) n'est
dérivable d'aucun registre — c'est la règle du jeu ; les interdits et l'ordre des étapes sont de
l'ÉDITORIAL fixé dans le script.

Tout jet différé suit le MÊME cycle de vie et passe par la MÊME fabrique. **Aucun flux ne recode la
mécanique (RNG / Chance / Résilience / Résistance) dans son propre closure** — il ne déclare que sa
FORME.

## 0. Le cycle de vie

Les verbes du cycle sont l'union \`RollVerb\` (\`${VERBS}:${CYCLE.l}\`) :

${CYCLE.verbes.map((v) => `\`${v}\``).join(' · ')}

${CYCLE.note ? `> ${CYCLE.note}\n` : ''}
Source unique de la plomberie : \`makeRollFlow\` (\`${PARTAGES.find((p) => p.nom === 'makeRollFlow').site}\`).
Elle centralise gardes, dépense de points et re-rendu ; le flux ne fournit que sa forme.
**« Appliquer » (\`<flux>Confirm\`) reste écrit à la main** — ses effets sont la règle métier, pas de
la plomberie.

## 1. Le registre des flux — \`FLOW_VERBS\`

\`FLOW_VERBS\` (\`${VERBS}\`) est la **SOURCE UNIQUE** du câblage : elle porte, par flux, son type et
le sous-ensemble de verbes exposés. Le type \`RollFlowActionsMap\` en est DÉRIVÉ et \`GameState\`
l'étend — ajouter ou retirer un verbe ici est **bidirectionnel** : l'oublier ailleurs casse \`tsc\`.
\`FLOW_HANDLERS\` (\`${SPECS}\`) y associe le handler, avec exhaustivité garantie
(${CLES_FLOWS.size} entrées dans \`FLOWS\`, ${CLES_HANDLERS.size} dans \`FLOW_HANDLERS\`).

### Flux MONO (${MONO.length})

Un flux mono déclare son **porteur du jet** (\`jetOwner\`) : l'acteur dont les verbes DÉPENSENT les
ressources. C'est obligatoire — aucun repli silencieux sur le propriétaire de la fenêtre.

${table(MONO, ['Flux', 'Déclaré', 'Porteur du jet', 'Verbes', 'Modale (`auto`)'], (f) => `| \`${f.cle}\` | \`${VERBS}:${f.l}\` | ${f.porteur ?? '—'} | ${f.verbes.map((v) => `\`${v}\``).join(', ')} | ${MODAL_KEYS.has(f.cle) ? `\`${MODAL_KEYS.get(f.cle) ?? '?'}\`` : '—'} |`)}

### Flux MULTI (${MULTI.length})

Un flux multi déclare \`pidIsActor\` (à qui appartient le 1ᵉʳ argument des délégués), son ouverture
\`coop\` éventuelle, et ses actions de \`resolution\` (les actions manuscrites qui closent la fenêtre —
elles sont DÉRIVÉES dans la surface invité, jamais recopiées).

${table(MULTI, ['Flux', 'Déclaré', '`pidIsActor`', 'Coop', 'Résolution', 'Modale (`auto`)'], (f) => `| \`${f.cle}\` | \`${VERBS}:${f.l}\` | ${f.pidIsActor ?? '—'} | ${f.coop ? 'oui' : '—'} | ${f.resolution.length ? f.resolution.map((r) => `\`${r}\``).join(', ') : '—'} | ${MODAL_KEYS.has(f.cle) ? `\`${MODAL_KEYS.get(f.cle) ?? '?'}\`` : '—'} |`)}

${SANS_MODALE.length ? `Flux sans entrée propre dans \`MODAL_DEFS\` : ${SANS_MODALE.map((k) => `\`${k}\``).join(', ')} — normal quand le flux est une ÉTAPE d'une cascade (l'entrée de cascade porte déjà la fenêtre), fautif sinon.` : 'Tous les flux ont une entrée dans `MODAL_DEFS`.'}

## 2. La recette — 1 spec + 1 confirm

1. **Type du pending** : \`Pending<X> extends PendingBase\` (\`${PARTAGES.find((p) => p.nom === 'makeRollFlow').site.split(':')[0]}\` porte
   \`PendingBase\` et ses champs hérités). Déclarer le slot dans \`GameState\`.
2. **Entrée dans \`FLOWS\`** (\`${SPECS}\`) : \`makeRollFlow({ key, rolled, actor, resolve, outcome, … })\`.
   **Réutiliser les fabriques partagées** (§3) plutôt que réécrire les branches à la main.
3. **Entrée dans \`FLOW_VERBS\`** (\`${VERBS}\`) : type, verbes, et le porteur (\`jetOwner\`) ou
   \`pidIsActor\`/\`resolution\`. Puis l'entrée jumelle dans \`FLOW_HANDLERS\` — l'exhaustivité est
   forcée à la compilation.
4. **\`<flux>Confirm\` / \`<flux>Cancel\` écrits à la main** dans la tranche de store du domaine : lire le
   résultat, appliquer les effets métier (par \`GameOp\` si l'effet est un octroi / un soin / des
   dégâts), nuller le pending, et faire avancer la cascade hôte si le jet en est une étape — jamais
   une 2ᵉ fenêtre séparée.
5. **Ouvrir le pending** depuis le site d'origine ; si le jet est une étape de combat, l'ouvrir comme
   une étape de cascade, pas comme une fenêtre isolée.
6. **Registre des modales** (\`${ARBITER}\`) — SEULEMENT si le flux n'est pas une étape d'une cascade
   déjà déclarée. La politique de Cadence (\`auto\`) est REQUISE.

## 3. Fabriques et lentilles PARTAGÉES — à réutiliser avant d'écrire une branche

${table(PARTAGES, ['Primitive', 'Site', 'Rôle (JSDoc)'], (p) => `| \`${p.nom}\` | \`${p.site}\` | ${p.role ?? '—'} |`)}

Le résolveur d'un flux est **UN SEUL** \`resolve\` pour tous les cas : jet normal (RNG), réussite
forcée par défaut, dé CHOISI par le joueur, et DR imposé par la Résistance. Un flux qui n'expose pas
la capacité correspondante n'offre simplement pas l'influence — les branches sont alors inertes.

## 4. La modale = \`RollShell\` paramétrée

\`RollShell\` est LA coquille unique : contrôles en PROPS, métier en SLOTS. Écrire un hook
\`use<Jet>JetProps\` (\`src/ui/jetProps/\`) qui lit le store et rend les props ; la modale ne fait que
l'appeler. Quelles zones chaque consommateur remplit aujourd'hui : \`docs/usages-jets.md\` (généré).
**Ne jamais réécrire un bouton « Lancer »/« Relancer » à la main** dans une modale.

## 5. Les atomes OBLIGATOIRES

La garde anti-dérive (\`${DRIFT}\`) exige la présence de ces atomes dans le registre des flux — cette
liste est LUE dans la garde, jamais recopiée ici :

${table(ATOMES, ['Atome', 'Site', 'Rôle (JSDoc)'], (a) => `| \`${a.nom}\` | \`${a.site}\` | ${a.role ?? '—'} |`)}

## 6. Interdits

- **Aucun \`rollTest\` inline sur le chemin JOUEUR.** Un Test qui affecte un combattant piloté par un
  humain DOIT ouvrir un pending influençable — jamais résolu en silence dans un résolveur métier. Le
  choke-point est le PRÉDICAT DE CONTRÔLEUR, jamais le \`kind\` de l'entité.
- **Aucune 2ᵉ fenêtre de conséquences.** Un jet et sa conséquence immédiate (Coup Critique,
  Maladresse…) vivent dans LA MÊME modale, par la cascade — jamais une fenêtre « Résultat » qui
  s'ouvre après la fermeture de la modale de jet.
- **Aucune mécanique d'influence recodée localement** (dé forcé en dur, « +1 DR » qui force le
  succès, littéral de résultat recopié) : passer par les atomes du §5.

## Gardes

${table(GARDES_MESUREES, ['Garde', 'Ce qu’elle verrouille (son propre `describe`)'], (g) => `| \`${g.p}\` | ${g.quoi} |`)}

\`npm run typecheck\` après tout ajout : le type dérivé de \`FLOW_VERBS\` casse immédiatement si le
registre et les handlers divergent.
`

ecrireOuVerifier({
  out,
  path: 'docs/ajouter-un-flux-de-jet.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:flux-de-jet — docs/ajouter-un-flux-de-jet.md est PÉRIMÉ (diverge de src/state/flowVerbs.ts, rollFlowSpecs.ts, rollFlowFactory.ts, modalArbiter.ts, de la garde anti-dérive, ou du script).',
  rerunMsg: '  → relancer `npm run docs:flux-de-jet` et committer le résultat.',
  okMsg: 'docs:flux-de-jet — OK (docs/ajouter-un-flux-de-jet.md à jour)',
  writeMsg: `docs/ajouter-un-flux-de-jet.md — ${FLUX.length} flux (${MONO.length} mono, ${MULTI.length} multi), ${PARTAGES.length} primitives partagées, ${ATOMES.length} atomes, ${GARDES_MESUREES.length} gardes.`,
})
