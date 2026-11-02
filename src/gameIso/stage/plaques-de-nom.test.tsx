// @vitest-environment jsdom
/**
 * PLAQUES DE NOM (#1687 lot 3-II-b) — le NOM des utilisables que la frame montre. Le peintre
 * (`stage/PlaquesDeNom`) est le SECOND lecteur de la liste des halos : ce qu'il peint se déduit du
 * MÊME `etat` et du MÊME `visible`, sans rien re-décider.
 *
 * Et la MATIÈRE du nom est celle du Codex : `CodexTitre` est la définition unique des spans de titre,
 * portée ici ET par le popover de `CodexRef` — la parité se mesure, elle ne se promet pas.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaquesDeNom } from './PlaquesDeNom';
import { CodexTitre } from '../../ui/compendium/CodexRef';
import type { InteractHalo } from '../builders/interactHalos';
import type { Dims } from '../../geometry/iso';
import type { WalkPos } from '../fx/walkPose';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DIMS: Dims = { w: 10, h: 10, rot: 0, view: 'iso' };
const SANS_RELIEF = () => 0;
/** Position VISUELLE d'un porteur immobile : sa case (aucun glissement de marche). */
const IMMOBILE = (): WalkPos => (_id, x, y) => ({ x, y, walking: false });

const halo = (id: string, extra: Partial<InteractHalo> = {}): InteractHalo => ({
  id,
  cell: { x: 3, y: 4, z: 0 },
  n: 1,
  scaleK: 1,
 
  label: `Nom de ${id}`,
  span: { w: 1, h: 1 },
  centre: { x: 3, y: 4 },
  echelle: { x: 1, y: 1 },
  etat: 'revele',
  visible: true,
  ...extra,
});

let root: Root | null = null;
let hote: HTMLDivElement | null = null;

function peindre(halos: readonly InteractHalo[]): SVGSVGElement {
  hote = document.createElement('div');
  document.body.appendChild(hote);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hote.appendChild(svg);
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);
  root = createRoot(g);
  act(() => root!.render(
    <PlaquesDeNom halos={halos} dims={DIMS} liftAt={SANS_RELIEF} pions={false} walkPosAt={IMMOBILE} />,
  ));
  return svg;
}

const plaques = (svg: SVGSVGElement): Element[] => [...svg.querySelectorAll('[data-plaque-nom]')];

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hote) { hote.remove(); hote = null; }
});

describe('Plaques de nom — une par utilisable MONTRÉ (#1687)', () => {
  it('la RÉVÉLATION nomme tous les révélés ; le texte est le LABEL, jamais l’id', () => {
    const svg = peindre([halo('coffre'), halo('marchand', { cell: { x: 7, y: 2, z: 0 }, centre: { x: 7, y: 2 } })]);
    expect(plaques(svg)).toHaveLength(2);
    expect(plaques(svg).map((p) => p.textContent)).toEqual(['Nom de coffre', 'Nom de marchand']);
    expect(plaques(svg)[0].querySelector('.codex-pop-title'), 'la matière de nom du Codex').not.toBeNull();
  });

  it('MUET = aucune plaque ; le SURVOLÉ en porte une, lui seul', () => {
    const muets = peindre([halo('coffre', { etat: 'muet' }), halo('tonneau', { etat: 'muet' })]);
    expect(plaques(muets), 'sans Alt ni survol, rien ne se nomme').toHaveLength(0);
    act(() => root!.unmount());
    root = null;
    hote!.remove();
    const survol = peindre([halo('coffre', { etat: 'survole' }), halo('tonneau', { etat: 'muet' })]);
    expect(plaques(survol).map((p) => p.getAttribute('data-plaque-nom'))).toEqual(['coffre']);
  });

  it('une entité SANS libellé ne porte pas de plaque vide', () => {
    const svg = peindre([halo('anonyme', { label: undefined })]);
    expect(plaques(svg)).toHaveLength(0);
  });

  it('une plaque n’est JAMAIS une cible : le monde dessous reste cliquable', () => {
    const svg = peindre([halo('coffre')]);
    const plaque = plaques(svg)[0] as SVGGElement;
    expect(plaque.getAttribute('pointer-events')).toBe('none');
    expect(plaque.querySelector('.plaque-nom'), 'la boîte porte la classe qui neutralise le pointeur').not.toBeNull();
  });
});

describe('Parité du chrome de nom — UNE définition (#1687)', () => {
  it('le titre du peintre et celui du popover du Codex sortent des MÊMES classes', () => {
    const svg = peindre([halo('coffre')]);
    const dansLeMonde = plaques(svg)[0].querySelector('.codex-pop-title')!.textContent;

    const boite = document.createElement('div');
    document.body.appendChild(boite);
    const r2 = createRoot(boite);
    act(() => r2.render(<CodexTitre title="Nom de coffre" sub="tonneau" />));
    expect(boite.querySelector('.codex-pop-title')!.textContent).toBe(dansLeMonde);
    expect(boite.querySelector('.codex-pop-sub')!.textContent, 'et le sous-titre du nom d’instance').toBe('tonneau');
    act(() => r2.unmount());
    boite.remove();
  });
});
