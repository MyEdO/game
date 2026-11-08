/**
 * Migration #2968 (#1463) L03 — la Carrière, la Classe de Carrière et l'espèce jouable désignées par
 * `ref(type)` (`src/data/schemas/grammaire/ref.ts`), jamais par un id nu : `"x"` devient `{ "id": "x" }`.
 *
 * GESTE, par porteur, à la CLÉ du CHEMIN EXACT (jamais par mot) :
 *  - `careerLevels.json › [].career` : `ref('career')` ;
 *  - `careers.json › [].class` : `ref('classe')` ;
 *  - `pregens.json › [].career` : `ref('career')` ;
 *  - `pregens.json › [].species` : `ref('species')`.
 * La clé garde son rang, les autres clés le leur.
 *
 * ENTRÉES : écrites — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/pregens.json` ;
 * lues — `src/data/classes.json`, `src/data/species.json` (catalogues des cibles, avec `careers.json`).
 * CARDINAL ASSERTÉ : `CARDINAL` gestes au premier passage, `PAR_PORTEUR` par porteur.
 * IDEMPOTENT : un porteur déjà `{ id }` n'a aucun geste ; rejouée sur l'état final, rien ne s'écrit et la
 * sortie est 0.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, valeur ni chaîne ni `{ id }`
 * seul, id absent de son catalogue, compte de gestes ≠ `CARDINAL` ou ≠ `PAR_PORTEUR`.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Gestes du premier passage par porteur, mesurés le 2026-11-08 sur `3347ab97d6`. */
const PAR_PORTEUR = {
  'careerLevels.json › career': 432,
  'careers.json › class': 108,
  'pregens.json › career': 8,
  'pregens.json › species': 8,
};
const CARDINAL = 556;

const lire = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const idsDe = (rel) => new Set(lire(rel).map((e) => e.id));
const CATALOGUES = {
  career: idsDe('src/data/careers.json'),
  classe: idsDe('src/data/classes.json'),
  species: idsDe('src/data/species.json'),
};

/** Fichier → clés porteuses de ses entrées de premier niveau, avec le type de leur cible. */
const PORTEURS = {
  'src/data/careerLevels.json': { career: 'career' },
  'src/data/careers.json': { class: 'classe' },
  'src/data/pregens.json': { career: 'career', species: 'species' },
};

const fautes = [];
const aEcrire = [];
/** Porteur → gestes faits ; un porteur sans geste est absent. */
const gestesPar = {};

for (const [rel, cles] of Object.entries(PORTEURS)) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) {
    fautes.push(`${rel} : formatage non canonique`);
    continue;
  }
  let ici = 0;
  const sortie = doc.map((entree) => {
    const suite = { ...entree };
    for (const [cle, type] of Object.entries(cles)) {
      const ou = `${rel} › ${entree.id} › ${cle}`;
      const v = entree[cle];
      if (estObjet(v) && Object.keys(v).length === 1 && typeof v.id === 'string') continue;
      if (typeof v !== 'string') {
        fautes.push(`${ou} : ni chaîne ni \`{ id }\` (${JSON.stringify(v)})`);
        continue;
      }
      if (!CATALOGUES[type].has(v)) {
        fautes.push(`${ou} : « ${v} » absent du catalogue \`${type}\``);
        continue;
      }
      suite[cle] = { id: v };
      const porteur = `${path.basename(rel)} › ${cle}`;
      gestesPar[porteur] = (gestesPar[porteur] ?? 0) + 1;
      ici += 1;
    }
    return suite;
  });
  if (ici) aEcrire.push([chemin, serializeDataset(sortie)]);
}

const gestes = Object.values(gestesPar).reduce((a, n) => a + n, 0);
if (gestes) {
  if (gestes !== CARDINAL) fautes.push(`${gestes} geste(s), ${CARDINAL} attendus — périmètre déplacé`);
  for (const [porteur, attendu] of Object.entries(PAR_PORTEUR)) {
    const faits = gestesPar[porteur] ?? 0;
    if (faits !== attendu) fautes.push(`${porteur} : ${faits} geste(s), ${attendu} attendus`);
  }
}
if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(aEcrire.length === 0
  ? `RIEN À FAIRE — les ${CARDINAL} porteurs désignent déjà leur cible par \`{ id }\`.`
  : `migration 2968 L03 : ${gestes} porteur(s) migré(s) dans ${aEcrire.length} fichier(s) ${JSON.stringify(gestesPar)}.`);
