import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estSuiteVitest } from '../../guards/lib/fichierVitest.mjs'
import { lireWorkflow } from '../../guards/lib/formeDeWorkflow.mjs'
import { jouerWorkflow, scriptsDeWorkflowDuDepot } from '../../guards/lib/jouer-workflow.mjs'
import { RACINE, jouer, ARGS_TABLE, FICHES_PJ, jetsDe, analyseCouvrante, repondreALaTable, jouerTable, mjSansFin, mjAuxSorts, analyseSignal, argsDossier, ARGS_DOSSIER, repondreAuDossier, jouerDossier, sauf } from '../../test/lib/bancWorkflows.mjs'

const FUITE = { echange: 2, secret: 'sec1', constat: 'la narration nomme le secret, aucun indice trouvé n’y mène' };

const AVEC_COMPAGNON = argsDossier(['EDOC-03']);

const ENTREE_D2 = { evenement: 'Kastor attaque à minuit', condition: 'minuit sonne', ref: ['EDO 01 l.300'] };

// ── CLASSES : tout workflow du dépôt ───────────────────────────────────────────────────────────────

/** Le nom de fichier d'un script : ce qu'un banc NOMME (porte B9 de `workflows.test.mjs`). */
const nomDe = (chemin) => chemin.split(/[\\/]/).pop();

const ATLAS = join(RACINE, 'scripts', 'raw', 'atlas-domain.workflow.js');

/** Un périmètre de FIXTURE : un cœur, un livre, un domaine — rien du registre réel. */
const ARGS_ATLAS = {
  coeur: 'alpha', domaines: [{ cle: 'domaine-un', titre: 'Domaine de fixture' }], lot: ['domaine-un'],
  livres: [{ ab: 'BKA', dir: 'Source/Fixture - Base Alpha', coeur: 'alpha', language: 'Langue-A' }],
};

/** Un atlas qui répond à chaque phase ; `fidele: false` ouvre la correction de fidélité et la re-vérification. */
const repondreALAtlas = (fidele) => (prompt, opts) => ({
  Cadrage: { coverageRefs: [{ ab: 'BKA', nn: '05' }] },
  Cartographie: { items: [{ item: 'Une règle', kind: 'table', ref: 'BKA 05 l.1', gist: 'g' }] },
  Taxonomie: { topics: [{ id: 'topic-un', t: 'Topic Un', hint: 'h', covers: ['Une règle'] }] },
  Survey: { hits: [{ topicId: 'topic-un', ref: 'BKA 05 l.1', gist: 'g' }] },
  Synthese: { fiche: { title: 'Topic Un', markdown: '## Topic Un\n\nUn corps.', refs: ['BKA 05 l.1'], codeHint: '' } },
  Correction: { fiche: { title: 'Topic Un', markdown: '## Topic Un\n\nCorrigé.', refs: ['BKA 05 l.1'], codeHint: '' } },
  Audit: { dry: true, gaps: [] },
  Verif: { faithful: fidele, issues: fidele ? [] : ['une valeur fausse'] },
})[opts.phase];

/** Par script de workflow du dépôt : des runs qui atteignent ses agents. */
const RUNS_COUVRANTS = {
  'dossier-de-chapitre.js': () => [jouerDossier(AVEC_COMPAGNON, { oublis: { declencheurs: [ENTREE_D2] } })],
  'table-simulee.js': () => [jouerTable(mjSansFin)],
  'atlas-domain.workflow.js': () => [jouerWorkflow(ATLAS, ARGS_ATLAS, repondreALAtlas(true)), jouerWorkflow(ATLAS, ARGS_ATLAS, repondreALAtlas(false))],
};

/** Ce qui fige un agent de fond (une commande qui attend une autorisation) : changement de dossier,
 *  enchaînement, shell prescrit, fichier de sonde écrit ou lu par redirection. */
const INTERDITS_D_EXECUTION = /(^|[\s`"(])cd\s|&&|Shell = Bash|git -C|dossier de sondes|s'écrit sous|redirection fichier/i;

const CONTRAT_D_EXECUTION = /Toute commande passe par l'outil `ctx_shell`, son paramètre `cwd` = l'arbre[^:\n]* : UNE commande simple par appel, [^\n]*; UN SEUL appel `ctx_shell` par message, jamais plusieurs en parallèle\. Une sonde est une commande [^\n]*, jamais un fichier écrit/;

test('CLASSE — tout workflow du dépôt : aucun agent ne reçoit de shell, de changement de dossier, d’enchaînement ni de fichier de sonde ; qui nomme `ctx_shell` ou une sonde reçoit le contrat entier', async () => {
  assert.deepEqual(Object.keys(RUNS_COUVRANTS).sort(), scriptsDeWorkflowDuDepot(RACINE).map(nomDe).sort(), 'chaque script reconnu est joué');
  const executants = [];
  for (const [script, runs] of Object.entries(RUNS_COUVRANTS)) {
    for (const { promptsParLabel } of await Promise.all(runs())) {
      assert.ok(promptsParLabel.size > 0, `${script} : aucun agent atteint`);
      for (const [cle, prompt] of promptsParLabel) {
        assert.doesNotMatch(prompt, INTERDITS_D_EXECUTION, `${script} ${cle}`);
        if (/ctx_shell|\bsondes?\b/.test(prompt)) {
          assert.match(prompt, CONTRAT_D_EXECUTION, `${script} ${cle}`);
          executants.push(script);
        }
      }
    }
  }
  assert.deepEqual([...new Set(executants)].sort(), ['dossier-de-chapitre.js', 'table-simulee.js'], 'témoin : les workflows dont les agents exécutent');
});

/** Par workflow qui rend un verdict : ses verdicts de SUCCÈS, un run témoin qui en rend un, et UNE injection
 *  par espèce de trou, qui la produit. Les espèces se MESURENT aux `trous` que le témoin rend. */
const VERDICTS_DE_SUCCES = {
  'table-simulee.js': {
    succes: ['SIGNAL', 'THÉÂTRE'],
    temoin: () => jouerTable(mjSansFin, analyseSignal()),
    trous: {
      interruption: () => jouerTable((numero, premier, schema) => (numero === 2 ? null : mjSansFin(numero, premier, schema)), analyseSignal()),
      joueursSansRendu: () => jouer('table-simulee.js', ARGS_TABLE, sauf(repondreALaTable(mjSansFin, analyseSignal()), 'joueur:fouineur:1')),
      anomaliesDeSosie: () => jouerTable(mjSansFin, analyseSignal(), ARGS_TABLE, FICHES_PJ, { id: '', ref: 'EDO 02 l.40', motif: 'm' }),
      anomaliesDeTirage: () => jouerTable((numero, premier, schema) => ({ ...mjSansFin(numero, premier, schema), jets: jetsDe(premier + 5, 1) }), analyseSignal()),
      anomaliesDeDeclencheurs: () => jouerTable(mjAuxSorts(() => ({ statut: 'non-echu', motif: '' })), analyseSignal()),
      fuites: () => jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu'), [], (a) => ({ ...a, fuites: [FUITE] }))),
      analyseSansRendu: () => jouerTable(mjSansFin, () => null),
    },
  },
  'dossier-de-chapitre.js': {
    succes: ['DOSSIER'],
    temoin: () => jouerDossier(),
    trous: {
      lentillesSansRendu: () => jouer('dossier-de-chapitre.js', ARGS_DOSSIER, sauf(repondreAuDossier(), 'mecanique')),
      completudeSansRendu: () => jouer('dossier-de-chapitre.js', ARGS_DOSSIER, sauf(repondreAuDossier(), 'completude')),
      anomaliesDeCorrection: () => jouerDossier(ARGS_DOSSIER, { refsFausses: [{ famille: 'declencheurs', id: 'd9', ref: ['EDO 01 l.9'], motif: 'm' }] }),
    },
  },
};

test('CLASSE — un verdict de SUCCÈS ne se rend que sur une liste de trous VIDE : chaque espèce mesurée, injectée, le fait tomber', async () => {
  const aVerdict = scriptsDeWorkflowDuDepot(RACINE).filter((f) => /return\s*\{\s*verdict\b/.test(readFileSync(f, 'utf8'))).map(nomDe).sort();
  assert.deepEqual(Object.keys(VERDICTS_DE_SUCCES).sort(), aVerdict, 'tout workflow qui rend un verdict a sa ligne');
  for (const [script, { succes, temoin, trous }] of Object.entries(VERDICTS_DE_SUCCES)) {
    const nominal = (await temoin()).rendu;
    assert.ok(succes.includes(nominal.verdict), `${script} : témoin au succès (lu : ${nominal.verdict})`);
    const especes = Object.keys(nominal.trous);
    assert.deepEqual(especes.filter((e) => nominal.trous[e].length), [], `${script} : le témoin n’a aucun trou`);
    assert.deepEqual(Object.keys(trous).sort(), [...especes].sort(), `${script} : une injection par espèce MESURÉE aux trous rendus`);
    for (const espece of especes) {
      const { rendu } = await trous[espece]();
      assert.ok(rendu.trous?.[espece]?.length > 0, `${script} / ${espece} : le trou injecté est nommé (trous rendus : ${JSON.stringify(rendu.trous)})`);
      assert.ok(!succes.includes(rendu.verdict), `${script} / ${espece} : verdict ${rendu.verdict} sur un trou`);
    }
  }
});

test('RECONNAISSANCE : l’AST reconnaît les workflows, jamais un générateur ni un banc qui écrit un jouet', () => {
  const lire = (relatif) => lireWorkflow(readFileSync(join(RACINE, relatif), 'utf8'), relatif);
  assert.deepEqual(lire('scripts/docs/build-donnees.mjs'), { script: false, exportDeMeta: null, defauts: [] }, 'un générateur qui écrit « export const meta » dans une chaîne');
  assert.deepEqual(lire('scripts/guards/lib/jouer-workflow.test.mjs'), { script: false, exportDeMeta: null, defauts: [] }, 'un banc qui écrit un jouet');
  assert.deepEqual(lire('scripts/guards/lib/jouer-workflow.mjs'), { script: false, exportDeMeta: null, defauts: [] }, 'l’enveloppe, qui DÉCLARE la doublure `agent`');
  const scripts = scriptsDeWorkflowDuDepot(RACINE);
  assert.ok(scripts.includes(join(RACINE, 'scripts', 'raw', 'atlas-domain.workflow.js')), 'un workflow HORS de .claude/workflows/ est vu');
  assert.deepEqual(scripts.filter(estSuiteVitest), [], 'aucun test n’est pris pour un workflow');
});
