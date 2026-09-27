/** Golden master décor : dump le SVG résolu de chaque prop → JSON, pour prouver l'iso-rendu
 *  avant/après la migration vers le registre defs/. Usage : npx tsx scripts/_decor-golden.mts <out.json> */
import { tableTotale } from '../src/lib/tableTotale';
import { writeFileSync } from 'node:fs';
import { PROPS, propSvg } from '../src/gameIso/catalog/decor';

const out = process.argv[2];
const map = tableTotale(Object.keys(PROPS).sort(), (id) => propSvg(id));
writeFileSync(out, JSON.stringify(map, null, 0));
console.log('golden:', Object.keys(map).length, 'props →', out);
