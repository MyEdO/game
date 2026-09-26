/**
 * #1882 — UNE dérivation entité → adversaire (`state/sceneNpc.ts`), lue par le combat (`ficheDEntite`,
 * `combatSlice.ts` › spawn de rencontre) et par les lecteurs hors combat (`sceneNpc` : taverne,
 * marchandage `BargainModal.tsx`, infirmerie `combatEffects.ts` › `openMedicalAidEffect`).
 *  · UN nom : celui que l'entité donne, sur les deux chemins.
 *  · Une réf. de personnage MORTE (scène vivante de l'éditeur, que la porte `parseProject` n'a pas vue)
 *    ne donne AUCUNE fiche : aucun lecteur ne reçoit un mannequin, chacun DIT le refus.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { emptyScene, type SceneEntity } from './scene';
import { ficheDEntite, FicheAbsente, sceneNpc } from './sceneNpc';
import { playTavernGame, tavernNpcOffers } from './tavernFlow';
import { activeSequence } from './sequenceCore';
import { applyEffects } from './combatEffects';
import type { Combatant } from '../engine/types';
import { EFFECT_HANDLERS } from './combatEffects';
import { startPursuitSchema, givePossessionSchema } from '../data/schemas/defs-scenes/effets';
import { findCreatureById, findVehicleById } from '../data';
import { sceneEntitySchema } from '../data/schemas/defs-scenes/scene';
import { validateScene } from './validateScene';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function pose(entities: SceneEntity[]): void {
  set({ party: makePregens().slice(0, 1) as Combatant[], scene: { ...emptyScene(), entities }, battle: null, sequence: null, pendingCascade: null, medic: null } as never);
}

const GERTA: SceneEntity = { id: 'gerta', kind: 'personnage', pos: { x: 1, y: 1 }, label: 'Gerta la Rusée', ref: 'humain', tavernGame: { gameId: 'dominos' } };
const MORT: SceneEntity = { id: 'fantome', kind: 'personnage', pos: { x: 2, y: 2 }, label: 'Le Fantôme', ref: 'creature-fantome-xyz', tavernGame: { gameId: 'dominos' } };

describe('#1882 — un PNJ, une fiche, UN nom', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('le même PNJ nommé porte le même nom en combat (`ficheDEntite`) et à la taverne (`sceneNpc`)', () => {
    pose([GERTA]);
    const combat = ficheDEntite(GERTA);
    const taverne = sceneNpc(get().scene, 'gerta')!;
    expect(combat.label).toBe('Gerta la Rusée');
    expect(taverne.label).toBe(combat.label);
    playTavernGame(get, set, { gameId: 'dominos', challengerId: get().party[0].id, opponent: { kind: 'npc', id: 'gerta' } });
    expect(activeSequence<{ opponentName: string }>(get)!.payload.opponentName).toBe(combat.label);
  });

  it('sans nom d’entité, la fiche garde le sien, sur les deux chemins', () => {
    const anonyme: SceneEntity = { ...GERTA, label: undefined };
    pose([anonyme]);
    expect(ficheDEntite(anonyme).label).toBe('Humain');
    expect(sceneNpc(get().scene, 'gerta')!.label).toBe('Humain');
  });
});

describe('#1882 — la porte et la fiche disent la MÊME chose d’un porteur', () => {
  it('un `presetId` VIDE n’est pas un porteur : l’entité que le schéma et `validateScene` acceptent, `ficheDEntite` la joue', () => {
    const ent = { id: 'p', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'humain', presetId: '' } as SceneEntity;
    expect(sceneEntitySchema.safeParse(ent).success).toBe(true);
    const sc = emptyScene(8, 8); sc.entities.push(ent);
    expect(validateScene([sc]).filter((w) => w.level === 'error')).toEqual([]);
    expect(ficheDEntite(ent).creatureId).toBe('humain');
  });
});

describe('#1882 — réf. de personnage MORTE : aucun mannequin, nulle part', () => {
  beforeEach(() => { useGame.setState(useGame.getInitialState(), true); });

  it('combat : `ficheDEntite` LÈVE en nommant la réf.', () => {
    expect(() => ficheDEntite(MORT)).toThrow(FicheAbsente);
    expect(() => ficheDEntite(MORT)).toThrow('réf. « creature-fantome-xyz » irrésoluble');
  });

  it('taverne : le PNJ n’est pas offert, et la partie ne s’ouvre pas contre lui', () => {
    pose([MORT]);
    expect(tavernNpcOffers(get().scene)).toEqual([]);
    playTavernGame(get, set, { gameId: 'dominos', challengerId: get().party[0].id, opponent: { kind: 'npc', id: 'fantome' } });
    expect(activeSequence(get)).toBeFalsy();
  });

  it('marchandage : aucun marchand à fiche (`sceneNpc` rend `undefined`)', () => {
    pose([MORT]);
    expect(sceneNpc(get().scene, 'fantome')).toBeUndefined();
  });

  it('infirmerie : aucune infirmerie ne s’ouvre, le refus est DIT au journal', () => {
    pose([MORT]);
    applyEffects(get, set, [{ type: 'medicalAid', entityId: 'fantome', acts: [{ act: 'wounds', cost: { silver: 5 } }] }]);
    expect(get().medic).toBeFalsy();
    expect(get().journal.some((l) => String(l).includes('« fantome »'))).toBe(true);
  });
});

describe('#1882 — adversaire de poursuite et possession : une réf. RÉSOLUE, jamais semée vide', () => {
  const poursuite = (creatureId: string) => ({ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId } }], encounter: '' });

  it('le schéma refuse un `creatureId` vide ou mort, accepte une créature du bestiaire', () => {
    expect(startPursuitSchema.safeParse(poursuite('')).success).toBe(false);
    expect(startPursuitSchema.safeParse(poursuite('creature-fantome-xyz')).success).toBe(false);
    expect(startPursuitSchema.safeParse(poursuite('loup')).success).toBe(true);
    expect(givePossessionSchema.safeParse({ type: 'givePossession', nature: 'vehicule', ref: { vehicleId: '' } }).success).toBe(false);
  });

  it('un effet NEUF sème le premier offert du catalogue, et passe son propre schéma', () => {
    const p = EFFECT_HANDLERS.startPursuit.make() as ReturnType<typeof poursuite>;
    expect(findCreatureById(p.foes[0].ref.creatureId)).toBeDefined();
    expect(startPursuitSchema.safeParse(p).success).toBe(true);
    const g = EFFECT_HANDLERS.givePossession.make() as { ref: { creatureId: string } };
    expect(findCreatureById(g.ref.creatureId)).toBeDefined();
    expect(givePossessionSchema.safeParse(g).success).toBe(true);
    expect(findVehicleById('')).toBeUndefined();
  });
});
