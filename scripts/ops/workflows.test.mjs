// PORTE DE FORME DES SCRIPTS DE WORKFLOW DU DÉPÔT — reconnus à leur CONTENU par l'AST
// (`lireWorkflow`, scripts/guards/lib/formeDeWorkflow.mjs : `export const meta` de premier niveau),
// jamais à leur dossier. Chaque table ci-dessous se keye sur le chemin RELATIF à la racine.
//
// Un workflow enchaîne des agents sans passer par l'interprétation d'un modèle : ce que le script
// écrit est ce qui part. Les propriétés qui décident du RÉSULTAT — quel type d'agent juge, quel
// modèle et quel effort il porte, dans quelle phase, sous quel schéma, et ce qu'on lui demande de ne
// pas lancer — se lisent donc à la FORME du script, jamais à l'exécution (un run coûte des dizaines
// d'agents).
//
// La porte est keyée sur la `phase` et l'`agentType` LITTÉRAUX, jamais sur le `label` : le label est
// de l'affichage (doctrine id/label du CLAUDE.md), il se renomme sans qu'aucune règle ne bouge.
//
// LA RACINE DU SCHÉMA (invariant : aucune propriété racine d'un schéma passé à `agent()` n'accepte
// une chaîne — run `wf_564ccc33-1bf`, #1993) se juge ICI, seul point qui voit TOUS les sites :
// ce qui DÉCIDE de la racine est un littéral FERMÉ, résolu par LIAISON, inatteignable par le code ;
// tout ce qui vit SOUS une propriété racine est libre. Le squelette résolu est jugé par
// `defautsDeRacine`, la fonction que la doublure (`jouer-workflow.mjs`) applique à l'objet
// sérialisé. Résidu : une mutation d'intrinsèque (`Object.prototype.toJSON`) n'est vue que par
// cette doublure, sur les chemins qu'un banc atteint.
//
// CE QUE LA PORTE VOIT DES PROMPTS (mesuré : le seul texte du site d'appel ne couvrait que 388 des
// 74 000 caractères réels d'un prompt, et aucun de ceux d'un prompt rendu par une fonction) :
//   · la SYNTAXE — `createSourceFile` ne lève jamais : ses `parseDiagnostics` sont lus et rendus
//     (`node --check` refuse ces scripts à cause du `return` de premier niveau, et eslint ignore
//     `.claude/**` : cette porte est le SEUL lecteur de leur syntaxe) ;
//   · le PROMPT RÉSOLU : le littéral du site d'appel, ses `${IDENT}` remplacés par la valeur des
//     constantes de premier niveau du même fichier, récursivement ;
//   · TOUT texte littéral du fichier, à n'importe quelle profondeur — c'est ce qui couvre les
//     consignes portées par un tableau et les prompts rendus par une fonction.
// Restent hors de vue : ce qui vient de `args` à l'exécution, et une chaîne interdite coupée EN DEUX
// par une interpolation. Un identifiant de premier niveau que la résolution n'atteint pas est NOMMÉ
// (`prompt-non-resolu`), jamais passé en silence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scriptKindDe, typescript } from '../guards/lib/dialecte.mjs';
import {
  declarationsDuFichier, defautsDeRacine, estReference, exportDeMeta, lireWorkflow, referencesLibres,
} from '../guards/lib/formeDeWorkflow.mjs';
import { bancsDeWorkflowDuDepot, reconnaissanceDuDepot } from '../guards/lib/jouer-workflow.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const CE_FICHIER = fileURLToPath(import.meta.url);
const ts = typescript();

/** RÉGIMES des phases, déclarés par script et par phase ; une phase absente est MÉCANIQUE. Un
 *  régime porte son type, son modèle et son effort (table de calibrage de
 *  `.claude/skills/orchestrer-des-agents/SKILL.md`). Le type porte les outils (et, pour `juge`, le
 *  prompt adversarial de `.claude/agents/juge.md`) ; le modèle ÉCRIT empêche un sous-agent
 *  d'hériter du modèle de session et fait coïncider l'affichage avec le fait — des agents EN ATTENTE
 *  s'affichaient « Fable » là où les transcripts disaient `claude-opus-5` (observation utilisateur
 *  2026-09-05 ; fiche `user-passage-fable-derives-opus`). Chaque clé est un script reconnu, chaque
 *  phase est déclarée ET portée par un SITE `agent(` (`defautsDesTables`) — un `phase(…)` de
 *  progression n'en est pas un : une phase de jugement renommée ou rétrogradée ne retombe pas en
 *  silence dans le régime MÉCANIQUE. */
const ETAGES = {
  jugement: { nom: 'JUGEMENT', type: 'juge', modele: 'opus', effort: 'medium' },
  redaction: { nom: 'RÉDACTION', type: 'lecteur', modele: 'opus', effort: 'medium' },
};
const REGIMES = {
  '.claude/workflows/dossier-de-chapitre.js': { Complétude: 'jugement' },
  '.claude/workflows/table-simulee.js': { Analyse: 'jugement' },
  'scripts/raw/atlas-domain.workflow.js': { Taxonomie: 'redaction', Synthese: 'redaction', Correction: 'redaction', Audit: 'jugement', Verif: 'jugement' },
};

const TYPES_MECANIQUES = ['lecteur', 'verif-mecanique'];
/** Exceptions des étages MÉCANIQUES, nominatives, avec leur raison : dans UNE phase d'UN script, un
 *  type d'agent permis en plus des mécaniques, ou `type: null` quand `agentType` peut être absent.
 *  Cliquet (`defautsDesTables`) : plafond, liste NOMMÉE, phase déclarée ET portée par un site. */
const EXCEPTIONS_MECANIQUES = [
  { fichier: '.claude/workflows/table-simulee.js', phase: 'Partie', type: 'joueur', raison: 'joueurs cloisonnés : un seul outil, ni lecture, ni shell, ni web (`.claude/agents/joueur.md`)' },
];
const MODELES_MECANIQUES = ['sonnet', 'haiku'];
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
const nomDe = (p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null);
const propriete = (obj, nom) => obj.properties.find((p) => ts.isPropertyAssignment(p) && nomDe(p) === nom);
const sansParentheses = (n) => (n && ts.isParenthesizedExpression(n) ? sansParentheses(n.expression) : n);
const apercu = (n, sf) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 60);

/**
 * Un objet littéral FERMÉ : chaque membre est une affectation ou un raccourci, à clé non calculée,
 * sans doublon, sans `__proto__`. PUR.
 * @returns {{ membres: Map<string, { noeud: any, valeur: any }>, ouvertures: [any, string][] }}
 */
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

/**
 * Analyse de forme d'un script de workflow. PUR.
 * @returns {{ defauts: { regle: string, message: string }[], declarees: Set<string>, deSites: Set<string>, sites: number }}
 *   `deSites` = les phases d'au moins un SITE `agent(` — un `phase(…)` de progression n'en est pas un
 */
function analyser(source, fichier, tables = TABLES) {
  const sf = ts.createSourceFile(fichier, String(source), ts.ScriptTarget.Latest, true, scriptKindDe(fichier));
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
      ts.forEachChild(n, chercher);
    };
    if (fn.body) ts.forEachChild(fn.body, chercher);
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
      ts.forEachChild(x, marcher);
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
    if (lisible(modele) && !MODELES_MECANIQUES.includes(modele.valeur)) {
      dire('agent', modele.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`model\` littéral parmi ${MODELES_MECANIQUES.join('/')} exigé (lu : ${vu(modele)})`);
    }
    if (!effort.present) {
      dire('agent', options, `phase MÉCANIQUE \`${phase.valeur}\` : \`effort\` littéral exigé (lu : absent)`);
    }
    const exceptions = tables.exceptions.filter((e) => e.fichier === fichier && e.phase === phase.valeur);
    const permis = [...TYPES_MECANIQUES, ...exceptions.filter((e) => e.type !== null).map((e) => e.type)];
    const absencePermise = exceptions.some((e) => e.type === null);
    if (lisible(agentType) && (agentType.present ? !permis.includes(agentType.valeur) : !absencePermise)) {
      dire('agent', agentType.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`agentType\` littéral parmi ${permis.join('/')} exigé (lu : ${vu(agentType)})`);
    }
  };

  // ── Portée STATIQUE (B1) et identifiant `agent` (B2) ────────────────────────────────────────
  const evalsLibres = new Set(referencesLibres(sf, 'eval'));
  /** `arguments` que seule l'enveloppe lie : aucune fonction NON fléchée ne l'englobe (une flèche n'en a pas). */
  const argumentsDeLEnveloppe = new Set(referencesLibres(sf, 'arguments').filter((id) => {
    for (let a = id.parent; a; a = a.parent) if (ts.isFunctionLike(a) && !ts.isArrowFunction(a)) return false;
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
    ts.forEachChild(n, visiter);
  };
  ts.forEachChild(sf, visiter);

  // B5 — un maillon n'est lu qu'en position de maillon.
  const marcherMaillons = (x) => {
    if (ts.isIdentifier(x) && maillons.has(x.text) && estReference(x) && !enPositionDeMaillon.has(x)) {
      dire('maillon', x, `\`${x.text}\` : maillon de racine atteignable par le code (${ts.SyntaxKind[x.parent.kind]}) — un maillon n'est lu que comme valeur de \`schema:\` ou d'un autre maillon`);
    }
    ts.forEachChild(x, marcherMaillons);
  };
  marcherMaillons(sf);

  for (const titre of phasesDeclarees) {
    if (!phasesEmployees.has(titre)) dire('phase-declaree', meta, `phase \`${titre}\` déclarée dans \`meta.phases\` et jamais employée`);
  }
  return rendre();
}

/**
 * Défauts de forme d'un script de workflow. PUR.
 * @returns {{ regle: string, message: string }[]}
 */
export const defautsDuScript = (source, fichier, tables = TABLES) => analyser(source, fichier, tables).defauts;

/**
 * Défauts des TABLES de la porte (B7, B8). PUR.
 * @param {typeof TABLES} tables
 * @param {{ scripts: string[], phases: Map<string, { declarees: Set<string>, deSites: Set<string> }>, agentExiste: (type: string) => boolean }} contexte
 * @returns {string[]}
 */
export function defautsDesTables(tables, { scripts, phases, agentExiste }) {
  const defauts = [];
  /** Une phase des tables est déclarée ET portée par au moins un SITE `agent(` : le régime ne vaut que là. */
  const declareeEtDeSite = (ou, fichier, phase) => {
    const p = phases.get(fichier);
    if (!p?.declarees.has(phase)) defauts.push(`${ou} : phase \`${phase}\` jamais déclarée dans \`meta.phases\` de ${fichier}`);
    if (!p?.deSites.has(phase)) defauts.push(`${ou} : phase \`${phase}\` sans aucun site d’agent`);
  };
  for (const fichier of scripts) {
    if (!Object.hasOwn(tables.regimes, fichier)) defauts.push(`REGIMES : script ${fichier} absent — le régime de ses phases se DÉCLARE avant tout dispatch`);
  }
  for (const [fichier, regimes] of Object.entries(tables.regimes)) {
    if (!scripts.includes(fichier)) {
      defauts.push(`REGIMES : clé ${fichier}, qui n’est pas un script de workflow reconnu`);
      continue;
    }
    for (const [phase, regime] of Object.entries(regimes)) {
      if (!Object.hasOwn(ETAGES, regime)) defauts.push(`REGIMES[${fichier}] : phase \`${phase}\` au régime \`${regime}\` inconnu (parmi ${Object.keys(ETAGES).join('/')})`);
      declareeEtDeSite(`REGIMES[${fichier}]`, fichier, phase);
    }
  }
  const noms = tables.exceptions.map((e) => `${e.fichier} / ${e.phase} / ${e.type ?? 'absent'}`);
  if (noms.length > tables.plafond) defauts.push(`EXCEPTIONS_MECANIQUES : ${noms.length} entrées pour ${tables.plafond} au plus — en retirer est libre, en ajouter se justifie au commit`);
  if (JSON.stringify(noms) !== JSON.stringify(tables.nommees)) defauts.push(`EXCEPTIONS_MECANIQUES : ${JSON.stringify(noms)} diffère des exceptions NOMMÉES ${JSON.stringify(tables.nommees)}`);
  for (const e of tables.exceptions) {
    const ou = `EXCEPTIONS_MECANIQUES[${e.fichier} / ${e.phase}]`;
    if (!scripts.includes(e.fichier)) {
      defauts.push(`${ou} : ${e.fichier} n’est pas un script de workflow reconnu`);
      continue;
    }
    declareeEtDeSite(ou, e.fichier, e.phase);
    if (String(e.raison ?? '').length < 20) defauts.push(`${ou} : raison de moins de 20 caractères`);
    if (e.type !== null && !agentExiste(e.type)) defauts.push(`${ou} : type \`${e.type}\` sans \`.claude/agents/${e.type}.md\``);
  }
  return defauts;
}

/**
 * B9 — les scripts qu'aucun banc ne NOMME : le nom de fichier d'un script doit être le dernier
 * segment d'un littéral de chaîne d'un fichier de test qui importe `jouer-workflow.mjs`. PUR,
 * STATIQUE — aucun processus fils, indépendant de l'ordre des tests.
 * @param {string[]} scripts chemins RELATIFS
 * @param {{ fichier: string, source: string }[]} bancs
 * @returns {string[]}
 */
export function scriptsSansBanc(scripts, bancs) {
  const nommes = new Set();
  for (const { fichier, source } of bancs) {
    const sf = ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true, scriptKindDe(fichier));
    const marcher = (n) => {
      if (estTexte(n)) nommes.add(n.text.split(/[\\/]/).pop());
      ts.forEachChild(n, marcher);
    };
    marcher(sf);
  }
  return scripts.filter((s) => !nommes.has(s.split('/').pop()));
}

const relatif = (f) => relative(RACINE, f).split(sep).join('/');
const reconnaissance = reconnaissanceDuDepot(RACINE);
/** Chemins RELATIFS (séparateur `/`) des scripts de workflow du dépôt. */
const scripts = reconnaissance.scripts.map(relatif);
const sources = new Map(scripts.map((f) => [f, readFileSync(join(RACINE, f), 'utf8')]));
const analyses = new Map([...sources].map(([f, s]) => [f, analyser(s, f)]));
const parRegle = (regle) => [...analyses.values()].flatMap((a) => a.defauts).filter((d) => d.regle === regle).map((d) => d.message);
const contexteReel = (phases = analyses) => ({
  scripts,
  phases,
  agentExiste: (type) => existsSync(join(RACINE, '.claude', 'agents', `${type}.md`)),
});
/** Les bancs du dépôt, hors CETTE porte (ses tables nomment chaque script). */
const bancs = bancsDeWorkflowDuDepot(RACINE).filter((f) => f !== CE_FICHIER).map((f) => ({ fichier: relatif(f), source: readFileSync(f, 'utf8') }));

test('il y a des workflows à juger (sinon la porte est verte pour rien)', () => {
  assert.ok(scripts.length > 0, 'aucun script de workflow au dépôt');
  assert.ok(scripts.includes('scripts/raw/atlas-domain.workflow.js'), 'un workflow HORS de .claude/workflows/ est jugé');
});

test('la reconnaissance ne laisse ni `meta` sans `agent` libre, ni `agent` libre sans `meta`', () => {
  assert.deepEqual(reconnaissance.defauts, []);
});

test('chaque script PARSE : les diagnostics du parseur sont des défauts', () => {
  assert.deepEqual(parRegle('syntaxe'), []);
});

test('`export const meta` est un littéral porteur de name/description/phases', () => {
  assert.deepEqual(parRegle('meta'), []);
});

test('aucune horloge ni aléa : la reprise d’un run rend le même résultat', () => {
  assert.deepEqual(parRegle('horloge'), []);
});

test('portée STATIQUE : ni `with`, ni `eval`, ni l’`arguments` de l’enveloppe', () => {
  assert.deepEqual(parRegle('portee'), []);
});

test('`agent` n’est que le callee direct d’un appel, et aucune déclaration ne le lie', () => {
  assert.deepEqual(parRegle('agent-direct'), []);
});

test('les options de chaque agent sont un objet littéral FERMÉ, à étage littéral', () => {
  assert.deepEqual(parRegle('options'), []);
});

test('chaque agent déclare son étage : phase, schéma, type, modèle et effort', () => {
  assert.deepEqual(parRegle('agent'), []);
});

test('la RACINE de chaque schéma se résout en littéral fermé, et aucune propriété racine n’accepte une chaîne', () => {
  assert.deepEqual(parRegle('racine'), []);
});

test('aucun maillon de racine n’est atteignable par le code', () => {
  assert.deepEqual(parRegle('maillon'), []);
});

test('chaque clé lue sur le rendu d’un agent est EXIGÉE par le schéma de cet agent', () => {
  assert.deepEqual(parRegle('schema-lu'), []);
});

test('les phases employées et les phases déclarées se répondent', () => {
  assert.deepEqual(parRegle('phase-declaree'), []);
});

test('aucun prompt ne lance de suite ni de gate du dépôt', () => {
  assert.deepEqual(parRegle('runner'), []);
});

test('chaque prompt se RÉSOUT dans son fichier (aucun angle mort tu)', () => {
  assert.deepEqual(parRegle('prompt-non-resolu'), []);
});

test('REGIMES et EXCEPTIONS_MECANIQUES tiennent : scripts reconnus, phases déclarées ET portées par un site, cliquet nominatif', () => {
  assert.deepEqual(defautsDesTables(TABLES, contexteReel()), []);
});

test('COUVERTURE : chaque script de workflow reconnu est nommé par un banc', () => {
  assert.ok(bancs.length > 0, 'aucun banc au dépôt');
  assert.deepEqual(scriptsSansBanc(scripts, bancs), [], 'workflow sans banc : écris-le avant de livrer le script');
});

// ── MUTATIONS : chaque règle MORD, message exact ────────────────────────────────────────────
/** Script TÉMOIN, base des mutations de forme : quatre phases (Scout, Find et Verify MÉCANIQUES,
 *  Jugement au régime de jugement), quatre schémas maillons, un prompt rendu par une fonction. */
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
  { label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'haiku', effort: 'low' })

const STATS_VIDES = { lots: 0 }
if (!scout) return { verdict: 'ARRÊT', stats: STATS_VIDES }

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const lots = [...chunk(scout.rawFiles, 5), ...chunk(scout.docs, 2)]
const trouvees = await parallel(lots.map((files) => () => agent('Lis ' + files.join(', '),
  { label: 'find', phase: 'Find', schema: FINDINGS, agentType: 'lecteur', model: 'sonnet', effort: 'medium' })))
const verdicts = await parallel(trouvees.filter(Boolean).flatMap((r) => r.findings).map((f) => async () => {
  const etiquette = 'verify:' + f.file
  const lue = f.quote
    ? await agent(verifyPrompt(f), { label: etiquette, phase: 'Verify', schema: LECTURE, agentType: 'verif-mecanique', model: 'haiku', effort: 'low' })
    : null
  return lue && lue.citationPresente
    ? agent('Réfute : ' + f.claim, { label: etiquette, phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'medium' })
    : null
}))
return { verdict: 'AUDIT', verdicts, stats: STATS_VIDES }
`;
/** Les tables de la porte, et le régime du TÉMOIN. */
const TABLES_DU_TEMOIN = { ...TABLES, regimes: { ...REGIMES, [TEMOIN]: { Jugement: 'jugement' } } };
const sansLieu = (m) => m.slice(m.indexOf(' — ') + 3);
/** Applique des remplacements au source ; un fragment introuvable = un test qui ne prouve rien. */
const muter = (fichier, ...paires) => {
  const source = fichier === TEMOIN ? SOURCE_TEMOIN : sources.get(fichier);
  let mute = source;
  for (let i = 0; i < paires.length; i += 2) {
    assert.ok(mute.includes(paires[i]), `fragment introuvable : ${paires[i]}`);
    mute = mute.replace(paires[i], paires[i + 1]);
  }
  assert.notEqual(mute, source, 'la mutation s’applique — sinon ce test ne prouve rien');
  return mute;
};
const vus = (mute, fichier = TEMOIN) => defautsDuScript(mute, fichier, TABLES_DU_TEMOIN).map((d) => `${d.regle} : ${sansLieu(d.message)}`);
const LIST_TYPE = "const LIST = {\n  type: 'object', additionalProperties: false,";
const LIST_DOCS = "docs: { type: 'array', items: { type: 'string' } } },";
const LIST_REQUIS = "  required: ['rawFiles', 'docs'],\n}";
const SCOUT = "{ label: 'scout', phase: 'Scout', schema: LIST,";
const STATS = 'const STATS_VIDES = ';
const JUGEMENT = "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'medium' }";
const NON_UNIQUE = (n) => `racine : racine non littérale — \`schema\` : \`LIST\` ne se résout pas en \`const\` de premier niveau, UNIQUE, initialisée d’un objet littéral (${n} déclaration(s) du nom)`;
const ATTEIGNABLE = (parent) => `maillon : \`LIST\` : maillon de racine atteignable par le code (${parent}) — un maillon n'est lu que comme valeur de \`schema:\` ou d'un autre maillon`;
const NON_DIRECT = (parent) => `agent-direct : \`agent\` non appelé directement (${parent}) — seul un appel \`agent(…)\` est un site que la porte lit`;
const NON_EMPLOYEE = (phase) => `phase-declaree : phase \`${phase}\` déclarée dans \`meta.phases\` et jamais employée`;

test('témoin : le script témoin, base des mutations, ne porte aucun défaut', () => {
  assert.deepEqual(vus(SOURCE_TEMOIN), []);
});

test('a01 — un paramètre qui OMBRE un maillon : la racine ne se résout plus', () => {
  assert.deepEqual(vus(muter(TEMOIN, 'function verifyPrompt(f) {', 'function verifyPrompt(f, LIST) {')), [NON_UNIQUE(2)]);
});

test('a02 — `for (const S …)` qui ombre un maillon : la racine ne se résout plus', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `for (const LIST of []) log(LIST)\n${STATS}`)), [NON_UNIQUE(2)]);
});

test('a03 — `const lire = agent` : agent non appelé directement', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const lire = agent\n${STATS}`)), [NON_DIRECT('VariableDeclaration')]);
});

test('a04 — `agent.call(…)` : agent non appelé directement', () => {
  const mute = muter(TEMOIN, "? await agent(verifyPrompt(f), { label: etiquette, phase: 'Verify'", "? await agent.call(null, verifyPrompt(f), { label: etiquette, phase: 'Verify'");
  assert.deepEqual(vus(mute), [
    NON_DIRECT('PropertyAccessExpression'),
    NON_EMPLOYEE('Verify'),
  ]);
});

test('a05 — `agent` passé en argument : agent non appelé directement', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `log(agent)\n${STATS}`)), [NON_DIRECT('CallExpression')]);
});

test('a06 — `{ agent }.agent(…)` : le raccourci lit `agent` sans l’appeler', () => {
  const mute = muter(TEMOIN, 'const scout = await agent(', 'const scout = await { agent }.agent(');
  assert.deepEqual(vus(mute), [NON_DIRECT('ShorthandPropertyAssignment'), NON_EMPLOYEE('Scout')]);
});

test('une déclaration qui lie le nom `agent` est un défaut', () => {
  const mute = muter(TEMOIN, 'function chunk(arr, n) {', 'function chunk(arr, n, agent) {');
  assert.deepEqual(vus(mute), ['agent-direct : déclaration qui lie le nom `agent` — l’identifiant du harnais ne se masque pas']);
});

test('a07 — un spread dans les options : options non fermées', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, `${SCOUT} ...SURCHARGE,`)), ['options : options non fermées : spread `...SURCHARGE`']);
});

test('a08 — `schema` en double dans les options : options non fermées', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, `${SCOUT} schema: FINDINGS,`)), [
    'options : options non fermées : clé « schema » en double',
    "maillon : `FINDINGS` : maillon de racine atteignable par le code (PropertyAssignment) — un maillon n'est lu que comme valeur de `schema:` ou d'un autre maillon",
  ]);
});

test('a09 — `type: T` puis `T.push(…)` : le `type` d’une propriété racine n’est pas littéral', () => {
  const mute = muter(TEMOIN, LIST_TYPE, `const T = ['array']\nT.push('string')\n${LIST_TYPE}`, LIST_DOCS, "docs: { type: T, items: { type: 'string' } } },");
  assert.deepEqual(vus(mute), ['racine : racine non littérale — `type` de la propriété racine « docs » : Identifier `T`']);
});

test('a10 — un alias `P = S.properties` : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const P = LIST.properties\nP.t = { type: 'string' }\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a11 — une mutation par paramètre : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const ajouter = (o) => { o.t = { type: 'string' } }\najouter(LIST.properties)\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a12 — `Reflect.set(S.properties, …)` : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `Reflect.set(LIST.properties, 't', { type: 'string' })\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a13 — `with` : portée non statique', () => {
  const mute = muter(TEMOIN, STATS, `with (LIST.properties) { t = { type: 'string' } }\n${STATS}`);
  assert.deepEqual(vus(mute), ['portee : instruction `with` — la liaison des noms ne se lit plus à la forme', ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a14 — `eval` : portée non statique', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `eval("LIST.properties.t = { type: 'string' }")\n${STATS}`)), ['portee : `eval` — du code que la forme ne lit pas']);
});

test('a15 — `__proto__` en raccourci dans `properties` : racine non fermée', () => {
  const mute = muter(TEMOIN, 'properties: { rawFiles:', 'properties: { __proto__, rawFiles:');
  assert.deepEqual(vus(mute), ['racine : racine non fermée — `properties` : `__proto__`']);
});

test('a16 — `properties` en double à la racine : racine non fermée', () => {
  const mute = muter(TEMOIN, LIST_REQUIS, "  required: ['rawFiles', 'docs'],\n  properties: { t: { type: 'string' } },\n}");
  assert.deepEqual(vus(mute), ['racine : racine non fermée — `schema` : clé « properties » en double']);
});

test('a18 — `agent` sans `export const meta` : défaut de reconnaissance', () => {
  const mute = muter(TEMOIN, 'export const meta', 'const meta');
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('a19 — `export { meta }` n’est pas `export const meta` de premier niveau', () => {
  const mute = `${muter(TEMOIN, 'export const meta', 'const meta')}\nexport { meta }\n`;
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('a20 — BOM, `export const meta` indenté et `agent (` : reconnu, sans défaut', () => {
  const mute = `\uFEFF  ${muter(TEMOIN, 'const scout = await agent(', 'const scout = await agent (')}`;
  const lu = lireWorkflow(mute, TEMOIN);
  assert.equal(lu.script, true);
  assert.equal(mute.slice(lu.exportDeMeta, lu.exportDeMeta + 'export const meta'.length), 'export const meta');
  assert.deepEqual(vus(mute), []);
});

test('a21 — `arguments`, lié à l’enveloppe, est un alias de `agent` : portée non statique', () => {
  const site = "await lire('p', { label: 'x', phase: 'Scout', schema: { type: 'object', additionalProperties: false, properties: { t: { type: 'string' } }, required: ['t'] }, agentType: 'verif-mecanique', model: 'haiku', effort: 'low' })";
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const lire = arguments[0]\n${site}\n${STATS}`)), [
    'portee : `arguments` — alias des doublures du harnais, que la forme ne lit pas',
  ]);
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const aussi = () => arguments.length\n${STATS}`)), [
    'portee : `arguments` — alias des doublures du harnais, que la forme ne lit pas',
  ], 'une flèche n’a pas d’`arguments` propre');
  assert.deepEqual(vus(muter(TEMOIN, STATS, `function compte() { return (() => arguments.length)() }\n${STATS}`)), [], 'témoin : l’`arguments` d’une fonction non fléchée est le sien');
});

test('a22 — `export let meta` n’est pas `export const meta` : UN lecteur de `meta`, les deux défauts tombent', () => {
  const mute = muter(TEMOIN, 'export const meta', 'export let meta');
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('RACINE : sans `additionalProperties: false`, défaut nommé', () => {
  const mute = muter(TEMOIN, LIST_TYPE, "const LIST = {\n  type: 'object',");
  assert.deepEqual(vus(mute), ['racine : `additionalProperties: false` exigé à la racine (lu : absent)']);
});

test('RACINE : une clé hors liste ($ref, allOf, patternProperties, $defs), un défaut nommé chacune', () => {
  for (const cle of ['$ref', 'allOf', 'patternProperties', '$defs']) {
    const mute = muter(TEMOIN, LIST_REQUIS, `  required: ['rawFiles', 'docs'],\n  '${cle}': {},\n}`);
    assert.deepEqual(vus(mute), [`racine : clé de racine « ${cle} » hors de type/properties/required/additionalProperties`], cle);
  }
});

test('RACINE : une propriété racine sans `type`, puis à `type: [\'object\', \'string\']`', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_DOCS, "docs: { items: { type: 'string' } } },")), ['racine : propriété racine « docs » sans `type`']);
  assert.deepEqual(
    vus(muter(TEMOIN, LIST_DOCS, "docs: { type: ['object', 'string'], items: { type: 'string' } } },")),
    ['racine : propriété racine « docs » accepte une chaîne (`type` : ["object","string"])'],
  );
});

test('RACINE : `schema: args.x` et `schema: f()` ne se résolvent pas', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, "{ label: 'scout', phase: 'Scout', schema: args.x,")), ['racine : racine non littérale — `schema` : PropertyAccessExpression `args.x`']);
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, "{ label: 'scout', phase: 'Scout', schema: f(),")), ['racine : racine non littérale — `schema` : CallExpression `f()`']);
});

test('schema-lu : une racine résolue SANS `required` est un défaut quand le script lit son rendu', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_REQUIS, '}')), [
    'schema-lu : `schema` sans `required` littéral alors que le script lit `.rawFiles`, `.docs` sur son rendu — un champ hors `required` peut ne pas être rendu',
  ]);
});

test('RACINE : un conteneur de type CHAMPS qui référence un maillon le rend atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const CHAMPS = [{ champ: 'docs', schema: LIST }]\n${STATS}`)), [ATTEIGNABLE('PropertyAssignment')]);
});

test('témoins : spread et `Object.fromEntries` SOUS une propriété racine, maillon EN propriété racine', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_TYPE, `const AUTRES = ['b']\n${LIST_TYPE}`, LIST_DOCS, "docs: { type: 'array', items: { type: 'string', enum: ['a', ...AUTRES] } } },")), []);
  assert.deepEqual(vus(muter(TEMOIN, LIST_DOCS, "docs: { type: 'array', items: { type: 'object', properties: Object.fromEntries(['a'].map((k) => [k, { type: 'string' }])) } } },")), []);
  assert.deepEqual(vus(muter(TEMOIN, LIST_TYPE, `const DOCS = { type: 'array', items: { type: 'string' } }\n${LIST_TYPE}`, LIST_DOCS, 'docs: DOCS },')), []);
});

test('la porte MORD quand le schéma cesse d’exiger la clé que le script lit', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_REQUIS, "  required: ['rawFiles'],\n}")), [
    "schema-lu : le script lit `.docs` sur le rendu de cet agent, absent du `required` du schéma (rawFiles) — un champ hors schéma n'est pas rendu par le harnais",
  ]);
});

test('la porte MORD quand une phase de RÉDACTION part sur un autre type ou un autre modèle', () => {
  const fichier = 'scripts/raw/atlas-domain.workflow.js';
  const mute = muter(fichier, "phase: 'Synthese', agentType: 'lecteur', model: 'opus'", "phase: 'Synthese', agentType: 'juge', model: 'sonnet'");
  assert.deepEqual(vus(mute, fichier), [
    "agent : phase de RÉDACTION `Synthese` : `agentType: 'lecteur'` exigé (lu : `juge`)",
    "agent : phase de RÉDACTION `Synthese` : `model: 'opus'` exigé AUSSI (lu : `sonnet`) — un sous-agent ne tourne jamais sur le modèle de session",
  ]);
});

test('défaut 28 — l’effort est LITTÉRAL et présent à chaque site, et vaut celui de l’étage', () => {
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: String(args) }")),
    ["options : `effort` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus' }")),
    ["agent : phase de JUGEMENT `Jugement` : `effort: 'medium'` exigé AUSSI (lu : absent)"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'low' }")),
    ["agent : phase de JUGEMENT `Jugement` : `effort: 'medium'` exigé AUSSI (lu : `low`)"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, "{ label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'haiku', effort: 'low' }", "{ label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'haiku' }")),
    ['agent : phase MÉCANIQUE `Scout` : `effort` littéral exigé (lu : absent)'],
  );
});

test('défaut 8 — une phase de JUGEMENT renommée et rétrogradée rougit la porte ; une clé REGIMES orpheline aussi', () => {
  const fichier = '.claude/workflows/dossier-de-chapitre.js';
  const source = sources.get(fichier);
  const mute = source.split('Complétude').join('Relecture')
    .replace(/(phase: 'Relecture'[^}]*?)agentType: 'juge', model: 'opus'/, "$1agentType: 'lecteur', model: 'sonnet'");
  assert.notEqual(mute, source, 'la mutation s’applique — sinon ce test ne prouve rien');
  assert.match(mute, /phase: 'Relecture'[^}]*agentType: 'lecteur', model: 'sonnet'/, 'le site est rétrogradé');
  const phases = new Map([...analyses].map(([f, a]) => [f, f === fichier ? analyser(mute, f) : a]));
  assert.deepEqual(defautsDesTables(TABLES, contexteReel(phases)), [
    `REGIMES[${fichier}] : phase \`Complétude\` jamais déclarée dans \`meta.phases\` de ${fichier}`,
    `REGIMES[${fichier}] : phase \`Complétude\` sans aucun site d’agent`,
  ]);
  const orpheline = { ...TABLES, regimes: { ...REGIMES, '.claude/workflows/disparu.js': { Jugement: 'jugement' } } };
  assert.deepEqual(defautsDesTables(orpheline, contexteReel()), ['REGIMES : clé .claude/workflows/disparu.js, qui n’est pas un script de workflow reconnu']);
});

test('dossier-de-chapitre : la racine de chaque schéma reste LITTÉRALE, seule la forme d’une entrée vient de `args` — une famille prise dans `args` à la racine rougit la porte', () => {
  const fichier = '.claude/workflows/dossier-de-chapitre.js';
  assert.deepEqual(vus(sources.get(fichier), fichier), [], 'témoin : la source réelle');
  const mute = muter(fichier, "    lieux: { type: 'array', minItems: MINIMA.lieux, items: ENTREES.lieux },", '    lieux: FAMILLES.lieux,');
  assert.deepEqual(vus(mute, fichier), ['racine : racine non littérale — propriété racine « lieux » : PropertyAccessExpression `FAMILLES.lieux`']);
});

test('une phase de REGIMES n’est employée que par le `phase:` d’un SITE — un `phase(…)` de progression ne la couvre pas', () => {
  const fichier = 'scripts/raw/atlas-domain.workflow.js';
  const mute = muter(fichier, "phase: 'Audit', agentType: 'juge', model: 'opus'", "phase: 'Cadrage', agentType: 'lecteur', model: 'sonnet'");
  assert.match(mute, /phase\('Audit'\)/, 'la progression `phase(\'Audit\')` reste');
  assert.deepEqual(vus(mute, fichier), [], 'le site rétrogradé a une forme MÉCANIQUE permise : seule la table le voit');
  const phases = new Map([...analyses].map(([f, a]) => [f, f === fichier ? analyser(mute, f) : a]));
  assert.deepEqual(defautsDesTables(TABLES, contexteReel(phases)), [`REGIMES[${fichier}] : phase \`Audit\` sans aucun site d’agent`]);
});

test('défaut 29 — EXCEPTIONS_MECANIQUES : plafond, liste nommée, phase déclarée ET portée par un site', () => {
  const table = '.claude/workflows/table-simulee.js';
  const deTrop = { fichier: table, phase: 'Préparation', type: 'lecteur', raison: 'une exception de trop, jamais relue au commit' };
  const auDela = { ...TABLES, exceptions: [...EXCEPTIONS_MECANIQUES, deTrop] };
  assert.deepEqual(defautsDesTables(auDela, contexteReel()), [
    `EXCEPTIONS_MECANIQUES : ${EXCEPTIONS_MECANIQUES.length + 1} entrées pour ${TABLES.plafond} au plus — en retirer est libre, en ajouter se justifie au commit`,
    `EXCEPTIONS_MECANIQUES : ${JSON.stringify([...TABLES.nommees, `${table} / Préparation / lecteur`])} diffère des exceptions NOMMÉES ${JSON.stringify(TABLES.nommees)}`,
  ]);
  const renommee = { ...TABLES, exceptions: EXCEPTIONS_MECANIQUES.map((e) => (e.phase === 'Partie' ? { ...e, phase: 'Jeu' } : e)) };
  assert.deepEqual(defautsDesTables(renommee, contexteReel()), [
    `EXCEPTIONS_MECANIQUES : ${JSON.stringify(TABLES.nommees.map((n) => n.replace(`${table} / Partie /`, `${table} / Jeu /`)))} diffère des exceptions NOMMÉES ${JSON.stringify(TABLES.nommees)}`,
    `EXCEPTIONS_MECANIQUES[${table} / Jeu] : phase \`Jeu\` jamais déclarée dans \`meta.phases\` de ${table}`,
    `EXCEPTIONS_MECANIQUES[${table} / Jeu] : phase \`Jeu\` sans aucun site d’agent`,
  ]);
});

test('un type d’EXCEPTION ne vaut que dans la phase qui le déclare', () => {
  const fichier = '.claude/workflows/table-simulee.js';
  const mute = muter(fichier, "phase: 'Préparation', schema: PREPARATION_PJ, agentType: 'lecteur'", "phase: 'Préparation', schema: PREPARATION_PJ, agentType: 'joueur'");
  assert.deepEqual(vus(mute, fichier), ['agent : phase MÉCANIQUE `Préparation` : `agentType` littéral parmi lecteur/verif-mecanique exigé (lu : `joueur`)']);
});

test('B9 — retirer d’un banc le littéral qui nomme un script le laisse SANS banc', () => {
  const banc = bancs.find((b) => b.fichier === 'scripts/ops/workflows-joues.test.mjs');
  assert.ok(banc, 'le banc des workflows de .claude/workflows/');
  const source = banc.source.replaceAll("'table-simulee.js'", "'table' + '-simulee.js'");
  assert.notEqual(source, banc.source, 'la mutation s’applique — sinon ce test ne prouve rien');
  assert.deepEqual(scriptsSansBanc(scripts, bancs.map((b) => (b === banc ? { ...b, source } : b))), ['.claude/workflows/table-simulee.js']);
});
