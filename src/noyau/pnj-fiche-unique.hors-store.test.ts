/**
 * #1882 — UNE dérivation entité → adversaire (`noyau/monde/sceneNpc.ts`), lue par le combat (`ficheDEntite`,
 * `combatSlice.ts` › spawn de rencontre) et par les lecteurs hors combat (`sceneNpc` : taverne,
 * marchandage `BargainModal.tsx`, infirmerie `combatEffects.ts` › `openMedicalAidEffect`).
 *  · UN nom : celui que l'entité donne, sur les deux chemins.
 *  · Une réf. de personnage MORTE (scène vivante de l'éditeur, que la porte `parseProject` n'a pas vue)
 *    ne donne AUCUNE fiche : aucun lecteur ne reçoit un mannequin, chacun DIT le refus.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { emptyScene, type SceneEntity } from './monde/scene';
import { ficheDEntite, FicheAbsente, sceneNpc } from './monde/sceneNpc';
import { jouerALaTaverne, tavernNpcOffers } from './tavernFlow';
import { activeSequence } from './sequenceCore';
import { applyEffects } from './combatEffects';
import type { Combatant } from '../engine/types';
import { EFFECT_HANDLERS } from './combatEffects';
import { startPursuitSchema, givePossessionSchema } from '../data/schemas/defs-scenes/effets';
import { findCreatureById, findVehicleById } from '../data';
import { sceneEntitySchema } from '../data/schemas/defs-scenes/scene';
import { validateScene } from './validateScene';
import { presetDuNarratif } from './monde/resolveursDuNarratif';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);
/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(get().campaignNarratif)(id);

function pose(entities: SceneEntity[]): void {
  set({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 1) as Combatant[], scene: { ...emptyScene('scene-test'), entities }, battle: null, sequence: null, pendingCascade: null, medic: null } as never);
}

const GERTA: SceneEntity = { id: 'gerta', kind: 'personnage', pos: { x: 1, y: 1 }, label: 'Gerta la Rusée', creature: { id: 'humain' }, tavernGame: { id: 'dominos' } };
const MORT: SceneEntity = { id: 'fantome', kind: 'personnage', pos: { x: 2, y: 2 }, label: 'Le Fantôme', creature: { id: 'creature-fantome-xyz' }, tavernGame: { id: 'dominos' } };

describe('#1882 — un PNJ, une fiche, UN nom', () => {
  
  it('le même PNJ nommé porte le même nom en combat (`ficheDEntite`) et à la taverne (`sceneNpc`)', () => {
    pose([GERTA]);
    const combat = ficheDEntite(GERTA, presetPnjById);
    const taverne = sceneNpc(get().scene, 'gerta', presetPnjById)!;
    expect(combat.label).toBe('Gerta la Rusée');
    expect(taverne.label).toBe(combat.label);
    jouerALaTaverne(get, set, get().party[0].id, { gameId: 'dominos', opponent: { kind: 'pnj', id: 'gerta' } });
    expect(activeSequence<{ opponentName: string }>(get)!.chargeUtile.opponentName).toBe(combat.label);
  });

  it('sans nom d’entité, l’individu anonyme porte le même nom tiré sur les deux chemins (#3712)', () => {
    const anonyme: SceneEntity = { ...GERTA, label: undefined };
    pose([anonyme]);
    const combat = ficheDEntite(anonyme, presetPnjById).label;
    expect(combat).not.toBe(findCreatureById('humain')!.label);
    expect(sceneNpc(get().scene, 'gerta', presetPnjById)!.label).toBe(combat);
  });
});

describe('#1882 — la porte et la fiche disent la MÊME chose d’un porteur', () => {
  it('un `presetId` VIDE n’est pas un porteur : l’entité que le schéma et `validateScene` acceptent, `ficheDEntite` la joue', () => {
    const ent = { id: 'p', kind: 'personnage', pos: { x: 1, y: 1 }, creature: { id: 'humain' }, presetId: '' } as SceneEntity;
    expect(sceneEntitySchema.safeParse(ent).success).toBe(true);
    const sc = emptyScene('scene-test', 8, 8); sc.entities.push(ent);
    expect(validateScene([sc]).filter((w) => w.level === 'error')).toEqual([]);
    expect(ficheDEntite(ent, presetPnjById).creatureId).toBe('humain');
  });
});

describe('#1882 — réf. de personnage MORTE : aucun mannequin, nulle part', () => {
  
  it('combat : `ficheDEntite` LÈVE en nommant la réf.', () => {
    expect(() => ficheDEntite(MORT, presetPnjById)).toThrow(FicheAbsente);
    expect(() => ficheDEntite(MORT, presetPnjById)).toThrow('réf. « creature-fantome-xyz » irrésoluble');
  });

  it('taverne : le PNJ n’est pas offert, et la partie ne s’ouvre pas contre lui', () => {
    pose([MORT]);
    expect(tavernNpcOffers(get().scene, presetPnjById)).toEqual([]);
    jouerALaTaverne(get, set, get().party[0].id, { gameId: 'dominos', opponent: { kind: 'pnj', id: 'fantome' } });
    expect(activeSequence(get)).toBeFalsy();
  });

  it('marchandage : aucun marchand à fiche (`sceneNpc` rend `undefined`)', () => {
    pose([MORT]);
    expect(sceneNpc(get().scene, 'fantome', presetPnjById)).toBeUndefined();
  });

  it('infirmerie : aucune infirmerie ne s’ouvre, le refus est DIT au journal', () => {
    pose([MORT]);
    applyEffects(get, set, [{ type: 'medicalAid', entityId: { id: 'fantome' }, acts: [{ act: 'blessures', cost: { silver: 5 } }] }]);
    expect(get().medic).toBeFalsy();
    expect(get().journal.some((l) => String(l).includes('« fantome »'))).toBe(true);
  });
});

describe('#1882 — adversaire de poursuite et possession : une réf. RÉSOLUE, jamais semée vide', () => {
  const poursuite = (creatureId: string) => ({ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { id: creatureId } }], encounter: '' });

  it('le schéma refuse une créature vide ou morte, accepte une créature du bestiaire', () => {
    expect(startPursuitSchema.safeParse(poursuite('')).success).toBe(false);
    expect(startPursuitSchema.safeParse(poursuite('creature-fantome-xyz')).success).toBe(false);
    expect(startPursuitSchema.safeParse(poursuite('loup')).success).toBe(true);
    expect(givePossessionSchema.safeParse({ type: 'givePossession', nature: 'vehicule', ref: { id: '', type: 'vehicle' } }).success).toBe(false);
  });

  it('un effet NEUF sème le premier offert du catalogue, et passe son propre schéma', () => {
    const p = EFFECT_HANDLERS.startPursuit.make() as ReturnType<typeof poursuite>;
    expect(findCreatureById(p.foes[0].ref.id)).toBeDefined();
    expect(startPursuitSchema.safeParse(p).success).toBe(true);
    const g = EFFECT_HANDLERS.givePossession.make() as { ref: { id: string } };
    expect(findCreatureById(g.ref.id)).toBeDefined();
    expect(givePossessionSchema.safeParse(g).success).toBe(true);
    expect(findVehicleById('')).toBeUndefined();
  });
});
