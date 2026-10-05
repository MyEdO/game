// LES SCRIPTS DE WORKFLOW, JOUÉS AVEC DES DOUBLURES — sans un seul agent.
//
// Un script de `.claude/workflows/` est du JavaScript pur qu'aucun `import` ne peut charger
// (`export const meta` d'un côté, `return` de premier niveau de l'autre : le harnais l'enveloppe
// dans une fonction async). Ces tests l'enveloppent DE LA MÊME FAÇON et lui donnent des doublures
// pour `agent`/`parallel`/`pipeline` : ce qui est vérifié est ce que le script REND et ce qu'il
// ENVOIE, pas une réécriture de l'un ou de l'autre dans un test.
//
// `workflows.test.mjs` juge leur FORME (sans les exécuter), racine du schéma de chaque site comprise,
// et exige que chaque script reconnu soit nommé par un banc ; ce fichier-ci juge leur COMPORTEMENT,
// et l'enveloppe applique le même jugement de racine à l'objet SÉRIALISÉ que reçoit chaque agent
// atteint : un banc dont un agent reçoit une racine fautive est rouge.
//
// Ce qui s'y joue : `table-simulee` consomme-t-elle le dossier, refuse-t-elle des ids de PJ confondus,
// cloisonne-t-elle ses joueurs, enchaîne-t-elle les tirages, dérive-t-elle son plafond du dossier, tait-elle le plafond au MJ et aux joueurs
// (prompt ET options de chaque appel, copiés à l'appel : schéma, type d'agent, modèle, effort),
// contraint-elle PAR LE SCHÉMA de chaque appel toute désignation d'un ensemble fermé (PJ, déclencheur
// en attente, beat, persona, secret, échange, sosie), tient-elle un état par déclencheur et fait-elle
// d'une fuite de secret une anomalie ; `dossier-de-chapitre` rend-il une fiche au schéma `ficheDeDossier`
// sur des formes PROJETÉES par le lanceur (`scripts/raw/workflow-args.mjs`), keye-t-il chaque lecture au
// label de sa lentille, APPLIQUE-t-il les corrections de son juge de complétude, et sa fiche s'écrit-elle
// par le lanceur pour armer la table ; tout agent de tout workflow exécute-t-il une commande simple ; un
// verdict de SUCCÈS se rend-il jamais sur un trou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs';
import { lireWorkflow } from '../guards/lib/formeDeWorkflow.mjs';
import { jouerWorkflow, scriptsDeWorkflowDuDepot } from '../guards/lib/jouer-workflow.mjs';
import { tableTotale } from '../../src/lib/tableTotale.ts';
import { FAMILLES_DE_DOSSIER, ficheDeDossier } from '../../src/data/source/dossier.ts';
import { argsDeDossierDeChapitre, argsDeTableSimulee, ecrireFiche } from '../raw/workflow-args.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DOSSIER = join(RACINE, '.claude', 'workflows');
const DATE = '2026-09-04';
// Chemins de FIXTURE : les scripts ne les OUVRENT pas, ils les recopient dans leurs prompts. Ils
// s'écrivent sans lettre de lecteur — une fixture ne nomme aucune machine
// (`src/portable-paths-guard.test.ts`).
const ARBRE = '/arbre-jete';
const COMMIT = 'f6e343dc8abf36a9d34cc3fd13de60af3d9ac894';

/** Joue un script de `.claude/workflows/` — l'enveloppe vit dans `scripts/guards/lib/jouer-workflow.mjs`. */
const jouer = (nomDuScript, argsDuRun, repondre) => jouerWorkflow(join(DOSSIER, nomDuScript), argsDuRun, repondre);

// ── `table-simulee.js` ───────────────────────────────────────────────────────────────────────────

const SECRET = 'SECRET-DU-MJ-QUE-LES-JOUEURS-IGNORENT';
const D1 = { id: 'd1', evenement: 'Le PNJ approche la table des PJ', condition: 'les PJ l’ignorent une demi-heure', ref: ['EDO 01 l.200'] };
/** La FICHE commitée d'un chapitre (`ficheDeDossier`) : ce que la table consomme. */
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
const ARGS_TABLE_PERSONAS = ['rôliste', 'fouineur', 'saboteur', 'hors-cadre'];
const FICHES_PJ = {
  pjs: ['pregen-101', 'pregen-202', 'pregen-707', 'pregen-303'].map((id) => ({ id, nom: id, espece: 'humain', carriere: 'c', fiche: `fiche de ${id}` })),
  groupe: { source: 'makeShowcaseParty', commande: 'npx tsx sonde.mts' },
};
const IDS_DES_PJ = FICHES_PJ.pjs.map((pj) => pj.id);
const SANS_SOSIE = { id: '', ref: '', motif: 'aucun passage du chapitre ne fait ressembler un PJ à un PNJ' };
const jetsDe = (premier, n) => Array.from({ length: n }, (_, i) => ({
  tirage: premier + i, objet: 'o', commande: `npx tsx scripts/ops/table-des.mts simple --seed "graine" --tirage ${premier + i}`, sortie: '{}',
}));

/** Le texte JSON d'un prompt entre deux marqueurs : ce que le script ENVOIE au juge. */
const jsonEntre = (prompt, debut, fin) => JSON.parse(prompt.slice(prompt.indexOf(debut) + debut.length, prompt.indexOf(fin)));
const journalEnvoye = (prompt) => jsonEntre(prompt, 'JOURNAL COMPLET :\n', '\n\nDÉCLENCHEURS NON JOUÉS OU ÉCARTÉS');
const declencheursEnvoyes = (prompt) => jsonEntre(prompt, 'DÉCLENCHEURS NON JOUÉS OU ÉCARTÉS :\n', '\n\nRends :');
/** Ce qu'un objet d'un schéma admet : `additionalProperties`, les clés EXIGÉES, les clés décrites. */
const clesDe = (objet) => [objet.additionalProperties, objet.required, Object.keys(objet.properties)];

/**
 * Un juge d'analyse au CONTRAT, à la forme du schéma qu'il REÇOIT : chaque intention exigée classée,
 * chaque déclencheur exigé jugé, aucune fuite. `classeDe(persona, echange)` rend la classe ;
 * `retouche(analyse)` altère le rendu (fuite…).
 */
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

/** `mjDe(numero, premierTirage, schema)` décide le rendu du MJ ; `analyseDe(prompt, opts)` celui du juge. */
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
/** Les clés que le schéma du MJ EXIGE à cet échange : les PJ à résoudre, les déclencheurs en attente. */
const pjsExiges = (schema) => schema.properties.resolutions.required;
const declencheursExiges = (schema) => schema.properties.tour.properties.declencheurs.required;
/** Le MJ au CONTRAT, à la forme du schéma qu'il REÇOIT : une résolution par PJ exigé, deux jets à la suite,
 *  un sort `non-echu` motivé par déclencheur exigé. */
const mjSansFin = (numero, premier, schema) => ({
  resolutions: tableTotale(pjsExiges(schema), () => RESOLUTION),
  jets: jetsDe(premier, 2),
  tour: { narration: `narration ${numero}`, etatPrive: 'état', beat: 'b1', declencheurs: tableTotale(declencheursExiges(schema), () => ({ statut: 'non-echu', motif: 'la demi-heure court' })) },
  fin: false,
});
const mjQuiFinit = (numero, premier, schema) => ({ ...mjSansFin(numero, premier, schema), fin: true });
/** Le MJ rend, à l'échange `n`, le sort `sortDe(n, id)` de chaque déclencheur exigé — le reste de son rendu est celui de `mjSansFin`. */
const mjAuxSorts = (sortDe) => (numero, premier, schema) => {
  const mj = mjSansFin(numero, premier, schema);
  return { ...mj, tour: { ...mj.tour, declencheurs: tableTotale(declencheursExiges(schema), (id) => sortDe(numero, id)) } };
};
/** Le juge qui classe un refus du saboteur : sur une partie sans trou, SIGNAL. */
const analyseSignal = (classes = []) => analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu'), classes);
const FUITE = { echange: 2, secret: 'sec1', constat: 'la narration nomme le secret, aucun indice trouvé n’y mène' };

test('table-simulee : les joueurs sont CLOISONNÉS — aucun prompt de joueur ne porte la fiche du MJ ni le livre', async () => {
  const { promptsParLabel } = await jouerTable(mjSansFin);
  const joueurs = [...promptsParLabel].filter(([cle]) => cle.startsWith('Partie:joueur:'));
  assert.equal(joueurs.length, 8, 'deux échanges de joueurs, quatre joueurs chacun');
  for (const [cle, prompt] of joueurs) {
    assert.ok(!prompt.includes(SECRET), `${cle} porte la fiche du MJ`);
    assert.ok(!prompt.includes('Source/chapitre-01.md'), `${cle} porte le chemin du livre`);
  }
  assert.ok(promptsParLabel.get('Partie:mj:1').includes(SECRET), 'le MJ, lui, reçoit sa fiche');
});

test('table-simulee : la fixture est une fiche au schéma, et la fiche du MJ en est TIRÉE, sans agent qui la ré-extrait', async () => {
  assert.deepEqual(ficheDeDossier.parse(DOSSIER_DU_CHAPITRE), DOSSIER_DU_CHAPITRE, 'la fixture est une fiche commitable');
  const { promptsParLabel, rendu } = await jouerTable(mjSansFin);
  assert.deepEqual([...promptsParLabel.keys()].filter((c) => c.startsWith('Préparation:')), ['Préparation:fiches-pj', 'Préparation:sosie']);
  const mj = promptsParLabel.get('Partie:mj:1');
  const fiche = jsonEntre(mj, 'dossier du chapitre) :\n', '\n\nDÉCLENCHEURS DU LIVRE');
  assert.deepEqual(fiche, {
    imperatifs: DOSSIER_DU_CHAPITRE.imperatifs, beats: DOSSIER_DU_CHAPITRE.beats, pnj: DOSSIER_DU_CHAPITRE.pnj, indices: DOSSIER_DU_CHAPITRE.indices,
    secrets: DOSSIER_DU_CHAPITRE.secrets, pointsAuMJ: [],
  });
  assert.deepEqual(rendu.journal.preparation.ficheMJ.declencheurs, [D1]);
});

test('table-simulee : un dossier absent ou incomplet ARRÊTE avant tout agent, et se nomme', async () => {
  const cas = [
    [undefined, /^args\.dossier — l'objet de la fiche commitée du chapitre \(docs\/dossiers\/<livre>\/<chapitre>\.json, la fiche du MJ en est tirée\) : node scripts\/raw\/workflow-args\.mjs table-simulee /],
    [{ ...DOSSIER_DU_CHAPITRE, declencheurs: undefined }, /^args\.dossier\.declencheurs absent — la fiche du chapitre vient du lanceur : node scripts\/raw\/workflow-args\.mjs table-simulee /],
    [{ ...DOSSIER_DU_CHAPITRE, beats: [] }, /^args\.dossier\.beats vide/],
  ];
  for (const [dossier, attendu] of cas) {
    const { rendu, promptsParLabel } = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, dossier });
    assert.equal(rendu.verdict, 'ARRÊT', String(attendu));
    assert.equal(promptsParLabel.size, 0, String(attendu));
    assert.equal(rendu.manques.length, 1, rendu.manques.join(' · '));
    assert.match(rendu.manques[0], attendu);
    assert.deepEqual([rendu.declencheursNonJoues, rendu.declencheursEcartes], [[], []], 'un ARRÊT porte la forme du retour, vide');
  }
});

test('table-simulee : les tirages se suivent d’un échange à l’autre, et le plafond se DIT au journal', async () => {
  const { rendu, promptsParLabel, journal } = await jouerTable(mjSansFin);
  assert.match(promptsParLabel.get('Partie:mj:2'), /commencent à 2 /);
  assert.match(promptsParLabel.get('Partie:mj:3'), /commencent à 4 /);
  assert.equal(rendu.journal.tiragesConsommes, 6);
  assert.equal(rendu.journal.plafondAtteint, true);
  assert.equal(rendu.journal.interrompue, null);
  assert.equal(rendu.agents.mj, 3);
  assert.equal(rendu.agents.joueurs, 8, 'aucun joueur ne joue après le dernier échange du MJ');
  assert.ok(journal.some((l) => /plafond de 3 échanges atteint SANS fin de chapitre/.test(l)));
});

test('table-simulee : le MJ et les joueurs IGNORENT le plafond — chacun de leurs appels (prompt, schéma, type d’agent, modèle, effort) est identique à l’octet sous deux plafonds ; le juge sait que la partie s’y est arrêtée', async () => {
  const plafonnee = await jouerTable(mjSansFin);
  const plusLongue = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, maxEchanges: 4 });
  assert.ok(plusLongue.promptsParLabel.has('Partie:mj:4'), 'témoin : la partie au plafond 4 joue un échange de plus');
  /** Ce qu'un agent REÇOIT à un appel, sérialisé : son prompt et ses options entières. */
  const appel = (partie, cle) => JSON.stringify({ prompt: partie.promptsParLabel.get(cle), options: partie.optionsParLabel.get(cle) });
  const mjs = [1, 2, 3].map((numero) => `Partie:mj:${numero}`);
  const joueurs = [...plafonnee.promptsParLabel.keys()].filter((cle) => cle.startsWith('Partie:joueur:'));
  assert.equal(joueurs.length, 8, 'témoin : deux échanges de quatre joueurs sous le plafond 3');
  for (const cle of [...mjs, ...joueurs]) {
    assert.ok(plafonnee.promptsParLabel.has(cle), `témoin : ${cle} joué sous le plafond 3`);
    assert.ok(plafonnee.optionsParLabel.get(cle).schema, `témoin : ${cle} porte son schéma`);
    assert.equal(appel(plafonnee, cle), appel(plusLongue, cle), `${cle} dépend du plafond`);
  }
  assert.match(plafonnee.promptsParLabel.get('Partie:mj:3'), /`fin: true` quand le chapitre est clos selon le livre\./);
  const auJuge = plafonnee.promptsParLabel.get('Analyse:analyse');
  assert.equal(journalEnvoye(auJuge).plafondAtteint, true);
  assert.match(auJuge, /La partie s'est arrêtée au plafond de 3 échanges \(`plafondAtteint`\), chapitre non clos : un beat qu'elle n'a pas atteint n'est pas un temps mort\./);
  const close = (await jouerTable(mjQuiFinit)).promptsParLabel.get('Analyse:analyse');
  assert.equal(journalEnvoye(close).plafondAtteint, false);
  assert.doesNotMatch(close, /un beat qu'elle n'a pas atteint/, 'une partie close au livre n’excuse aucun beat');
});

test('table-simulee : sans `args.maxEchanges`, le plafond se DÉRIVE du dossier (3 échanges par beat) ; un plafond explicite, entier ≥ 1, prime ; le MJ et les joueurs l’ignorent', async () => {
  const { maxEchanges, ...sansPlafond } = ARGS_TABLE;
  assert.equal(maxEchanges, 3, 'témoin : le banc joue sous un plafond explicite');
  const dossierA = (n) => ({ ...DOSSIER_DU_CHAPITRE, beats: Array.from({ length: n }, (_, rang) => ({ ...DOSSIER_DU_CHAPITRE.beats[0], id: `b${rang + 1}` })) });
  for (const n of [1, 3]) {
    const { rendu, promptsParLabel } = await jouerTable(mjSansFin, analyseCouvrante(), { ...sansPlafond, dossier: dossierA(n) });
    assert.deepEqual([rendu.journal.maxEchanges, rendu.agents.mj, rendu.journal.plafondAtteint], [3 * n, 3 * n, true], `${n} beat(s)`);
    assert.ok(!promptsParLabel.has(`Partie:mj:${3 * n + 1}`), `${n} beat(s) : aucun MJ au-delà du plafond dérivé`);
  }
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante(), { ...sansPlafond, maxEchanges: null })).rendu.journal.maxEchanges, 6, '`null` vaut absence');
  for (const explicite of [1, 7]) {
    assert.equal((await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, maxEchanges: explicite })).rendu.journal.maxEchanges, explicite, `explicite ${explicite}`);
  }
  for (const invalide of [0, -2, 2.5, 'beaucoup', true, [7]]) {
    const { rendu, promptsParLabel } = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, maxEchanges: invalide });
    assert.equal(rendu.verdict, 'ARRÊT', String(invalide));
    assert.deepEqual(rendu.manques, [`args.maxEchanges — entier ≥ 1 (reçu « ${invalide} »)`]);
    assert.equal(promptsParLabel.size, 0);
  }
  const derive = await jouerTable(mjSansFin, analyseCouvrante(), sansPlafond);
  const explicite = await jouerTable(mjSansFin);
  assert.deepEqual([derive.rendu.journal.maxEchanges, explicite.rendu.journal.maxEchanges], [6, 3], 'témoin : deux beats, deux plafonds');
  const appel = (partie, cle) => JSON.stringify({ prompt: partie.promptsParLabel.get(cle), options: partie.optionsParLabel.get(cle) });
  const communs = [...explicite.promptsParLabel.keys()].filter((cle) => cle.startsWith('Partie:'));
  assert.equal(communs.length, 3 + 8, 'témoin : trois MJ et deux salves de joueurs sous le plafond explicite');
  for (const cle of communs) assert.equal(appel(derive, cle), appel(explicite, cle), `${cle} dépend du plafond dérivé`);
});

test('table-simulee : un tirage hors suite est une anomalie journalisée', async () => {
  const { rendu, journal } = await jouerTable((numero, premier, schema) => ({ ...mjQuiFinit(numero, premier, schema), jets: jetsDe(premier + 5, 1) }));
  assert.deepEqual(rendu.journal.echanges[0].anomaliesDeTirage, ['jet 1 : tirage 5, attendu 0']);
  assert.ok(journal.some((l) => /1 anomalie\(s\) de tirage/.test(l)));
});

test('table-simulee : THÉÂTRE tant que les personas ADVERSES n’ont ni refus ni hors livre, SIGNAL sinon', async () => {
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'saboteur' ? 'IMPRO' : 'prevu')))).rendu.verdict, 'THÉÂTRE');
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'rôliste' ? 'hors-livre' : 'prevu')))).rendu.verdict, 'THÉÂTRE', 'rôliste hors livre, adverses au livre');
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'fouineur' ? 'refuse' : 'prevu')))).rendu.verdict, 'THÉÂTRE', 'fouineur refusé, adverses au livre');
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'hors-cadre' ? 'hors-livre' : 'prevu')))).rendu.verdict, 'SIGNAL');
  assert.equal((await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu')))).rendu.verdict, 'SIGNAL');
});

test('table-simulee : le schéma du JUGE exige chaque intention du journal sous (échange, persona) et chaque déclencheur à juger sous son id ; il n’admet que les beats, échanges, personas et secrets de la table', async () => {
  const { optionsParLabel, promptsParLabel, rendu } = await jouerTable(mjSansFin, analyseSignal());
  const { intentions, declencheurs, besoins, fuites, tempsMorts } = optionsParLabel.get('Analyse:analyse').schema.properties;
  const salves = journalEnvoye(promptsParLabel.get('Analyse:analyse')).echanges.filter((e) => e.intentions.length).map((e) => [String(e.numero), e.intentions.map((i) => i.persona)]);
  assert.deepEqual(salves, [['2', ARGS_TABLE_PERSONAS], ['3', ARGS_TABLE_PERSONAS]], 'témoin : le journal porte deux salves d’intentions');
  assert.deepEqual(clesDe(intentions), [false, ['2', '3'], ['2', '3']]);
  for (const [numero, personas] of salves) assert.deepEqual(clesDe(intentions.properties[numero]), [false, personas, personas], `échange ${numero}`);
  assert.deepEqual(intentions.properties['2'].properties.saboteur.required, ['classe', 'ref', 'categorie']);
  assert.deepEqual(clesDe(declencheurs), [false, ['d1'], ['d1']]);
  assert.deepEqual(besoins.items.properties.personas, { type: 'array', uniqueItems: true, items: { enum: ARGS_TABLE_PERSONAS } });
  assert.deepEqual([fuites.items.properties.echange, fuites.items.properties.secret], [{ enum: [1, 2, 3] }, { enum: ['sec1'] }]);
  assert.deepEqual([tempsMorts.items.properties.beats.items, tempsMorts.items.properties.echanges.items], [{ enum: ['b1', 'b2'] }, { enum: [1, 2, 3] }]);
  assert.deepEqual(rendu.analyse.intentions[0], { echange: 2, persona: 'rôliste', intention: 'intention de joueur:rôliste:1', classe: 'prevu', ref: '', categorie: '' }, 'le classement revient à la forme du journal');
  assert.equal(rendu.analyse.intentions.length, 8);

  const courte = await jouerTable(mjAuxSorts(() => ({ statut: 'joue', motif: '' })), analyseCouvrante(), { ...ARGS_TABLE, maxEchanges: 1 });
  const schemaCourt = courte.optionsParLabel.get('Analyse:analyse').schema.properties;
  assert.deepEqual([clesDe(schemaCourt.intentions), clesDe(schemaCourt.declencheurs)], [[false, [], []], [false, [], []]], 'une ouverture sans intention, un déclencheur joué : aucune clé exigée');
  assert.deepEqual(schemaCourt.fuites.items.properties.echange, { enum: [1] });
  assert.deepEqual([courte.rendu.analyse.intentions, courte.rendu.analyse.declencheurs], [[], []]);
});

test('table-simulee : un besoin est retenu par DEUX personas ou par le livre, jamais autrement', async () => {
  const { rendu } = await jouerTable(mjSansFin, analyseCouvrante(() => 'prevu', [
    { besoin: 'deux personas', personas: ['saboteur', 'fouineur'], ref: '' },
    { besoin: 'une persona', personas: ['saboteur'], ref: '' },
    { besoin: 'le livre la prévoit', personas: ['hors-cadre'], ref: 'EDO 01 l.9' },
  ]));
  assert.deepEqual(rendu.analyse.besoins.map((b) => b.retenu), [true, false, true]);
});

test('table-simulee : l’auteur des fiches des PJ ne voit ni le chapitre, ni le Source/, ni la ressemblance (EDO 02 l.40)', async () => {
  const { promptsParLabel } = await jouerTable(mjSansFin);
  const auteur = promptsParLabel.get('Préparation:fiches-pj');
  assert.ok(auteur, 'le lecteur des fiches des PJ est dispatché');
  assert.ok(!auteur.includes('Source/chapitre-01.md'), 'il porte le chemin du chapitre');
  assert.ok(!auteur.includes('Source/'), 'il nomme le Source/');
  assert.ok(!auteur.includes('EDO'), 'il nomme le livre');
  assert.ok(!auteur.includes(SECRET), 'il porte le dossier du chapitre');
  assert.doesNotMatch(auteur, /sosie|ressembl/i, 'il nomme la ressemblance');
  const choixDuSosie = promptsParLabel.get('Préparation:sosie');
  assert.match(choixDuSosie, /"id": "pregen-707",\n {2}"nom": "pregen-707",\n {2}"espece": "humain",\n {2}"carriere": "c"/, 'le choix du sosie reçoit la LISTE des PJ');
  assert.ok(choixDuSosie.includes(SECRET) && choixDuSosie.includes('Phillipe'), 'et le dossier du chapitre');
  assert.ok(!choixDuSosie.includes('fiche de pregen-707'), 'jamais leurs fiches');
});

test('table-simulee : la fiche du joueur est la sortie de l’auteur des fiches À L’OCTET, quel que soit le secret du MJ', async () => {
  const uneLigne = {
    ...FICHES_PJ,
    pjs: FICHES_PJ.pjs.map((pj) => ({ ...pj, fiche: `${pj.id} · Combat 45 · Tir 30 · ressemble à son père` })),
  };
  const secretHorsVocabulaire = { id: 'pregen-707', ref: 'EDO 02 l.40', motif: 'portrait craché du mort, double parfait, K. L.' };
  const { promptsParLabel, rendu } = await jouerTable(mjSansFin, analyseCouvrante(), ARGS_TABLE, uneLigne, secretHorsVocabulaire);
  const joueurs = [...promptsParLabel].filter(([cle]) => cle.startsWith('Partie:joueur:'));
  assert.equal(joueurs.length, 8);
  for (const [cle, prompt] of joueurs) {
    const persona = cle.split(':')[2];
    const attendue = uneLigne.pjs[ARGS_TABLE_PERSONAS.indexOf(persona)].fiche;
    const recue = prompt.slice(prompt.indexOf('TA FICHE :\n') + 'TA FICHE :\n'.length, prompt.indexOf('\n\nTES NOTES PRIVÉES'));
    assert.equal(recue, attendue, `${cle} : la fiche reçue n’est pas celle de l’auteur des fiches`);
    assert.ok(!prompt.includes('portrait craché'), `${cle} porte le secret du MJ`);
    assert.ok(!prompt.includes('SOSIE'), `${cle} porte la marque du MJ`);
  }
  const mj = promptsParLabel.get('Partie:mj:1');
  assert.match(mj, /### pregen-707 \(pregen-707\) — SOSIE \(secret du MJ\)\npregen-707 · Combat 45/);
  assert.equal((mj.match(/SOSIE \(secret du MJ\)/g) || []).length, 1, 'un seul PJ marqué');
  assert.ok(mj.includes('portrait craché'), 'le MJ reçoit le motif du sosie');
  assert.deepEqual(rendu.journal.joueurs.map((j) => j.sosie), [false, false, true, false]);
});

test('table-simulee : le MJ et les joueurs ne connaissent un joueur que par son PJ — aucune persona hors de la ligne « TA PERSONA », remap au journal', async () => {
  let gestes = 0;
  const { promptsParLabel, rendu } = await jouer('table-simulee.js', ARGS_TABLE, (prompt, opts) => {
    if (opts.phase !== 'Partie' || opts.label.startsWith('mj:')) return repondreALaTable(mjSansFin)(prompt, opts);
    gestes += 1;
    return { jeu: { intention: `geste ${gestes}`, notes: `carnet ${gestes}` } };
  });
  const vus = [...promptsParLabel].filter(([cle]) => cle.startsWith('Partie:mj:') || cle.startsWith('Partie:joueur:'));
  assert.equal(vus.length, 3 + 8);
  for (const [cle, prompt] of vus) {
    const lignes = prompt.split('\n').filter((l) => !l.startsWith('TA PERSONA — '));
    for (const persona of ARGS_TABLE_PERSONAS) {
      assert.ok(!lignes.some((l) => l.toLowerCase().includes(persona)), `${cle} porte la persona « ${persona} »`);
    }
  }
  assert.match(promptsParLabel.get('Partie:mj:2'), /^- pregen-707 \(pregen-707\) : geste \d+$/m, 'le MJ reçoit chaque intention sous son PJ');
  assert.match(promptsParLabel.get('Partie:joueur:rôliste:2'), /Intentions : pregen-101 \(pregen-101\) : geste \d+ \| pregen-202/, 'les échanges publics désignent les joueurs par leur PJ');
  assert.deepEqual(
    rendu.journal.echanges[1].resolutions.map((r) => [r.pj, r.persona, r.intention]),
    rendu.journal.echanges[1].intentions.map((i) => [i.pj, i.persona, i.intention]),
    'le journal remappe chaque résolution sur la persona et l’intention de son PJ',
  );
  assert.deepEqual(rendu.journal.echanges[1].resolutions.map((r) => r.persona), ARGS_TABLE_PERSONAS);
});

test('table-simulee : le schéma du MJ exige UNE résolution par PJ qui a une intention, sous son id NU, et UN sort par déclencheur EN ATTENTE, sous son id — l’ensemble suit la partie', async () => {
  const dossier = { ...DOSSIER_DU_CHAPITRE, declencheurs: [D1, { ...D1, id: 'd2', evenement: 'Le relais brûle' }] };
  const sortDe = (numero, id) => (numero === 1 && id === 'd1' ? { statut: 'joue', motif: '' } : { statut: 'non-echu', motif: 'm' });
  const { optionsParLabel, promptsParLabel, rendu } = await jouerTable(mjAuxSorts(sortDe), analyseCouvrante(), { ...ARGS_TABLE, dossier });
  const schemaDe = (numero) => optionsParLabel.get(`Partie:mj:${numero}`).schema.properties;
  assert.deepEqual(clesDe(schemaDe(1).resolutions), [false, [], []], 'l’ouverture : aucune intention, aucune clé');
  assert.deepEqual(clesDe(schemaDe(2).resolutions), [false, IDS_DES_PJ, IDS_DES_PJ], 'une salve d’intentions : chaque PJ, exigé');
  assert.deepEqual(schemaDe(2).resolutions.properties['pregen-707'].required, ['source', 'ref', 'categorie', 'resolution']);
  assert.deepEqual(clesDe(schemaDe(1).tour.properties.declencheurs), [false, ['d1', 'd2'], ['d1', 'd2']]);
  assert.deepEqual(clesDe(schemaDe(2).tour.properties.declencheurs), [false, ['d2'], ['d2']], 'un déclencheur JOUÉ sort des clés');
  assert.deepEqual(schemaDe(2).tour.properties.declencheurs.properties.d2.required, ['statut', 'motif']);
  assert.deepEqual(schemaDe(1).tour.properties.beat, { enum: ['b1', 'b2'] });
  const mj2 = promptsParLabel.get('Partie:mj:2');
  assert.match(mj2, /`resolutions` est un objet dont chaque clé est l'id NU d'un PJ qui a une intention ci-dessus \(`pregen-101`, `pregen-202`, `pregen-707`, `pregen-303`\), jamais sa désignation « Nom \(id\) »/);
  assert.match(mj2, /`tour\.declencheurs` est un objet dont chaque clé est l'id NU d'un déclencheur EN ATTENTE \(`d2`\)/);
  assert.match(promptsParLabel.get('Partie:mj:1'), /`resolutions` est un objet [^\n]*\(aucune clé : l'objet est vide\)/);
  assert.deepEqual(rendu.journal.echanges.map((e) => e.declencheurs), [
    [{ id: 'd1', statut: 'joue', motif: '' }, { id: 'd2', statut: 'non-echu', motif: 'm' }],
    [{ id: 'd2', statut: 'non-echu', motif: 'm' }],
    [{ id: 'd2', statut: 'non-echu', motif: 'm' }],
  ], 'le journal garde un tableau de sorts, un par déclencheur en attente');
  assert.deepEqual(rendu.journal.echanges[1].resolutions[0], { persona: 'rôliste', pj: 'pregen-101', intention: 'intention de joueur:rôliste:1', ...RESOLUTION });
});

test('table-simulee : un id de PJ vide ou en double, rendu par les fiches des PJ, ARRÊTE avant la partie et se nomme', async () => {
  const cas = [
    [['pregen-101', 'pregen-202', 'pregen-707', 'pregen-707'], ['fiches des PJ — id « pregen-707 » en double']],
    [['pregen-101', 'pregen-202', '', ' '], ['fiches des PJ — PJ 3 (« N2 ») sans id', 'fiches des PJ — PJ 4 (« N3 ») sans id']],
  ];
  for (const [ids, manques] of cas) {
    const fiches = { ...FICHES_PJ, pjs: ids.map((id, rang) => ({ id, nom: `N${rang}`, espece: 'humain', carriere: 'c', fiche: `fiche ${rang}` })) };
    const { rendu, promptsParLabel, journal } = await jouerTable(mjSansFin, analyseCouvrante(), ARGS_TABLE, fiches);
    assert.equal(rendu.verdict, 'ARRÊT', ids.join(','));
    assert.deepEqual(rendu.manques, manques);
    assert.deepEqual([...promptsParLabel.keys()], ['Préparation:fiches-pj'], 'aucun agent après les fiches');
    assert.ok(journal.some((l) => /^ARRÊT : \d+ id\(s\) de PJ invalide\(s\)/.test(l)), journal.join('\n'));
  }
});

test('table-simulee : le schéma du sosie n’admet qu’un id de la table ou vide ; le motif d’une ABSENCE entre au journal, un id vide qui cite un passage est une ANOMALIE, et le MJ ne reçoit aucun sosie', async () => {
  const { optionsParLabel, promptsParLabel } = await jouerTable(mjSansFin);
  assert.deepEqual(optionsParLabel.get('Préparation:sosie').schema.properties.sosie.properties.id, { enum: ['', ...IDS_DES_PJ] });
  assert.match(promptsParLabel.get('Préparation:sosie'), /`id` = son id NU dans la liste ci-dessus, `ref` = la réf nue du passage qui le désigne \(relis-le au Source\/\)\. Sans sosie, `id` = '' et `ref` = ''\. `motif` est toujours renseigné : pourquoi ce PJ, ou pourquoi aucun\./);
  const cas = [
    [{ id: '', ref: 'EDO 02 l.40', motif: 'aucun PJ ne convient' }, ['id vide avec ref « EDO 02 l.40 » : un passage cité sans PJ désigné']],
    [{ id: '', ref: '', motif: 'sonde du chapitre sans passage de ressemblance ; le sosie relève d’EDO 02' }, []],
    [{ id: '', ref: ' ', motif: 'ref blanche, aucun passage cité' }, []],
    [SANS_SOSIE, []],
  ];
  for (const [sosieRendu, anomalies] of cas) {
    const { promptsParLabel: prompts, rendu, journal } = await jouerTable(mjSansFin, analyseCouvrante(), ARGS_TABLE, FICHES_PJ, sosieRendu);
    assert.deepEqual(rendu.journal.preparation.anomaliesDeSosie, anomalies, sosieRendu.motif || 'sans motif');
    assert.deepEqual(rendu.trous.anomaliesDeSosie, anomalies, 'le trou du run');
    assert.equal(rendu.verdict === 'PARTIE ANOMALE', anomalies.length > 0, `verdict ${rendu.verdict}`);
    assert.deepEqual(rendu.journal.preparation.sosie, sosieRendu, 'le choix rendu, motif compris, entre au journal');
    assert.deepEqual(rendu.journal.joueurs.map((j) => j.sosie), [false, false, false, false]);
    const mj = prompts.get('Partie:mj:1');
    assert.doesNotMatch(mj, /"sosie"|SOSIE \(secret du MJ\)/, 'le MJ reçoit un sosie qui ne désigne aucun PJ');
    assert.ok(!mj.includes(sosieRendu.motif || 'motif-absent'), 'le motif d’un sosie écarté atteint le MJ');
    assert.equal(journal.some((l) => /anomalie de sosie/.test(l)), anomalies.length > 0);
  }
});

test('table-simulee : un choix du sosie sans rendu ARRÊTE avant la partie, et se nomme', async () => {
  const { rendu, promptsParLabel } = await jouer('table-simulee.js', ARGS_TABLE, (prompt, opts) => (opts.label === 'fiches-pj' ? FICHES_PJ : null));
  assert.equal(rendu.verdict, 'ARRÊT');
  assert.deepEqual(rendu.manques, ['choix du sosie sans rendu']);
  assert.deepEqual([...promptsParLabel.keys()], ['Préparation:fiches-pj', 'Préparation:sosie']);
});

test('table-simulee : les DÉCLENCHEURS du dossier (EDO 01 l.200) atteignent le MJ, et JOUÉ se relit', async () => {
  const { promptsParLabel, optionsParLabel, rendu } = await jouerTable(mjAuxSorts((n) => (n === 1 ? { statut: 'joue', motif: 'la demi-heure est écoulée' } : { statut: 'non-echu', motif: 'm' })));
  const mj1 = promptsParLabel.get('Partie:mj:1');
  assert.match(mj1, /DÉCLENCHEURS DU LIVRE[^\n]*:\n- d1 — Le PNJ approche la table des PJ — condition : les PJ l’ignorent une demi-heure \(EDO 01 l\.200\) — en attente/);
  assert.match(mj1, /AVANT de résoudre les intentions, relis les déclencheurs en attente : tout déclencheur ÉCHU/);
  assert.match(promptsParLabel.get('Partie:mj:2'), /- d1 — [^\n]* — JOUÉ à l'échange 1\n/, 'le MJ relit les déclencheurs déjà joués');
  assert.ok(optionsParLabel.get('Partie:mj:1').schema.properties.tour.required.includes('declencheurs'));
  assert.deepEqual(rendu.journal.echanges.map((e) => e.anomaliesDeDeclencheurs), [[], [], []]);
  assert.deepEqual([rendu.declencheursNonJoues, rendu.declencheursEcartes], [[], []]);
});

test('table-simulee : chaque déclencheur a UN état — non-échu reste en attente, écarté se dit et sort des clés, un sort non joué sans motif est une anomalie', async () => {
  const nonEchu = await jouerTable(mjAuxSorts((n) => (n === 1 ? { statut: 'non-echu', motif: 'la demi-heure court' } : { statut: 'joue', motif: 'm' })));
  assert.match(nonEchu.promptsParLabel.get('Partie:mj:2'), /- d1 — [^\n]* — en attente\n/, 'non-echu ne marque pas JOUÉ');
  assert.match(nonEchu.promptsParLabel.get('Partie:mj:3'), /- d1 — [^\n]* — JOUÉ à l'échange 2\n/);

  const ecarte = await jouerTable(mjAuxSorts(() => ({ statut: 'ecarte', motif: 'Phillipe est mort' })));
  assert.match(ecarte.promptsParLabel.get('Partie:mj:2'), /- d1 — [^\n]* — ÉCARTÉ à l'échange 1 — Phillipe est mort\n/);
  assert.deepEqual(clesDe(ecarte.optionsParLabel.get('Partie:mj:2').schema.properties.tour.properties.declencheurs), [false, [], []], 'un déclencheur ÉCARTÉ ne reçoit plus de sort');
  assert.deepEqual(ecarte.rendu.declencheursEcartes, [{ id: 'd1', evenement: D1.evenement, ref: ['EDO 01 l.200'], echange: 1, motif: 'Phillipe est mort' }]);
  assert.deepEqual(ecarte.rendu.declencheursNonJoues, []);

  const sansMotif = await jouerTable(mjAuxSorts((n) => (n === 1 ? { statut: 'non-echu', motif: ' ' } : { statut: 'ecarte', motif: '' })));
  assert.deepEqual(sansMotif.rendu.journal.echanges.map((e) => e.anomaliesDeDeclencheurs), [
    ['déclencheur « d1 » : statut « non-echu » sans motif'],
    ['déclencheur « d1 » : statut « ecarte » sans motif'],
    [],
  ]);
});

test('table-simulee : un déclencheur JAMAIS joué ou ÉCARTÉ est rendu, journalisé et soumis au juge d’analyse, sous son id', async () => {
  const { rendu, journal, promptsParLabel, optionsParLabel } = await jouerTable(mjSansFin);
  assert.deepEqual(rendu.declencheursNonJoues, [{ id: 'd1', evenement: D1.evenement, ref: ['EDO 01 l.200'], dernierStatut: 'non-echu', motif: 'la demi-heure court' }]);
  assert.ok(journal.some((l) => /^Analyse : THÉÂTRE — .*déclencheurs : 1 NON JOUÉ\(S\) \(d1 EDO 01 l\.200, dernier sort non-echu\), 0 ÉCARTÉ\(S\), dont 0 MANQUÉ\(S\) par le MJ/.test(l)), journal.join('\n'));
  assert.deepEqual(declencheursEnvoyes(promptsParLabel.get('Analyse:analyse')).map((d) => d.id), ['d1']);
  assert.ok(optionsParLabel.get('Analyse:analyse').schema.required.includes('declencheurs'), 'une rubrique DÉDIÉE du juge');
  assert.deepEqual(rendu.analyse.declencheurs, [{ id: 'd1', manque: false, constat: 'c', ref: 'EDO 01 l.200' }]);

  const incendie = { ...D1, id: 'd2', evenement: 'Le relais brûle', ref: ['EDO 01 l.300'] };
  const sortDe = (numero, id) => (id === 'd2' ? { statut: 'ecarte', motif: 'le relais est déjà en cendres' } : { statut: 'non-echu', motif: 'la demi-heure court' });
  const avecEcarte = await jouerTable(mjAuxSorts(sortDe), analyseCouvrante(), { ...ARGS_TABLE, dossier: { ...DOSSIER_DU_CHAPITRE, declencheurs: [D1, incendie] } });
  assert.deepEqual([avecEcarte.rendu.declencheursNonJoues.map((d) => d.id), avecEcarte.rendu.declencheursEcartes.map((d) => d.id)], [['d1'], ['d2']], 'témoin : un non joué, un écarté');
  assert.deepEqual(declencheursEnvoyes(avecEcarte.promptsParLabel.get('Analyse:analyse')).map((d) => d.id), ['d1', 'd2']);
  assert.deepEqual(clesDe(avecEcarte.optionsParLabel.get('Analyse:analyse').schema.properties.declencheurs), [false, ['d1', 'd2'], ['d1', 'd2']], 'le schéma du juge exige le non joué ET l’écarté');
  assert.deepEqual(avecEcarte.rendu.analyse.declencheurs, [
    { id: 'd1', manque: false, constat: 'c', ref: 'EDO 01 l.200' },
    { id: 'd2', manque: false, constat: 'c', ref: 'EDO 01 l.300' },
  ]);
});

test('table-simulee : une FUITE de secret rendue par le juge fait PARTIE ANOMALE ; sans fuite, le verdict ne change pas', async () => {
  const fuite = await jouerTable(mjSansFin, analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu'), [], (a) => ({ ...a, fuites: [FUITE] })));
  assert.equal(fuite.rendu.verdict, 'PARTIE ANOMALE');
  assert.deepEqual(fuite.rendu.trous.fuites, ['échange 2 : secret « sec1 » — la narration nomme le secret, aucun indice trouvé n’y mène (EDO 01 l.5)']);
  assert.deepEqual(fuite.rendu.analyse.fuites, [{ ...FUITE, ref: ['EDO 01 l.5'] }], 'la réf de la fuite est celle du secret au dossier');
  assert.ok(fuite.journal.some((l) => /^Verdict PARTIE ANOMALE — trous : fuites \(échange 2 : secret « sec1 »/.test(l)), fuite.journal.join('\n'));
  const auJuge = fuite.promptsParLabel.get('Analyse:analyse');
  const fiche = journalEnvoye(auJuge).preparation.ficheMJ;
  assert.deepEqual([fiche.secrets.map((s) => s.id), fiche.indices.map((i) => i.id)], [['sec1'], ['ind1']], 'le juge reçoit les secrets et les indices du dossier, par id');
  assert.match(auJuge, /- fuites : chaque narration du MJ qui révèle un secret de sa fiche \(`preparation\.ficheMJ\.secrets`, par son id\) sans que les joueurs aient trouvé d'indice \(`preparation\.ficheMJ\.indices`\) qui y mène/);
  assert.match(auJuge, /Un test réussi sur une piste qu'aucun indice de la fiche ne couvre N'EST PAS un indice trouvé : la narration qui en tire un secret reste une fuite\./, 'un indice IMPROVISÉ (EDO 01, échange 5 : « Noiraud a un regard trop fixe ») ne mène à aucun secret');
  const { required, properties } = fuite.optionsParLabel.get('Analyse:analyse').schema;
  assert.ok(required.includes('fuites'));
  assert.deepEqual(clesDe(properties.fuites.items), [false, ['echange', 'secret', 'constat'], ['echange', 'secret', 'constat']], 'le juge nomme le secret, le script en porte la réf');

  const sansFuite = await jouerTable(mjSansFin, analyseSignal());
  assert.deepEqual([sansFuite.rendu.verdict, sansFuite.rendu.trous.fuites, sansFuite.rendu.analyse.fuites], ['SIGNAL', [], []]);
});

test('table-simulee : un joueur sans rendu ARRÊTE la partie — aucun échange suivant n’est dispatché', async () => {
  const { rendu, promptsParLabel } = await jouer('table-simulee.js', ARGS_TABLE, sauf(repondreALaTable(mjSansFin, analyseSignal()), 'joueur:fouineur:1'));
  assert.equal(rendu.verdict, 'PARTIE INCOMPLÈTE');
  assert.deepEqual(rendu.trous.joueursSansRendu, ['échange 1 : fouineur']);
  assert.ok(promptsParLabel.has('Partie:mj:1'), 'témoin : le premier échange est joué');
  assert.ok(!promptsParLabel.has('Partie:mj:2'), 'aucun MJ ne rejoue une partie déjà incomplète');
});

test('table-simulee : un MJ mort INTERROMPT la partie — 0 échange = verdict INTERROMPU, sans dispatcher l’analyse', async () => {
  const mort = await jouerTable(() => null);
  assert.equal(mort.rendu.verdict, 'INTERROMPU');
  assert.deepEqual(mort.rendu.journal.interrompue, { echange: 1, cause: 'le MJ n’a rien rendu', intentionsNonResolues: [] });
  assert.equal(mort.rendu.analyse, null);
  assert.ok(!mort.promptsParLabel.has('Analyse:analyse'), 'aucun juge sur un journal vide');
  assert.equal(mort.rendu.agents.analyse, 0);
  assert.deepEqual(mort.rendu.declencheursNonJoues.map((d) => [d.id, d.dernierStatut]), [['d1', 'aucun']]);
  const tardif = await jouerTable((numero, premier, schema) => (numero === 2 ? null : mjSansFin(numero, premier, schema)), analyseSignal());
  assert.equal(tardif.rendu.journal.interrompue.echange, 2);
  assert.deepEqual([tardif.rendu.verdict, tardif.rendu.trous.interruption], ['INTERROMPU', ['échange 2 : le MJ n’a rien rendu, 4 intention(s) sans résolution']], 'une partie coupée ne rend jamais SIGNAL');
  assert.deepEqual(tardif.rendu.journal.interrompue.intentionsNonResolues.map((i) => i.persona), ARGS_TABLE_PERSONAS, 'la salve d’intentions en attente reste au journal');
  assert.equal(tardif.rendu.journal.plafondAtteint, false);
  assert.ok(tardif.promptsParLabel.has('Analyse:analyse'), 'un échange joué s’analyse');
});

test('table-simulee : les personas adverses sont IMPOSÉES et aucune ne se double — ARRÊT nommé sinon', async () => {
  const { rendu, promptsParLabel } = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, personas: ['rôliste', 'fouineur', 'saboteur', 'saboteur'] });
  assert.equal(rendu.verdict, 'ARRÊT');
  assert.equal(promptsParLabel.size, 0);
  assert.deepEqual(rendu.manques, [
    'args.personas — « hors-cadre » absente : les personas adverses saboteur et hors-cadre sont imposées',
    'args.personas — « saboteur » en double : une persona par joueur',
  ]);
});

test('table-simulee : chaque joueur est un agent `joueur` et ne relit que SES notes', async () => {
  const { promptsParLabel, optionsParLabel } = await jouerTable(mjSansFin);
  for (const [cle, opts] of optionsParLabel) if (cle.startsWith('Partie:joueur:')) assert.equal(opts.agentType, 'joueur', cle);
  for (const persona of ARGS_TABLE_PERSONAS) {
    const prompt = promptsParLabel.get(`Partie:joueur:${persona}:2`);
    assert.match(prompt, new RegExp(`TES NOTES PRIVÉES : notes de joueur:${persona}:1\n`));
  }
});

test('table-simulee : un argument manquant ARRÊTE avant tout agent, et se nomme', async () => {
  const { rendu, promptsParLabel } = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, seed: undefined, personas: ['rôliste'] });
  assert.equal(rendu.verdict, 'ARRÊT');
  assert.equal(promptsParLabel.size, 0);
  assert.ok(rendu.manques.some((m) => m.startsWith('args.seed')));
  assert.ok(rendu.manques.some((m) => m.startsWith('args.personas — exactement 4')));
});

// ── `dossier-de-chapitre.js` ─────────────────────────────────────────────────────────────────────

/** Le fichier `Source/` d'un chapitre de FIXTURE : la projection ne lit pas le `Source/` réel. */
const fichierDeFixture = (abbr, nn) => `Source/${abbr}-${nn}.md`;
/** Les args du workflow, PROJETÉS par le lanceur réel (`argsDeDossierDeChapitre`, `scripts/raw/workflow-args.mjs`) :
 *  familles, préfixes et formes d'entrée viennent de `ficheDeDossier`, jamais d'une recopie du banc. */
const argsDossier = (compagnons = []) => argsDeDossierDeChapitre('EDO', '01', { worktree: ARBRE, date: DATE, commit: COMMIT, compagnons, fichierDe: fichierDeFixture });
const ARGS_DOSSIER = argsDossier();
const AVEC_COMPAGNON = argsDossier(['EDOC-03']);
/** Ce que les lentilles rendent : des entrées SANS id, le script les numérote. */
const ENTREE_BEAT = { titre: 't', statut: 'obligatoire', preuveDuStatut: 'p', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] };
const { id: _idDeD1, ...ENTREE_D1 } = D1;
const ENTREE_D2 = { evenement: 'Kastor attaque à minuit', condition: 'minuit sonne', ref: ['EDO 01 l.300'] };
const LECTURES = {
  'imperatifs-et-beats': { imperatifs: [], beats: [ENTREE_BEAT], pointsAuMJ: [], indices: [{ texte: 'la lettre', ref: ['EDO 01 l.3'] }], secrets: [{ texte: 's', ref: ['EDO 01 l.4'] }], declencheurs: [ENTREE_D1] },
  'pnj-lieux-textes': { pnj: [{ nom: 'Kastor', role: 'r', motivation: 'm', ref: ['EDO 01 l.2'] }, { nom: 'Phillipe', role: 'r', motivation: 'm', ref: ['EDO 01 l.199'] }], lieux: [], textes: [] },
  mecanique: { tests: [], rencontres: [], dureeEtDifficulte: [], recompenses: [], etats: [{ texte: 'Kastor est mort', sens: 'lu', portee: 'chapitre', ref: ['EDO 01 l.8'] }] },
  'matiere-compagnons': { matiereCompagnons: [{ texte: 'péage', categorie: 'peage', pourCeChapitre: 'b1', ref: ['EDOC 03 l.4'] }] },
};

/** Le rendu d'un juge de complétude qui ne corrige rien, à la forme du schéma qu'il REÇOIT ; `corrige` y verse ses corrections. */
const completude = (opts, corrige = {}) => ({
  oublis: { ...tableTotale(opts.schema.properties.oublis.required, () => []), ...corrige.oublis },
  refsFausses: corrige.refsFausses ?? [],
  contenusFaux: corrige.contenusFaux ?? [],
  synthese: { markdown: 's' },
});
const repondreAuDossier = (corrige = {}) => (prompt, opts) => (opts.phase === 'Lecture' ? LECTURES[opts.label] : completude(opts, corrige));
const jouerDossier = (argsDuRun = ARGS_DOSSIER, corrige = {}) => jouer('dossier-de-chapitre.js', argsDuRun, repondreAuDossier(corrige));
/** La fiche que porte un rendu : sa provenance, puis ses familles. */
const ficheDu = (rendu) => Object.fromEntries(['lecture', ...FAMILLES_DE_DOSSIER].map((cle) => [cle, rendu[cle]]));
/** `corps(dir)` dans un dossier jetable, supprimé ensuite. */
const dansUnJetable = async (corps) => {
  const dir = mkdtempSync(join(tmpdir(), 'dossiers-'));
  try {
    return await corps(dir.replace(/\\/g, '/'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('dossier-de-chapitre : le rendu porte une FICHE au schéma `ficheDeDossier` — `lecture`, puis chaque famille en premier niveau, chaque id posé par le script', async () => {
  const { rendu } = await jouerDossier(AVEC_COMPAGNON);
  assert.equal(rendu.verdict, 'DOSSIER');
  assert.deepEqual(ficheDeDossier.parse(ficheDu(rendu)), ficheDu(rendu), 'la fiche passe le schéma telle quelle');
  assert.deepEqual(rendu.lecture, { date: DATE, commit: COMMIT });
  assert.deepEqual(
    [rendu.beats.map((b) => b.id), rendu.pnj.map((p) => p.id), rendu.declencheurs, rendu.etats.map((e) => e.id), rendu.matiereCompagnons.map((m) => m.id)],
    [['b1'], ['pnj1', 'pnj2'], [D1], ['etat1'], ['comp1']],
  );
  const horsFiche = Object.keys(rendu).filter((cle) => !Object.hasOwn(ficheDu(rendu), cle)).sort();
  assert.deepEqual(horsFiche, ['agents', 'chapitre', 'corrections', 'livre', 'synthese_markdown', 'trous', 'verdict'], 'hors de la fiche : ce qui juge le run, et le chapitre qui la situe');
});

test('dossier-de-chapitre : la lentille des compagnons ne joue que si des compagnons sont fournis', async () => {
  const sans = await jouerDossier();
  assert.equal(sans.rendu.agents.lecture, 3);
  assert.ok(!sans.promptsParLabel.has('Lecture:matiere-compagnons'));
  assert.deepEqual(sans.rendu.matiereCompagnons, []);
  const avec = await jouerDossier(AVEC_COMPAGNON);
  assert.equal(avec.rendu.agents.lecture, 4);
  assert.deepEqual(avec.rendu.matiereCompagnons.map((m) => m.ref), [['EDOC 03 l.4']]);
});

test('dossier-de-chapitre : chaque forme de lecture VIENT des args projetés de `ficheDeDossier` — le script n’en recopie aucune, et ses lentilles lisent toutes les familles', async () => {
  const { optionsParLabel } = await jouerDossier(AVEC_COMPAGNON);
  const lectures = [...optionsParLabel].filter(([cle]) => cle.startsWith('Lecture:'));
  for (const [cle, { schema }] of lectures) {
    for (const [famille, forme] of Object.entries(schema.properties)) {
      assert.deepEqual(forme, { type: 'array', minItems: AVEC_COMPAGNON.familles[famille].minimum, items: AVEC_COMPAGNON.familles[famille].entree }, `${cle} ${famille}`);
    }
  }
  assert.deepEqual(lectures.flatMap(([, { schema }]) => schema.required).sort(), [...FAMILLES_DE_DOSSIER].sort());
  const { familles } = ARGS_DOSSIER;
  assert.ok(!familles.pointsAuMJ.entree.properties.type.enum.includes('hors-livre'), 'un point au MJ n’est jamais hors livre');
  assert.ok(familles.beats.entree.properties.statut.enum.includes('non-qualifie'), 'un beat peut être non qualifié');
  assert.ok(familles.textes.entree.properties.nature.enum.includes('narration-a-reformuler'), 'une narration au MJ se reformule');
  const autre = structuredClone(ARGS_DOSSIER);
  autre.familles.pointsAuMJ.entree.properties.type.enum = ['type-de-fixture'];
  const { optionsParLabel: options, promptsParLabel: prompts } = await jouerDossier(autre);
  assert.deepEqual(options.get('Lecture:imperatifs-et-beats').schema.properties.pointsAuMJ.items.properties.type.enum, ['type-de-fixture'], 'l’agent reçoit la forme projetée');
  assert.match(prompts.get('Lecture:imperatifs-et-beats'), /typé parmi type-de-fixture\./, 'la consigne dit les valeurs projetées');
});

test('dossier-de-chapitre : un argument manquant, une famille sans projection ou qu’aucune lentille ne lit, ARRÊTE avant tout agent, et se nomme', async () => {
  const { familles } = ARGS_DOSSIER;
  const sansFamille = (nom) => Object.fromEntries(Object.entries(familles).filter(([f]) => f !== nom));
  const cas = [
    [{ ...ARGS_DOSSIER, fichiers: [] }, ['args.fichiers — chemins Source/ du chapitre']],
    [{ ...ARGS_DOSSIER, commit: '' }, ['args.commit — la tête de l’arbre lu (`lecture.commit` de la fiche)']],
    [{ ...ARGS_DOSSIER, familles: sansFamille('lieux') }, ['args.familles.lieux — famille lue par une lentille, sans projection { prefixe, minimum, entree } de `ficheDeDossier`']],
    [{ ...ARGS_DOSSIER, familles: { ...familles, rumeurs: familles.indices } }, ['args.familles.rumeurs — famille de la fiche qu’aucune lentille ne lit']],
  ];
  for (const [argsDuRun, manques] of cas) {
    const { rendu, promptsParLabel } = await jouerDossier(argsDuRun);
    assert.equal(rendu.verdict, 'ARRÊT', manques[0]);
    assert.equal(promptsParLabel.size, 0, manques[0]);
    assert.deepEqual(rendu.manques, manques);
    assert.deepEqual(FAMILLES_DE_DOSSIER.filter((f) => Object.hasOwn(rendu, f)), [], 'un ARRÊT ne porte aucune fiche');
  }
  const { familles: _f, ...sansProjection } = ARGS_DOSSIER;
  assert.equal((await jouerDossier(sansProjection)).rendu.manques.length, FAMILLES_DE_DOSSIER.length, 'sans projection, chaque famille lue se nomme');
});

test('dossier-de-chapitre : un OUBLI entre à la fiche sous l’id que le script pose ; la fiche s’ÉCRIT par le lanceur, et la table la consomme — bloc DÉCLENCHEURS du MJ, non joués rendus', async () => {
  const dossier = await jouerDossier(ARGS_DOSSIER, { oublis: { declencheurs: [ENTREE_D2] } });
  const D2 = { id: 'd2', ...ENTREE_D2 };
  assert.equal(dossier.rendu.verdict, 'DOSSIER');
  assert.deepEqual(dossier.rendu.declencheurs, [D1, D2]);
  assert.deepEqual(dossier.rendu.corrections, [{ type: 'oubli', famille: 'declencheurs', id: 'd2', entree: D2 }]);
  await dansUnJetable(async (dir) => {
    assert.equal(ecrireFiche({ result: dossier.rendu }, { dir }), `${dir}/EDO/01.json`, 'le rendu emballé par le lanceur s’écrit aussi');
    assert.deepEqual(JSON.parse(readFileSync(`${dir}/EDO/01.json`, 'utf8')), ficheDu(dossier.rendu), 'la fiche écrite est celle du rendu, sans rien de ce qui juge le run');
    const argsTable = argsDeTableSimulee('EDO', '01', { worktree: ARBRE, date: DATE, seed: 'graine', maxEchanges: 3, dir, fichierDe: fichierDeFixture });
    assert.deepEqual(argsTable.dossier, ficheDu(dossier.rendu), '`args.dossier` = l’OBJET de la fiche chargée');
    const table = await jouerTable(mjSansFin, analyseCouvrante(), argsTable);
    assert.match(table.promptsParLabel.get('Partie:mj:1'), /^- d2 — Kastor attaque à minuit — condition : minuit sonne \(EDO 01 l\.300\) — en attente$/m);
    assert.deepEqual(table.rendu.declencheursNonJoues.map((d) => [d.id, d.ref]), [['d1', ['EDO 01 l.200']], ['d2', ['EDO 01 l.300']]]);
  });
});

test('dossier-de-chapitre : une RÉF FAUSSE se corrige à l’entrée, à la forme d’une réf de la fiche, et le MJ lit la réf corrigée', async () => {
  const dossier = await jouerDossier(ARGS_DOSSIER, { refsFausses: [
    { famille: 'declencheurs', id: 'd1', ref: ['EDO 01 l.201'], motif: 'la l.200 ne dit pas la demi-heure' },
    { famille: 'pnj', id: 'pnj2', ref: ['EDO 01 l.7', 'EDO 01 l.9'], motif: 'm' },
  ] });
  assert.equal(dossier.rendu.verdict, 'DOSSIER');
  assert.deepEqual([dossier.rendu.declencheurs[0].ref, dossier.rendu.pnj[1].ref], [['EDO 01 l.201'], ['EDO 01 l.7', 'EDO 01 l.9']]);
  assert.deepEqual(dossier.rendu.corrections.map((c) => [c.type, c.famille, c.id, c.avant, c.apres]), [
    ['ref-fausse', 'declencheurs', 'd1', ['EDO 01 l.200'], ['EDO 01 l.201']],
    ['ref-fausse', 'pnj', 'pnj2', ['EDO 01 l.199'], ['EDO 01 l.7', 'EDO 01 l.9']],
  ]);
  const table = await jouerTable(mjSansFin, analyseCouvrante(), { ...ARGS_TABLE, dossier: ficheDu(dossier.rendu) });
  assert.match(table.promptsParLabel.get('Partie:mj:1'), /^- d1 — [^\n]* \(EDO 01 l\.201\) — en attente$/m);
  assert.doesNotMatch(table.promptsParLabel.get('Partie:mj:1'), /EDO 01 l\.200/);
  const horsForme = await jouerDossier(ARGS_DOSSIER, { refsFausses: [{ famille: 'declencheurs', id: 'd1', ref: [], motif: 'm' }] });
  assert.equal(horsForme.rendu.verdict, 'CORRECTIONS INAPPLICABLES');
  assert.match(horsForme.rendu.trous.anomaliesDeCorrection[0], /^réf fausse « declencheurs:d1 » : réf \[\] hors de la forme /);
  assert.deepEqual(horsForme.rendu.declencheurs, [D1]);
});

test('dossier-de-chapitre : un CONTENU FAUX corrige tout attribut de sa famille, classement compris ; attribut hors famille ou cible inconnue = anomalie', async () => {
  const condition = 'les PJ l’ignorent une heure';
  const { rendu, promptsParLabel, optionsParLabel } = await jouerDossier(AVEC_COMPAGNON, { contenusFaux: [
    { famille: 'declencheurs', id: 'd1', attribut: 'condition', valeur: condition, ref: 'EDO 01 l.201' },
    { famille: 'beats', id: 'b1', attribut: 'statut', valeur: 'optionnel', ref: 'EDO 01 l.1' },
    { famille: 'etats', id: 'etat1', attribut: 'portee', valeur: 'campagne', ref: 'EDO 01 l.8' },
  ] });
  assert.equal(rendu.verdict, 'DOSSIER');
  assert.deepEqual([rendu.declencheurs, rendu.beats[0].statut, rendu.etats[0].portee], [[{ ...D1, condition }], 'optionnel', 'campagne']);
  assert.deepEqual(rendu.corrections[0], { type: 'contenu-faux', famille: 'declencheurs', id: 'd1', attribut: 'condition', avant: D1.condition, apres: condition, ref: 'EDO 01 l.201' });
  const juge = optionsParLabel.get('Complétude:completude').schema.properties;
  const mesures = [...new Set([...optionsParLabel].filter(([cle]) => cle.startsWith('Lecture:'))
    .flatMap(([, o]) => Object.values(o.schema.properties).flatMap((s) => Object.keys(s.items.properties)))
    .filter((nom) => nom !== 'ref'))].sort();
  assert.deepEqual([...juge.contenusFaux.items.properties.attribut.enum].sort(), mesures, 'tout attribut d’entrée hors réf, mesuré sur les schémas de lecture');
  assert.ok(mesures.includes('mediasCandidats') && mesures.includes('statut'), 'un attribut NON textuel, et un classement, sont corrigeables');
  assert.match(promptsParLabel.get('Complétude:completude'), /declencheurs : evenement, condition ; pnj : nom, role, motivation/);

  const fautif = await jouerDossier(ARGS_DOSSIER, { contenusFaux: [
    { famille: 'declencheurs', id: 'd1', attribut: 'nom', valeur: 'x', ref: 'r' },
    { famille: 'pnj', id: 'pnj99', attribut: 'nom', valeur: 'x', ref: 'r' },
  ] });
  assert.equal(fautif.rendu.verdict, 'CORRECTIONS INAPPLICABLES');
  assert.deepEqual(fautif.rendu.trous.anomaliesDeCorrection, [
    'contenu faux « declencheurs:d1 » : attribut « nom » hors des attributs corrigeables de la famille (evenement, condition)',
    'contenu faux « pnj:pnj99 » : cible inconnue',
  ]);
  assert.deepEqual([fautif.rendu.declencheurs, fautif.rendu.corrections], [[D1], []]);
});

test('dossier-de-chapitre : un CONTENU FAUX se valide contre la forme projetée de son attribut ; hors forme, doublon d’enum, texte vide ou blanc = anomalie, rien ne s’efface', async () => {
  const { rendu } = await jouerDossier(ARGS_DOSSIER, { contenusFaux: [{ famille: 'beats', id: 'b1', attribut: 'mediasCandidats', valeur: ['resume', 'coupe'], ref: 'EDO 01 l.1' }] });
  assert.equal(rendu.verdict, 'DOSSIER');
  assert.deepEqual(rendu.beats[0].mediasCandidats, ['resume', 'coupe']);
  const fautif = await jouerDossier(ARGS_DOSSIER, { contenusFaux: [
    { famille: 'beats', id: 'b1', attribut: 'mediasCandidats', valeur: ['inconnu'], ref: 'r' },
    { famille: 'beats', id: 'b1', attribut: 'mediasCandidats', valeur: [], ref: 'r' },
    { famille: 'beats', id: 'b1', attribut: 'mediasCandidats', valeur: 'resume', ref: 'r' },
    { famille: 'beats', id: 'b1', attribut: 'mediasCandidats', valeur: ['dialogue', 'dialogue'], ref: 'r' },
    { famille: 'beats', id: 'b1', attribut: 'statut', valeur: 'capital', ref: 'r' },
    { famille: 'beats', id: 'b1', attribut: 'titre', valeur: ['x'], ref: 'r' },
    { famille: 'pnj', id: 'pnj1', attribut: 'nom', valeur: '', ref: 'r' },
    { famille: 'declencheurs', id: 'd1', attribut: 'evenement', valeur: '   ', ref: 'r' },
  ] });
  assert.equal(fautif.rendu.verdict, 'CORRECTIONS INAPPLICABLES');
  assert.deepEqual(fautif.rendu.trous.anomaliesDeCorrection.map((a) => a.slice(0, a.indexOf(' hors de la forme'))), [
    'contenu faux « beats:b1.mediasCandidats » : valeur ["inconnu"]',
    'contenu faux « beats:b1.mediasCandidats » : valeur []',
    'contenu faux « beats:b1.mediasCandidats » : valeur "resume"',
    'contenu faux « beats:b1.mediasCandidats » : valeur ["dialogue","dialogue"]',
    'contenu faux « beats:b1.statut » : valeur "capital"',
    'contenu faux « beats:b1.titre » : valeur ["x"]',
    'contenu faux « pnj:pnj1.nom » : valeur ""',
    'contenu faux « declencheurs:d1.evenement » : valeur "   "',
  ]);
  assert.deepEqual(
    [fautif.rendu.beats[0], fautif.rendu.pnj[0].nom, fautif.rendu.declencheurs[0].evenement, fautif.rendu.corrections],
    [{ id: 'b1', ...ENTREE_BEAT }, 'Kastor', D1.evenement, []],
  );
});

test('dossier-de-chapitre : une seconde correction de la MÊME cible se nomme « cible déjà corrigée » et ne s’applique pas', async () => {
  const { rendu } = await jouerDossier(ARGS_DOSSIER, {
    refsFausses: [{ famille: 'declencheurs', id: 'd1', ref: ['EDO 01 l.201'], motif: 'm' }, { famille: 'declencheurs', id: 'd1', ref: ['EDO 01 l.999'], motif: 'm' }],
    contenusFaux: [
      { famille: 'declencheurs', id: 'd1', attribut: 'condition', valeur: 'c1', ref: 'EDO 01 l.201' },
      { famille: 'declencheurs', id: 'd1', attribut: 'condition', valeur: 'c2', ref: 'EDO 01 l.201' },
      { famille: 'declencheurs', id: 'd1', attribut: 'evenement', valeur: 'e1', ref: 'EDO 01 l.201' },
    ],
  });
  assert.equal(rendu.verdict, 'CORRECTIONS INAPPLICABLES');
  assert.deepEqual(rendu.trous.anomaliesDeCorrection, [
    'réf fausse « declencheurs:d1 » : cible déjà corrigée',
    'contenu faux « declencheurs:d1.condition » : cible déjà corrigée',
  ]);
  assert.deepEqual([rendu.declencheurs[0].ref, rendu.declencheurs[0].condition, rendu.declencheurs[0].evenement], [['EDO 01 l.201'], 'c1', 'e1'], 'seule la première correction d’une cible s’applique ; un autre attribut est une autre cible');
  assert.deepEqual(rendu.corrections.map((c) => c.type), ['ref-fausse', 'contenu-faux', 'contenu-faux']);
});

test('dossier-de-chapitre : un run qui n’est pas au verdict DOSSIER ne s’écrit pas — le lanceur le refuse en nommant ses trous, rien n’est écrit', async () => {
  const lentilleMorte = await jouer('dossier-de-chapitre.js', ARGS_DOSSIER, sauf(repondreAuDossier(), 'mecanique'));
  assert.deepEqual([lentilleMorte.rendu.verdict, lentilleMorte.rendu.trous.lentillesSansRendu], ['LECTURE INCOMPLÈTE', ['mecanique']]);
  assert.deepEqual([lentilleMorte.rendu.etats, lentilleMorte.rendu.tests], [[], []], 'une lentille morte laisse ses familles vides');
  const inapplicable = await jouerDossier(ARGS_DOSSIER, { refsFausses: [{ famille: 'declencheurs', id: 'd9', ref: ['EDO 01 l.9'], motif: 'm' }] });
  assert.equal(inapplicable.rendu.verdict, 'CORRECTIONS INAPPLICABLES');
  await dansUnJetable(async (dir) => {
    assert.throws(() => ecrireFiche(lentilleMorte.rendu, { dir }), /^Error: workflow-args: verdict « LECTURE INCOMPLÈTE » — seul un run au verdict DOSSIER porte une fiche ; trous : lentillesSansRendu \(mecanique\)$/);
    assert.throws(() => ecrireFiche(inapplicable.rendu, { dir }), /verdict « CORRECTIONS INAPPLICABLES » .* trous : anomaliesDeCorrection \(réf fausse « declencheurs:d9 » : cible inconnue\)/);
    assert.throws(() => argsDeTableSimulee('EDO', '01', { worktree: ARBRE, date: DATE, seed: 'graine', dir, fichierDe: fichierDeFixture }), /aucune fiche .*\/EDO\/01\.json/, 'rien n’a été écrit');
  });
});

test('dossier-de-chapitre : chaque rendu de LECTURE se keye au label de sa lentille — réordonner les lecteurs ne change pas la fiche', async () => {
  const source = readFileSync(join(DOSSIER, 'dossier-de-chapitre.js'), 'utf8');
  const lecteur = (lentille) => source.indexOf(`  () => agent(promptDeLecture(${lentille}),`);
  const [a, b, c] = ['LENTILLE_IMPERATIFS_ET_BEATS', 'LENTILLE_PNJ_LIEUX_TEXTES', 'LENTILLE_MECANIQUE'].map(lecteur);
  assert.ok(a >= 0 && a < b && b < c, 'les trois premiers lecteurs, dans cet ordre');
  const permute = source.slice(0, a) + source.slice(b, c) + source.slice(a, b) + source.slice(c);
  assert.notEqual(permute, source, 'la mutation s’applique — sinon ce test ne prouve rien');
  const repondre = (prompt, opts) => {
    if (opts.phase === 'Lecture') {
      const vide = tableTotale(opts.schema.required, () => []);
      return opts.label === 'pnj-lieux-textes' ? { ...vide, pnj: [{ nom: 'Kastor', role: 'r', motivation: 'm', ref: ['EDO 01 l.2'] }] } : vide;
    }
    return completude(opts);
  };
  await dansUnJetable(async (dir) => {
    const chemin = join(dir, 'dossier-de-chapitre.js');
    writeFileSync(chemin, permute, 'utf8');
    const nominal = await jouer('dossier-de-chapitre.js', ARGS_DOSSIER, repondre);
    const reordonne = await jouerWorkflow(chemin, ARGS_DOSSIER, repondre);
    assert.deepEqual(nominal.rendu.pnj.map((p) => p.nom), ['Kastor'], 'témoin : le PNJ de sa lentille entre à la fiche');
    assert.deepEqual(reordonne.rendu, nominal.rendu);
  });
});

// ── CLASSES : tout workflow du dépôt ───────────────────────────────────────────────────────────────

/** Le nom de fichier d'un script : ce qu'un banc NOMME (porte B9 de `workflows.test.mjs`). */
const nomDe = (chemin) => chemin.split(/[\\/]/).pop();
/** `label` meurt (rend `rendu`, `null` par défaut) ; tout autre agent répond par `repondre`. */
const sauf = (repondre, label, rendu = null) => (prompt, opts) => (opts.label === label ? rendu : repondre(prompt, opts));
const ATLAS = join(RACINE, 'scripts', 'raw', 'atlas-domain.workflow.js');
/** Un périmètre de FIXTURE : un cœur, un livre, un domaine — rien du registre réel. */
const ARGS_ATLAS = {
  coeur: 'alpha', domaines: [{ cle: 'domaine-un', titre: 'Domaine de fixture' }], lot: ['domaine-un'],
  livres: [{ ab: 'BKA', dir: 'Source/Fixture - Base Alpha', coeur: 'alpha', language: 'Langue-A' }],
};
/** Un atlas qui répond à chaque phase ; `fidele: false` ouvre la correction de fidélité et la re-vérification. */
const repondreALAtlas = (fidele) => (prompt, opts) => ({
  Cadrage: { coverageRefs: [{ ab: 'BKA', nn: '05' }], sonnetBooks: [] },
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

test('table-simulee : la commande de dés est SIMPLE, lancée par `ctx_shell` ; les fiches des PJ se construisent par une sonde sans fichier', async () => {
  const table = await jouerTable(mjSansFin);
  const mj = table.promptsParLabel.get('Partie:mj:1');
  assert.match(mj, /^ {2}npx tsx scripts\/ops\/table-des\.mts simple --seed "graine" --tirage <n>/m, 'la commande de dés est SIMPLE');
  assert.match(mj, /une commande par jet, lancée par `ctx_shell` avec `cwd` = l'arbre/);
  assert.match(table.promptsParLabel.get('Préparation:fiches-pj'), /UNE sonde `npx tsx -e "…"`, sans fichier écrit/);
});

test('les deux workflows : tout agent qui cite le livre prend ses lignes sur une lecture BRUTE et relit la ligne citée', async () => {
  const table = await jouerTable(mjSansFin);
  const dossier = await jouerDossier(AVEC_COMPAGNON);
  const citants = [...table.promptsParLabel, ...dossier.promptsParLabel].filter(([cle]) => !cle.startsWith('Partie:joueur:') && cle !== 'Préparation:fiches-pj');
  assert.ok(citants.length >= 8);
  for (const [cle, prompt] of citants) {
    assert.match(prompt, /lecture BRUTE numérotée \(`grep -n`, `sed -n 'X,Yp'`, `ctx_read` en mode `raw`\), jamais sur une vue résumée/, cle);
    assert.match(prompt, /toute réf se vérifie en relisant la ligne citée avant d'être rendue/, cle);
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
