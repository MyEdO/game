import { fichesDAgent } from '../../guards/lib/typesDAgent.mjs'
import { analyser, TABLES, REGIMES } from '../../guards/lib/formeDeWorkflow.mjs'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jouerWorkflow } from '../../guards/lib/jouer-workflow.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { argsDeDossierDeChapitre } from '../../raw/workflow-args.mjs'
import { readFileSync } from 'node:fs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
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
const FICHES_PJ = {
  pjs: ['pregen-101', 'pregen-202', 'pregen-707', 'pregen-303'].map((id) => ({ id, nom: id, espece: 'humain', carriere: 'c', fiche: `fiche de ${id}` })),
  groupe: { source: 'makeShowcaseParty', commande: 'npx tsx sonde.mts' },
};
const SANS_SOSIE = { id: '', ref: '', motif: 'aucun passage du chapitre ne fait ressembler un PJ à un PNJ' };
const jetsDe = (premier, n) => Array.from({ length: n }, (_, i) => ({
  tirage: premier + i, objet: 'o', commande: `npx tsx scripts/ops/table-des.mts simple --seed "graine" --tirage ${premier + i}`, sortie: '{}',
}));
/** Le texte JSON d'un prompt entre deux marqueurs : ce que le script ENVOIE au juge. */
const jsonEntre = (prompt, debut, fin) => JSON.parse(prompt.slice(prompt.indexOf(debut) + debut.length, prompt.indexOf(fin)));
const declencheursEnvoyes = (prompt) => jsonEntre(prompt, 'DÉCLENCHEURS NON JOUÉS OU ÉCARTÉS :\n', '\n\nRends :');
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
/** Le MJ rend, à l'échange `n`, le sort `sortDe(n, id)` de chaque déclencheur exigé — le reste de son rendu est celui de `mjSansFin`. */
const mjAuxSorts = (sortDe) => (numero, premier, schema) => {
  const mj = mjSansFin(numero, premier, schema);
  return { ...mj, tour: { ...mj.tour, declencheurs: tableTotale(declencheursExiges(schema), (id) => sortDe(numero, id)) } };
};
/** Le juge qui classe un refus du saboteur : sur une partie sans trou, SIGNAL. */
const analyseSignal = (classes = []) => analyseCouvrante((p) => (p === 'saboteur' ? 'refuse' : 'prevu'), classes);
// ── `dossier-de-chapitre.js` ─────────────────────────────────────────────────────────────────────
/** Le fichier `Source/` d'un chapitre de FIXTURE : la projection ne lit pas le `Source/` réel. */
const fichierDeFixture = (abbr, nn) => `Source/${abbr}-${nn}.md`;
/** Les args du workflow, PROJETÉS par le lanceur réel (`argsDeDossierDeChapitre`, `scripts/raw/workflow-args.mjs`) :
 *  familles, préfixes et formes d'entrée viennent de `ficheDeDossier`, jamais d'une recopie du banc. */
const argsDossier = (compagnons = []) => argsDeDossierDeChapitre('EDO', '01', { worktree: ARBRE, date: DATE, commit: COMMIT, compagnons, fichierDe: fichierDeFixture });
const ARGS_DOSSIER = argsDossier();
const { id: _idDeD1, ...ENTREE_D1 } = D1;
/** Ce que les lentilles rendent : des entrées SANS id, le script les numérote. */
const ENTREE_BEAT = { titre: 't', statut: 'obligatoire', preuveDuStatut: 'p', mediasCandidats: ['dialogue'], ref: ['EDO 01 l.1'] };
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
/** `label` meurt (rend `rendu`, `null` par défaut) ; tout autre agent répond par `repondre`. */
const sauf = (repondre, label, rendu = null) => (prompt, opts) => (opts.label === label ? rendu : repondre(prompt, opts));

export const FICHES = fichesDAgent(RACINE)
export const TYPES_DECLARES = new Set(FICHES.keys())
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
/** Les tables de la porte, et le régime du TÉMOIN. */
const TABLES_DU_TEMOIN = { ...TABLES, regimes: { ...REGIMES, [TEMOIN]: { Jugement: 'jugement' } } };
const sansLieu = (m) => m.slice(m.indexOf(' — ') + 3);
/** Applique des remplacements au source ; un fragment introuvable = un test qui ne prouve rien. */
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
const vus = (mute, fichier = TEMOIN, calibrage) => analyser(mute, fichier, TABLES_DU_TEMOIN, calibrage, FICHES).defauts.map((d) => `${d.regle} : ${sansLieu(d.message)}`);

export { ARBRE, ARGS_DOSSIER, ARGS_TABLE, COMMIT, D1, DATE, DOSSIER, DOSSIER_DU_CHAPITRE, ENTREE_BEAT, FICHES_PJ, RACINE, RESOLUTION, SANS_SOSIE, SECRET, SOURCE_TEMOIN, TEMOIN, analyseCouvrante, analyseSignal, argsDossier, completude, declencheursEnvoyes, fichierDeFixture, jetsDe, jouer, jouerDossier, jouerTable, jsonEntre, mjAuxSorts, mjSansFin, muter, repondreALaTable, repondreAuDossier, sauf, vus }
