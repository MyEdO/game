// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { DIR8_DELTA, type Dir8 } from '../../state/dir8';
import { TokenChromeOverlay } from './TokenChromeOverlay';
import { tokenChrome, type TokenChromeMark } from '../builders/tokenChrome';
import { combatantBodyTopFrac, combatantTokenScale } from '../sizeScale';
import { discCapPath, teamRingDecor } from '../builders/dynamicMarks';

/**
 * L'ABONNEMENT AU CAP EST PORTÉ PAR LE PION (#1176, P3-5c) — `store.facing` n'est LU que par le disque,
 * qui n'existe que sous le verdict `pionsEnDisques`. L'écriture d'un cap reforge la table entière à
 * chaque pas et à chaque attaque (`faceToward`/`faceFromPath`) : un abonnement porté par la surcouche
 * elle-même la rendrait à chaque pas, sur le plateau iso compris, où pas un pixel n'en dépend.
 *
 * La sonde COMPTE les rendus (un commit React, un `onRender` de `Profiler`) de part et d'autre d'une
 * écriture de cap, sous les deux régimes — le témoin positif est l'autre moitié du contrat : sous les
 * pions, le même geste DOIT re-rendre, et repeindre le triangle du cap. L'abonnement se fait à la CLÉ
 * DE CAP de la marque (`TokenChromeMark.capKey`) : l'id du jeton pour une chose postée.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', species: 'humains-reiklander', pos, size: 'moyenne',
    wounds: { current: 9, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** La marque d'un jeton posté, telle que le builder la dérive (`builders/tokenChrome`). */
function marque(c: Combatant): TokenChromeMark {
  return {
    id: c.id,
    capKey: c.id,
    cell: { x: c.pos!.x, y: c.pos!.y, z: 0 },
    n: 1,
    scaleK: combatantTokenScale(c),
    bodyTopFrac: combatantBodyTopFrac(c),
    team: teamRingDecor(c, 0),
    subject: { kind: 'combatant', combatant: c },
    ...tokenChrome(c, { ghostIds: new Set<string>(), hoveredId: null }),
  };
}

const H1 = hero('h1', { x: 3, y: 3 });
const dimsDe = (view: 'iso' | 'top'): Dims => ({ ...emptyScene(10, 10).dimensions, rot: 0, view, edge: false }) as Dims;

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;
let commits = 0;

/** Monte la SEULE surcouche sous le régime donné, et remet le compteur de rendus à zéro. */
function monter(pions: boolean): HTMLDivElement {
  useGame.setState({ facing: {} } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  commits = 0;
  act(() =>
    root!.render(
      <Profiler id="pions" onRender={() => { commits += 1; }}>
        <svg className="iso-stage">
          <TokenChromeOverlay
            chromes={[marque(H1)]}
            dims={dimsDe(pions ? 'top' : 'iso')}
            liftAt={() => 0}
            pions={pions}
            walkPosAt={() => (_id, x, y) => ({ x, y, walking: false })}
          />
        </svg>
      </Profiler>,
    ),
  );
  const monté = commits;
  expect(monté, 'le montage compte bien un rendu : le compteur MESURE quelque chose').toBeGreaterThan(0);
  commits = 0;
  return conteneur!;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

afterEach(démonter);

/** Écrit le cap d'un jeton POSTÉ par l'écrivain canonique (`faceToward` : un pas d'une case dans la
 *  direction voulue) — le store n'expose aucune pose de cap « nue ». */
function poserCap(id: string, dir: Dir8): void {
  const d = DIR8_DELTA[dir];
  act(() => { useGame.getState().faceToward(id, { x: 0, y: 0 }, { x: d.gx, y: d.gy }); });
}

const caps = (el: HTMLElement): (string | null)[] => [...el.querySelectorAll('g[data-pion-cid="h1"] path')].map((p) => p.getAttribute('d'));

describe('Surcouche des jetons — le cap ne s’abonne que là où il se peint (#1176 P3-5c)', () => {
  it('PLATEAU ISO : une écriture de cap ne provoque AUCUN rendu de la surcouche', () => {
    const el = monter(false);
    expect(el.querySelector('g[data-pion-cid="h1"]'), 'témoin : aucun pion n’est monté en iso').toBeNull();
    poserCap('h1', 'E');
    expect(commits, 'aucun rendu').toBe(0);
    // …et ce n'est pas le store qui dort : la table a bien changé de valeur ET de référence.
    expect(useGame.getState().facing.h1).toBe('E');
    poserCap('h1', 'N');
    poserCap('e1', 'O');
    expect(commits, 'trois caps écrits, zéro rendu').toBe(0);
  });

  it('TÉMOIN, sous les PIONS : le même geste re-rend le disque et repeint son triangle', () => {
    const el = monter(true);
    const avant = caps(el);
    expect(avant, 'témoin : le pion porte bien son cap').toContain(discCapPath('S', 1, dimsDe('top')));
    poserCap('h1', 'E');
    expect(commits, 'le cap est LU ici : le disque se re-rend').toBeGreaterThan(0);
    expect(caps(el)).toContain(discCapPath('E', 1, dimsDe('top')));
    expect(caps(el)).not.toEqual(avant);
  });

  it('…et l’abonnement est keyé par JETON : le cap d’un AUTRE ne re-rend pas ce pion', () => {
    monter(true);
    poserCap('e1', 'O');
    expect(commits, 'un cap qui n’est pas le sien ne coûte rien').toBe(0);
  });
});
