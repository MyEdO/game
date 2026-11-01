// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortraitTile } from './PortraitTile';
import { iconSvg } from './Icon';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { teamRingDecor } from '../gameIso/builders/dynamicMarks';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

const base = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
const css = ['portrait-tile', 'initiative-strip'].map((nom) => readFileSync(`src/ui/styles/${nom}.css`, 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

describe('PortraitTile', () => {
  it('jauge HORIZONTALE : pleine et verte à PV max', () => {
    const c = base();
    c.wounds = blessuresDeBase(12, 12, c);
    const html = renderToStaticMarkup(<PortraitTile c={c} />);
    expect(html).toContain('ptile-gauge');
    expect(html).toContain('--life-pct:100%'); // barre horizontale (largeur = ratio), plus de hauteur
    expect(html).toContain('--life-color:#2ecc71'); // hpColor(1) — vert sain
  });

  it('jauge rouge en zone critique (≤34 %)', () => {
    const c = base();
    c.wounds = blessuresDeBase(12, 3, c); // ratio 0.25
    const html = renderToStaticMarkup(<PortraitTile c={c} />);
    expect(html).toContain('--life-pct:25%');
    expect(html).toContain('--life-color:#e74c3c'); // hpColor critique
  });

  it('PV chiffrés : héros à partir de md ; jamais en sm ni pour un ennemi (jauge seule)', () => {
    const c = base();
    c.wounds = blessuresDeBase(11, 11, c);
    const heroMd = renderToStaticMarkup(<PortraitTile c={c} size="md" />);
    expect(heroMd).toContain('life-bar__value');
    expect(heroMd).toContain('11/11');
    // sm (frise) : illisible → jauge seule
    expect(renderToStaticMarkup(<PortraitTile c={c} size="sm" />)).not.toContain('life-bar__value');
    // ennemi : PB exacts réservés à l'Inspection — ni cartouche, ni fuite par le title
    const foe = { ...base(), kind: 'enemy' } as Combatant;
    foe.wounds = blessuresDeBase(11, 9, foe);
    const foeMd = renderToStaticMarkup(<PortraitTile c={foe} size="md" />);
    expect(foeMd).not.toContain('life-bar__value');
    expect(foeMd).not.toContain('9/11');
  });

  it('variantes : vital = jauge sans états ; identity = portrait seul', () => {
    const c = base();
    c.conditions = [{ id: 'sonne', value: 1 }] as Combatant['conditions'];
    const vital = renderToStaticMarkup(<PortraitTile c={c} variant="vital" />);
    expect(vital).toContain('ptile-gauge');
    expect(vital).not.toContain('ptile-states');
    const identity = renderToStaticMarkup(<PortraitTile c={c} variant="identity" />);
    expect(identity).not.toContain('ptile-gauge');
    expect(identity).not.toContain('ptile-states');
  });

  it('fond d’équipe : classe team-ally / team-enemy selon `team`', () => {
    const c = base();
    expect(renderToStaticMarkup(<PortraitTile c={c} team="ally" />)).toContain('team-ally');
    expect(renderToStaticMarkup(<PortraitTile c={c} team="enemy" />)).toContain('team-enemy');
  });

  it('≤ 4 états visibles puis chevron ▾ (variante full)', () => {
    const c = base();
    c.conditions = [
      { id: 'sonne', value: 1 }, { id: 'a-terre', value: 1 }, { id: 'aveugle', value: 1 },
      { id: 'empoisonne', value: 2 }, { id: 'hemorragique', value: 1 },
    ] as Combatant['conditions'];
    const html = renderToStaticMarkup(<PortraitTile c={c} />);
    expect(html).toContain(iconSvg('condition/stunned')); // Sonné (sévérité max → 1er)
    expect(html).toContain('▾'); // 5 états → 4 + débordement
    expect(html).not.toContain(iconSvg('condition/bleeding')); // Hémorragique (sévérité min) débordé
    // 2 états → pas de chevron
    c.conditions = [{ id: 'sonne', value: 1 }, { id: 'a-terre', value: 1 }] as Combatant['conditions'];
    expect(renderToStaticMarkup(<PortraitTile c={c} />)).not.toContain('▾');
  });

  it('état de fin : mort = pastille end-mark es-mort nommée + icône crâne ; actif : classe active + caret ; selected : classe sel', () => {
    const c = base();
    c.dead = true;
    const dead = renderToStaticMarkup(<PortraitTile c={c} />);
    expect(dead).toContain('class="ptile-wrap" data-fin="mort"');
    // La pastille de fin, teinte propre à la MORT, nommée (a11y) et marquée du crâne.
    expect(dead).toMatch(/<span class="end-mark es-mort" title="Mort" aria-label="Mort">/);
    expect(dead).toContain(iconSvg('journal/death')); // crâne, pas une croix générique
    // un héros à 0 PB CONSCIENT reste À Terre (pas un état de fin) : aucune pastille
    const aterre = base();
    aterre.wounds = blessuresDeBase(12, 0, aterre);
    const html = renderToStaticMarkup(<PortraitTile c={aterre} />);
    expect(html).not.toContain('end-mark');
    const c2 = base();
    const act = renderToStaticMarkup(<PortraitTile c={c2} active />);
    expect(act).toContain('active');
    expect(act).toContain('▼');
    expect(renderToStaticMarkup(<PortraitTile c={c2} selected />)).toContain('sel');
  });

  it('état de fin : seuls anneau, jauge, nom et États sont atténués, la pastille garde sa teinte', () => {
    const mort = base();
    mort.dead = true;
    mort.conditions = [{ id: 'sonne', value: 1 }];
    const racine = document.createElement('div');
    racine.innerHTML = renderToStaticMarkup(<PortraitTile c={mort} />);
    const attenues = new Set<Element>();
    for (const regle of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!regle[1].includes('data-fin') || !/\b(?:opacity|filter)\s*:/.test(regle[2])) continue;
      for (const element of racine.querySelectorAll(regle[1].trim())) attenues.add(element);
    }
    expect([...attenues].map((el) => [...el.classList].find((classe) => classe.startsWith('ptile-'))).sort()).toEqual(['ptile-gauge', 'ptile-name', 'ptile-ring', 'ptile-states']);
    const pastille = racine.querySelector('.end-mark')!;
    expect([...attenues].some((el) => el.contains(pastille))).toBe(false);
  });

  it('l’actif garde la taille nominale de la carte et du nom à toutes les tranches', () => {
    const racine = document.createElement('div');
    racine.innerHTML = renderToStaticMarkup(<PortraitTile c={base()} active />);
    const nom = racine.querySelector('.ptile-name')!;
    const ancetresTransformes: string[] = [];
    for (const regle of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const transform = regle[2].match(/(?:^|[;\n])\s*transform\s*:\s*([^;]+)/)?.[1].trim();
      if (!regle[1].includes('.ptile') || !transform || transform === 'none') continue;
      if ([...racine.querySelectorAll(regle[1].trim())].some((el) => el.contains(nom))) ancetresTransformes.push(regle[1].trim());
    }
    expect(ancetresTransformes).toEqual([]);
  });

  it('le nom est visible dans la composition partagée, même si le geste porte un autre nom', () => {
    const c = base();
    const html = renderToStaticMarkup(<PortraitTile c={c} title="Retirer Gunnar" />);
    expect(html).toContain('aria-label="Retirer Gunnar"');
    expect(html.match(/<span class="[^"]*\bptile-name\b[^"]*">([^<]*)<\/span>/)?.[1]).toBe(c.label);
  });

  it('une tuile décorative laisse le nom et le geste à son contrôle', () => {
    const html = renderToStaticMarkup(<PortraitTile c={base()} decoratif />);
    expect(html).toContain('<span aria-hidden="true" class="ptile ');
    expect(html).not.toContain('ptile-name');
    expect(html).not.toContain('<button');
  });

  it('une identité passive reste nommée sans promettre un geste', () => {
    const html = renderToStaticMarkup(<PortraitTile c={base()} />);
    expect(html).toContain('<span title="Gunnar" aria-label="Gunnar"');
    expect(html).toContain('ptile-name');
    expect(html).not.toContain('<button');
    expect(renderToStaticMarkup(<PortraitTile c={base()} onClick={() => {}} />)).toContain('<button');
  });

  it('reprend la décoration reçue du repère de sol, couleur et pointillé compris', () => {
    const c = base();
    const ring = teamRingDecor(c, 2);
    const html = renderToStaticMarkup(<PortraitTile c={c} ring={ring} />);
    expect(html).toContain(`--ptile-ring:${ring.color}`);
    expect(html).toContain('stroke="var(--ptile-ring)"');
    const foe = { ...c, kind: 'enemy' } as Combatant;
    const enemyRing = teamRingDecor(foe);
    expect(renderToStaticMarkup(<PortraitTile c={foe} ring={enemyRing} />)).toContain(`stroke-dasharray="${enemyRing.dash}"`);
  });
});
