import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogDrawer } from './LogDrawer';
import { iconSvg } from './Icon';
import { ev } from '../state/combatLog';

const COMBATANTS = [
  { id: 'h1', label: 'Gunnar', kind: 'hero' },
  { id: 'e1', label: 'Brigand', kind: 'enemy' },
];

describe('LogDrawer', () => {
  it('replié par défaut : seulement le bouton journal', () => {
    const html = renderToStaticMarkup(<LogDrawer battle={null} journal={['Vous entrez dans la taverne.']} />);
    expect(html).toContain(iconSvg('nav/compendium'));
    expect(html).not.toContain('taverne');
  });

  it('ouvert en exploration : lignes du journal du groupe', () => {
    const html = renderToStaticMarkup(<LogDrawer battle={null} journal={['Vous entrez dans la taverne.']} initialOpen />);
    expect(html).toContain('taverne');
  });
  it('le journal libre rend le Markdown dans un bloc valide', () => {
    const html = renderToStaticMarkup(<LogDrawer battle={null} journal={['**Le groupe** entre.\n\n- Une porte']} initialOpen />);
    expect(html).toContain('<strong>Le groupe</strong>');
    expect(html).toContain('<li>Une porte</li>');
    expect(html).not.toContain('**Le groupe**');
    expect(html).not.toMatch(/<p[^>]*>\s*<div/);
  });

  it('ouvert en combat : événements narrés (icône par kind, nom coloré par camp)', () => {
    const battle = { log: [ev('attack', 'Gunnar attaque Brigand', 'h1', 'e1')], combatants: COMBATANTS };
    const html = renderToStaticMarkup(<LogDrawer battle={battle} journal={[]} initialOpen />);
    expect(html).toContain(iconSvg('action/attack')); // icône du kind attack
    expect(html).toContain('Gunnar');
    expect(html).toContain('nm-ally'); // nom allié coloré par camp
  });
});
