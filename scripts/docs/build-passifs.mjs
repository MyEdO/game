/**
 * Génère docs/systeme-passifs.md — le système de passifs unifié (tout modificateur CONTINU dans UN
 * vocabulaire d'ops, lu par UN collecteur) et les Mutations/Tables de Corruption.
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - l'union `PassiveKind` (`src/engine/ops.ts`) et le commentaire de queue de chaque membre ;
 *  - la table `PASSIVE_CANCELLERS` (`src/engine/trauma.ts`) : kind → annulateurs, lue par AST ;
 *  - le mode de COMBINAISON par kind, dérivé du seul kind additif reconnu par `isAdditiveKind` ;
 *  - les BRANCHES du collecteur `passiveMods` : une par source, avec sa ligne et son commentaire de
 *    tête — le manuscrit en listait 6 quand le collecteur en a bien davantage (États, psychologies,
 *    Ivresse, Soif, Talents, objets portés… tous absents de sa liste, et son §2 affirmait même que
 *    les États restaient HORS du collecteur) ;
 *  - les documents PORTEURS d'un champ `passive`/`passiveBySeverity`, lus au def zod, avec le nombre
 *    d'entrées qui l'exercent RÉELLEMENT dans le `.json`.
 * La part ÉDITORIALE (frontières, doctrine « un seul format », recettes) vit ICI, en dur.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-passifs.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { parUnitesDeCode, listerDossier } from '../guards/lib/lister.mjs'
import ts from 'typescript'
import { loadSource, firstSentence } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const OUTIL = 'build-passifs'
const OPS = 'src/engine/ops.ts'
const TRAUMA = 'src/engine/trauma.ts'
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

for (const p of [OPS, TRAUMA, DEFS, DATA]) ancre(p, 'source du générateur')

const { text: OPS_SRC, sf: OPS_SF } = loadSource(OPS)
const { text: TR_SRC, sf: TR_SF } = loadSource(TRAUMA)
const ligne = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1

// ── `PassiveKind` : membres + commentaire de QUEUE (la forme réelle du fichier) ────────────────────

const KINDS = (() => {
  let alias
  OPS_SF.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'PassiveKind') alias = n
  })
  if (!alias || !ts.isUnionTypeNode(alias.type)) abandon(`\`PassiveKind\` n'est plus une union nommée dans ${OPS}`)
  return alias.type.types.map((m) => {
    if (!ts.isLiteralTypeNode(m) || !ts.isStringLiteral(m.literal)) abandon(`membre non littéral dans \`PassiveKind\` (${OPS})`)
    // Le fichier documente chaque kind par un commentaire de QUEUE (`// …`) — pas un JSDoc de tête.
    const fin = m.getEnd()
    const reste = OPS_SRC.slice(fin, OPS_SRC.indexOf('\n', fin) + 1 || undefined)
    const note = reste.match(/\/\/\s*(.+?)\s*$/m)
    return { nom: m.literal.text, note: note ? plat(note[1]) : null, l: ligne(OPS_SF, m.getStart(OPS_SF)) }
  })
})()
if (KINDS.length < 3) abandon(`moins de 3 membres lus dans \`PassiveKind\` — l'union a dérivé`)

// ── `PASSIVE_CANCELLERS` : kind → annulateurs, + commentaire de queue s'il y en a un ───────────────

const CANCELLERS = (() => {
  let decl
  TR_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'PASSIVE_CANCELLERS') decl = d
    }
  })
  if (!decl?.initializer || !ts.isObjectLiteralExpression(decl.initializer)) {
    abandon(`\`PASSIVE_CANCELLERS\` n'est plus un objet littéral dans ${TRAUMA}`)
  }
  const m = new Map()
  for (const p of decl.initializer.properties) {
    if (!ts.isPropertyAssignment(p) || !ts.isArrayLiteralExpression(p.initializer)) continue
    const cle = p.name.getText(TR_SF).replace(/^['"]|['"]$/g, '')
    const fin = p.getEnd()
    const reste = TR_SRC.slice(fin, TR_SRC.indexOf('\n', fin) + 1 || undefined)
    const note = reste.match(/\/\/\s*(.+?)\s*$/m)
    m.set(cle, {
      liste: p.initializer.elements.filter(ts.isStringLiteral).map((e) => e.text),
      note: note ? plat(note[1]) : null,
    })
  }
  if (!m.size) abandon(`\`PASSIVE_CANCELLERS\` ne porte plus aucune entrée lisible`)
  return { map: m, l: ligne(TR_SF, decl.getStart(TR_SF)) }
})()
const orphelins = KINDS.filter((k) => !CANCELLERS.map.has(k.nom)).map((k) => k.nom)
if (orphelins.length) abandon(`\`PASSIVE_CANCELLERS\` ne couvre plus les kinds : ${orphelins.join(', ')} — la table doit rester TOTALE`)

/** Le kind ADDITIF est celui qu'`isAdditiveKind` reconnaît — lu au corps, jamais supposé. */
const ADDITIF = (() => {
  const m = TR_SRC.match(/function isAdditiveKind[\s\S]*?===\s*'([a-z]+)'/)
  if (!m) abandon(`\`isAdditiveKind\` illisible dans ${TRAUMA} — le mode de combinaison ne se dérive plus`)
  return m[1]
})()
if (!KINDS.some((k) => k.nom === ADDITIF)) abandon(`\`isAdditiveKind\` compare à « ${ADDITIF} », absent de \`PassiveKind\``)

/** `kind` DÉRIVÉ d'une op de séquelle (`traumaOpKind`) : op-type → kind, lu au corps. */
const TRAUMA_OP_KIND = (() => {
  const corps = TR_SRC.match(/function traumaOpKind\(op: GameOp\): PassiveKind \{([\s\S]*?)\n\}/)
  if (!corps) abandon(`\`traumaOpKind\` illisible dans ${TRAUMA}`)
  const rows = [...corps[1].matchAll(/op\.op === '(\w+)'\) return '(\w+)'/g)].map((m) => ({ op: m[1], kind: m[2] }))
  const defaut = corps[1].match(/return '(\w+)';\s*\/\/\s*(.+)/)
  if (!rows.length || !defaut) abandon(`\`traumaOpKind\` ne se lit plus en « op → kind » (${TRAUMA})`)
  return { rows, defaut: { kind: defaut[1], quoi: plat(defaut[2]) } }
})()

// ── Les BRANCHES du collecteur : une par SOURCE, mesurées dans le corps de `passiveMods` ───────────

/** Commentaire de TÊTE (`//` consécutifs) d'un fragment de trivia, aplati, 1re phrase. */
function noteDeTete(triviaBrut) {
  // Une trivia qui ne commence PAS par un saut de ligne débute en MILIEU de la ligne précédente :
  // ce qui s'y trouve est le commentaire de QUEUE de l'instruction d'avant, pas la tête de celle-ci
  // (mesuré : `wornSocialMods` héritait ainsi de la note de `qualityWearMods`).
  const trivia = triviaBrut.startsWith('\n') ? triviaBrut : triviaBrut.slice(triviaBrut.indexOf('\n') + 1)
  const lignes = trivia.split('\n').map((l) => l.trim())
  const bloc = []
  for (const l of lignes) {
    if (l.startsWith('//')) bloc.push(l.replace(/^\/\/\s?/, ''))
    else if (bloc.length && l === '') break
    else if (!l.startsWith('//')) bloc.length = 0
  }
  if (!bloc.length) return null
  return plat(firstSentence(bloc.join(' ')))
}

function corpsDeFonction(nom) {
  let fn
  TR_SF.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nom) fn = n
  })
  if (!fn?.body) abandon(`\`${nom}\` introuvable (ou sans corps) dans ${TRAUMA}`)
  return fn
}

const PASSIVE_MODS = corpsDeFonction('passiveMods')

/** Une BRANCHE = une instruction de premier niveau du collecteur qui émet des `PassiveMod`. Chacune
 *  rend : sa ligne, les `kind` littéraux qu'elle pose, les producteurs qu'elle appelle, et son
 *  commentaire de tête (les mots du CODE, jamais une reformulation). */
const BRANCHES = (() => {
  const out = []
  let prevEnd = PASSIVE_MODS.body.getStart(TR_SF) + 1
  for (const st of PASSIVE_MODS.body.statements) {
    const src = st.getText(TR_SF)
    const trivia = TR_SRC.slice(prevEnd, st.getStart(TR_SF))
    prevEnd = st.getEnd()
    if (!/out\.push/.test(src)) continue
    const kinds = [...new Set([...src.matchAll(/kind:\s*'([a-z]+)'/g)].map((m) => m[1]))]
    const producteurs = [...new Set([...src.matchAll(/\.\.\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]))]
    const implicite = /kind,/.test(src) // `kind` calculé (branche séquelle)
    // La ligne citée est celle qui PORTE le jeton nommé en table (`kind: '…'` ou l'appel du
    // producteur), pas le début de l'instruction : une garde de fraîcheur (`check-docs-vs-head`)
    // exige de retrouver, autour du site cité, l'un des identifiants backtiqués de la même ligne du
    // doc — une instruction multi-lignes citée à son ouverture ne le porte pas.
    const ancreDansStatement = kinds.length ? src.indexOf(`kind: '${kinds[0]}'`) : producteurs.length ? src.indexOf(`...${producteurs[0]}(`) : 0
    out.push({
      l: ligne(TR_SF, st.getStart(TR_SF) + Math.max(0, ancreDansStatement)),
      kinds: kinds.length ? kinds : implicite ? ['(dérivé)'] : [],
      producteurs,
      note: noteDeTete(trivia),
    })
  }
  if (out.length < 5) abandon(`moins de 5 branches d'émission lues dans \`passiveMods\` (${TRAUMA}) — le collecteur a changé de forme`)
  return out
})()

/** Producteurs NOMMÉS appelés par le collecteur, avec leur site réel (fichier:ligne) et leur rôle. */
const PRODUCTEURS = (() => {
  const noms = [...new Set(BRANCHES.flatMap((b) => b.producteurs))]
  const importsDe = new Map()
  for (const st of TR_SF.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings) continue
    const chemin = st.moduleSpecifier.text
    const b = st.importClause.namedBindings
    if (!ts.isNamedImports(b)) continue
    for (const e of b.elements) importsDe.set(e.name.text, chemin)
  }
  return noms
    .map((nom) => {
      const rel = importsDe.get(nom)
      const fichier = rel
        ? `src/engine/${rel.replace(/^\.\//, '')}.ts`.replace('src/engine/../', 'src/')
        : TRAUMA
      if (!existsSync(fichier)) abandon(`producteur \`${nom}\` : \`${fichier}\` introuvable (import déplacé ?)`)
      const { text, sf } = loadSource(fichier)
      let noeud
      const visite = (n) => {
        if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name) && n.name.text === nom) noeud = n
        n.forEachChild(visite)
      }
      sf.forEachChild(visite)
      if (!noeud) abandon(`producteur \`${nom}\` introuvable dans \`${fichier}\``)
      const decl = ts.isVariableDeclaration(noeud) ? noeud.parent.parent : noeud
      const doc = text.slice(decl.getFullStart(), decl.getStart(sf)).match(/\/\*\*[\s\S]*?\*\//)
      return {
        nom,
        site: `${fichier}:${ligne(sf, noeud.name.getStart(sf))}`,
        role: doc ? plat(firstSentence(doc[0].replace(/^\/\*\*|\*\/$/g, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join(' ').replace(/\s+/g, ' ').trim())) : null,
      }
    })
    .sort((a, b) => parUnitesDeCode(a.nom, b.nom))
})()

// ── Les documents PORTEURS d'un champ `passive` — lus au def, comptés à la donnée ──────────────────

/** Champs de passif déclarés par un def : `passive`, `visiblePassive`, `passiveBySeverity`… (tout champ
 *  dont le nom CONTIENT « passive » — le canal peut être indexé, cf. `passiveBySeverity` qui porte une
 *  liste PAR PALIER de sévérité). Le def dit le CHAMP, le `.json` dit combien d'entrées l'exercent. */
const PORTEURS = (() => {
  const out = []
  for (const f of listerDossier(DEFS).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const chemin = `${DEFS}/${f}`
    const { text, sf } = loadSource(chemin)
    if (!/\bpassive\b/.test(text)) continue
    const fichierJson = text.match(/export const file = '([^']+)'/)?.[1]
    if (!fichierJson) continue
    let appel
    const visite = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'document') appel = n
      n.forEachChild(visite)
    }
    sf.forEachChild(visite)
    if (!appel) continue
    // `champs` est le 3ᵉ argument ; certains defs le passent par identifiant (`champs`).
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
    const cles = champs.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => p.name.getText(sf).replace(/^['"]|['"]$/g, ''))
      .filter((k) => /passive/i.test(k))
    if (!cles.length) continue
    out.push({ def: chemin, json: `${DATA}/${fichierJson}`, cles })
  }
  if (out.length < 3) abandon(`moins de 3 documents porteurs d'un champ de passif sous ${DEFS}/ — le scan a dérivé`)
  return out
})()

/** Une valeur de canal passif est-elle EXERCÉE ? Une liste non vide, ou un canal INDEXÉ
 *  (`passiveBySeverity`) dont au moins un palier porte une liste non vide. */
const exerce = (v) => (Array.isArray(v) ? v.length > 0 : !!v && typeof v === 'object' && Object.values(v).some(exerce))

/** Entrées d'un dataset qui exercent RÉELLEMENT un champ de passif non vide. */
function porteuses(json, cles) {
  if (!existsSync(json)) return null
  const data = JSON.parse(readFileSync(json, 'utf8'))
  const entrees = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : []
  const n = entrees.filter((e) => cles.some((k) => exerce(e?.[k]))).length
  return { total: entrees.length, n }
}
const PORTEURS_MESURES = PORTEURS.map((p) => ({ ...p, pop: porteuses(p.json, p.cles) })).filter((p) => p.pop)

// ── Mutations & Tables de Corruption : découplage MESURÉ ──────────────────────────────────────────

const MUTATIONS = JSON.parse(readFileSync(ancre(`${DATA}/mutations.json`, 'mutations'), 'utf8'))
const TABLES = JSON.parse(readFileSync(ancre(`${DATA}/mutationTables.json`, 'tables de Corruption'), 'utf8'))
const REFS_TABLES = new Set(TABLES.flatMap((t) => (t.entries ?? t.ranges ?? []).map((r) => r.mutation)))
const MUT_HORS_TABLE = MUTATIONS.filter((m) => !REFS_TABLES.has(m.id)).length
const MUT_KINDS = [...new Set(MUTATIONS.map((m) => m.kind).filter(Boolean))].sort()

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, l) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(l).join('\n')}`
const combinaison = (k) => (k === ADDITIF ? 'Σ dans la BASE (additif)' : 'pool non-cumul (meilleur bonus + pire malus)')

const out = `# Système de passifs unifié & Corruption

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-passifs.mjs\` (\`npm run docs:passifs\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les ${KINDS.length} membres de
\`PassiveKind\` (\`${OPS}\`) et leur commentaire de queue, la table \`PASSIVE_CANCELLERS\`
(\`${TRAUMA}:${CANCELLERS.l}\`), le mode de combinaison (le seul kind ADDITIF reconnu par
\`isAdditiveKind\` est \`${ADDITIF}\`), les ${BRANCHES.length} branches d'émission du collecteur
\`passiveMods\` avec leur ligne, les ${PRODUCTEURS.length} producteurs nommés qu'il appelle, et les
${PORTEURS_MESURES.length} documents qui déclarent un champ de passif (def zod + population réelle du \`.json\`).
**Angles morts** : le catalogue des \`GameOp\` n'est PAS repris ici — il vit dans
\`docs/vocabulaire-mecanique.md\`, source unique (une seconde copie divergerait) ; quelles ops sont
effectivement LUES par quel consommateur n'est pas dérivable (le filtrage se fait par type d'op au
point de lecture) ; une branche du collecteur n'est comptée que si elle appelle \`out.push\` au
PREMIER niveau de la fonction ; le rôle rapporté est la 1re phrase du commentaire du CODE ; la
frontière « ce qui n'est PAS un passif » est de l'ÉDITORIAL fixé dans le script.

Référence du système qui modélise **tout modificateur PASSIF continu** dans **UN seul vocabulaire
d'ops**, lu par **UN seul collecteur**, et **éditable en données** au Codex avec le même éditeur que
les sorts.

> Passif = effet CONTINU, lu à chaque calcul. Ce n'est ni un effet DÉCLENCHÉ (\`TriggeredEffect\`, qui
> se joue sur un événement — cf. \`docs/ajouter-une-mecanique.md\`), ni un effet appliqué une fois à
> l'incantation d'un sort. Un passif n'a pas de déclencheur.

## 1. Le vocabulaire — \`GameOp\`, puis \`PassiveMod\`

Un passif est une liste de \`GameOp\` : **le même vocabulaire que les sorts**, catalogué dans
\`docs/vocabulaire-mecanique.md\` (y chercher l'op AVANT de conclure qu'elle manque). Au runtime, le
collecteur emballe chaque op dans un \`PassiveMod = { op, kind?, src?, label? }\` (\`${OPS}\`) :
\`kind\` porte le profil d'annulation ET de combinaison ; \`src\`/\`label\` NOMMENT l'entité émettrice
pour l'affichage d'une composante de jet, et ne sont jamais lus par le calcul.

## 2. \`PassiveKind\` — annulation et combinaison

${table(
  KINDS.map((k) => ({ ...k, c: CANCELLERS.map.get(k.nom) })),
  ['`kind`', 'Ce qu’il désigne', 'Annulé par', 'Combinaison'],
  (k) =>
    `| \`${k.nom}\` | ${k.note ?? '—'} | ${k.c.liste.length ? k.c.liste.map((x) => `\`${x}\``).join(', ') : k.c.note ? plat(k.c.note) : 'rien'} | ${combinaison(k.nom)} |`,
)}

Table des annulateurs : \`PASSIVE_CANCELLERS\` (\`${TRAUMA}:${CANCELLERS.l}\`) — elle doit rester
TOTALE sur l'union (ce générateur échoue si un kind n'y figure plus). Seul \`${ADDITIF}\` se somme
dans la base ; tout le reste se combine en pool NON-CUMUL.

Pour une SÉQUELLE, le \`kind\` n'est pas stocké : il est dérivé du type d'op par \`traumaOpKind\` —
${TRAUMA_OP_KIND.rows.map((r) => `\`${r.op}\` → \`${r.kind}\``).join(' · ')}, tout le reste → \`${TRAUMA_OP_KIND.defaut.kind}\` (${TRAUMA_OP_KIND.defaut.quoi}).

## 3. Le collecteur — \`passiveMods(c)\`

\`passiveMods\` (\`${TRAUMA}:${ligne(TR_SF, PASSIVE_MODS.name.getStart(TR_SF))}\`) est le **point de
lecture UNIQUE**. Ses ${BRANCHES.length} branches d'émission, dans l'ordre du code :

${table(
  BRANCHES,
  ['Ligne', '`kind` émis', 'Producteur', 'Ce que la branche collecte (commentaire du code)'],
  (b) =>
    `| \`${TRAUMA}:${b.l}\` | ${b.kinds.length ? b.kinds.map((k) => `\`${k}\``).join(', ') : '—'} | ${b.producteurs.length ? b.producteurs.map((p) => `\`${p}\``).join(', ') : 'inline'} | ${b.note ?? '—'} |`,
)}

Producteurs nommés, avec leur site réel :

${table(PRODUCTEURS, ['Producteur', 'Site', 'Rôle (JSDoc)'], (p) => `| \`${p.nom}\` | \`${p.site}\` | ${p.role ?? '—'} |`)}

**Ajouter une source de passif = ajouter une branche ICI**, jamais un second collecteur ni une
lecture directe d'un champ typé au consommateur. Les consommateurs
(\`effectiveChar\`/\`testValue\`/\`defenseValue\`/\`effectiveMovement\`/\`recomputeLoadout\`) passent
tous par les helpers d'extraction de \`${TRAUMA}\`, qui filtrent par type d'op et par mode de
combinaison.

### Anti-cycle

Le collecteur ne peut importer que des **feuilles** (aucune n'important en retour trauma ou
characteristics) ; les sources portées par le Combattant lui-même (mutations, objets, États) sont
lues INLINE. C'est cette contrainte, pas une préférence de style, qui décide de la forme d'une
branche : un producteur nommé quand le module est une feuille, une boucle inline sinon.

## 4. Où vivent les passifs — DONNÉE éditable

Chaque document qui porte un passif le DÉCLARE dans son def zod ; la colonne de droite est la
population qui l'exerce vraiment aujourd'hui.

${table(
  PORTEURS_MESURES,
  ['Document', 'Champ(s)', 'Def', 'Entrées porteuses'],
  (p) => `| \`${p.json}\` | ${p.cles.map((k) => `\`${k}\``).join(', ')} | \`${p.def}\` | ${p.pop.n} / ${p.pop.total} |`,
)}

Le \`kind\` n'est PAS dans la donnée : le collecteur l'affecte à l'émission (le kind d'une séquelle
est dérivé, celui d'un trait/mutation/objet est \`${ADDITIF}\`). **Un seul format en donnée :
\`GameOp[]\`.**

## 5. Mutations & Tables de Corruption — DÉCOUPLÉES

Une **mutation** est une entité (identité + effets), SANS plage de tirage :
\`${DATA}/mutations.json\` porte ${MUTATIONS.length} entrées, de \`kind\` ${MUT_KINDS.map((k) => `\`${k}\``).join(' / ')}.
Une **Table de Corruption** (\`${DATA}/mutationTables.json\`, ${TABLES.length} tables) n'est qu'une
suite de plages d100 qui RÉFÉRENCENT des mutations **par id**. Plusieurs tables peuvent donc pointer
la même mutation à des plages différentes, sans collision.
${MUT_HORS_TABLE ? `Mesuré : ${MUT_HORS_TABLE} mutations ne sont référencées par aucune table (tirées autrement, ou octroyées directement).` : 'Mesuré : toutes les mutations sont référencées par au moins une table.'}

Le \`kind\` (physique/mentale) reste sur la MUTATION — c'est sa nature, lue par les limites de
Corruption — indépendamment de la table qui l'a tirée.

## 6. Éditer — au Codex

Tout passe par le Compendium in-app (écran Codex) :

- champ \`passive\` d'un trait / d'une qualité / d'une mutation / d'un talent / d'un État / d'un
  objet → \`GameOpEditor\`, **le composant de liste d'ops EXISTANT**, celui qui sert aussi aux sorts.
  Ajouter un modificateur de profil = ajouter une op, jamais un widget de plus ;
- Tables de Corruption : l'éditeur de plages (intervalle d100 + mutation référencée, autocomplétée
  depuis le dataset des mutations) ;
- la sauvegarde réécrit le \`.json\` app-owned ; Vite recharge.

## 7. Frontières — ce qui n'est PAS un passif \`GameOp\`

- **Apparence** (cornes, écailles, peau d'une mutation) : couche RIG séparée. Le visuel n'est pas le
  mécanique.
- **Armure naturelle** d'une mutation (\`apAll\`/\`apLocations\`) : lue par la couche d'armure, pas par
  le collecteur de stats.
- **Effets STRUCTURELS ou comportementaux** d'un trait/d'une qualité (vol, sauvegarde, déclencheur de
  critique…) : ce sont des \`capabilities\` — drapeaux que le moteur INTERROGE, sans valeur numérique.
  Le choix entre les trois canaux est décrit dans \`docs/ajouter-une-mecanique.md\`.
- Un effet à DÉCLENCHEUR n'est pas un passif : il vit dans \`effects\` et passe par le dispatcher
  unique (même doc).

## 8. Recettes

- **Donner un modificateur de profil à un trait** : Codex → le trait → \`passive\` → \`+\` une op de
  modificateur. La def TS du registre ne porte que le libellé.
- **Créer une mutation** : Codex → Mutations → identité + \`passive\`. L'armure naturelle reste un
  champ à part (§7).
- **Ajouter une table de Corruption** (un dieu du Chaos) : Codex → Tables de Corruption → une entrée
  dont les plages référencent des mutations EXISTANTES par id.
`

ecrireOuVerifier({
  out,
  path: 'docs/systeme-passifs.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:passifs — docs/systeme-passifs.md est PÉRIMÉ (diverge de src/engine/ops.ts, src/engine/trauma.ts, des defs de src/data/schemas/defs/, des datasets, ou du script).',
  rerunMsg: '  → relancer `npm run docs:passifs` et committer le résultat.',
  okMsg: 'docs:passifs — OK (docs/systeme-passifs.md à jour)',
  writeMsg: `docs/systeme-passifs.md — ${KINDS.length} kinds, ${BRANCHES.length} branches de collecteur, ${PRODUCTEURS.length} producteurs, ${PORTEURS_MESURES.length} documents porteurs.`,
})
