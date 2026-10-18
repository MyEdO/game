import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import {
  normalizeText, readFrontmatter, readTomlStringField,
  transformSkillTree, validateRolePairs, OUTILS_NON_RESOLUS, EQUIVALENTS_INTEGRES, buildExpectedOutputs as sortiesAttendues, collectDiffs,
  DESTINATIONS, HOOKS_DE_SESSION, PLACE_PROJET, SURFACE_CLAUDE, SURFACE_CODEX, TIMEOUT_SYNCHRONISEUR, aplatirHooks, compilerMatcher, hooksAttendus, remplacerCleJson,
} from './compat-core.mjs';
import { atomicWrite, chargerRegistres, runCompat } from './compat-cli.mjs';
import { FAMILLES_LEAN_CTX, PREFIXES_LEAN_CTX, SHELL, familleLeanCtx } from '../guards/lib/contratGarde.mjs';

/** Registre de fixture : le point d'entrée de `ENTREES_OUTIL`, deux gardes au répartiteur. */
const REGISTRES = new Map([
  ['repartiteur.mjs', { PreToolUse: [{ outils: ['Write', 'Edit'] }, { outils: ['Bash', 'Edit'] }], PostToolUse: [{ outils: ['Write'] }] }],
]);
/** Les sorties attendues d'un snapshot, sous les registres de fixture. */
const buildExpectedOutputs = (snapshot) => sortiesAttendues(snapshot, REGISTRES);

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

const ANNEXE = '.claude/skills/demo/annexe.md';
const MIROIR_ANNEXE = '.agents/skills/demo/annexe.md';
const avecAnnexe = (texte) => buildExpectedOutputs(new Map([[ANNEXE, Buffer.from(texte)]]));

test('produit un diagnostic parse pour un miroir en UTF-8 invalide', () => {
  const diagnostics = collectDiffs(avecAnnexe('# Annexe\n'), new Map([[MIROIR_ANNEXE, Buffer.from([0xc3, 0x28])]]));
  assert.equal(diagnostics.find((d) => d.destination === MIROIR_ANNEXE).type, 'parse');
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
  const first = new Map([[ANNEXE, Buffer.from('# Annexe\nClaude Code un\n')]]);
  const second = new Map([
    [ANNEXE, Buffer.from('# Annexe\nClaude Code deux\n')],
    [MIROIR_ANNEXE, buildExpectedOutputs(first).files.get(MIROIR_ANNEXE)],
  ]);
  let reads = 0;
  const diagnostics = await runCompat({ root: 'virtual', mode: 'sync' }, {
    registres: REGISTRES,
    snapshot: async () => (reads++ === 0 ? first : second),
    atomicWrite: async () => {},
  });
  assert.equal(diagnostics.find((d) => d.destination === MIROIR_ANNEXE).type, 'content');
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

test('une annexe Markdown d’un skill s’adapte comme son SKILL.md, sans frontmatter', () => {
  const out = transformSkillTree(new Map([
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nLire `.claude/skills/demo/annexe.md`.\n')],
    ['.claude/skills/demo/annexe.md', Buffer.from('# Annexe\n\nLire CLAUDE.md et `.claude/skills/demo/SKILL.md`.\n')],
  ]));
  assert.equal(out.get('.agents/skills/demo/annexe.md').toString(),
    '<!-- GENERATED: agents:sync; source=.claude/skills/demo/annexe.md -->\n# Annexe\n\nLire AGENTS.md et `.agents/skills/demo/SKILL.md`.\n');
});

test('un MOD (racine de `.claude/skills/` qui porte `.claude-plugin/plugin.json`) n’a pas de miroir ; un skill voisin, si (#2278)', () => {
  const out = transformSkillTree(new Map([
    ['.claude/skills/mod/.claude-plugin/plugin.json', Buffer.from('{ "name": "mod" }')],
    ['.claude/skills/mod/hooks/register.ts', Buffer.from('export const register = () => {}')],
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')],
    ['.claude/skills/demo/exemples/.claude-plugin/plugin.json', Buffer.from('{}')],
  ]));
  assert.deepEqual([...out.keys()].sort(), ['.agents/skills/demo/SKILL.md', '.agents/skills/demo/exemples/.claude-plugin/plugin.json']);
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

test('refuse une entrée `tools:` hors du pool des sous-agents, accepte un outil résolu', () => {
  const paire = (tools) => [
    new Map([['joueur', `---\nname: joueur\ndescription: Joue\ntools: ${tools}\n---\nCorps.\n`]]),
    new Map([['joueur', 'name = "joueur"\ndescription = "Joue"\ndeveloper_instructions = """\nCorps.\n"""']]),
  ];
  assert.deepEqual(validateRolePairs(...paire('CronList')), []);
  for (const outil of OUTILS_NON_RESOLUS) {
    assert.deepEqual(validateRolePairs(...paire(`Read, ${outil}`)).map((d) => [d.type, d.message]), [['tools', `outil « ${outil} » hors du pool des sous-agents`]]);
  }
});

test('refuse un outil MCP ou propre à un hôte sans son équivalent intégré, accepte la paire (#2710)', () => {
  const paire = (tools) => [
    new Map([['codeur', `---\nname: codeur\ndescription: Code\ntools: ${tools}\n---\nCorps.\n`]]),
    new Map([['codeur', 'name = "codeur"\ndescription = "Code"\ndeveloper_instructions = """\nCorps.\n"""']]),
  ];
  const candidats = [['PowerShell', EQUIVALENTS_INTEGRES[SHELL]], ...Object.keys(FAMILLES_LEAN_CTX)
    .filter((nu) => Object.hasOwn(EQUIVALENTS_INTEGRES, familleLeanCtx(nu)))
    .map((nu) => [`${PREFIXES_LEAN_CTX.claude}${nu}`, EQUIVALENTS_INTEGRES[familleLeanCtx(nu)]])];
  assert.ok(candidats.length > 3);
  for (const [nom, integre] of candidats) {
    assert.deepEqual(validateRolePairs(...paire(nom)).map((d) => d.message), [`outil intégré « ${integre} » absent : sans lui, l'agent perd cette capacité hors du poste qui porte son équivalent`], nom);
    assert.deepEqual(validateRolePairs(...paire(`${nom}, ${integre}`)), [], nom);
  }
  assert.deepEqual(validateRolePairs(...paire('mcp__autre__ctx_read')), [], 'un serveur autre que lean-ctx n’est pas classé');
});

test('les hooks ATTENDUS dérivent des registres : un par point d’entrée et par événement, matcher = UNION des outils', () => {
  const claude = aplatirHooks({ hooks: hooksAttendus(REGISTRES, SURFACE_CLAUDE) }, SURFACE_CLAUDE);
  const codex = aplatirHooks({ hooks: hooksAttendus(REGISTRES, SURFACE_CODEX) }, SURFACE_CODEX);
  const outil = (liste) => liste.filter((h) => h.phase.endsWith('ToolUse')).map(({ phase, matcher, script, timeout }) => ({ phase, matcher, script, timeout }));
  assert.deepEqual(outil(claude), [
    { phase: 'PreToolUse', matcher: 'Write|Edit|Bash', script: 'repartiteur.mjs', timeout: 10 },
    { phase: 'PostToolUse', matcher: 'Write', script: 'repartiteur.mjs', timeout: 10 },
  ]);
  assert.deepEqual(outil(codex), outil(claude).map((h) => ({ ...h, matcher: `^(?:${h.matcher})$` })), 'la même source, ANCRÉE pour le moteur regex de Codex (`MOTEUR_DE_SURFACE`)');
  assert.ok(codex.every((h) => h.command.startsWith('node scripts/hooks/') && h.args === undefined));
});

test('les matchers générés capturent les noms natifs réellement observés de Codex et Claude', async () => {
  const registres = await chargerRegistres();
  for (const [surface, shell, inconnu] of [
    [SURFACE_CODEX, 'mcp__lean_ctx__ctx_shell', 'mcp__lean_ctx__ctx_execute'],
    [SURFACE_CLAUDE, 'mcp__lean-ctx__ctx_shell', 'mcp__lean-ctx__ctx_execute'],
  ]) {
    const hooks = hooksAttendus(registres, surface);
    const pre = compilerMatcher(hooks.PreToolUse[0].matcher, surface);
    const post = compilerMatcher(hooks.PostToolUse[0].matcher, surface);
    assert.ok(pre(shell), surface);
    assert.ok(pre(inconnu), surface);
    assert.ok(pre('apply_patch'), surface);
    assert.ok(post('apply_patch'), surface);
    assert.ok(pre('NotebookEdit'), surface);
    assert.equal(pre('PasUnEdit'), false);
  }
});

test('CONTRAT — toute déclaration Claude est en forme EXEC : `command` = `node`, `args` non vide, aucun `$` hors `${CLAUDE_PROJECT_DIR}` (#2112, #2125)', async () => {
  const brutes = (hooks) => Object.values(hooks).flatMap((groupes) => groupes.flatMap((g) => g.hooks));
  const surDisque = JSON.parse(await readFile(new URL(`../../${SURFACE_CLAUDE}`, import.meta.url), 'utf8')).hooks;
  for (const [origine, hooks] of [['générées', hooksAttendus(REGISTRES, SURFACE_CLAUDE)], ['commitées', surDisque]]) {
    const declarations = brutes(hooks);
    assert.ok(declarations.length > 0, origine);
    for (const h of declarations) {
      const dit = `${origine} : ${JSON.stringify(h)}`;
      assert.equal(h.command, 'node', dit);
      assert.ok(Array.isArray(h.args) && h.args.length > 0, dit);
      assert.ok(h.args[0].startsWith(`${PLACE_PROJET}/scripts/hooks/`), dit);
      assert.ok(h.args.every((a) => !a.replaceAll(PLACE_PROJET, '').includes('$')), dit);
    }
  }
});

test('CONTRAT — un hook de session n’est porté QUE par ses surfaces', () => {
  for (const { phase, script, surfaces } of HOOKS_DE_SESSION) {
    for (const cible of [SURFACE_CLAUDE, SURFACE_CODEX]) {
      const porte = aplatirHooks({ hooks: hooksAttendus(REGISTRES, cible) }, cible).some((h) => h.phase === phase && h.script === script);
      assert.equal(porte, surfaces.includes(cible), `${script} sur ${cible}`);
    }
  }
});

test('CÂBLAGE — le suivi de vague est injecté au SessionStart de Codex seul, généré et commité ; Claude le porte par le mod harnais (#2132, #2279)', async () => {
  for (const surface of [SURFACE_CLAUDE, SURFACE_CODEX]) {
    const commitees = JSON.parse(await readFile(new URL(`../../${surface}`, import.meta.url), 'utf8'));
    for (const [origine, valeur] of [['générées', { hooks: hooksAttendus(REGISTRES, surface) }], ['commitées', commitees]]) {
      const portes = aplatirHooks(valeur, surface).filter((h) => h.phase === 'SessionStart' && h.script === 'inject-suivi.mjs');
      assert.equal(portes.length, surface === SURFACE_CODEX ? 1 : 0, `${origine} ${surface}`);
    }
  }
});

test('CÂBLAGE — la synchronisation du principal est le PREMIER SessionStart de Codex, généré et commité ; Claude la porte par le mod harnais (#2187)', async () => {
  for (const surface of [SURFACE_CLAUDE, SURFACE_CODEX]) {
    const commitees = JSON.parse(await readFile(new URL(`../../${surface}`, import.meta.url), 'utf8'));
    for (const [origine, valeur] of [['générées', { hooks: hooksAttendus(REGISTRES, surface) }], ['commitées', commitees]]) {
      const session = aplatirHooks(valeur, surface).filter((h) => h.phase === 'SessionStart');
      const portes = session.filter((h) => h.script === 'synchroniser-principal.mjs');
      assert.equal(portes.length, surface === SURFACE_CODEX ? 1 : 0, `${origine} ${surface}`);
      if (surface === SURFACE_CODEX) {
        assert.equal(session[0].script, 'synchroniser-principal.mjs', `${origine} : en tête`);
        assert.equal(portes[0].timeout, TIMEOUT_SYNCHRONISEUR, origine);
      }
    }
  }
});

test('le mod harnais et le hook Codex partagent la borne de la synchronisation (#2187 commentaire 6029118597, C7)', async () => {
  const mod = await readFile(new URL('../../.claude/skills/harnais/hooks/suivi.ts', import.meta.url), 'utf8');
  const borne = /^const BORNE_SYNCHRO_MS = ([\d_]+) \* 1000$/m.exec(mod);
  assert.ok(borne, 'BORNE_SYNCHRO_MS introuvable dans suivi.ts');
  assert.equal(Number(borne[1].replaceAll('_', '')), TIMEOUT_SYNCHRONISEUR, 'BORNE_SYNCHRO_MS === TIMEOUT_SYNCHRONISEUR * 1000');
});

test('sortie PAR CLÉ : sync réécrit la seule clé `hooks` de settings.json, permissions et ordre des clés à l’octet près', async () => {
  const avant = '{\n  "permissions": { "allow": ["Bash(x:*)", "zz"], "deny": [] },\n  "hooks": { "Vieux": [] },\n  "claudeMdExcludes": ["**/a"]\n}\n';
  const ecrits = new Map();
  let fichiers = new Map([[SURFACE_CLAUDE, Buffer.from(avant)]]);
  await runCompat({ root: 'virtual', mode: 'sync' }, {
    registres: REGISTRES,
    snapshot: async () => new Map(fichiers),
    atomicWrite: async (_racine, rel, data) => { ecrits.set(rel, data); fichiers = new Map([...fichiers, [rel, data]]); },
  });
  const apres = ecrits.get(SURFACE_CLAUDE).toString('utf8');
  assert.ok(apres.startsWith('{\n  "permissions": { "allow": ["Bash(x:*)", "zz"], "deny": [] },\n  "hooks": {\n'), apres);
  assert.ok(apres.endsWith('\n  },\n  "claudeMdExcludes": ["**/a"]\n}\n'), apres);
  assert.deepEqual(JSON.parse(apres).hooks, hooksAttendus(REGISTRES, SURFACE_CLAUDE));
  assert.deepEqual(Object.keys(JSON.parse(apres)), ['permissions', 'hooks', 'claudeMdExcludes']);
  assert.deepEqual(JSON.parse(ecrits.get(SURFACE_CODEX).toString('utf8')), { hooks: hooksAttendus(REGISTRES, SURFACE_CODEX) }, 'Codex : sortie ENTIÈRE');
});

test('sortie PAR CLÉ : clé absente ajoutée en dernier, fichier absent créé, JSON illisible = diagnostic', () => {
  const ajoute = remplacerCleJson('{\n  "permissions": {}\n}\n', 'hooks', { A: [] });
  assert.equal(ajoute, '{\n  "permissions": {},\n  "hooks": {\n    "A": []\n  }\n}\n');
  assert.equal(remplacerCleJson(undefined, 'hooks', {}), '{\n  "hooks": {}\n}\n');
  const casse = sortiesAttendues(new Map([[SURFACE_CLAUDE, Buffer.from('{ pas du json')]]), REGISTRES);
  assert.ok(casse.diagnostics.some((d) => d.destination === SURFACE_CLAUDE && d.type === 'parse'));
});

test('une commande de hook éditée à la main (`&&`, `;`, `|`, redirection) est une DIVERGENCE : seul le gabarit du générateur est une commande', () => {
  const attendu = buildExpectedOutputs(new Map());
  const codex = JSON.parse(attendu.files.get(SURFACE_CODEX).toString('utf8'));
  codex.hooks.PreToolUse[0].hooks[0].command += ' && true';
  const diagnostics = collectDiffs(attendu, new Map([[SURFACE_CODEX, Buffer.from(`${JSON.stringify(codex, null, 2)}\n`)]]));
  assert.ok(diagnostics.some((d) => d.destination === SURFACE_CODEX && d.family === 'hook' && d.type === 'content'), JSON.stringify(diagnostics));
});

test('CONTRAT — `.claude/settings.json` n’a PAS de SessionStart credo, `.codex/hooks.json` en a un', async () => {
  const racine = new URL('../../', import.meta.url);
  const claude = JSON.parse(await readFile(new URL(SURFACE_CLAUDE, racine), 'utf8'));
  const codex = JSON.parse(await readFile(new URL(SURFACE_CODEX, racine), 'utf8'));
  const credos = (config, surface) => aplatirHooks(config, surface)
    .filter((h) => h.phase === 'SessionStart' && h.script === 'inject-project-credo.mjs');
  assert.equal(credos(claude, SURFACE_CLAUDE).length, 0, 'Claude importe le credo par `@.claude/credo.md`, il ne l’injecte pas');
  assert.equal(credos(codex, SURFACE_CODEX).length, 1, 'Codex n’a pas d’import : sa surface INJECTE le credo');
});

test('CONTRAT — `CLAUDE.md` importe le credo et `AGENTS.md`, seule source des instructions ; Codex reçoit le credo par injection', async () => {
  const racine = new URL('../../', import.meta.url);
  assert.equal(await readFile(new URL('CLAUDE.md', racine), 'utf8'), '@.claude/credo.md\n@AGENTS.md\n');
  assert.equal(HOOKS_DE_SESSION.find((h) => h.script === 'inject-project-credo.mjs').arguments[0], 'codex');
});

test('les déclarations committées sont celles que les registres RÉELS produisent (agents:check)', async () => {
  const racine = new URL('../../', import.meta.url);
  const snapshot = new Map(await Promise.all([SURFACE_CLAUDE, SURFACE_CODEX].map(async (s) => [s, await readFile(new URL(s, racine))])));
  const attendu = sortiesAttendues(snapshot, await chargerRegistres());
  assert.deepEqual(collectDiffs(attendu, snapshot).filter((d) => d.family === 'hook'), []);
});

test('`DESTINATIONS` couvre chaque sortie de `buildExpectedOutputs`, et chacune en reçoit une', () => {
  const attendu = buildExpectedOutputs(new Map([
    ['CLAUDE.md', Buffer.from('# CLAUDE.md\nClaude Code\n')],
    ['.claude/credo.md', Buffer.from('# Credo\n')],
    ['.claude/skills/demo/SKILL.md', Buffer.from('---\nname: demo\ndescription: Démo\n---\nCorps\n')],
  ]));
  const sous = (chemin, racine) => chemin === racine || chemin.startsWith(`${racine}/`);
  const sorties = [...attendu.files.keys()];
  assert.deepEqual(sorties.filter((c) => !DESTINATIONS.some((r) => sous(c, r))), []);
  assert.deepEqual(DESTINATIONS.filter((r) => !sorties.some((c) => sous(c, r))), []);
});

test('réfute toute référence de profil qui diverge après normalisation', () => {
  const claude = new Map([['artiste', '---\nname: artiste\ndescription: Art\n---\nLire `.claude/skills/demo/SKILL.md` et `.claude/credo.md`.\n']]);
  const codex = new Map([['artiste', 'name = "artiste"\ndescription = "Art"\ndeveloper_instructions = """\nLire `.Codex/skills/demo/SKILL.md` et `.claude/credo.md`.\n"""']]);
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
    registres: REGISTRES,
    snapshot: async () => new Map(files),
    atomicWrite: async () => {},
    rm: async (path) => { removed.push(path); files.delete('.agents/skills/demo/assets/icon.bin'); },
  });
  assert.deepEqual(removed.map((path) => path.replaceAll('\\', '/')), ['virtual/.agents/skills/demo/assets/icon.bin']);
});
