/**
 * LE PRÉTIRÉ DE TEST : une fiche imprimée DÉCLARÉE (`PregenDef`), posée au registre `pregens` par sa couture d'écriture (`setDataset`), jamais une entrée de `pregens.json`, et retiré à la fin du test.
 */
import { onTestFinished } from 'vitest';
import { datasetArray, setDataset } from '../../data/overrides';
import { ficheDuPretire } from '../../data/pregens';
import type { PregenDef } from '../../data';
import type { EntreeVivante } from '../../data/datasets';
import { heroDeFiche } from '../../engine/heroDeFiche';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import type { Combatant } from '../../engine/types';

const ADRESSE_DE_TEST = { book: 'livre-de-test', ch: '01', parts: [{ kind: 'blocs', sec: 'test', secOcc: 1, b0: 0, b1: 1, sum: '0000000000000000' }] } as PregenDef['descRef'];

/** Un prétiré halfling herboriste au Niveau 1, dont la Richesse imprimée est 4d10 sous de cuivre. */
export const PRETIRE_DE_TEST: EntreeVivante<PregenDef> = {
  id: 'pretire-de-test',
  type: 'pregens',
  label: 'Prétiré de test',
  descRef: ADRESSE_DE_TEST,
  source: { book: 'livre-de-test', page: 1 },
  species: { id: 'halflings' },
  carrieres: { herboriste: 1 },
  initiales: { 'capacite-de-combat': 23, 'capacite-de-tir': 43, force: 21, endurance: 22, initiative: 25, agilite: 32, dexterite: 42, intelligence: 30, 'force-mentale': 54, sociabilite: 40 },
  charAdvances: { initiative: 5 },
  skills: { perception: 10, metier: { herboriste: 10 } },
  talents: [{ id: 'petit' }, { id: 'vision-nocturne' }],
  trappings: [{ id: 'dague' }],
  spells: [],
  fate: 2,
  resilience: 3,
  xp: 0,
  motivation: 'Curiosité',
  age: 30,
  sex: 'M',
  richesse: { monnaie: 'brass', count: { roll: { n: 4, sides: 10 } } },
};

/** Pose `defs` pour seuls prétirés du registre `pregens`, jusqu'à la fin du test courant. */
export function poserLesPretires(defs: readonly EntreeVivante<PregenDef>[] = [PRETIRE_DE_TEST]): void {
  const avant = [...datasetArray('pregens')];
  setDataset('pregens', defs);
  onTestFinished(() => setDataset('pregens', avant));
}

/** `n` héros distincts bâtis de la fiche de `PRETIRE_DE_TEST` (`heroDeFiche`), d'ids `heros-de-test-<i>`. */
export const herosDeTest = (n: number): Combatant[] =>
  Array.from({ length: n }, (_, i) => heroDeFiche({ ...ficheDuPretire(PRETIRE_DE_TEST), id: `heros-de-test-${i + 1}`, label: `Héros de test ${i + 1}` }, idsDeTest));
