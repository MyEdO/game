/**
 * Migration #1652 lot 11a — la réparation au port par Tests de Métier : le constructeur naval local de
 * `sea-navigation.json`, et le Constructeur de navires itinérant de `sea-events.json`.
 *
 *   cible                                         geste
 *   `sea-navigation` `reparation`                 `constructeurLocal` : Métier (Constructeur de navires) 50   MDG 13 l.643
 *   `constructeur-de-navires-itinerant` (escale)  `do` → op navire `constructeurDEscale`, Constructeur de
 *                                                 navires 68, 1d10 jours                                      MDG 15 l.255
 *
 * Valeurs MAISON, sur la consigne de l'utilisateur du 2026-11-07 (fiche
 * `user-doctrine-regle-laissee-ouverte-tranchee-au-plus-juste`) : le constructeur local, que le livre ne chiffre
 * pas, teste à 50 ; le constructeur itinérant répare à son meilleur Métier, Constructeur de navires 68 contre
 * Charpentier 72 − 10 (MDG 13 l.641), et sa durée se tire à l'escale.
 *
 * Entrées : src/data/sea-events.json, src/data/sea-navigation.json. Une rangée nommée absente, comme une
 * `reparation` absente, n'est pas une anomalie : la migration rejouée après sa suppression sort 0 sans écrire.
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

const CONSTRUCTEUR = { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'constructeurDEscale', competence: 68, duree: { dice: { n: 1, sides: 10 } } }] } };
const MAISON_DU_CONSTRUCTEUR = `Le constructeur répare à son meilleur Métier, Constructeur de navires 68 contre Charpentier 72 − 10 (MDG 13 l.641) ; les 1d10 jours de la réparation se tirent à l'escale, et l'installation d'une Amélioration reste immédiate (${CONSIGNE}).`;
const CONSTRUCTEUR_LOCAL = 50;
const MAISON_DE_LA_REPARATION = `Le constructeur naval local (MDG 13 l.643) n'a pas de profil : il teste son Métier (Constructeur de navires) à 50 (${CONSIGNE}).`;

const arrets = [];
let gestes = 0;

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const navBrut = readFileSync(NAV, 'utf8');
const nav = JSON.parse(navBrut);
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (navBrut !== serializeDataset(nav)) arrets.push('sea-navigation.json : forme non canonique');

if (!arrets.length) {
  const rangee = sea.portEvents?.entries?.find((x) => x.id === 'constructeur-de-navires-itinerant');
  if (rangee && rangee.consequence === undefined) {
    const copie = Object.entries(rangee);
    for (const k of Object.keys(rangee)) delete rangee[k];
    for (const [k, v] of copie) { rangee[k] = v; if (k === 'desc') rangee.consequence = structuredClone(CONSTRUCTEUR); }
    gestes++;
  } else if (rangee && !isDeepStrictEqual(rangee.consequence, CONSTRUCTEUR)) arrets.push('constructeur-de-navires-itinerant : consequence hors de la forme attendue');
  if (rangee && rangee.maison !== MAISON_DU_CONSTRUCTEUR) { rangee.maison = MAISON_DU_CONSTRUCTEUR; gestes++; }

  const reparation = nav.reparation;
  if (reparation && reparation.constructeurLocal === undefined) { reparation.constructeurLocal = CONSTRUCTEUR_LOCAL; reparation.maison = MAISON_DE_LA_REPARATION; gestes++; }
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
console.log(`migration 1652 (chantier) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${navOut !== navBrut ? ', sea-navigation.json réécrit' : ''}.`);
