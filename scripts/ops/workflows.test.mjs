// PORTE DE FORME DES WORKFLOWS SAUVEGARDÉS (`.claude/workflows/*.js`).
//
// Un workflow enchaîne des agents sans passer par l'interprétation d'un modèle : ce que le script
// écrit est ce qui part. Les quatre propriétés qui décident du RÉSULTAT — quel type d'agent juge,
// quel modèle il porte, dans quelle phase, et ce qu'on lui demande de ne pas lancer — se lisent donc
// à la FORME du script, jamais à l'exécution (un run coûte des dizaines d'agents).
//
// La porte est keyée sur la `phase` et l'`agentType` LITTÉRAUX, jamais sur le `label` : le label est
// de l'affichage (doctrine id/label du CLAUDE.md), il se renomme sans qu'aucune règle ne bouge.
//
// CE QUE LA PORTE VOIT, ET COMMENT (mesuré : le seul texte du site d'appel ne couvrait que 388 des
// 74 000 caractères réels d'un prompt, et 0 % de ceux d'`audit-poison.js`, dont les prompts sont
// rendus par des fonctions) :
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
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scriptKindDe } from '../guards/lib/dialecte.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DOSSIER = join(RACINE, '.claude', 'workflows');
const ts = createRequire(import.meta.url)('typescript');

/** Phases de JUGEMENT, déclarées par script : elles portent `agentType: 'juge'` ET `model: 'opus'`,
 *  les DEUX. Le type porte les outils et le prompt adversarial (`.claude/agents/juge.md`) ; le
 *  modèle ÉCRIT empêche un sous-agent d'hériter du modèle de session et fait coïncider l'affichage
 *  avec le fait — des agents EN ATTENTE s'affichaient « Fable » là où les transcripts disaient
 *  `claude-opus-5` (observation utilisateur 2026-09-05).
 *  Un script absent de cette table échoue : le régime se déclare. */
const PHASES_DE_JUGEMENT = {
  'audit-poison.js': [],
  'juge-design-socle.js': ['Design', 'Réfutation'],
  'revue-palier.js': ['Lentilles', 'Réfutation'],
};

/** Étages MÉCANIQUES qui ne portent PAS de type épinglé — nominatif, avec sa raison, décroissant. */
const SANS_TYPE_EPINGLE = [
  { fichier: 'audit-poison.js', phase: 'Scout', raison: 'découverte de fichiers par motif : un audit de texte, pas un jugement de socle' },
  { fichier: 'audit-poison.js', phase: 'Find', raison: 'lecture de lots de fichiers contre le Source : un audit de texte, pas un jugement de socle' },
  { fichier: 'audit-poison.js', phase: 'Verify', raison: "réfutation d'un constat de COMMENTAIRE, pas d'un design de socle" },
];

const TYPES_MECANIQUES = ['lecteur', 'verif-mecanique'];
const MODELES_MECANIQUES = ['sonnet', 'haiku'];
const MODELE_DE_JUGEMENT = 'opus';
const RUNNERS_INTERDITS = ['npm test', 'npm run gates', 'vitest run'];

const scripts = readdirSync(DOSSIER).filter((f) => f.endsWith('.js')).sort();

const estTexte = (n) => Boolean(n) && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));
const nomDe = (p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null);
const propriete = (obj, nom) => obj.properties.find((p) => ts.isPropertyAssignment(p) && nomDe(p) === nom);

/**
 * Défauts de forme d'un script de workflow. PUR.
 * @returns {{ regle: string, message: string }[]}
 */
export function defautsDuScript(source, fichier) {
  const sf = ts.createSourceFile(fichier, String(source), ts.ScriptTarget.Latest, true, scriptKindDe(fichier));
  const defauts = [];
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const ligneDePosition = (pos) => sf.getLineAndCharacterOfPosition(Math.min(pos, String(source).length)).line + 1;
  const dire = (regle, n, message) => defauts.push({ regle, message: `${fichier}:${n ? ligne(n) : 0} — ${message}` });

  // ── SYNTAXE ──────────────────────────────────────────────────────────────────────
  for (const d of sf.parseDiagnostics ?? []) {
    const texte = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    defauts.push({ regle: 'syntaxe', message: `${fichier}:${ligneDePosition(d.start ?? 0)} — ${texte}` });
  }
  if ((sf.parseDiagnostics ?? []).length) return defauts; // un arbre cassé ne se juge pas plus loin

  // ── `export const meta`, LITTÉRAL ────────────────────────────────────────────────────────────
  let meta = null;
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s)) continue;
    if (!(s.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'meta') meta = d.initializer ?? null;
    }
  }
  const phasesDeclarees = [];
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
  /** Déclarations de PREMIER NIVEAU : l'environnement de résolution d'un prompt. */
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
  /** L'objet LITTÉRAL d'un schéma, qu'il soit posé au site d'appel ou nommé par une constante. */
  const objetDuSchema = (n) => {
    if (!n) return null;
    if (ts.isObjectLiteralExpression(n)) return n;
    if (ts.isIdentifier(n)) {
      const init = constantes.get(n.text);
      return init && ts.isObjectLiteralExpression(init) ? init : null;
    }
    return null;
  };
  /** Les clés que le schéma EXIGE à sa racine, ou `null` si la porte ne les lit pas. */
  const requisDuSchema = (n) => {
    const obj = objetDuSchema(n);
    if (!obj) return null;
    const p = propriete(obj, 'required');
    if (!p || !ts.isArrayLiteralExpression(p.initializer)) return null;
    return p.initializer.elements.filter(estTexte).map((e) => e.text);
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

  // ── Horloge et aléa : ils cassent la reprise (`resumeFromRunId`) ─────────────────────────────
  const phasesEmployees = new Set();
  const visiter = (n) => {
    // Tout TEXTE du fichier, à n'importe quelle profondeur : une consigne portée par un tableau et
    // le corps d'une fonction qui rend un prompt ne passent par aucun site d'appel littéral.
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) alerterRunner(n, n.text, 'un texte du script');
    if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) alerterRunner(n, n.text, 'un texte du script');
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
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'agent') {
      const [prompt, options] = n.arguments ?? [];
      const resolu = resoudre(prompt);
      alerterRunner(prompt ?? n, resolu.texte, 'le prompt RÉSOLU');
      for (const inconnu of resolu.inconnus) {
        dire('prompt-non-resolu', prompt ?? n, `prompt non résolu : ${inconnu} — la porte ne peut pas lire ce qui part`);
      }
      if (!options || !ts.isObjectLiteralExpression(options)) {
        dire('agent', n, "les options de l'agent ne sont pas un objet LITTÉRAL — la porte ne peut pas lire son étage");
      } else {
        const litteralOuNull = (champ) => {
          const p = propriete(options, champ);
          if (!p) return { present: false, valeur: null, noeud: options };
          if (!estTexte(p.initializer)) {
            dire('agent', p, `\`${champ}\` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution`);
            return { present: true, valeur: null, noeud: p };
          }
          return { present: true, valeur: p.initializer.text, noeud: p };
        };
        const phase = litteralOuNull('phase');
        const agentType = litteralOuNull('agentType');
        const modele = litteralOuNull('model');
        const schemaProp = propriete(options, 'schema');
        if (!schemaProp) {
          dire('agent', n, '`schema` absent — le rendu d\'un agent de workflow est un OBJET validé, jamais de la prose à interpréter');
        } else {
          const lues = clesLuesDuRendu(n);
          const requis = requisDuSchema(schemaProp.initializer);
          if (requis === null) {
            if (lues.length) dire('schema-lu', schemaProp, `\`schema\` non résolu alors que le script lit \`.${lues.join('`, `.')}\` sur son rendu — la porte ne peut pas confronter les deux`);
          } else {
            for (const cle of lues.filter((c) => !requis.includes(c))) {
              dire('schema-lu', schemaProp, `le script lit \`.${cle}\` sur le rendu de cet agent, absent du \`required\` du schéma (${requis.join(', ') || 'aucune clé'}) — un champ hors schéma n'est pas rendu par le harnais`);
            }
          }
        }
        if (!phase.present) {
          dire('agent', n, '`phase` absente — c\'est la clé STABLE de la porte (le `label` est de l\'affichage)');
        } else if (phase.valeur !== null) {
          phasesEmployees.add(phase.valeur);
          if (phasesDeclarees.length && !phasesDeclarees.includes(phase.valeur)) {
            dire('phase-declaree', phase.noeud, `phase \`${phase.valeur}\` jamais déclarée dans \`meta.phases\``);
          }
          const jugement = PHASES_DE_JUGEMENT[fichier];
          if (!jugement) {
            dire('agent', n, `script absent de PHASES_DE_JUGEMENT (${fichier}) — le régime de ses phases se DÉCLARE avant tout dispatch`);
          } else if (jugement.includes(phase.valeur)) {
            if (agentType.valeur !== 'juge') {
              dire('agent', agentType.noeud, `phase de JUGEMENT \`${phase.valeur}\` : \`agentType: 'juge'\` exigé (lu : ${agentType.present ? `\`${agentType.valeur}\`` : 'absent'})`);
            }
            if (modele.valeur !== MODELE_DE_JUGEMENT) {
              dire('agent', modele.noeud, `phase de JUGEMENT \`${phase.valeur}\` : \`model: '${MODELE_DE_JUGEMENT}'\` exigé AUSSI (lu : ${modele.present ? `\`${modele.valeur}\`` : 'absent'}) — un sous-agent ne tourne jamais sur le modèle de session`);
            }
          } else {
            if (!modele.present || !MODELES_MECANIQUES.includes(modele.valeur)) {
              dire('agent', modele.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`model\` littéral parmi ${MODELES_MECANIQUES.join('/')} exigé (lu : ${modele.present ? `\`${modele.valeur}\`` : 'absent'})`);
            }
            const excuse = SANS_TYPE_EPINGLE.find((e) => e.fichier === fichier && e.phase === phase.valeur);
            if (!excuse && (!agentType.present || !TYPES_MECANIQUES.includes(agentType.valeur))) {
              dire('agent', agentType.noeud, `phase MÉCANIQUE \`${phase.valeur}\` : \`agentType\` littéral parmi ${TYPES_MECANIQUES.join('/')} exigé (lu : ${agentType.present ? `\`${agentType.valeur}\`` : 'absent'})`);
            }
          }
        }
      }
    }
    ts.forEachChild(n, visiter);
  };
  ts.forEachChild(sf, visiter);

  for (const titre of phasesDeclarees) {
    if (!phasesEmployees.has(titre)) dire('phase-declaree', meta, `phase \`${titre}\` déclarée dans \`meta.phases\` et jamais employée`);
  }
  return defauts;
}

const sources = new Map(scripts.map((f) => [f, readFileSync(join(DOSSIER, f), 'utf8')]));
const defauts = new Map([...sources].map(([f, s]) => [f, defautsDuScript(s, f)]));
const parRegle = (regle) => [...defauts.values()].flat().filter((d) => d.regle === regle).map((d) => d.message);

test('il y a des workflows à juger (sinon la porte est verte pour rien)', () => {
  assert.ok(scripts.length > 0, `aucun script dans ${DOSSIER}`);
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

test('chaque agent déclare son étage : options littérales, phase, schéma, type et modèle', () => {
  assert.deepEqual(parRegle('agent'), []);
});

test('chaque clé lue sur le rendu d’un agent est EXIGÉE par le schéma de cet agent', () => {
  assert.deepEqual(parRegle('schema-lu'), []);
});

test('la porte MORD quand le schéma cesse d’exiger la clé que le script lit', () => {
  const source = sources.get('juge-design-socle.js');
  const mute = source.replace("  required: ['verdicts'],", "  required: ['avis'],");
  assert.notEqual(mute, source, 'la mutation s’applique — sinon ce test ne prouve rien');
  const vus = defautsDuScript(mute, 'juge-design-socle.js').filter((d) => d.regle === 'schema-lu');
  assert.equal(vus.length, 1, `défauts vus : ${vus.map((d) => d.message).join(' · ')}`);
  assert.match(vus[0].message, /le script lit `\.verdicts` sur le rendu de cet agent, absent du `required` du schéma \(avis\)/);
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

test('chaque script déclare le régime de ses phases (aucune valeur par défaut silencieuse)', () => {
  const absents = scripts.filter((f) => !PHASES_DE_JUGEMENT[f]);
  assert.deepEqual(absents, [], 'scripts sans entrée dans PHASES_DE_JUGEMENT');
});

test('les étages mécaniques sans type épinglé restent ceux qui sont nommés, avec leur raison', () => {
  for (const e of SANS_TYPE_EPINGLE) {
    assert.ok(sources.has(e.fichier), `exception sur un script disparu : ${e.fichier}`);
    assert.ok(e.raison.length >= 20, `exception sans raison lisible : ${e.fichier} / ${e.phase}`);
  }
  assert.ok(SANS_TYPE_EPINGLE.length <= 3, `liste d’exceptions DÉCROISSANTE : ${SANS_TYPE_EPINGLE.length} entrées pour 3 au plus — en retirer est libre, en ajouter se justifie au commit`);
  assert.deepEqual(
    SANS_TYPE_EPINGLE.map((e) => `${e.fichier} / ${e.phase}`),
    ['audit-poison.js / Scout', 'audit-poison.js / Find', 'audit-poison.js / Verify'],
    'les exceptions sont NOMMÉES : une entrée qui change de nom se relit au commit',
  );
});
