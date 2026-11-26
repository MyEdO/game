/**
 * Migration #1468 — les conditions `has` emboîtent leur référence et sa spécialisation éventuelle.
 *
 * Entrées : `src/data/domains.json`, `spells.json`, `talents.json`, `traits.json`, `trappings.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const jeux = ['domains', 'spells', 'talents', 'traits', 'trappings'];
const changements = [];
const erreurs = [];

for (const jeu of jeux) {
  const fichier = new URL(`../../src/data/${jeu}.json`, import.meta.url);
  const brut = readFileSync(fichier, 'utf8');
  const document = JSON.parse(brut);
  let nombre = 0;
  const visiter = (valeur, chemin) => {
    if (Array.isArray(valeur)) return valeur.map((enfant, i) => visiter(enfant, `${chemin}[${i}]`));
    if (!estObjet(valeur)) return valeur;

    if (valeur.kind === 'has' && (Object.hasOwn(valeur, 'value') || Object.hasOwn(valeur, 'spec'))) {
      const { value, spec } = valeur;
      if (Object.hasOwn(valeur, 'ref') || typeof value !== 'string' || !value ||
          (spec !== undefined && (valeur.what !== 'talent' || typeof spec !== 'string'))) {
        erreurs.push(`${jeu}.json ${chemin} : condition has mal formée ou référence déjà posée`);
        return valeur;
      }
      nombre++;
      const ref = spec === undefined ? { id: value } : { id: value, spec };
      return Object.fromEntries(Object.entries(valeur)
        .filter(([cle]) => cle !== 'spec')
        .map(([cle, enfant]) => cle === 'value' ? ['ref', ref] : [cle, visiter(enfant, `${chemin}.${cle}`)]));
    }

    return Object.fromEntries(Object.entries(valeur).map(([cle, enfant]) => [cle, visiter(enfant, `${chemin}.${cle}`)]));
  };
  const sortie = visiter(document, '$');
  if (!nombre) continue;
  if (brut !== serializeDataset(document)) erreurs.push(`${jeu}.json : forme non canonique`);
  changements.push({ fichier, nombre, sortie });
}

if (erreurs.length) {
  console.error([`ARRÊT — ${erreurs.length} anomalie(s), AUCUNE écriture :`, ...erreurs].join('\n'));
  process.exit(1);
}

for (const { fichier, sortie } of changements) writeFileSync(fichier, serializeDataset(sortie));
const nombre = changements.reduce((total, jeu) => total + jeu.nombre, 0);
console.log(`migration 1468 (conditions has) : ${nombre} référence(s), ${changements.length} fichier(s).`);
