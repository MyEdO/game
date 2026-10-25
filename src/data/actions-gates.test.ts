/** #2968 */
import { describe, expect, it } from 'vitest';
import actions from './actions.json';
import { z } from 'zod';
import { validateDataset, noeudObjet, noeudDuChamp, chargeDiscriminee, brouillonNeuf } from './schemas/validate';
import { schema } from './schemas/defs/actions';
import { ACTION_GATES } from '../noyau/actionRegistry';
import { MODES_DE_CIBLAGE } from '../noyau/targetingModes';
import { modeDeCiblageSchema, modeArmableSchema } from './schemas/_domaines.generated';
import { inferFields } from '../ui/compendium/editFields';

describe('gates des actions', () => {
  it('initialise le discriminant des brouillons depuis son schéma pour les partitions simples et composées', () => {
    for (const [file, champ] of [['materials.json', 'domain'], ['actions.json', 'surface']]) {
      const brouillon = brouillonNeuf(file);
      const noeud = noeudDuChamp(file, champ) as z.ZodType;
      expect(noeud.safeParse(brouillon[champ]).success).toBe(true);
      expect(chargeDiscriminee(file, brouillon)?.champ).toBe(champ);
    }
    expect(brouillonNeuf('materials.json')).toEqual({ domain: 'prop' });
    expect(brouillonNeuf('actions.json')).toEqual({ surface: 'deduite-du-set' });
  });

  it('compose les charges indépendantes de surface et de dispatcher, avec leurs valeurs par défaut', () => {
    const charge = (surface?: string, run?: string) => chargeDiscriminee('actions.json', { surface, run })!;
    expect(charge('interlude', 'battleToggleStance').duCas.slice().sort()).toEqual(['exitSafe', 'role', 'stance']);
    expect(charge('geste-secondaire', 'battleToggleStance').duCas.slice().sort()).toEqual(['hote', 'stance']);
    expect(charge('grille', 'battleToggleStance').duCas).toEqual(['stance']);
    expect(charge('interlude', 'inconnu').duCas.slice().sort()).toEqual(['exitSafe', 'role']);
    expect(charge('interlude').duCas.slice().sort()).toEqual(['exitSafe', 'role']);
    expect(charge('inconnue', 'inconnu').duCas).toEqual([]);
    expect(charge('interlude', 'toString').duCas.slice().sort()).toEqual(['exitSafe', 'role']);
    expect(charge().duCas).toEqual([]);
    expect(charge().toutes.slice().sort()).toEqual(['exitSafe', 'hote', 'role', 'stance']);
  });

  it('conserve les refus de charge des actions', () => {
    const simple = actions.find((a) => a.surface === 'grille')!;
    expect(simple).toBeTruthy();
    for (const extra of [{ stance: 'heldGround' }, { hote: 'cast-spell' }, { exitSafe: true }, { role: 'renonce' }])
      expect(validateDataset('actions.json', [{ ...simple, ...extra }])).not.toBeNull();
    const posture = actions.find((a) => a.run === 'battleToggleStance')!;
    expect(posture).toBeTruthy();
    const sansPosture = { ...posture } as Record<string, unknown>;
    delete sansPosture.stance;
    expect(validateDataset('actions.json', [sansPosture])).not.toBeNull();
  });
  it('ferme les modes et les valeurs armables depuis leur registre propriétaire', () => {
    const modes = Object.entries(MODES_DE_CIBLAGE);
    expect(new Set(modeDeCiblageSchema.options)).toEqual(new Set(modes.map(([id]) => id)));
    expect(modeDeCiblageSchema.meta()?.valeurs).toEqual(Object.fromEntries(modes.map(([id, mode]) => [id, mode.label])));
    expect(new Set(modeArmableSchema.options)).toEqual(new Set(modes.filter(([, mode]) => 'armable' in mode && mode.armable).map(([id]) => id)));
    expect(modeDeCiblageSchema.safeParse('mode-inconnu').success).toBe(false);
    expect(modeArmableSchema.safeParse('attack').success).toBe(false);
    for (const champ of ['mode', 'armed']) {
      expect(validateDataset('actions.json', [{ ...actions[0], [champ]: 'mode-inconnu' }])).not.toBeNull();
    }
  });

  it('valide toutes les actions du corpus réel', () => {
    expect(validateDataset('actions.json', actions)).toBeNull();
  });

  it.each([{ gate: 'gate-inconnue' }, { gate: ['toujours', 'gate-inconnue'] }])('refuse une gate inconnue : %j', ({ gate }) => {
    expect(validateDataset('actions.json', [{ ...actions[0], gate }])).not.toBeNull();
  });

  it('expose des choix nommés pour la gate simple et chaque gate composée', () => {
    const objet = noeudObjet(schema) as z.ZodObject;
    const gate = objet.shape.gate;
    expect(gate).toBeInstanceOf(z.ZodUnion);
    const [simple, composee] = (gate as z.ZodUnion).options;
    expect(simple).toBeInstanceOf(z.ZodEnum);
    expect((composee as z.ZodArray).element).toBe(simple);
    const attendus = Object.fromEntries(Object.entries(ACTION_GATES).map(([id, gate]) => [id, gate.label]));
    expect((simple as z.ZodEnum).meta()?.valeurs).toEqual(attendus);
    expect(new Set((simple as z.ZodEnum).options)).toEqual(new Set(Object.keys(attendus)));
    const champ = inferFields([{ gate: 'toujours' }], { noeud: z.object({ gate: simple as z.ZodEnum }) }).find((f) => f.key === 'gate');
    expect(champ?.kind).toBe('select');
    expect(champ?.valeurs).toEqual(attendus);
    expect(validateDataset('actions.json', [{ ...actions[0], gate: ['toujours'] }])).not.toBeNull();
  });
});
