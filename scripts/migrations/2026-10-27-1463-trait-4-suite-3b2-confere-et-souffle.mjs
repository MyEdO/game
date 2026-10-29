/**
 * Migration #1463 (lot Trait 3b-2, #3038) — l'Indice formulé d'un Trait posé, les Traits que confère une
 * attaque, et le Souffle composé de la règle de son Type.
 *
 * GESTES :
 *  1. `traits.json` : les Traits d'attaque portent le marqueur `attaque` (ZI 03 l.75, l.77 ; ZI 06 l.32) ;
 *     le Souffle porte `difficulte` (MDG 16 l.226 ; LDB 16 l.70) et octroie la seule manœuvre `souffle`.
 *  2. `maneuvers.json` : les six manœuvres `souffle-<Type>` cèdent la place à la manœuvre `souffle`
 *     (Dégâts d'Arme égaux à l'Indice, LDB 85 l.320), dont l'enjeu laisse un trou à la règle du Type ; la
 *     règle de chaque Type passe sur son Type. La forme hybride d'Enfant d'Ulric octroie Arme et Morsure à
 *     l'Indice formulé (Middenheim 04 l.29).
 *  3. `breath-types.json` : chaque Type porte sa règle (PA ignorées, État infligé, équipement endommagé,
 *     fumée) et son folio (LDB 85 l.322-329) ; le Type imprimé
 *     « Corrosion et Poison » (EDOC 13 l.237) entre au registre et nomme ses deux Types.
 *  4. `etats.json` : le Test de Résistance qui élimine Empoisonné prend la Difficulté de l'État (LDB 16 l.70).
 *  5. `domains.json` : la marque `arcane` d'un Domaine des Arcanes devient l'`id` du Type de son Souffle,
 *     dont la raison se dit à son `maison`, motivée par la description de son Vent (LDB 47 l.509).
 *  6. Fiches (`FICHES`) : Indice imprimé en formule (Middenheim 04 l.29 ; VDM 02 l.479), Traits conférés
 *     (ZI 03 l.75, l.77 ; ZI 06 l.32 ; ZI 13 l.61, l.101, l.132), Type et Difficulté du Souffle (MDG 16 l.226).
 *  7. `tables.json` : le Souffle du Tableau de l'Allure démoniaque de Nurgle désigne son Type (EDOC 13 l.237).
 *
 * ENTRÉES : écrites — `src/data/traits.json`, `src/data/maneuvers.json`, `src/data/breath-types.json`,
 * `src/data/etats.json`, `src/data/domains.json`, `src/data/creatures.json`, `src/data/tables.json`.
 * FORME D'AVANT SEULE (`lib/formeDAvant.mjs`) : chaque geste n'agit que sur la forme d'avant EXACTE de ce
 * qu'il réécrit, quel que soit l'ordre de ses clés ; une entrée longue (une manœuvre entière) se reconnaît à
 * l'EMPREINTE de sa forme d'avant, prise au parent du commit qui introduit la migration. Une entrée déjà à la
 * forme cible, ajoutée ou révisée après la migration, ou absente, est laissée telle quelle.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un Domaine marqué
 * `arcane: true` sans `maison` absent de `SOUFFLES_DES_DOMAINES`, ou dont le Type est absent du registre ;
 * un Domaine sans marque `true` qui porte encore `breathType`.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';
import { empreinteDeForme, porteLaTranche } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const F = {
  traits: 'src/data/traits.json',
  maneuvers: 'src/data/maneuvers.json',
  breath: 'src/data/breath-types.json',
  etats: 'src/data/etats.json',
  domains: 'src/data/domains.json',
  creatures: 'src/data/creatures.json',
  tables: 'src/data/tables.json',
};

const fautes = [];
const docs = new Map();
for (const rel of Object.values(F)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte });
}
const doc = (rel) => docs.get(rel).doc;
let gestes = 0;

// 1. traits.json
const ATTAQUES = ['a-distance', 'arme', 'attaque-caudale', 'cornes', 'langue-prehensile', 'morsure', 'souffle', 'tentacules', 'vomissement'];
const traits = doc(F.traits);
const trait = (id) => traits.find((t) => t.id === id);
for (const id of ATTAQUES) {
  const t = trait(id);
  if (t && t.attaque === undefined) { t.attaque = true; gestes++; }
}

// 2-3. maneuvers.json, breath-types.json
const SOURCE_LDB = { book: 'livre-de-base', page: 341 };
const SOURCE_EDOC = { book: 'ennemi-dans-l-ombre-compagnon', page: 78 };
const aLaTouche = (ops) => ({ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops } } });
const REGLES = {
  feu: { ignoreAP: true, etat: 'en-flammes' },
  froid: { etat: 'sonne' },
  corrosif: { endommageLEquipement: true },
  electrique: { ignoreAP: true, etat: 'sonne' },
  poison: { ignoreAP: true, etat: 'empoisonne' },
  fumee: { fumee: true },
};
/** Les six manœuvres `souffle-<Type>` d'avant, à l'empreinte de leur forme d'avant. */
const ANCIENNES = {
  'souffle-feu': 'c37064b6c58a62004e3cd26e02ffa318dc2e03b1f74b9a4b4000284bdab2bd31',
  'souffle-froid': '2c104dd2e6d26bb7ea99dc16af0beb441696570646de41d6ed90754796bb4fef',
  'souffle-corrosif': '0bb75c6754a08ce2731f39de3bf5bbd4781cfc45df5257593777f22a2e37715a',
  'souffle-electrique': '4c27be30f3b87f786323be270627d85926ce3b2e02887d41561752de04fd2237',
  'souffle-poison': '55844e166ea51028085a1bd4e6dada8f1f47898deef2895fa0f6280b7634c93b',
  'souffle-fumee': '5530cb5b43ba7733f0650bbb3ec0c11fb3551c78e0333c77cc62195412c6a5db',
};
const souffle = trait('souffle');
if (porteLaTranche(souffle, { grantsManeuvers: Object.keys(ANCIENNES).map((id) => ({ id })), difficulte: undefined })) {
  souffle.difficulte = true;
  souffle.grantsManeuvers = [{ id: 'souffle' }];
  gestes++;
}
const SOUFFLE = {
  id: 'souffle', type: 'maneuvers', label: 'Souffle', kind: 'souffle', activation: 'free', advantageCost: 2,
  stat: 'capacite-de-tir', defense: 'esquive', targeting: 'zone', range: { bonusOf: 'endurance', plus: 20 },
  blast: { bonusOf: 'force' }, magic: true, source: SOURCE_LDB,
  effects: [aLaTouche([{ op: 'wounds', amount: { indiceOf: true }, ignoreTB: false, ignoreAP: false }])],
  stake: 'Esquive — réussie : le souffle est évité. Ratée : Dégâts d’Arme égaux à l’Indice{regleDuType}.',
  stakeForm: 'descripteur',
};
const manoeuvres = doc(F.maneuvers);
const estAncienne = (m) => Object.hasOwn(ANCIENNES, m.id) && empreinteDeForme(m) === ANCIENNES[m.id];
const iAncienne = manoeuvres.findIndex(estAncienne);
if (iAncienne >= 0 && !manoeuvres.some((m) => m.id === 'souffle')) { manoeuvres.splice(iAncienne, 0, SOUFFLE); gestes++; }
for (let i = manoeuvres.length - 1; i >= 0; i--) if (estAncienne(manoeuvres[i])) { manoeuvres.splice(i, 1); gestes++; }

// Middenheim 04 l.29
const BF_PLUS = (n) => ({ sum: [{ bonusOf: 'force' }, n] });
const HYBRIDE = [
  { id: 'arme', avant: 4, apres: BF_PLUS(4) },
  { id: 'morsure', avant: 3, apres: BF_PLUS(3) },
];
/** Empreinte de la forme d'avant de la manœuvre `forme-hybride-ulric`. */
const HYBRIDE_D_AVANT = '3edfed145e810d9d65479adefd1f5ffe8775d0a5bf85a22bc4736e84cf1c5a4c';
const hybride = manoeuvres.find((m) => m.id === 'forme-hybride-ulric');
if (hybride && empreinteDeForme(hybride) === HYBRIDE_D_AVANT) {
  const octroisHybrides = hybride.effects.flatMap((e) => e.flow?.effect?.ops ?? []).flatMap((o) => (o.op === 'transform' ? o.ops : [])).filter((o) => o.op === 'grantTrait');
  for (const { id, avant, apres } of HYBRIDE) {
    for (const o of octroisHybrides) if (egal(o.trait, { id, value: avant })) { o.trait = { id, value: apres }; gestes++; }
  }
  const ENJEU_HYBRIDE = ['les Traits Arme 4, Armure 2, Morsure 3,', 'les Traits Arme (BF +4), Armure 2, Morsure (BF +3),'];
  hybride.stake = hybride.stake.replace(...ENJEU_HYBRIDE);
  gestes++;
}

const types = doc(F.breath);
/** Libellé de chaque Type à sa forme d'avant `{ id, type, label }`. */
const LIBELLES_D_AVANT = { feu: 'Feu', froid: 'Froid', corrosif: 'Corrosif', electrique: 'Électrique', poison: 'Poison', fumee: 'Fumée' };
let registreDAvant = false;
for (const [id, regle] of Object.entries(REGLES)) {
  const t = types.find((x) => x.id === id);
  if (!t || !egal(t, { id, type: 'breath-types', label: LIBELLES_D_AVANT[id] })) continue;
  Object.assign(t, { source: SOURCE_LDB, ...regle });
  registreDAvant = true;
  gestes++;
}
const COMPOSE = { id: 'corrosion-et-poison', type: 'breath-types', label: 'Corrosion et Poison', source: SOURCE_EDOC, types: [{ id: 'corrosif' }, { id: 'poison' }] };
if (registreDAvant && !types.some((x) => x.id === COMPOSE.id)) { types.push(COMPOSE); gestes++; }

// 4. etats.json
const empoisonne = doc(F.etats).find((e) => e.id === 'empoisonne');
const testDElimination = empoisonne?.effects?.map((e) => e.flow).find((f) => f?.kind === 'test' && f.test?.skill?.id === 'resistance');
const TEST_D_AVANT = { skill: { id: 'resistance' }, difficulty: 'intermediaire', label: 'Résistance à l’Empoisonné' };
if (egal(testDElimination?.test, TEST_D_AVANT)) { testDElimination.test.argDifficulty = true; gestes++; }

// 5. domains.json — LDB 47 l.509 ; Types de LDB 85 l.322-329
const lecture = (vent) => `Type de Souffle, lecture révisable de LDB 47 l.509 (#3060) : ${vent}`;
/** Domaine → son Type de Souffle (`id`), sa raison (`maison`), et le `breathType` imprimé de sa forme d'avant. */
const SOUFFLES_DES_DOMAINES = {
  feu: { breathType: 'Feu', id: 'feu', maison: lecture('le Feu se manifeste par des flammes vives et une chaleur intense (LDB 48 l.203).') },
  cieux: { breathType: 'Électrique', id: 'electrique', maison: lecture('les Sorts des Cieux s’accompagnent du craquement de la foudre (LDB 48 l.104).') },
  metal: { breathType: 'Corrosif', id: 'corrosif', maison: lecture('Chamon s’attache aux substances métalliques et frappe ceux qui s’enveloppent de métal (LDB 48 l.397-399) ; le Corrosif endommage l’équipement porté.') },
  ombres: { breathType: 'Fumée', id: 'fumee', maison: lecture('les Sorts des Ombres enveloppent le lanceur d’ombres et de volutes de fumée (LDB 48 l.588).') },
  bete: { id: 'froid', maison: lecture('Ghur reflète une férocité primitive et glaciale (LDB 48 l.9).') },
  mort: { id: 'froid', maison: lecture('les cibles de la Mort demeurent affaiblies et léthargiques (LDB 48 l.501) ; le Froid les Sonne.') },
  lumiere: { id: 'electrique', maison: lecture('la Lumière émet des rayons éclatants d’une lumière aveuglante (LDB 48 l.300) ; l’Électrique ignore les PA et Sonne, au plus près de l’Aveuglé du Domaine.') },
  vie: { id: 'poison', maison: lecture('Ghyran se manifeste par des vignes, des sous-bois et des phénomènes naturels (LDB 48 l.688) ; le Poison est le seul Type végétal.') },
  'magie-naturelle': { id: 'poison', maison: lecture('les Élus tirent leurs composants des herbes et des plantes (LDB 48 l.796).') },
  'magie-du-marais-de-mona': { id: 'poison', maison: lecture('Mòna erre dans les marais en quête de champignons vénéneux (VDM 15 l.240).') },
  necromancie: { id: 'poison', maison: lecture('la Nécromancie use de corps en décomposition, la plus infecte des Magies (LDB 50 l.61).') },
  sorcellerie: { id: 'poison', maison: lecture('la Sorcellerie mêle tous les Vents et d’horribles composants arrachés aux bêtes (LDB 49 l.5-7).') },
  gueule: { id: 'corrosif', maison: lecture('la Magie des Entrailles met en avant une faim intense (ADE II 02 l.733) ; le Corrosif est celui des sucs.') },
  demonologie: { id: 'froid', maison: lecture('la description de la Démonologie (LDB 50 l.9) n’appuie aucun Type ; le Froid, premier Type de la liste (LDB 85 l.324).') },
};
for (const d of doc(F.domains)) {
  const voulu = Object.hasOwn(SOUFFLES_DES_DOMAINES, d.id) ? SOUFFLES_DES_DOMAINES[d.id] : undefined;
  if (d.arcane !== true) { if (d.breathType !== undefined) fautes.push(`${F.domains} : « ${d.id} » porte encore « breathType »`); continue; }
  if (d.maison !== undefined) continue;
  if (!voulu) { fautes.push(`${F.domains} : Domaine des Arcanes « ${d.id} » absent de SOUFFLES_DES_DOMAINES`); continue; }
  if (!porteLaTranche(d, { breathType: voulu.breathType })) continue;
  if (!types.some((t) => t.id === voulu.id)) { fautes.push(`${F.breath} : Type « ${voulu.id} » introuvable`); continue; }
  delete d.breathType;
  d.arcane = voulu.id;
  d.maison = voulu.maison;
  gestes++;
}

// 6. Fiches : dans la liste `liste` de la fiche, le Trait à la forme `avant` est réécrit en `apres`.
const FICHES = [
  // Middenheim 04 l.29
  { fiche: 'enfant-d-ulric', liste: 'traits', avant: { id: 'arme', arg: 'BF +4' }, apres: { id: 'arme', value: { sum: [{ bonusOf: 'force' }, 4] } } },
  { fiche: 'enfant-d-ulric', liste: 'traits', avant: { id: 'morsure', arg: 'BF +3' }, apres: { id: 'morsure', value: { sum: [{ bonusOf: 'force' }, 3] } } },
  // VDM 02 l.479
  { fiche: 'fabrique-par-magie', liste: 'optionals', avant: { id: 'cornes', arg: 'BF +3' }, apres: { id: 'cornes', value: { sum: [{ bonusOf: 'force' }, 3] } } },
  // ZI 03 l.75, l.77
  { fiche: 'vouivre-zoo-imperial', liste: 'traits', avant: { id: 'arme', value: 10, arg: 'Crocs' }, apres: { id: 'arme', value: 10, arg: 'Crocs', confere: [{ id: 'infecte' }] } },
  { fiche: 'vouivre-zoo-imperial', liste: 'traits', avant: { id: 'attaque-caudale', value: 12, arg: 'Venin' }, apres: { id: 'attaque-caudale', value: 12, confere: [{ id: 'venin' }] } },
  // ZI 06 l.32
  { fiche: 'cockatrice', liste: 'traits', avant: { id: 'arme', value: 7, arg: 'Serres', natural: true }, apres: { id: 'arme', value: 7, arg: 'Serres', natural: true, confere: [{ id: 'venin', arg: 'difficile' }] } },
  { fiche: 'cockatrice', liste: 'optionals', avant: { id: 'souffle', value: 9, arg: 'Corrosion' }, apres: { id: 'souffle', value: 9, arg: 'corrosif' } },
  // ZI 13 l.61
  { fiche: 'wyrm-des-mers', liste: 'traits', avant: { id: 'arme', value: 11, arg: 'Gueule bardée de crocs' }, apres: { id: 'arme', value: 11, arg: 'Gueule bardée de crocs', confere: [{ id: 'venin', arg: 'complexe' }] } },
  { fiche: 'wyrm-des-mers', liste: 'traits', avant: { id: 'morsure', value: 11, arg: 'Gueule bardée de crocs' }, apres: { id: 'morsure', value: 11, arg: 'Gueule bardée de crocs', confere: [{ id: 'venin', arg: 'complexe' }] } },
  // ZI 13 l.101
  { fiche: 'dragon-barbele', liste: 'traits', avant: { id: 'morsure', value: 11 }, apres: { id: 'morsure', value: 11, confere: [{ id: 'venin' }] } },
  // ZI 13 l.132
  { fiche: 'le-fantasma', liste: 'traits', avant: { id: 'morsure', value: 11 }, apres: { id: 'morsure', value: 11, confere: [{ id: 'venin' }] } },
  // MDG 16 l.226
  { fiche: 'hydre-d-os', liste: 'traits', avant: { id: 'souffle', value: 10, arg: 'Poison, Difficulté Difficile (–20)' }, apres: { id: 'souffle', value: 10, arg: 'poison', difficulte: 'difficile' } },
];
const creatures = doc(F.creatures);
for (const { fiche, liste, avant, apres } of FICHES) {
  const c = creatures.find((x) => x.id === fiche);
  const i = c?.[liste]?.findIndex((t) => egal(t, avant)) ?? -1;
  if (i < 0) continue;
  c[liste][i] = apres;
  gestes++;
}

// 7. tables.json
const nurgle = doc(F.tables).find((t) => t.id === 'allure-demoniaque-nurgle');
const octroi = nurgle?.rows?.flatMap((r) => r.ops ?? []).find((o) => o.op === 'grantTrait' && o.trait?.id === 'souffle');
if (egal(octroi?.trait, { id: 'souffle', arg: 'Corrosion et Poison', value: 7 })) { octroi.trait.arg = 'corrosion-et-poison'; gestes++; }

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc: d, avant }] of docs) {
  const apres = serializeDataset(d);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 1463 trait 3b-2 : ${gestes} geste(s).`);
