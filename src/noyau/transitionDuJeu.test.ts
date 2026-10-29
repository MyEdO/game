import { describe, it, expect, afterEach } from 'vitest';
import { transitionDuJeu } from './transitionDuJeu';
import { etatInitialDuJeu, type EtatDeJeu } from './etat';
import { CHEMINS_NOMMES, lireAuChemin, poserAuChemin } from './combattantsDeLEtat.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { ID_DE_PORTEUR, PORTEURS_HORS_TALENT } from '../engine/porteursDePassifs.testkit';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import { statblockToCombatant } from './monde/spawn';
import type { CustomStatblock } from '../engine/statblock';
import type { OpPassive } from '../engine/ops';
import type { Combatant } from '../engine/types';
import { ALDO, BRUNA, CORA, etatAttable, rangsAssis, taverneAttablee } from './taverneAttablee.testkit';
import { blessuresDeBase } from '../engine/characteristics';

/** Transition du jeu (#2817 D7) : la chaise suit le corps, observée sur l'état avant/après. */
describe('transitionDuJeu — occupation des sièges', () => {
  it('une écriture qui ne touche pas `party` n’appelle rien', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, gameTime: prev.gameTime + 1 })).toBeNull();
  });

  it('une permutation du groupe sous la même occupation lève les deux chaises', () => {
    const prev = etatAttable();
    expect(rangsAssis(prev.scene)).toEqual([1, 2]);
    const ecriture = transitionDuJeu(prev, { ...prev, party: [BRUNA, ALDO] });
    expect(ecriture?.scene, 'la permutation n’a levé aucune chaise').toBeTruthy();
    expect(rangsAssis(ecriture!.scene!)).toEqual([]);
  });

  it('un héros ajouté derrière les rangs assis ne lève rien', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, party: [ALDO, BRUNA, CORA] })).toBeNull();
  });

  it('une occupation NEUVE dans la même écriture porte sa propre vérité : rien à réconcilier', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, party: [BRUNA, ALDO], scene: taverneAttablee() })).toBeNull();
  });

  it('réentrance structurelle : l’écriture de libération ne se rejoue pas', () => {
    const prev = etatAttable();
    const s = { ...prev, party: [BRUNA, ALDO] };
    const apres = { ...s, ...transitionDuJeu(prev, s)! };
    expect(transitionDuJeu(s, apres)).toBeNull();
  });
});

/**
 * Le maximum des Blessures suit ses porteurs (LDB 05 l.1001, LDB 48 l.23) à TOUTE écriture : chaque
 * combattant d'un champ remplacé est réconcilié, à chaque chemin dérivé du type `EtatDeJeu` ; le courant
 * suit le delta (LDB 48 l.27).
 */
describe('transitionDuJeu — le maximum des Blessures suit ses porteurs', () => {
  const plus3 = (): OpPassive[] => [{ op: 'attrMod', attr: 'wounds', mod: 3 }];
  /** Profil à 30 partout : B = 12 ; blessé de 2. */
  const blesse = (id = 'c'): Combatant => combattantDeTest({ id, kind: 'hero', wounds: blessuresDeBase(12, 10) });

  afterEach(() => resetData());

  it('les chemins couvrent le groupe et la file de combat', () => {
    expect(CHEMINS_NOMMES.map(([nom]) => nom)).toEqual(expect.arrayContaining(['party.[]', 'battle.combatants.[]']));
  });

  describe.each(CHEMINS_NOMMES)('%s', (_, chemin) => {
    it.each(PORTEURS_HORS_TALENT)('%s posé sans réconciliation : le maximum et le courant suivent, sans toucher l’écrit', (_n, _champ, poserLePorteur) => {
      const prev = etatInitialDuJeu();
      const c = blesse();
      poserLePorteur(c, plus3());
      const s = { ...prev, ...poserAuChemin(prev, chemin, c) };
      const apres = { ...s, ...transitionDuJeu(prev, s) };
      expect(lireAuChemin(apres, chemin).wounds).toMatchObject({ max: 15, current: 13 });
      expect(c.wounds).toMatchObject({ max: 12, current: 10 });
      expect(transitionDuJeu(s, apres), 'la réconciliation rendue se rejoue').toBeNull();
    });

    it('un porteur retiré rend le maximum et le courant', () => {
      const c = blesse();
      PORTEURS_HORS_TALENT[0][2](c, plus3());
      const prev = etatInitialDuJeu();
      const s = { ...prev, ...poserAuChemin(prev, chemin, c) };
      const pose = { ...s, ...transitionDuJeu(prev, s) };
      const retire = { ...lireAuChemin(pose, chemin), mutations: [] };
      const s2 = { ...pose, ...poserAuChemin(pose, chemin, retire) };
      expect(lireAuChemin({ ...s2, ...transitionDuJeu(pose, s2) }, chemin).wounds).toMatchObject({ max: 12, current: 10 });
    });

    it('un combattant déjà réconcilié : aucune écriture', () => {
      const prev = etatInitialDuJeu();
      expect(transitionDuJeu(prev, { ...prev, ...poserAuChemin(prev, chemin, blesse()) })).toBeNull();
    });
  });

  it('un acteur muté EN PLACE dont le champ est remplacé (`touchActors`) est réconcilié', () => {
    const c = blesse();
    const prev = { ...etatInitialDuJeu(), party: [c] };
    PORTEURS_HORS_TALENT[0][2](c, plus3());
    const ecriture = transitionDuJeu(prev, { ...prev, party: [...prev.party] });
    expect(ecriture?.party?.[0].wounds).toMatchObject({ max: 15, current: 13 });
  });

  it('seul le combattant qui bouge est copié : les autres, et les champs voisins, gardent leur objet', () => {
    const [a, b] = [blesse('a'), blesse('b')];
    PORTEURS_HORS_TALENT[0][2](b, plus3());
    const prev = etatInitialDuJeu();
    const battle = { combatants: [a, b], log: [] } as unknown as NonNullable<EtatDeJeu['battle']>;
    const ecriture = transitionDuJeu(prev, { ...prev, battle })!;
    expect(Object.keys(ecriture)).toEqual(['battle']);
    expect(ecriture.battle!.combatants[0]).toBe(a);
    expect(ecriture.battle!.combatants[1]).not.toBe(b);
    expect(ecriture.battle!.log).toBe(battle.log);
  });

  it('un porteur NÉ mutant (`statblockToCombatant`, LDB 85 l.245) entre dans l’état à son maximum : aucune écriture', () => {
    setDataset('mutations', [...datasetArray('mutations'), { id: ID_DE_PORTEUR, type: 'mutations', label: 'Mutation de test', desc: '', kind: 'physique', passive: plus3() }] as never);
    const ne = statblockToCombatant({ label: 'Mutant', char: {}, traits: [{ id: 'mutation', arg: ID_DE_PORTEUR }] } as unknown as CustomStatblock, 'ne', { x: 0, y: 0 });
    expect(ne.wounds.current).toBe(ne.wounds.max);
    expect(ne.wounds.max - ne.wounds.base!).toBe(3);
    const prev = etatInitialDuJeu();
    for (const [, chemin] of CHEMINS_NOMMES) expect(transitionDuJeu(prev, { ...prev, ...poserAuChemin(prev, chemin, ne) }), chemin.join('.')).toBeNull();
  });

  it('une écriture qui ne remplace aucun champ porteur n’appelle rien : seuls les champs remplacés sont parcourus', () => {
    const c = blesse();
    const prev = { ...etatInitialDuJeu(), party: [c] };
    PORTEURS_HORS_TALENT[0][2](c, plus3());
    expect(transitionDuJeu(prev, { ...prev, journal: ['x'] })).toBeNull();
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
  });

  it('chaise et Blessures dans la MÊME transition : la permutation lève les chaises, le porteur est réconcilié', () => {
    const prev = etatAttable();
    const bruna = { ...BRUNA, wounds: { ...BRUNA.wounds } };
    PORTEURS_HORS_TALENT[0][2](bruna, plus3());
    const s = { ...prev, party: [bruna, ALDO] };
    const ecriture = transitionDuJeu(prev, s)!;
    expect(rangsAssis(ecriture.scene!)).toEqual([]);
    expect(ecriture.party?.[0].wounds).toMatchObject({ max: BRUNA.wounds.max + 3, current: BRUNA.wounds.current + 3 });
    expect(ecriture.party?.[1]).toBe(ALDO);
    expect(transitionDuJeu(s, { ...s, ...ecriture })).toBeNull();
  });
});
