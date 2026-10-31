import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type * as Ts from 'typescript/unstable/ast';
import { analyserCorpus, typescript } from '../../guards/lib/dialecte.mjs';
import gabarits from '../../../src/data/gabarits.json';
import races from '../../../src/data/raceAppearance.json';
import { gabaritResolu } from '../../../src/noyau/apparence/gabarit.ts';
import type { GabaritId } from '../../../src/data';
import { CLES_DU_GABARIT, type BornesDuGabarit } from '../../../hotes/godot/asset/manifesteDeBase.ts';

/** `src/gameIso/rig/parts/elements/index.ts`, `featureMorpho`. */
export function multiplicateursDeJambes(dossier = new URL('../../../src/gameIso/rig/parts/elements/defs/', import.meta.url)): number[] {
  const ts: typeof Ts = typescript();
  const fichiers = readdirSync(dossier).filter((nom) => nom.endsWith('.ts')).map((nom) => {
    const chemin = new URL(nom, dossier);
    return { rel: fileURLToPath(chemin), text: readFileSync(chemin, 'utf8') };
  });
  const valeurs: number[] = [];
  for (const { fichier, sourceFile: source, diagnostics } of analyserCorpus(fichiers)) {
    if (!source || diagnostics.length) throw new Error(`${fichier.rel} : déclaration d'élément illisible`);
    const visiter = (noeud: Ts.Node): void => {
      if (ts.isVariableDeclaration(noeud) && ts.isIdentifier(noeud.name) && noeud.name.text === 'element' && noeud.initializer && ts.isObjectLiteralExpression(noeud.initializer)) {
        for (const propriete of noeud.initializer.properties) {
          if (!('name' in propriete) || !propriete.name || !(ts.isIdentifier(propriete.name) || ts.isStringLiteral(propriete.name)) || propriete.name.text !== 'legs') continue;
          if (!ts.isPropertyAssignment(propriete) || !ts.isNumericLiteral(propriete.initializer)) throw new Error(`${fichier.rel} : element.legs doit être un nombre littéral`);
          const valeur = Number(propriete.initializer.text);
          if (!(Number.isFinite(valeur) && valeur > 0)) throw new Error(`${fichier.rel} : element.legs doit être positif et fini`);
          valeurs.push(valeur);
        }
      }
      noeud.forEachChild(visiter);
    };
    visiter(source);
  }
  return valeurs;
}

/** `src/noyau/apparence/gabarit.ts`, `gabaritResolu` ; `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function domaineDuGabarit(): BornesDuGabarit {
  const multiplicateurs = multiplicateursDeJambes();
  const extremites = [
    multiplicateurs.filter((f) => f < 1).reduce((a, f) => a * f, 1),
    multiplicateurs.filter((f) => f > 1).reduce((a, f) => a * f, 1),
  ];
  const raceNeutre = { gabarit: { id: gabarits[0].id as GabaritId } };
  const facteurs = extremites.flatMap((legsMult) => [
    ...gabarits.map((g) => gabaritResolu({ gabarit: g.id as GabaritId, race: raceNeutre, legsMult })),
    ...races.map((race) => gabaritResolu({ race: race as Parameters<typeof gabaritResolu>[0]['race'], legsMult })),
  ]);
  return Object.fromEntries(CLES_DU_GABARIT.map((cle) => [cle, {
    min: Math.min(1, ...facteurs.map((f) => f[cle])),
    max: Math.max(1, ...facteurs.map((f) => f[cle])),
  }])) as unknown as BornesDuGabarit;
}
