import { Buffer } from 'node:buffer';

import { echapperRegex } from '../../src/lib/regex.ts';

export const GENERATED_PREFIX = '<!-- GENERATED: agents:sync; source=';
const utf8 = new TextDecoder('utf-8', { fatal: true });
const replacements = [
  // L'import `@fichier` est une affordance de Claude Code : Codex n'en a pas, sa surface INJECTE le
  // credo au SessionStart. Traduire le POINTEUR en pointeur (`.codex/credo.md`) rendrait AGENTS.md
  // menteur — on traduit le MÉCANISME. Doit précéder la règle `.claude/credo.md` ci-dessous.
  ['@.claude/credo.md', 'Credo injecté au SessionStart par `.codex/hooks.json` (`inject-project-credo.mjs`).'],
  ['Foundry/CLAUDE.md', 'Foundry/AGENTS.md'],
  ['# CLAUDE.md', '# AGENTS.md'],
  ['CLAUDE.md', 'AGENTS.md'],
  ['Claude Code', 'Codex'],
  ['.claude/credo.md', '.codex/credo.md'],
  ['~/.claude/projects/…/memory', '~/.codex/projects/…/memory'],
  ['claude.ai/code', 'Codex cloud'],
];

export function normalizeText(text) {
  return `${text.replace(/\r\n?/g, '\n').replace(/\n+$/g, '')}\n`;
}

export function readFrontmatter(text, sourcePath = '<memory>') {
  const value = normalizeText(text);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(value);
  if (!match) throw new Error(`${sourcePath}: frontmatter Markdown invalide`);
  const attributes = new Map();
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`${sourcePath}: champ frontmatter invalide: ${line}`);
    attributes.set(field[1], field[2]);
  }
  return { attributes, body: match[2] };
}

export function readTomlStringField(text, field, sourcePath = '<memory>') {
  const value = text.replace(/\r\n?/g, '\n');
  const assignment = new RegExp(`^${echapperRegex(field)}\\s*=\\s*`, 'm').exec(value);
  if (!assignment) throw new Error(`${sourcePath}: champ TOML absent: ${field}`);
  const start = assignment.index + assignment[0].length;
  for (const quote of ['"""', "'''"]) {
    if (value.startsWith(quote, start)) {
      const bodyStart = start + 3 + (value[start + 3] === '\n' ? 1 : 0);
      const end = findTomlClosingQuote(value, quote, bodyStart);
      if (end < 0) throw new Error(`${sourcePath}: string TOML multiligne non fermée: ${field}`);
      const body = value.slice(bodyStart, end);
      return quote === '"""' ? decodeTomlBasicString(body, sourcePath, field) : body;
    }
  }
  const quote = value[start];
  if (quote !== '"' && quote !== "'") throw new Error(`${sourcePath}: ${field} doit être une string TOML`);
  const end = findTomlClosingQuote(value, quote, start + 1);
  if (end < 0) throw new Error(`${sourcePath}: string TOML non fermée: ${field}`);
  const body = value.slice(start + 1, end);
  return quote === '"' ? decodeTomlBasicString(body, sourcePath, field) : body;
}

function findTomlClosingQuote(value, quote, start) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (value.startsWith(quote, index)) return index;
  }
  return -1;
}

function decodeTomlBasicString(value, sourcePath, field) {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== '\\') {
      output += character;
      continue;
    }
    const escape = value[index += 1];
    const simple = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
    if (escape in simple) {
      output += simple[escape];
      continue;
    }
    const length = escape === 'u' ? 4 : escape === 'U' ? 8 : 0;
    if (!length) throw new Error(`${sourcePath}: échappement TOML invalide: ${field}`);
    const hex = value.slice(index + 1, index + length + 1);
    if (!new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) throw new Error(`${sourcePath}: échappement TOML invalide: ${field}`);
    output += String.fromCodePoint(Number.parseInt(hex, 16));
    index += length;
  }
  return output;
}

function adapt(text) {
  return replacements.reduce((value, [from, to]) => value.split(from).join(to), normalizeText(text));
}

export function transformGuide(text) {
  const body = adapt(text);
  if (/CLAUDE\.md|Claude Code|\.claude\/credo|~\/\.claude|claude\.ai\/code/.test(body)) {
    throw new Error('guide: référence Claude résiduelle');
  }
  return `${GENERATED_PREFIX}CLAUDE.md -->\n${body}`;
}

export function transformSkillTree(sourceFiles) {
  const outputs = new Map();
  for (const [source, bytes] of sourceFiles) {
    if (!source.startsWith('.claude/skills/')) continue;
    const destination = source.replace(/^\.claude\/skills\//, '.agents/skills/');
    if (!source.endsWith('/SKILL.md')) {
      outputs.set(destination, Buffer.from(bytes));
      continue;
    }
    const text = utf8.decode(bytes);
    const parsed = readFrontmatter(text, source);
    const frontmatter = normalizeText(text).match(/^---\n[\s\S]*?\n---\n/)[0];
    const body = adapt(parsed.body).split('.claude/skills/').join('.agents/skills/');
    outputs.set(destination, Buffer.from(`${frontmatter}${GENERATED_PREFIX}${source} -->\n${body}`));
  }
  return outputs;
}

export function validateRolePairs(claudeProfiles, codexProfiles) {
  const diagnostics = [];
  for (const role of new Set([...claudeProfiles.keys(), ...codexProfiles.keys()])) {
    const md = claudeProfiles.get(role);
    const toml = codexProfiles.get(role);
    if (!md || !toml) {
      diagnostics.push({ family: 'agent', destination: role, type: 'missing', message: 'profil absent sur une surface' });
      continue;
    }
    try {
      const frontmatter = readFrontmatter(md, `${role}.md`);
      const name = readTomlStringField(toml, 'name', `${role}.toml`);
      const description = readTomlStringField(toml, 'description', `${role}.toml`);
      const instructions = readTomlStringField(toml, 'developer_instructions', `${role}.toml`);
      if (frontmatter.attributes.get('name') !== role || name !== role)
        diagnostics.push({ family: 'agent', destination: role, type: 'parse', message: 'name différent du nom de fichier' });
      if (frontmatter.attributes.get('description') !== description)
        diagnostics.push({ family: 'agent', destination: role, type: 'content', message: 'description fonctionnelle divergente' });
      const expected = referencesIn(adapt(frontmatter.body).split('.claude/skills/').join('.agents/skills/'));
      const actual = referencesIn(instructions);
      if (/CLAUDE\.md|\.claude\/(?!memory\/)|\.Codex\//.test(instructions) || expected.some((reference) => !actual.includes(reference)))
        diagnostics.push({ family: 'agent', destination: role, type: 'reference', message: 'référence de surface divergente' });
    } catch (error) {
      diagnostics.push({ family: 'agent', destination: role, type: 'parse', message: error.message });
    }
  }
  return diagnostics;
}

function referencesIn(text) {
  return [...new Set(text.match(/(?:AGENTS|CLAUDE)\.md|\.(?:agents|claude|codex|Codex)\/[\w./-]+/g) ?? [])].sort();
}

export const SURFACE_CLAUDE = '.claude/settings.json';
export const SURFACE_CODEX = '.codex/hooks.json';

/** Séparateur des clefs de contrat. JAMAIS écrit en octet brut dans la source : un NUL littéral
 *  ferait tenir ce fichier pour BINAIRE par git (plus de diff texte ni de fusion 3-voies). */
export const NUL = '\0';

/**
 * Hooks dont le CONTRAT n'appartient qu'à UNE surface — clef `phase`+NUL+`matcher`+NUL+`script` →
 * surface qui DOIT le porter, l'autre devant l'ignorer. Un hook absent de cette table reste soumis
 * à la parité stricte (même phase, même matcher, même script, même timeout des deux côtés).
 *
 * Le credo de travail entre dans le contexte de Claude par l'IMPORT `@.claude/credo.md` en tête de
 * CLAUDE.md — un import n'est ni tronqué ni persisté à part. Codex n'a pas d'import : sa surface
 * l'INJECTE au SessionStart. Porter les deux mécanismes sur Claude chargerait le credo deux fois.
 *
 * La mise en conformité d'un conteneur distant se garde sur `CLAUDE_CODE_REMOTE`
 * (`scripts/hooks/bootstrap-conteneur.mjs`) : sur la surface Codex, ce hook ne pourrait que naître
 * et rendre une liste vide. Un spawn qui ne mesure rien n'est pas une parité, c'est un mort.
 */

export const HOOKS_MONO_SURFACE = new Map([
  [`SessionStart${NUL}${NUL}inject-project-credo.mjs`, SURFACE_CODEX],
  [`SessionStart${NUL}${NUL}bootstrap-conteneur.mjs`, SURFACE_CLAUDE],
]);

export function validateHookParity(claudeSettings, codexHooks) {
  const forbiddenEverywhere = /\bcat\b|\/dev\/null|[<>]|\|\||&&/;
  const forbiddenOnCodex = /CLAUDE_PROJECT_DIR/;
  const flatten = (value, surface) => Object.entries(value.hooks ?? {}).flatMap(([phase, groups]) =>
    groups.flatMap((group, groupIndex) => (group.hooks ?? []).map((hook, hookIndex) => {
      const command = hook.command ?? '';
      const script = /scripts[\\/]hooks[\\/]([\w.-]+\.mjs)/.exec(command)?.[1];
      return { phase, matcher: group.matcher ?? '', script, timeout: hook.timeout, command, surface, path: `${surface}.hooks.${phase}[${groupIndex}].hooks[${hookIndex}]` };
    })));
  const left = flatten(claudeSettings, SURFACE_CLAUDE);
  const right = flatten(codexHooks, SURFACE_CODEX);
  const isForbidden = (hook) => forbiddenEverywhere.test(hook.command) || (hook.surface === SURFACE_CODEX && forbiddenOnCodex.test(hook.command));
  const diagnostics = [...left, ...right].filter((hook) => isForbidden(hook) || !hook.script)
    .map((hook) => ({ family: 'hook', destination: hook.path, type: 'reference', message: `commande non portable: ${hook.command}` }));

  // Clef d'IDENTITÉ du contrat (sans le timeout) : le `matcher` peut contenir des `|`, la clef ne se
  // découpe donc jamais sur ce caractère.
  const identite = (hook) => `${hook.phase}${NUL}${hook.matcher}${NUL}${hook.script}`;
  const propre = (hook) => HOOKS_MONO_SURFACE.get(identite(hook));

  const key = (hook) => `${hook.phase}${NUL}${hook.matcher}${NUL}${hook.script}${NUL}${hook.timeout}`;
  const partages = (liste) => liste.filter((hook) => !propre(hook));
  for (const value of new Set([...partages(left).map(key), ...partages(right).map(key)]))
    if (!left.some((hook) => key(hook) === value) || !right.some((hook) => key(hook) === value))
      diagnostics.push({ family: 'hook', destination: value, type: 'content', message: 'hook absent sur une surface' });

  for (const [cle, surface] of HOOKS_MONO_SURFACE) {
    const porte = (liste) => liste.some((hook) => identite(hook) === cle);
    const attendue = surface === SURFACE_CODEX ? right : left;
    const interdite = surface === SURFACE_CODEX ? left : right;
    if (!porte(attendue)) diagnostics.push({ family: 'hook', destination: cle, type: 'missing', message: `hook propre à ${surface} absent de cette surface` });
    if (porte(interdite)) diagnostics.push({ family: 'hook', destination: cle, type: 'content', message: `hook réservé à ${surface} présent sur l'autre surface` });
  }
  return diagnostics;
}

/** Les racines que `agents:sync` POSSÈDE — source unique, lue ici (`managedRoots`) et par le train
 *  de publication (`scripts/ops/publier.mjs`, `estDocDerive`) : ces chemins sont DÉRIVÉS de
 *  `CLAUDE.md` et des fiches, donc committables avec les docs. */
export const MANAGED_ROOTS = ['AGENTS.md', '.agents/skills', '.codex/credo.md'];

export function buildExpectedOutputs(snapshot) {
  const files = new Map();
  const diagnostics = [];
  const source = snapshot.get('CLAUDE.md');
  if (!source) diagnostics.push({ family: 'guide', destination: 'AGENTS.md', type: 'missing', message: 'CLAUDE.md absent' });
  else {
    try {
      files.set('AGENTS.md', Buffer.from(transformGuide(utf8.decode(source))));
    } catch (error) {
      diagnostics.push({ family: 'guide', source: 'CLAUDE.md', destination: 'AGENTS.md', type: 'parse', message: error.message });
    }
  }
  for (const [destination, bytes] of transformSkillTree(snapshot)) files.set(destination, bytes);
  const credo = snapshot.get('.claude/credo.md');
  if (credo) files.set('.codex/credo.md', Buffer.from(`${GENERATED_PREFIX}.claude/credo.md -->\n${adapt(utf8.decode(credo))}`));
  return { files, managedRoots: new Set(MANAGED_ROOTS), diagnostics };
}

function withoutBanner(value) {
  return value.replace(/<!-- GENERATED:[^\n]+ -->\n/, '');
}

function hasGeneratedBanner(value) {
  return /(?:^|\n)<!-- GENERATED: agents:sync; source=[^\n]+ -->\n/.test(value);
}

export function collectDiffs(expected, actual) {
  const diagnostics = [...expected.diagnostics];
  for (const [destination, wanted] of expected.files) {
    const found = actual.get(destination);
    if (!found) diagnostics.push({ family: 'guide', destination, type: 'missing', message: 'sortie absente', safe: true });
    else if (!found.equals(wanted)) {
      let current;
      try {
        current = utf8.decode(found);
      } catch (error) {
        diagnostics.push({ family: 'guide', destination, type: 'parse', message: error.message, safe: false });
        continue;
      }
      const legacy = Buffer.from(withoutBanner(wanted.toString('utf8')));
      const marked = hasGeneratedBanner(current);
      const legacyExact = found.equals(legacy);
      const family = destination.startsWith('.agents/skills/') ? 'skill' : 'guide';
      diagnostics.push({ family, destination, type: marked || legacyExact ? 'content' : 'unsafe-overwrite', message: 'contenu divergent', safe: marked || legacyExact });
    }
  }
  for (const [destination, found] of actual) {
    if (expected.files.has(destination) || ![...expected.managedRoots].some((root) => destination === root || destination.startsWith(`${root}/`))) continue;
    const marked = destination.endsWith('SKILL.md') && (() => { try { return hasGeneratedBanner(utf8.decode(found)); } catch { return false; } })();
    const ancestor = [...actual].some(([path, value]) => destination.startsWith(`${path.slice(0, -'SKILL.md'.length)}`) && path.endsWith('/SKILL.md') && (() => { try { return hasGeneratedBanner(utf8.decode(value)); } catch { return false; } })());
    diagnostics.push({ family: 'skill', destination, type: marked || ancestor ? 'orphan' : 'unsafe-delete', message: 'sortie orpheline', safe: marked || ancestor });
  }
  return diagnostics;
}
