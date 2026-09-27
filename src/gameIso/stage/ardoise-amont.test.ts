// @vitest-environment jsdom
/**
 * ARDOISE AMONT (#1680) — un banc volumique ne démarre JAMAIS sur une file de cuiseur héritée.
 *
 * La file cadencée s'arme sur une couture d'inactivité (`requestSlice`, `backends/webgl/atlasBake`) :
 * tant que sa tranche est armée, `requestSlice` sort sans rien réarmer. Si la callback armée meurt
 * avec l'environnement jsdom du fichier qui l'a posée, le drapeau reste levé DANS LE GRAPHE DE MODULES
 * que la suite partage (`isolate: false`) : le fichier suivant enfile ses rasterisations et aucune
 * n'est servie — son écran se monte sans un seul quad, et son rouge accuse seulement une machine lente
 * (« expected [] to have a length of 2 » après vingt secondes d'attente).
 *
 * `brancherArdoise` lave donc l'ardoise AUX DEUX BOUTS. Ce banc mesure le bout AMONT, le seul qui
 * couvre la frontière de FICHIER : le `beforeEach` ci-dessous est enregistré AVANT lui, il joue donc
 * le fichier précédent — celui qui n'a pas ce harnais et laisse la file armée sans servir.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bakeQueueLength, queueBakeTask } from '../backends/webgl/atlasBake';
import { brancherArdoise } from './banc-volumique';

/** Ce que le « fichier précédent » a laissé en file — sa PRÉMISSE : sans tâche enfilée ni tranche
 *  armée, ce banc mesurerait le vide. Le COMPTE, lui, n'est pas un contrat : le wedge ci-dessous en
 *  enfile une, et le fichier qui a réellement précédé (ordre de suite variable, `isolate: false`) peut
 *  en avoir laissé d'autres. */
let héritée = 0;

beforeEach(() => {
  // Une couture d'inactivité qui ne sert JAMAIS sa callback : exactement ce qu'est une callback armée
  // dont l'environnement jsdom meurt avant qu'elle ne parte.
  vi.stubGlobal('requestIdleCallback', () => 0);
  void queueBakeTask({ value: 1 }, () => Promise.resolve('tâche du fichier précédent'));
  héritée = bakeQueueLength();
  vi.unstubAllGlobals();
});

brancherArdoise();

describe('Banc volumique — l’ardoise se lave aussi EN AMONT', () => {
  it('une file héritée ARMÉE SANS SERVIR ne coince pas le banc : sa propre tâche est servie', async () => {
    expect(héritée, 'PRÉMISSE ≥ 1 : le wedge en enfile une, la suite peut en laisser d’autres — sinon rien n’est mesuré').toBeGreaterThanOrEqual(1);
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => setTimeout(cb, 0));
    let servie = false;
    void queueBakeTask({ value: 1 }, () => { servie = true; return Promise.resolve('tâche de ce banc'); });
    for (let i = 0; i < 20 && !servie; i++) await new Promise((r) => setTimeout(r, 5));

    expect(servie, 'la file du cuiseur est entrée COINCÉE dans ce banc : ses rasterisations ne partiront jamais, et son écran se montera sans un seul quad').toBe(true);
    // …et il ne reste RIEN : ni la tâche héritée (l'ardoise l'a ôtée à l'entrée), ni la sienne.
    expect(bakeQueueLength(), 'la file doit être servie jusqu’au bout').toBe(0);
  });
});
