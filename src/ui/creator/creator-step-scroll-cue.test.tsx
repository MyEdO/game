// @vitest-environment jsdom
/**
 * #535 — verrouille l'ANCRAGE structurel + CSS du cue de bord de rail scrollable (convention
 * `docs/charte-ui.md` § « Cue de bord de rail scrollable ») : le sélecteur canonique
 * `.creator-step > .master-detail-list::before/::after` (`src/ui/styles/creator.css`) doit
 * ATTEINDRE un vrai conteneur `overflow-y` (jamais un wrapper `display: contents` des slots
 * de l'ossature, `creator-step.css`, `.creator-step-action`/`.creator-step-choice`/`.creator-step-desc`) et le pseudo doit rester à sa hauteur DÉCLARÉE
 * (`flex-shrink: 0` — sans lui, un rail flex-column très en overflow écrase le pseudo à 0,
 * régression mesurée en recette navigateur #535).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreatorStepFrame } from './CreatorStepFrame';
import { newDraft, withSpecies, withCareer } from './draft';
import { species as allSpecies, careersForSpecies } from '../../data';

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
const ready = () => withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);

// `new URL(rel, import.meta.url)` est détourné par l'implémentation URL de jsdom (base du document) :
// la résolution passe par le chemin du module.
const HERE = dirname(fileURLToPath(import.meta.url));
const CREATOR_CSS = readFileSync(join(HERE, '..', 'styles', 'creator.css'), 'utf8');

describe('CreatorStepFrame — cue de bord de rail scrollable (#535)', () => {
  it("le rail scrollable RÉEL est `.master-detail-list` — jamais un slot `display:contents` de l'ossature", () => {
    const html = renderToStaticMarkup(
      <CreatorStepFrame d={ready()} step={0} zones={{ action: <div>action</div>, choice: <div>choice</div> }} />,
    );
    const host = document.createElement('div');
    host.innerHTML = html;
    const step = host.querySelector('.creator-step')!;
    expect(step).toBeTruthy();
    const rail = step.querySelector(':scope > .master-detail-list');
    expect(rail, "`.creator-step > .master-detail-list` introuvable — le sélecteur CSS du cue de bord n'atteint plus le rail réel").toBeTruthy();
    // Les slots de l'ossature (`.creator-step-action`/`.creator-step-choice`) sont `display:contents`
    // (creator-step.css) : ils ne doivent JAMAIS être le conteneur ciblé par le cue (pseudo invisible
    // sur un élément sans boîte).
    expect(rail!.className).not.toMatch(/creator-step-(action|choice|desc)/);
  });

  it('cue posé : `flex-shrink: 0` sur `.creator-step > .master-detail-list::before`/`::after` (sinon écrasé à 0 en overflow, #535)', () => {
    // jsdom ne calcule PAS de layout réel (`getComputedStyle` sur un pseudo-élément n'y est pas
    // fiable, confirmé en recette #535) — verrouille la déclaration SOURCE, la preuve de layout
    // réelle vit dans la recette navigateur (mesurée : `height` calculée passe de 0px à 20px).
    const cueBlock = CREATOR_CSS.match(/\.creator-step > \.master-detail-list::before,\s*\n\.creator-step > \.master-detail-list::after \{[^}]*\}/);
    expect(cueBlock, "règle `.creator-step > .master-detail-list::before/::after` introuvable dans creator.css").toBeTruthy();
    expect(cueBlock![0]).toMatch(/flex-shrink:\s*0/);
  });
});
