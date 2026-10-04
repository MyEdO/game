import { describe, expect, it } from 'vitest';
import { SNAPSHOT_DE_BOURSE } from '../scripts/guards/lib/bourseSnapshot.mjs';
import { scanConstructionsReservees, constructionsReserveesDuCorpus } from '../scripts/guards/lib/canonUnique.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

const imports = "import { useGame } from '../state/store'; import { partyMoneyTotal } from '../state/bourseFlow';";
const scan = (text: string) => scanConstructionsReservees({ rel: 'src/ui/sonde.tsx', text }, [SNAPSHOT_DE_BOURSE]);

describe('snapshot de bourse — allocation hors sélecteur Zustand', () => {
  it.each([
    imports + 'useGame(s => partyMoneyTotal(() => s));',
    imports + 'useGame((s) => { return (partyMoneyTotal(() => s)); });',
    "import { useGame as jeu } from '../state/store'; import { partyMoneyTotal as total } from '../state/bourseFlow'; jeu(s => (total(() => s)));",
    "import * as jeu from '../state/store'; import * as bourse from '../state/bourseFlow'; jeu.useGame(function(s) { return bourse.partyMoneyTotal(() => s); });",
  ])('voit la valeur allouée : %s', (text) => {
    expect(scan(text)).toHaveLength(1);
  });

  it.each([
    imports + 'useGame(s => toBrass(partyMoneyTotal(() => s)));',
    imports + 'useMemo(() => partyMoneyTotal(useGame.getState), [party]);',
    imports + 'const total = partyMoneyTotal(useGame.getState);',
    "const useGame = f => f({}); const partyMoneyTotal = () => 3; useGame(s => partyMoneyTotal(() => s));",
  ])('admet le scalaire et les dérivations hors sélecteur : %s', (text) => {
    expect(scan(text)).toEqual([]);
  });

  it('le corpus ne rend aucun total de bourse alloué directement dans un sélecteur', () => {
    expect(constructionsReserveesDuCorpus(readCorpus(['src']), [SNAPSHOT_DE_BOURSE])).toEqual([]);
  });
});
