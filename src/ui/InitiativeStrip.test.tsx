import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InitiativeStrip, initiativePhase } from './InitiativeStrip';
import { CHAR_SIZE_PX } from './PortraitTile';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

function fixtures() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
  h.id = 'h1';
  h.initiative = 42;
  const foe = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brigand', seed: 5 }), id: 'e1', kind: 'enemy' as Combatant['kind'], initiative: 31 };
  return { h, foe };
}
const noop = () => {};
/** Interrupteur de pause de Round (pied de frise) : les contrats existants n'en dépendent pas. */
const HAND = { label: 'Pause', ariaLabel: 'Pause au prochain Round', raised: false, onToggle: noop };

describe('InitiativeStrip', () => {
  it('rend les tuiles dans l’ordre de battle.order et marque l’actif', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={3} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html.indexOf('Brigand')).toBeGreaterThan(-1);
    expect(html.indexOf('Brigand')).toBeLessThan(html.indexOf('Gunnar'));
    expect(html).toContain('Round 3');
    expect(html.match(/aria-current="step"/g)?.length).toBe(1);
    expect(html.match(/▼/g)?.length).toBe(1);
  });

  // Le cartouche de Round est la TÊTE de la piste : premier enfant de `.is-tiles`, donc premier dans
  // l'ordre de défilement — qu'elle défile en colonne ou en bande horizontale. Posé hors de la piste
  // (ou après les entrées), il cesserait d'être la tête que le collage garde à l'écran. Que le
  // collage TIENNE se mesure au navigateur (`scripts/recette/hud-clickables.mjs`).
  it('le cartouche de Round est le PREMIER enfant de la piste', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={3} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).toMatch(/<div class="is-tiles"><div class="is-round">Round 3<\/div>/);
  });

  // La piste ARRONDIT sa hauteur au PAS d'entrée : ce pas est CONSTANT, l'entrée au trait comprise.
  // La mise en évidence de l'unité au trait est donc un `transform` (portrait-tile.css) et non une
  // boîte plus grande : la tuile garde le côté NOMINAL de sa taille. Que la colonne s'arrête bien
  // sur une entrée entière se mesure au navigateur (`hud-clickables.mjs`, verdict « l'entrée du pied
  // déborde la zone utile »).
  it('l’entrée AU TRAIT garde la boîte des autres (le pas ne bouge pas)', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={3} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    const cotes = [...html.matchAll(/--ptile-px:(\d+)px/g)].map((m) => m[1]);
    expect(cotes.length).toBe(2);
    expect(new Set(cotes).size, `deux côtés différents dans la frise : ${cotes.join(', ')}`).toBe(1);
    expect(cotes[0]).toBe(String(CHAR_SIZE_PX.sm));
  });

  // Spec HUD combat §1c-bis : une entrée de frise = vignette + liseré de camp (+ à la pause son
  // score, sa pointe, sa pastille). Ni Blessures, ni nom imprimé, ni États — ils vivent au bandeau
  // de groupe et à l'arche de la console.
  it('n’imprime ni Blessures, ni États, ni nom dans une entrée', () => {
    const { h, foe } = fixtures();
    h.wounds = { current: 7, max: 11 };
    h.conditions = [{ id: 'assourdi', value: 1 }];
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={2} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).not.toContain('ptile-gauge');
    expect(html).not.toContain('7/11');
    expect(html).not.toContain('pt-state');
    // Le nom reste en title/aria-label (a11y), jamais en texte imprimé.
    expect(html).toContain('title="Gunnar"');
    expect(html.replace(/<[^>]*>/g, ' ')).not.toContain('Gunnar');
  });

  it.each([
    { index: 0, turn: 1, over: false, want: 'past' },
    { index: 1, turn: 1, over: false, want: 'current' },
    { index: 2, turn: 1, over: false, want: 'future' },
    { index: 0, turn: -1, over: false, want: 'future' },
    { index: 1, turn: 1, over: true, want: 'future' },
  ] as const)('classe la position $index comme $want', ({ index, turn, over, want }) => {
    expect(initiativePhase(index, turn, over)).toBe(want);
  });

  it('classe un renfort ajouté après l’index courant comme futur', () => {
    const { h, foe } = fixtures();
    const reinforcement = { ...foe, id: 'e2', label: 'Renfort' };
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1', 'e2']} turn={1} round={2} combatants={[h, foe, reinforcement]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).toMatch(/data-phase="future"[^>]*>.*Renfort/s);
  });

  it('badge de score d’Initiative rendu pour héros ET ennemis', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={-1} round={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).toContain('is-score');
    expect(html).toContain('42');
    expect(html).toContain('31');
  });

  it('badge de score d’Initiative absent une fois le combat engagé (#205)', () => {
    const { h, foe } = fixtures();
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={1} round={1} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).not.toContain('is-score');
  });

  it('pause de début de Round : badge de pré-emption (is-first) sur les héros éligibles', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).toContain('is-first');
    expect(html).not.toContain('is-first free');
  });

  it('badge gratuit (arme Rapide) : variante .free, sans coût en Chance affiché', () => {
    const { h, foe } = fixtures();
    h.fortune = 2;
    const html = renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={0} round={1} combatants={[h, foe]} over={false}
        canFirstIds={['h1']} freeFirstIds={['h1']} onActivate={noop} onPromote={noop} hand={HAND} />,
    );
    expect(html).toContain('is-first free');
  });

  // Design 2026-07-31 §5 : le contraste d'une entrée `future` est le contraste normal — aucune
  // feuille de style de l'app ne doit l'atténuer (opacité < 1, ou désaturation/luminosité).
  it('aucun style n’atténue une entrée d’initiative future', () => {
    const feuilles = readCorpus(['src/ui/styles'], { exts: ['.css'] });
    expect(feuilles.length).toBeGreaterThan(0);

    const fautes: string[] = [];
    for (const { rel, text } of feuilles) {
      for (const m of text.matchAll(/([^{}]*\[data-phase\s*=\s*['"]?future['"]?\][^{}]*)\{([^}]*)\}/g)) {
        const [selecteur, corps] = [m[1].trim().split('\n').pop()!.trim(), m[2]];
        const op = corps.match(/opacity\s*:\s*([\d.]+)/);
        if (op && Number(op[1]) < 1) fautes.push(`${rel}: ${selecteur} { opacity: ${op[1]} }`);
        const filtre = corps.match(/filter\s*:\s*([^;]+)/);
        if (filtre && !/^none$/i.test(filtre[1].trim())) fautes.push(`${rel}: ${selecteur} { filter: ${filtre[1].trim()} }`);
      }
    }
    expect(fautes, `Entrées futures atténuées :\n${fautes.join('\n')}`).toEqual([]);
  });
});

/**
 * PIED DE FRISE — l'interrupteur « pause au prochain Round » (#1411 P2-A). `raise-hand` était une
 * entrée du registre SANS surface : posée, la demande ne pouvait plus être retirée avant la pause
 * suivante. Elle vit ici (c'est l'enchaînement des Rounds qu'elle suspend), en interrupteur, avec un
 * refus VISIBLE quand le geste n'est pas offert (hors coop).
 */
describe('InitiativeStrip — interrupteur de pause de Round', () => {
  const rendu = (hand: Partial<Parameters<typeof InitiativeStrip>[0]['hand']> = {}) => {
    const { h, foe } = fixtures();
    return renderToStaticMarkup(
      <InitiativeStrip order={['e1', 'h1']} turn={-1} round={2} combatants={[h, foe]} over={false}
        canFirstIds={[]} onActivate={noop} onPromote={noop} hand={{ ...HAND, ...hand }} />,
    );
  };

  it('la frise PORTE l’entrée du registre (c’est SA surface, au même marqueur que la console)', () => {
    expect(rendu()).toContain('data-action="raise-hand"');
  });

  it('OFFERT : le geste est cliquable et se nomme', () => {
    const html = rendu({ ariaLabel: 'Pause au prochain Round' });
    expect(html).toContain('aria-label="Pause au prochain Round"');
    expect(html).not.toContain('disabled');
  });

  it('DEMANDE POSÉE : l’état est visible sur la frise (tous les clients la voient)', () => {
    const html = rendu({ raised: true, label: 'Pause demandée', ariaLabel: 'Pause au prochain Round : retirer la demande' });
    expect(html).toContain('data-raised');
    expect(html).toContain('retirer la demande');
  });

  it('REFUSÉ (hors coop) : la commande reste DESSINÉE, inerte, et DIT pourquoi', () => {
    const html = rendu({ reason: 'partie locale' });
    expect(html).toContain('disabled');
    expect(html).toContain('partie locale');
    expect(html, 'la raison doit être liée au bouton (a11y), jamais un title muet').toContain('aria-describedby="raise-hand-reason"');
  });
});
