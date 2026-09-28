import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { END_STATE_VISUAL } from './endStateVisual';
import { PortraitTile } from './PortraitTile';
import { TokenChromeMarks } from '../gameIso/TokenChromeMarks';
import { iconSvg } from './Icon';
import { createHero } from '../engine/character';
import type { EndState } from '../engine/conditions';
import type { Combatant } from '../engine/types';

const ALL: EndState[] = ['mort', 'inconscient', 'rendu', 'hors-combat'];

const mkForState = (es: EndState): Combatant => {
  const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
  if (es === 'mort') c.dead = true;
  if (es === 'inconscient') c.conditions = [{ id: 'inconscient', value: 1 }] as Combatant['conditions'];
  if (es === 'rendu') { c.outOfRencontre = true; c.exitReason = 'reddition'; }
  if (es === 'hors-combat') { c.outOfRencontre = true; c.exitReason = 'destin'; }
  return c;
};

describe('Langage visuel des états de fin (#237) — 4 états, 4 rendus DISTINCTS', () => {
  it('la table END_STATE_VISUAL a une icône ET une classe UNIQUES par état', () => {
    const icons = ALL.map((s) => END_STATE_VISUAL[s].icon);
    const classes = ALL.map((s) => END_STATE_VISUAL[s].className);
    expect(new Set(icons).size).toBe(4);
    expect(new Set(classes).size).toBe(4);
  });

  it('chaque icône du langage existe au registre', () => {
    for (const s of ALL) expect(iconSvg(END_STATE_VISUAL[s].icon)).toBeTruthy();
  });

  it('portrait (PortraitTile) : chaque état rend SA classe et SON icône', () => {
    const seenClass = new Set<string>();
    const seenIcon = new Set<string>();
    for (const s of ALL) {
      const html = renderToStaticMarkup(createElement(PortraitTile, { c: mkForState(s), ring: '#c0392b' }));
      const v = END_STATE_VISUAL[s];
      expect(html).toContain(v.className);
      expect(html).toContain(iconSvg(v.icon));
      seenClass.add(v.className);
      seenIcon.add(iconSvg(v.icon));
    }
    expect(seenClass.size).toBe(4);
    expect(seenIcon.size).toBe(4);
  });

  it('jeton de carte (TokenChromeMarks) : chaque état rend token-endmark + SA classe et SON icône', () => {
    for (const s of ALL) {
      const html = renderToStaticMarkup(
        createElement(TokenChromeMarks, { endState: s, badgeY: -30 }),
      );
      const v = END_STATE_VISUAL[s];
      expect(html).toContain('token-endmark');
      expect(html).toContain(v.className);
      expect(html).toContain(iconSvg(v.icon));
    }
  });

  it('jeton de carte sans état de fin : PAS de pastille', () => {
    const html = renderToStaticMarkup(
      createElement(TokenChromeMarks, { hp: { current: 4, max: 4 }, badgeY: -30 }),
    );
    expect(html).not.toContain('token-endmark');
  });
});
