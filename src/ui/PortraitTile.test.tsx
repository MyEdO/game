import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortraitTile } from './PortraitTile';
import { iconSvg } from './Icon';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';

const base = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });

describe('PortraitTile', () => {
  it('jauge HORIZONTALE : pleine et verte à PV max', () => {
    const c = base();
    c.wounds = { current: 12, max: 12 };
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('ptile-gauge');
    expect(html).toContain('--life-pct:100%'); // barre horizontale (largeur = ratio), plus de hauteur
    expect(html).toContain('--life-color:#2ecc71'); // hpColor(1) — vert sain
  });

  it('jauge rouge en zone critique (≤34 %)', () => {
    const c = base();
    c.wounds = { current: 3, max: 12 }; // ratio 0.25
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('--life-pct:25%');
    expect(html).toContain('--life-color:#e74c3c'); // hpColor critique
  });

  it('PV chiffrés : héros à partir de md ; jamais en sm ni pour un ennemi (jauge seule)', () => {
    const c = base();
    c.wounds = { current: 11, max: 11 };
    const heroMd = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" size="md" />);
    expect(heroMd).toContain('life-bar__value');
    expect(heroMd).toContain('11/11');
    // sm (frise) : illisible → jauge seule
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" size="sm" />)).not.toContain('life-bar__value');
    // ennemi : PB exacts réservés à l'Inspection — ni cartouche, ni fuite par le title
    const foe = { ...base(), kind: 'enemy' } as Combatant;
    foe.wounds = { current: 9, max: 11 };
    const foeMd = renderToStaticMarkup(<PortraitTile c={foe} ring="#c0392b" size="md" />);
    expect(foeMd).not.toContain('life-bar__value');
    expect(foeMd).not.toContain('9/11');
  });

  it('variantes : vital = jauge sans états ; identity = portrait seul', () => {
    const c = base();
    c.conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions'];
    const vital = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" variant="vital" />);
    expect(vital).toContain('ptile-gauge');
    expect(vital).not.toContain('ptile-states');
    const identity = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" variant="identity" />);
    expect(identity).not.toContain('ptile-gauge');
    expect(identity).not.toContain('ptile-states');
  });

  it('fond d’équipe : classe team-ally / team-enemy selon `team`', () => {
    const c = base();
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" team="ally" />)).toContain('team-ally');
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#c0392b" team="enemy" />)).toContain('team-enemy');
  });

  it('≤ 4 états visibles puis chevron ▾ (variante full)', () => {
    const c = base();
    c.conditions = [
      { id: 'sonne', value: 1 }, { id: 'a-terre', value: 1 }, { id: 'aveugle', value: 1 },
      { id: 'empoisonne', value: 2 }, { id: 'hemorragique', value: 1 },
    ] as Combatant['conditions'];
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain(iconSvg('condition/stunned')); // Sonné (sévérité max → 1er)
    expect(html).toContain('▾'); // 5 états → 4 + débordement
    expect(html).not.toContain(iconSvg('condition/bleeding')); // Hémorragique (sévérité min) débordé
    // 2 états → pas de chevron
    c.conditions = [{ id: 'sonne', value: 1 }, { id: 'a-terre', value: 1 }] as Combatant['conditions'];
    expect(renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />)).not.toContain('▾');
  });

  it('état de fin : mort = classe ko es-mort + icône crâne ; actif : classe active + caret ; selected : classe sel', () => {
    const c = base();
    c.dead = true;
    const dead = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(dead).toContain('ko'); // grisé commun
    expect(dead).toContain('es-mort'); // teinte propre à la MORT
    expect(dead).toContain(iconSvg('journal/death')); // crâne, pas une croix générique
    // un héros à 0 PB CONSCIENT reste À Terre (pas un état de fin) : ni ko, ni pastille
    const aterre = base();
    aterre.wounds = { current: 0, max: 12 };
    const html = renderToStaticMarkup(<PortraitTile c={aterre} ring="#4f8fe0" />);
    expect(html).not.toContain('end-mark');
    expect(html).not.toContain(' ko ');
    const c2 = base();
    const act = renderToStaticMarkup(<PortraitTile c={c2} ring="#4f8fe0" active />);
    expect(act).toContain('active');
    expect(act).toContain('▼');
    expect(renderToStaticMarkup(<PortraitTile c={c2} ring="#4f8fe0" selected />)).toContain('sel');
  });

  it('le nom n’est JAMAIS rendu visible — il vit dans title/aria-label', () => {
    const c = base();
    const html = renderToStaticMarkup(<PortraitTile c={c} ring="#4f8fe0" />);
    expect(html).toContain('title="Gunnar"');
    expect(html).toContain('aria-label="Gunnar"');
    expect(html.replace(/(title|aria-label)="Gunnar"/g, '')).not.toContain('Gunnar');
  });
});
