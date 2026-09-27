import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { resolveCritique } from './critical';
import reference from './crit-rng-invariance.fixture.json';
import type { Combatant, HitLocation } from './types';
import type { JeuDeCritique } from '../data/criticals';

/**
 * INVARIANCE du flux de RNG des Blessures critiques (#1657, #1682).
 *
 * Ce qu'il verrouille, qu'aucun autre test ne voit : l'ORDRE de consommation des dés. Un jet déplacé
 * d'une ligne (le 1d10 de fracture avant l'amputation, un dé de plus tiré quelque part) laisse toutes
 * les assertions de comportement vertes et change TOUTES les parties à seed égale. 480 cas : 40 seeds
 * × 6 Localisations × 2 jeux, la moitié avec 8 points d'overkill pour exercer le modificateur de
 * sévérité de chaque jeu.
 *
 * PÉRIMÈTRE, depuis B3-1/B3-1b : le résolveur ne roule PLUS aucun nœud `test` — ni celui de la rangée,
 * ni celui de l'Amputation (LDB 18 l.237) : il les REND en `testFlow` (ou les ARME sur
 * `Trauma.pendingAmputation`), la porte les joue. Leur issue n'est donc PAS déterministe par seed, et
 * n'a pas à l'être : c'est une fenêtre de joueur (Chance = relance). Restent invariants, et ce test les
 * fige : le d100 de SÉVÉRITÉ (`roll`), la RANGÉE atteinte (`entryId`/`label`/`lethal`/`desc`), les
 * effets immédiats, les séquelles, et les nœuds RENDUS eux-mêmes (branches + enjeu posé).
 *
 * La RÉFÉRENCE (`crit-rng-invariance.fixture.json`) a été RE-CAPTURÉE sous #1657. Mesure faite au
 * moment de la recapture, contre la référence précédente : les 480 cas rendent le MÊME `roll`, le MÊME
 * `entryId`, le MÊME `label`, le MÊME `lethal` et la MÊME `desc` — 0 divergence. Ce qui bouge est
 * NOMMÉ : 36 cas d'amputation (23 aux `ops`, 36 aux `traumas`, 30 au `testFlow`) — le résolveur cesse
 * d'y consommer 1 à 2 dés, et 6 d'entre eux portent leur nœud sur `pendingAmputation`.
 *
 * CE QUI NE DOIT PAS BOUGER, et que le contrat ci-dessous CHIFFRE : l'ESCALADE de la ligne, qui vit sur
 * la plaie chirurgicale et ne dépend d'aucun jet — `perRound` (« Main ouverte », LDB 18 l.122) 4 cas,
 * `awaitingMedicalAid` 12, `amputateAfterDays`/`amputateSequel` (« Pied écrasé », l.180) 4 chacun, aux
 * MÊMES cardinaux qu'avant la recapture. Une première recapture les avait vus tomber à 0/8 sans que rien ne
 * rougisse : le compte est ÉCRIT ici, pas seulement encodé dans la fixture.
 */

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const cible = (): Combatant =>
  ({
    id: 't', name: 'Cible', label: 'Cible', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 10, max: 10 }, conditions: [], skills: [], traumas: [], critEntriesSuffered: [], bodyShape: 'humanoide',
  }) as unknown as Combatant;

/** Stringify STABLE (clés triées récursivement) — l'ORDRE des tableaux, lui, reste significatif :
 *  c'est justement lui qui porte la séquence d'ops et de séquelles. */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return tableTotale(Object.keys(o).sort(), (k) => stable(o[k]));
  }
  return v;
}

const REFERENCE = reference as unknown as Record<string, unknown>;
const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

describe('invariance du RNG des Blessures critiques — référence figée AVANT la fusion des lecteurs', () => {
  it('la référence couvre bien 40 seeds × 6 Localisations × 2 jeux', () => {
    expect(Object.keys(REFERENCE).length).toBe(480);
    const jeux = new Set(Object.keys(REFERENCE).map((k) => k.split('|')[0]));
    expect([...jeux].sort()).toEqual(['aa', 'ldb']);
  });

  it('la référence porte bien des nœuds RENDUS et ARMÉS (sinon elle ne mesurerait plus la porte)', () => {
    const avecNoeud = Object.values(REFERENCE).filter((c) => (c as { testFlow?: unknown }).testFlow);
    expect(avecNoeud.length, 'aucun `testFlow` dans la référence : le nœud de rangée a disparu du chemin').toBe(146);
    const armes = Object.values(REFERENCE)
      .filter((c) => (c as { traumas?: { pendingAmputation?: unknown }[] }).traumas?.some((t) => t.pendingAmputation));
    expect(armes.length, 'aucun nœud ARMÉ : l’amputation différée (l.171) a quitté le chemin').toBe(6);
  });

  it('les 480 cas rendent un `CriticalResolved` IDENTIQUE à la référence', () => {
    const divergences: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const overkill = seed % 2 === 0 ? 8 : 0;
      for (const loc of LOCS) {
        for (const jeu of ['ldb', 'aa'] as JeuDeCritique[]) {
          const cle = `${jeu}|${seed}|${loc}|${overkill}`;
          const obtenu = JSON.stringify(stable(resolveCritique(jeu, cible(), loc, makeRNG(seed), { overkill })));
          const attendu = JSON.stringify(stable(REFERENCE[cle]));
          if (obtenu !== attendu) divergences.push(`${cle}\n    attendu : ${attendu}\n    obtenu  : ${obtenu}`);
        }
      }
    }
    expect(divergences, `${divergences.length} cas divergent de la référence :\n  ${divergences.slice(0, 5).join('\n  ')}`).toEqual([]);
  });

  it('l’ESCALADE de la ligne survit à la porte : elle vit sur la plaie, jamais sur une branche de jet', () => {
    const porteurs = (champ: string) => Object.entries(REFERENCE)
      .filter(([, c]) => ((c as { traumas?: Record<string, unknown>[] }).traumas ?? []).some((t) => t[champ] !== undefined))
      .map(([cle]) => cle);
    // LDB 18 l.122 (« Pour chaque Round au cours duquel vous ne recevez pas d'Aide Médicale, vous perdez
    // un autre doigt ») : « Main ouverte » / `aa-bras-116`, sur les deux bras des cas à overkill.
    expect(porteurs('perRound').length, 'l’escalade par Round a disparu de la référence').toBe(4);
    expect(porteurs('awaitingMedicalAid').length).toBe(12);
    // LDB 18 l.180 (« Si vous n'êtes pas soigné par Chirurgie au cours des 1d10 jours suivants »).
    expect(porteurs('amputateAfterDays').length).toBe(4);
    expect(porteurs('amputateSequel').length).toBe(4);
  });

  it('la référence n’est pas vide de substance (elle exercerait sinon un chemin trivial)', () => {
    const cas = Object.values(REFERENCE) as { ops: unknown[]; traumas: unknown[]; lethal: boolean; label: string }[];
    expect(new Set(cas.map((c) => c.label)).size).toBeGreaterThan(50); // 65 lignes distinctes atteintes
    expect(cas.filter((c) => c.traumas.length).length).toBeGreaterThan(100); // séquelles réellement posées
    expect(cas.filter((c) => c.lethal).length).toBeGreaterThan(10); // lignes « Mort » atteintes
    expect(cas.filter((c) => c.ops.length).length).toBeGreaterThan(300);
  });
});
