/**
 * Génère docs/ajouter-une-mecanique.md — le choix du CANAL (passif continu / effet déclenché /
 * capacité irréductible) pour toute mécanique d'entité, et le dispatcher unique des déclenchés.
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - les trois canaux avec le SITE RÉEL de leur lecteur (`passiveMods`, `fireTriggers`,
 *    `hasCapability`) — le manuscrit figeait `trauma.ts:504` / `triggeredEffects.ts:379` /
 *    `dispatch.ts:178`, tous faux depuis longtemps ;
 *  - l'union `EffectTrigger` et les formes d'`EffectTargeting` (`src/engine/flowCore.ts`), plus les
 *    champs de `TriggeredEffect` ;
 *  - les KINDS de source réunis par `effectSourcesOf` — lus dans son corps, dans l'ordre du code ;
 *  - les interfaces de capacités (`src/data/index.ts`) et leur nombre de drapeaux ;
 *  - les documents PORTEURS de chaque canal, lus au def zod, avec leur population réelle ;
 *  - le site de l'annulation `suppressesCapabilities` (cherchée DANS le corps de `traitCapability`)
 *    et ses porteurs en donnée ;
 *  - les sites de l'Indice de qualité (type d'instance, dispatcher runtime, parseur d'authoring) ;
 *  - le site de `registerCombatHook`, la primitive d'enregistrement de la machinerie.
 * La part ÉDITORIALE (critère de décision, frontière donnée/machinerie, recettes) vit ICI.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-mecanique.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import ts from 'typescript'
import { loadSource, firstSentence, jsdocBody } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const OUTIL = 'build-mecanique'
const FLOWCORE = 'src/engine/flowCore.ts'
const TRIGGERS = 'src/state/triggeredEffects.ts'
const TRAUMA = 'src/engine/trauma.ts'
const CAPS = 'src/engine/capabilities.ts'
const INDEX = 'src/data/index.ts'
const DEFS = 'src/data/schemas/defs'
const DATA = 'src/data'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}
const ancre = (p, quoi) => {
  if (!existsSync(p)) abandon(`${quoi} : \`${p}\` introuvable (renommé/supprimé ?)`)
  return p
}
const plat = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')
for (const p of [FLOWCORE, TRIGGERS, TRAUMA, CAPS, INDEX, DEFS]) ancre(p, 'source du générateur')

const ligne = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1

/** Déclaration NOMMÉE d'un fichier : son site (`fichier:ligne`) et la 1re phrase de son JSDoc. */
function declaration(fichier, nom) {
  const { text, sf } = loadSource(fichier)
  let noeud
  const visite = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === nom) noeud = n
    n.forEachChild(visite)
  }
  sf.forEachChild(visite)
  if (!noeud) abandon(`\`${nom}\` introuvable dans \`${fichier}\` (renommé/déplacé ?)`)
  const porteur = ts.isVariableDeclaration(noeud) ? noeud.parent.parent : noeud
  const doc = jsdocBody(text.slice(porteur.getFullStart(), porteur.getStart(sf)))
  return { nom, fichier, l: ligne(sf, noeud.name.getStart(sf)), site: `${fichier}:${ligne(sf, noeud.name.getStart(sf))}`, role: doc ? plat(firstSentence(doc)) : null, noeud, sf, text }
}

// ── Les trois canaux : leur LECTEUR réel ─────────────────────────────────────────────────────────

const PASSIF = declaration(TRAUMA, 'passiveMods')
const DECLENCHE = declaration(TRIGGERS, 'fireTriggers')
const CAPACITE = declaration(CAPS, 'hasCapability')
const CAP_ITEM = declaration(CAPS, 'itemCapability')
const CAP_TRAIT = declaration('src/engine/traits/dispatch.ts', 'traitCapability')
const HOOKS = declaration('src/state/combatHooks.ts', 'registerCombatHook')

// ── ANNULATION d'une capacité par un AUTRE trait porté (`suppressesCapabilities`) ─────────────────
// Le site de lecture est cherché DANS le corps de `traitCapability` : si la clause disparaît, le
// générateur abandonne plutôt que d'affirmer une annulation qui n'existe plus.
const SUPPRESSION = (() => {
  const corps = CAP_TRAIT.noeud.body?.getText(CAP_TRAIT.sf)
  if (!corps) abandon(`\`${CAP_TRAIT.nom}\` sans corps dans ${CAP_TRAIT.fichier}`)
  const at = corps.indexOf('suppressesCapabilities')
  if (at < 0) abandon(`\`suppressesCapabilities\` n'est plus lu dans \`${CAP_TRAIT.nom}\` (${CAP_TRAIT.fichier})`)
  const json = ancre(`${DATA}/traits.json`, 'donnée porteuse de `suppressesCapabilities`')
  const data = JSON.parse(readFileSync(json, 'utf8'))
  const entrees = Array.isArray(data) ? data : (data?.entries ?? [])
  const porteurs = entrees.filter((e) => Array.isArray(e?.suppressesCapabilities) && e.suppressesCapabilities.length)
  if (!porteurs.length) abandon(`aucune entrée de \`${json}\` ne porte \`suppressesCapabilities\` — le canal n'est plus exercé`)
  return {
    site: `${CAP_TRAIT.fichier}:${ligne(CAP_TRAIT.sf, CAP_TRAIT.noeud.body.getStart(CAP_TRAIT.sf) + at)}`,
    json,
    n: porteurs.length,
    exemple: porteurs[0],
  }
})()

// ── INDICE numérique d'une qualité : porté par l'INSTANCE, pas par la capacité ────────────────────
const INDICE_RUNTIME = declaration('src/engine/qualities/dispatch.ts', 'resolveQualities')
const INDICE_AUTHORING = declaration('src/engine/qualities/normalize.ts', 'parseQuality')
const INDICE_TYPE = declaration('src/engine/types.ts', 'QualityInstance')
if (!INDICE_RUNTIME.noeud.body?.getText(INDICE_RUNTIME.sf).includes('indice: q.value'))
  abandon(`\`${INDICE_RUNTIME.nom}\` ne dérive plus l'Indice de \`QualityInstance.value\` (${INDICE_RUNTIME.fichier})`)
if (!INDICE_TYPE.noeud.members?.some((m) => m.name?.getText(INDICE_TYPE.sf) === 'value'))
  abandon(`\`QualityInstance\` n'a plus de champ \`value\` (${INDICE_TYPE.fichier})`)

// ── `EffectTrigger` / `EffectTargeting` / `TriggeredEffect` ──────────────────────────────────────

const { text: FC_SRC, sf: FC_SF } = loadSource(FLOWCORE)

function aliasUnion(nom) {
  let alias
  FC_SF.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === nom) alias = n
  })
  if (!alias || !ts.isUnionTypeNode(alias.type)) abandon(`\`${nom}\` n'est plus une union nommée dans ${FLOWCORE}`)
  return { alias, membres: alias.type.types }
}

const TRIGGER_U = aliasUnion('EffectTrigger')
const TRIGGERS_LIST = TRIGGER_U.membres.map((m) => {
  if (!ts.isLiteralTypeNode(m) || !ts.isStringLiteral(m.literal)) abandon(`membre non littéral dans \`EffectTrigger\``)
  const doc = jsdocBody(FC_SRC.slice(m.getFullStart(), m.getStart(FC_SF)))
  return { nom: m.literal.text, note: doc ? plat(firstSentence(doc)) : null }
})
if (TRIGGERS_LIST.length < 10) abandon(`moins de 10 déclencheurs lus dans \`EffectTrigger\` — l'union a dérivé`)
const LIGNE_TRIGGER = ligne(FC_SF, TRIGGER_U.alias.name.getStart(FC_SF))

const CIBLAGE_U = aliasUnion('EffectTargeting')
const CIBLAGES = CIBLAGE_U.membres.map((m) => plat(m.getText(FC_SF)))
const LIGNE_CIBLAGE = ligne(FC_SF, CIBLAGE_U.alias.name.getStart(FC_SF))

const EFFET = (() => {
  const d = declaration(FLOWCORE, 'TriggeredEffect')
  const champs = []
  let prevEnd = d.noeud.members.pos
  for (const m of d.noeud.members) {
    if (!ts.isPropertySignature(m)) continue
    const doc = jsdocBody(FC_SRC.slice(prevEnd, m.getStart(FC_SF)))
    champs.push({
      nom: m.name.getText(FC_SF) + (m.questionToken ? '?' : ''),
      type: m.type ? plat(m.type.getText(FC_SF)) : '—',
      role: doc ? plat(firstSentence(doc)) : null,
    })
    prevEnd = m.getEnd()
  }
  if (!champs.length) abandon(`\`TriggeredEffect\` sans propriété lisible dans ${FLOWCORE}`)
  return { ...d, champs }
})()

// ── Les KINDS réunis par `effectSourcesOf` — lus dans l'ORDRE du code ────────────────────────────

const SOURCES = (() => {
  const d = declaration(TRIGGERS, 'effectSourcesOf')
  const corps = d.noeud.body?.getText(d.sf)
  if (!corps) abandon(`\`effectSourcesOf\` sans corps dans ${TRIGGERS}`)
  const kinds = []
  for (const m of corps.matchAll(/\{\s*kind:\s*'([a-z]+)'/g)) if (!kinds.includes(m[1])) kinds.push(m[1])
  if (kinds.length < 4) abandon(`moins de 4 kinds de source lus dans \`effectSourcesOf\` (${TRIGGERS}) — l'énumérateur a changé de forme`)
  return { ...d, kinds }
})()

// ── Interfaces de CAPACITÉS : nombre de drapeaux, mesuré ─────────────────────────────────────────

const CAPACITES = ['TraitCapabilities', 'QualityCapabilities', 'ItemCapabilities', 'SymptomCapabilities']
  .filter((n) => new RegExp(`interface ${n}\\b`).test(readFileSync(INDEX, 'utf8')))
  .map((n) => {
    const d = declaration(INDEX, n)
    return { ...d, drapeaux: d.noeud.members.filter(ts.isPropertySignature).length }
  })
if (CAPACITES.length < 3) abandon(`moins de 3 interfaces de capacités dans ${INDEX} — le canal a changé de forme`)

// ── Documents PORTEURS, par canal — def zod + population réelle ──────────────────────────────────

const CANAUX = [
  // « contient passive », pas « finit par » : le canal peut être INDEXÉ (`passiveBySeverity`, une liste
  // par palier de sévérité — LDB 20 l.157/l.170).
  { cle: 'passive', libelle: '`passive`', test: (k) => /passive/i.test(k) },
  { cle: 'effects', libelle: '`effects`', test: (k) => k === 'effects' || k === 'onHitEffects' },
  { cle: 'capabilities', libelle: '`capabilities`', test: (k) => k === 'capabilities' },
]

const PORTEURS = (() => {
  const out = new Map(CANAUX.map((c) => [c.cle, []]))
  for (const f of listerDossier(DEFS).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const chemin = `${DEFS}/${f}`
    const { sf, text } = loadSource(chemin)
    const fichierJson = text.match(/export const file = '([^']+)'/)?.[1]
    if (!fichierJson) continue
    let appel
    const visite = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'document') appel = n
      n.forEachChild(visite)
    }
    sf.forEachChild(visite)
    if (!appel) continue
    let champs = appel.arguments[2]
    if (champs && ts.isIdentifier(champs)) {
      const nom = champs.text
      sf.forEachChild((n) => {
        if (!ts.isVariableStatement(n)) return
        for (const d of n.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === nom && d.initializer && ts.isObjectLiteralExpression(d.initializer)) champs = d.initializer
        }
      })
    }
    if (!champs || !ts.isObjectLiteralExpression(champs)) continue
    const cles = champs.properties.filter(ts.isPropertyAssignment).map((p) => p.name.getText(sf).replace(/^['"]|['"]$/g, ''))
    for (const c of CANAUX) {
      const miennes = cles.filter(c.test)
      if (miennes.length) out.get(c.cle).push({ def: chemin, json: `${DATA}/${fichierJson}`, cles: miennes })
    }
  }
  return out
})()

/** Entrées d'un dataset qui exercent RÉELLEMENT l'un des champs (tableau non vide, ou objet peuplé). */
function population(json, cles) {
  if (!existsSync(json)) return null
  const data = JSON.parse(readFileSync(json, 'utf8'))
  const entrees = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : []
  const exerce = (v) => (Array.isArray(v) ? v.length > 0 : v != null && typeof v === 'object' && Object.keys(v).length > 0)
  return { total: entrees.length, n: entrees.filter((e) => cles.some((k) => exerce(e?.[k]))).length }
}
const PORTEURS_MESURES = new Map(
  CANAUX.map((c) => [c.cle, PORTEURS.get(c.cle).map((p) => ({ ...p, pop: population(p.json, p.cles) })).filter((p) => p.pop)]),
)
for (const c of CANAUX) {
  if (!PORTEURS_MESURES.get(c.cle).length) abandon(`aucun document porteur mesuré pour le canal ${c.cle} — le scan des defs a dérivé`)
}

// ── Gardes ───────────────────────────────────────────────────────────────────────────────────────

function intituleGarde(p) {
  const m = readFileSync(p, 'utf8').match(/describe\(\s*(['"`])([\s\S]*?)\1/)
  if (!m) abandon(`\`${p}\` n'expose plus de \`describe('…')\``)
  return plat(m[2])
}
const GARDES = [
  'src/ui/compendium/no-json-fields.test.ts',
  'src/data/defs-migrated.test.ts',
  'src/data/data-wellformed.test.ts',
  'src/engine/trauma.test.ts',
  'src/state/triggered-effects.test.ts',
  'src/state/combat-hardcode-guard.test.ts',
].map((p) => ancre(p, 'garde citée par le doc — corriger la liste plutôt que la laisser mentir'))
const GARDES_MESUREES = GARDES.map((p) => ({ p, quoi: intituleGarde(p) }))

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, l) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(l).join('\n')}`
const tablePorteurs = (cle) =>
  table(PORTEURS_MESURES.get(cle), ['Document', 'Champ(s)', 'Def', 'Entrées porteuses'], (p) => `| \`${p.json}\` | ${p.cles.map((k) => `\`${k}\``).join(', ')} | \`${p.def}\` | ${p.pop.n} / ${p.pop.total} |`)

const out = `# Ajouter une mécanique à une entité (trait, talent, qualité, mutation, maladie, atout…)

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-mecanique.mjs\` (\`npm run docs:mecanique\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : le SITE réel du lecteur de
chaque canal (\`${PASSIF.site}\`, \`${DECLENCHE.site}\`, \`${CAPACITE.site}\`), les
${TRIGGERS_LIST.length} membres d'\`EffectTrigger\` et les ${CIBLAGES.length} formes d'\`EffectTargeting\`
(\`${FLOWCORE}\`), les ${EFFET.champs.length} champs de \`TriggeredEffect\`, les ${SOURCES.kinds.length} kinds
de source réunis par \`effectSourcesOf\`, les ${CAPACITES.length} interfaces de capacités et leur nombre de
drapeaux, les documents PORTEURS de chaque canal (def zod + population réelle du \`.json\`), le site
de l'annulation \`suppressesCapabilities\` avec ses porteurs, les trois sites de l'Indice de qualité,
et le site de \`${HOOKS.nom}\`.
**Angles morts** : le catalogue des \`GameOp\` et des \`Condition\` n'est pas repris ici — source
unique \`docs/vocabulaire-mecanique.md\` ; le détail du canal PASSIF (annulation, combinaison,
collecteur) vit dans \`docs/systeme-passifs.md\` ; le scan des defs ne voit qu'un champ déclaré au
PREMIER niveau du document (un champ niché dans un sous-objet lui échappe) ; le critère de décision,
la frontière donnée/machinerie et les recettes sont de l'ÉDITORIAL fixé dans le script.

Toute mécanique — trait de créature, talent, atout d'arme/armure, mutation, symptôme de maladie,
État — s'exprime dans **UN des 3 canaux** ci-dessous, jamais un type ad hoc.

## 0. Les 3 canaux

${table(
  [
    { c: '`passive: GameOp[]`', porte: 'modificateur CONTINU, sans déclencheur', lu: PASSIF },
    { c: '`effects: TriggeredEffect[]`', porte: 'effet sur ÉVÉNEMENT (à la touche, en fin de Round…)', lu: DECLENCHE },
    { c: '`capabilities`', porte: 'drapeau IRRÉDUCTIBLE que le moteur INTERROGE (aucune valeur numérique ni formule)', lu: CAPACITE },
  ],
  ['Canal', 'Ce qu’il porte', 'Lu par'],
  (r) => `| ${r.c} | ${r.porte} | \`${r.lu.nom}\` (\`${r.lu.site}\`) |`,
)}

Chaque champ est du **\`GameOp[]\`** ou du **\`TriggeredEffect[]\`** — jamais un type propre à
l'entité. Si un besoin ne rentre dans aucune op existante, on **étend le vocabulaire**, on n'invente
jamais un champ parallèle ni un chemin de code par nom d'entité. Le catalogue des ops et des
Conditions qui EXISTENT est \`docs/vocabulaire-mecanique.md\` : le lire AVANT de conclure à un manque.

## 1. Choisir le canal

> « Un designer pourrait-il vouloir une version DIFFÉRENTE de ça, attachée à un monstre / un objet /
> un sort / un État précis, éditable au Codex ? » — OUI → **donnée** (\`passive\`/\`effects\`/
> \`capabilities\`). NON, même règle universelle pour tous → **machinerie** (hooks de Round, qui ne
> nomment AUCUNE entité).

Une fois qu'on sait que c'est de la donnée :

- **un déclencheur nommé** (« à la touche », « en fin de Round », « quand elle tue ») → \`effects\` ;
- **continu, sans déclencheur** (bonus de Caractéristique, malus de Test, modif de Mouvement, PA) →
  \`passive\` ;
- **un drapeau que le moteur doit pouvoir INTERROGER**, sans valeur numérique, qui pilote une branche
  de résolution / d'IA / de build → \`capabilities\`.

« Difficile à exprimer » n'autorise **jamais** un repli en machinerie ni un champ ad hoc — c'est le
signal qu'il faut étendre le vocabulaire.

## 2. Canal \`passive\` — le continu

Le même vocabulaire d'ops que les sorts. Le collecteur UNIQUE est \`${PASSIF.nom}\`
(\`${PASSIF.site}\`) ; **ne jamais lire un champ typé d'origine** dans un consommateur — toujours
passer par ses helpers d'extraction. Détail complet (profils d'annulation, combinaison, branches du
collecteur) : \`docs/systeme-passifs.md\`.

Documents porteurs :

${tablePorteurs('passive')}

## 3. Canal \`effects\` — le déclenché

Un \`TriggeredEffect\` (\`${EFFET.site}\`) est un Flow d'ops appliqué à \`on\` quand \`trigger\` se
produit — le MÊME Flow que les sorts, jamais un handler en dur par nom d'entité.

${table(EFFET.champs, ['Champ', 'Type', 'Rôle (JSDoc)'], (c) => `| \`${c.nom}\` | \`${c.type}\` | ${c.role ?? '—'} |`)}

### Les ${TRIGGERS_LIST.length} déclencheurs (\`EffectTrigger\`, \`${FLOWCORE}:${LIGNE_TRIGGER}\`)

${TRIGGERS_LIST.map((t) => `\`${t.nom}\``).join(' · ')}

${TRIGGERS_LIST.filter((t) => t.note).length ? `${table(TRIGGERS_LIST.filter((t) => t.note), ['Déclencheur', 'Ce que le JSDoc en dit'], (t) => `| \`${t.nom}\` | ${t.note} |`)}\n` : ''}
### Les ${CIBLAGES.length} formes de ciblage (\`EffectTargeting\`, \`${FLOWCORE}:${LIGNE_CIBLAGE}\`)

${CIBLAGES.map((c) => `- \`${c}\``).join('\n')}

### Le dispatcher unique — \`${DECLENCHE.nom}\`

\`${DECLENCHE.nom}\` (\`${DECLENCHE.site}\`) est le **SEUL** point d'entrée pour jouer les effets
déclenchés d'un combattant. Il réunit ses sources via \`${SOURCES.nom}\` (\`${SOURCES.site}\`), qui
énumère aujourd'hui **${SOURCES.kinds.length} kinds** dans un ordre FIGÉ (déroulé RNG déterministe) :
${SOURCES.kinds.map((k) => `\`${k}\``).join(' → ')}.

**Ajouter une source de déclenché = l'ajouter dans \`${SOURCES.nom}\`**, jamais un chemin de dispatch
parallèle. C'est là, et nulle part ailleurs, que se lit la liste des porteurs reconnus.

Documents porteurs :

${tablePorteurs('effects')}

## 4. Canal \`capabilities\` — l'irréductible

Réservé aux drapeaux que le moteur **interroge** (résolution, IA, psychologie, build, artisanat),
SANS formule ni déclencheur : un booléen (ou un petit scalaire) qui pilote une branche de code, pas
un chiffre qui s'additionne.

${table(CAPACITES, ['Interface', 'Site', 'Drapeaux déclarés'], (c) => `| \`${c.nom}\` | \`${c.site}\` | ${c.drapeaux} |`)}

Lecture — un seul point d'entrée par portée, chaque canal restant disjoint par nom de capacité :

${table(
  [CAP_TRAIT, CAP_ITEM, CAPACITE],
  ['Lecteur', 'Site', 'Portée'],
  (c) => `| \`${c.nom}\` | \`${c.site}\` | ${c === CAP_TRAIT ? 'par trait' : c === CAP_ITEM ? 'par objet' : 'agrégat cross-source, par personnage'} |`,
)}

### Une capacité peut être ANNULÉE par un autre trait porté

\`suppressesCapabilities\` (lu par \`${CAP_TRAIT.nom}\`, \`${SUPPRESSION.site}\`) : un trait déclare
les capacités qu'il annule chez **les autres traits du même porteur** — la résolution rend \`false\`
même si un second trait la déclare. C'est de la DONNÉE, jamais un chemin de code par nom de trait :
${SUPPRESSION.n} entrée(s) de \`${SUPPRESSION.json}\` l'exercent, dont \`${SUPPRESSION.exemple.id}\`
(« ${plat(SUPPRESSION.exemple.label)} ») qui annule \`${SUPPRESSION.exemple.suppressesCapabilities.join('`, `')}\`.

### Une capacité est un marqueur de PRÉSENCE, jamais un nombre

Le drapeau dit qu'une mécanique s'applique ; sa VALEUR (Salve N, Protectrice N, Solide N…) vit sur
l'INSTANCE portée par l'objet — \`${INDICE_TYPE.nom}.value\` (\`${INDICE_TYPE.site}\`), que le
dispatcher runtime expose sous \`indice\` (\`${INDICE_RUNTIME.nom}\`, \`${INDICE_RUNTIME.site}\`).
La saisie en prose (« Solide 3 ») n'est convertie en instance qu'à l'AUTHORING, par
\`${INDICE_AUTHORING.nom}\` (\`${INDICE_AUTHORING.site}\`) — le runtime ne re-parse jamais un libellé
(convention \`indice:{label}\` côté champ d'édition). N'ajoute donc **jamais** un drapeau numéroté
(\`salve3\`) : la capacité marque la présence, l'Indice se lit sur l'instance.

Au Codex, \`capabilities\` n'a **pas** de widget dédié : il retombe dans le formulaire générique
inféré, qui projette l'objet en sous-champs (une case à cocher par booléen).

Documents porteurs :

${tablePorteurs('capabilities')}

## 5. Éditer — au Codex, jamais en dur

- \`passive\` → \`GameOpEditor\`, la primitive de liste d'ops EXISTANTE (celle des sorts) ;
- \`effects\` → le champ d'effets déclenchés, qui compose le même éditeur d'ops sous chaque feuille ;
- \`capabilities\` → formulaire générique inféré (§4) ;
- la sauvegarde réécrit le \`.json\` app-owned ; Vite recharge.

**Réutiliser, ne jamais réinventer** : toute liste d'ops passe par la primitive partagée (table des
primitives, \`CLAUDE.md\`). Ne pas dupliquer une op qui existe déjà sous un autre nom.

## 6. Frontière donnée / machinerie

- **Donnée** = tout ce qu'un designer voudrait pouvoir varier par entité, éditable au Codex →
  \`passive\` / \`effects\` / \`capabilities\`.
- **Machinerie** = les règles UNIVERSELLES de l'arène, qui ne nomment AUCUNE entité (décrément des
  durées, ré-ordonnancement d'initiative, purge des invocations…) — elles s'enregistrent par
  \`${HOOKS.nom}\` (\`${HOOKS.site}\`), la primitive unique des hooks de combat.
- Un hook qui teste un id d'entité en dur est une **dette démasquée** : il doit migrer vers les
  \`effects\`/\`passive\` de l'entité nommée et disparaître du registre de hooks. La garde qui le fait
  rougir est listée ci-dessous.
- La doctrine complète (et ses cas jugés) vit dans \`docs/combat-events-coherence.md\`.

## 7. Recettes

- **Modificateur de profil sur un trait** : Codex → le trait → \`passive\` → \`+\` une op de
  modificateur. La def TS du registre ne porte que le libellé.
- **Effet « à la touche » sur un Atout d'arme** : Codex → la qualité → \`effects\` → une entrée dont
  le \`trigger\` est le déclencheur voulu et le \`flow\` la conséquence.
- **Capacité irréductible sur un trait** : Codex → le trait → \`capabilities\` → la case ; puis
  ajouter la LECTURE (\`${CAP_TRAIT.nom}\`) au site qui en a besoin.

## Gardes

${table(GARDES_MESUREES, ['Garde', 'Ce qu’elle verrouille (son propre `describe`)'], (g) => `| \`${g.p}\` | ${g.quoi} |`)}
`

ecrireOuVerifier({
  out,
  path: 'docs/ajouter-une-mecanique.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:mecanique — docs/ajouter-une-mecanique.md est PÉRIMÉ (diverge de src/engine/flowCore.ts, src/state/triggeredEffects.ts, src/engine/trauma.ts, src/engine/capabilities.ts, des defs, ou du script).',
  rerunMsg: '  → relancer `npm run docs:mecanique` et committer le résultat.',
  okMsg: 'docs:mecanique — OK (docs/ajouter-une-mecanique.md à jour)',
  writeMsg: `docs/ajouter-une-mecanique.md — ${TRIGGERS_LIST.length} déclencheurs, ${SOURCES.kinds.length} kinds de source, ${CAPACITES.length} interfaces de capacités, ${GARDES_MESUREES.length} gardes.`,
})
