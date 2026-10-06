import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_DE_BOURSE } from '../scripts/guards/lib/bourseSnapshot.mjs';
import { scanConstructionsReservees, constructionsReserveesDuCorpus } from '../scripts/guards/lib/canonUnique.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { API, Snapshot } from 'typescript/unstable/sync';

const imports = "import { useGame } from '../state/store'; import { partyMoneyTotal } from '../state/bourseFlow';";
const scan = (text: string) => scanConstructionsReservees({ rel: 'src/ui/sonde.tsx', text }, [SNAPSHOT_DE_BOURSE]);

describe('snapshot de bourse — allocation hors sélecteur Zustand', () => {
  it('partage un programme entre appels directs, alias et namespace sans confondre les masquages', () => {
    const programmesCrees = vi.spyOn(API.prototype, 'updateSnapshot');
    const capturesLiberees = vi.spyOn(Snapshot.prototype, 'dispose');
    const cachesVides = vi.spyOn(API.prototype, 'clearSourceFileCache');
    const sessionsFermees = vi.spyOn(API.prototype, 'close');
    const texte = [
      imports,
      "import { useGame as jeu } from '../state/store'; import { partyMoneyTotal as total } from '../state/bourseFlow';",
      "import * as store from '../state/store'; import * as bourse from '../state/bourseFlow';",
      'useGame(s => partyMoneyTotal(() => s));',
      'jeu(s => total(() => s));',
      'store.useGame(s => bourse.partyMoneyTotal(() => s));',
      'function masque(useGame, partyMoneyTotal) { useGame(s => partyMoneyTotal(() => s)); }',
      'function masqueTotal(partyMoneyTotal) { useGame(s => partyMoneyTotal(() => s)); }',
    ].join('\n');
    try {
      expect(scan(texte)).toHaveLength(3);
      expect(programmesCrees).toHaveBeenCalledTimes(1);
      expect(capturesLiberees).toHaveBeenCalledTimes(1);
      expect(cachesVides).toHaveBeenCalledTimes(1);
      expect(sessionsFermees).toHaveBeenCalledTimes(1);
      expect(scan(texte)).toHaveLength(3);
      expect(programmesCrees).toHaveBeenCalledTimes(2);
      expect(capturesLiberees).toHaveBeenCalledTimes(2);
      expect(cachesVides).toHaveBeenCalledTimes(2);
      expect(sessionsFermees).toHaveBeenCalledTimes(2);
    } finally {
      programmesCrees.mockRestore();
      capturesLiberees.mockRestore();
      cachesVides.mockRestore();
      sessionsFermees.mockRestore();
    }
  });

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
