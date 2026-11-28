/**
 * Activation JOUEUR d'une capacité SUR SOI qui prend l'Action (`ciblage:'soi'`, `activation:'action'`), sur le patron de
 * la Métamorphose (Middenheim p.116) : la barre n'offre que la manœuvre jouable (`manoeuvreSurSoiJouable` : aucune op
 * sans objet), le verbe `manoeuvrerSurSoi` la résout sur son porteur, prend l'Action, et la forme se quitte proprement.
 * Fixtures déclarées au seam des datasets : le trait `forme-de-test` et ses deux manœuvres.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { poserLeDataset } from '../data/datasetDeTest.testkit';
import { heroFaceAUnEnnemi, reluDans } from './combatDeTest.testkit';
import { ACTION_CANDIDATES } from './actionRegistry';
import { testScene } from '../scenes/test-fixture';
import { effectiveChar } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import type { ManeuverDef } from '../data';

const TAG = 'forme-de-test';
const surSoi = (id: string, ops: unknown[]) => ({
  id, type: 'maneuvers', label: id, kind: 'hurlement', activation: 'action', coutEnAvantage: 0, ciblage: 'soi',
  effects: [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops } } }],
  source: { book: 'LDB', page: 0 },
}) as never;
const PRENDRE = 'prendre-la-forme-de-test';
const QUITTER = 'quitter-la-forme-de-test';

poserLeDataset('maneuvers', (livre) => [...livre,
  surSoi(PRENDRE, [{ op: 'transform', tag: TAG, ops: [{ op: 'charMod', characteristic: 'capacite-de-combat', mod: 10 }, { op: 'charMod', characteristic: 'dexterite', mod: -10 }] }, { op: 'loseTurn', what: 'action' }]),
  surSoi(QUITTER, [{ op: 'endTransform', tag: TAG }, { op: 'loseTurn', what: 'action' }]),
]);
poserLeDataset('traits', (livre) => [...livre,
  { id: 'trait-de-forme-de-test', type: 'traits', label: 'Forme de test', grantsManeuvers: [{ id: PRENDRE }, { id: QUITTER }], source: { book: 'LDB', page: 0 } } as never,
]);

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

/** Le héros au tour, porteur du trait de forme. */
function porteur(): Combatant {
  const { H } = heroFaceAUnEnnemi(banc, testScene());
  H.traits = [{ id: 'trait-de-forme-de-test' }];
  banc.setState({ battle: { ...g().battle! } });
  return H;
}

/** Les manœuvres sur soi à l'Action que la barre offre au héros actif. */
const offertes = (): string[] => {
  const s = g();
  const b = s.battle!;
  const active = b.combatants.find((c) => c.id === b.order[b.turn])!;
  return (ACTION_CANDIDATES['manoeuvres-sur-soi']({ active, battle: b, scene: s.scene, netMode: s.net.mode, gameTime: s.gameTime, state: s }) as ManeuverDef[]).map((m) => m.id);
};

describe('manoeuvrerSurSoi — une forme prise et quittée (activation joueur)', () => {
  it('F6 — la barre n’offre que la manœuvre dont aucune op n’est sans objet : quitter la forme hors d’elle ne l’est pas', () => {
    porteur();
    expect(offertes()).toEqual([PRENDRE]);
  });

  it('prendre la forme : son delta, l’Action prise et la suivante perdue ; seul le retour reste offert', () => {
    const H = porteur();
    const cc0 = effectiveChar(H, 'capacite-de-combat'), dex0 = effectiveChar(H, 'dexterite');
    g().manoeuvrerSurSoi(PRENDRE);
    const h = reluDans(g, H);
    expect(effectiveChar(h, 'capacite-de-combat')).toBe(cc0 + 10);
    expect(effectiveChar(h, 'dexterite')).toBe(dex0 - 10);
    expect(g().battle!.acted).toBe(true);
    expect(h.loseNextAction).toBe(true);
    banc.setState({ battle: { ...g().battle!, acted: false } });
    expect(offertes()).toEqual([QUITTER]);
  });

  it('quitter la forme restaure le profil de base', () => {
    const H = porteur();
    const cc0 = effectiveChar(H, 'capacite-de-combat');
    g().manoeuvrerSurSoi(PRENDRE);
    banc.setState({ battle: { ...g().battle!, acted: false } });
    g().manoeuvrerSurSoi(QUITTER);
    const h = reluDans(g, H);
    expect(effectiveChar(h, 'capacite-de-combat')).toBe(cc0);
    expect(offertes()).toEqual([PRENDRE]);
  });

  it('une manœuvre que la barre n’offre pas est refusée, et ne prend pas l’Action', () => {
    const H = porteur();
    const cc0 = effectiveChar(H, 'capacite-de-combat');
    g().manoeuvrerSurSoi(QUITTER);
    expect(effectiveChar(reluDans(g, H), 'capacite-de-combat')).toBe(cc0);
    expect(g().battle!.acted).toBe(false);
  });

  it('orientation : une manœuvre sur soi laisse le cap intact', () => {
    const H = porteur();
    banc.setState({ facing: { [H.id]: 'NO' } });
    g().manoeuvrerSurSoi(PRENDRE);
    expect(g().facing[H.id]).toBe('NO');
  });
});
