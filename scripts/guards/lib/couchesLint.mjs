// MURS DE COUCHE (#2882, #1709 ; AGENTS.md règle 3), jugés sur la table `COUCHES` (`couches.mjs`).
//  - `murs/zone` : un fichier de `src/` vit dans une zone de la table ; créer `src/foo/` demande sa ligne.
//  - `murs/purete-imports` : un arc d'import (`arcsDImport.mjs`, toutes ses formes, motifs
//    d'`import.meta.glob` compris) d'une zone vers une autre n'existe que si la table l'ouvre ; un arc
//    de type seul passe là où la table n'ouvre que le type ; vers une zone dont la ligne déclare une porte
//    (`portes`), l'arc ne vise que ce module, en valeur comme en type (`porteManquee`). Une zone qui survit à
//    la bascule (`survit`) ne charge aucun paquet de l'hôte web (`paquetFerme`), même pour un type, hors des paquets que sa
//    ligne ouvre à un outillage (`paquetsDOutillage`) ; aucun module de la zone hors de cet outillage ne l'importe, en
//    valeur comme en type (`outillageAtteint`). Hors de
//    `racine`, un motif de glob dont le dossier de zone est un joker est refusé (`dossierJoker`). Une zone qui survit
//    n'écrit aucun JSX et ne lit aucun module de CODE hors des zones (`scripts/`, `server/`… ; `estCode` : une donnée
//    n'importe rien), sauf, pour un outillage de la zone, les modules que sa ligne déclare (`outillage`,
//    `horsZoneOuvert`). Elle juge tout fichier d'une zone qui n'est ni suite ni banc (`estFichierVitest`).
//  - `murs/tests-survivants` (#3058) : une suite ou un banc (`estFichierVitest`) d'une zone qui survit n'a aucun arc,
//    sous aucune forme et en type compris, vers une zone qui n'y survit pas (`fermeParLaSurvie`), ne charge aucun
//    paquet de l'hôte web (`paquetFerme`), n'écrit aucun JSX, ne lit aucun motif joker (`dossierJoker`), et ne
//    charge rien que la lecture des arcs ne suive (`surCalcule` de `visiteurDArcs`) : spécificateur ou motif calculé,
//    chargeur renommé, lié comme valeur ou lu par un accès calculé. Une cible hors des zones s'ouvre : sa clôture est
//    le mur `scripts/corpus/guards/clotureDesZonesQuiSurvivent.test.mjs`, qui suit l'acquisition calculée d'un membre en
//    forme fermée (`valeursDAcquisition`, #3058). `purete-imports` et ce mur se partagent les
//    fichiers des zones, sans trou ni recouvrement, et un seul jugeur d'arcs (`jugeurDArcs`).
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
import {
  COUCHES,
  SURFACE_DU_NOYAU,
  ZONES_SANS_REEXPORTATION,
  dossierDe,
  estZone,
  fermeParLaSurvie,
  fermeture,
  horsZoneOuvert,
  outillageAtteint,
  ouvertes,
  paquetFerme,
  porteManquee,
  zoneDe,
} from './couches.mjs';
import { EXTENSIONS_DE_SCRIPT } from './dialecte.mjs';
import { estFichierVitest, estSuiteVitest } from './fichierVitest.mjs';
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
export function paquetDe(spec) {
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

/** Le message d'un paquet de l'hôte web que la zone `de` ferme. */
const msgPaquet = (de, paquet) => `Paquet d’hôte (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et ne charge pas \`${paquet}\`, paquet de l’hôte web, ni à l’EXÉCUTION ni pour un TYPE — ${TABLE} le ferme (\`survit\`, \`PAQUETS_DE_L_HOTE_WEB\`) : laisser ce qui en dépend à l’hôte web, ou, pour un outillage de la zone, le déclarer dans sa ligne (\`paquetsDOutillage\`).`;
/** Le message d'un motif d'`import.meta.glob` dont le dossier de zone est un joker. */
const msgJoker = (de, motif) => `Motif joker (#2882) : ${nommer(de)} ne lit pas un motif d’\`import.meta.glob\` dont le dossier de zone est un joker (\`${motif}\`) — ${TABLE} ne juge que la zone qu’un chemin nomme : écrire le dossier de la zone visée.`;
/** Le message d'un JSX dans la zone `de`, qui survit. */
const msgJsx = (de) => `JSX (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et n’écrit aucun JSX — sa compilation chargerait \`react/jsx-runtime\`, paquet de l’hôte web (${TABLE}, \`survit\`) : laisser le rendu à l’hôte web.`;

/** Le JUGEUR D'ARCS des murs de zone (`purete`, `testsSurvivants`) : les visiteurs qui rendent chaque arc du fichier,
 *  de la zone `de`, à son juge. La requête d'un spécificateur (`?raw`) ne fait pas partie du chemin ; dans un motif,
 *  `?` est un joker, et un motif `!…` n'est pas jugé. Un arc sans cible lexicale (`cibleLexicale`) est un paquet :
 *  `surPaquet(node, paquet)` ; sinon `surCible(node, cibleRel, typeSeul)`, chemin relatif à la racine. Hors de
 *  `racine`, un motif dont le dossier de zone est un joker (`dossierJoker`) va à `surJoker(node, motif)`. Une zone qui
 *  survit rend chaque JSX à `surJsx(node)`. `surCalcule` : celui de `visiteurDArcs`. */
function jugeurDArcs(context, de, { surPaquet, surCible, surJoker, surJsx, surCalcule }) {
  const racine = context.cwd;
  const importeur = posix(context.filename);
  const juger = (node, spec, typeSeul) => {
    const cible = cibleLexicale(importeur, spec, racine);
    if (cible === null) surPaquet(node, paquetDe(spec));
    else surCible(node, posix(relative(racine, cible)), typeSeul);
  };
  const jugerMotif = (node, motif) => {
    if (motif === null || motif.startsWith('!')) return;
    const cible = cibleLexicale(importeur, motif, racine);
    if (cible !== null && COUCHES[de].importe !== '*' && dossierJoker(posix(relative(racine, cible)))) surJoker(node, motif);
    else juger(node, motif, false);
  };
  return {
    ...visiteurDArcs({ surArc: (node, spec, { typeSeul }) => juger(node, spec.replace(/\?.*$/s, ''), typeSeul), surMotif: jugerMotif, surCalcule, portee: context.sourceCode }),
    ...(COUCHES[de].survit === true ? { JSXElement: surJsx, JSXFragment: surJsx } : {}),
  };
}

const purete = {
  meta: { type: 'problem' },
  create(context) {
    const racine = context.cwd;
    const de = zoneDe(relative(racine, context.filename));
    if (!estZone(de) || estFichierVitest(posix(relative(racine, context.filename)))) return {};
    const { libres, enType } = ouvertes(de);
    const ouvert = `${nommer(de)} importe ${libres.length ? libres.join(', ') : 'aucune zone'}${enType.length ? ` ; en type seul : ${enType.join(', ')}` : ''}`;
    const importeurRel = posix(relative(racine, context.filename));
    const survit = COUCHES[de].survit === true;
    const surCible = (node, cibleRel, typeSeul) => {
      const vers = zoneDe(cibleRel);
      const atteint = outillageAtteint(de, importeurRel, cibleRel);
      if (atteint !== null) {
        context.report({ node, message: `Outillage atteint (#2972) : ${nommer(de)} n’importe rien de l’outillage \`${atteint}\` hors de lui, en valeur comme en type — il charge des paquets de l’hôte web (\`paquetsDOutillage\` de ${TABLE}), que le graphe de l’hôte ne doit pas atteindre : le charger par Node à l’exécution, ou déplacer la forme partagée hors de l’outillage.` });
        return;
      }
      if (!estZone(vers)) {
        if (survit && estCode(cibleRel) && !horsZoneOuvert(de, importeurRel, cibleRel)) {
          context.report({ node, message: `Hors zone (#2882, #2817 D9) : ${nommer(de)} survit à la bascule et ne lit aucun module hors des zones (\`${cibleRel}\`), ni à l’EXÉCUTION ni pour un TYPE — sa fermeture ne doit atteindre que des zones qui survivent : déplacer la forme partagée dans une zone qui survit, ou, pour un outillage de la zone, la déclarer dans sa ligne de ${TABLE} (\`outillage\`).` });
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
    return jugeurDArcs(context, de, {
      surPaquet: (node, paquet) => { if (paquetFerme(de, paquet, importeurRel)) context.report({ node, message: msgPaquet(de, paquet) }); },
      surCible,
      surJoker: (node, motif) => context.report({ node, message: msgJoker(de, motif) }),
      surJsx: (node) => context.report({ node, message: msgJsx(de) }),
    });
  },
};

/** Le préfixe des messages de `murs/tests-survivants`. */
const INSTRUMENT = 'Instrument qui survit (#3058)';

const testsSurvivants = {
  meta: { type: 'problem' },
  create(context) {
    const racine = context.cwd;
    const importeurRel = posix(relative(racine, context.filename));
    const de = zoneDe(importeurRel);
    if (!estFichierVitest(importeurRel) || !estZone(de) || COUCHES[de].survit !== true) return {};
    const rapporter = (node, message) => context.report({ node, message: `${INSTRUMENT} — ${message}` });
    return jugeurDArcs(context, de, {
      surPaquet: (node, paquet) => { if (paquetFerme(de, paquet, importeurRel)) rapporter(node, msgPaquet(de, paquet)); },
      surCible: (node, cibleRel) => {
        const vers = zoneDe(cibleRel);
        if (!fermeParLaSurvie(de, vers)) return;
        rapporter(node, `Zone fermée (#2882) : une suite ou un banc de ${nommer(de)}, qui survit à la bascule, n’importe rien de ${nommer(vers)}, qui n’y survit pas, ni à l’EXÉCUTION ni pour un TYPE — ${TABLE} (\`survit\`, \`fermeParLaSurvie\`) : jouer la règle par une zone qui survit, ou poser le test de l’hôte web dans sa zone.`);
      },
      surJoker: (node, motif) => rapporter(node, msgJoker(de, motif)),
      surJsx: (node) => rapporter(node, msgJsx(de)),
      surCalcule: (node) => rapporter(node, `Spécificateur calculé (#2882) : une suite ou un banc de ${nommer(de)} n’importe que par un spécificateur LITTÉRAL — un spécificateur calculé ne se juge pas : écrire le chemin en littéral.`),
    });
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

export default { zone, purete, testsSurvivants, reexportation, suiteJouee, quarantaine };
