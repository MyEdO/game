import { ast } from './dialecte.mjs';
// FORME D'UN SCRIPT DE WORKFLOW — le jugement PUR que partagent la porte de forme
// (`scripts/ops/workflows.test.mjs`), la doublure qui joue les scripts (`jouer-workflow.mjs`) et la garde
// de l'outil `Workflow` (`scripts/hooks/workflow-type-guard.mjs`).
//
// Invariant (run `wf_564ccc33-1bf`, #1993) : aucune propriété RACINE d'un schéma passé à `agent()`
// n'accepte une chaîne. Une fonction le juge (`defautsDeRacine`), à deux points d'application : la
// porte, sur le squelette LITTÉRAL de chaque site d'appel ; la doublure, sur l'objet SÉRIALISÉ qui
// part au harnais.
//
// Limite déclarée : la reconnaissance (`lireWorkflow`) est bornée au dépôt SUIVI ou à suivre
// (`git ls-files -co --exclude-standard`, jouer-workflow.mjs) — un script ignoré par git n'est pas jugé.

import { typescript } from './dialecte.mjs'

/** Les SEULES clés permises à la racine d'un schéma de sortie d'agent. */
export const CLES_DE_RACINE = ['type', 'properties', 'required', 'additionalProperties']

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const lu = (v) => (v === undefined ? 'absent' : JSON.stringify(v))

/**
 * A1 — défauts STRUCTURELS de la racine d'un schéma. PUR. Rien n'est lu sous une propriété racine :
 * `type` est conjonctif en JSON Schema, une propriété dont le `type` exclut `'string'` n'accepte
 * aucune chaîne, quoi qu'elle porte par ailleurs.
 * @param {unknown} valeur le schéma (squelette évalué, ou objet sérialisé)
 * @param {string} lieu préfixe de chaque message
 * @returns {string[]}
 */
export function defautsDeRacine(valeur, lieu) {
  const defauts = []
  const dire = (m) => defauts.push(`${lieu} — ${m}`)
  if (!estObjet(valeur)) {
    dire(`le schéma n’est pas un objet (lu : ${lu(valeur)})`)
    return defauts
  }
  for (const cle of Object.keys(valeur)) {
    if (!CLES_DE_RACINE.includes(cle)) dire(`clé de racine « ${cle} » hors de ${CLES_DE_RACINE.join('/')}`)
  }
  if (valeur.type !== 'object') dire(`\`type: 'object'\` exigé à la racine (lu : ${lu(valeur.type)})`)
  if (valeur.additionalProperties !== false) dire(`\`additionalProperties: false\` exigé à la racine (lu : ${lu(valeur.additionalProperties)})`)
  if (!estObjet(valeur.properties)) {
    dire(`\`properties\` de la racine n’est pas un objet (lu : ${lu(valeur.properties)})`)
    return defauts
  }
  for (const [cle, propriete] of Object.entries(valeur.properties)) {
    if (!estObjet(propriete)) {
      dire(`propriété racine « ${cle} » n’est pas un objet (lu : ${lu(propriete)})`)
      continue
    }
    const type = propriete.type
    const types = Array.isArray(type) ? type : [type]
    if (type === undefined) dire(`propriété racine « ${cle} » sans \`type\``)
    else if (!types.every((t) => typeof t === 'string')) dire(`propriété racine « ${cle} » : \`type\` n’est ni une chaîne ni un tableau de chaînes (lu : ${lu(type)})`)
    else if (types.includes('string')) dire(`propriété racine « ${cle} » accepte une chaîne (\`type\` : ${lu(type)})`)
  }
  return defauts
}

// ── AST : liaison des noms, par la portée LEXICALE du fichier ────────────────────────────────

/** Nœuds dont `.name` DÉCLARE un nom. */
const declarants = (ts) => [
  ts.isVariableDeclaration, ts.isParameterDeclaration, ts.isBindingElement, ts.isFunctionDeclaration, ts.isFunctionExpression,
  ts.isClassDeclaration, ts.isClassExpression, ts.isImportClause, ts.isImportSpecifier, ts.isNamespaceImport,
]

/** `true` si cet identifiant est le NOM d'une déclaration. */
export function estDeclaration(id) {
  const ts = typescript()
  const p = id.parent
  return Boolean(p) && p.name === id && declarants(ts).some((est) => est(p))
}

/**
 * `true` si cet identifiant LIT une liaison : ni nom de déclaration, ni nom de membre, ni étiquette,
 * ni `import.meta`. Un raccourci `{ x }` et un `export { x }` lisent `x`.
 */
export function estReference(id) {
  const ts = typescript()
  const p = id.parent
  if (!p || estDeclaration(id)) return false
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === id) return false
  if (ts.isBindingElement(p) && p.propertyName === id) return false
  if (ts.isImportSpecifier(p) && p.propertyName === id) return false
  if (ts.isExportSpecifier(p) && p.propertyName && p.name === id) return false
  if (ts.isMetaProperty(p)) return false
  if ((ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) && p.label === id) return false
  return true
}

/** Tout nom DÉCLARÉ du fichier → ses identifiants de déclaration, dans l'ordre du source. */
export function declarationsDuFichier(sf) {
  const ts = typescript()
  const noms = new Map()
  const marcher = (n) => {
    if (ts.isIdentifier(n) && estDeclaration(n)) noms.set(n.text, [...(noms.get(n.text) ?? []), n])
    n.forEachChild(marcher)
  }
  marcher(sf)
  return noms
}

/** Le nœud dont la déclaration de cet identifiant couvre la portée. */
function porteeDe(id) {
  const ts = typescript()
  let n = id.parent
  while (ts.isBindingElement(n) || ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n = n.parent
  if (ts.isParameterDeclaration(n)) return n.parent
  if (ts.isVariableDeclaration(n)) {
    if (ts.isCatchClause(n.parent)) return n.parent
    const liste = n.parent
    if (liste.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) return ts.isVariableStatement(liste.parent) ? liste.parent.parent : liste.parent
    let f = liste.parent
    while (f && !ts.isFunctionLikeDeclaration(f) && !ts.isSourceFile(f)) f = f.parent
    return f
  }
  if (ts.isFunctionExpression(n) || ts.isClassExpression(n)) return n
  if (ts.isImportClause(n) || ts.isImportSpecifier(n) || ts.isNamespaceImport(n)) return id.getSourceFile()
  return n.parent
}

/** Les références LIBRES à ce nom : aucune portée englobante ne le déclare. */
export function referencesLibres(sf, nom) {
  const ts = typescript()
  const portees = new Set((declarationsDuFichier(sf).get(nom) ?? []).map(porteeDe))
  const libres = []
  const marcher = (n) => {
    if (ts.isIdentifier(n) && n.text === nom && estReference(n)) {
      let lie = false
      for (let a = n.parent; a && !lie; a = a.parent) lie = portees.has(a)
      if (!lie) libres.push(n)
    }
    n.forEachChild(marcher)
  }
  marcher(sf)
  return libres
}

/**
 * A3 — le mot-clé `export` de `export const meta` de PREMIER niveau, ou `null`.
 * @returns {import('typescript/unstable/ast').Node | null}
 */
export function exportDeMeta(sf) {
  const ts = typescript()
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s) || !(s.declarationList.flags & ts.NodeFlags.Const)) continue
    const exporte = (s.modifiers ?? []).find((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (exporte && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'meta')) return exporte
  }
  return null
}

/** Préfiltre LÂCHE : un texte qui ne nomme ni `agent` ni `meta` n'est pas parsé. */
export const PREFILTRE_DE_WORKFLOW = /\bagent\b|\bmeta\b/

/**
 * A2 — reconnaissance d'un script de workflow par l'AST. PUR.
 * Un script de workflow porte `export const meta` de PREMIER niveau. Sont des défauts : ce `meta`
 * sans référence à l'identifiant LIBRE `agent`, et `agent` libre sans ce `meta`.
 * @param {string} texte
 * @param {string} fichier chemin (dialecte et messages)
 * @returns {{ script: boolean, exportDeMeta: number | null, defauts: string[] }}
 *   `exportDeMeta` = position du mot-clé `export` (A3), que l'enveloppe retire.
 */
export function lireWorkflow(texte, fichier) {
  const source = String(texte)
  if (!PREFILTRE_DE_WORKFLOW.test(source)) return { script: false, exportDeMeta: null, defauts: [] }
  const sf = ast({ rel: fichier, text: source })
  const exporte = exportDeMeta(sf)
  const libres = referencesLibres(sf, 'agent')
  const defauts = []
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  if (exporte && !libres.length) defauts.push(`${fichier}:${ligne(exporte)} — \`export const meta\` sans référence à l’identifiant libre \`agent\``)
  if (!exporte && libres.length) defauts.push(`${fichier}:${ligne(libres[0])} — \`agent\` libre référencé sans \`export const meta\` de premier niveau`)
  return { script: Boolean(exporte), exportDeMeta: exporte ? exporte.getStart(sf) : null, defauts }
}

// ── SITES `agent(prompt, options)` : le jugement PAR APPEL (#2537) ───────────────────────────────
// Consommé par la porte de forme (`scripts/ops/workflows.test.mjs`) et par la garde de l'outil
// `Workflow` (`scripts/hooks/workflow-type-guard.mjs`). Deux couches : UNIVERSELLE (options fermées,
// `agentType` littéral qui nomme un type déclaré), et DÉPÔT (`regimes` : étages et modèles), que la
// porte seule fournit.

/** Un littéral de chaîne sans substitution. PUR. */
export const estTexte = (n) => {
  const ts = typescript()
  return Boolean(n) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
}
/** Le texte d'un nœud, blancs repliés, borné à 60 caractères (messages). PUR. */
export const apercu = (n, sf) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 60)

/**
 * Un objet littéral FERMÉ : chaque membre est une affectation ou un raccourci, à clé non calculée,
 * sans doublon, sans `__proto__`. PUR.
 * @returns {{ membres: Map<string, { noeud: any, valeur: any }>, ouvertures: [any, string][] }}
 */
export function fermer(obj, sf) {
  const ts = typescript()
  const membres = new Map()
  const ouvertures = []
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) {
      ouvertures.push([p, ts.isSpreadAssignment(p) ? `spread \`${apercu(p, sf)}\`` : `méthode ou accesseur \`${apercu(p, sf)}\``])
      continue
    }
    if (ts.isComputedPropertyName(p.name)) {
      ouvertures.push([p, `clé calculée \`${apercu(p.name, sf)}\``])
      continue
    }
    const cle = p.name.text
    if (cle === '__proto__') ouvertures.push([p, '`__proto__`'])
    else if (membres.has(cle)) ouvertures.push([p, `clé « ${cle} » en double`])
    else membres.set(cle, { noeud: p, valeur: ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer })
  }
  return { membres, ouvertures }
}

/**
 * Les sites `agent(…)` du fichier, dans l'ordre du source. PUR. `membres` vaut `null` quand les
 * options ne sont pas un objet littéral.
 * @returns {{ appel: any, prompt: any, options: any, membres: Map<string, { noeud: any, valeur: any }> | null, ouvertures: [any, string][] }[]}
 */
export function sitesDAgent(sf) {
  const ts = typescript()
  const sites = []
  const marcher = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'agent') {
      const [prompt, options] = n.arguments ?? []
      const ferme = options && ts.isObjectLiteralExpression(options) ? fermer(options, sf) : { membres: null, ouvertures: [] }
      sites.push({ appel: n, prompt, options, ...ferme })
    }
    n.forEachChild(marcher)
  }
  marcher(sf)
  return sites
}

/** Une option d'un site : absente, littérale (`valeur`), ou non littérale (`valeur: null`). PUR. */
export function optionDuSite(site, champ) {
  const m = site.membres?.get(champ)
  if (!m) return { present: false, valeur: null, noeud: site.options }
  return { present: true, valeur: estTexte(m.valeur) ? m.valeur.text : null, noeud: m.noeud }
}

/**
 * Défauts PAR APPEL des sites `agent(…)` d'un script de workflow. PUR.
 * Universel : options littérales et FERMÉES ; `agentType` présent, littéral, et nom d'un type de
 * `typesDeclares` (le `name:` du frontmatter d'une fiche de `.claude/agents/`) — Calibrage de
 * `.claude/skills/orchestrer-des-agents/SKILL.md` ; portée STATIQUE : ni `with`, ni `eval` libre, ni
 * `arguments` de l'enveloppe, ni déclaration qui lie `agent`, ni référence à `agent` hors d'un appel
 * direct `agent(…)` — sinon un appel échappe aux sites lus.
 * Dépôt (`regimes`, absent hors de la porte) : `phase`, `model` et `effort` littéraux ; étage de la
 * phase (`regimes.phases[phase]`, `null` = régime inconnu, nommé par la porte) ; sinon phase
 * MÉCANIQUE (`regimes.mecanique` : types permis, couples (type, modèle), exceptions par phase).
 * @param {any} sf
 * `sites` : ceux de `sitesDAgent(sf)`, passés par l'appelant qui les lit aussi.
 * @param {{ typesDeclares: Set<string>, sites?: ReturnType<typeof sitesDAgent>, regimes?: {
 *   phases: Record<string, { nom: string, type: string, modele: string, effort: string } | null>,
 *   mecanique: { types: string[], couples: { type: string, modele: string }[], exceptions: { phase: string, type: string }[] },
 * } }} contexte
 * @returns {{ regle: string, message: string }[]}
 */
export function defautsDesSitesDAgent(sf, { typesDeclares, regimes, sites = sitesDAgent(sf) }) {
  const ts = typescript()
  const defauts = []
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const dire = (regle, n, message) => defauts.push({ regle, message: `${sf.fileName}:${ligne(n)} — ${message}` })
  const vu = (x) => (x.present ? `\`${x.valeur}\`` : 'absent')
  const declares = [...typesDeclares].join('/')
  const evalsLibres = new Set(referencesLibres(sf, 'eval'))
  /** `arguments` que seule l'enveloppe lie : aucune fonction NON fléchée ne l'englobe (une flèche n'en a pas). */
  const argumentsDeLEnveloppe = new Set(referencesLibres(sf, 'arguments').filter((id) => {
    for (let a = id.parent; a; a = a.parent) if (ts.isFunctionLikeDeclaration(a) && !ts.isArrowFunction(a)) return false
    return true
  }))
  for (const id of declarationsDuFichier(sf).get('agent') ?? []) dire('agent-direct', id, 'déclaration qui lie le nom `agent` — l’identifiant du harnais ne se masque pas')
  const portee = (n) => {
    if (ts.isWithStatement(n)) dire('portee', n, 'instruction `with` — la liaison des noms ne se lit plus à la forme')
    if (ts.isIdentifier(n) && evalsLibres.has(n)) dire('portee', n, '`eval` — du code que la forme ne lit pas')
    if (ts.isIdentifier(n) && argumentsDeLEnveloppe.has(n)) dire('portee', n, '`arguments` — alias des doublures du harnais, que la forme ne lit pas')
    if (ts.isIdentifier(n) && n.text === 'agent' && estReference(n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) {
      dire('agent-direct', n, `\`agent\` non appelé directement (${ts.SyntaxKind[n.parent.kind]}) — seul un appel \`agent(…)\` est un site que la porte lit`)
    }
    n.forEachChild(portee)
  }
  sf.forEachChild(portee)
  for (const site of sites) {
    if (site.membres === null) {
      dire('options', site.options ?? site.appel, "options de l'agent non littérales — la porte ne peut pas lire son étage")
      continue
    }
    for (const [noeud, pourquoi] of site.ouvertures) dire('options', noeud, `options non fermées : ${pourquoi}`)
    const lire = (champ) => {
      const x = optionDuSite(site, champ)
      if (x.present && x.valeur === null) dire('options', x.noeud, `\`${champ}\` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution`)
      return x
    }
    const phase = regimes ? lire('phase') : null
    const agentType = lire('agentType')
    const modele = regimes ? lire('model') : null
    const effort = regimes ? lire('effort') : null
    if (!agentType.present) dire('agent', site.options, `\`agentType\` absent — un agent de workflow nomme un type déclaré sous \`.claude/agents/\` (${declares})`)
    else if (agentType.valeur !== null && !typesDeclares.has(agentType.valeur)) dire('agent', agentType.noeud, `\`agentType\` ${vu(agentType)} : aucun type de ce nom déclaré sous \`.claude/agents/\` (${declares})`)
    if (!regimes) continue

    const lisible = (x) => x.present && x.valeur !== null
    const nonLitteral = (x) => x.present && x.valeur === null
    if (!phase.present) {
      dire('agent', site.appel, '`phase` absente — c\'est la clé STABLE de la porte (le `label` est de l\'affichage)')
      continue
    }
    if (phase.valeur === null) continue
    if (Object.hasOwn(regimes.phases, phase.valeur)) {
      const etage = regimes.phases[phase.valeur]
      if (etage === null) continue
      if (lisible(agentType) && agentType.valeur !== etage.type) dire('agent', agentType.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`agentType: '${etage.type}'\` exigé (lu : ${vu(agentType)})`)
      if (!nonLitteral(modele) && modele.valeur !== etage.modele) dire('agent', modele.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`model: '${etage.modele}'\` exigé AUSSI (lu : ${vu(modele)}) — un sous-agent ne tourne jamais sur le modèle de session`)
      if (!nonLitteral(effort) && effort.valeur !== etage.effort) dire('agent', effort.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`effort: '${etage.effort}'\` exigé AUSSI (lu : ${vu(effort)})`)
      continue
    }
    if (!effort.present) dire('agent', site.options, `phase MÉCANIQUE \`${phase.valeur}\` : \`effort\` littéral exigé (lu : absent)`)
    const { mecanique } = regimes
    const permis = [...mecanique.types, ...mecanique.exceptions.filter((e) => e.phase === phase.valeur).map((e) => e.type)]
    const types = lisible(agentType) && permis.includes(agentType.valeur) ? [agentType.valeur] : permis
    const modeles = [...new Set(mecanique.couples.filter((c) => types.includes(c.type)).map((c) => c.modele))]
    if (!nonLitteral(modele) && !modeles.includes(modele.valeur)) dire('agent', modele.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`model\` littéral parmi ${modeles.join('/')} exigé pour ${types.join('/')} (lu : ${vu(modele)})`)
    if (lisible(agentType) && !permis.includes(agentType.valeur)) dire('agent', agentType.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`agentType\` littéral parmi ${permis.join('/')} exigé (lu : ${vu(agentType)})`)
  }
  return defauts
}
