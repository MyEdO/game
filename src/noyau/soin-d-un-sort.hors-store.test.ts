/**
 * Le soin d'un Sort ou d'une Prière (op `heal`), joué par le flux de sort : il réveille l'Inconscient qui regagne une
 * Blessure, et retire un État Hémorragique par Point de Blessure guéri, le dernier posant Exténué. LDB 18 l.15 ;
 * LDB 16 l.107-109. #4949
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';
import { addCondition, poserInconscientDeSaignement, stacks, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { applyOps } from '../engine/ops';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function soignerParLaBenediction(patient: (c: Combatant) => void): Combatant {
  const pretre = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'pretre', label: 'P', seed: 11 });
  const blesse = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 13 });
  blesse.wounds.current = 0;
  patient(blesse);
  banc.setState({ party: [pretre, blesse], battle: null, pendingCast: null });
  applyEffects(banc.getState, banc.setState, [
    { type: 'castSpell', casterId: pretre.id, sort: { id: 'benediction-de-guerison' }, targetId: blesse.id, mode: 'forcerLaReussite' },
  ]);
  return banc.getState().party.find((c) => c.id === blesse.id)!;
}

describe('Soin d’un sort (op heal) : réveil et Hémorragie', () => {
  it('un Inconscient à 0 Blessure regagne 1 Blessure et reprend connaissance (LDB 18 l.15)', () => {
    const b = soignerParLaBenediction((c) => addCondition(c, COND.inconscient));
    expect(b.wounds.current).toBe(1);
    expect(stacks(b, COND.inconscient)).toBe(0);
  });

  it('un saignement de 2 États : 1 Blessure guérie en retire 1, l’Inconscient du saignement tient (LDB 16 l.105, l.107)', () => {
    const b = soignerParLaBenediction((c) => { addCondition(c, COND.hemorragique, 2); poserInconscientDeSaignement(c); });
    expect(stacks(b, COND.hemorragique)).toBe(1);
    expect(stacks(b, COND.inconscient)).toBe(1);
  });

  it('le dernier État Hémorragique retiré pose Exténué, et le héros reprend connaissance (LDB 16 l.109)', () => {
    const b = soignerParLaBenediction((c) => { addCondition(c, COND.hemorragique, 1); poserInconscientDeSaignement(c); });
    expect(stacks(b, COND.hemorragique)).toBe(0);
    expect(stacks(b, COND.inconscient)).toBe(0);
    expect(stacks(b, COND.extenue)).toBe(1);
  });

  it('les faits du soin : Blessures, Hémorragique, Exténué et réveil, chacun sa ligne', () => {
    const c = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 13 });
    c.wounds.current = 0;
    addCondition(c, COND.hemorragique, 1);
    poserInconscientDeSaignement(c);
    const { faits, lignes } = applyOps(c, [{ op: 'heal', amount: 2 }], { idNeuf: idsDeTest, rng: { int: () => 1 }, sourceSpellId: 'benediction-de-guerison' });
    expect(faits.map((f) => (f.genre === 'etat' ? `${f.id} ${f.valeur}` : `${f.genre} ${f.valeur}`))).toEqual(['blessures 2', 'hemorragique -1', 'extenue 1', 'inconscient -1']);
    expect(lignes).toHaveLength(4);
  });

  it('une potion (heal hors sort) ne retire aucune Hémorragie (LDB 16 l.107)', () => {
    const c = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 13 });
    c.wounds.current = 2;
    addCondition(c, COND.hemorragique, 1);
    applyOps(c, [{ op: 'heal', amount: 2 }], { idNeuf: idsDeTest, rng: { int: () => 1 } });
    expect(stacks(c, COND.hemorragique)).toBe(1);
  });
});
