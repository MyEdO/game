import { afterEach, describe, expect, it } from 'vitest';
import { nomDe, poserLeNommeur, type Nommeur } from './nom';
import { combattantDeTest } from './combattantDeTest.testkit';

const gobelin = combattantDeTest({ id: 'g1', label: 'Gobelin', kind: 'ennemi' });

describe('nomDe — le nom d’un combattant dans un texte du moteur (#4017)', () => {
  let pose: Nommeur | undefined;
  afterEach(() => { poserLeNommeur(pose); });

  it('sans nommeur, son `label`', () => {
    pose = poserLeNommeur(undefined);
    expect(nomDe(gobelin)).toBe('Gobelin');
  });

  it('nommeur posé, sa réponse pour l’id du combattant', () => {
    pose = poserLeNommeur((id) => (id === 'g1' ? 'Inconnu' : 'autre'));
    expect(nomDe(gobelin)).toBe('Inconnu');
  });

  it('nommeur qui rend `null`, son `label`', () => {
    pose = poserLeNommeur(() => null);
    expect(nomDe(gobelin)).toBe('Gobelin');
  });

  it('`poserLeNommeur` rend le nommeur précédent', () => {
    const premier: Nommeur = () => 'premier';
    pose = poserLeNommeur(premier);
    expect(poserLeNommeur(undefined)).toBe(premier);
    expect(poserLeNommeur(undefined)).toBeUndefined();
  });
});
