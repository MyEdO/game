/** #1595 — couverture des Événements de bord (MDG 15 l.137, l.235), du Voyage rapide (l.33, l.37) et des
 *  Événements d’escale (l.129), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import seaEventsJson from '../../sea-events.json';

type Bande = { id: string; min: number | null; max: number | null };
const clone = () => structuredClone(seaEventsJson) as unknown as { boardEvents: Bande[]; fastVoyage: { paliers: Bande[] }; portEvents: Bande[] };

describe('sea-events.json — les tables ouvertes couvrent leur jet d’un seul tenant', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset('sea-events.json', seaEventsJson)).toBeNull();
  });

  it('REFUSE un Événement de bord du milieu sans plafond', () => {
    const trouee = clone();
    const milieu = trouee.boardEvents[10];
    milieu.max = null;
    expect(validateDataset('sea-events.json', trouee)).toMatch(new RegExp(`boardEvents : .*la bande « ${milieu.id} » n'a pas de borne haute`));
  });

  it('REFUSE un palier du Voyage rapide du milieu sans plancher', () => {
    const trouee = clone();
    trouee.fastVoyage.paliers[2].min = null;
    expect(validateDataset('sea-events.json', trouee)).toMatch(/fastVoyage\.paliers : les bandes ne couvrent pas le d10 du Voyage rapide/);
  });

  it('REFUSE un trou dans les Événements d’escale (2d10 ± 1, MDG 15 l.129, 1..21)', () => {
    const trouee = clone();
    const bande = trouee.portEvents[3];
    bande.max = (bande.max as number) - 1;
    expect(validateDataset('sea-events.json', trouee)).toMatch(/portEvents : les bandes ne couvrent pas le 2d10 de l'escale/);
  });

  it('REFUSE une table d’escale qui s’arrête avant 21', () => {
    const courte = clone();
    courte.portEvents.pop();
    expect(validateDataset('sea-events.json', courte)).toMatch(/portEvents : .*s'arrête à 20 au lieu de 21/);
  });
});
