/** #1595 — couverture des Événements de bord (MDG 15 l.137, l.235), du Voyage rapide (l.33, l.37) et des
 *  Événements d’escale (l.129, l.243), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import { seaEvents } from '../../index';

const clone = () => structuredClone(seaEvents);

describe('sea-events.json — les tables ouvertes couvrent leur jet d’un seul tenant', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset('sea-events.json', seaEvents)).toBeNull();
  });

  it('REFUSE un Événement de bord du milieu sans plafond', () => {
    const trouee = clone();
    const milieu = trouee.boardEvents.entries[10];
    milieu.max = null;
    expect(validateDataset('sea-events.json', trouee)).toMatch(new RegExp(`boardEvents\\.entries : .*la bande « ${milieu.id} » n'a pas de borne haute`));
  });

  it('REFUSE un palier du Voyage rapide du milieu sans plancher', () => {
    const trouee = clone();
    trouee.fastVoyage.entries[2].min = null;
    expect(validateDataset('sea-events.json', trouee)).toMatch(/fastVoyage\.entries : les bandes ne couvrent pas le d10 du Voyage rapide/);
  });

  it('REFUSE un trou dans les Événements d’escale (2d10 ± 1, MDG 15 l.129, 1..21)', () => {
    const trouee = clone();
    const bande = trouee.portEvents.entries[3];
    bande.max = (bande.max as number) - 1;
    expect(validateDataset('sea-events.json', trouee)).toMatch(/portEvents\.entries : les bandes ne couvrent pas le 2d10 de l'escale/);
  });

  it('le domaine de l’escale suit le dé de sa table : sous un d20, la table devrait partir de 0', () => {
    const autreDe = clone();
    autreDe.portEvents.die = 'd20';
    expect(validateDataset('sea-events.json', autreDe)).toMatch(/portEvents\.entries : les bandes ne couvrent pas le d20 de l'escale.*commence à 1 au lieu de 0/);
  });

  it('REFUSE une table d’escale qui s’arrête avant 21', () => {
    const courte = clone();
    courte.portEvents.entries.pop();
    expect(validateDataset('sea-events.json', courte)).toMatch(/portEvents\.entries : .*s'arrête à 20 au lieu de 21/);
  });
});
