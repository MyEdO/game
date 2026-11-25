/**
 * #1615 — les pièces des postes de scène désignent le catalogue des engins par `engin: { id }`. MDG 12 l.369-379.
 *
 * Entrées : projets/jeu-de-role/campagnes/barge-du-sel/barge-du-sel-projet.json et
 * projets/jeu-de-role/campagnes/loup-et-saumure/loup-et-saumure-projet.json (lus et écrits).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const projets = ['barge-du-sel', 'loup-et-saumure'];
const ecritures = [];

for (const nom of projets) {
  const chemin = new URL(`../../projets/jeu-de-role/campagnes/${nom}/${nom}-projet.json`, import.meta.url);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  let gestes = 0;
  for (const scene of doc.scenes) {
    for (const entite of scene.entities ?? []) {
      if (!entite.postes) continue;
      entite.postes = entite.postes.map((poste) => {
        if (!Object.hasOwn(poste, 'trappingId')) return poste;
        if (typeof poste.trappingId !== 'string' || !poste.trappingId || Object.hasOwn(poste, 'engin')) {
          throw new Error(`${nom} / ${scene.id} / ${entite.id} : référence historique d’engin invalide.`);
        }
        gestes++;
        return Object.fromEntries(Object.entries(poste).map(([cle, valeur]) => cle === 'trappingId'
          ? ['engin', { id: valeur }]
          : [cle, valeur]));
      });
    }
  }
  if (gestes) ecritures.push({ chemin, contenu: `${JSON.stringify(doc, null, 1)}\n`, gestes, nom });
}

for (const { chemin, contenu, gestes, nom } of ecritures) {
  writeFileSync(chemin, contenu, 'utf8');
  console.log(`${nom} · ${gestes} poste(s)`);
}
