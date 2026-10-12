import * as importe4_0 from 'node:path'
import * as importe4_1 from 'node:url'
import * as importe4_2 from '../guards/lib/jouer-workflow.mjs'
import * as importe4_3 from '../../src/lib/tableTotale.ts'
import * as importe4_4 from '../raw/workflow-args.mjs'
export const bancworkflowsjouestestmjs = (() => {
const join = importe4_0.join
const fileURLToPath = importe4_1.fileURLToPath
const jouerWorkflow = importe4_2.jouerWorkflow
const tableTotale = importe4_3.tableTotale
const argsDeDossierDeChapitre = importe4_4.argsDeDossierDeChapitre
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DOSSIER = join(RACINE, '.claude', 'workflows');
const DATE = '2026-09-04';
const ARBRE = '/arbre-jete';
const COMMIT = 'f6e343dc8abf36a9d34cc3fd13de60af3d9ac894';
const jouer = (nomDuScript, argsDuRun, repondre) => jouerWorkflow(join(DOSSIER, nomDuScript), argsDuRun, repondre);
const SECRET = 'SECRET-DU-MJ-QUE-LES-JOUEURS-IGNORENT';
const D1 = { id: 'd1', evenement: 'Le PNJ approche la table des PJ', condition: 'les PJ l’ignorent une demi-heure', ref: ['EDO 01 l.200'] };
const DOSSIER_DU_CHAPITRE = {
  lecture: { date: DATE, commit: COMMIT },
  imperatifs: [{ id: 'imp1', texte: 'le corps doit être trouvé', ref: ['EDO 02 l.34'] }],
  beats: [{ id: 'b1', titre: 'La route', statut: 'obligatoire', preuveDuStatut: 'p', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] }, { id: 'b2', titre: 'Le relais', statut: 'optionnel', preuveDuStatut: 'p', mediasCandidats: ['resume'], ref: ['EDO 01 l.10'] }],
  pointsAuMJ: [], indices: [{ id: 'ind1', texte: 'une plume noire sur le rebord', ref: ['EDO 01 l.6'] }], secrets: [{ id: 'sec1', texte: SECRET, ref: ['EDO 01 l.5'] }], declencheurs: [D1],
  pnj: [{ id: 'pnj1', nom: 'Phillipe', role: 'r', motivation: 'm', ref: ['EDO 01 l.199'] }],
  lieux: [], textes: [], tests: [], rencontres: [], recompenses: [], etats: [], dureeEtDifficulte: [], matiereCompagnons: [],
};
const ARGS_TABLE = {
  livre: 'EDO', chapitre: '01', fichiers: ['Source/chapitre-01.md'], dossier: DOSSIER_DU_CHAPITRE, seed: 'graine', maxEchanges: 3,
  worktree: ARBRE, date: DATE,
};
const FICHES_PJ = {
  pjs: ['pregen-101', 'pregen-202', 'pregen-707', 'pregen-303'].map((id) => ({ id, nom: id, espece: 'humain', carriere: 'c', fiche: `fiche de ${id}` })),
  groupe: { source: 'makeShowcaseParty', commande: 'npx tsx sonde.mts' },
};
const SANS_SOSIE = { id: '', ref: '', motif: 'aucun passage du chapitre ne fait ressembler un PJ à un PNJ' };
const jetsDe = (premier, n) => Array.from({ length: n }, (_, i) => ({
  tirage: premier + i, objet: 'o', commande: `npx tsx scripts/ops/table-des.mts simple --seed "graine" --tirage ${premier + i}`, sortie: '{}',
}));
const jsonEntre = (prompt, debut, fin) => JSON.parse(prompt.slice(prompt.indexOf(debut) + debut.length, prompt.indexOf(fin)));
const declencheursEnvoyes = (prompt) => jsonEntre(prompt, 'DÉCLENCHEURS NON JOUÉS OU ÉCARTÉS :\n', '\n\nRends :');
const analyseCouvrante = (classeDe = () => 'prevu', besoins = [], retouche = (a) => a) => (prompt, opts) => {
  const { intentions, declencheurs } = opts.schema.properties;
  const refDe = new Map(declencheursEnvoyes(prompt).map((d) => [d.id, d.ref[0]]));
  return retouche({
    intentions: tableTotale(intentions.required, (numero) => tableTotale(intentions.properties[numero].required, (persona) => ({ classe: classeDe(persona, Number(numero)), ref: '', categorie: '' }))),
    tempsMorts: [], pistesRatees: [],
    declencheurs: tableTotale(declencheurs.required, (id) => ({ manque: false, constat: 'c', ref: refDe.get(id) })),
    fuites: [], besoins, synthese: { markdown: 's' },
  });
};
const repondreALaTable = (mjDe, analyseDe = analyseCouvrante(), fichesPJ = FICHES_PJ, sosie = SANS_SOSIE) => (prompt, opts) => {
  if (opts.phase === 'Préparation') return opts.label === 'fiches-pj' ? fichesPJ : { sosie };
  if (opts.phase === 'Analyse') return analyseDe(prompt, opts);
  if (opts.label.startsWith('mj:')) {
    const premier = Number(prompt.match(/commencent à (\d+)/)[1]);
    return mjDe(Number(opts.label.slice(3)), premier, opts.schema);
  }
  return { jeu: { intention: `intention de ${opts.label}`, notes: `notes de ${opts.label}` } };
};
const jouerTable = (mjDe, analyseDe = analyseCouvrante(), argsDuRun = ARGS_TABLE, fichesPJ = FICHES_PJ, sosie = SANS_SOSIE) => jouer('table-simulee.js', argsDuRun, repondreALaTable(mjDe, analyseDe, fichesPJ, sosie));
const RESOLUTION = { source: 'IMPRO', ref: '', categorie: 'hors-livre', resolution: 'r' };
const pjsExiges = (schema) => schema.properties.resolutions.required;
const declencheursExiges = (schema) => schema.properties.tour.properties.declencheurs.required;
const mjSansFin = (numero, premier, schema) => ({
  resolutions: tableTotale(pjsExiges(schema), () => RESOLUTION),
  jets: jetsDe(premier, 2),
  tour: { narration: `narration ${numero}`, etatPrive: 'état', beat: 'b1', declencheurs: tableTotale(declencheursExiges(schema), () => ({ statut: 'non-echu', motif: 'la demi-heure court' })) },
  fin: false,
});
const mjAuxSorts = (sortDe) => (numero, premier, schema) => {
  const mj = mjSansFin(numero, premier, schema);
  return { ...mj, tour: { ...mj.tour, declencheurs: tableTotale(declencheursExiges(schema), (id) => sortDe(numero, id)) } };
};
const analyseSignal = (classes = []) => analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu'), classes);
const fichierDeFixture = (abbr, nn) => `Source/${abbr}-${nn}.md`;
const argsDossier = (compagnons = []) => argsDeDossierDeChapitre('EDO', '01', { worktree: ARBRE, date: DATE, commit: COMMIT, compagnons, fichierDe: fichierDeFixture });
const ARGS_DOSSIER = argsDossier();
const { id: _idDeD1, ...ENTREE_D1 } = D1;
const ENTREE_BEAT = { titre: 't', statut: 'obligatoire', preuveDuStatut: 'p', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] };
const LECTURES = {
  'imperatifs-et-beats': { imperatifs: [], beats: [ENTREE_BEAT], pointsAuMJ: [], indices: [{ texte: 'la lettre', ref: ['EDO 01 l.3'] }], secrets: [{ texte: 's', ref: ['EDO 01 l.4'] }], declencheurs: [ENTREE_D1] },
  'pnj-lieux-textes': { pnj: [{ nom: 'Kastor', role: 'r', motivation: 'm', ref: ['EDO 01 l.2'] }, { nom: 'Phillipe', role: 'r', motivation: 'm', ref: ['EDO 01 l.199'] }], lieux: [], textes: [] },
  mecanique: { tests: [], rencontres: [], dureeEtDifficulte: [], recompenses: [], etats: [{ texte: 'Kastor est mort', sens: 'lu', portee: 'chapitre', ref: ['EDO 01 l.8'] }] },
  'matiere-compagnons': { matiereCompagnons: [{ texte: 'péage', categorie: 'peage', pourCeChapitre: 'b1', ref: ['EDOC 03 l.4'] }] },
};
const completude = (opts, corrige = {}) => ({
  oublis: { ...tableTotale(opts.schema.properties.oublis.required, () => []), ...corrige.oublis },
  refsFausses: corrige.refsFausses ?? [],
  contenusFaux: corrige.contenusFaux ?? [],
  synthese: { markdown: 's' },
});
const repondreAuDossier = (corrige = {}) => (prompt, opts) => (opts.phase === 'Lecture' ? LECTURES[opts.label] : completude(opts, corrige));
const jouerDossier = (argsDuRun = ARGS_DOSSIER, corrige = {}) => jouer('dossier-de-chapitre.js', argsDuRun, repondreAuDossier(corrige));
const sauf = (repondre, label, rendu = null) => (prompt, opts) => (opts.label === label ? rendu : repondre(prompt, opts));
return { RACINE, DOSSIER, DATE, ARBRE, COMMIT, jouer, SECRET, D1, DOSSIER_DU_CHAPITRE, ARGS_TABLE, FICHES_PJ, SANS_SOSIE, jetsDe, jsonEntre, declencheursEnvoyes, analyseCouvrante, repondreALaTable, jouerTable, RESOLUTION, pjsExiges, declencheursExiges, mjSansFin, mjAuxSorts, analyseSignal, fichierDeFixture, argsDossier, ARGS_DOSSIER, ENTREE_BEAT, LECTURES, completude, repondreAuDossier, jouerDossier, sauf }
})()

import * as importe6_0 from '../guards/lib/dialecte.mjs'
import * as importe6_1 from 'node:assert/strict'
import * as importe6_2 from 'node:fs'
import * as importe6_3 from 'node:path'
import * as importe6_4 from 'node:url'
import * as importe6_5 from '../guards/lib/dialecte.mjs'
import * as importe6_6 from '../guards/lib/formeDeWorkflow.mjs'
export const bancworkflowstestmjs = (() => {
const ast = importe6_0.ast
const assert = importe6_1.default
const readFileSync = importe6_2.readFileSync
const join = importe6_3.join
const fileURLToPath = importe6_4.fileURLToPath
const typescript = importe6_5.typescript
const declarationsDuFichier = importe6_6.declarationsDuFichier
const defautsDeRacine = importe6_6.defautsDeRacine
const estReference = importe6_6.estReference
const exportDeMeta = importe6_6.exportDeMeta
const lireWorkflow = importe6_6.lireWorkflow
const referencesLibres = importe6_6.referencesLibres
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ts = typescript();
const ETAGES = {
  jugement: { nom: 'JUGEMENT', type: 'juge', modele: 'opus', effort: 'high' },
  redaction: { nom: 'RÉDACTION', type: 'lecteur', modele: 'opus', effort: 'medium' },
};
const REGIMES = {
  '.claude/workflows/dossier-de-chapitre.js': { Complétude: 'jugement' },
  '.claude/workflows/table-simulee.js': { Analyse: 'jugement' },
  'scripts/raw/atlas-domain.workflow.js': { Taxonomie: 'redaction', Synthese: 'redaction', Correction: 'redaction', Audit: 'jugement', Verif: 'jugement' },
};
const TYPES_MECANIQUES = ['lecteur', 'verif-mecanique'];
const EXCEPTIONS_MECANIQUES = [
  { fichier: '.claude/workflows/table-simulee.js', phase: 'Partie', type: 'joueur', raison: 'joueurs cloisonnés : un seul outil, ni lecture, ni shell, ni web (`.claude/agents/joueur.md`)' },
];
const couplesDuCalibrage = (skill) => {
  const section = skill.split(/^## /m).find((s) => s.startsWith('Calibrage\n')) ?? '';
  return [...section.matchAll(/^\|[^|\n]*\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm)].map(([, type, modele]) => ({ type, modele }));
};
const COUPLES_MECANIQUES = couplesDuCalibrage(readFileSync(join(RACINE, '.claude/skills/orchestrer-des-agents/SKILL.md'), 'utf8'))
  .filter((c) => !Object.values(ETAGES).some((e) => e.type === c.type && e.modele === c.modele));
const RUNNERS_INTERDITS = ['npm test', 'npm run gates', 'vitest run'];
const TABLES = {
  regimes: REGIMES,
  exceptions: EXCEPTIONS_MECANIQUES,
  /** Liste DÉCROISSANTE : en retirer est libre, en ajouter se justifie au commit. */
  plafond: 1,
  /** Les exceptions NOMMÉES : une entrée qui change de nom se relit au commit. */
  nommees: [
    '.claude/workflows/table-simulee.js / Partie / joueur',
  ],
};
const estTexte = (n) => Boolean(n) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));
const nomDe = (p) => (('name' in p && ts.isIdentifier(p.name)) || ts.isStringLiteral(p.name) ? p.name.text : null);
const propriete = (obj, nom) => obj.properties.find((p) => ts.isPropertyAssignment(p) && nomDe(p) === nom);
const sansParentheses = (n) => (n && ts.isParenthesizedExpression(n) ? sansParentheses(n.expression) : n);
const apercu = (n, sf) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 60);
function fermer(obj, sf) {
  const membres = new Map();
  const ouvertures = [];
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) {
      ouvertures.push([p, ts.isSpreadAssignment(p) ? `spread \`${apercu(p, sf)}\`` : `méthode ou accesseur \`${apercu(p, sf)}\``]);
      continue;
    }
    if (ts.isComputedPropertyName(p.name)) {
      ouvertures.push([p, `clé calculée \`${apercu(p.name, sf)}\``]);
      continue;
    }
    const cle = p.name.text;
    if (cle === '__proto__') ouvertures.push([p, '`__proto__`']);
    else if (membres.has(cle)) ouvertures.push([p, `clé « ${cle} » en double`]);
    else membres.set(cle, { noeud: p, valeur: ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer });
  }
  return { membres, ouvertures };
}
function analyser(source, fichier, tables = TABLES) {
  const sf = ast({ rel: fichier, text: String(source) });
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
  for (const d of sf.parseDiagnostics ?? []) {
    const texte = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    defauts.push({ regle: 'syntaxe', message: `${fichier}:${ligneDePosition(d.start ?? 0)} — ${texte}` });
  }
  if ((sf.parseDiagnostics ?? []).length) return rendre(); // un arbre cassé ne se juge pas plus loin

  // ── RECONNAISSANCE (A2) ────────────────────────────────────────────────────────────
  for (const message of lireWorkflow(source, fichier).defauts) defauts.push({ regle: 'reconnaissance', message });

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

  /** Un site `agent(prompt, options)` : options FERMÉES (B3), racine (B4), régime et effort (B7, B8). */
  const visiterSite = (n) => {
    sites++;
    const [prompt, options] = n.arguments ?? [];
    const resolu = resoudre(prompt);
    alerterRunner(prompt ?? n, resolu.texte, 'le prompt RÉSOLU');
    for (const inconnu of resolu.inconnus) {
      dire('prompt-non-resolu', prompt ?? n, `prompt non résolu : ${inconnu} — la porte ne peut pas lire ce qui part`);
    }
    if (!options || !ts.isObjectLiteralExpression(options)) {
      dire('options', options ?? n, "options de l'agent non littérales — la porte ne peut pas lire son étage");
      return;
    }
    const { membres, ouvertures } = fermer(options, sf);
    for (const [noeud, pourquoi] of ouvertures) dire('options', noeud, `options non fermées : ${pourquoi}`);
    const litteral = (champ) => {
      const m = membres.get(champ);
      if (!m) return { present: false, valeur: null, noeud: options };
      if (!estTexte(m.valeur)) {
        dire('options', m.noeud, `\`${champ}\` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution`);
        return { present: true, valeur: null, noeud: m.noeud };
      }
      return { present: true, valeur: m.valeur.text, noeud: m.noeud };
    };
    const phase = litteral('phase');
    const agentType = litteral('agentType');
    const modele = litteral('model');
    const effort = litteral('effort');
    const lisible = (x) => !(x.present && x.valeur === null); // un non-littéral est déjà nommé
    const vu = (x) => (x.present ? `\`${x.valeur}\`` : 'absent');
    const schema = membres.get('schema');
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
    if (!phase.present) {
      dire('agent', n, '`phase` absente — c\'est la clé STABLE de la porte (le `label` est de l\'affichage)');
      return;
    }
    if (phase.valeur === null) return;
    phasesEmployees.add(phase.valeur);
    phasesDesSites.add(phase.valeur);
    if (phasesDeclarees.length && !phasesDeclarees.includes(phase.valeur)) {
      dire('phase-declaree', phase.noeud, `phase \`${phase.valeur}\` jamais déclarée dans \`meta.phases\``);
    }
    const regimes = tables.regimes[fichier] ?? {};
    const regime = Object.hasOwn(regimes, phase.valeur) ? regimes[phase.valeur] : null;
    if (regime !== null && !Object.hasOwn(ETAGES, regime)) return; // régime inconnu : `defautsDesTables` le nomme
    const etage = regime === null ? null : ETAGES[regime];
    if (etage) {
      if (lisible(agentType) && agentType.valeur !== etage.type) {
        dire('agent', agentType.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`agentType: '${etage.type}'\` exigé (lu : ${vu(agentType)})`);
      }
      if (lisible(modele) && modele.valeur !== etage.modele) {
        dire('agent', modele.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`model: '${etage.modele}'\` exigé AUSSI (lu : ${vu(modele)}) — un sous-agent ne tourne jamais sur le modèle de session`);
      }
      if (lisible(effort) && effort.valeur !== etage.effort) {
        dire('agent', effort.noeud, `phase de ${etage.nom} \`${phase.valeur}\` : \`effort: '${etage.effort}'\` exigé AUSSI (lu : ${vu(effort)})`);
      }
      return;
    }
    if (!effort.present) {
      dire('agent', options, `phase MÉCANIQUE \`${phase.valeur}\` : \`effort\` littéral exigé (lu : absent)`);
    }
    const exceptions = tables.exceptions.filter((e) => e.fichier === fichier && e.phase === phase.valeur);
    const permis = [...TYPES_MECANIQUES, ...exceptions.filter((e) => e.type !== null).map((e) => e.type)];
    const absencePermise = exceptions.some((e) => e.type === null);
    const types = lisible(agentType) && agentType.present && permis.includes(agentType.valeur) ? [agentType.valeur] : permis;
    const modeles = [...new Set(COUPLES_MECANIQUES.filter((c) => types.includes(c.type)).map((c) => c.modele))];
    if (lisible(modele) && !modeles.includes(modele.valeur)) {
      dire('agent', modele.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`model\` littéral parmi ${modeles.join('/')} exigé pour ${types.join('/')} (lu : ${vu(modele)})`);
    }
    if (lisible(agentType) && (agentType.present ? !permis.includes(agentType.valeur) : !absencePermise)) {
      dire('agent', agentType.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`agentType\` littéral parmi ${permis.join('/')} exigé (lu : ${vu(agentType)})`);
    }
  };

  // ── Portée STATIQUE (B1) et identifiant `agent` (B2) ────────────────────────────────────────
  const evalsLibres = new Set(referencesLibres(sf, 'eval'));
  /** `arguments` que seule l'enveloppe lie : aucune fonction NON fléchée ne l'englobe (une flèche n'en a pas). */
  const argumentsDeLEnveloppe = new Set(referencesLibres(sf, 'arguments').filter((id) => {
    for (let a = id.parent; a; a = a.parent) if (ts.isFunctionLikeDeclaration(a) && !ts.isArrowFunction(a)) return false;
    return true;
  }));
  for (const id of declarations.get('agent') ?? []) {
    dire('agent-direct', id, 'déclaration qui lie le nom `agent` — l’identifiant du harnais ne se masque pas');
  }

  const visiter = (n) => {
    // Tout TEXTE du fichier, à n'importe quelle profondeur : une consigne portée par un tableau et
    // le corps d'une fonction qui rend un prompt ne passent par aucun site d'appel littéral.
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) alerterRunner(n, n.text, 'un texte du script');
    if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) alerterRunner(n, n.text, 'un texte du script');
    if (ts.isWithStatement(n)) dire('portee', n, 'instruction `with` — la liaison des noms ne se lit plus à la forme');
    if (ts.isIdentifier(n) && evalsLibres.has(n)) dire('portee', n, '`eval` — du code que la forme ne lit pas');
    if (ts.isIdentifier(n) && argumentsDeLEnveloppe.has(n)) dire('portee', n, '`arguments` — alias des doublures du harnais, que la forme ne lit pas');
    if (ts.isIdentifier(n) && n.text === 'agent' && estReference(n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) {
      dire('agent-direct', n, `\`agent\` non appelé directement (${ts.SyntaxKind[n.parent.kind]}) — seul un appel \`agent(…)\` est un site que la porte lit`);
    }
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
const defautsDuScript = (source, fichier, tables = TABLES) => analyser(source, fichier, tables).defauts;
const TEMOIN = 'temoin-de-forme.workflow.js';
const SOURCE_TEMOIN = `export const meta = {
  name: 'temoin-de-forme',
  description: 'Script témoin des mutations de la porte de forme.',
  phases: [{ title: 'Scout' }, { title: 'Find' }, { title: 'Verify' }, { title: 'Jugement' }],
}

const FINDINGS = {
  type: 'object', additionalProperties: false,
  properties: { findings: { type: 'array', items: { type: 'object' } } },
  required: ['findings'],
}
const VERDICT = {
  type: 'object', additionalProperties: false,
  properties: { isReal: { type: 'boolean' } },
  required: ['isReal'],
}
const LECTURE = {
  type: 'object', additionalProperties: false,
  properties: { citationPresente: { type: 'boolean' } },
  required: ['citationPresente'],
}
const LIST = {
  type: 'object', additionalProperties: false,
  properties: { rawFiles: { type: 'array', items: { type: 'string' } }, docs: { type: 'array', items: { type: 'string' } } },
  required: ['rawFiles', 'docs'],
}

function verifyPrompt(f) {
  return 'La citation ' + f.quote + ' figure-t-elle à ' + f.file + ' ?'
}

const scout = await agent('Liste les fichiers et les docs.',
  { label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'claude-haiku-5-5', effort: 'low' })

const STATS_VIDES = { lots: 0 }
if (!scout) return { verdict: 'ARRÊT', stats: STATS_VIDES }

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const lots = [...chunk(scout.rawFiles, 5), ...chunk(scout.docs, 2)]
const trouvees = await parallel(lots.map((files) => () => agent('Lis ' + files.join(', '),
  { label: 'find', phase: 'Find', schema: FINDINGS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })))
const verdicts = await parallel(trouvees.filter(Boolean).flatMap((r) => r.findings).map((f) => async () => {
  const etiquette = 'verify:' + f.file
  const lue = f.quote
    ? await agent(verifyPrompt(f), { label: etiquette, phase: 'Verify', schema: LECTURE, agentType: 'verif-mecanique', model: 'claude-haiku-5-5', effort: 'low' })
    : null
  return lue && lue.citationPresente
    ? agent('Réfute : ' + f.claim, { label: etiquette, phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'high' })
    : null
}))
return { verdict: 'AUDIT', verdicts, stats: STATS_VIDES }
`;
const TABLES_DU_TEMOIN = { ...TABLES, regimes: { ...REGIMES, [TEMOIN]: { Jugement: 'jugement' } } };
const sansLieu = (m) => m.slice(m.indexOf(' — ') + 3);
const muter = (fichier, ...paires) => {
  const source = fichier === TEMOIN ? SOURCE_TEMOIN : readFileSync(join(RACINE, fichier), 'utf8');
  let mute = source;
  for (let i = 0; i < paires.length; i += 2) {
    assert.ok(mute.includes(paires[i]), `fragment introuvable : ${paires[i]}`);
    mute = mute.replace(paires[i], paires[i + 1]);
  }
  assert.notEqual(mute, source, 'la mutation s’applique — sinon ce test ne prouve rien');
  return mute;
};
const vus = (mute, fichier = TEMOIN) => defautsDuScript(mute, fichier, TABLES_DU_TEMOIN).map((d) => `${d.regle} : ${sansLieu(d.message)}`);
return { RACINE, ts, ETAGES, REGIMES, TYPES_MECANIQUES, EXCEPTIONS_MECANIQUES, couplesDuCalibrage, COUPLES_MECANIQUES, RUNNERS_INTERDITS, TABLES, estTexte, nomDe, propriete, sansParentheses, apercu, fermer, analyser, defautsDuScript, TEMOIN, SOURCE_TEMOIN, TABLES_DU_TEMOIN, sansLieu, muter, vus }
})()
