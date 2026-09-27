/**
 * MÉTÉO ÉDITÉE AU CODEX — le geste de `CodexEdit.save` (`src/ui/compendium/CodexEdit.tsx:588-614`)
 * joué sur `weather.json` : pose mémoire (`setDataset`), validation de la SOURCE ENTIÈRE
 * (`validateDataset(datasetFile, datasetSerializeRoot)`), et au refus REPRISE de l'état d'avant.
 *
 * `save` n'est pas appelable hors React : c'est une closure du composant (`const save = async () =>`,
 * CodexEdit.tsx:588) qui écrit l'état local (`setSchemaError`/`setMsg`/`setDirty`) et lit `src.persist`
 * de la source sélectionnée à l'écran — d'où les mêmes trois portes, appelées ici directement.
 *
 * Deux cas POSITIFS : le refus RESTAURE, et une édition cohérente est vue par la table de cascade
 * SANS rechargement (famille `tablesDeMeteo`, posée par le module de voyage).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { weather } from '../data/index';
import { setDataset, datasetArray, datasetFile, datasetSerializeRoot } from '../data/overrides';
import { validateDataset } from '../data/schemas/validate';
import { tableStepDef } from './cascade';
// La FAMILLE des tables de météo s'enregistre au chargement du module de voyage : on l'importe par ce
// qu'on en LIT (le gabarit des rangées d'une saison), jamais par un import d'effet de bord.
import { stageWeatherRows } from './travelFlow';

type Range = { min: number; max: number; weather: string };
type Saison = (typeof weather)[number];

const SAISONS_LIVREES = [...weather];
const TABLE = 'stage-weather-printemps';

afterEach(() => { setDataset('weather', SAISONS_LIVREES); });

/** La saison ciblée, telle que la donnée VIVANTE la porte à cet instant. */
const printemps = (): Saison => (datasetArray('weather') as Saison[]).find((s) => s.id === 'printemps')!;
/** Une rangée de la TABLE DE CASCADE, par id de météo (jamais par index). */
const rangee = (id: string) => tableStepDef(TABLE)!.rows!.find((r) => r.id === id)!;

/** Le geste de `CodexEdit.save` : pose mémoire, validation de la racine disque, reprise au refus. */
function sauver(saisons: Saison[]): string | null {
  const avant = [...(datasetArray('weather') as Saison[])];
  setDataset('weather', saisons);
  const err = validateDataset(datasetFile('weather'), datasetSerializeRoot('weather'));
  if (err) setDataset('weather', avant);
  return err;
}

/** La saison `printemps` avec ses rangées retouchées par id de météo. */
const editee = (patch: Record<string, Partial<Range>>): Saison[] =>
  (datasetArray('weather') as Saison[]).map((s) => (s.id !== 'printemps' ? s : {
    ...s,
    ranges: s.ranges.map((r) => (patch[r.weather] ? { ...r, ...patch[r.weather] } : r)),
  }));

describe('météo éditée au Codex — refus transactionnel et table VIVANTE', () => {
  it('une borne éditée SEULE est refusée (trou d100) et l’état d’avant est REPRIS', () => {
    const maxAvant = printemps().ranges.find((r) => r.weather === 'pluie')!.max;
    const saisons = editee({ pluie: { max: maxAvant - 10 } });

    // Preview VIVANTE : la pose mémoire est vue par la table de cascade avant toute validation.
    setDataset('weather', saisons);
    expect(rangee('pluie').max).toBe(maxAvant - 10);

    // La SOURCE ENTIÈRE ne parse plus : le d100 de la saison a un trou.
    const err = validateDataset(datasetFile('weather'), datasetSerializeRoot('weather'));
    expect(err).toMatch(/couvert EXACTEMENT une fois/);

    // Reprise de l'état d'avant — l'app ne diverge pas du disque.
    setDataset('weather', SAISONS_LIVREES);
    expect(rangee('pluie').max).toBe(maxAvant);
    expect(validateDataset(datasetFile('weather'), datasetSerializeRoot('weather'))).toBeNull();
    expect(tableStepDef(TABLE)!.rows).toEqual(stageWeatherRows(printemps().ranges));
  });

  it('une édition COHÉRENTE passe et la table de météo la voit SANS rechargement', () => {
    const maxAvant = printemps().ranges.find((r) => r.weather === 'pluie')!.max;
    const err = sauver(editee({
      pluie: { max: maxAvant - 10 },
      'pluie-diluvienne': { min: maxAvant - 9 },
    }));

    expect(err).toBeNull();
    expect(rangee('pluie').max).toBe(maxAvant - 10);
    expect(rangee('pluie-diluvienne').min).toBe(maxAvant - 9);
    expect(tableStepDef(TABLE)!.rows).toEqual(stageWeatherRows(printemps().ranges));
  });
});
