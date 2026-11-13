/**
 * Migration #3908 L1 — la portée des seconds jets (AA 02 l.109 ; VDM 03 l.17) devient un fait de la COLONNE : une
 * colonne de `carrieres-aleatoires.json` que nomme la portée `colonnes` d'une variante reçoit `tableauDuLdb: true`,
 * et chaque variante perd `colonnes`. Une colonne hors du Livre de base (`source.book` ≠ `livre-de-base`) qui le
 * reçoit porte le tag `maison` (AA 02 l.111 ; Middenheim 09 l.51 ; #3908).
 *
 * Entrées : src/data/carrieres-aleatoires.json (lue et écrite).
 *
 * FORME D'AVANT SEULE : un fichier dont aucune variante ne porte `colonnes` est laissé tel quel (rejeu sur l'arbre
 * migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique, une portée qui
 * nomme une autre sorte qu'une colonne, une variante dont la portée omet une colonne portée ailleurs qui tire sa
 * carrière détaillée (la portée par colonne changerait alors l'offre), une colonne qui porte déjà `tableauDuLdb` ou
 * `maison`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TABLE = join(ROOT, 'src/data/carrieres-aleatoires.json');
const MAISON =
  'Seconds jets d’AA 02 l.109 et de VDM 03 l.17 étendus à cette colonne : les Carrières y sont « toutes communes à l’Empire » (AA 02 l.111) et « les Middenlanders ont le même type d’occupation que les Reiklanders » (Middenheim 09 l.51) ; proposé au ticket #3908 (https://github.com/MyEdO/game/issues/3908#issuecomment-6841841671)';

const arrets = [];
const brut = readFileSync(TABLE, 'utf8');
const documents = JSON.parse(brut);
if (brut !== serializeDataset(documents)) arrets.push('carrieres-aleatoires.json : forme non canonique');
const variantes = documents.filter((d) => d.kind === 'variante' && Object.hasOwn(d, 'colonnes'));
const portee = new Set(variantes.flatMap((v) => v.colonnes));
const colonne = (id) => documents.find((d) => d.id === id && d.kind === 'colonne');
const tire = (col, carriere) => {
  const portion = documents.find((p) => p.kind === 'portion' && p.colonne === col.id);
  return [...col.entries, ...(portion?.entries ?? [])].some((r) => r.id === carriere);
};
for (const id of portee) {
  const c = colonne(id);
  if (!c) arrets.push(`carrieres-aleatoires.json : la portée nomme « ${id} », qui n'est aucune colonne`);
  else if (Object.hasOwn(c, 'tableauDuLdb') || Object.hasOwn(c, 'maison')) arrets.push(`carrieres-aleatoires.json › ${id} : porte déjà \`tableauDuLdb\` ou \`maison\``);
  else for (const v of variantes)
    if (!v.colonnes.includes(id) && tire(c, v.carriere)) arrets.push(`carrieres-aleatoires.json › ${v.id} : la colonne « ${id} » tire « ${v.carriere} » hors de sa portée`);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!variantes.length) {
  console.log('migration 3908 L1 : aucune variante ne porte `colonnes`, rien à faire.');
} else {
  const migres = documents.map((d) => {
    if (d.kind === 'variante') return (({ colonnes: _portee, ...reste }) => reste)(d);
    if (d.kind !== 'colonne' || !portee.has(d.id)) return d;
    const { entries, ...tete } = d;
    return { ...tete, tableauDuLdb: true, ...(d.source.book === 'livre-de-base' ? {} : { maison: MAISON }), entries };
  });
  writeFileSync(TABLE, serializeDataset(migres), 'utf8');
  console.log(`migration 3908 L1 : \`tableauDuLdb\` posé sur ${portee.size} colonne(s) (${[...portee].join(', ')}), \`colonnes\` retiré de ${variantes.length} variante(s).`);
}
