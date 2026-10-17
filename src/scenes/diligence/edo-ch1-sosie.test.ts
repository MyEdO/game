/**
 * Le SOSIE de Kastor Lieberung, désigné par le joueur à la fouille du cadavre — EDO 02 l.91 ; #2219
 * c.6068818868. Chemin RÉEL : l'action `fouiller` du paquet `la-diligence`, jouée au store.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import { pickActiveModalKey } from '../../state/modalArbiter';
import { evalCondition } from '../../engine/flowCore';
import { condCtx } from '../../state/bourseFlow';
import { snapshotSave } from '../../state/saves';
import { campagneDuJeu, diligenceCampaign, lancerCampagne, paquetDuJeu } from '../campaign';

const paquet = paquetDuJeu(diligenceCampaign);
const SOSIE = 'campagne-sosie-heros';
const get = () => useGame.getState();
const heros = (label: string, seed: number) => ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` });

beforeEach(() => {
  get().setParty([heros('Vivant', 1), { ...heros('Tombé', 2), dead: true }, heros('Autre', 3)]);
  expect(lancerCampagne(useGame.getState, campagneDuJeu(diligenceCampaign), paquet.scenes[0].id)).toBeNull();
  get().acquitterOuverture();
  get().transitionTo('route-principale-virage');
  get().moveParty({ x: 36, y: 3 });
  get().jouerAction('cadavre-kastor-lieberung', 'fouiller');
});

describe('EDO 02 l.91 — la fouille du cadavre ouvre la désignation du sosie', () => {
  it('la fouille ouvre la désignation (modale de groupe, invite de l’Effet) ; la fouille s’achève au choix', () => {
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
    expect(get().pendingDesignationHeros?.invite).toMatch(/sosie/);
    expect(pickActiveModalKey(get())).toBe('designationHeros');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().flags['edo-ch1-corps-kastor-fouille'], 'EDO 02 l.89-91 : la suite de la fouille attend la désignation').toBeUndefined();
    get().designerHerosChoisir('h-1');
    expect(get().flags['edo-ch1-corps-kastor-fouille']).toBe(true);
  });

  it('un héros MORT n’est pas proposable : son choix ne pose rien et la désignation reste ouverte', () => {
    get().designerHerosChoisir('h-2');
    expect(get().etats[SOSIE]).toBeUndefined();
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('le choix d’un héros vivant pose l’état à son id et referme la désignation', () => {
    get().designerHerosChoisir('h-1');
    expect(get().etats[SOSIE]).toBe('h-1');
    expect(get().pendingDesignationHeros).toBeNull();
    expect(evalCondition({ kind: 'species', id: 'humains-reiklander', who: { etat: SOSIE } }, condCtx(get))).toBe(true);
    expect(evalCondition({ kind: 'partyDead', who: { etat: SOSIE } }, condCtx(get))).toBe(false);
  });

  it('la désignation ne s’annule pas : elle survit au changement de scène', () => {
    get().transitionTo('altdorf-porte-sud');
    expect(get().pendingDesignationHeros?.etat).toBe(SOSIE);
  });

  it('sauvegarde puis reprise : l’état désigné est conservé', () => {
    get().designerHerosChoisir('h-3');
    const save = snapshotSave(get() as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, '2512-01-01T00:00:00Z');
    useGame.setState({ etats: {} });
    expect(get().importGame(JSON.stringify(save))).toBeNull();
    expect(get().etats[SOSIE]).toBe('h-3');
  });
});
