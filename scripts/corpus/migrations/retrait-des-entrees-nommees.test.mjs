/**
 * MORSURE — une migration DATÉE n'agit que sur la FORME D'AVANT de ce qu'elle nomme (#3080,
 * `scripts/migrations/lib/formeDAvant.mjs`) : une entrée qu'elle nomme, retirée du corpus depuis, passe
 * sans faute.
 *
 * Pour chaque migration datée, le banc relève les entrées qu'elle NOMME : les littéraux de son texte qui
 * sont l'`id` d'un élément de liste (à toute profondeur) d'un document qu'elle nomme par son nom de
 * fichier (`src/data/*.json`, `src/scenes/<c>/<c>-projet.json`). Il les retire TOUTES d'un dépôt
 * jetable portant la copie du corpus, puis y joue la migration. Exigé : sortie 0, et aucun document
 * réécrit (octet ET horodatage).
 */
import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { ANTIDATE, copieDuCorpus, efface, joue, pose, rienTouche } from '../../migrations/lib/joue.mjs'
import { DATEES, MIGRATIONS } from '../../test/lib/bancIdempotence.mjs'

/** Les documents dont une migration peut nommer les entrées, en chemins relatifs à la racine. */
function documents(racine) {
  const data = fs.readdirSync(path.join(racine, 'src/data')).filter((f) => f.endsWith('.json')).map((f) => `src/data/${f}`);
  const projets = fs
    .readdirSync(path.join(racine, 'src/scenes'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `src/scenes/${d.name}/${d.name}-projet.json`)
    .filter((rel) => fs.existsSync(path.join(racine, rel)));
  return [...data, ...projets];
}

/** Chaque liste du document, à toute profondeur. */
function listes(noeud, out = []) {
  if (Array.isArray(noeud)) {
    out.push(noeud);
    for (const v of noeud) listes(v, out);
  } else if (noeud !== null && typeof noeud === 'object') for (const v of Object.values(noeud)) listes(v, out);
  return out;
}

const idDe = (e) => (e !== null && typeof e === 'object' && typeof e.id === 'string' ? e.id : undefined);

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** Les littéraux de chaîne d'un texte de migration. */
const litteraux = (texte) =>
  new Set([...texte.matchAll(/'([^'\\\n]+)'|"([^"\\\n]+)"|`([^`\\$\n]+)`/g)].map((m) => m[1] ?? m[2] ?? m[3]));

test('une migration DATÉE sort 0 sans rien réécrire quand les entrées qu’elle nomme sont retirées', (t) => {
  const racine = copieDuCorpus();
  t.after(() => efface(racine));

  const DOCS = documents(racine);
  const base = new Map();
  for (const rel of DOCS) {
    base.set(rel, fs.readFileSync(path.join(racine, rel), 'utf8'));
    fs.utimesSync(path.join(racine, rel), ANTIDATE, ANTIDATE);
  }
  /** `id` → documents qui le portent sur un élément de liste. */
  const index = new Map();
  for (const rel of DOCS)
    for (const l of listes(JSON.parse(base.get(rel))))
      for (const id of l.map(idDe).filter(Boolean)) index.set(id, (index.get(id) ?? new Set()).add(rel));

  const fautes = [];
  let mordues = 0;
  for (const migration of DATEES) {
    const texte = fs.readFileSync(path.join(MIGRATIONS, migration), 'utf8');
    const nommes = DOCS.filter((rel) => texte.includes(path.basename(rel)));
    const ids = new Set([...litteraux(texte)].filter((s) => nommes.some((rel) => index.get(s)?.has(rel))));
    if (!ids.size) continue;
    mordues++;

    const avant = new Map(base);
    for (const rel of nommes) {
      const doc = JSON.parse(base.get(rel));
      let retraits = 0;
      for (const l of listes(doc))
        for (let i = l.length - 1; i >= 0; i--)
          if (ids.has(idDe(l[i]))) {
            l.splice(i, 1);
            retraits++;
          }
      if (!retraits) continue;
      const mute = reserialise(doc, base.get(rel));
      pose(racine, rel, mute);
      avant.set(rel, mute);
    }

    const r = joue(racine, migration);
    if (r.code !== 0) fautes.push(`${migration} : sortie ${r.code} — ${r.sortie.trim().split(/\r?\n/).slice(0, 3).join(' / ')}`);
    for (const f of rienTouche(racine, avant)) fautes.push(`${migration} : ${f}`);

    for (const [rel, texteAvant] of avant) {
      const cible = path.join(racine, rel);
      if (texteAvant === base.get(rel) && fs.statSync(cible).mtimeMs === ANTIDATE.getTime()) continue;
      pose(racine, rel, base.get(rel));
    }
  }

  assert.ok(mordues >= 40, `${mordues} migration(s) nomment une entrée du corpus — le relevé ne mesure plus rien`);
  assert.deepEqual(fautes, [], `${fautes.length} faute(s) sur ${mordues} migration(s) :\n  ${fautes.join('\n  ')}`);
});
