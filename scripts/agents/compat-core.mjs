import { Buffer } from 'node:buffer';
import { matcherDOutils } from '../guards/lib/contratGarde.mjs';
import { TIMEOUT_DU_HOOK } from '../hooks/bootstrap-prerequis.mjs';

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
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assignment = new RegExp(`^${escaped}\\s*=\\s*`, 'm').exec(value);
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

/**
 * Le moteur de matcher de chaque surface. Claude Code : noms exacts si le matcher ne porte que
 * lettres, chiffres, `_`, `-`, espaces, `,` et `|`, sinon « JavaScript regex (unanchored) »
 * (https://code.claude.com/docs/en/hooks, « Matcher patterns »). Codex 0.156.1 : crate Rust `regex`,
 * sans lookaround (`codex.exe` : « look-around, including look-ahead and look-behind, is not
 * supported » ; « invalid matcher ·· in ·· »).
 */
export const MOTEUR_DE_SURFACE = Object.freeze({
  [SURFACE_CLAUDE]: { lookaround: true, listeExacte: /^[A-Za-z0-9_ ,|-]*$/ },
  [SURFACE_CODEX]: { lookaround: false, listeExacte: null },
});

/** Le matcher `matcher` de `surface`, compilé comme la surface le lit : `(nomDOutil) => boolean`. */
export function compilerMatcher(matcher, surface) {
  const { listeExacte } = MOTEUR_DE_SURFACE[surface];
  if (listeExacte?.test(matcher)) {
    const noms = new Set(matcher.split(/[|,]/).map((n) => n.trim()));
    return (nom) => noms.has(nom);
  }
  const regex = new RegExp(matcher);
  return (nom) => regex.test(nom);
}

/**
 * Les points d'entrée des hooks d'APPEL D'OUTIL (#2125) : `script` de `scripts/hooks/`, le `module` qui
 * exporte son registre (`exporte` : événement → gardes), son `timeout` (s) et son message. Le
 * répartiteur porte toutes les gardes ; la porte de fermeture a le sien, parce qu'un commit de
 * fermeture la fait durer plusieurs secondes et qu'un dépassement jetterait la sortie de toutes les
 * gardes d'un même processus.
 */
export const ENTREES_OUTIL = [
  { script: 'repartiteur.mjs', module: 'registre.mjs', exporte: 'REGISTRE', timeout: 10, statusMessage: 'Gardes des appels d’outil (répartiteur)' },
  { script: 'solde-ticket-hook.mjs', module: 'solde-ticket-hook.mjs', exporte: 'REGISTRE_SOLDE', timeout: 10, statusMessage: 'Fermeture de ticket au commit = solde écrit obligatoire' },
];

/**
 * Hooks de SESSION (points d'entrée hors registre : `SessionStart` n'a pas de `tool_name`), chacun avec
 * les SURFACES qui le portent ; une surface absente de `surfaces` ne le porte pas.
 *
 * Le credo de travail entre dans le contexte de Claude par l'IMPORT `@.claude/credo.md` en tête de
 * CLAUDE.md — un import n'est ni tronqué ni persisté à part. Codex n'a pas d'import : sa surface
 * l'INJECTE au SessionStart. Porter les deux mécanismes sur Claude chargerait le credo deux fois.
 *
 * La mise en conformité d'un conteneur distant se garde sur `CLAUDE_CODE_REMOTE`
 * (`scripts/hooks/bootstrap-conteneur.mjs`) : sur la surface Codex, ce hook ne pourrait que naître
 * et rendre une liste vide. Un spawn qui ne mesure rien n'est pas une parité, c'est un mort.
 *
 * Le suivi de vague (`scripts/hooks/inject-suivi.mjs`, #2132) se relit sur les deux surfaces.
 */
export const HOOKS_DE_SESSION = [
  { phase: 'SessionStart', script: 'inject-project-credo.mjs', arguments: ['codex'], surfaces: [SURFACE_CODEX], timeout: 10, statusMessage: 'Injection du credo de travail' },
  { phase: 'SessionStart', script: 'bootstrap-conteneur.mjs', arguments: [], surfaces: [SURFACE_CLAUDE], timeout: TIMEOUT_DU_HOOK, statusMessage: 'Conformité du conteneur distant (hooks git, docs, gh)' },
  { phase: 'SessionStart', script: 'inject-suivi.mjs', arguments: [], surfaces: [SURFACE_CLAUDE, SURFACE_CODEX], timeout: 10, statusMessage: 'Suivi de vague de la session' },
];

/**
 * Le lancement d'un hook sur `surface`. Claude Code : forme EXEC (`command` + `args`, aucun shell),
 * `${CLAUDE_PROJECT_DIR}` substitué par élément — la forme shell passe par Git Bash sous Windows, dont
 * l'enfant survit au timeout en tenant le stdout (#2112, anthropics/claude-code#96945). Codex : forme
 * shell, lancée depuis la racine du dépôt.
 */
export const lancementDeHook = (surface, script, args = []) => (surface === SURFACE_CLAUDE
  ? { command: 'node', args: [`${PLACE_PROJET}/scripts/hooks/${script}`, ...args] }
  : { command: [`node scripts/hooks/${script}`, ...args].join(' ') });

/** Le placeholder de chemin que Claude Code substitue dans chaque élément de `args`. */
export const PLACE_PROJET = '${CLAUDE_PROJECT_DIR}';

/**
 * La valeur `hooks` ATTENDUE de `surface`, DÉRIVÉE des registres : pour chaque point d'entrée et
 * chaque événement de son registre, un hook dont le matcher est l'UNION des `outils` de ses gardes,
 * puis les hooks de session que `surface` porte.
 * @param {ReadonlyMap<string, Record<string, Array<{ outils: string[] }>>>} registres script → registre
 * @param {string} surface
 */
export function hooksAttendus(registres, surface) {
  const hooks = {};
  const ajouter = (phase, groupe) => { (hooks[phase] ??= []).push(groupe); };
  for (const { script, timeout, statusMessage } of ENTREES_OUTIL) {
    const registre = registres.get(script);
    if (!registre) throw new Error(`registre absent pour ${script}`);
    for (const [phase, gardes] of Object.entries(registre)) {
      const matcher = matcherDOutils([...new Set(gardes.flatMap((g) => g.outils))], MOTEUR_DE_SURFACE[surface]);
      ajouter(phase, { matcher, hooks: [{ type: 'command', ...lancementDeHook(surface, script), timeout, statusMessage }] });
    }
  }
  for (const { phase, script, arguments: args, surfaces, timeout, statusMessage } of HOOKS_DE_SESSION)
    if (surfaces.includes(surface)) ajouter(phase, { hooks: [{ type: 'command', ...lancementDeHook(surface, script, args), timeout, statusMessage }] });
  return hooks;
}

/**
 * Les hooks d'une surface, à plat : un par commande, `command` = la ligne lancée (`args` de la forme exec
 * joints), `script` = le module de `scripts/hooks/` qu'elle lance (`undefined` si elle n'en lance aucun).
 * @param {{ hooks?: Record<string, Array<{ matcher?: string, hooks?: Array<{ command?: string, args?: string[], timeout?: number, statusMessage?: string }> }>> }} value
 * @param {string} surface
 */
export const aplatirHooks = (value, surface) => Object.entries(value.hooks ?? {}).flatMap(([phase, groups]) =>
  groups.flatMap((group, groupIndex) => (group.hooks ?? []).map((hook, hookIndex) => {
    const command = [hook.command ?? '', ...(hook.args ?? [])].join(' ');
    const script = /scripts[\\/]hooks[\\/]([\w.-]+\.mjs)/.exec(command)?.[1];
    return { phase, matcher: group.matcher ?? '', script, args: hook.args, timeout: hook.timeout, statusMessage: hook.statusMessage, command, surface, path: `${surface}.hooks.${phase}[${groupIndex}].hooks[${hookIndex}]` };
  })));

/**
 * SORTIE PAR CLÉ : un fichier JSON dont `agents:sync` ne possède qu'UNE clé de premier niveau — le
 * reste (les `permissions` éditées à la main de `.claude/settings.json`) est relu et PRÉSERVÉ à l'octet.
 * Fichier → clé gérée.
 */
export const SORTIES_PAR_CLE = new Map([[SURFACE_CLAUDE, 'hooks']]);

/** L'étendue `[debut, fin)` de la VALEUR de la clé `cle` du premier niveau de l'objet JSON `texte`,
 *  `null` si la clé n'y est pas. `texte` est un JSON valide (déjà parsé par l'appelant). */
function etendueDeCle(texte, cle) {
  let profondeur = 0;
  let i = 0;
  const finDeChaine = (j) => { for (j += 1; texte[j] !== '"'; j += 1) if (texte[j] === '\\') j += 1; return j + 1; };
  while (i < texte.length) {
    const c = texte[i];
    if (c === '"') {
      const fin = finDeChaine(i);
      if (profondeur === 1 && JSON.parse(texte.slice(i, fin)) === cle && /^\s*:/.test(texte.slice(fin))) {
        let debut = fin + texte.slice(fin).indexOf(':') + 1;
        while (/\s/.test(texte[debut])) debut += 1;
        let j = debut;
        if (texte[j] === '"') return [debut, finDeChaine(j)];
        if (texte[j] !== '{' && texte[j] !== '[') {
          while (j < texte.length && !/[,}\s]/.test(texte[j])) j += 1;
          return [debut, j];
        }
        for (let niveau = 0; ; j += 1) {
          if (texte[j] === '"') { j = finDeChaine(j) - 1; continue; }
          if (texte[j] === '{' || texte[j] === '[') niveau += 1;
          else if ((texte[j] === '}' || texte[j] === ']') && --niveau === 0) return [debut, j + 1];
        }
      }
      i = fin;
      continue;
    }
    if (c === '{' || c === '[') profondeur += 1;
    else if (c === '}' || c === ']') profondeur -= 1;
    i += 1;
  }
  return null;
}

/**
 * `texte` (un objet JSON) dont la clé de premier niveau `cle` vaut `valeur` : seule l'étendue de sa
 * valeur est réécrite, à l'indentation du fichier ; toute autre clé garde ses octets et sa place. Clé
 * absente : ajoutée en dernier. `texte` absent : un objet qui ne porte qu'elle.
 */
export function remplacerCleJson(texte, cle, valeur) {
  if (texte === undefined || texte === null) return `${JSON.stringify({ [cle]: valeur }, null, 2)}\n`;
  JSON.parse(texte);
  const unite = /\n([ \t]+)"/.exec(texte)?.[1] ?? '  ';
  const serialise = JSON.stringify(valeur, null, unite).replace(/\n/g, `\n${unite}`);
  const etendue = etendueDeCle(texte, cle);
  if (etendue) return `${texte.slice(0, etendue[0])}${serialise}${texte.slice(etendue[1])}`;
  const fin = texte.lastIndexOf('}');
  const avant = texte.slice(0, fin).replace(/\s*$/, '');
  const separateur = avant.endsWith('{') ? '' : ',';
  return `${avant}${separateur}\n${unite}${JSON.stringify(cle)}: ${serialise}\n${texte.slice(fin)}`;
}

/** Les racines que `agents:sync` POSSÈDE — source unique, lue ici (`managedRoots`) et par le train
 *  de publication (`scripts/ops/publier.mjs`, `estDocDerive`) : ces chemins sont DÉRIVÉS de
 *  `CLAUDE.md` et des fiches, donc committables avec les docs. */
export const MANAGED_ROOTS = ['AGENTS.md', '.agents/skills', '.codex/credo.md'];

/**
 * Les sorties attendues de `snapshot`. `registres` (script de `ENTREES_OUTIL` → registre) dérive les
 * déclarations de hooks des deux surfaces : `.codex/hooks.json` ENTIER, la seule clé `hooks` de
 * `.claude/settings.json` (`SORTIES_PAR_CLE`).
 */
export function buildExpectedOutputs(snapshot, registres) {
  const files = new Map();
  const sortiesDeHooks = new Set();
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
  for (const surface of [SURFACE_CLAUDE, SURFACE_CODEX]) {
    try {
      const valeur = hooksAttendus(registres, surface);
      const cle = SORTIES_PAR_CLE.get(surface);
      const texte = cle
        ? remplacerCleJson(snapshot.get(surface)?.toString('utf8'), cle, valeur)
        : `${JSON.stringify({ hooks: valeur }, null, 2)}\n`;
      files.set(surface, Buffer.from(texte));
      sortiesDeHooks.add(surface);
    } catch (error) {
      diagnostics.push({ family: 'hook', destination: surface, type: 'parse', message: error.message });
    }
  }
  return { files, managedRoots: new Set(MANAGED_ROOTS), sortiesDeHooks, diagnostics };
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
    if (expected.sortiesDeHooks.has(destination)) {
      if (!found?.equals(wanted)) diagnostics.push({ family: 'hook', destination, type: found ? 'content' : 'missing', message: 'hooks divergents du registre', safe: true });
      continue;
    }
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
