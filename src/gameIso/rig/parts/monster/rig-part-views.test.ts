/**
 * VUES DES PARTS hors slots de corps — garde de cliquet (#1082).
 *
 * PÉRIMÈTRE MESURÉ : les registres `parts/monster/defs/` (parts monstrueuses du bipède) et
 * `parts/elements/defs/` (catalogue d'apparence : cornes, ailes, oreilles, écailles…). Les slots de
 * CORPS (tenues + armures) ont leur propre cliquet (`parts/tenues/part-view-format.test.ts`) ; les
 * autres plans de corps (quadrupède, nuées, navires) ne sont PAS mesurés ici.
 *
 * Ces deux familles ne passent pas par `resolveParts` : leur repli est SILENCIEUX — `pickView`
 * (`parts/types.ts`) sert le front tel quel côté monstre, et le filtre
 * `if (ov.view && ov.view !== view) continue` (`composeRig.tsx`) émet un overlay sans `view` à
 * l'identique dans les trois vues.
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`) — partagée avec le
 * régénérateur `scripts/rig/regen-rig-view-stock.mts`. Ici : les quatre invariants du cliquet.
 *   1. FORMAT — la vue est déclarée quelque part.
 *   2. ANTI-ALIAS — une vue déclarée n'a pas la géométrie du front.
 *   3. ANTI-TRANSFORM — une vue déclarée ne réutilise pas le contenu du front sous un `<g transform>`.
 * Les trois se jugent par l'ÉCART NOMINATIF au stock (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`),
 * dans les DEUX sens : `neuves = []` ET `perimees = []`. Aucun PLAFOND : ce qu'une dette ne peut pas
 * faire, c'est croître SANS SE DÉCLARER, et c'est l'entrée `{ fichier, ref, occurrence }` — qui NOMME
 * le def à ouvrir — que la porte de plage (`croissanceDesStocks`) voit à l'append.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MONSTER_PARTS } from './_registry.generated';
import { ELEMENT_DEFS } from '../elements/_registry.generated';
import type { ElementOverlay } from '../elements/types';
import { auditRigPartViews, isTransformDerived } from '../../../../../scripts/guards/lib/partViewAudit';
import type { Site } from '../../../../../scripts/guards/lib/stock.mjs';
import {
  RIG_VIEW_FORMAT_RATCHET,
  RIG_VIEW_ALIAS_RATCHET,
  RIG_VIEW_TRANSFORM_RATCHET,
} from '../../../../../scripts/guards/lib/rigViewStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../../scripts/guards/lib/stock.mjs';

const STOCK = 'scripts/guards/lib/rigViewStock.mjs';

/** Cliquet générique : sites hors stock = neuves (échec) ; entrées que plus aucun site ne porte =
 *  périmées (échec). La primitive PARTAGÉE du dépôt, jamais une comparaison locale. */
const ratchet = (sites: readonly Site[], stock: Iterable<EntreeNominative>) =>
  ecartDuVolet({ sites, stock, ou: STOCK });

describe('vues des parts monstre + éléments : cliquet à trois dimensions (#1082)', () => {
  const { format, alias, transform } = auditRigPartViews();

  it('les clés de def sont uniques dans chaque registre', () => {
    const monstre = MONSTER_PARTS.map((p) => `${p.slot}:${p.key}`);
    expect(new Set(monstre).size).toBe(monstre.length);
    const elements = ELEMENT_DEFS.map((e) => e.key);
    expect(new Set(elements).size).toBe(elements.length);
  });

  it('aucune vue NEUVE non déclarée, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(format, RIG_VIEW_FORMAT_RATCHET);
    expect(neuves, `Vues NON DÉCLARÉES neuves — l'art de face est servi à cette vue (repli de\n` +
      `pickView / du filtre d'overlay). Déclarer la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de RIG_VIEW_FORMAT_RATCHET qui ne violent plus — les RETIRER de\n` +
      `${STOCK} (ou : npx tsx scripts/rig/regen-rig-view-stock.mts) :\n` +
      `  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE aliasée sur le front, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(alias, RIG_VIEW_ALIAS_RATCHET);
    expect(neuves, `Vues DÉCLARÉES dont la GÉOMÉTRIE est celle du front — la déclaration est\n` +
      `satisfaite, le rendu reste l'art de face. Dessiner la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de RIG_VIEW_ALIAS_RATCHET qui ne violent plus — les RETIRER de\n` +
      `${STOCK} :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE dérivée par TRANSFORM, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(transform, RIG_VIEW_TRANSFORM_RATCHET);
    expect(neuves, `Vues DÉCLARÉES qui reprennent le contenu du front sous une enveloppe de\n` +
      `transform : la silhouette tourne, l'occlusion n'est pas redessinée :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de RIG_VIEW_TRANSFORM_RATCHET qui ne violent plus — les RETIRER de\n` +
      `${STOCK} :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME le fichier de def à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = [...RIG_VIEW_FORMAT_RATCHET, ...RIG_VIEW_ALIAS_RATCHET, ...RIG_VIEW_TRANSFORM_RATCHET]
      .filter((e) => !/^src\/gameIso\/rig\/parts\/(monster|elements)\/defs\/.+\.ts$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à\n` +
      `\`croissanceDesStocks\`, et un append ne coûterait rien :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });
});

/**
 * MORSURE — chaque dimension du détecteur est vue ROUGE sur une violation fabriquée, mesurée sur le
 * chemin réel (l'art du registre est échangé le temps d'une mesure, puis restauré).
 *
 * PÉRIMÈTRE de la dimension TRANSFORM, mesuré : elle voit la reprise du front sous un `transform`
 * DÉCLARÉ — enveloppe `<g transform=…>` ou attribut porté par chaque forme. Deux reprises restent
 * DEHORS, car elles réécrivent les coordonnées : la recopie translatée numériquement (chaque nombre
 * +0.1) et le miroir réécrit à la main (coordonnées opposées, aucun `transform`). Les séparer d'un
 * vrai dessin de vue demande un appariement de tracés à la tolérance près ; `isTransformDerived`
 * compare des signatures textuelles (`scripts/guards/lib/partViewAudit.ts`).
 */
describe('morsure : les trois dimensions rougissent (#1082)', () => {
  /** Premier def monstre déclarant profile ET back — support des mutations. */
  const target = (() => {
    for (const p of MONSTER_PARTS)
      if (typeof p.art === 'object' && p.art.profile && p.art.back)
        return { part: p, art: p.art as { front: string; back: string; profile: string } };
    throw new Error('aucune part monstre à 3 vues — le corpus a changé, la morsure n\'a plus de support');
  })();
  /** La violation attendue, telle que le remède l'imprime : la CLÉ nominative du site. */
  const KEY = ` :: monstre:${target.part.slot}:${target.part.key}:back :: 1`;

  function withBack(back: string | undefined, dim: 'format' | 'alias' | 'transform') {
    const saved = target.part.art;
    target.part.art = back == null ? target.art.front : { ...target.art, back };
    try {
      return ratchet(auditRigPartViews()[dim], {
        format: RIG_VIEW_FORMAT_RATCHET, alias: RIG_VIEW_ALIAS_RATCHET, transform: RIG_VIEW_TRANSFORM_RATCHET,
      }[dim]).neuves;
    } finally { target.part.art = saved; }
  }

  it('une part rendue front-only rougit la dimension FORMAT, en NOMMANT son def', () => {
    const neuves = withBack(undefined, 'format');
    expect(remedeNomme(neuves, KEY)).toBe(true);
    expect(remedeNomme(neuves, `src/gameIso/rig/parts/monster/defs/${target.part.key}.ts`)).toBe(true);
  });

  it('une vue de dos recopiée du front rougit la dimension ALIAS', () => {
    expect(remedeNomme(withBack(target.art.front, 'alias'), KEY)).toBe(true);
  });

  it('une vue de dos = front enveloppé d\'un rotate rougit la dimension TRANSFORM', () => {
    expect(remedeNomme(withBack(`<g transform="rotate(180)">${target.art.front}</g>`, 'transform'), KEY)).toBe(true);
  });

  it('une vue de dos = front dont CHAQUE forme porte son propre transform rougit la dimension TRANSFORM', () => {
    const miroir = target.art.front.replace(/<(path|ellipse|rect|circle|polygon)\b/g, '<$1 transform="scale(-1,1)"');
    expect(miroir, 'le front doit porter au moins une forme à transformer').not.toBe(target.art.front);
    expect(remedeNomme(withBack(miroir, 'transform'), KEY)).toBe(true);
  });

  it('SOLDER une violation la rend PÉRIMÉE : le stock ne peut pas garder une entrée morte', () => {
    const entree = RIG_VIEW_FORMAT_RATCHET.find((e) => e.ref.startsWith('monstre:'));
    expect(entree, 'le stock FORMAT doit porter au moins une entrée monstre pour ce contrat').toBeDefined();
    const [, slot, key] = entree!.ref.split(':');
    const part = MONSTER_PARTS.find((p) => p.slot === slot && p.key === key)!;
    const saved = part.art;
    part.art = { front: '<path d="M0 0 L1 1"/>', profile: '<path d="M2 2 L7 3"/>', back: '<path d="M4 8 L9 5"/>' };
    try {
      const { perimees } = ratchet(auditRigPartViews().format, RIG_VIEW_FORMAT_RATCHET);
      expect(remedeNomme(perimees, ` :: ${entree!.ref} :: ${entree!.occurrence}`)).toBe(true);
    } finally { part.art = saved; }
  });

  it('l\'enveloppe est vue même quand la chaîne du front n\'est PAS incluse telle quelle', () => {
    const front = '<g><path d="M0 0 L1 1"/></g>';
    const back = '<g transform="scale(-1,1)"><path d="M0 0 L1 1"/></g>';
    expect(back.includes(front)).toBe(false);
    expect(isTransformDerived(front, back)).toBe(true);
    expect(isTransformDerived(front, '<g><path d="M0 0 L2 9"/></g>')).toBe(false);
  });

  it('une vue de dos = front recoloré, sans transform, rougit la dimension ALIAS (géométrie identique)', () => {
    const recolore = target.art.front.replace(/fill=("|')@(\w+)("|')/g, 'fill=$1@$2O$3');
    expect(recolore).not.toBe(target.art.front);
    expect(remedeNomme(withBack(recolore, 'alias'), KEY)).toBe(true);
  });

  /** ALLONGER un stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucun site ne porte est PÉRIMÉE', () => {
    const gonfle = [...RIG_VIEW_TRANSFORM_RATCHET, {
      fichier: 'src/gameIso/rig/parts/elements/defs/element-qui-n-existe-pas.ts',
      ref: 'element:gonflement:back', occurrence: 1,
    }];
    const { perimees } = ratchet(auditRigPartViews().transform, gonfle);
    expect(remedeNomme(perimees, ' :: element:gonflement:back :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });
});

/**
 * MORSURE de la branche ÉLÉMENTS — la même mesure, sur l'autre registre. Les calques d'un def
 * d'apparence RÉEL sont échangés le temps d'une mesure, puis restaurés (`finally`). Le support est
 * un def dont les DEUX vues sont aujourd'hui hors du stock : sans cela, la violation fabriquée ne
 * serait pas NEUVE et la garde resterait verte pour une bonne raison — la morsure ne prouverait rien.
 * Le def est réel parce que la mesure NOMME son fichier (`registreDeDefs.ts`, par identité d'objet
 * sur l'index généré) : un def fabriqué hors index n'existe pas plus pour la mesure que pour le
 * rendu, qui n'importe que l'index.
 * Ce que le runtime fait de ces calques : `composeRig.tsx:267` émet un overlay SANS `view` à
 * l'identique dans les trois vues, et n'émet rien pour un `svg` vide (`composeRig.tsx:276`).
 */
describe('morsure : la branche ÉLÉMENTS du détecteur rougit (#1082)', () => {
  /** Premier def d'apparence à overlays dont AUCUNE des deux vues n'est au stock FORMAT. */
  const support = (() => {
    const auStock = new Set(RIG_VIEW_FORMAT_RATCHET.map((e) => e.ref));
    for (const el of ELEMENT_DEFS) {
      if ((el.overlays ?? []).length === 0) continue;
      if (!auStock.has(`element:${el.key}:back`) && !auStock.has(`element:${el.key}:profile`)) return el;
    }
    throw new Error("aucun def d'apparence hors stock sur SES DEUX vues — la morsure n'a plus de support");
  })();
  const K = support.key;

  function withElement(overlays: ElementOverlay[]): Site[] {
    const saved = support.overlays;
    support.overlays = overlays;
    try { return auditRigPartViews().format; } finally { support.overlays = saved; }
  }
  const neuvesFormat = (overlays: ElementOverlay[]) =>
    ratchet(withElement(overlays), RIG_VIEW_FORMAT_RATCHET).neuves;

  it('un calque `svg` sans `view` rougit les DEUX vues en FORMAT, en NOMMANT le def', () => {
    const neuves = neuvesFormat([{ bone: 'tete', svg: '<path d="M0 0 L5 5"/>' }]);
    expect(remedeNomme(neuves, ` :: element:${K}:back :: 1`)).toBe(true);
    expect(remedeNomme(neuves, ` :: element:${K}:profile :: 1`)).toBe(true);
    expect(remedeNomme(neuves, `src/gameIso/rig/parts/elements/defs/${K}.ts`)).toBe(true);
  });

  it('un calque `svg` sans `view` rougit MÊME quand un autre calque déclare la vue', () => {
    const neuves = neuvesFormat([
      { bone: 'tete', svg: '<path d="M9 9 L1 4"/>', view: 'back' },
      { bone: 'torse', svg: '<path d="M0 0 L5 5"/>' },
    ]);
    expect(remedeNomme(neuves, ` :: element:${K}:back :: 1`)).toBe(true);
  });

  it('une vue DÉCLARÉE dont l\'art rend vide compte en FORMAT : rien n\'est servi à cette vue', () => {
    const neuves = neuvesFormat([
      { bone: 'tete', svg: '<path d="M0 0 L5 5"/>', view: 'front' },
      { bone: 'tete', svg: '', view: 'back' },
    ]);
    expect(remedeNomme(neuves, ` :: element:${K}:back :: 1`)).toBe(true);
  });
});

/**
 * BARRIÈRE du régénérateur (`scripts/rig/regen-rig-view-stock.mts`) — elle porte sur l'APPARTENANCE
 * des sites, jamais sur la taille des ensembles, et c'est la MÊME lecture de « ce qui est neuf » que
 * le cliquet ci-dessus : `refusDeCroissance`, dans `scripts/guards/lib/stock.mjs`. Deux lectures
 * divergentes laisseraient l'une écrire ce que l'autre refuse. Le contrat de cette barrière est tenu
 * sur fixture synthétique dans `scripts/guards/lib/stock.test.mjs` ; ici, le CÂBLAGE réel.
 */
describe('barrière du régénérateur de stock (#1082)', () => {
  it('le régénérateur refuse par `refusDeCroissance`, pas par une comparaison de tailles', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../../../../scripts/rig/regen-rig-view-stock.mts', import.meta.url)), 'utf8');
    expect(src).toContain("import { regenererStock } from '../guards/lib/regenStock.mts';");
    expect(src).toContain('stock: RIG_VIEW_FORMAT_RATCHET');
    const regen = readFileSync(
      fileURLToPath(new URL('../../../../../scripts/guards/lib/regenStock.mts', import.meta.url)), 'utf8');
    expect(regen).toContain('const refus = refusDeCroissance(c.mesurees, c.stock, { nom: c.nom, motif: c.motif });');
    expect(regen, "une barrière de TAILLES blanchit l'échange à somme nulle").not.toMatch(/\.length\s*[<>]=?\s*\w+\.length/);
  });
});
