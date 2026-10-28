/**
 * Migration #1657 (« concept jet/Test : 65 lignes au stock FORMES, aucun def n'importe un schéma de
 * jet partagé ») train B3-2b-a — le coup à l'ÉQUIPAGE désigne la PRÉSENCE que le livre nomme.
 *
 * CE QUI BOUGE :
 *  · `crewTarget` devient une union REQUISE `{poste:true} | {stations:[id]} | {role:id}` (catalogue
 *    `ship-stations.json`) — le mot-valise `deck` meurt, qui collapsait TROIS cibles RAW distinctes :
 *    « Toute personne présente sur le pont » (MSRC 07 l.78), « aux rameurs » (l.82) et « tous les
 *    Personnages qui s'y trouvent » dans la CALE (l.94) ;
 *  · `gouvernail-fluvial` : « les échardes infligent +5 Dégâts au timonier » (MSRC 07 l.86,
 *    SINGULIER) cesse d'être un `shrapnel: 1` (un marin AU HASARD) et devient le coup certain
 *    `{role:'timonier'}` ; le jeu fluvial n'a plus aucune rangée à Éclats, `shrapnelHit` est purgé ;
 *  · SIX rangées MDG dont le Test ne vivait qu'en prose `note` (règle 7 de CLAUDE.md) gagnent leur
 *    `crewHit` : `coque-degradee` (MDG 13 l.730), `gouvernail-endommage` (l.734),
 *    `quille-dechiquetee` (l.736), `gouvernail-brise` (l.738) sur le PONT ; `bancs-disperses`
 *    (l.751) et `bancs-fracasses` (l.756) aux AVIRONS. Toutes : Athlétisme, échec = État À Terre ;
 *  · `replisSansExpose` : le coup à l'Équipage sans aucun marin exposé n'est plus ABANDONNÉ — MDG 13
 *    l.584 « le coup touche la Coque » (RAW) ; MSRC 07 l.70 laissait le choix au MJ, il n'y en a pas
 *    (règle 7) → arbitrage AUTHORÉ, éditable, aligné sur le déterminisme maritime ;
 *  · `barge-fluviale` gagne le Trait naval `cale` (MSRC 07 l.5 « une barge commerciale » + MSRC 10
 *    l.90 : le navire marchand est « doté d'une cale »). Aucun autre navire n'est authoré : MSRC 07
 *    l.70 EXCLUT la barque (« bateau ouvert »), et le livre ne tranche pas pour les 18 autres.
 *
 * PÉRIMÈTRE : les 5 rangées du GRÉEMENT (MDG 13 l.711/714/715/717/718, « sous peine de tomber ») sont
 * traitées par le train B3-2b-c, qui pose l'op de CHUTE (LDB 15 l.80-84) et la table de hauteur par
 * Taille de navire (MDG 13 l.684).
 *
 * ENTRÉES : `src/data/river-criticals.json`, `src/data/ship-criticals.json`, `src/data/vehicles.json`.
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : cardinaux exigés sur l'état LU, et
 * chaque rangée à migrer RETROUVÉE par son id. Un écart : sortie 1 sans rien écrire.
 *
 * FORME D'AVANT SEULE, marquée par un `crewTarget` textuel ou un `shrapnelHit` fluvial : sans eux,
 * les trois documents (migrés, ou révisés depuis) sont laissés tels quels, sans porte.
 * IDEMPOTENT : rejouée sur l'état final (plus aucun `crewTarget` textuel), elle reconnaît « déjà
 * migré » et sort 0. FORMATAGE PRÉSERVÉ : chaque fichier lu est
 * EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT toute écriture ; la sortie l'est aussi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHEMIN = (n) => path.join(ROOT, 'src/data', n);
const RIVER = 'river-criticals.json';
const SHIP = 'ship-criticals.json';
const VEHICULES = 'vehicles.json';

/** CARDINAUX attendus sur l'état AVANT, mesurés sur l'arbre `c3692d0f9` (2026-09-04). */
const AVANT = {
  [RIVER]: { rangees: 5, crewHit: 3, deck: 3, shrapnel: 1 },
  [SHIP]: { rangees: 35, crewHit: 1, deck: 0, shrapnel: 17 },
};

/** CARDINAUX exigés sur le RÉSULTAT de CE script (design v2 jugé, colonne « après -a ») : les 5
 *  rangées du GRÉEMENT ne reçoivent leur coup qu'au train B3-2b-c, qui le suit au rejeu. */
const APRES = {
  [RIVER]: { rangees: 5, crewHit: 4, shrapnel: 0 },
  [SHIP]: { rangees: 35, crewHit: 7, shrapnel: 17 },
  total: {
    crewHit: 11, epreuves: 9, certains: 2, stationsPont: 5, stationsAvirons: 3,
    stationsCale: 1, roleTimonier: 1, poste: 1, deckResiduel: 0,
  },
};

/** `deck` → la présence que le livre NOMME, rangée par rangée (jamais une règle générale). */
const CIBLE_DES_DECK = {
  'greement-fluvial': { stations: ['pont'] }, //       MSRC 07 l.78
  'rames-fluvial': { stations: ['avirons'] }, //       MSRC 07 l.82
  'superstructure-fluvial': { stations: ['cale'] }, // MSRC 07 l.94
};

const degats5 = () => [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: false }];

/** Nœud `test` d'une présence MDG : Athlétisme à la Difficulté imprimée, échec = État À Terre. */
const noeudATerre = (difficulty) => ({
  kind: 'test',
  test: { skill: { id: 'athletisme' }, difficulty },
  success: { kind: 'seq', steps: [] },
  fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'a-terre', value: 1 }], on: 'target' } },
});

/** Les SIX rangées MDG dont le Test ne vivait qu'en prose — station et Difficulté LUES au livre. */
const NOEUDS_MDG = {
  'coque-degradee': { station: 'pont', difficulty: 'accessible' }, //       MDG 13 l.730
  'gouvernail-endommage': { station: 'pont', difficulty: 'accessible' }, // MDG 13 l.734
  'quille-dechiquetee': { station: 'pont', difficulty: 'accessible' }, //   MDG 13 l.736
  'gouvernail-brise': { station: 'pont', difficulty: 'accessible' }, //     MDG 13 l.738
  'bancs-disperses': { station: 'avirons', difficulty: 'accessible' }, //   MDG 13 l.751
  'bancs-fracasses': { station: 'avirons', difficulty: 'difficile' }, //    MDG 13 l.756
};

const REPLIS = {
  [SHIP]: { cible: 'coque' }, // RAW : MDG 13 l.584 « le coup touche la Coque » — aucun arbitrage à taguer
  [RIVER]: {
    cible: 'coque',
    maison:
      "MSRC 07 l.70 laisse au MJ le choix entre la coque et la superstructure quand aucun membre d'équipage n'est " +
      "exposé ; il n'y a pas de MJ (CLAUDE.md règle 7) → arbitrage FIXE et éditable : la coque, comme le fait le RAW " +
      'maritime (MDG 13 l.584). #1657',
  },
};

const echecs = [];

const lire = (nom) => {
  const brut = fs.readFileSync(CHEMIN(nom), 'utf8');
  const doc = JSON.parse(brut);
  if (serializeDataset(doc) !== brut) {
    echecs.push(`${nom} : FORME NON CANONIQUE (pas JSON.stringify(doc, null, 2))`);
    return null;
  }
  return doc;
};

const rangeesDe = (doc) => Object.values(doc.tables).flat();
const coupsDe = (doc) => rangeesDe(doc).map((e) => e.crewHit).filter(Boolean);
const aLaCale = (v) => (v?.ship?.traits ?? []).some((t) => t.id === 'cale');

const docs = { [RIVER]: lire(RIVER), [SHIP]: lire(SHIP) };
const vehicules = lire(VEHICULES);
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const barge = () => vehicules.find((v) => v.id === 'barge-fluviale');

/** PREUVE sur le RÉSULTAT, jouée après écriture. */
function verifierResultat() {
  const relu = { [RIVER]: JSON.parse(fs.readFileSync(CHEMIN(RIVER), 'utf8')), [SHIP]: JSON.parse(fs.readFileSync(CHEMIN(SHIP), 'utf8')) };
  const veh = JSON.parse(fs.readFileSync(CHEMIN(VEHICULES), 'utf8'));
  for (const nom of [RIVER, SHIP]) {
    const attendu = APRES[nom];
    const rangees = rangeesDe(relu[nom]);
    const mesure = {
      rangees: rangees.length,
      crewHit: rangees.filter((e) => e.crewHit).length,
      shrapnel: rangees.filter((e) => typeof e.shrapnel === 'number').length,
    };
    for (const cle of Object.keys(attendu)) {
      if (mesure[cle] !== attendu[cle]) echecs.push(`POST ${nom} ${cle} : ${mesure[cle]} != ${attendu[cle]}`);
    }
    if (!relu[nom].replisSansExpose?.cible) echecs.push(`POST ${nom} : replisSansExpose absent`);
  }
  if (relu[RIVER].shrapnelHit !== undefined) echecs.push(`POST ${RIVER} : shrapnelHit non purge`);
  if (!Array.isArray(relu[SHIP].shrapnelHit)) echecs.push(`POST ${SHIP} : shrapnelHit perdu`);

  const coups = [RIVER, SHIP].flatMap((n) => coupsDe(relu[n]));
  const stations = (id) => coups.filter((c) => c.crewTarget?.stations?.length === 1 && c.crewTarget.stations[0] === id).length;
  const total = {
    crewHit: coups.length,
    epreuves: coups.filter((c) => c.test).length,
    certains: coups.filter((c) => c.ops).length,
    stationsPont: stations('pont'),
    stationsAvirons: stations('avirons'),
    stationsCale: stations('cale'),
    roleTimonier: coups.filter((c) => c.crewTarget?.role?.id === 'timonier').length,
    poste: coups.filter((c) => c.crewTarget?.poste === true).length,
    deckResiduel: [RIVER, SHIP].reduce((n, f) => n + (JSON.stringify(relu[f]).match(/"deck"/g) ?? []).length, 0),
  };
  for (const cle of Object.keys(APRES.total)) {
    if (total[cle] !== APRES.total[cle]) echecs.push(`POST total ${cle} : ${total[cle]} != ${APRES.total[cle]}`);
  }
  if (coups.some((c) => c.test && c.ops)) echecs.push('POST : un coup porte A LA FOIS test et ops');
  if (coups.some((c) => !c.test && !c.ops)) echecs.push('POST : un coup ne porte AUCUNE issue');
  if (coups.some((c) => typeof c.crewTarget !== 'object')) echecs.push('POST : un crewTarget est reste textuel');
  const cales = veh.filter((v) => aLaCale(v)).map((v) => v.id);
  if (cales.join(',') !== 'barge-fluviale') echecs.push(`POST ${VEHICULES} : porteurs du Trait « cale » = [${cales.join(', ')}] (attendu barge-fluviale seule)`);
}

const sortirSurEchecs = () => {
  if (!echecs.length) return;
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
};

// ---- REJEU : plus aucun `crewTarget` textuel/absent, plus aucun `shrapnelHit` fluvial.
{
  const restants = [RIVER, SHIP]
    .flatMap((n) => coupsDe(docs[n]))
    .filter((c) => typeof c.crewTarget !== 'object' || c.crewTarget === null);
  if (!restants.length && docs[RIVER].shrapnelHit === undefined) {
    const total = [RIVER, SHIP].reduce((n, f) => n + coupsDe(docs[f]).length, 0);
    console.log(`${RIVER} + ${SHIP} : no-op (deja migre — ${total} crewHit, cible en union)`);
    process.exit(0);
  }
}

// ---- PORTE DE FIDÉLITÉ : lecture SEULE.
{
  const ecarts = [];
  for (const nom of [RIVER, SHIP]) {
    const attendu = AVANT[nom];
    const rangees = rangeesDe(docs[nom]);
    const coups = rangees.map((e) => e.crewHit).filter(Boolean);
    const mesure = {
      rangees: rangees.length,
      crewHit: coups.length,
      deck: coups.filter((c) => c.crewTarget === 'deck').length,
      shrapnel: rangees.filter((e) => typeof e.shrapnel === 'number').length,
    };
    for (const cle of Object.keys(attendu)) {
      if (mesure[cle] !== attendu[cle]) ecarts.push(`${nom} ${cle} : ${mesure[cle]} != ${attendu[cle]}`);
    }
  }
  const parId = (nom) => new Map(rangeesDe(docs[nom]).map((e) => [e.id, e]));
  const river = parId(RIVER);
  const ship = parId(SHIP);
  for (const id of Object.keys(CIBLE_DES_DECK)) {
    if (river.get(id)?.crewHit?.crewTarget !== 'deck') ecarts.push(`${RIVER}/${id} : attendu crewTarget « deck »`);
  }
  for (const id of Object.keys(NOEUDS_MDG)) {
    const e = ship.get(id);
    if (!e) ecarts.push(`${SHIP}/${id} : rangee ABSENTE`);
    else if (e.crewHit) ecarts.push(`${SHIP}/${id} : porte DEJA un crewHit`);
  }
  const gouvernail = river.get('gouvernail-fluvial');
  if (gouvernail?.shrapnel !== 1) ecarts.push(`${RIVER}/gouvernail-fluvial : attendu shrapnel 1`);
  if (gouvernail?.crewHit) ecarts.push(`${RIVER}/gouvernail-fluvial : porte DEJA un crewHit`);
  if (ship.get('canon-detache')?.crewHit?.crewTarget !== undefined) ecarts.push(`${SHIP}/canon-detache : crewTarget attendu ABSENT (defaut implicite « poste »)`);
  if (!Array.isArray(docs[RIVER].shrapnelHit)) ecarts.push(`${RIVER} : shrapnelHit attendu present avant purge`);
  if (!barge()) ecarts.push(`${VEHICULES}/barge-fluviale : navire ABSENT`);
  else if (!Array.isArray(barge().ship?.traits)) ecarts.push(`${VEHICULES}/barge-fluviale : ship.traits absent`);
  if (ecarts.length) {
    console.error(`FIDELITE ROMPUE — rien n'est ecrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

// ---- ÉCRITURE.
/** Réécrit une rangée en PRÉSERVANT l'ordre de ses clés (`patch` remplace, `undefined` retire). */
const reecrire = (entree, patch, ajouts = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(entree)) {
    if (!(k in patch)) out[k] = v;
    else if (patch[k] !== undefined) out[k] = patch[k];
  }
  return { ...out, ...ajouts };
};

for (const [loc, table] of Object.entries(docs[RIVER].tables)) {
  docs[RIVER].tables[loc] = table.map((e) => {
    if (e.id === 'gouvernail-fluvial') {
      return reecrire(e, { shrapnel: undefined }, { crewHit: { crewTarget: { role: { id: 'timonier' } }, ops: degats5() } });
    }
    const cible = CIBLE_DES_DECK[e.id];
    if (!cible) return e;
    return reecrire(e, { crewHit: { ...e.crewHit, crewTarget: cible } });
  });
}

for (const [loc, table] of Object.entries(docs[SHIP].tables)) {
  docs[SHIP].tables[loc] = table.map((e) => {
    if (e.id === 'canon-detache') return reecrire(e, { crewHit: { crewTarget: { poste: true }, ...e.crewHit } });
    const n = NOEUDS_MDG[e.id];
    if (!n) return e;
    return { ...e, crewHit: { crewTarget: { stations: [n.station] }, test: noeudATerre(n.difficulty) } };
  });
}

/** Enveloppe du jeu : `shrapnelHit` (purgé côté fleuve) cède sa place à `replisSansExpose`. */
const enveloppe = (nom) => {
  const doc = docs[nom];
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === 'shrapnelHit') {
      if (nom === SHIP) out.shrapnelHit = v;
      out.replisSansExpose = REPLIS[nom];
    } else out[k] = v;
  }
  return out;
};

const sortie = { [RIVER]: enveloppe(RIVER), [SHIP]: enveloppe(SHIP) };
if (!aLaCale(barge())) barge().ship.traits = [...barge().ship.traits, { id: 'cale' }];

fs.writeFileSync(CHEMIN(RIVER), serializeDataset(sortie[RIVER]), 'utf8');
fs.writeFileSync(CHEMIN(SHIP), serializeDataset(sortie[SHIP]), 'utf8');
fs.writeFileSync(CHEMIN(VEHICULES), serializeDataset(vehicules), 'utf8');

verifierResultat();
sortirSurEchecs();

console.log(
  `${RIVER} : 3 « deck » -> stations nommees (pont/avirons/cale) · gouvernail-fluvial shrapnel 1 -> crewHit {role:timonier} · shrapnelHit purge · replisSansExpose pose\n` +
    `${SHIP} : 6 rangees MDG en prose -> crewHit (4 pont, 2 avirons, Athletisme/A Terre) · canon-detache {poste:true} EXPLICITE · replisSansExpose pose\n` +
    `${VEHICULES} : barge-fluviale gagne le Trait naval « cale » (MSRC 07 l.5 + MSRC 10 l.90)`,
);
