import { describe, it, expect } from 'vitest';
import { CREATURES } from '../creatures';
import { quadParts, quadAnchor } from './quadParts';
import { DECOS_MORTS_GELES, PLAFOND_REPERES_ART_PROPRES, REPERES_ART_PROPRES_GELES, quadLayersSvg } from './deco-stock.fixture';
import { OS_TETE } from './composeQuad';
import type { QuadBoneId, QuadProps } from './quadSkeleton';
import type { View } from '../facing';

/**
 * Contrat du canal `deco` : `quadAnchor(p, os, vue)` EST le repère dans lequel vit l'art de cet os
 * pour cette vue. `quadParts` appose le décor via `quadAnchored` (même transform) — si l'art porte
 * un transform enveloppant que l'ancre ne reproduit pas, le décor authoré sur les coordonnées de
 * l'art atterrit ailleurs (repère implicite resté dans l'assemblage).
 * PÉRIMÈTRE du détecteur : (a) l'art de TÊTE de TOUTES les defs du registre (`OS_TETE`, avec ou
 * sans `deco` — un repère propre est une propriété de l'art, et l'échelle de tête étant portée par
 * l'os depuis `composeQuad`, c'est là que l'unité part↔os doit coïncider) ; (b) tout os visé par
 * une clé `deco`. Stock gelé nominatif `REPERES_ART_PROPRES_GELES`, plafond décroissant, aucune
 * entrée périmée.
 */

const VIEWS: View[] = ['profile', 'front', 'back'];

/** Transform du `<g>` UNIQUE qui enveloppe tout l'art (balancé, couvrant la chaîne entière), sinon ''. */
function wrappingTransform(art: string): string {
  const open = /^<g([^>]*)>/.exec(art);
  if (!open) return '';
  let depth = 0, end = -1;
  const tag = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(art))) {
    if (m[1]) depth--;
    else if (!m[4]) depth++;
    if (depth === 0) { end = tag.lastIndex; break; }
  }
  if (end !== art.length) return '';
  return (/transform="([^"]*)"/.exec(open[1]) ?? ['', ''])[1];
}

const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

describe('quadAnchor = repère de l\'art de l\'os (contrat du canal deco)', () => {
  it('couvre tout le registre quadrupède/ailé', () => {
    expect(quadDefs.length).toBeGreaterThan(20);
  });

  it('chaque art de part vit dans le repère que quadAnchor reproduit', () => {
    const divergences: string[] = [];
    const repereDeLaPart = new Set<string>();
    let couplesTete = 0, couplesDeco = 0;
    /** Un couple (espèce × vue × os) : l'art de l'os porte-t-il un repère que l'ancre ne dit pas ? */
    const verifier = (id: string, quad: QuadProps, view: View, bone: QuadBoneId, art: string, cle: string) => {
      const ancre = quadAnchor(quad, bone, view);
      const enveloppe = wrappingTransform(art);
      if (ancre === enveloppe) return;
      // L'écart vient de l'ART de la part (elle enveloppe ses coordonnées d'un repère à elle) :
      // il se compte par PART (espèce × vue × os), pas par clé de décor — plusieurs clés
      // pointent le même art. Le stock gelé porte cette unité.
      repereDeLaPart.add(`${id} ${view} ${bone}`);
      divergences.push(`${id} ${view} ${cle} : ancre="${ancre || '(identité)'}" art="${enveloppe || '(aucun)'}"`);
    };
    for (const { id, quad } of quadDefs) {
      for (const view of VIEWS) {
        const nu = quadParts({ ...quad, deco: undefined }, view);
        // (a) ART DE TÊTE — toutes les defs, `deco` ou non : un repère propre est une propriété de
        // l'ART, jamais de la présence d'un décor. C'est le canal où l'unité de la part et celle de
        // l'os doivent coïncider (l'échelle de tête est portée par l'os, `composeQuad`).
        for (const bone of OS_TETE) {
          const art = quadLayersSvg(nu[bone]);
          if (!art) continue;
          couplesTete++;
          verifier(id, quad, view, bone, art, bone);
        }
        // (b) OS VISÉ PAR UNE CLÉ `deco` — c'est là que le décor authoré sera apposé.
        for (const key of Object.keys(quad.deco ?? {})) {
          const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
          if (vue && vue !== view) continue;
          const art = quadLayersSvg(nu[bone]);
          if (!art) continue;
          couplesDeco++;
          verifier(id, quad, view, bone, art, key);
        }
      }
    }
    expect(couplesTete).toBeGreaterThan(90); // 25 defs × 3 vues, moins les os de tête sans art
    expect(couplesDeco).toBeGreaterThan(50);
    expect([...repereDeLaPart].sort().filter((p) => !REPERES_ART_PROPRES_GELES.includes(p)),
      `repère propre à l'art d'une part, hors stock gelé :\n${divergences.join('\n')}`).toEqual([]);
    // Le stock ne peut que RÉTRÉCIR : une entrée soldée se retire de la liste.
    expect([...repereDeLaPart].length).toBeLessThanOrEqual(PLAFOND_REPERES_ART_PROPRES);
    // … et aucune entrée PÉRIMÉE : un repère soldé doit SORTIR du gel, sinon le plafond ment.
    expect(REPERES_ART_PROPRES_GELES.filter((p) => !repereDeLaPart.has(p)),
      'entrée gelée qui ne diverge plus — à retirer du stock').toEqual([]);
  });

  /**
   * Contrat POSITIF : une clé `deco` vise UNE vue (`os#vue`) ou LES TROIS (clé nue) — et dans
   * CHACUNE des vues visées, l'os doit porter un art, sinon le décor est peint nulle part. Le
   * stock GELÉ des couples encore perdus (`DECOS_MORTS_GELES`) est la seule exemption, nominative :
   * tout couple mort NOUVEAU rougit ici.
   */
  it('chaque clé `deco` authorée vise un os qui porte un art dans CHACUNE des vues visées', () => {
    const perdus: string[] = [];
    for (const { id, quad } of quadDefs) {
      if (!quad.deco) continue;
      for (const key of Object.keys(quad.deco)) {
        const [bone, vue] = key.split('#') as [QuadBoneId, View | undefined];
        for (const v of (vue ? [vue] : VIEWS))
          if (!quadParts({ ...quad, deco: undefined }, v)[bone]) perdus.push(`${id} ${v} ${key}`);
      }
    }
    expect(perdus.filter((c) => !DECOS_MORTS_GELES.includes(c)),
      'décor authoré pour une vue où son os n\'est pas émis').toEqual([]);
  });
});
