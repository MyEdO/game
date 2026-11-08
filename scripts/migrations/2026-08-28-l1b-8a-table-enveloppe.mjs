/**
 * Migration #1467 L1b V-FLIP-TABLE — les 13 documents UNIQUES que le lot passe en famille `config`
 * reçoivent leur ENVELOPPE d'identité : `id`, `type`, `label`.
 *
 * MOTIF : ces 13 racines sont des OBJETS uniques — l'instrument de mesure les classe `config`
 * (`docs/structures-donnees.md`), la famille `table` du dépôt étant « liste dont la moitié des
 * entrées portent une plage ». La forme suit la mesure, jamais l'étiquette. Six d'entre eux
 * portaient déjà `id`+`label` : seul `type` leur est INSÉRÉ (sept au total, cf. `IDENTITES`).
 *
 * CONVENTION DE POSITION (identique à `2026-08-28-l1b-7a-config-enveloppe.mjs`) : `id`, `type`,
 * `label` en tête dans CET ordre, puis TOUTES les clés existantes dans leur ordre existant.
 *
 * ENTRÉES : les 13 `src/data/*.json` nommés dans `IDENTITES` (les seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un document portant déjà les trois clés AUX BONNES
 * VALEURS est reconnu migré ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : clé présente avec une valeur DIVERGENTE (arbitrage requis) → rien n'est écrit, exit 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * `fichier → { id, type, label }` — le `type` est le nom de base du dataset, l'`id` est AUTHORÉ.
 * L'id de `vents-tourbillonnants.json` est `force-des-vents` : `vents-tourbillonnants` est DÉJÀ pris
 * par l'entrée homonyme de `reglesOptionnelles.json` (collision mesurée sur les 4005 ids de premier
 * niveau des deux racines).
 */
const IDENTITES = {
  // — id ET label EXISTANTS (authorés), gardés tels quels : seul `type` est inséré.
  'artillery-misfire.json': { id: 'artillery-misfire', type: 'artillery-misfire', label: "Incidents de Tir d'Artillerie par Salve" },
  'incidents-monture.json': { id: 'incidents-monte', type: 'incidents-monture', label: 'Incidents de monte' },
  'problemes-vehicule.json': { id: 'problemes-vehicule', type: 'problemes-vehicule', label: 'Problèmes de véhicule' },
  'rencontres-edoc.json': { id: 'rencontres-edoc', type: 'rencontres-edoc', label: 'Rencontres de voyage' },
  'river-criticals.json': { id: 'river-criticals', type: 'river-criticals', label: 'Coups Critiques sur un bateau fluvial' },
  'ship-criticals.json': { id: 'ship-criticals', type: 'ship-criticals', label: 'Blessures critiques sur un navire' },
  'structure-criticals.json': { id: 'structure-criticals', type: 'structure-criticals', label: 'Blessures critiques sur une Structure' },
  // — identités NEUVES.
  'driving-mishap.json': { id: 'accidents-conduite-attelage', type: 'driving-mishap', label: "Accidents de Conduite d'attelage" },
  'drunkenness.json': { id: 'ivresse', type: 'drunkenness', label: 'Ivresse' },
  'naval-progression.json': { id: 'progression-de-navire', type: 'naval-progression', label: 'Progression de navire' },
  'obsessions.json': { id: 'obsessions', type: 'obsessions', label: 'Obsessions' },
  'surincantation.json': { id: 'surincantation', type: 'surincantation', label: 'Tableau de Surincantation' },
  'vents-tourbillonnants.json': { id: 'force-des-vents', type: 'vents-tourbillonnants', label: 'Vents Tourbillonnants' },
};

const echecs = [];
const rapport = [];

for (const [fichier, identite] of Object.entries(IDENTITES)) {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);

  if (JSON.stringify(data, null, 2) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    continue;
  }
  if (!estObjet(data)) {
    echecs.push(`${fichier} : racine de forme inattendue (objet unique attendu)`);
    continue;
  }

  const divergents = ['id', 'type', 'label'].filter((k) => data[k] !== undefined && data[k] !== identite[k]);
  if (divergents.length) {
    echecs.push(
      `${fichier} : ${divergents.map((k) => `\`${k}\` = ${JSON.stringify(data[k])} ≠ ${JSON.stringify(identite[k])}`).join(', ')} — arbitrage requis`,
    );
    continue;
  }

  const deja = ['id', 'type', 'label'].filter((k) => data[k] !== undefined);
  const reste = Object.fromEntries(Object.entries(data).filter(([k]) => !['id', 'type', 'label'].includes(k)));
  const sortie = { ...identite, ...reste };
  const out = JSON.stringify(sortie, null, 2);
  if (out !== brut) fs.writeFileSync(cible, out, 'utf8');
  rapport.push(`  ${out === brut ? 'no-op' : 'migré'} ${fichier} — id=${identite.id} type=${identite.type} (déjà présentes : ${deja.length ? deja.join(',') : 'aucune'})`);

  // PREUVE post-écriture : les 3 clés en tête, dans l'ordre, et AUCUNE autre clé altérée.
  const apres = JSON.parse(out);
  const clesApres = Object.keys(apres);
  const clesAvant = Object.keys(data).filter((k) => !['id', 'type', 'label'].includes(k));
  if (clesApres.slice(0, 3).join(',') !== 'id,type,label') echecs.push(`${fichier} : POST — tête ${clesApres.slice(0, 3).join(',')} ≠ id,type,label`);
  if (clesApres.slice(3).join(',') !== clesAvant.join(',')) echecs.push(`${fichier} : POST — la queue de clés a bougé`);
  for (const k of clesAvant) {
    if (JSON.stringify(apres[k]) !== JSON.stringify(data[k])) echecs.push(`${fichier} : POST — la valeur de \`${k}\` a été ALTÉRÉE`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`table → config, enveloppe d'identité : ${Object.keys(IDENTITES).length} document(s)`);
for (const l of rapport) console.log(l);
const ids = Object.values(IDENTITES).map((i) => i.id);
if (new Set(ids).size !== ids.length) {
  console.error('ids en COLLISION entre les documents migrés');
  process.exit(1);
}
console.log(`ids distincts : ${new Set(ids).size}/${ids.length}`);
