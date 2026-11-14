/**
 * Migration #1652 lot 11b — l'avitaillement du navire au port : les vivres et l'eau de la cale de
 * `sea-navigation.json`, et la Bonne pêche de `sea-events.json`.
 *
 *   cible                              geste
 *   `sea-navigation` `longsVoyages`    `rationDeCale` : la ration-jour de nourriture préservée, `tonneauDeCale` : le
 *                                      tonneau d'eau douce, achetés pour la cale                      MDG 14 l.248-252
 *   `bonne-peche` (escale)             `do` → op navire `rationsDEscale`, la ration-jour à 3 sous de cuivre
 *                                      jusqu'à l'appareillage                                         MDG 15 l.262
 *
 * Valeur MAISON, sur la consigne de l'utilisateur du 2026-11-07 (fiche
 * `user-doctrine-regle-laissee-ouverte-tranchee-au-plus-juste`) : les vivres de la cale ne sont pas typés, la cale
 * s'avitaille en nourriture préservée.
 *
 * Entrées : src/data/sea-events.json, src/data/sea-navigation.json. Des `vivresDeCale` posés (lot 13a,
 * `2026-11-12-1652-vivres-de-cale.mjs`) valent cale déjà avitaillée. Une rangée nommée absente, comme un
 * `longsVoyages` absent, n'est pas une anomalie : la migration rejouée après sa suppression sort 0 sans écrire.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : une `consequence` hors de la forme attendue ou un document non canonique sont un
 * ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
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

const BONNE_PECHE = { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'rationsDEscale', montant: { brass: 3 } }] } };
const VIVRES_DE_CALE = { rationDeCale: { id: 'ration-nourriture-preservee' }, tonneauDeCale: { id: 'tonneau-d-eau-douce' } };
const MAISON_DES_VIVRES = `Les vivres de la cale ne sont pas typés (biscuits de mer, MDG 14 l.166 ; soupe de chou fermenté, MDG 14 l.230) : la cale s'avitaille en ration de nourriture préservée pour un jour (MDG 14 l.251) (${CONSIGNE}).`;

const arrets = [];
let gestes = 0;

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const navBrut = readFileSync(NAV, 'utf8');
const nav = JSON.parse(navBrut);
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (navBrut !== serializeDataset(nav)) arrets.push('sea-navigation.json : forme non canonique');

if (!arrets.length) {
  const rangee = sea.portEvents?.entries?.find((x) => x.id === 'bonne-peche');
  if (rangee && rangee.consequence === undefined) {
    const copie = Object.entries(rangee);
    for (const k of Object.keys(rangee)) delete rangee[k];
    for (const [k, v] of copie) { rangee[k] = v; if (k === 'desc') rangee.consequence = structuredClone(BONNE_PECHE); }
    gestes++;
  } else if (rangee && !isDeepStrictEqual(rangee.consequence, BONNE_PECHE)) arrets.push('bonne-peche : consequence hors de la forme attendue');

  const longs = nav.longsVoyages;
  if (longs && longs.rationDeCale === undefined && longs.vivresDeCale === undefined) {
    Object.assign(longs, structuredClone(VIVRES_DE_CALE), { maison: MAISON_DES_VIVRES });
    gestes++;
  }
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
console.log(`migration 1652 (avitaillement) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${navOut !== navBrut ? ', sea-navigation.json réécrit' : ''}.`);
