/**
 * Migration #1652 lot 10 — les restes de bord et d'escale de `sea-events.json`, et la Voile du Poursuivant sans
 * profil de `sea-navigation.json`.
 *
 *   rangée (table)                       geste
 *   `culte-de-la-personnalite` (bord)    le second d10, le nombre d'initiés, est tiré et annoncé : `narrative`
 *                                        verbatim à `nombre` 1d10 après la table de l'allégeance   MDG 15 l.154-155
 *   `passager-clandestin` (escale)       échec du Test de Perception : la table du passager se joue sous une op
 *                                        `delayed` de 1d10 jours, ouverte par la découverte verbatim     MDG 15 l.258
 *   `offre-de-mission` (escale)          `choice` accepter le colis : op navire `commission` de 200 CO  MDG 15 l.261
 *   `nemesis` (bord), `la-tache-noire`,
 *   `controle-a-quai` (escale),
 *   `autres-voyageurs` (bord)            la raison de l'omission au champ `maison`
 *   `sea-navigation` `poursuite`         `voileSansProfil` : Voile 51 du Marin (MDG 14 l.321)          MDG 13 l.376
 *
 * Valeurs MAISON, sur la consigne de l'utilisateur du 2026-11-07 (fiche
 * `user-doctrine-regle-laissee-ouverte-tranchee-au-plus-juste`) : le port de la commission est tiré parmi les ports
 * de la carte hors l'escale ; le délai du passager court depuis l'escale ; un Poursuivant dont aucun profil ne porte
 * Voile prend celle du Marin.
 *
 * Entrées : src/data/sea-events.json, src/data/sea-navigation.json. Une rangée nommée absente, comme une
 * `poursuite` absente, n'est pas une anomalie : la migration rejouée après sa suppression sort 0 sans écrire.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : chaque rangée nommée présente porte sa forme cible. Une `consequence` hors de
 * la forme attendue ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur
 * l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const NAV = join(ROOT, 'src/data/sea-navigation.json');
const CONSIGNE = 'consigne utilisateur 2026-11-07';
const d10 = { dice: { n: 1, sides: 10 } };
const CO = 240;

const INITIES = { op: 'narrative', text: "combien d'initiés sensibles à ses paroles il a rassemblés", nombre: d10 };
const DECOUVERTE = { op: 'narrative', text: 'vous découvrez sa présence' };
const COMMISSION = { kind: 'choix', invite: 'Accepter le colis', oui: { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'commission', montant: { brass: 200 * CO } }] } } };
const VOILE_SANS_PROFIL = 51;
const MAISON_DE_LA_POURSUITE = "Un navire hostile dont ni le chef ni l'équipage n'ont de profil à Voile (MDG 15 l.150, l.171 n'en donnent pas) mène sa Poursuite avec la Voile 51 du profil Marin (MDG 14 l.321).";

const MAISON = {
  boardEvents: {
    nemesis: "La némésis est le personnage d'une campagne, et aucune campagne du jeu n'en authore : l'événement se raconte sans mécanique.",
    'autres-voyageurs': `MDG 15 l.205-208 laisse au MJ ce que le navire apporte : la rumeur reprend la Demande +2 pour 10+2d10 jours de l'escale (l.259), les dangers signalés écartent les périls pendant 1d10 jours, comme le Marsouin amical (l.229), car un péril se heurte PENDANT un événement de bord ; aucun étal ne s'ouvre en mer, le livre ne disant ni ce qui se vend ni à quel prix, et la menace n'est pas jouée (${CONSIGNE}).`,
  },
  portEvents: {
    'la-tache-noire': "Le capitaine ennemi est le personnage d'une campagne, et aucune campagne du jeu n'en authore : l'événement se raconte sans mécanique.",
    'controle-a-quai': `Toute la cargaison est déclarée, aucune règle ne disant comment la cacher (l.247) ; les droits de 10 % s'arrondissent à l'inférieur (${CONSIGNE}).`,
    'passager-clandestin': `Mousse → mousse, Nautonier → navigateur, Médecin de bord → chirurgien ; Marin, Mercenaire expérimenté et Officier accroissent l'effectif anonyme ; les 1d10 jours du passager non repéré courent depuis l'escale (${CONSIGNE}).`,
    'offre-de-mission': "Le port de livraison est tiré parmi les ports de la carte hors l'escale, et le colis n'a ni Encombrement ni autre mécanique.",
  },
};

const arrets = [];
let gestes = 0;

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const navBrut = readFileSync(NAV, 'utf8');
const nav = JSON.parse(navBrut);
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (navBrut !== serializeDataset(nav)) arrets.push('sea-navigation.json : forme non canonique');

const rangee = (table, id) => sea[table]?.entries?.find((x) => x.id === id);

if (!arrets.length) {
  const culte = rangee('boardEvents', 'culte-de-la-personnalite');
  const opsDuCulte = culte?.consequence?.effet?.ops;
  if (culte && (!Array.isArray(opsDuCulte) || opsDuCulte[0]?.op !== 'rollTable')) arrets.push('culte-de-la-personnalite : consequence hors de la forme `effet` → `rollTable`');
  else if (culte && !opsDuCulte.some((o) => isDeepStrictEqual(o, INITIES))) { opsDuCulte.push(structuredClone(INITIES)); gestes++; }

  const passager = rangee('portEvents', 'passager-clandestin');
  const echec = passager?.consequence?.echec?.effet?.ops;
  if (passager && (!Array.isArray(echec) || echec.length !== 1)) arrets.push('passager-clandestin : branche `echec` hors de la forme `effet` à une op');
  else if (passager && echec[0].op === 'rollTable') { echec[0] = { op: 'delayed', afterDays: d10, ops: [structuredClone(DECOUVERTE), echec[0]] }; gestes++; }
  else if (passager && echec[0].op !== 'delayed') arrets.push(`passager-clandestin : op « ${echec[0].op} » inattendue sur l'échec`);

  const offre = rangee('portEvents', 'offre-de-mission');
  if (offre && offre.consequence === undefined) {
    const copie = Object.entries(offre);
    for (const k of Object.keys(offre)) delete offre[k];
    for (const [k, v] of copie) { offre[k] = v; if (k === 'desc') offre.consequence = structuredClone(COMMISSION); }
    gestes++;
  } else if (offre && !isDeepStrictEqual(offre.consequence, COMMISSION)) arrets.push('offre-de-mission : consequence hors de la forme attendue');

  for (const [table, raisons] of Object.entries(MAISON)) {
    for (const [id, raison] of Object.entries(raisons)) {
      const e = rangee(table, id);
      if (e && e.maison !== raison) { e.maison = raison; gestes++; }
    }
  }

  const poursuite = nav.poursuite;
  if (poursuite && poursuite.voileSansProfil === undefined) { poursuite.voileSansProfil = VOILE_SANS_PROFIL; poursuite.maison = MAISON_DE_LA_POURSUITE; gestes++; }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
const navOut = serializeDataset(nav);
if (navOut !== navBrut) writeFileSync(NAV, navOut, 'utf8');
console.log(`migration 1652 (restes) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${navOut !== navBrut ? ', sea-navigation.json réécrit' : ''}.`);
