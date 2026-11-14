// scripts/gen-verbes.mjs — LES VERBES DE LA PARTIE et leurs paramètres (#2898 lot C), dérivés du TYPE que
// `Partie.envoyer` accepte (`partieLue`), la forme de la valeur de chaque réglage de jet (`REGLAGES`) et de chaque
// choix de fenêtre (`CHOIX`), et celle de chaque type récursif qu'une forme référence (`FORMES`) : une cible de CODE de
// `GENERATORS` (scripts/docs/build-all.mjs),
// `src/hote/verbes.generated.ts`, jamais commitée. Les hôtes du noyau y lisent les paramètres qu'ils contrôlent
// (`argumentsDuVerbe`, src/hote/geste.ts) ; le doc `docs/hote-texte.md` écrit sa table par la même lecture. Sa
// seconde cible, `src/i18n/nomsDeParametre.generated.ts`, porte les noms que les libellés `parametre.*` typent
// (src/i18n/messages/fr.ts), dans la couche que le catalogue importe.
//
//   node scripts/gen-verbes.mjs            écrit les cibles
//   node scripts/gen-verbes.mjs --check    compare sans écrire
import { SORTIE_VERBES as SORTIE, SORTIE_NOMS_DE_PARAMETRE } from './docs/lib/cibles-registres.mjs'
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs'
import { partieLue } from './docs/lib/verbesDeLaPartie.mjs'
import { parUnitesDeCode } from './guards/lib/lister.mjs'

/** Les axes d'une table, une clé par ligne : la forme de la valeur de chacun de ses axes. */
const lignesDesAxes = (table) => Object.entries(table).map(([cle, formes]) => `  ${JSON.stringify(cle)}: ${JSON.stringify(formes)},\n`).join('')

/** Le texte de la cible : un verbe par ligne, ses paramètres en JSON ; un flux de jet par ligne, la forme de la valeur
 *  de chacun de ses réglages ; une fenêtre par ligne, la forme de la valeur de chacun de ses choix ; un type récursif
 *  par ligne, sa forme. */
const texteDeSortie = ({ verbes, reglages, choix, formes }) =>
  `// GÉNÉRÉ par scripts/gen-verbes.mjs (#2898) — jamais édité, jamais commité.\n`
  + `import type { Forme, ParametreDeVerbe } from './formes';\n\n`
  + `/** Les paramètres de chaque verbe de la partie, lus du type de \`ActionsDuNoyau\`. */\n`
  + `export const VERBES: Readonly<Record<string, readonly ParametreDeVerbe[]>> = {\n`
  + Object.entries(verbes).map(([verbe, parametres]) => `  ${JSON.stringify(verbe)}: ${JSON.stringify(parametres)},\n`).join('')
  + `};\n\n`
  + `/** La forme de la valeur de chaque réglage de chaque flux de jet, lue du type de \`ReglagesDuJet\`. */\n`
  + `export const REGLAGES: Readonly<Record<string, Readonly<Record<string, Forme>>>> = {\n`
  + lignesDesAxes(reglages)
  + `};\n\n`
  + `/** La forme de la valeur de chaque choix de chaque fenêtre, lue du type de \`ChoixDesFenetres\`. */\n`
  + `export const CHOIX: Readonly<Record<string, Readonly<Record<string, Forme>>>> = {\n`
  + lignesDesAxes(choix)
  + `};\n\n`
  + `/** La forme de chaque type récursif qu'une forme référence (\`{ genre: 'ref' }\`), par nom. */\n`
  + `export const FORMES: Readonly<Record<string, Forme>> = {\n`
  + Object.entries(formes).map(([nom, f]) => `  ${JSON.stringify(nom)}: ${JSON.stringify(f)},\n`).join('')
  + `};\n`

/** Les noms de champ que la forme `f` porte, à toute profondeur, à travers les types récursifs de `formes`. */
function nomsDesChamps(f, formes, vus = new Set()) {
  switch (f.genre) {
    case 'objet': return f.champs.flatMap((c) => [c.nom, ...nomsDesChamps(c.forme, formes, vus)])
    case 'dictionnaire': return [...(f.champs ?? []).flatMap((c) => [c.nom, ...nomsDesChamps(c.forme, formes, vus)]), ...nomsDesChamps(f.valeur, formes, vus)]
    case 'tableau': return nomsDesChamps(f.element, formes, vus)
    case 'tuple': return f.elements.flatMap((e) => nomsDesChamps(e, formes, vus))
    case 'union': return f.membres.flatMap((m) => nomsDesChamps(m, formes, vus))
    case 'ref': return vus.has(f.type) ? [] : nomsDesChamps(formes[f.type], formes, new Set(vus).add(f.type))
    default: return []
  }
}

/** L'union TypeScript des chaînes `noms`, triées, une par ligne. */
const unionEcrite = (noms) => [...new Set(noms)].sort(parUnitesDeCode).map((n) => `\n  | ${JSON.stringify(n)}`).join('')

/** Le texte de la seconde cible : chaque nom de paramètre, de champ (à toute profondeur) et d'axe des verbes, réglages
 *  et choix (`NomDeParametre`), et chaque paire `<verbe>.<nom>` d'un verbe et d'un nom qu'il porte
 *  (`ParametreDuVerbe`). */
function texteDesNoms({ verbes, reglages, choix, formes }) {
  const duVerbe = Object.entries(verbes).flatMap(([verbe, parametres]) => parametres.flatMap((p) => [p.nom, ...nomsDesChamps(p.forme, formes)]).map((nom) => `${verbe}.${nom}`))
  const desAxes = [reglages, choix].flatMap((table) => Object.values(table).flatMap((axes) => Object.entries(axes).flatMap(([axe, f]) => [axe, ...nomsDesChamps(f, formes)])))
  return `// GÉNÉRÉ par scripts/gen-verbes.mjs (#3613) — jamais édité, jamais commité.\n\n`
    + `/** Chaque nom de paramètre, de champ et d'axe des verbes de la partie (\`VERBES\`, \`REGLAGES\`, \`CHOIX\`, \`FORMES\`). */\n`
    + `export type NomDeParametre =${unionEcrite([...duVerbe.map((c) => c.slice(c.indexOf('.') + 1)), ...desAxes])};\n\n`
    + `/** Chaque \`<verbe>.<nom>\` d'un verbe et d'un nom de paramètre ou de champ qu'il porte. */\n`
    + `export type ParametreDuVerbe =${unionEcrite(duVerbe)};\n`
}

/** Chaque cible de la partie `partie`, avec son texte. */
const cibles = (partie) => [[SORTIE, texteDeSortie(partie)], [SORTIE_NOMS_DE_PARAMETRE, texteDesNoms(partie)]]

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  return new Map(cibles(partieLue()))
}

if (import.meta.main) {
  const partie = partieLue()
  console.log(`gen-verbes — ${Object.keys(partie.verbes).length} verbes`)
  for (const [path, out] of cibles(partie)) {
    ecrireOuVerifier({
      out,
      path,
      check: process.argv.includes('--check'),
      staleMsg: `gen-verbes — ${path} est PÉRIMÉ (diverge du type des verbes).`,
      rerunMsg: '  → relancer `npm run gen`.',
    })
  }
}
