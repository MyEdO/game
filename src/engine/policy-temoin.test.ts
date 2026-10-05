/**
 * Une règle optionnelle basculée est une donnée ÉDITABLE qui change : elle passe par le MÊME témoin
 * que les datasets (`data/versionDataset.ts`, clé `regles`) — toute vue dérivée (`memoParVersion`,
 * fiches du Codex, identités de dessin) la voit, et les abonnés (`abonnerAuxDatasets`) sont notifiés.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { OPTIONAL_RULES, resetRule, rule, setRule } from './policy';
import { abonnerAuxDatasets, versionDesDatasets } from '../data/versionDataset';

const regle = OPTIONAL_RULES[0];
afterEach(() => resetRule(regle.id));

describe('règles optionnelles : le témoin des données éditables', () => {
  it('`setRule` fait monter `versionDesDatasets()` et notifie un abonné', () => {
    let notifications = 0;
    const désabonner = abonnerAuxDatasets(() => {
      notifications += 1;
    });
    const v0 = versionDesDatasets();
    setRule(regle.id, !rule(regle.id));
    désabonner();
    expect(versionDesDatasets()).toBeGreaterThan(v0);
    expect(notifications).toBeGreaterThan(0);
  });

  it('`resetRule` d’une règle surchargée fait monter le témoin', () => {
    setRule(regle.id, !rule(regle.id));
    const v0 = versionDesDatasets();
    resetRule(regle.id);
    expect(versionDesDatasets()).toBeGreaterThan(v0);
  });
});
