/**
 * Migration #1463 (#3045, sous-lot A0-a des étiquettes de Groupe) — une créature du catalogue porte en
 * `grantGroups` les Groupes que son entrée de livre lui donne : sa propre espèce quand un Trait psy la vise
 * par son nom ; un démon, sa catégorie puis le dieu du Chaos qu'il sert.
 *
 * GESTE : pour chaque fait de `FAITS`, une créature dont `grantGroups` est EXACTEMENT sa forme d'avant
 * (`avant`, absente pour les deux scribes) le reçoit à sa forme d'après (`apres`).
 *
 * ENTRÉES : lues — `src/data/groups.json` ; écrites — `src/data/creatures.json`.
 * FORME D'AVANT SEULE : la reconnaissance compare par égalité profonde ; une créature déjà à la forme
 * d'après, révisée après la migration, ou absente du catalogue, est laissée telle quelle.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un Groupe qu'un geste à
 * faire poserait, absent de `groups.json`.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)`
 * (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GROUPS = 'src/data/groups.json';
const CREATURES = 'src/data/creatures.json';

/** Créature (`id`) → `grantGroups` d'avant, puis d'après. */
const FAITS = [
  // LDB 78 l.96
  { id: 'serpent', avant: ['bete'], apres: ['bete', 'serpent'] },
  // LDB 79 l.183
  { id: 'pieuvre-des-tourbieres', avant: ['bete', 'monstres'], apres: ['bete', 'monstres', 'pieuvre-des-tourbieres'] },
  // LDB 84 l.20-22
  { id: 'sanguinaire-de-khorne', avant: ['demon'], apres: ['demon', 'khorne'] },
  // LDB 84 l.30
  { id: 'demonette-de-slaanesh', avant: ['demon'], apres: ['demon', 'slaanesh'] },
  // LDB 84 l.45
  { id: 'slenderthigh-whiptongue', avant: ['demon'], apres: ['demon', 'slaanesh'] },
  // LDB 84 l.53
  { id: 'fr-hough-mournbreath', avant: ['demon'], apres: ['demon', 'nurgle'] },
  // EDOC 13 l.609, l.619
  { id: 'horreur-rose', avant: ['demon'], apres: ['demon', 'tzeentch'] },
  // EDOC 13 l.609, l.629
  { id: 'horreur-bleue', avant: ['demon'], apres: ['demon', 'tzeentch'] },
  // VDM 15 l.125, l.131, l.148
  { id: 'p-tarix-celui-qui-ecrit', avant: undefined, apres: ['demon', 'tzeentch'] },
  // VDM 15 l.125, l.131, l.159
  { id: 'xirat-p-celui-qui-lit', avant: undefined, apres: ['demon', 'tzeentch'] },
];

const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fautes = [];
const charger = (rel) => {
  const texte = lire(rel);
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  return { doc, avant: texte };
};
const groupes = charger(GROUPS).doc;
const creatures = charger(CREATURES);

let gestes = 0;
for (const { id, avant, apres } of FAITS) {
  const c = creatures.doc.find((x) => x.id === id);
  if (!c || !egal(c.grantGroups, avant)) continue;
  for (const groupe of apres) if (!groupes.some((g) => g.id === groupe)) fautes.push(`${GROUPS} : Groupe « ${groupe} » introuvable`);
  c.grantGroups = [...apres];
  gestes++;
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
const apres = serializeDataset(creatures.doc);
if (apres !== creatures.avant) fs.writeFileSync(path.join(ROOT, CREATURES), apres);
console.log(`migration 1463 étiquettes A0-a : ${gestes} geste(s).`);
