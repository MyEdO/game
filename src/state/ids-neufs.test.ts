/**
 * IDS NEUFS DU STORE (#2907) : la plateforme web fabrique ses ids par l'entropie de l'hôte (`idDEntropie`). Une
 * sauvegarde importée qui porte `hero-1` et `it-1` (ids d'une fabrique en séquence) ne croise aucun id que la partie
 * fabrique ensuite ; deux plateformes web — deux onglets, deux sièges — ne fabriquent pas les mêmes ids, même à la
 * même milliseconde.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { exportSave, snapshotSave } from './saves';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { idNeuf } from '../noyau/plateforme';
import { fabriqueEnSequence } from '../lib/entityId.testkit';
import { idDEntropie } from '../web/entropie';
import type { Combatant } from '../engine/types';

const SOLDAT = { speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gardé', seed: 4801 } as const;

/** Les ids que porte un groupe : ceux des héros et les uids de leurs objets. */
const idsDu = (party: readonly Combatant[]): string[] => party.flatMap((h) => [h.id, ...(h.items ?? []).map((i) => i.uid)]);

describe('ids neufs du store après une sauvegarde importée (#2907)', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState()); });

  it('une save portant `hero-1` et `it-1` ne croise aucun id fabriqué ensuite par la partie', () => {
    const garde = createHero({ ...SOLDAT, id: 'hero-1', idNeuf: fabriqueEnSequence() });
    useGame.setState({ party: [garde] });
    const json = exportSave(snapshotSave(useGame.getState() as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, '2026-10-23T00:00:00.000Z'));
    useGame.setState(useGame.getInitialState());
    expect(useGame.getState().importGame(json)).toBeNull();
    const pris = new Set(idsDu(useGame.getState().party));
    expect([...pris], 'la save ne porte pas les ids d’une fabrique en séquence').toEqual(expect.arrayContaining(['hero-1', 'it-1']));

    const recrue = createHero({ ...SOLDAT, label: 'Recrue', idNeuf });
    useGame.getState().partyAddHero(recrue);
    const objet = itemFromTrappingById('dague', idNeuf)!;
    const neufs = [...idsDu(useGame.getState().party).filter((id) => !pris.has(id)), objet.uid];
    expect(neufs.length, 'la recrue n’a pas rejoint le groupe').toBeGreaterThan(1);
    expect(neufs.filter((id) => pris.has(id))).toEqual([]);
    expect(new Set(neufs).size, 'deux ids neufs se répètent').toBe(neufs.length);
  });

  it('`partyAddHero` refuse un héros dont l’id est déjà au groupe, en le disant', () => {
    const h = createHero({ ...SOLDAT, idNeuf });
    useGame.getState().partyAddHero(h);
    useGame.setState({ journal: [] });
    useGame.getState().partyAddHero(h);
    expect(useGame.getState().party.map((c) => c.id)).toEqual([h.id]);
    expect(useGame.getState().journal).toEqual([`${h.label} est déjà dans le groupe.`]);
  });
});

describe('deux plateformes web fabriquent des ids disjoints (#2907)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('à la même milliseconde, les ids de deux onglets ne se croisent pas', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_761_177_600_000);
    const onglet = () => Array.from({ length: 200 }, () => idDEntropie('it'));
    const [a, b] = [onglet(), onglet()];
    const tous = new Set([...a, ...b]);
    expect(tous.size).toBe(a.length + b.length);
  });
});
