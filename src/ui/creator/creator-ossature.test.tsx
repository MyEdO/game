import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepBody } from './CharacterCreator';
import { newDraft, withSpecies, withCareer, stepIds } from '../../noyau/creation/brouillon';
import { species as allSpecies, careersForSpecies } from '../../data';

/**
 * GARDE STRUCTURELLE de l'OSSATURE (lot « ossature enforcée » #393, croquis user 2026-07-15) :
 * le format canonique 2 zones — bande d'ACTION en tête de la zone de CHOIX + zone DESC (fiche) —
 * est encodé dans `CreatorStepFrame` comme des SLOTS OBLIGATOIRES, estampillés
 * `data-testid="creator-slot-*"` par le gabarit SEUL. Ce test monte CHAQUE étape (source unique
 * `stepIds()` × `STEP_META`, via le dispatcher réel `StepBody` — aucun double dispatch) et vérifie
 * la présence des trois slots : le format ne peut plus régresser silencieusement, écran par écran.
 *
 * EXEMPTION UNIQUE : l'étape Présentation garde son gabarit dédié 3 colonnes (user 2026-07-15,
 * verbatim : « le format des écrans n'est pas bon, pourtant c'est sensé être le même sauf sur le
 * dernier écran » — le DERNIER écran est le seul hors format).
 */

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
/** Brouillon PRÊT (race + carrière posées) : chaque étape rend son contenu réel, pas son état vide. */
const ready = () => withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);

const SLOTS = ['action', 'choice', 'desc'] as const;
const count = (html: string, slot: (typeof SLOTS)[number]) => html.split(`data-testid="creator-slot-${slot}"`).length - 1;

describe('OSSATURE ENFORCÉE (#393) — les 8 étapes montent les slots du gabarit', () => {
  const ids = stepIds();

  it('couvre bien TOUTES les étapes du parcours (source unique stepIds)', () => {
    // 8 étapes avec la règle optionnelle « signe astral » active (défaut) — si une étape
    // apparaît/disparaît, la boucle ci-dessous la suit automatiquement.
    expect(ids.length).toBeGreaterThanOrEqual(7);
    expect(ids[ids.length - 1]).toBe('presentation');
  });

  for (const id of stepIds()) {
    if (id === 'presentation') {
      it('étape « presentation » — EXEMPTÉE (gabarit dédié, user 2026-07-15 « sauf sur le dernier écran »)', () => {
        const html = renderToStaticMarkup(<StepBody id={id} step={ids.indexOf(id)} d={ready()} setD={() => {}} />);
        expect(html).toContain('creator-presentation-screen'); // son gabarit propre rend bien
        for (const slot of SLOTS) expect(count(html, slot)).toBe(0); // et n'imite PAS les slots
      });
      continue;
    }
    it(`étape « ${id} » — bande d'ACTION + CHOIX + DESC présents, une seule fois chacun`, () => {
      const html = renderToStaticMarkup(<StepBody id={id} step={ids.indexOf(id)} d={ready()} setD={() => {}} />);
      for (const slot of SLOTS) {
        expect(count(html, slot), `slot « ${slot} » de l'étape ${id}`).toBe(1);
      }
      // L'ossature est UN gabarit (jamais deux frames imbriqués) et la bande d'action précède le choix.
      expect(html.indexOf('data-testid="creator-slot-action"')).toBeLessThan(html.indexOf('data-testid="creator-slot-choice"'));
    });
  }
});
