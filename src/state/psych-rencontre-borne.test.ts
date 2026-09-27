/**
 * #1224 — les trois sondes du juge, promues en tests, mesurées sur le CHEMIN RÉEL (store, `startScene`,
 * `psychDRAdjust` tel que les résolutions d'attaque l'appellent : SANS roster).
 *
 * RAW mesuré (LDB 21, `Source/…/21 - Psychologie.md`) :
 * · l.9 verbatim — « Sur un succès, les effets sont annulés jusqu'à la fin de la rencontre, même si
 *   d'autres Tests peuvent être nécessaires si les circonstances changent. » → une affliction est bornée
 *   à SA rencontre ; la même source re-croisée dans une nouvelle rencontre se re-teste.
 * · l.75 verbatim — « Vous êtes immunisé à la *Peur* et l'*Intimidation* tant que vous défendez les êtres
 *   aimés » → l'immunité tient à la présence d'un aimé DÉFENDABLE (un mort ne se défend pas), et elle doit
 *   être atteignable là où le jeu la lit vraiment : `psychDRAdjust`, qui n'a AUCUN roster en portée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { psychDRAdjust } from '../engine/combat';
import { refreshDefendedPsych, refreshAllDefendedPsych, fearSourceFor, targetCausedTrigger, psychBranchOps } from '../engine/psychology';
import { applyOps } from '../engine/ops';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import type { Scene, SceneEntity } from './scene';

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}
function scene(id: string, entities: SceneEntity[]): Scene {
  return {
    id, nom: id, dimensions: { w: 4, h: 4 },
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], entities, dialogues: [], triggers: [], encounters: [], flags: {},
  } as unknown as Scene;
}
const ARAI = (id: string) => ent({ id, statblock: { label: 'Araignée', char: { B: 10 }, groups: ['araignees'] } as never });

/** Héros au Calme plancher (FM 1, aucune avance) : son Test de rencontre échoue de façon déterministe. */
function phobique(label = 'H') {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 1 });
  h.characteristics['force-mentale'] = 1;
  h.skills = [];
  h.psychTraits = [{ type: 'phobie', cible: 'araignees', indice: 1 }];
  return h;
}

const C = (o: Partial<Combatant>): Combatant => ({ id: 'x', kind: 'hero', label: 'x', groups: [], psychState: [], conditions: [], wounds: { current: 10, max: 10 }, ...o } as unknown as Combatant);

beforeEach(() => {
  useGame.setState({ battle: null, pendingCascade: null, scene: null, party: [] });
  useGame.getState().seedRng(2);
});

describe('#1224 — BORNE DE RENCONTRE des afflictions psy (LDB 21 l.9)', () => {
  it('une Peur subie hors combat ne franchit PAS la rencontre suivante — la même source se re-teste', () => {
    useGame.setState({ party: [phobique()] });
    const id = useGame.getState().party[0].id;

    useGame.getState().startScene(scene('s1', [ARAI('arai')]));
    expect(useGame.getState().pendingCascade, 'précondition : la bande de Phobie s’ouvre').toBeTruthy();
    useGame.getState().cascadeBatchRoll(id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().party[0].psychState, 'précondition : le Test raté pose la Peur').toEqual([
      expect.objectContaining({ type: 'peur', sourceId: 'arai' }),
    ]);

    // Nouvelle rencontre (autre scène), MÊME individu : l'affliction de la rencontre close a expiré…
    useGame.getState().startScene(scene('s9', [ARAI('arai')]));
    expect(useGame.getState().pendingCascade, 'la bande se REJOUE dans la nouvelle rencontre').toBeTruthy();
    expect(useGame.getState().pendingCascade!.participants[0].encounterPsych).toMatchObject({ kind: 'peur', sourceId: 'arai' });
  });

  it('l’affliction ne survit pas non plus dans une scène SANS sa source (−1 DR à vie interdit)', () => {
    useGame.setState({ party: [phobique()] });
    const id = useGame.getState().party[0].id;
    useGame.getState().startScene(scene('s1', [ARAI('arai')]));
    useGame.getState().cascadeBatchRoll(id);
    useGame.getState().cascadeNext();
    const arai = C({ id: 'arai', kind: 'enemy', groups: ['araignees'] });
    expect(psychDRAdjust(useGame.getState().party[0], arai), 'précondition : la Peur mord dans SA rencontre').toBe(-1);

    useGame.getState().startScene(scene('s5', [ent({ id: 'paysan', statblock: { label: 'Paysan', char: { B: 10 } } as never })]));
    expect(useGame.getState().party[0].psychState, 'rencontre close : plus aucune affliction').toEqual([]);
    expect(psychDRAdjust(useGame.getState().party[0], arai)).toBe(0);
  });

  it('dans la MÊME rencontre, la source déjà affrontée ne rouvre pas de bande', () => {
    useGame.setState({ party: [phobique()] });
    const id = useGame.getState().party[0].id;
    useGame.getState().startScene(scene('s1', [ARAI('arai')]));
    useGame.getState().cascadeBatchRoll(id);
    useGame.getState().cascadeNext();
    // Ré-ouverture de la porte SANS changer de rencontre (pas de startScene) : rien de neuf.
    const before = useGame.getState().party[0].psychState;
    expect(before).toHaveLength(1);
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

describe('#1224 — « tant que vous défendez les êtres aimés » (LDB 21 l.75)', () => {
  const ogre = () => C({ id: 'o', kind: 'enemy', groups: ['ogres'], causesPeur: 2 });
  const aimant = () => C({
    id: 'h',
    psychState: [{ type: 'amour', cible: 'famille', active: true }, { type: 'peur', sourceId: 'o', indice: 2, calmeDR: 0 }],
  });

  it('l’immunité est ATTEIGNABLE sur le chemin réel : `psychDRAdjust` la lit SANS roster', () => {
    const h = aimant();
    // Le verdict de présence est posé par le détenteur du roster, une fois — puis lu partout.
    refreshDefendedPsych(h, [h, C({ id: 'fam', groups: ['famille'] }), ogre()]);
    expect(psychDRAdjust(h, ogre()), 'Peur annulée + 1 DR de défense').toBe(1);
  });

  /** Sonde du juge — le refresh ÉTEINT, il n'ALLUME jamais : la branche de RÉUSSITE du Test pose
   *  `active:false` sur la MÊME entrée (upsert type+cible) ; un rallumage par présence ressusciterait un
   *  Test gagné (+1 DR non dû à chaque attaque, immunité non due, bande re-proposée chaque Round). */
  it('Test d’Amour RÉUSSI + aimé présent : `active` RESTE false, aucun DR', () => {
    const h = C({ id: 'h', psychTraits: [{ type: 'amour', cible: 'famille' }] });
    applyOps(h, psychBranchOps({ kind: 'amour', cible: 'famille', sourceId: 'fam', indice: 0 }, { success: true }), {});
    expect(h.psychState).toEqual([expect.objectContaining({ type: 'amour', cible: 'famille', active: false })]);

    const aime = C({ id: 'fam', groups: ['famille'] });
    expect(refreshAllDefendedPsych([h, aime]), 'rien à éteindre : rien ne change').toBe(false);
    expect(h.psychState!.find((p) => p.type === 'amour')!.active, 'un Test gagné ne se ressuscite pas').toBe(false);
    expect(psychDRAdjust(h, C({ id: 'o', kind: 'enemy', groups: ['ogres'] })), 'aucun +1 DR non dû').toBe(0);
  });

  /** Sonde de VIGILANCE du juge : le refresh hors combat n'a d'objet que sur ce qui SURVIT à la borne.
   *  Si une entrée `immuneWhileActive` ne pouvait naître QUE d'un Test (`fromTest`), la borne l'effacerait
   *  toujours avant le refresh, qui deviendrait inerte. La pose AUTHORÉE (op `beginPsych`, exposée au
   *  GameOpEditor) est ce qui lui donne un objet — mesuré ici de bout en bout. */
  it('VIGILANCE — une pose AUTHORÉE d’Amour survit à la borne, et le refresh l’éteint hors combat', () => {
    const h = phobique();
    h.psychTraits = [{ type: 'amour', cible: 'famille' }];
    applyOps(h as unknown as Combatant, [{ op: 'beginPsych', type: 'amour', cible: 'famille', active: true }], {});
    expect(h.psychState, 'pose authorée : aucun `fromTest`').toEqual([{ type: 'amour', cible: 'famille', active: true }]);

    useGame.setState({ party: [h] });
    // Scène SANS aimé : la borne ne balaie QUE les afflictions nées d'un Test (`fromTest`) — la pose
    // authorée SURVIT et suit sa propre règle, le refresh l'éteint faute de défendable.
    useGame.getState().startScene(scene('s1', [ent({ id: 'paysan', statblock: { label: 'Paysan', char: { B: 10 } } as never })]));
    const apres = useGame.getState().party[0].psychState!;
    expect(apres, 'la pose authorée SURVIT à la borne — le refresh a donc un objet').toHaveLength(1);
    expect(apres[0].active, 'aucun aimé présent : éteinte').toBe(false);
  });

  it('aucun aimé présent → l’immunité s’éteint et la Peur mord de nouveau', () => {
    const h = aimant();
    refreshDefendedPsych(h, [h, ogre()]);
    expect(h.psychState!.find((p) => p.type === 'amour')!.active).toBe(false);
    expect(psychDRAdjust(h, ogre())).toBe(-1);
  });

  it('un aimé MORT ou HORS DE COMBAT ne se défend pas — l’immunité tombe', () => {
    const mort = C({ id: 'fam', groups: ['famille'], dead: true });
    const h1 = aimant();
    refreshDefendedPsych(h1, [h1, mort, ogre()]);
    expect(h1.psychState!.find((p) => p.type === 'amour')!.active, 'un cadavre n’immunise plus').toBe(false);
    expect(psychDRAdjust(h1, ogre())).toBe(-1);

    const ko = C({ id: 'fam', groups: ['famille'], conditions: [{ id: 'inconscient', value: 1 }] });
    const h2 = aimant();
    refreshDefendedPsych(h2, [h2, ko, ogre()]);
    expect(h2.psychState!.find((p) => p.type === 'amour')!.active, 'un Inconscient non plus').toBe(false);
  });

  /** 2(c) — la porte hors combat et `fearSourceFor` doivent rendre UN SEUL verdict sur la même
   *  situation : l'immunité de Haine (l.41, sans roster) est le témoin le plus net. */
  it('la porte HORS COMBAT rend le MÊME verdict que `fearSourceFor` sur la MÊME situation', () => {
    const arai = C({ id: 'arai', kind: 'enemy', groups: ['araignees'] });
    const immunise = C({
      id: 'h',
      psychTraits: [{ type: 'phobie', cible: 'araignees', indice: 1 }],
      psychState: [{ type: 'haine', cible: 'araignees', active: true }],
    });
    expect(fearSourceFor(immunise, arai), 'Haine : la Peur de la Phobie est ignorée').toBeNull();
    expect(targetCausedTrigger(immunise, [arai]), 'la porte hors combat dit la MÊME chose').toBeNull();

    const nu = C({ id: 'h', psychTraits: [{ type: 'phobie', cible: 'araignees', indice: 1 }] });
    expect(fearSourceFor(nu, arai)).toEqual({ kind: 'peur', indice: 1 });
    expect(targetCausedTrigger(nu, [arai])).toMatchObject({ kind: 'peur', indice: 1, sourceId: 'arai' });
  });
});
