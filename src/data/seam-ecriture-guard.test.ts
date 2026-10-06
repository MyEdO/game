/**
 * GARDE STRUCTURELLE (#1692) — le seam d'ÉCRITURE des datasets est UNIQUE.
 *
 * `setDataset`/`setObjectDataset`/`resetData` (`src/data/overrides.ts`) sont les seules portes qui
 * mutent un dataset : elles remplacent son contenu EN PLACE **et** versionnent l'écriture
 * (`bumperDataset`, `src/data/versionDataset.ts`). Un `push`/`splice` posé directement sur le binding
 * exporté change bien la donnée, mais AUCUN index mémoïsé ne l'apprend — le monde de la donnée et
 * celui des lecteurs divergent en silence.
 *
 * La cible surveillée est le dataset ET SES ENTRÉES (#1717) : `findConditionById('brise')` rend
 * l'objet même du tableau. Le muter écrit dans la donnée sans versionner l'écriture, et change
 * l'ORDRE D'INSERTION de ses clés — dont `JSON.stringify` dépend, donc le save « sans édition » de
 * `dataset-save-parse` sort d'autres octets que le disque. La restauration de la VALEUR ne rend pas
 * cet ordre, et le SEED de `resetData()` (capté à la première évaluation d'`overrides.ts`) fige la
 * forme qu'il trouve : dans un worker où la mutation précède, c'est la forme fautive qu'il restaure.
 *
 * Périmètre : tout `src/**` en `.ts(x)`, TESTS COMPRIS.
 * Vocabulaire IMPORTÉ du seam (`bindingsVivants`, dérivé des littéraux `ARRAYS` et `OBJECTS`
 * d'`overrides.ts`, des documents qui portent une clé de dataset — `documentsDesRacinesVivantes`, lus sur
 * le module généré `src/data/schemas/_racines-vivantes.generated.ts`, dont tout import direct est la
 * racine vivante — et des résolveurs de `src/data`), et un nom n'est retenu que s'il est IMPORTÉ par le
 * fichier (ou exporté par le module propriétaire) : un `props` local d'une scène n'est pas le dataset
 * `props`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bindingsVivants, ecrituresHorsSeam, fichiersSources, fichiersDuSeam, RACINE } from '../../scripts/guards/lib/bindingsVivants.mjs';
import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';

describe('#1692 — aucune écriture de dataset hors du seam `overrides.ts`', () => {
  const parBinding = bindingsVivants();
  const seam = fichiersDuSeam();

  it('aucun `push`/`splice`/`sort`… ni écriture PAR INDEX, ni mutation d’une ENTRÉE vivante, tests compris', { timeout: 480_000 }, () => {
    const fichiers = fichiersSources().filter((f) => !seam.has(f)).map((rel) => ({ rel, text: readFileSync(join(RACINE, rel), 'utf8') }));
    const fautifs = [...analyserCorpus(fichiers)].flatMap(({ fichier: { rel, text }, sourceFile }) => ecrituresHorsSeam(rel, text, parBinding, undefined, sourceFile!));
    expect(fautifs, 'passer par `setDataset(clé, …)` : elle seule versionne l’écriture (les index mémoïsés ne verraient rien)').toEqual([]);
  });

  it('CONTRÔLE POSITIF : le même détecteur voit un `push` injecté dans une COPIE en mémoire', () => {
    const sauvage = `import { lightTones } from '../data';\nlightTones.push(ton);\n`;
    expect(ecrituresHorsSeam('copie.ts', sauvage, parBinding)).toHaveLength(1);
    const parLeSeam = `import { lightTones } from '../data';\nsetDataset('lightTones', [...lightTones, ton]);\n`;
    expect(ecrituresHorsSeam('copie.ts', parLeSeam, parBinding)).toEqual([]);
    const homonymeLocal = `const props = [];\nprops.push(1);\n`;
    expect(ecrituresHorsSeam('copie.ts', homonymeLocal, parBinding)).toEqual([]);
    const renomme = `import { props as propsData } from '../data';\npropsData.splice(0, 1);\n`;
    expect(ecrituresHorsSeam('copie.ts', renomme, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : un dataset-OBJET (`setObjectDataset`) est surveillé comme un dataset-tableau', () => {
    const parChamp = `import { GRAPPLE } from '../data';\nGRAPPLE.label = 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', parChamp, parBinding)).toHaveLength(1);
    const parAssign = `import { details } from '../data';\nObject.assign(details, { x: 1 });\n`;
    expect(ecrituresHorsSeam('copie.ts', parAssign, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : un nom importé d’un JSON qui porte une clé de dataset est le dataset, où qu’il soit importé', () => {
    const parChamp = `import sizesJson from '../data/sizes.json';\nsizesJson.label = 'X';\n`;
    expect(ecrituresHorsSeam('src/engine/copie.ts', parChamp, parBinding)).toHaveLength(1);
    // CLÉ ≠ NOM DE FICHIER : `arcane-phenomena.json` porte `arcanePhenomena`.
    const parAlias = `import arcaneJson from '../../data/arcane-phenomena.json';\nconst DATA = arcaneJson as ArcaneData;\nexport const niveaux = DATA.saturationLevels;\nniveaux.sort((a, b) => a.order - b.order);\n`;
    expect(ecrituresHorsSeam('src/engine/magie/copie.ts', parAlias, parBinding)).toHaveLength(1);
    const sansCle = `import actionsJson from '../data/actions.json';\nactionsJson.push(a);\n`;
    expect(ecrituresHorsSeam('src/engine/copie.ts', sansCle, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : l’ÉCRITURE PAR INDEX est vue elle aussi (elle ne passe par aucune méthode)', () => {
    const parIndex = `import { traits } from '../data';\ntraits[0] = neuf;\n`;
    expect(ecrituresHorsSeam('copie.ts', parIndex, parBinding)).toHaveLength(1);
    const parIndexProfond = `import { traits } from '../data';\ntraits[i].label = 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', parIndexProfond, parBinding)).toHaveLength(1);
    const lectureParIndex = `import { traits } from '../data';\nconst t = traits[0].label === 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', lectureParIndex, parBinding)).toEqual([]);
    const comparaison = `import { traits } from '../data';\nif (traits[0] === neuf) f();\n`;
    expect(ecrituresHorsSeam('copie.ts', comparaison, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : l’ENTRÉE résolue est le dataset — `delete` et affectation sur elle sont vus', () => {
    const parResolveur = `import { findConditionById } from '../data';\nconst ed = findConditionById('brise')!;\ndelete ed.perStack;\ned.perStack = true;\n`;
    expect(ecrituresHorsSeam('copie.ts', parResolveur, parBinding)).toHaveLength(2);
    // MEMBRE d'une entrée, et ENTRÉE dérivée d'une entrée : la même donnée, un cran plus bas.
    const parMembre = `import { findConditionById } from '../data';\nconst rec = findConditionById('empetre')!.recover!;\nrec.difficulty = 'difficile';\n`;
    expect(ecrituresHorsSeam('copie.ts', parMembre, parBinding)).toHaveLength(1);
    const parFind = `import { etats } from '../data';\nconst e = etats.find((x) => x.id === 'brise')!;\ne.label = 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', parFind, parBinding)).toHaveLength(1);
    // La PORTE, elle, ne fabrique que des copies : rien à signaler.
    const parLeSeam = `import { etats } from '../data';\nsetDataset('etats', etats.map((e) => ({ ...e, perStack: undefined })));\n`;
    expect(ecrituresHorsSeam('copie.ts', parLeSeam, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : les trois chemins LOCAUX vers l’entrée sont suivis (motif, chaîne, réaffectation)', () => {
    // (a) LIANT DÉSTRUCTURÉ : l'élément hérite de la vivacité de son initialiseur.
    const parMotif = `import { findConditionById } from '../data';\nconst { recover } = findConditionById('empetre')!;\nrecover.difficulty = 'difficile';\n`;
    expect(ecrituresHorsSeam('copie.ts', parMotif, parBinding)).toHaveLength(1);
    // (b) CHAÎNE DIRECTE : aucune variable ne nomme l'entrée, l'appel est la base de l'écriture.
    const parChaine = `import { findConditionById } from '../data';\nfindConditionById('brise')!.perStack = false;\n`;
    expect(ecrituresHorsSeam('copie.ts', parChaine, parBinding)).toHaveLength(1);
    // (c) RÉAFFECTATION : le nom devient vivant dans la portée qui le déclare.
    const parReaffectation = `import { findConditionById } from '../data';\nlet ed = null;\ned = findConditionById('brise');\ned.perStack = false;\n`;
    expect(ecrituresHorsSeam('copie.ts', parReaffectation, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE NÉGATIF : la PORTÉE départage — un homonyme local n’hérite pas de l’entrée', () => {
    // Même nom, deux origines : `c` résolu du dataset au niveau module, `c` de boucle dans la fonction.
    const ombre = `import { findCreatureById } from '../data';\nconst c = findCreatureById('x')!;\nfunction f(heroes) {\n  for (const c of heroes) { c.hunger = 1; }\n}\n`;
    expect(ecrituresHorsSeam('copie.ts', ombre, parBinding)).toEqual([]);
    // Et la COPIE d'une entrée n'est plus l'entrée : l'écrire ne touche aucune donnée vivante.
    const copie = `import { findCreatureById } from '../data';\nconst c = { ...findCreatureById('x')! };\nc.label = 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', copie, parBinding)).toEqual([]);
  });
});
