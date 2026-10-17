import { ast } from '../../guards/lib/dialecte.mjs'

import test from 'node:test'

import assert from 'node:assert/strict'

import { existsSync, readFileSync } from 'node:fs'

import { join, relative, sep } from 'node:path'

import { fileURLToPath } from 'node:url'

import { bancsDeWorkflowDuDepot, reconnaissanceDuDepot } from '../../guards/lib/jouer-workflow.mjs'

import { bancworkflowstestmjs } from '../../ops/workflowsBanc.mjs'
const { RACINE, ETAGES, REGIMES, EXCEPTIONS_MECANIQUES, TABLES, estTexte, analyser, muter, vus } = bancworkflowstestmjs

const CE_FICHIER = fileURLToPath(import.meta.url);

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

export function scriptsSansBanc(scripts, bancs) {
  const nommes = new Set();
  for (const { fichier, source } of bancs) {
    const sf = ast({ rel: fichier, text: source });
    const marcher = (n) => {
      if (estTexte(n)) nommes.add(n.text.split(/[\\/]/).pop());
      n.forEachChild(marcher);
    };
    marcher(sf);
  }
  return scripts.filter((s) => !nommes.has(s.split('/').pop()));
}

const relatif = (f) => relative(RACINE, f).split(sep).join('/');

const reconnaissance = reconnaissanceDuDepot(RACINE);

const scripts = reconnaissance.scripts.map(relatif);

const sources = new Map(scripts.map((f) => [f, readFileSync(join(RACINE, f), 'utf8')]));

const analyses = new Map([...sources].map(([f, s]) => [f, analyser(s, f)]));

const parRegle = (regle) => [...analyses.values()].flatMap((a) => a.defauts).filter((d) => d.regle === regle).map((d) => d.message);

const contexteReel = (phases = analyses) => ({
  scripts,
  phases,
  agentExiste: (type) => existsSync(join(RACINE, '.claude', 'agents', `${type}.md`)),
});

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

test('la porte MORD quand une phase de RÉDACTION part sur un autre type ou un autre modèle', () => {
  const fichier = 'scripts/raw/atlas-domain.workflow.js';
  const mute = muter(fichier, "phase: 'Synthese', agentType: 'lecteur', model: 'opus'", "phase: 'Synthese', agentType: 'juge', model: 'sonnet'");
  assert.deepEqual(vus(mute, fichier), [
    "agent : phase de RÉDACTION `Synthese` : `agentType: 'lecteur'` exigé (lu : `juge`)",
    "agent : phase de RÉDACTION `Synthese` : `model: 'opus'` exigé AUSSI (lu : `sonnet`) — un sous-agent ne tourne jamais sur le modèle de session",
  ]);
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

test('B9 — retirer des bancs le littéral qui nomme un script le laisse SANS banc', () => {
  const porteurs = bancs.filter((b) => scriptsSansBanc(['.claude/workflows/table-simulee.js'], [b]).length === 0);
  assert.ok(porteurs.length > 0, 'les bancs des workflows de .claude/workflows/');
  const mutes = new Map(porteurs.map((b) => {
    const source = b.source.replaceAll("'table-simulee.js'", "'table' + '-simulee.js'");
    assert.notEqual(source, b.source, `la mutation s’applique à ${b.fichier}`);
    return [b, { ...b, source }];
  }));
  assert.deepEqual(scriptsSansBanc(scripts, bancs.map((b) => mutes.get(b) ?? b)), ['.claude/workflows/table-simulee.js']);
});
