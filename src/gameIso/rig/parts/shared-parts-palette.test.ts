/**
 * Garde-fou STRUCTUREL — les parts SYSTÈME du pied et de la main (`BOTTE_CUIR` de
 * `tenues/botte-gabarit.ts`, `CLAWFOOT`/`PLAINFOOT`/`HAND` de `bodies/extremites.ts`) sont
 * servies à TOUTES les tenues (habit ou repli d'espèce, jamais redessinées ad hoc). Une
 * couleur littérale y est donc une teinte imposée à toute la garde-robe (défaut #426 : bottes
 * brunes sous une armure d'acier). Deux morsures, sur le rendu RÉEL (pas un grep de source) :
 *   1) le SVG rendu de `pied`/`main`, pour chaque tenue × chaque vue, ne porte AUCUN littéral de
 *      couleur → toute couleur passe par un jeton de palette ;
 *   2) chaque jeton y est RÉSOLU par la palette effective du rig → pas de jeton inventé qui
 *      fuirait tel quel dans le SVG.
 * La palette effective vient de `couchesDuRig` — LA construction de l'empilage, celle que
 * `composeRig` appelle : la garde n'en tient AUCUNE réplique (une garde qui remonte sa propre vue
 * du pipeline reste verte pendant que le rendu diverge — c'est ce qui masquait le trou de la
 * couche ESPÈCE). Plus le contrat de la donnée : défaut = pied système inchangé ; `botte` déclarée
 * (par une TENUE ou par une RACE) = pied recolorié, membre par membre, même partiellement.
 */
import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { couchesDuRig, tenuePaletteFor } from './career';
import { buildTokenMap, applyTokenMap, type PaletteDeclaree } from '../palette';
import { CLASS_TENUE_BY_ID, SPECIFIC_TENUES } from './tenues';
import type { View } from '../facing';
import type { EquipCtx } from './equipment';

const empty: EquipCtx = { weapons: [], armour: [] };
const VIEWS: View[] = ['front', 'back', 'profile'];
const TENUE_IDS = [...SPECIFIC_TENUES.map((t) => t.id), ...Object.keys(CLASS_TENUE_BY_ID)];
const SHARED_SLOTS = ['pied', 'main'] as const;
/** Bruns de l'art d'origine (pied système) — aucun ne doit survivre à une `botte` déclarée. */
const SYSTEM_BROWNS = /#3a2614|#1f1408|#241608|#2e1f10|#1a1208/;

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]/g;
/** Jetons `@x` non substitués par la table (= jeton hors palette effective). */
const LEFT_TOKEN = /@[a-zA-Z]\w*/g;

const sharedSvg = (tenueId: string, view: View, slot: (typeof SHARED_SLOTS)[number]): string =>
  resolveParts('Humain', 'M', tenueId, empty, {}, 1, view)[slot]?.svg ?? '';
/** Palette effective du rig — `couchesDuRig` EST le chemin de composeRig (aucune réplique). */
const rigMap = (tenueId: string, species?: PaletteDeclaree) => buildTokenMap(couchesDuRig(species, tenueId), {});

describe('garde-fou — parts partagées du rig : zéro couleur littérale, tout jeton résolu (#426)', () => {
  it('les détecteurs mordent', () => {
    expect('<path fill="#3a2614"/>'.match(COLOR_LITERAL)).toHaveLength(1);
    expect('<path fill="@botte"/>'.match(COLOR_LITERAL)).toBeNull();
    expect(applyTokenMap('<path fill="@inconnu"/>', rigMap('soldat')).match(LEFT_TOKEN)).toHaveLength(1);
  });

  it('la surface balayée est complète (toute la garde-robe)', () => {
    expect(TENUE_IDS.length).toBeGreaterThan(100);
    expect(TENUE_IDS).toContain('chevalier-du-loup-blanc');
    expect(TENUE_IDS).toContain('nu');
  });

  it.each(TENUE_IDS)('%s : pied/main sans couleur littérale, et tout jeton résolu', (tenueId) => {
    const map = rigMap(tenueId);
    for (const view of VIEWS) {
      for (const slot of SHARED_SLOTS) {
        const raw = sharedSvg(tenueId, view, slot);
        expect(raw.match(COLOR_LITERAL) ?? [], `${slot} (${view}) porte une couleur littérale — la palette de la tenue ne peut plus la piloter`).toEqual([]);
        expect(applyTokenMap(raw, map).match(LEFT_TOKEN) ?? [], `${slot} (${view}) porte un jeton hors palette effective`).toEqual([]);
      }
    }
  });
});

describe('pied système — la palette PORTÉE le pilote (#426)', () => {
  const pied = (tenueId: string, view: View, species?: PaletteDeclaree) =>
    applyTokenMap(sharedSvg(tenueId, view, 'pied'), rigMap(tenueId, species));

  it('rien de déclaré : botte système (bruns d’origine, à l’exact)', () => {
    expect(pied('soldat', 'front')).toContain('#3a2614');
    expect(pied('soldat', 'front')).toContain('#241608');
    expect(pied('soldat', 'back')).toContain('#2e1f10');
  });

  // Couche ESPÈCE : elle s'empile ENTRE le pied système et la tenue (composeRig). Le pied doit être
  // expansé depuis la palette portée ENTIÈRE, sinon une race qui déclare `botte` voit sa base honorée
  // et sa famille rester système (cuir neuf, contour brun d'origine).
  it('une RACE qui déclare `botte` pilote TOUTE sa famille (aucune couche entre-deux)', () => {
    const cuir = '#2e261c';
    for (const view of VIEWS) {
      const svg = pied('soldat', view, { botte: cuir });
      expect(svg, `pied (${view}) n’a pas suivi la botte déclarée par l’espèce`).toContain(cuir);
      expect(svg, `pied (${view}) garde un brun système sous un cuir déclaré par l’espèce`).not.toMatch(SYSTEM_BROWNS);
    }
  });

  it('la TENUE prime sur la race pour la botte (ordre d’empilage : espèce → tenue)', () => {
    expect(tenuePaletteFor('cultiste').botte).toBe('#4a3a28');
    const map = buildTokenMap(couchesDuRig({ botte: '#111111' }, 'cultiste'), {});
    expect(map.botte).toBe('#4a3a28');
  });

  it('`botte` déclarée : TOUT le pied la suit, aucun brun système ne subsiste', () => {
    const cuir = '#2e261c';
    for (const view of VIEWS) {
      const map = buildTokenMap([{ botte: cuir }], {});
      const svg = applyTokenMap(sharedSvg('soldat', view, 'pied'), map);
      expect(svg).toContain(cuir);
      expect(svg).not.toMatch(SYSTEM_BROWNS);
    }
  });

  it('`semelle` déclarée avec `botte` : la semelle garde sa teinte propre', () => {
    expect(buildTokenMap([{ botte: '#2e261c', semelle: '#101010' }], {}).semelle).toBe('#101010');
  });

  // Déclaration PARTIELLE (un membre sans la tête de famille) : contrat = robuste, le membre déclaré
  // dérive SA propre ombre. Sinon `botteDos` neuf garderait le `botteDosO` brun peint par l'art.
  it('déclaration PARTIELLE (`botteDos` sans `botte`) : l’ombre du membre déclaré se dérive', () => {
    const dos = '#2e261c';
    const map = buildTokenMap([{ botteDos: dos }], {});
    expect(map.botteDosO, 'ombre dorsale dérivée du cuir dorsal déclaré').toBe('#241e16');
    expect(map.botte, 'la botte non déclarée doit rester système').toBe('#3a2614');
    expect(map.botteO).toBe('#1f1408');
    expect(applyTokenMap(sharedSvg('soldat', 'back', 'pied'), map)).not.toContain('#1a1208');
  });

  it('les griffes (pied nu) ont leur propre jeton, indépendant du cuir de la botte', () => {
    expect(buildTokenMap([{ botte: '#2e261c' }], {}).griffe).toBe(buildTokenMap([], {}).griffe);
  });
});
