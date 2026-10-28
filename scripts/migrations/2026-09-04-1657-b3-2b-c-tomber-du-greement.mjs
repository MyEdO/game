/**
 * Migration #1657 train B3-2b-c — « Tomber du gréement » : les CINQ rangées du gréement dont le Test
 * ne vivait qu'en prose `note` (règle 7 de CLAUDE.md) le JOUENT, et leur chute a la hauteur du livre.
 *
 * CE QUI BOUGE (`src/data/ship-criticals.json` seul) :
 *  · la table « TOMBER DU GRÉEMENT » (`MDG 13 l.684-688`) entre en DONNÉE (`tablesDeChute`) : trois
 *    bandes de Tailles de bateau (`MDG 12 l.122-129`), une hauteur par PRÉSENCE à bord — gréement
 *    1d10/2d10/3d10 m, nid-de-pie 12/25/40 m ;
 *  · les cinq rangées qui disent « sous peine de tomber » gagnent leur `crewHit` : `vergue-detachee`
 *    (l.711, Accessible), `greement-degrade` (l.714, Intermédiaire), `voiles-detruites` (l.715,
 *    Accessible), `vergue-brisee` (l.717, Intermédiaire), `mat-brise` (l.718, Complexe). Chacune
 *    vise DEUX présences d'une SEULE épreuve — `MDG 13 l.680` : « les Personnages dans le nid-de-pie
 *    doivent aussi effectuer un Test pour savoir s'ils tombent, et vont tomber d'encore plus haut
 *    que ceux qui sont sur le gréement » ; l'échec applique l'op `fall`, qui lit la hauteur DANS la
 *    table par (Taille de la coque × station du tombant).
 *
 * ENTRÉE : `src/data/ship-criticals.json`.
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : cardinaux exigés sur l'état LU, et
 * chaque rangée à migrer RETROUVÉE par son id, sans `crewHit`. Un écart : sortie 1 sans rien écrire.
 *
 * FORME D'AVANT SEULE, marquée par l'absence de `tablesDeChute` : un document qui la porte (migré, ou
 * révisé depuis) est laissé tel quel, sans porte.
 * IDEMPOTENT : rejouée sur l'état final, elle reconnaît « déjà migré » et sort 0. FORMATAGE PRÉSERVÉ : le fichier lu est EXACTEMENT `JSON.stringify(doc, null, 2)`,
 * vérifié AVANT toute écriture ; la sortie l'est aussi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SHIP = 'ship-criticals.json';
const CHEMIN = path.join(ROOT, 'src/data', SHIP);

/** CARDINAUX attendus sur l'état AVANT, mesurés sur l'arbre `6f7926a02` (2026-09-04, après B3-2b-a). */
const AVANT = { rangees: 35, crewHit: 7, greementAvecCoup: 0 };

/** CARDINAUX exigés sur le RÉSULTAT (design v2 jugé, colonne « après -c »). */
const APRES = { rangees: 35, crewHit: 12, epreuves: 12, greementEtNid: 5, fall: 5 };

/** Id de la table de hauteur — la même pour les cinq rangées (le livre n'en imprime qu'une). */
const TABLE_DE_CHUTE = 'tomberDuGreement';

/** La table « TOMBER DU GRÉEMENT » verbatim (`MDG 13 l.684-688`) : Tailles `MDG 12 l.122-129`,
 *  hauteurs en `Formula` (nombre fixe pour le nid-de-pie, tirage pour le gréement). */
const TABLES_DE_CHUTE = [
  {
    id: TABLE_DE_CHUTE,
    label: 'Tomber du gréement',
    bandes: [
      { tailles: ['minuscule', 'tres-petite', 'petite'], hauteurs: { greement: { dice: { n: 1, sides: 10 } }, 'nid-de-pie': 12 } },
      { tailles: ['moyenne', 'grande'], hauteurs: { greement: { dice: { n: 2, sides: 10 } }, 'nid-de-pie': 25 } },
      { tailles: ['enorme', 'monstrueuse'], hauteurs: { greement: { dice: { n: 3, sides: 10 } }, 'nid-de-pie': 40 } },
    ],
  },
];

/** Les CINQ rangées « sous peine de tomber », avec la Difficulté que la rangée imprime. */
const RANGEES = {
  'vergue-detachee': 'accessible', //  MDG 13 l.711
  'greement-degrade': 'intermediaire', // MDG 13 l.714
  'voiles-detruites': 'accessible', //  MDG 13 l.715
  'vergue-brisee': 'intermediaire', //  MDG 13 l.717
  'mat-brise': 'complexe', //           MDG 13 l.718
};

/** Le coup d'une rangée du gréement : UNE épreuve d'Athlétisme pour les DEUX présences (l.680),
 *  l'échec fait tomber — la hauteur vient de la table, par Taille et par station. */
const coupDeChute = (difficulty) => ({
  crewTarget: { stations: ['greement', 'nid-de-pie'] },
  test: {
    kind: 'test',
    test: { skill: { id: 'athletisme' }, difficulty },
    success: { kind: 'seq', steps: [] },
    fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'fall', hauteur: { table: { id: TABLE_DE_CHUTE } } }], on: 'target' } },
  },
});

const echecs = [];

const brut = fs.readFileSync(CHEMIN, 'utf8');
const doc = JSON.parse(brut);
if (serializeDataset(doc) !== brut) {
  console.error(`ARBITRAGE REQUIS — ${SHIP} : FORME NON CANONIQUE (pas JSON.stringify(doc, null, 2))`);
  process.exit(1);
}

const rangeesDe = (d) => Object.values(d.tables).flat();
const coupsDe = (d) => rangeesDe(d).map((e) => e.crewHit).filter(Boolean);

/** PREUVE sur le RÉSULTAT, jouée après écriture. */
function verifierResultat() {
  const relu = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
  const rangees = rangeesDe(relu);
  const coups = rangees.map((e) => e.crewHit).filter(Boolean);
  const opsDeChute = coups.flatMap((c) => c.test?.fail?.effect?.ops ?? []).filter((o) => o.op === 'fall');
  const mesure = {
    rangees: rangees.length,
    crewHit: coups.length,
    epreuves: coups.filter((c) => c.test).length,
    greementEtNid: coups.filter((c) => (c.crewTarget?.stations ?? []).join(',') === 'greement,nid-de-pie').length,
    fall: opsDeChute.length,
  };
  for (const cle of Object.keys(APRES)) {
    if (mesure[cle] !== APRES[cle]) echecs.push(`POST ${SHIP} ${cle} : ${mesure[cle]} != ${APRES[cle]}`);
  }
  if (opsDeChute.some((o) => o.hauteur?.table?.id !== TABLE_DE_CHUTE)) echecs.push(`POST ${SHIP} : une op fall ne vise pas « ${TABLE_DE_CHUTE} »`);
  const table = (relu.tablesDeChute ?? []).find((t) => t.id === TABLE_DE_CHUTE);
  if (!table) echecs.push(`POST ${SHIP} : table « ${TABLE_DE_CHUTE} » absente`);
  else {
    // Les TROIS bandes de hauteur sont celles de la table `MDG 13 l.684-688` — cardinal IMPOSÉ par le
    // livre, jamais une population qui grandit (#1812).
    if (table.bandes.length !== 3) echecs.push(`POST ${SHIP} : ${table.bandes.length} bandes de chute (attendu 3, MDG 13 l.684)`);
    const tailles = table.bandes.flatMap((b) => b.tailles);
    if (tailles.length !== 7) echecs.push(`POST ${SHIP} : ${tailles.length} Tailles couvertes (attendu les 7 de MDG 12 l.122-129)`);
    if (table.bandes.some((b) => Object.keys(b.hauteurs).join(',') !== 'greement,nid-de-pie')) {
      echecs.push(`POST ${SHIP} : une bande ne porte pas les DEUX colonnes du livre`);
    }
  }
  const parId = new Map(rangees.map((e) => [e.id, e]));
  for (const [id, difficulty] of Object.entries(RANGEES)) {
    const test = parId.get(id)?.crewHit?.test;
    if (test?.test?.difficulty !== difficulty) echecs.push(`POST ${SHIP}/${id} : Difficulté « ${test?.test?.difficulty} » != « ${difficulty} »`);
    if (test?.test?.skill?.id !== 'athletisme') echecs.push(`POST ${SHIP}/${id} : Compétence != athletisme`);
  }
}

const sortirSurEchecs = () => {
  if (!echecs.length) return;
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
};

// ---- REJEU : la table est posée.
if (doc.tablesDeChute !== undefined) {
  console.log(`${SHIP} : no-op (deja migre — ${coupsDe(doc).length} crewHit, table de chute posee)`);
  process.exit(0);
}

// ---- PORTE DE FIDÉLITÉ : lecture SEULE.
{
  const ecarts = [];
  const rangees = rangeesDe(doc);
  const mesure = {
    rangees: rangees.length,
    crewHit: rangees.filter((e) => e.crewHit).length,
    greementAvecCoup: (doc.tables.greement ?? []).filter((e) => e.crewHit).length,
  };
  for (const cle of Object.keys(AVANT)) {
    if (mesure[cle] !== AVANT[cle]) ecarts.push(`${SHIP} ${cle} : ${mesure[cle]} != ${AVANT[cle]}`);
  }
  const parId = new Map(rangees.map((e) => [e.id, e]));
  for (const id of Object.keys(RANGEES)) {
    const e = parId.get(id);
    if (!e) ecarts.push(`${SHIP}/${id} : rangee ABSENTE`);
    else if (e.crewHit) ecarts.push(`${SHIP}/${id} : porte DEJA un crewHit`);
    else if (!/sous peine de tomber/.test(e.note)) ecarts.push(`${SHIP}/${id} : la note ne dit pas « sous peine de tomber »`);
  }
  if (ecarts.length) {
    console.error(`FIDELITE ROMPUE — rien n'est ecrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

// ---- ÉCRITURE.
doc.tables.greement = doc.tables.greement.map((e) => (RANGEES[e.id] ? { ...e, crewHit: coupDeChute(RANGEES[e.id]) } : e));

/** Enveloppe du jeu : la table de chute se pose APRÈS `replisSansExpose`, avant les tables d10. */
const sortie = {};
for (const [k, v] of Object.entries(doc)) {
  sortie[k] = v;
  if (k === 'replisSansExpose') sortie.tablesDeChute = TABLES_DE_CHUTE;
}

fs.writeFileSync(CHEMIN, serializeDataset(sortie), 'utf8');

verifierResultat();
sortirSurEchecs();

console.log(
  `${SHIP} : 5 rangees du greement en prose -> crewHit {stations:[greement,nid-de-pie]} (Athletisme, echec = op fall)\n` +
    `${SHIP} : table « ${TABLE_DE_CHUTE} » posee (3 bandes, 7 Tailles, greement 1d10/2d10/3d10 m, nid-de-pie 12/25/40 m)`,
);
