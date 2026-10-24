// MURS DE COUCHE (#2882, #1709 ; AGENTS.md règle 3), jugés sur la table `COUCHES` (`couches.mjs`).
//  - `murs/zone` : un fichier de `src/` vit dans une zone de la table ; créer `src/foo/` demande sa ligne.
//  - `murs/purete-imports` : un arc d'import (`arcsDImport.mjs`, toutes ses formes, motifs
//    d'`import.meta.glob` compris) d'une zone vers une autre n'existe que si la table l'ouvre ; un arc
//    de type seul passe là où la table n'ouvre que le type ; vers une zone dont la ligne déclare une porte
//    (`portes`), l'arc ne vise que ce module, en valeur comme en type (`porteManquee`). Une zone qui survit à
//    la bascule (`survit`) ne charge aucun paquet de l'hôte web (`paquetFerme`), même pour un type, hors des paquets que sa
//    ligne ouvre à un dossier d'outillage (`paquetsDOutillage`). Hors de
//    `racine`, un motif de glob dont le dossier de zone est un joker est refusé (`dossierJoker`). Une zone qui survit
//    n'écrit aucun JSX et ne lit aucun module de CODE hors des zones (`scripts/`, `server/`… ; `estCode` : une donnée
//    n'importe rien), sauf, pour un script d'outillage de la zone, les modules que sa ligne déclare (`outillage`,
//    `horsZoneOuvert`).
//  - `murs/reexportation` (#2817 D2) : le fichier ne réexporte rien — ni `export … from` sous aucune forme
//    d'arc, ni `export { … }` d'une liaison importée ; la config le borne.
//  - `murs/suite-jouee` (#2928) : une suite (`estSuiteVitest`) est jouée par la suite principale ou par celle du
//    noyau (`racinesDeLaSuite.mjs`) ;
//  - `murs/quarantaine` : le fichier n'a aucun arc, sous aucune forme et en type compris, ni aucun motif
//    d'`import.meta.glob`, dont la cible lexicale répond à un glob de `cibles` (`correspondGlob`, options :
//    `{ cibles, message }`) ;
//    la config nomme les fichiers en quarantaine.
// La zone d'une cible se lit sur son chemin NORMALISÉ sans disque (`cibleLexicale`, alias du dépôt et
// chemin `/…` compris), par `zoneDe` (`couches.mjs`). Un motif `!…` n'est pas jugé. Hors de portée : un
// réexport EN VALEUR (`export const x = importe`) et un `export default` d'une liaison importée.

import { extname, relative } from 'node:path';
import picomatch from 'picomatch';
import { cibleLexicale, posix } from './interneLint.mjs';
import { nomDe, visiteurDArcs } from './arcsDImport.mjs';
import { COUCHES, SURFACE_DU_NOYAU, ZONES_SANS_REEXPORTATION, dossierDe, estZone, fermeture, horsZoneOuvert, ouvertes, paquetFerme, porteManquee, zoneDe } from './couches.mjs';
import { EXTENSIONS_DE_SCRIPT } from './dialecte.mjs';
import { estSuiteVitest } from './fichierVitest.mjs';
import { correspondGlob } from './lister.mjs';
import { estDeLaSuiteDuNoyau, estDeLaSuiteVitest } from './racinesDeLaSuite.mjs';

const TABLE = 'la table `COUCHES` (`scripts/guards/lib/couches.mjs`)';

/** Le nom d'une zone dans un message : `racine` n'est pas un dossier. */
const nommer = (z) => (z === 'racine' ? 'un fichier posé à même `src/`' : dossierDe(z));

/** Les dossiers des zones à dossier propre. */
const DOSSIERS = Object.keys(COUCHES).filter((z) => z !== 'racine').map(dossierDe);

/** Le motif `cibleRel` (relatif à la racine) traverse-t-il un dossier de zone par un joker ? Sa partie
 *  littérale (`picomatch.scan`) s'arrête au-dessus d'un dossier de zone, et son joker descend d'un dossier. */
function dossierJoker(cibleRel) {
  const { base, isGlob } = picomatch.scan(cibleRel);
  const joker = cibleRel.slice(base.length);
  if (!isGlob || !(joker.slice(1).includes('/') || joker.includes('**'))) return false;
  return base === '' || DOSSIERS.some((d) => d.startsWith(`${base}/`));
}

/** La cible `cibleRel` est-elle du CODE : sans extension (un module résolu), ou d'une extension de script
 *  (`EXTENSIONS_DE_SCRIPT`) ? Une donnée (`.json`…) n'importe rien et ne fait pont vers aucune zone. */
const estCode = (cibleRel) => { const ext = extname(cibleRel); return ext === '' || [...EXTENSIONS_DE_SCRIPT].includes(ext); };

/** Le nom de paquet d'un spécificateur nu (`@scope/nom/x` → `@scope/nom`), `null` pour un module de Node. */
function paquetDe(spec) {
  if (spec.startsWith('node:')) return null;
  const segments = spec.split('/');
  return spec.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

const zone = {
  meta: { type: 'problem' },
  create(context) {
    const z = zoneDe(relative(context.cwd, context.filename));
    return {
      Program: (node) => {
        if (z === null || estZone(z)) return;
        context.report({ node, message: `Zone (#2882) : \`${z}/\` n’est pas une zone de ${TABLE} — rejoindre une zone existante, ou écrire la ligne de la nouvelle zone et ses sens d’import.` });
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
    const importeurRel = posix(relative(racine, importeur));
    const survit = COUCHES[de].survit === true;
    const juger = (node, spec, typeSeul) => {
      const cible = cibleLexicale(importeur, spec, racine);
      if (cible === null) {
        const paquet = paquetDe(spec);
        if (paquetFerme(de, paquet, importeurRel)) {
          context.report({ node, message: `Paquet d’hôte (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et ne charge pas \`${paquet}\`, paquet de l’hôte web, ni à l’EXÉCUTION ni pour un TYPE — ${TABLE} le ferme (\`survit\`, \`PAQUETS_DE_L_HOTE_WEB\`) : laisser ce qui en dépend à l’hôte web, ou, pour un dossier d’outillage de la zone, le déclarer dans sa ligne (\`paquetsDOutillage\`).` });
        }
        return;
      }
      const cibleRel = posix(relative(racine, cible));
      const vers = zoneDe(cibleRel);
      if (!estZone(vers)) {
        if (survit && estCode(cibleRel) && !horsZoneOuvert(de, importeurRel, cibleRel)) {
          context.report({ node, message: `Hors zone (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et ne lit aucun module hors des zones (\`${cibleRel}\`), ni à l’EXÉCUTION ni pour un TYPE — sa fermeture ne doit atteindre que des zones qui survivent : déplacer la forme partagée dans une zone qui survit, ou, pour un script d’outillage de la zone, la déclarer dans sa ligne de ${TABLE} (\`outillage\`).` });
        }
        return;
      }
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
    const jugerMotif = (node, motif) => {
      if (motif === null || motif.startsWith('!')) return;
      const cible = cibleLexicale(importeur, motif, racine);
      if (cible !== null && COUCHES[de].importe !== '*' && dossierJoker(posix(relative(racine, cible)))) {
        context.report({ node, message: `Motif joker (#2882) : ${nommer(de)} ne lit pas un motif d’\`import.meta.glob\` dont le dossier de zone est un joker (\`${motif}\`) — ${TABLE} ne juge que la zone qu’un chemin nomme : écrire le dossier de la zone visée.` });
        return;
      }
      juger(node, motif, false);
    };
    const jsx = (node) => context.report({ node, message: `JSX (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et n’écrit aucun JSX — sa compilation chargerait \`react/jsx-runtime\`, paquet de l’hôte web (${TABLE}, \`survit\`) : laisser le rendu à l’hôte web.` });
    return {
      ...visiteurDArcs({
        // La requête d'un spécificateur (`?raw`) ne fait pas partie du chemin ; dans un motif, `?` est un joker.
        surArc: (node, spec, { typeSeul }) => juger(node, spec.replace(/\?.*$/s, ''), typeSeul),
        surMotif: jugerMotif,
      }),
      ...(survit ? { JSXElement: jsx, JSXFragment: jsx } : {}),
    };
  },
};

const MSG_REEXPORTATION = `Réexportation (#2882, #2817 D2) : un module de ${ZONES_SANS_REEXPORTATION.map((z) => `\`${dossierDe(z)}/\``).join(' ou ')} ne réexporte rien, hors de la surface du noyau (\`${SURFACE_DU_NOYAU}\`) — repointer chaque importeur vers le module qui déclare.`;

const reexportation = {
  meta: { type: 'problem' },
  create(context) {
    const importes = new Set();
    const listes = [];
    const arcs = visiteurDArcs({
      surArc: (node, _spec, { reexport }) => {
        if (reexport) context.report({ node, message: MSG_REEXPORTATION });
      },
    });
    return {
      ...arcs,
      ImportDeclaration: (node) => {
        arcs.ImportDeclaration(node);
        for (const s of node.specifiers) importes.add(s.local.name);
      },
      ExportNamedDeclaration: (node) => {
        arcs.ExportNamedDeclaration(node);
        if (!node.source && !node.declaration) listes.push(node);
      },
      'Program:exit': () => {
        arcs['Program:exit']();
        for (const node of listes) if (node.specifiers.some((s) => importes.has(nomDe(s.local)))) context.report({ node, message: MSG_REEXPORTATION });
      },
    };
  },
};

const suiteJouee = {
  meta: { type: 'problem' },
  create(context) {
    const rel = posix(relative(context.cwd, context.filename));
    return {
      Program: (node) => {
        if (!estSuiteVitest(rel) || estDeLaSuiteVitest(rel) || estDeLaSuiteDuNoyau(rel)) return;
        context.report({ node, message: `Suite jouée (#2882, #2928) : \`${rel}\` n’est jouée ni par la suite principale ni par celle du noyau (\`scripts/guards/lib/racinesDeLaSuite.mjs\`) — hors de \`src/\`, une suite se nomme \`*.hors-store.test.ts\` sous un hôte du noyau.` });
      },
    };
  },
};

const quarantaine = {
  meta: { type: 'problem', schema: false },
  create(context) {
    const racine = context.cwd;
    const importeur = posix(context.filename);
    const quarantaines = context.options.map(({ cibles, message }) => ({ vise: (rel) => cibles.some((g) => correspondGlob(rel, g)), message }));
    const juger = (node, spec) => {
      const cible = cibleLexicale(importeur, spec, racine);
      if (cible === null) return;
      const cibleRel = posix(relative(racine, cible));
      for (const { vise, message } of quarantaines) {
        if (vise(cibleRel)) context.report({ node, message: `Quarantaine d’import (#2882) : \`${cibleRel}\` — ${message}` });
      }
    };
    return visiteurDArcs({
      surArc: (node, spec) => juger(node, spec.replace(/\?.*$/s, '')),
      surMotif: (node, motif) => { if (motif !== null && !motif.startsWith('!')) juger(node, motif); },
    });
  },
};

export default { zone, purete, reexportation, suiteJouee, quarantaine };
