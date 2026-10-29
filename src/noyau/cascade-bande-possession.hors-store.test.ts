/**
 * GARDE DE PALIER (#1262 V2 L4) — « une étape à RANGÉES DÉCLARE sa possession ».
 *
 * Toutes les fabriques passent par `bandStep`, qui la POSE (plusieurs porteurs → `groupOwner`, un seul
 * → SON `actorId`). La garde ferme la FORME à la frontière : une bande sans possession rendrait la
 * fenêtre à l'hôte seul (`modalArbiter` → `undefined`), et le siège du porteur ne verrait jamais sa
 * rangée. Elle lit l'ÉTAPE, jamais un call-site (leçon #1271 : pas de regex de site).
 *
 * CE QUI A DISPARU AVEC #1262 V4 M2 : la garde jumelle « `options` ET `groupOwner` » et son registre
 * de producteurs. Les DEUX seuls poseurs de `groupOwner` sont des mints qui n'exposent AUCUN champ
 * `options` (`rollSeam.bandStep`, qui le dérive du nombre de porteurs, et `rollSeam.hostStep`, qui le
 * déclare) ; l'unique producteur d'étape à `options` est `rollSeam.choiceStep`, dont la déclaration
 * refuse `groupOwner` AU TYPE. La combinaison n'est plus exprimable : la garde runtime ne mesurait
 * plus rien. Le murage au type est mesuré par `built-brand-lint.test.ts` (`SONDE_CHOIX`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { startCascade } from './cascade';
import type { CascadeStep } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#1262 V2 L4 — une bande DÉCLARE sa possession', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, suspendedCascades: [] } as never);
  });

  const bande = (over: Partial<CascadeStep>): CascadeStep =>
    ({ id: 'b', kind: 'sonde-bande', label: 'Bande', aggregate: 'none', ...over }) as CascadeStep;
  const rangee = (id: string) => ({ id, interactive: true, label: 'Résistance', base: 40, target: 40, result: null });
  const ouvrir = (st: CascadeStep) => () => startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [st] });

  it('DEUX porteurs sans `groupOwner` → REFUSÉE (la fenêtre échoirait à l’hôte seul)', () => {
    expect(ouvrir(bande({ participants: [rangee('h1'), rangee('h2')] }))).toThrow(/possession/);
  });

  it('UN porteur sans `actorId` ni `groupOwner` → REFUSÉE (son siège ne verrait pas sa rangée)', () => {
    expect(ouvrir(bande({ participants: [rangee('h1')] }))).toThrow(/possession/);
  });

  it('les deux formes POSÉES passent : `groupOwner` à plusieurs, `actorId` à un seul', () => {
    expect(ouvrir(bande({ id: 'multi', groupOwner: true, participants: [rangee('h1'), rangee('h2')] }))).not.toThrow();
    banc.setState({ pendingCascade: null, suspendedCascades: [] } as never);
    expect(ouvrir(bande({ id: 'solo', actorId: 'h1', participants: [rangee('h1')] }))).not.toThrow();
  });

  it('une étape SANS rangées n’est pas concernée (mono, choix, affichage)', () => {
    expect(ouvrir(bande({ id: 'mono', actorId: 'h1', rollLabel: 'Résistance', target: 40 }))).not.toThrow();
    banc.setState({ pendingCascade: null, suspendedCascades: [] } as never);
    expect(ouvrir(bande({ id: 'affichage' }))).not.toThrow();
  });
});
