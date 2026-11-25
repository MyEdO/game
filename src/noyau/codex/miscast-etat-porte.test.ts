/**
 * Rendu Codex d'une rangée de miscast dont le palier `onFailHard` pose un État PORTÉ à durée en Rounds : UNE chip
 * d'État, sa durée propre au badge (`registry.ts::miscastOpRow`). La rangée est celle que ce fichier déclare.
 */
import { describe, it, expect } from 'vitest';
import { CODEX, type CodexRow } from './registry';
import { poserLeDataset } from '../../data/datasetDeTest.testkit';
import { conditionLabel } from '../../data';

poserLeDataset('colereDesDieux', () => [{
  id: 'colere-de-fixture', min: 1, max: 100, label: 'Colère de fixture',
  test: {
    test: { skill: { id: 'resistance' }, difficulty: 'difficile' }, onFail: [],
    onFailHard: { dr: -4, ops: [{ op: 'condition', id: { id: 'inconscient' }, value: 1, carried: true, durationRounds: { dice: { n: 1, sides: 10 } } }] },
  },
  source: { book: 'livre-de-base', page: 1 },
}]);

function rangee(): CodexRow[] {
  const item = CODEX.find((c) => c.key === 'colereDesDieux')!.items.find((i) => i.id === 'colere-de-fixture')!;
  return (item.sections ?? []).flatMap((s) => s.rows);
}

describe('Codex — palier d’une rangée de miscast qui pose un État porté', () => {
  it('le palier « −4 DR » contient EXACTEMENT une chip de l’État, de 1d10 Rounds', () => {
    const rows = rangee();
    const palier = rows.findIndex((r) => r.t === 'sub' && r.label === 'Échec ≤ DR -4');
    expect(palier, 'le palier reste nommé').toBeGreaterThanOrEqual(0);
    const label = conditionLabel('inconscient');
    expect(rows.slice(palier + 1)).toEqual([{ t: 'ref', category: 'etats', id: 'inconscient', label, show: label, badge: '1d10 Round(s)' }]);
  });
});
