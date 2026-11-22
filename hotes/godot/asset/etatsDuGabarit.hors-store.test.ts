import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { TABLE_DU_JOUET as table } from './gabarit.testkit.ts';
import { etatsAuxFacteursNeutres, etatsDuGabarit, type EtatDuGabarit } from './etatsDuGabarit.ts';
import { grilleDesAppuis } from './evaluateur/grilleDesAppuis.ts';
import { cellulesDeSilhouettesAtteignables, coinsDeSilhouettesAtteignables, poidsDeSilhouettes, poidsDuGabarit, sensCuitsDuGabarit } from './gabarit.ts';
import { CARRURE_MOINS, CARRURE_PLUS, CORPULENCE, FEMININ, NOMS_DES_SILHOUETTES as noms } from './silhouettes.ts';
import { FACTEURS_NEUTRES, sontNeutres } from './facteursDuGabarit.ts';
import { fauteDeBornesDuGabarit, validerManifesteDeBase } from './manifesteDeBase.ts';

describe('domaine des silhouettes et du gabarit (#3104)', () => {
  it('tient pour neutres les seuls facteurs égaux chacun au neutre de sa propre clé', () => {
    expect(sontNeutres(FACTEURS_NEUTRES)).toBe(true);
    for (const cle of Object.keys(FACTEURS_NEUTRES) as (keyof typeof FACTEURS_NEUTRES)[]) {
      expect(sontNeutres({ ...FACTEURS_NEUTRES, [cle]: FACTEURS_NEUTRES[cle] + 0.1 }), cle).toBe(false);
    }
  });

  it('rend les états aux facteurs neutres, un par coin de silhouettes atteignable', () => {
    for (const selection of [[], noms]) {
      const neutres = etatsAuxFacteursNeutres(table, selection);
      expect(neutres.every((e) => sontNeutres(e.facteurs))).toBe(true);
      expect(neutres.map((e) => e.poidsSilhouettes)).toEqual(coinsDeSilhouettesAtteignables(table, selection));
    }
  });

  it('refuse par son nom une liste de silhouettes absente aux opérations de domaine', () => {
    for (const operation of ['etatsAuxFacteursNeutres', 'appuis']) {
      const resultat = spawnSync(process.execPath, [fileURLToPath(new URL('../../../scripts/personnage-3d/base/gabarit.mjs', import.meta.url))], {
        input: JSON.stringify({ operation }), encoding: 'utf8',
      });
      expect(resultat.status).not.toBe(0);
      expect(resultat.stderr).toContain('silhouettes-absentes : liste des silhouettes requise');
    }
  });

  it('valide chaque plage autour du neutre reçu et la pondération neutre de chaque facteur', () => {
    for (const neutre of Object.values(FACTEURS_NEUTRES)) {
      expect(fauteDeBornesDuGabarit({ min: neutre, max: neutre }, neutre)).toBeUndefined();
      expect(fauteDeBornesDuGabarit({ min: neutre + 0.1, max: neutre + 1 }, neutre)).toBeDefined();
    }
    expect(Object.values(poidsDuGabarit(FACTEURS_NEUTRES, table.bornes, {})).every((p) => p === 0)).toBe(true);
    for (const [st, attendu] of [
      [{ min: FACTEURS_NEUTRES.st - 0.1, max: FACTEURS_NEUTRES.st + 0.1 }, false],
      [{ min: FACTEURS_NEUTRES.st + 0.2, max: FACTEURS_NEUTRES.st + 0.4 }, true],
    ] as const) {
      const verdict = validerManifesteDeBase({ gabarit: { ...table, st } }, new Uint8Array());
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.ecarts.some((e) => e.ou === 'gabarit.st')).toBe(attendu);
    }
  });
  it('cumule `carrure_plus` avec `feminin` et avec `corpulence` (#3280)', () => {
    expect(poidsDeSilhouettes({ sex: 'F', build: BUILD_NEUTRE, st: table.st.max }, table)).toEqual({ [FEMININ]: 1, [CORPULENCE]: 0, [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 1 });
    expect(poidsDeSilhouettes({ sex: 'M', build: 1, st: table.st.max }, table)).toEqual({ [FEMININ]: 0, [CORPULENCE]: 1, [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 1 });
    expect(poidsDeSilhouettes({ sex: 'F', build: 1, st: table.st.max }, table)).toEqual({ [FEMININ]: 1, [CORPULENCE]: 1, [CARRURE_MOINS]: 0, [CARRURE_PLUS]: 1 });
    expect(etatsAuxFacteursNeutres(table, noms).map((e) => e.nom).sort()).toEqual(['neutre', FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS,
      `${FEMININ}_${CORPULENCE}`, `${FEMININ}_${CARRURE_MOINS}`, `${FEMININ}_${CARRURE_PLUS}`, `${CORPULENCE}_${CARRURE_MOINS}`, `${CORPULENCE}_${CARRURE_PLUS}`,
      `${FEMININ}_${CORPULENCE}_${CARRURE_MOINS}`, `${FEMININ}_${CORPULENCE}_${CARRURE_PLUS}`].sort());
  });

  it('croise exactement les douze coins atteignables avec chaque jeu de facteurs', () => {
    const etats = etatsDuGabarit(table, noms);
    const groupes = new Map<string, EtatDuGabarit[]>();
    for (const e of etats) {
      const cle = JSON.stringify(e.facteurs);
      groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
    }
    expect(groupes.size).toBe(13);
    expect(etats).toHaveLength(13 * 12);
    for (const groupe of groupes.values()) {
      expect(groupe).toHaveLength(12);
      for (const sex of ['M', 'F'] as const) for (const build of [BUILD_NEUTRE, 1]) for (const st of [table.st.min, FACTEURS_NEUTRES.st, table.st.max]) {
        const poids = poidsDeSilhouettes({ sex, build, st }, table);
        expect(groupe.some((e) => noms.every((nom) => e.poidsSilhouettes[nom] === poids[nom]))).toBe(true);
      }
    }
    for (const e of etats) {
      expect(e.poidsSilhouettes[CARRURE_MOINS] * e.poidsSilhouettes[CARRURE_PLUS]).toBe(0);
      expect(e.poidsGabarit).toEqual(poidsDuGabarit(e.facteurs, table.bornes, e.poidsSilhouettes));
      expect(e.poidsReference).toEqual(poidsDuGabarit(e.facteurs, table.bornes, tableTotale(noms, () => 0)));
    }
  });

  it('partage les coins atteignables avec la grille des appuis pour chaque sous-ensemble de silhouettes', () => {
    const sousEnsembles = noms.reduce<string[][]>((ensembles, nom) => [...ensembles, ...ensembles.map((s) => [...s, nom])], [[]]);
    for (const selection of sousEnsembles) {
      const domaine = etatsAuxFacteursNeutres(table, selection);
      const grille = grilleDesAppuis({ gabarit: table, silhouettes: selection });
      const attendus = new Set(domaine.map((e) => JSON.stringify(e.poidsSilhouettes)));
      expect(new Set(grille.map((e) => JSON.stringify(e.silhouettes)))).toEqual(attendus);
      const coins = coinsDeSilhouettesAtteignables(table, selection);
      expect(coins).toHaveLength(attendus.size);
      expect(new Set(coins.map((p) => JSON.stringify(p))).size).toBe(coins.length);
    }
  });

  it('émet quatre cellules affines, une colonne de corpulence et une de carrure chacune, qui couvrent les poids continus', () => {
    const cellules = cellulesDeSilhouettesAtteignables(table, noms);
    expect(cellules).toHaveLength(4);
    const point = (cellule: (typeof cellules)[number], u: number, v: number) =>
      tableTotale(noms, (nom) => cellule.origine[nom] + u * cellule.colonnes[0][nom] + v * cellule.colonnes[1][nom]);
    for (const [index, cellule] of cellules.entries()) {
      const sex = index < 2 ? 'M' : 'F';
      const plus = index % 2 === 1;
      const extremite = plus ? table.st.max : table.st.min;
      expect(cellule.colonnes).toEqual([{ ...tableTotale(noms, () => 0), [CORPULENCE]: 1 }, { ...tableTotale(noms, () => 0), [plus ? CARRURE_PLUS : CARRURE_MOINS]: 1 }]);
      for (const u of [0, 0.37, 1]) for (const v of [0, 0.61, 1]) {
        const poids = poidsDeSilhouettes({ sex, build: BUILD_NEUTRE + u * (1 - BUILD_NEUTRE),
          st: FACTEURS_NEUTRES.st + v * (extremite - FACTEURS_NEUTRES.st) }, table);
        const attendu = point(cellule, u, v);
        for (const nom of noms) expect(attendu[nom]).toBeCloseTo(poids[nom], 14);
      }
    }
    expect(cellulesDeSilhouettesAtteignables(table, [])).toEqual([]);
    expect(coinsDeSilhouettesAtteignables(table, [])).toEqual([{}]);
  });

  it('refuse une silhouette inconnue dans les deux consommateurs du domaine', () => {
    const silhouettes = ['feminin', 'inconnue'];
    expect(() => etatsDuGabarit(table, silhouettes)).toThrow('silhouette-inconnue : inconnue');
    expect(() => grilleDesAppuis({ gabarit: table, silhouettes })).toThrow('silhouette-inconnue : inconnue');
  });

  it('marque exactement les sens cuits sans silhouette pour les normales de la porte', () => {
    const points = etatsDuGabarit(table, noms).filter((e) => e.pointCuisson);
    const sens = sensCuitsDuGabarit(table.bornes);
    expect(points).toHaveLength(sens.length);
    for (const { cle, extremite } of sens) {
      expect(points.some((e) => JSON.stringify(e.facteurs) === JSON.stringify({ ...FACTEURS_NEUTRES, [cle]: extremite })
        && Object.values(e.poidsSilhouettes).every((p) => p === 0))).toBe(true);
    }
  });

  it('quotiente les coins équivalents quand des silhouettes sont absentes', () => {
    const neutres = etatsDuGabarit(table, []);
    expect(neutres).toHaveLength(13);
    expect(neutres.find((e) => e.nom === 'neutre')?.facteurs).toEqual(FACTEURS_NEUTRES);
    const feminin = etatsDuGabarit(table, ['feminin']);
    expect(feminin).toHaveLength(13 * 2);
    expect(new Set(feminin.map((e) => JSON.stringify([e.facteurs, e.poidsSilhouettes]))).size).toBe(feminin.length);
  });
});
