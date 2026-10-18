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

import { analyserTexte, ast, typescript } from './dialecte.mjs'

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
 * `.claude/skills/orchestrer-des-agents/calibrage.md` ; portée STATIQUE : ni `with`, ni `eval` libre, ni
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

/** RÉGIMES des phases, déclarés par script et par phase ; une phase absente est MÉCANIQUE. Un
 *  régime porte son type ; son modèle et son effort se lisent au frontmatter de ce type (`fichesDAgent`).
 *  Chaque phase est déclarée ET portée par un SITE `agent(` (`defautsDesTables`). #2099 */
export const REGIMES = {
  '.claude/workflows/dossier-de-chapitre.js': { Complétude: 'jugement' },
  '.claude/workflows/table-simulee.js': { Analyse: 'jugement' },
  'scripts/raw/atlas-domain.workflow.js': { Taxonomie: 'redaction', Synthese: 'redaction', Correction: 'redaction', Audit: 'jugement', Verif: 'jugement' },
};

const TYPES_MECANIQUES = ['lecteur', 'verif-mecanique'];

/** Exceptions des étages MÉCANIQUES, nominatives, avec leur raison : dans UNE phase d'UN script, un
 *  type d'agent permis en plus des mécaniques. Cliquet (`defautsDesTables`) : plafond, liste NOMMÉE. #2099 */
export const EXCEPTIONS_MECANIQUES = [
  { fichier: '.claude/workflows/table-simulee.js', phase: 'Partie', type: 'joueur', raison: 'joueurs cloisonnés : un seul outil, ni lecture, ni shell, ni web (`.claude/agents/joueur.md`)' },
  { fichier: '.claude/workflows/table-simulee.js', phase: 'Partie', type: 'mj-de-table', raison: 'le MJ DÉCIDE ce qui arrive à la table, rôle que le prompt de `lecteur` (« tu ne décides rien ») contredit (`.claude/agents/mj-de-table.md`)' },
];

/** Les couples (type, modèle) de la table de `.claude/skills/orchestrer-des-agents/calibrage.md`, seule source
 *  du modèle d'un type (#2537). PUR.
 *  @param {string} calibrage @returns {{ type: string, modele: string }[]} */
const couplesDuCalibrage = (calibrage) => {
  return [...calibrage.matchAll(/^\|[^|\n]*\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm)].map(([, type, modele]) => ({ type, modele }));
};

const RUNNERS_INTERDITS = ['npm test', 'npm run gates', 'vitest run'];

export const TABLES = {
  regimes: REGIMES,
  exceptions: EXCEPTIONS_MECANIQUES,
  /** Liste DÉCROISSANTE : en retirer est libre, en ajouter se justifie au commit. */
  plafond: 2,
  /** Les exceptions NOMMÉES : une entrée qui change de nom se relit au commit. */
  nommees: [
    '.claude/workflows/table-simulee.js / Partie / joueur',
    '.claude/workflows/table-simulee.js / Partie / mj-de-table',
  ],
};

const nomDe = (p) => {
  const ts = typescript()
  return ('name' in p && ts.isIdentifier(p.name)) || ts.isStringLiteral(p.name) ? p.name.text : null
};

const propriete = (obj, nom) => obj.properties.find((p) => typescript().isPropertyAssignment(p) && nomDe(p) === nom);

const sansParentheses = (n) => (n && typescript().isParenthesizedExpression(n) ? sansParentheses(n.expression) : n);

/** Les étages de JUGEMENT et de RÉDACTION, lus aux `fiches` (`fichesDAgent`). */
export function etagesDe(fiches) {
  /** L'étage `nom` du type `type`, au `model`/`effort` de sa fiche ; une fiche sans eux casse le chargement. */
  const etage = (nom, type) => {
    const { model, effort } = fiches.get(type) ?? {};
    if (!model || !effort) throw new Error(`étage ${nom} : \`.claude/agents/${type}.md\` sans \`model\` ou \`effort\` au frontmatter`);
    return { nom, type, modele: model, effort };
  };
  return { jugement: etage('JUGEMENT', 'juge-de-source'), redaction: etage('RÉDACTION', 'redacteur') }
}

/**
 * Analyse de forme d'un script de workflow. PUR.
 * @param {string} calibrage le texte de `.claude/skills/orchestrer-des-agents/calibrage.md`
 * @param {Map<string, { model?: string, effort?: string }>} fiches `fichesDAgent`
 * @returns {{ defauts: { regle: string, message: string }[], declarees: Set<string>, deSites: Set<string>, sites: number }}
 *   `deSites` = les phases d'au moins un SITE `agent(` — un `phase(…)` de progression n'en est pas un
 */
export function analyser(source, fichier, tables = TABLES, calibrage, fiches) {
  const ts = typescript()
  const ETAGES = etagesDe(fiches)
  /** Les types déclarés sous `.claude/agents/` (`name:` du frontmatter). */
  const TYPES_DECLARES = new Set(fiches.keys())
  /** Les couples du calibrage permis en phase MÉCANIQUE : tous, sauf ceux d'un étage de `ETAGES`. */
  const COUPLES_MECANIQUES = couplesDuCalibrage(calibrage).filter((c) => !Object.values(ETAGES).some((e) => e.type === c.type && e.modele === c.modele))
  /** La couche DÉPÔT de `defautsDesSitesDAgent` pour `fichier` : l'étage de chaque phase déclarée
   *  (`null` pour un régime inconnu, que `defautsDesTables` nomme), sinon le régime MÉCANIQUE. PUR. */
  const regimesDe = (fichier, tables) => ({
    phases: Object.fromEntries(Object.entries(tables.regimes[fichier] ?? {}).map(([phase, regime]) => [phase, Object.hasOwn(ETAGES, regime) ? ETAGES[regime] : null])),
    mecanique: { types: TYPES_MECANIQUES, couples: COUPLES_MECANIQUES, exceptions: tables.exceptions.filter((e) => e.fichier === fichier) },
  });
  const { sourceFile: sf, diagnostics } = analyserTexte({ rel: fichier, text: String(source) });
  const defauts = [];
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const ligneDePosition = (pos) => sf.getLineAndCharacterOfPosition(Math.min(pos, String(source).length)).line + 1;
  const dire = (regle, n, message) => defauts.push({ regle, message: `${fichier}:${n ? ligne(n) : 0} — ${message}` });
  const phasesDeclarees = [];
  const phasesEmployees = new Set();
  const phasesDesSites = new Set();
  let sites = 0;
  const rendre = () => ({ defauts, declarees: new Set(phasesDeclarees), deSites: phasesDesSites, sites });

  // ── SYNTAXE ──────────────────────────────────────────────────────────────────────
  for (const d of diagnostics) {
    defauts.push({ regle: 'syntaxe', message: `${fichier}:${ligneDePosition(d.pos)} — ${d.text}` });
  }
  if (diagnostics.length) return rendre(); // un arbre cassé ne se juge pas plus loin

  // ── RECONNAISSANCE (A2) ────────────────────────────────────────────────────────────
  for (const message of lireWorkflow(source, fichier).defauts) defauts.push({ regle: 'reconnaissance', message });

  // ── PAR APPEL : options fermées, type déclaré, étage (`defautsDesSitesDAgent`) ─────────────────────
  const sitesDuScript = sitesDAgent(sf);
  defauts.push(...defautsDesSitesDAgent(sf, { typesDeclares: TYPES_DECLARES, regimes: regimesDe(fichier, tables), sites: sitesDuScript }));
  const sitesParAppel = new Map(sitesDuScript.map((site) => [site.appel, site]));

  // ── `export const meta`, LITTÉRAL ────────────────────────────────────────────────────────────
  const meta = exportDeMeta(sf)?.parent.declarationList.declarations
    .find((d) => ts.isIdentifier(d.name) && d.name.text === 'meta')?.initializer ?? null;
  if (!meta || !ts.isObjectLiteralExpression(meta)) {
    dire('meta', meta, '`export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script');
  } else {
    for (const champ of ['name', 'description']) {
      const p = propriete(meta, champ);
      if (!p || !estTexte(p.initializer)) dire('meta', p ?? meta, `meta.${champ} absent ou non littéral`);
    }
    const phases = propriete(meta, 'phases');
    if (!phases || !ts.isArrayLiteralExpression(phases.initializer)) {
      dire('meta', phases ?? meta, 'meta.phases absent ou non littéral');
    } else {
      for (const el of phases.initializer.elements) {
        const titre = ts.isObjectLiteralExpression(el) ? propriete(el, 'title') : null;
        if (!titre || !estTexte(titre.initializer)) dire('meta', el, 'une phase sans `title` littéral');
        else phasesDeclarees.push(titre.initializer.text);
      }
    }
  }

  // ── Textes : résolution des prompts, puis balayage de TOUT littéral du fichier ───────────────
  /** Déclarations de PREMIER NIVEAU : l'environnement de résolution d'un PROMPT. */
  const constantes = new Map();
  const fonctions = new Map();
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name) fonctions.set(s.name.text, s);
    const decl = ts.isVariableStatement(s) ? s.declarationList.declarations : [];
    for (const d of decl) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) fonctions.set(d.name.text, d.initializer);
      else constantes.set(d.name.text, d.initializer);
    }
  }
  const estTexteur = (n) => Boolean(n) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    || ts.isTemplateExpression(n) || ts.isParenthesizedExpression(n)
    || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken));
  /** L'expression qu'une fonction du fichier REND, quand elle en rend une seule et qu'elle est du texte. */
  function texteRendu(fn) {
    if (!fn) return null;
    if (fn.body && estTexteur(fn.body)) return fn.body; // flèche à corps concis
    const retours = [];
    const chercher = (n) => {
      if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
        if (n !== fn) return; // les fonctions imbriquées ne sont pas le retour de celle-ci
      }
      if (ts.isReturnStatement(n) && n.expression) retours.push(n.expression);
      n.forEachChild(chercher);
    };
    if (fn.body) fn.body.forEachChild(chercher);
    const textuels = retours.filter(estTexteur);
    return textuels.length === 1 ? textuels[0] : null;
  }
  /**
   * Texte d'une expression, et les angles morts DU FICHIER. PUR, borné par `vus` (cycles).
   * Ce qui rend `''` SANS angle mort est une valeur d'EXÉCUTION (paramètre, variable de boucle,
   * `args`, `JSON.stringify(…)`) : la porte ne peut pas la connaître et ne le prétend pas.
   * Est un ANGLE MORT, donc nommé : une déclaration de premier niveau du même fichier dont le texte
   * ne se lit pas (une fonction à plusieurs retours textuels, une constante textuelle circulaire).
   */
  function resoudre(n, vus = new Set()) {
    if (!n) return { texte: '', inconnus: [] };
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return { texte: n.text, inconnus: [] };
    if (ts.isTemplateExpression(n)) {
      let texte = n.head.text;
      const inconnus = [];
      for (const span of n.templateSpans) {
        const r = resoudre(span.expression, vus);
        texte += r.texte + span.literal.text;
        inconnus.push(...r.inconnus);
      }
      return { texte, inconnus };
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const g = resoudre(n.left, vus);
      const d = resoudre(n.right, vus);
      return { texte: g.texte + d.texte, inconnus: [...g.inconnus, ...d.inconnus] };
    }
    if (ts.isParenthesizedExpression(n)) return resoudre(n.expression, vus);
    if (ts.isIdentifier(n)) {
      if (vus.has(n.text)) return { texte: '', inconnus: [] };
      const init = constantes.get(n.text);
      if (!init || !estTexteur(init)) return { texte: '', inconnus: [] };
      const r = resoudre(init, new Set([...vus, n.text]));
      return r.texte || r.inconnus.length
        ? r
        : { texte: '', inconnus: [`${n.text} (constante textuelle de premier niveau non résolue)`] };
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const nom = n.expression.text;
      if (vus.has(nom) || !fonctions.has(nom)) return { texte: '', inconnus: [] };
      const rendu = texteRendu(fonctions.get(nom));
      if (!rendu) return { texte: '', inconnus: [`${nom}() (fonction du fichier dont le texte rendu ne se lit pas)`] };
      return resoudre(rendu, new Set([...vus, nom]));
    }
    return { texte: '', inconnus: [] };
  }

  // ── RACINE du schéma : chaîne résolue par LIAISON (B4), maillons inatteignables (B5) ──────────
  const declarations = declarationsDuFichier(sf);
  /** Identifiants lus EN POSITION DE MAILLON : valeur de `schema:`, ou valeur résolue d'un maillon. */
  const enPositionDeMaillon = new Set();
  /** Les `const` de premier niveau qu'une chaîne racine a résolues. */
  const maillons = new Map();
  /** L'objet littéral auquel `n` se RÉSOUT, ou `null` après avoir nommé le défaut. */
  const objetResolu = (n, quoi, site) => {
    const e = sansParentheses(n);
    if (ts.isObjectLiteralExpression(e)) return e;
    if (ts.isIdentifier(e)) {
      const decls = declarations.get(e.text) ?? [];
      const d = decls.length === 1 ? decls[0].parent : null;
      const init = d && ts.isVariableDeclaration(d) ? sansParentheses(d.initializer) : null;
      const premierNiveau = Boolean(d) && ts.isVariableDeclarationList(d.parent) && Boolean(d.parent.flags & ts.NodeFlags.Const)
        && ts.isVariableStatement(d.parent.parent) && ts.isSourceFile(d.parent.parent.parent);
      if (premierNiveau && init && ts.isObjectLiteralExpression(init)) {
        enPositionDeMaillon.add(e);
        maillons.set(e.text, d);
        return init;
      }
      dire('racine', site, `racine non littérale — ${quoi} : \`${e.text}\` ne se résout pas en \`const\` de premier niveau, UNIQUE, initialisée d’un objet littéral (${decls.length} déclaration(s) du nom)`);
      return null;
    }
    dire('racine', site, `racine non littérale — ${quoi} : ${ts.SyntaxKind[e.kind]} \`${apercu(e, sf)}\``);
    return null;
  };
  const objetFerme = (n, quoi, site) => {
    const obj = objetResolu(n, quoi, site);
    if (!obj) return null;
    const { membres, ouvertures } = fermer(obj, sf);
    for (const [noeud, pourquoi] of ouvertures) dire('racine', noeud, `racine non fermée — ${quoi} : ${pourquoi}`);
    return ouvertures.length ? null : membres;
  };
  /** Le SQUELETTE évalué de la racine d'un schéma, jugé par `defautsDeRacine` ; `null` quand un
   *  défaut de résolution est déjà nommé. Rien n'est évalué SOUS une propriété racine, hormis son `type`. */
  const squelette = (n, site) => {
    const racine = objetFerme(n, '`schema`', site);
    if (!racine) return null;
    let complet = true;
    const nonLitteral = (valeur, quoi) => {
      dire('racine', valeur, `racine non littérale — ${quoi} : ${ts.SyntaxKind[sansParentheses(valeur).kind]} \`${apercu(valeur, sf)}\``);
      complet = false;
      return undefined;
    };
    const textes = (valeur, quoi) => {
      const e = sansParentheses(valeur);
      if (estTexte(e)) return e.text;
      if (ts.isArrayLiteralExpression(e) && e.elements.every(estTexte)) return e.elements.map((x) => x.text);
      return nonLitteral(valeur, quoi);
    };
    const sq = {};
    for (const [cle, { valeur }] of racine) {
      const e = sansParentheses(valeur);
      if (cle === 'type') sq.type = textes(valeur, '`type` de la racine');
      else if (cle === 'additionalProperties') {
        if (e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.TrueKeyword) sq.additionalProperties = e.kind === ts.SyntaxKind.TrueKeyword;
        else nonLitteral(valeur, '`additionalProperties`');
      } else if (cle === 'required') {
        if (ts.isArrayLiteralExpression(e) && e.elements.every(estTexte)) sq.required = e.elements.map((x) => x.text);
        else nonLitteral(valeur, '`required`');
      } else if (cle === 'properties') {
        const proprietes = objetFerme(valeur, '`properties`', valeur);
        if (!proprietes) {
          complet = false;
          continue;
        }
        sq.properties = {};
        for (const [nom, membre] of proprietes) {
          const prop = objetFerme(membre.valeur, `propriété racine « ${nom} »`, membre.noeud);
          if (!prop) {
            complet = false;
            continue;
          }
          sq.properties[nom] = {};
          if (prop.has('type')) sq.properties[nom].type = textes(prop.get('type').valeur, `\`type\` de la propriété racine « ${nom} »`);
        }
      } else sq[cle] = true; // clé hors liste : `defautsDeRacine` la nomme, sa valeur n'est pas évaluée
    }
    if (!complet) return null;
    for (const message of defautsDeRacine(sq, `${fichier}:${ligne(site)}`)) defauts.push({ regle: 'racine', message });
    return sq;
  };

  const collecterAcces = (racine, nom, dans) => {
    const marcher = (x) => {
      if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === nom && ts.isIdentifier(x.name)) dans.add(x.name.text);
      x.forEachChild(marcher);
    };
    marcher(racine);
  };
  /** Ce que le script LIT du rendu d'un agent : les accès au paramètre de son `.then`, et ceux de la
   *  constante à laquelle un `await agent(…)` est lié. Un champ hors schéma n'est jamais rendu. */
  const clesLuesDuRendu = (appel) => {
    const lues = new Set();
    const acces = appel.parent;
    if (acces && ts.isPropertyAccessExpression(acces) && ts.isIdentifier(acces.name) && acces.name.text === 'then'
      && acces.parent && ts.isCallExpression(acces.parent)) {
      const rappel = (acces.parent.arguments ?? [])[0];
      if (rappel && (ts.isArrowFunction(rappel) || ts.isFunctionExpression(rappel))) {
        const param = (rappel.parameters ?? [])[0];
        if (param && ts.isIdentifier(param.name) && rappel.body) collecterAcces(rappel.body, param.name.text, lues);
      }
    }
    if (acces && ts.isAwaitExpression(acces) && acces.parent && ts.isVariableDeclaration(acces.parent) && ts.isIdentifier(acces.parent.name)) {
      collecterAcces(sf, acces.parent.name.text, lues);
    }
    return [...lues];
  };
  const alerterRunner = (n, texte, ou) => {
    for (const interdit of RUNNERS_INTERDITS) {
      if (String(texte).includes(interdit)) {
        dire('runner', n, `${ou} porte \`${interdit}\` — aucun agent de workflow ne lance de suite ni de gate`);
      }
    }
  };

  /** Un site `agent(prompt, options)` : prompt résolu, racine du schéma (B4), schéma lu, phase déclarée ;
   *  options et étage : `defautsDesSitesDAgent`. */
  const visiterSite = (n) => {
    sites++;
    const site = sitesParAppel.get(n);
    const resolu = resoudre(site.prompt);
    alerterRunner(site.prompt ?? n, resolu.texte, 'le prompt RÉSOLU');
    for (const inconnu of resolu.inconnus) {
      dire('prompt-non-resolu', site.prompt ?? n, `prompt non résolu : ${inconnu} — la porte ne peut pas lire ce qui part`);
    }
    if (site.membres === null) return;
    const schema = site.membres.get('schema');
    if (!schema) {
      dire('agent', n, '`schema` absent — le rendu d\'un agent de workflow est un OBJET validé, jamais de la prose à interpréter');
    } else {
      const sq = squelette(schema.valeur, schema.noeud); // `null` : défaut de racine déjà nommé
      const requis = sq && Array.isArray(sq.required) ? sq.required : null;
      const lues = clesLuesDuRendu(n);
      if (sq && requis === null) {
        if (lues.length) dire('schema-lu', schema.noeud, `\`schema\` sans \`required\` littéral alors que le script lit \`.${lues.join('`, `.')}\` sur son rendu — un champ hors \`required\` peut ne pas être rendu`);
      } else if (sq) {
        for (const cle of lues.filter((c) => !requis.includes(c))) {
          dire('schema-lu', schema.noeud, `le script lit \`.${cle}\` sur le rendu de cet agent, absent du \`required\` du schéma (${requis.join(', ') || 'aucune clé'}) — un champ hors schéma n'est pas rendu par le harnais`);
        }
      }
    }
    const phase = optionDuSite(site, 'phase');
    if (phase.valeur === null) return;
    phasesEmployees.add(phase.valeur);
    phasesDesSites.add(phase.valeur);
    if (phasesDeclarees.length && !phasesDeclarees.includes(phase.valeur)) {
      dire('phase-declaree', phase.noeud, `phase \`${phase.valeur}\` jamais déclarée dans \`meta.phases\``);
    }
  };

  const visiter = (n) => {
    // Tout TEXTE du fichier, à n'importe quelle profondeur : une consigne portée par un tableau et
    // le corps d'une fonction qui rend un prompt ne passent par aucun site d'appel littéral.
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) alerterRunner(n, n.text, 'un texte du script');
    if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) alerterRunner(n, n.text, 'un texte du script');
    // Horloge et aléa : ils cassent la reprise (`resumeFromRunId`).
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Date' && !(n.arguments ?? []).length) {
      dire('horloge', n, '`new Date()` sans argument — la date vient de `args`, sinon la reprise ne rend pas le même run');
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && ts.isIdentifier(n.name)) {
      const acces = `${n.expression.text}.${n.name.text}`;
      if (acces === 'Date.now' || acces === 'Math.random') {
        dire('horloge', n, `\`${acces}\` — la reprise d'un run doit rendre le même résultat`);
      }
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'phase') {
      const arg = (n.arguments ?? [])[0];
      if (!estTexte(arg)) dire('phase-declaree', n, '`phase(…)` avec un titre non littéral');
      else phasesEmployees.add(arg.text);
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'agent') visiterSite(n);
    n.forEachChild(visiter);
  };
  sf.forEachChild(visiter);

  // B5 — un maillon n'est lu qu'en position de maillon.
  const marcherMaillons = (x) => {
    if (ts.isIdentifier(x) && maillons.has(x.text) && estReference(x) && !enPositionDeMaillon.has(x)) {
      dire('maillon', x, `\`${x.text}\` : maillon de racine atteignable par le code (${ts.SyntaxKind[x.parent.kind]}) — un maillon n'est lu que comme valeur de \`schema:\` ou d'un autre maillon`);
    }
    x.forEachChild(marcherMaillons);
  };
  marcherMaillons(sf);

  for (const titre of phasesDeclarees) {
    if (!phasesEmployees.has(titre)) dire('phase-declaree', meta, `phase \`${titre}\` déclarée dans \`meta.phases\` et jamais employée`);
  }
  return rendre();
}
