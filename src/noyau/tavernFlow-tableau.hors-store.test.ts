/**
 * Le TABLEAU DE MARQUE d'une partie de taverne en cours (`tavernBoard`, `tavernFlow.ts`), lu par la surface du noyau
 * (`sequenceBoardOf`) sur les jeux réels de `tavernGames.json` (`NADJ 16`) :
 *  · fléchettes, l.97 : un total d'EXACTEMENT 501, la note du passage sur le camp qui lance ;
 *  · Cerevis, l.90 : le compte de chouettes, le plus bas l'emporte, sans cible ;
 *  · Alvatafl, l.20, l.25-28 : 48 nains contre 12 elfes, la cible d'un camp est plus de la moitié des pièces d'en face.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng } from './battleRng';
import { sequenceBoardOf } from './sequenceCore';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(11); });
const get = () => banc.getState();

/** Un héros seul à la table lance `gameId` face à un habitué de la salle ; rend le tableau. */
function partie(gameId: string) {
  const a = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
  banc.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  get().jouerALaTaverne(a.id, { gameId, opponent: { kind: 'profil', id: 'humain' } });
  const board = sequenceBoardOf(get);
  expect(board, `${gameId} : un tableau de marque`).not.toBeNull();
  return board!;
}

describe('tavernBoard — NADJ 16', () => {
  it('fléchettes (l.97) : cible 501 pour les deux camps, la note du passage sur le seul camp qui lance', () => {
    const b = partie('flechettes');
    expect(b.camps.map((c) => c.target)).toEqual([501, 501]);
    expect(b.unit).toBe('points');
    const notes = b.camps.filter((c) => c.note);
    expect(notes).toHaveLength(1);
    expect(notes[0].note).toBe(t('tavern.volleyNote', { n: 1, total: 3 }));
  });

  it('Cerevis (l.90) : le compte de chouettes, sans cible, en six tours', () => {
    const b = partie('cerevis');
    expect(b.camps.map((c) => c.target)).toEqual([undefined, undefined]);
    expect(b.camps[0].note).toBe(t('tavern.cerevisNote'));
    expect(b).toMatchObject({ manche: 1, manches: 6, unit: 'chouettes' });
  });

  it('Alvatafl (l.20, l.28) : le camp nain vise 7 pièces elfes prises, le camp elfe 25 pièces naines', () => {
    const b = partie('alvatafl');
    expect(b.camps.map((c) => c.target)).toEqual([7, 25]);
    expect(b.unit).toBe('pièces prises');
  });
});
