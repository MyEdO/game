import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { startCascade, stepInteraction } from './cascade';
import { tableStep, displayStep } from './rollSeam';
import { fixtureText } from '../i18n/fixtureText';
import type { CascadeStep } from './pendings';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { fermeturesDuFlux } from './verbesOuverts';
import { deDeLaTableTiree } from '../engine/tables';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * UNE ÉTAPE NOMME CE QU'ON Y JOUE : un verbe d'étape de cascade (`jetRegler('cascade', 'choix' | 'quantite')`, `jetLancer('cascadeTirage')` et
 * `jetImposerLeResultat('cascadeTirage')`) joué hors de l'étape qu'il sert — un autre `pid` que l'étape courante, ou une
 * interaction autre que celle que l'étape attend (`stepInteraction`) — est refusé par le canal des refus du noyau
 * (`refuserGeste` ; hors combat, le journal) et le refus nomme l'étape attendue. Cas témoin : l'étape de Déviation
 * d'un Critique porte la table de sévérité ET le choix Dévier/Subir, la table d'abord.
 */

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);
const TABLE = 'table-etape-attendue';

function etapeDeviation(): CascadeStep {
  const etape = tableStep({
    id: 'deviation', kind: cleDeFixture('etape-attendue'), label: fixtureText('Blessure critique'), worldOwner: true,
    table: { tableId: TABLE },
    stake: { key: { dataset: 'combat' as const, kind: 'mutation' } },
  })!;
  return { ...etape, options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }] };
}

const courante = () => { const p = get().pendingCascade!; return p.participants[p.cursor]; };
const dernierRefus = () => get().journal[get().journal.length - 1];

describe('un verbe de cascade joué hors de son étape est refusé en nommant l’étape attendue', () => {
  beforeEach(() => {
    set({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({
      tablesTirables: { [TABLE]: { label: fixtureText('Sévérité'), die: deDeLaTableTiree({ die: 'd100' }), rows: [{ id: 'basse', min: 1, max: 50 }, { id: 'haute', min: 51, max: 100 }], lines: () => ['sévérité tirée'] } },
      appliers: { 'etape-attendue': () => undefined },
    });
    startCascade(get, set, { title: 'Critique', purpose: 'test', steps: [etapeDeviation(), displayStep({ id: 'suite', kind: cleDeFixture('etape-attendue'), worldOwner: true, label: fixtureText('Suite') })] });
    expect(stepInteraction(courante()), 'témoin : la table se tire d’abord').toBe('table');
  });

  it('le choix avant le tirage de la table : refusé, rien n’est écrit, le refus nomme l’étape et ce qu’elle attend', () => {
    get().jetRegler('cascade', 'choix', 'devier', 'deviation');
    expect(courante().chosen).toBeUndefined();
    expect(dernierRefus()).toBe('Geste refusé : l’étape « Blessure critique » (deviation) attend son tirage sur table, pas un choix.');
  });

  it('un verbe qui vise une autre étape que la courante : refusé, le refus nomme l’étape courante', () => {
    get().jetLancer('cascadeTirage', 'suite');
    expect(courante().table!.result).toBeFalsy();
    expect(dernierRefus()).toBe('Geste refusé : il vise l’étape suite, mais l’étape courante est « Blessure critique » (deviation), qui attend son tirage sur table.');
  });

  it('dans l’ordre de l’étape, chaque verbe passe ; un tirage rejoué est fermé, la pose du dé re-pose', () => {
    get().jetLancer('cascadeTirage', 'deviation');
    expect(courante().table!.result).toBeTruthy();
    expect(stepInteraction(courante())).toBe('choix');
    get().jetRegler('cascade', 'choix', 'devier', 'deviation');
    expect(courante().chosen).toBe('devier');
    expect(get().journal).toEqual([]);

    const tire = courante().table!.result;
    expect(fermeturesDuFlux(get(), 'cascadeTirage', 'deviation').lancer).toBe('jetLance');
    get().jetLancer('cascadeTirage', 'deviation');
    expect(courante().table!.result).toBe(tire);
    get().jetImposerLeResultat('cascadeTirage', 77, 'deviation');
    expect(courante()).toMatchObject({ fixed: true, chosen: 'devier', table: { result: { roll: 77 } } });

    get().jetRegler('cascade', 'choix', 'fuir', 'deviation');
    expect(courante().chosen).toBe('devier');
    expect(dernierRefus().startsWith('Choix refusé : « fuir » n’est pas une voie de l’étape « Blessure critique » (devier, subir).')).toBe(true);
  });
});
