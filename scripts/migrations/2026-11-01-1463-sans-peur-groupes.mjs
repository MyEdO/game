/**
 * Migration #1463 (#3045, sous-lot α2 des étiquettes de Groupe) — Sans Peur (Ennemi) prend ses
 * spécialisations dans `groups.json` (`specsSource: groupesDAppartenance`) : une spécialisation au
 * pluriel qu'un Groupe existant porte au singulier devient l'id de ce Groupe (Q13 A).
 *
 * GESTE : pour chaque fait de `FAITS`, le Niveau de Carrière `id` dont `talents` porte EXACTEMENT
 * l'élément d'avant (`avant`) le voit remplacé par celui d'après (`apres`).
 *
 * ENTRÉES : lues — `src/data/groups.json` ; écrites — `src/data/careerLevels.json`.
 * FORME D'AVANT SEULE (`scripts/migrations/lib/formeDAvant.mjs`) : un Niveau absent, déjà à la forme
 * d'après ou révisé depuis la migration est laissé tel quel.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; un Groupe qu'un geste à
 * faire poserait, absent de `groups.json`.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ, constaté avant l'écriture (`serializeDataset`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';
import { remplacerLaFormeDAvant } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GROUPS = 'src/data/groups.json';
const CAREER_LEVELS = 'src/data/careerLevels.json';

const sansPeur = (spec) => ({ id: 'sans-peur', spec });

/** Niveau de Carrière (`id`) → élément de `talents` d'avant, puis d'après. */
const FAITS = [
  // LDB 08 l.547
  { id: 'milicien-3', avant: sansPeur('criminels'), apres: sansPeur('criminel') },
  // LDB 08 l.1616
  { id: 'cocher-4', avant: sansPeur('hommes-betes'), apres: sansPeur('homme-bete') },
  // Middenheim 09 l.275
  { id: 'frere-loup-4', avant: sansPeur('hommes-betes'), apres: sansPeur('homme-bete') },
  // ADE I 07 l.117
  { id: 'gardechamps-4', avant: sansPeur('morts-vivants'), apres: sansPeur('mort-vivant') },
  // LDB 08 l.3184
  { id: 'pilleur-de-tombes-4', avant: sansPeur('morts-vivants'), apres: sansPeur('mort-vivant') },
];

const fautes = [];
const charger = (rel) => {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  return { doc, avant: texte };
};
const groupes = charger(GROUPS).doc;
const niveaux = charger(CAREER_LEVELS);

let gestes = 0;
for (const { id, avant, apres } of FAITS) {
  const niveau = niveaux.doc.find((x) => x.id === id);
  if (!niveau?.talents?.some((t) => egal(t, avant))) continue;
  if (!groupes.some((g) => g.id === apres.spec)) fautes.push(`${GROUPS} : Groupe « ${apres.spec} » introuvable`);
  gestes += remplacerLaFormeDAvant(niveau.talents, avant, [apres]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
const apres = serializeDataset(niveaux.doc);
if (apres !== niveaux.avant) fs.writeFileSync(path.join(ROOT, CAREER_LEVELS), apres);
console.log(`migration 1463 Sans Peur α2 : ${gestes} geste(s).`);
