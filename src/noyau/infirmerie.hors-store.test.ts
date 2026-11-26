/**
 * L'infirmerie d'un PNJ (`medicalAid`, LDB 75) : elle s'ouvre sur la fiche de l'entité soigneuse, que la validation
 * d'atelier résout par le même `sceneNpc`, et le joueur y choisit le patient.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { EFFECT_HANDLERS, applyEffects } from './combatEffects';
import { sceneNpc } from './monde/sceneNpc';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { creditBourse } from './bourseFlow';
import { groupeVitrineDeScenario } from '../scenes/test-scenarios/_heros';
import { bourseOf } from '../engine/bourse';
import { testValue } from '../engine/skills';
import { bonus, effectiveChar } from '../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

/** Un médecin dont la fiche porte la Guérison, et un figurant dont la fiche ne la porte pas. */
const INFIRMERIE: Scene = {
  ...emptyScene('scene-test', 8, 8),
  id: 'infirmerie',
  entities: [
    {
      id: 'medecin', kind: 'personnage', pos: { x: 1, y: 1 }, label: 'Médecin',
      statblock: { type: 'statblock', label: 'Médecin', char: { intelligence: 45 }, skills: [{ id: 'guerison', value: 55 }] },
    } as SceneEntity,
    {
      id: 'fidele', kind: 'personnage', pos: { x: 3, y: 1 }, label: 'Fidèle',
      statblock: { type: 'statblock', label: 'Fidèle', char: { intelligence: 30 }, skills: [] },
    } as SceneEntity,
  ],
};

describe('l’infirmerie d’un PNJ (`medicalAid`, LDB 75)', () => {
  it('medicalAid ouvre l’infirmerie du PNJ : nom/id viennent de l’entité (pas codés en dur), jamais dans le groupe', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: INFIRMERIE, battle: null, pendingHeal: null, medic: null });
    creditBourse(banc.getState, banc.setState, party[1].id, { gold: 1, silver: 10, brass: 0 }); // le patient (party[1]) paie son acte (soloPayer)
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures', cost: { silver: 5 } }], entityId: { id: 'medecin' } }]);
    const m = banc.getState().medic!;
    expect(m.npc!.id).toBe('medecin'); // l'id de l'entité PNJ
    expect(m.npc!.label).toBe('Médecin'); // le label de l'entité (renommable)
    expect(banc.getState().party.some((h) => h.id === m.npc!.id)).toBe(false);
    expect(m.patientId).toBe(party[1].id); // défaut = un patient soignable
    const ph = banc.getState().pendingHeal!; // le brouillon de l'acte, au PNJ ; rien n'est débité avant le lancer
    // La valeur JOUÉE vient de la FICHE référencée par l'entité ; l'effet n'en porte aucune.
    const fiche = sceneNpc(INFIRMERIE, 'medecin', presetPnjById)!;
    expect(ph.skillValue).toBe(testValue(fiche, { skill: { id: 'guerison' } }));
    expect(m.npc!.intBonus).toBe(bonus(effectiveChar(fiche, 'intelligence')));
    expect(bourseOf(banc.getState().party.find((h) => h.id === ph.targetId)!).silver).toBe(10);
    banc.getState().jetLancer('soins');
    expect(bourseOf(banc.getState().party.find((h) => h.id === ph.targetId)!).silver).toBe(5); // 10 − 5 pistoles débitées au lancer, à la bourse du patient
    banc.getState().jetValider('soins');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().medic).not.toBeNull(); // l'infirmerie reste ouverte (autre acte/patient)
    banc.getState().fenetreFermer('infirmerie');
  });

  it('PORTE : un soigneur sans fiche de Guérison n’ouvre AUCUNE infirmerie — rien à lire, rien à inventer (L2 #1548)', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: INFIRMERIE, battle: null, pendingHeal: null, medic: null });
    // `fidele` est un figurant : sa fiche ne porte aucune Guérison.
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'fidele' } }]);
    expect(banc.getState().medic).toBeNull();
    // Entité inexistante : même refus ; la validation d'atelier la nomme par le parse (`validateScene.test.ts`).
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'chirurgien-fantome' } }]);
    expect(banc.getState().medic).toBeNull();
    // La validation d'ATELIER voit ce que voit le runtime : elle résout la FICHE (même `sceneNpc`).
    const ctx = { sceneIds: new Set<string>(), entityIds: new Set(INFIRMERIE.entities.map((e) => e.id)), npcSheet: (id: string) => sceneNpc(INFIRMERIE, id, presetPnjById), within: () => true, walkable: () => true };
    expect(EFFECT_HANDLERS.medicalAid.refs!({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }, ctx)).toEqual([]);
    // Entité EXISTANTE mais sans Guérison : l'atelier la nomme, elle aussi — la porte n'est plus aveugle.
    const sansSoin = EFFECT_HANDLERS.medicalAid.refs!({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'fidele' } }, ctx);
    expect(sansSoin.map((i) => i.level)).toEqual(['error']);
    expect(sansSoin[0].message).toContain('fidele');
    expect(sansSoin[0].message).toContain('Guérison');
  });

  it('le NOM affiché est celui de l’ENTITÉ, la VALEUR celle de la fiche (L2 #1548)', () => {
    // #1709 : la fiche donne les valeurs, l'entité donne le nom.
    const GUERISON = 60;
    const infirmerie: Scene = {
      ...emptyScene('scene-test', 8, 8),
      id: 'fixture-infirmerie',
      entities: [{
        id: 'soigneur', kind: 'personnage', pos: { x: 1, y: 1 }, label: 'Prêtre',
        statblock: { type: 'statblock', label: 'Prêtre de Sigmar', char: { intelligence: 40 }, skills: [{ id: 'guerison', value: GUERISON }] },
      } as SceneEntity],
    };
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: infirmerie, battle: null, pendingHeal: null, medic: null });
    creditBourse(banc.getState, banc.setState, party[1].id, { gold: 0, silver: 5, brass: 0 }); // l'acte tarifé s'offre
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures', cost: { silver: 5 } }], entityId: { id: 'soigneur' } }]);
    const m = banc.getState().medic!;
    expect(m.npc!.id).toBe('soigneur');
    expect(m.npc!.label).toBe('Prêtre'); // le nom de l'ENTITÉ, pas celui de la fiche
    expect(m.npc!.skill.value).toBe(GUERISON); // la valeur de la FICHE, que l'effet ne porte pas
    banc.getState().fenetreFermer('infirmerie');
  });

  it('le JOUEUR choisit le patient dans l’infirmerie (choix `infirmerie.patient`)', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[0].wounds = { ...party[0].wounds, current: party[0].wounds.current - 3 };
    party[2].wounds = { ...party[2].wounds, current: party[2].wounds.current - 8 };
    banc.setState({ party, scene: INFIRMERIE, battle: null, pendingHeal: null, medic: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }]);
    banc.getState().fenetreChoisir('infirmerie', 'patient', party[2].id);
    expect(banc.getState().medic!.patientId).toBe(party[2].id);
    banc.getState().fenetreFermer('infirmerie');
  });

  it('sans patient pertinent, aucun acte ne s’offre (pas de brouillon, pas de jet)', () => {
    banc.setState({ party: groupeVitrineDeScenario(idsDeTest), scene: INFIRMERIE, battle: null, pendingHeal: null, medic: null }); // groupe au max de PB
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }]);
    expect(banc.getState().pendingHeal).toBeNull();
    banc.getState().fenetreFermer('infirmerie');
  });
});
