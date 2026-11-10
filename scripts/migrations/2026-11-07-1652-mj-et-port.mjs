/**
 * Migration #1652 lot 9 — les dernières rangées de `sea-events.json` qui portent un genre (`kind` + `params`) le
 * perdent : celles que la grammaire joue reçoivent leur `consequence` (`Flow`, joué par `runFlow`), les autres
 * deviennent narratives (leur `desc` verbatim au journal, l'omission dite au `raw.manifest.json`).
 *
 *   rangée (table)                               consequence
 *   `autres-voyageurs` (bord)                    `choice` le laisser approcher : rumeur (Demande +2 d'une
 *                                                cargaison dans un autre port, 10+2d10 jours) et dangers
 *                                                signalés (périls évités pendant 1d10 jours)
 *                                                                                      MDG 15 l.205-208
 *   `ile-inconnue` (bord)                        `choice` accoster : 2d10 tonneaux d'eau, 1d10 jours de vivres,
 *                                                1d10 ≤ 2 : les bas-fonds                MDG 15 l.221-223
 *   `penuries` (escale)                          op `marcheDuPort` colonnes `penurie`   MDG 15 l.253
 *   `saturation-de-produits` (escale)            op `marcheDuPort` colonnes `saturation` MDG 15 l.263
 *   `trop-beau-pour-etre-vrai` (escale)          op `marcheDuPort` offre (`maxEnc`, `discountPct`)
 *                                                                                      MDG 15 l.256
 *   `rumeurs-commerciales` (escale)              Test de Ragot (`gossipDifficulty`) ; réussite : op
 *                                                `marcheDuPort` demande (`demandBonus`, `days`)
 *                                                                                      MDG 15 l.259
 *   `culte-de-la-personnalite` (bord)            `rollTable` 1d10 de l'allégeance du zélote, ses rangées
 *                                                en `narrative` verbatim                MDG 15 l.154-158
 *   `la-tache-noire`, `constructeur-de-navires-itinerant`,
 *   `offre-de-mission`, `bonne-peche` (escale)   narratives : genre et `params` retirés
 *
 * Valeurs MAISON, sur la consigne de l'utilisateur du 2026-11-07 (« N attends pas les arbitrages, met ce qui te
 * semble juste ») : la rumeur des Autres voyageurs reprend la Demande +2 pour 10+2d10 jours de l'escale (l.259) ;
 * leurs dangers signalés écartent les périls de `sea-perils.json` pendant 1d10 jours, comme le Marsouin (l.229) ; l'Île
 * inconnue donne l'eau des Pestiférés (2d10 tonneaux, l.194) et les vivres de la Manne (1d10 jours, l.235), et
 * ses bancs de sable (l.221) se heurtent sur 1-2 au d10.
 *
 * Chaque rangée qui porte une valeur maison, de ce lot ou des lots 2 à 8, reçoit le champ `maison` (sa raison) s'il
 * est absent.
 *
 * Entrée : src/data/sea-events.json. Une rangée nommée absente n'est pas une anomalie : la migration rejouée après
 * sa suppression sort 0 sans écrire.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée nommée ne porte plus `kind` ni `params`. Des `params` hors de la
 * forme attendue ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur
 * l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const PERILS_SIGNALES = ['iceberg', 'debris-marins', 'rocher', 'bas-fonds'];
const DEMANDE_DE_RUMEUR = 2;
const JOURS_DE_RUMEUR = { dice: { n: 2, sides: 10, plus: 10 } };

const arrets = [];

const feuille = (on, ops) => ({ kind: 'do', effect: { type: 'ops', on, ops } });
const marche = (ops) => ({ kind: 'do', effect: { type: 'ops', ops } });
const d = (n, sides) => ({ dice: { n, sides } });

/** La conséquence de chaque rangée nommée, depuis ses `params` ; `null` : la rangée devient narrative. */
const CONSEQUENCES = {
  boardEvents: {
    'culte-de-la-personnalite': () => feuille('navire', [{
      op: 'rollTable', die: '1d10', entries: [
        { min: 1, max: 3, ops: [{ op: 'narrative', text: "une opinion politique révolutionnaire comme le nouveau millénarisme (voir page 140 de Middenheim) ou le kloszowskisme (voir page 34 d'Altdorf)" }] },
        { min: 4, max: 6, ops: [{ op: 'narrative', text: 'une entreprise criminelle, comme la contrebande' }] },
        { min: 7, max: 9, ops: [{ op: 'narrative', text: 'le culte de Stromfels' }] },
        { min: 10, max: 10, ops: [{ op: 'narrative', text: 'le culte de Tzeentch' }] },
      ],
    }]),
    'autres-voyageurs': () => ({
      kind: 'choice', prompt: 'Laisser le navire approcher',
      yes: feuille('navire', [
        { op: 'marcheDuPort', demande: DEMANDE_DE_RUMEUR, jours: JOURS_DE_RUMEUR },
        { op: 'navireMod', evite: PERILS_SIGNALES, jusqua: { jours: d(1, 10) } },
      ]),
    }),
    'ile-inconnue': () => ({
      kind: 'choice', prompt: 'Accoster sur l’île',
      yes: feuille('navire', [
        { op: 'provisions', eauTonneaux: d(2, 10) },
        { op: 'provisions', jours: d(1, 10) },
        { op: 'rollTable', die: '1d10', entries: [{ min: 1, max: 2, ops: [{ op: 'perilDeMer', collision: { id: 'bas-fonds' } }] }, { min: 3, max: 10, ops: [] }] },
      ]),
    }),
  },
  portEvents: {
    'la-tache-noire': () => null,
    penuries: () => marche([{ op: 'marcheDuPort', colonnes: 'penurie' }]),
    'saturation-de-produits': () => marche([{ op: 'marcheDuPort', colonnes: 'saturation' }]),
    'constructeur-de-navires-itinerant': () => null,
    'trop-beau-pour-etre-vrai': (p, ou) => {
      if (!Number.isInteger(p.maxEnc) || p.maxEnc < 1) arrets.push(`${ou} : params.maxEnc « ${p.maxEnc} » n'est pas un entier positif`);
      if (!Number.isInteger(p.discountPct) || p.discountPct < 1 || p.discountPct > 99) arrets.push(`${ou} : params.discountPct « ${p.discountPct} » hors de 1-99`);
      return marche([{ op: 'marcheDuPort', offre: { enc: p.maxEnc, remisePct: p.discountPct } }]);
    },
    'rumeurs-commerciales': (p, ou) => {
      if (typeof p.gossipDifficulty !== 'string') arrets.push(`${ou} : params.gossipDifficulty absent`);
      if (!Number.isInteger(p.demandBonus)) arrets.push(`${ou} : params.demandBonus « ${p.demandBonus} » n'est pas un entier`);
      if (!p.days?.dice) arrets.push(`${ou} : params.days hors de la forme {dice}`);
      return {
        kind: 'test',
        test: { skill: { id: 'ragot' }, difficulty: p.gossipDifficulty, stake: { key: { dataset: 'voyage', kind: 'sea-rumeurs-commerciales', entryId: 'rumeurs-commerciales', entryCategory: 'seaPortEvents' } } },
        success: marche([{ op: 'marcheDuPort', demande: p.demandBonus, jours: p.days }]),
        fail: { kind: 'seq', steps: [] },
      };
    },
    'offre-de-mission': () => null,
    'bonne-peche': () => null,
  },
};

const CONSIGNE = 'consigne utilisateur 2026-11-07';
/** La raison maison de chaque rangée nommée. */
const MAISON = {
  boardEvents: {
    'autres-voyageurs': `MDG 15 l.205-208 laisse au MJ ce que le navire apporte : la rumeur reprend la Demande +2 pour 10+2d10 jours de l'escale (l.259), les dangers signalés écartent les périls pendant 1d10 jours, comme le Marsouin amical (l.229), car un péril se heurte PENDANT un événement de bord ; le commerce et la menace ne sont pas joués (${CONSIGNE}).`,
    'ile-inconnue': `MDG 15 l.221-223 ne chiffre ni l'eau, ni les vivres, ni les dangers : 2d10 tonneaux (l.194), 1d10 jours de vivres (l.235), les bas-fonds heurtés sur 1-2 au d10 (${CONSIGNE}).`,
    'vents-favorables': `MDG 15 ne borne pas la durée : jusqu'au prochain événement de bord (${CONSIGNE}).`,
    'marsouin-amical': `Les périls écartés sont Rocher et Bas-fonds (MDG 13 l.493-499), Collision soudaine comprise, pendant 1d10 jours (${CONSIGNE}).`,
    'canot-de-sauvetage': `Nautonier → navigateur, Médecin de bord → chirurgien ; Marin et Officier accroissent l'effectif anonyme ; le chat est narratif (${CONSIGNE}).`,
    'vaisseau-de-pestiferes': `Une caisse = 1 Enc (MDG 12 l.35 ne la chiffre pas) ; monter à bord : « non » par défaut ; le butin s'embarque sans volontaire (${CONSIGNE}).`,
    'puissant-monstre-marin': `La créature repoussée compte comme vaincue, chacune est repoussée seule, aucun Test de Surprise (${CONSIGNE}).`,
    'monstre-marin': `La créature repoussée compte comme vaincue, chacune est repoussée seule, aucun Test de Surprise (${CONSIGNE}).`,
  },
  portEvents: {
    penuries: `MDG 15 l.253 ne borne pas la pénurie : elle dure jusqu'au départ du navire. La cargaison de commerce (l.321), tirée de la colonne Production, n'est pas en vente ; le port garde sa mention Commerce pour la vente (l.360-391) (${CONSIGNE}).`,
    'saturation-de-produits': `MDG 15 l.263 ne borne pas la saturation : elle dure jusqu'au départ du navire ; la mention Commerce n'est pas une marchandise et reste en Production (${CONSIGNE}).`,
    'trop-beau-pour-etre-vrai': `MDG 15 l.256 : l'offre vaut jusqu'au départ du navire ; le Marchandage s'applique au prix remisé ; tant qu'il reste du lot, il tient la place de l'offre ordinaire de la même cargaison, une offre par cargaison à l'étal ; l'invitation à quitter le port n'est pas jouée (${CONSIGNE}).`,
    'port-desert': `Le butin : 1d10 jours de vivres (l.235) et 1d100 Enc de cargaison (l.209) (${CONSIGNE}).`,
    'passager-clandestin': `Mousse → mousse, Nautonier → navigateur, Médecin de bord → chirurgien ; Marin, Mercenaire expérimenté et Officier accroissent l'effectif anonyme ; le passager non repéré rejoint l'équipage tout de suite (${CONSIGNE}).`,
    'controle-a-quai': `Toute la cargaison est déclarée (aucune mécanique ne la cache, l.247) ; les droits de 10 % s'arrondissent à l'inférieur (${CONSIGNE}).`,
  },
};

/** Remplace `kind` par `consequence` au même rang (ou le retire), et retire `params`. */
function reecrire(e, consequence) {
  const copie = Object.entries(e);
  for (const k of Object.keys(e)) delete e[k];
  for (const [k, v] of copie) {
    if (k === 'params') continue;
    if (k === 'kind') {
      if (consequence) e.consequence = consequence;
    } else e[k] = v;
  }
}

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const [table, rangees] of Object.entries(CONSEQUENCES)) {
    for (const e of sea[table]?.entries ?? []) {
      const ou = `sea-events.json ${table} « ${e.id} »`;
      const consequenceDe = rangees[e.id];
      if (!consequenceDe || e.kind === undefined) continue;
      if (e.consequence !== undefined) arrets.push(`${ou} : consequence et kind coexistent`);
      reecrire(e, consequenceDe(e.params ?? {}, ou));
      gestes++;
    }
    for (const e of sea[table]?.entries ?? []) {
      const raison = MAISON[table]?.[e.id];
      if (raison && e.maison === undefined) { e.maison = raison; gestes++; }
      if (rangees[e.id] && (e.kind !== undefined || e.params !== undefined)) arrets.push(`sea-events.json ${table} « ${e.id} » : genre non retiré`);
    }
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
console.log(`migration 1652 (MJ et port) : ${gestes} rangée(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
