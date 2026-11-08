/**
 * #3684 — l'arme d'auteur d'un personnage de scène (`weapon`, un id de trapping) devient le seul objet de son
 * inventaire d'auteur (`inventaire`, `inventaireDAuteurSchema`) : `"weapon": "x"` devient `"inventaire": { "x": false }`,
 * à la place de la clé. Une arme se tient par les sets d'armes : l'objet n'est pas porté.
 *
 * GESTE, sur la forme d'avant seule (#3080) : une entité qui porte `weapon` (chaîne) et aucun `inventaire`.
 * Entrées : `src/scenes/arene/arene-projet.json` et `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` (lues et
 * réécrites). Rejouée sur l'état final, rien ne s'écrit.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const cibles = ['src/scenes/arene/arene-projet.json', 'src/scenes/loup-et-saumure/loup-et-saumure-projet.json'];

/** `entite` où la clé `weapon` cède sa place, à son rang, à `inventaire`. */
const migree = (entite) =>
  Object.fromEntries(Object.entries(entite).map(([cle, v]) => (cle === 'weapon' ? ['inventaire', { [v]: false }] : [cle, v])));

for (const rel of cibles) {
  const chemin = fileURLToPath(new URL(`../../${rel}`, import.meta.url));
  const avant = fs.readFileSync(chemin, 'utf8');
  const document = JSON.parse(avant);
  let gestes = 0;
  for (const scene of document.scenes ?? []) {
    scene.entities = (scene.entities ?? []).map((e) => {
      if (typeof e?.weapon !== 'string' || Object.hasOwn(e, 'inventaire')) return e;
      gestes++;
      return migree(e);
    });
  }
  if (gestes === 0) { console.log(`${rel} : 0 arme d'auteur, INCHANGÉ`); continue; }
  const apres = JSON.stringify(document, null, 1) + '\n';
  fs.writeFileSync(chemin, apres);
  console.log(`${rel} : ${gestes} arme(s) d'auteur en inventaire, réécrit`);
}
