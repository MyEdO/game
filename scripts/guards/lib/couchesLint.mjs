// MURS DE COUCHE (#2882, #1709 ; AGENTS.md règle 3), jugés sur la table `COUCHES` (`couches.mjs`).
//  - `murs/zone` : un fichier de `src/` vit dans une zone de la table ; créer `src/foo/` demande sa ligne.
//  - `murs/purete-imports` : un arc d'import (`arcsDImport.mjs`, toutes ses formes, motifs
//    d'`import.meta.glob` compris) d'une zone vers une autre n'existe que si la table l'ouvre ; un arc
//    de type seul passe là où la table n'ouvre que le type ; vers une zone dont la ligne déclare une porte
//    (`portes`), l'arc ne vise que ce module, en valeur comme en type (`porteManquee`).
// La zone d'une cible se lit sur son chemin NORMALISÉ sans disque (`cibleLexicale`, alias du dépôt et
// chemin `/…` compris) : le premier segment sous `src/` s'il nomme une zone, `racine` pour un fichier
// posé à même `src/`. Un paquet n'est pas jugé, ni un motif de glob `!…` ou dont la zone est un joker.

import { posix as cheminPosix, relative } from 'node:path';
import { cibleLexicale, posix } from './interneLint.mjs';
import { visiteurDArcs } from './arcsDImport.mjs';
import { estZone, fermeture, ouvertes, porteManquee } from './couches.mjs';

/** La zone d'un chemin RELATIF à la racine du dépôt, `null` hors de `src/`. Un segment qui n'est pas une
 *  zone de la table rend son nom brut, pour que `murs/zone` le nomme. */
export function zoneDe(rel) {
  const segments = cheminPosix.normalize(posix(rel)).split('/');
  if (segments[0] !== 'src' || segments.length < 2) return null;
  if (segments.length === 2) return estZone(segments[1]) ? segments[1] : 'racine';
  return segments[1];
}

const TABLE = 'la table `COUCHES` (`scripts/guards/lib/couches.mjs`)';

/** Le nom d'une zone dans un message : `racine` n'est pas un dossier. */
const nommer = (z) => (z === 'racine' ? 'un fichier posé à même `src/`' : `src/${z}`);

const zone = {
  meta: { type: 'problem' },
  create(context) {
    const z = zoneDe(relative(context.cwd, context.filename));
    return {
      Program: (node) => {
        if (z === null || estZone(z)) return;
        context.report({ node, message: `Zone (#2882) : \`src/${z}/\` n’est pas une zone de ${TABLE} — rejoindre une zone existante, ou écrire la ligne de la nouvelle zone et ses sens d’import.` });
      },
    };
  },
};

const purete = {
  meta: { type: 'problem' },
  create(context) {
    const racine = context.cwd;
    const importeur = posix(context.filename);
    const de = zoneDe(relative(racine, importeur));
    if (!estZone(de)) return {};
    const { libres, enType } = ouvertes(de);
    const ouvert = `${nommer(de)} importe ${libres.length ? libres.join(', ') : 'aucune zone'}${enType.length ? ` ; en type seul : ${enType.join(', ')}` : ''}`;
    const juger = (node, spec, typeSeul) => {
      const cible = cibleLexicale(importeur, spec, racine);
      if (cible === null) return;
      const cibleRel = posix(relative(racine, cible));
      const vers = zoneDe(cibleRel);
      if (!estZone(vers)) return;
      const ferme = fermeture(de, vers, typeSeul);
      const porte = ferme === null ? porteManquee(de, vers, cibleRel) : null;
      if (porte !== null) {
        context.report({ node, message: `Porte de couche (#2882, #2898) : ${nommer(de)} ne lit de ${nommer(vers)} que sa porte \`${porte}\`, en valeur comme en type — ${TABLE} la déclare (\`portes\`) : importer le nom de la porte, ou l’y exporter.` });
        return;
      }
      if (ferme === null) return;
      const portee = ferme === 'type' ? 'ni à l’EXÉCUTION ni pour un TYPE' : 'à l’EXÉCUTION';
      const remede = ferme === 'type' ? 'déplacer la forme partagée dans une zone ouverte' : 'déplacer la forme partagée dans une zone ouverte, ou n’importer que le TYPE (`import type`)';
      context.report({ node, message: `Pureté de couche (#1709, #2882, AGENTS.md règle 3) : ${nommer(de)} n’importe rien de ${nommer(vers)} ${portee} — ${TABLE} ne l’ouvre pas (${ouvert}) : ${remede}.` });
    };
    return visiteurDArcs({
      // La requête d'un spécificateur (`?raw`) ne fait pas partie du chemin ; dans un motif, `?` est un joker.
      surArc: (node, spec, { typeSeul }) => juger(node, spec.replace(/\?.*$/s, ''), typeSeul),
      surMotif: (node, motif) => {
        if (motif !== null && !motif.startsWith('!')) juger(node, motif, false);
      },
    });
  },
};

export default { zone, purete };
