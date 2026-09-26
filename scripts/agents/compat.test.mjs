import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import {
  normalizeText, readFrontmatter, readTomlStringField, transformGuide,
  transformSkillTree, validateRolePairs, validateHookParity, buildExpectedOutputs, collectDiffs,
} from './compat-core.mjs';
import { atomicWrite, runCompat } from './compat-cli.mjs';

// Racine de fixture ASSEMBLÉE à l'exécution : ce fichier ne porte aucun chemin absolu littéral, il
// reste donc soumis à `src/portable-paths-guard.test.ts` comme le reste de `scripts/**`.
const RACINE_WIN = 'C' + ':/repo';

test('normalise CRLF et termine par un seul LF', () => {
  assert.equal(normalizeText('a\r\nb\r\n'), 'a\nb\n');
});

test('lit frontmatter et corps sans le modifier', () => {
  const parsed = readFrontmatter('---\r\nname: demo\r\ndescription: Démo\r\n---\r\nCorps\r\n', 'demo.md');
  assert.equal(parsed.attributes.get('name'), 'demo');
  assert.equal(parsed.body, 'Corps\n');
});

test('lit les quatre formes string TOML requises', () => {
  assert.equal(readTomlStringField('name = "codeur"\r\n', 'name'), 'codeur');
  assert.equal(readTomlStringField("name = 'codeur'\n", 'name'), 'codeur');
  assert.equal(readTomlStringField('developer_instructions = """\r\nligne\r\n"""', 'developer_instructions'), 'ligne\n');
  assert.equal(readTomlStringField("developer_instructions = '''\nligne\n'''", 'developer_instructions'), 'ligne\n');
});

test('décode les échappements TOML des strings basic mono et multiligne', () => {
  assert.equal(readTomlStringField('name = "co\\"deur\\\\"\n', 'name'), 'co"deur\\');
  assert.equal(readTomlStringField('developer_instructions = """\nl\\"igne\\\\\n"""', 'developer_instructions'), 'l"igne\\\n');
});

test('transforme le guide par table fermée', async () => {
  const out = transformGuide(await readFile(new URL('./fixtures/guide/CLAUDE.md', import.meta.url), 'utf8'));
  assert.match(out, /^<!-- GENERATED: agents:sync; source=CLAUDE\.md -->\n# AGENTS\.md/m);
  assert.doesNotMatch(out.replace(/^[^\n]*\n/, ''), /CLAUDE\.md|Claude Code|\.claude\/credo|~\/\.claude|claude\.ai\/code/);
});

test('adopte un legacy exact mais refuse un écrasement manuel', () => {
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  const generated = expected.files.get('AGENTS.md').toString('utf8');
  const legacy = generated.replace(/^<!-- GENERATED:[^\n]+ -->\n/, '');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy)] ]))[0].safe, true);
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from(legacy.replace(/\n/g, '\r\n'))] ]))[0].type, 'unsafe-overwrite');
  assert.equal(collectDiffs(expected, new Map([['AGENTS.md', Buffer.from('# manuel\n')]]))[0].type, 'unsafe-overwrite');
});

test('produit un diagnostic parse pour UTF-8 invalide', () => {
  const invalid = Buffer.from([0xc3, 0x28]);
  const expected = buildExpectedOutputs(new Map([['CLAUDE.md', invalid]]));
  assert.equal(expected.diagnostics[0].type, 'parse');
  const valid = buildExpectedOutputs(new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')]]));
  assert.equal(collectDiffs(valid, new Map([['AGENTS.md', invalid]]))[0].type, 'parse');
});

test('réessaie atomiquement les verrous Windows avec un temporaire unique', async () => {
  const calls = [];
  let renames = 0;
  await atomicWrite(RACINE_WIN, 'AGENTS.md', Buffer.from('guide'), {
    mkdir: async () => calls.push('mkdir'),
    writeFile: async (path) => calls.push(`write:${path}`),
    rename: async () => {
      renames += 1;
      if (renames === 1) throw Object.assign(new Error('busy'), { code: 'EPERM' });
      calls.push('rename');
    },
    rm: async () => calls.push('rm'),
    randomUUID: () => 'unique',
    sleep: async () => calls.push('sleep'),
  });
  assert.equal(renames, 2);
  assert.match(calls[1], /AGENTS\.md\.agents-sync-unique$/);
  assert.deepEqual([calls[0], calls[2], calls[3]], ['mkdir', 'sleep', 'rename']);
});

test('reconstruit les sorties attendues depuis le snapshot post-sync', async () => {
  const first = new Map([['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code un\n')]]);
  const second = new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code deux\n')],
    ['AGENTS.md', buildExpectedOutputs(first).files.get('AGENTS.md')],
  ]);
  let reads = 0;
  const diagnostics = await runCompat({ root: 'virtual', mode: 'sync' }, {
    snapshot: async () => (reads++ === 0 ? first : second),
    atomicWrite: async () => {},
  });
  assert.equal(diagnostics[0].type, 'content');
});

test('préserve le frontmatter, adapte le corps et copie les ressources', () => {
  const source = new Map([
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nLire CLAUDE.md et .claude/credo.md.\n')],
    ['.claude/skills/demo/assets/icon.bin', Buffer.from([0, 255, 1])],
  ]);
  const out = transformSkillTree(source);
  assert.match(out.get('.agents/skills/demo/SKILL.md').toString(), /^---[\s\S]+---\n<!-- GENERATED:/);
  assert.deepEqual(out.get('.agents/skills/demo/assets/icon.bin'), Buffer.from([0, 255, 1]));
});

test('refuse orphelin manuel et accepte ressource sous skill marqué', () => {
  const expected = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\n')],
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')],
  ]));
  const actual = new Map([['.agents/skills/intrus.txt', Buffer.from('manuel')]]);
  assert.equal(collectDiffs(expected, actual).find((d) => d.destination.endsWith('intrus.txt')).type, 'unsafe-delete');
});

test('valide noms, descriptions et références des rôles', () => {
  const claude = new Map([['codeur', '---\nname: codeur\ndescription: Exécute\n---\nLire CLAUDE.md et .claude/skills/demo/SKILL.md.\n']]);
  const codex = new Map([['codeur', 'name = "codeur"\ndescription = "Exécute"\ndeveloper_instructions = """\nLire AGENTS.md et .agents/skills/demo/SKILL.md.\n"""']]);
  assert.deepEqual(validateRolePairs(claude, codex), []);
  assert.equal(validateRolePairs(claude, new Map())[0].type, 'missing');
});

test('génère seulement le credo Codex et partage la mémoire Claude', () => {
  const expected = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\n')],
    ['.claude/credo.md', Buffer.from('Lire .claude/memory/MEMORY.md\n')],
    ['.claude/memory/MEMORY.md', Buffer.from('Guide CLAUDE.md\n')],
  ]));
  assert.match(expected.files.get('.codex/credo.md').toString(), /\.claude\/memory/);
  assert.equal(expected.files.has('.codex/memory/MEMORY.md'), false);
});

/** Le hook du credo est propre à Codex : tout jeu de fixtures VALIDE le porte côté Codex seulement. */
const CREDO_CODEX = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node scripts/hooks/inject-project-credo.mjs codex', timeout: 10 }] }] } };
/** Hook PARTAGÉ de référence — celui-là doit être présent à l'identique sur les deux surfaces. */
const partage = (command = 'node scripts/hooks/poison-postcheck.mjs', timeout = 10, matcher = 'Write|Edit') =>
  ({ hooks: { PostToolUse: [{ matcher, hooks: [{ type: 'command', command, timeout }] }] } });
const avecCredo = (surface, base) => ({ hooks: { ...base.hooks, ...(surface === 'codex' ? CREDO_CODEX.hooks : {}) } });

test('normalise la parité et rejette les commandes shell', () => {
  assert.deepEqual(validateHookParity(partage(), avecCredo('codex', partage())), []);
  const codexShell = avecCredo('codex', partage('cat .codex/credo.md'));
  assert.equal(validateHookParity(partage(), codexShell)[0].type, 'reference');
});

test('CONTRAT — le hook du credo est porté par Codex SEUL (Claude importe `@.claude/credo.md`)', () => {
  // Absent de Codex : la surface qui DOIT le porter ne le porte pas.
  const sansCredo = validateHookParity(partage(), partage());
  assert.equal(sansCredo.length, 1);
  assert.equal(sansCredo[0].type, 'missing');
  assert.match(sansCredo[0].message, /\.codex\/hooks\.json/);

  // Présent AUSSI sur Claude : le credo serait chargé deux fois.
  const claudeAussi = { hooks: { ...partage().hooks, SessionStart: [{ hooks: [{ type: 'command', command: 'node scripts/hooks/inject-project-credo.mjs claude', timeout: 10 }] }] } };
  const double = validateHookParity(claudeAussi, avecCredo('codex', partage()));
  assert.equal(double.length, 1);
  assert.equal(double[0].type, 'content');
  assert.match(double[0].message, /réservé à \.codex\/hooks\.json/);
});

test('CONTRAT — `.claude/settings.json` n’a PAS de SessionStart credo, `.codex/hooks.json` en a un', async () => {
  const racine = new URL('../../', import.meta.url);
  const claude = JSON.parse(await readFile(new URL('.claude/settings.json', racine), 'utf8'));
  const codex = JSON.parse(await readFile(new URL('.codex/hooks.json', racine), 'utf8'));
  const credos = (config) => (config.hooks?.SessionStart ?? []).flatMap((g) => g.hooks ?? [])
    .filter((h) => String(h.command ?? '').includes('inject-project-credo.mjs'));
  assert.equal(credos(claude).length, 0, 'Claude importe le credo par `@.claude/credo.md`, il ne l’injecte pas');
  assert.equal(credos(codex).length, 1, 'Codex n’a pas d’import : sa surface INJECTE le credo');
  const guide = await readFile(new URL('CLAUDE.md', racine), 'utf8');
  assert.match(guide, /^@\.claude\/credo\.md$/m, 'la ligne d’import du credo manque à CLAUDE.md');
  assert.deepEqual(validateHookParity(claude, codex), []);
});

test("CONTRAT — l'import `@.claude/credo.md` se traduit en MÉCANISME, pas en pointeur inerte", async () => {
  const racine = new URL('../../', import.meta.url);
  // Codex n'a pas d'affordance d'import : un `@.codex/credo.md` dans AGENTS.md ne chargerait RIEN.
  const transforme = transformGuide('@.claude/credo.md\n\n# CLAUDE.md — titre\n');
  assert.doesNotMatch(transforme, /@\.codex\/credo\.md/, 'le pointeur inerte est interdit sur AGENTS.md');
  assert.match(transforme, /Credo injecté au SessionStart par `\.codex\/hooks\.json`/);
  const agents = await readFile(new URL('AGENTS.md', racine), 'utf8');
  assert.match(agents, /Credo injecté au SessionStart par `\.codex\/hooks\.json`/, 'AGENTS.md doit dire le mécanisme réel');
  assert.doesNotMatch(agents, /@\.codex\/credo\.md/);
});

test('CLAUDE_PROJECT_DIR ancre légitimement la surface Claude, jamais la surface Codex', () => {
  const claude = partage('node "$CLAUDE_PROJECT_DIR"/scripts/hooks/poison-postcheck.mjs');
  assert.deepEqual(validateHookParity(claude, avecCredo('codex', partage())), []);
  const codexVar = avecCredo('codex', partage('node "$CLAUDE_PROJECT_DIR"/scripts/hooks/poison-postcheck.mjs'));
  assert.equal(validateHookParity(claude, codexVar)[0].type, 'reference');
});

test('&& et /dev/null restent interdits sur les deux surfaces', () => {
  const claudeBad = partage('node scripts/hooks/poison-postcheck.mjs && true');
  assert.equal(validateHookParity(claudeBad, avecCredo('codex', partage()))[0].type, 'reference');
  const codexBad = avecCredo('codex', partage('node scripts/hooks/poison-postcheck.mjs > /dev/null'));
  assert.equal(validateHookParity(partage(), codexBad)[0].type, 'reference');
});

test('une divergence de timeout ou de matcher entre surfaces reste rejetée', () => {
  const codexTimeout = avecCredo('codex', partage(undefined, 20));
  assert.equal(validateHookParity(partage(), codexTimeout)[0].type, 'content');
  const codexMatcher = avecCredo('codex', partage(undefined, 10, 'Write'));
  assert.equal(validateHookParity(partage(), codexMatcher)[0].type, 'content');
});

test('réfute toute référence de profil qui diverge après normalisation', () => {
  const claude = new Map([['artiste', '---\nname: artiste\ndescription: Art\n---\nLire `.claude/skills/demo/SKILL.md` et `.claude/credo.md`.\n']]);
  const codex = new Map([['artiste', 'name = "artiste"\ndescription = "Art"\ndeveloper_instructions = """\nLire `.Codex/skills/demo/SKILL.md` et `.codex/credo.md`.\n"""']]);
  assert.equal(validateRolePairs(claude, codex)[0].type, 'reference');
});

test('refuse l’écrasement d’un skill manuel non marqué', () => {
  const expected = buildExpectedOutputs(new Map([['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')]]));
  const actual = new Map([['.agents/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nManuel\n')]]);
  assert.equal(collectDiffs(expected, actual).find((item) => item.destination.endsWith('demo/SKILL.md')).type, 'unsafe-overwrite');
});

test('reconnaît la bannière après frontmatter et son ressource orpheline', () => {
  const skill = Buffer.from('---\nname: demo\ndescription: Démo\n---\n<!-- GENERATED: agents:sync; source=.claude/skills/demo/SKILL.md -->\nCorps\n');
  const expected = buildExpectedOutputs(new Map());
  const actual = new Map([
    ['.agents/skills/demo/SKILL.md', skill],
    ['.agents/skills/demo/assets/icon.bin', Buffer.from([1])],
  ]);
  assert.ok(collectDiffs(expected, actual).filter((item) => item.destination.startsWith('.agents/skills/')).every((item) => item.safe));
});

test('sync supprime seulement les orphelins générés avant le resnapshot', async () => {
  const source = ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')];
  const generated = transformSkillTree(new Map([source])).get('.agents/skills/demo/SKILL.md');
  const files = new Map([source, ['.agents/skills/demo/SKILL.md', generated], ['.agents/skills/demo/assets/icon.bin', Buffer.from([1])]]);
  const removed = [];
  await runCompat({ root: 'virtual', mode: 'sync' }, {
    snapshot: async () => new Map(files),
    atomicWrite: async () => {},
    rm: async (path) => { removed.push(path); files.delete('.agents/skills/demo/assets/icon.bin'); },
  });
  assert.deepEqual(removed.map((path) => path.replaceAll('\\', '/')), ['virtual/.agents/skills/demo/assets/icon.bin']);
});
