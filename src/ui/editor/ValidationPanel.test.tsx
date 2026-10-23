// @vitest-environment jsdom
/**
 * Panneau VALIDATION de l'éditeur — contrats POSITIFS.
 *
 * La première épreuve est la GARDE ANTI-FAUX-VERT : un panneau qui affiche « Aucun défaut détecté »
 * sur une scène porteuse de défauts de plan fait conclure à l'auteur qu'il n'y a rien à corriger.
 * Elle se joue sur une scène SYNTHÉTIQUE fautive (jamais sur les comptes d'une carte réelle, qui
 * bougent dès que l'auteur corrige son plan) et échoue dès que la remontée des défauts est débranchée.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ValidationPanel } from './ValidationPanel';
import { validateScene, type Warning } from '../../noyau/validateScene';
import { parseProject } from '../../noyau/worldMap';
import { PLAN_DEFECT_FAMILIES } from '../../noyau/planDefects';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene } from '../../noyau/monde/scene';
import diligenceProjet from '../../scenes/diligence/diligence-projet.json';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(warnings: Warning[], onSelect: (w: Warning) => void = () => {}) {
  await act(async () => {
    root.render(<ValidationPanel warnings={warnings} onSelect={onSelect} />);
  });
}

const rows = () => Array.from(container.querySelectorAll('button.listrow')) as HTMLButtonElement[];
const rowWith = (text: string) => rows().find((el) => el.textContent?.includes(text));

/** Défaut de plan synthétique — famille et endroit du vocabulaire partagé `PlanDefectAt`. */
function planWarning(i: number): Warning {
  return {
    level: 'warn',
    sceneId: 'sc',
    scope: 'plan',
    plan: { family: 'mur-manquant', at: { kind: 'edge', x: i, y: 3, side: 'N', z: 1 } },
    message: `Mur manquant — arête N de (${i},3) à l'étage 1.`,
  };
}

/** Scène SYNTHÉTIQUE fautive : une pièce déclarée en INTÉRIEUR entièrement posée sur la route, donc
 *  hors du bâti. Aucun compte de carte réelle — le contrat reste vrai le jour où l'auteur corrige la
 *  sienne, et faux le jour où la remontée des défauts de plan se débranche. */
function scenePlanFautive(): Scene {
  const w = 4, h = 2;
  return {
    type: 'scene',
    reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    id: 'sc-fautive',
    label: 'Cour prise pour une salle',
    dimensions: { w, h },
    layers: [{ z: 0, tiles: Array.from({ length: w * h }, (_, i) => (i % w <= 1 ? 'plancher' : 'route')) }],
    walls: [],
    effectZones: [{ id: 'salle', label: 'Salle du fond', presentation: 'interior', area: { kind: 'rect', x: 2, y: 0, w: 2, h }, z: 0 }],
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

describe('ValidationPanel — garde anti-faux-vert', () => {
  it('scène portant des défauts de plan : le panneau les affiche, jamais un état « aucun défaut »', async () => {
    const warnings = validateScene([scenePlanFautive()]);
    const planWarnings = warnings.filter((w) => w.scope === 'plan');
    expect(planWarnings.length).toBeGreaterThan(0); // la scène EST fautive par construction

    await mount(warnings);
    const txt = container.textContent ?? '';
    expect(txt).not.toContain('Aucun défaut détecté');
    expect(txt).not.toContain('Aucun problème');
    expect(txt).toContain('défaut(s) de plan');
    // Chaque famille remontée est titrée, et une rangée porte le message du défaut.
    const familles = PLAN_DEFECT_FAMILIES.filter((f) => planWarnings.some((w) => w.plan?.family === f.id));
    expect(familles.length).toBeGreaterThan(0);
    for (const f of familles) expect(txt).toContain(f.title);
    expect(rowWith(planWarnings[0].message)).toBeTruthy();

    // CONTRE-ÉPREUVE APPARIÉE : la MÊME scène dont on débranche la remontée de plan retombe sur l'état
    // vide — c'est bien cette remontée qui cause le verdict ci-dessus, pas un autre avertissement.
    expect(warnings.filter((w) => w.scope !== 'plan')).toEqual([]);
    await mount([]);
    expect(container.textContent).toContain('Aucun défaut détecté');
  });

  it('« La Diligence » (carte RÉELLE) : quel que soit l’état du plan, le panneau dit la vérité', async () => {
    const { scenes, worldMap } = parseProject(diligenceProjet);
    const warnings = validateScene(scenes, worldMap);
    const planWarnings = warnings.filter((w) => w.scope === 'plan');

    await mount(warnings);
    const txt = container.textContent ?? '';
    if (planWarnings.length) {
      expect(txt).not.toContain('Aucun défaut détecté');
      expect(txt).toContain('défaut(s) de plan');
      expect(rowWith(planWarnings[0].message)).toBeTruthy();
    } else {
      expect(txt).toContain('Contrôlé'); // plan propre : le panneau énumère sa COUVERTURE, il n'affirme rien d'autre
    }
  });
});

describe('ValidationPanel — couverture déclarée et rangées atteignables', () => {
  it('sans aucun avertissement, énumère les familles CONTRÔLÉES (dérivées du registre)', async () => {
    await mount([]);
    const txt = container.textContent ?? '';
    expect(txt).toContain('Contrôlé');
    for (const f of PLAN_DEFECT_FAMILIES) expect(txt).toContain(f.title);
  });

  it('un avertissement de plan SANS endroit exploitable reste VISIBLE — compté dans l’en-tête, il doit s’afficher quelque part', async () => {
    const orphelin: Warning = { level: 'warn', sceneId: 'sc', scope: 'plan', message: 'Défaut de plan sans endroit à pointer.' };
    await mount([orphelin]);
    expect(rowWith(orphelin.message)).toBeTruthy();
    expect(container.textContent).not.toContain('Aucun défaut détecté');
  });

  it('un clic sur une rangée de défaut de plan renvoie LE warning, porteur de son endroit', async () => {
    const onSelect = vi.fn();
    const w = planWarning(7);
    await mount([w], onSelect);
    const row = rowWith(w.message)!;
    await act(async () => row.click());
    expect(onSelect).toHaveBeenCalledWith(w);
    expect(onSelect.mock.calls[0][0].plan.at).toEqual({ kind: 'edge', x: 7, y: 3, side: 'N', z: 1 });
  });

  it('les rangées sont des boutons accessibles (jamais des <li> cliquables)', async () => {
    const w = planWarning(1);
    await mount([w]);
    expect(container.querySelectorAll('li[onclick]').length).toBe(0);
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(w.message));
    expect(btn).toBeTruthy();
  });

  it('une famille volumineuse se plafonne, et « Afficher les N restants » déplie le reste', async () => {
    const many = Array.from({ length: 30 }, (_, i) => planWarning(i));
    await mount(many);
    expect(container.textContent).toContain('30'); // le compte total reste visible
    expect(rowWith(many[0].message)).toBeTruthy();
    expect(rowWith(many[29].message)).toBeFalsy(); // au-delà du plafond : replié

    const plus = rowWith('Afficher les 18 restants')!;
    expect(plus).toBeTruthy();
    await act(async () => plus.click());
    expect(rowWith(many[29].message)).toBeTruthy();
  });
});
