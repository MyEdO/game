// GABARIT de script de recette (#2198 : frictions #2001 game-94, #2415 game-16 et game-5f) — le
// squelette que chaque recette réécrivait : s'attacher à la session tenue (ou ouvrir son Chrome), la
// console jugée depuis l'amorçage, la mise en place de `setup.mjs` (`demarrer`), le nettoyage.
//
//   node scripts/recette/gabarit.mjs        → imprime un script de recette prêt à remplir, dont les
//                                              imports visent CET arbre par URL file:/// (exigée sous
//                                              Windows pour un script hors de l'arbre).
//
// Le script s'écrit avec l'outil d'écriture de fichier, jamais par heredoc, sed ou `node -e` : Git Bash
// y casse les antislashs, les regex et l'accentué.
import { leverApresNettoyage } from './cdp.mjs';
import { demarrer } from './setup.mjs';

/** Le texte d'un script de recette neuf (PURE) : ses imports visent le gabarit, le kit et sa couche CDP
 *  par leur URL `file:///` (`urlGabarit`, `urlKit`, `urlCdp`). */
export function squelette({ urlGabarit = import.meta.url, urlKit = new URL('./lib.mjs', import.meta.url).href, urlCdp = new URL('./cdp.mjs', import.meta.url).href } = {}) {
  return `// Recette : <ce que ce script prouve, et son ticket>.
// Lancer : node <ce fichier>   (session tenue : « node scripts/recette/session.mjs ouvrir » en fond, d'abord)
import { recette } from '${urlGabarit}';
import { clickButtonByText, shot } from '${urlKit}';
import { evaluerFn } from '${urlCdp}';

await recette(async ({ session }) => {
  // Les gestes du JOUEUR : clickButtonByText, cliquerSelecteur, realKey… ; \`__wfrp\` pour la mise en
  // place et l'observation seulement (docs/recette-navigateur.md).
}, { attacher: true, scenario: 'entrainement' });
`;
}

/**
 * DÉROULE une recette : `demarrer` (session tenue par défaut, `attacher`), puis `corps({ session })`,
 * puis le verdict de console. Une erreur depuis l’amorçage (ou l’attache pour une session tenue)
 * fait LEVER en la citant — puis la fermeture (`session.close` :
 * DÉTACHE une session tenue, ferme un Chrome ouvert ici). Une erreur du corps sort telle quelle, jointe
 * à un échec de fermeture (`leverApresNettoyage`). Imprime les avertissements.
 * Rend `{ avertissements }`.
 */
export async function recette(corps, { attacher = true, scenario, graine, combat, url, lancer = demarrer, sortie = console } = {}) {
  const { session } = await lancer({ attacher, scenario, graine, combat, url });
  try {
    await corps({ session });
  } catch (e) {
    await leverApresNettoyage(e, () => session.close());
  }
  const erreurs = session.console.errors();
  const avertissements = session.console.warnings();
  await session.close();

  if (avertissements.length) sortie.log(`Avertissements de console : ${avertissements.length}\n${avertissements.map((a) => `  · ${a.text}`).join('\n')}`);
  if (erreurs.length) throw new Error(`recette : ${erreurs.length} erreur(s) de console — ${erreurs.map((e) => e.text).join(' | ')}`);
  return { avertissements };
}

if (import.meta.main) process.stdout.write(squelette());
