/**
 * FORMAT DE PART — garde de cliquet (#551).
 *
 * Un slot de CORPS se résout en `ViewSet` TOTAL `{front, profile, back}`. Un def en `string` est
 * front-only : la couture `toViewSet` (`parts/derive.ts`) DÉRIVE alors ses vues manquantes (silhouette
 * générique en tokens pour torse/jambes/tete, vraie silhouette pour `bras`). Ce cliquet compte les
 * DEFS BRUTS front-only (ceux restant à solder en DESSINANT leurs 3 vues). Contrat : `rig/PART-CONTRACT.md`.
 *
 * PÉRIMÈTRE : les deux registres qui alimentent les slots de corps de `resolveParts` — les TENUES
 * et les ARMURES. L'armure PRIME sur la tenue (`resolve.ts`, `armed ?? tenuePart`) : hors périmètre,
 * le format restait vert sur une tenue conforme pendant qu'un personnage en plaque montrait un slot
 * front-only. Armes et boucliers restent HORS garde (cf. PART-CONTRACT.md § Périmètre).
 *
 * La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` — partagée avec le régénérateur, pour
 * qu'aucun des deux n'ait sa propre lecture du pipeline. Ici : les trois invariants du cliquet.
 *   1. FORMAT — un slot déclare ses 3 vues.
 *   2. ANTI-ALIAS — une vue déclarée n'est pas le front redessiné à l'identique.
 * Les deux se jugent par l'ÉCART NOMINATIF au stock (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`),
 * dans les DEUX sens : `neuves = []` (aucune violation hors stock) ET `perimees = []` (aucune entrée
 * qui ne viole plus). Aucun PLAFOND de taille ici : ce qu'une dette ne peut pas faire, c'est croître
 * SANS SE DÉCLARER, et c'est l'entrée `{ fichier, ref, occurrence }` — qui NOMME le def à ouvrir —
 * que la porte de plage (`croissanceDesStocks`) voit à l'append.
 */
import { describe, it, expect } from 'vitest';
import { TENUE_DEFS } from './_registry.generated';
import { ARMOUR_DEFS } from '../armour/_registry.generated';
import { auditPartViews, SLOTS, type Audit, type Bearer, type BodySlot } from '../../../../../scripts/guards/lib/partViewAudit';
import type { Site } from '../../../../../scripts/guards/lib/stock.mjs';
import type { PartArt } from '../types';
import {
  PART_VIEW_RATCHET,
  PART_VIEW_ALIAS_RATCHET,
} from '../../../../../scripts/guards/lib/rigPartViewStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../../scripts/guards/lib/stock.mjs';

const STOCK = 'scripts/guards/lib/rigPartViewStock.mjs';

/** Cliquet générique : sites hors stock = neuves (échec) ; entrées que plus aucun site ne porte =
 *  périmées (échec). La primitive PARTAGÉE du dépôt, jamais une comparaison locale. */
const ratchet = (sites: readonly Site[], stock: Iterable<EntreeNominative>) =>
  ecartDuVolet({ sites, stock, ou: STOCK });

describe('format de part : 3 vues par slot de corps (cliquet #551)', () => {
  const { format, alias } = auditPartViews();

  it('les clés de stock sont des ids STABLES et sans collision (tenues vs armures)', () => {
    const ids = TENUE_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Le namespace `armure:` des clés d'armure ne doit croiser aucun id de tenue.
    expect(ids.filter((i) => i === 'armure')).toEqual([]);
  });

  it('aucun slot NEUF en front-only, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(format, PART_VIEW_RATCHET);
    expect(neuves, `Slots front-only NEUFS — fournir {front, profile, back} (cf. rig/PART-CONTRACT.md).\n` +
      `Une string fait DÉRIVER ses vues (silhouette générique torse/jambes/tete, vraie silhouette bras) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de PART_VIEW_RATCHET qui ne violent plus (soldées ou disparues) — les RETIRER de\n` +
      `${STOCK} (ou : npx tsx scripts/rig/regen-part-view-stock.mts),\n` +
      `sinon le stock ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('aucune vue déclarée NEUVE aliasée sur le front, et le stock ne peut que DÉCROÎTRE', () => {
    const { neuves, perimees } = ratchet(alias, PART_VIEW_ALIAS_RATCHET);
    expect(neuves, `Vues DÉCLARÉES dont le DESSIN est celui du front — le format est satisfait, le rendu\n` +
      `reste l'art de face plaqué. Dessiner la vue :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de PART_VIEW_ALIAS_RATCHET qui ne violent plus — les RETIRER de\n` +
      `${STOCK} :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME le fichier de def à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = [...PART_VIEW_RATCHET, ...PART_VIEW_ALIAS_RATCHET]
      .filter((e) => !/^src\/gameIso\/rig\/parts\/(tenues|armour)\/defs\/.+\.ts$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à\n` +
      `\`croissanceDesStocks\`, et un append ne coûterait rien :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });
});

/**
 * MORSURE — les évasions par lesquelles on solderait le stock sans dessiner. Chacune a été exécutée
 * contre la garde d'origine et la laissait VERTE au rendu pixel-identique. Elles vivent ici en
 * permanence : une garde dont on ne teste pas les contournements se dégrade sans bruit.
 *
 * Chaque morsure s'assure que la violation est NEUVE au regard du stock RÉEL (`ratchet(...).neuves`
 * non vide) : c'est exactement ce que la garde ci-dessus assert vide. Constater que le détecteur
 * « voit » ne suffirait pas — on vérifie que la garde ROUGIRAIT.
 */
describe('morsure : les évasions connues rougissent (#551)', () => {
  /** Échange l'art d'un slot le temps d'une mesure. `TENUE_BY_ID`/`ARMOUR` indexent le MÊME objet
   *  `def.set` : la mutation traverse `resolveParts` pour de vrai. Restauré même en cas d'échec. */
  function withArt(def: Bearer, slot: BodySlot, art: PartArt, fn: () => Audit): Audit {
    const saved = def.set[slot];
    def.set[slot] = art;
    try { return fn(); } finally { def.set[slot] = saved; }
  }

  /** Premier slot de TENUE conforme (3 vues, dessin distinct du front) — le support des mutations. */
  const target = (() => {
    const refsAliasees = new Set(auditPartViews().alias.map((s) => s.ref));
    for (const def of TENUE_DEFS) {
      const id = def.id;
      for (const slot of SLOTS) {
        const art = def.set[slot];
        if (art && typeof art === 'object' && art.profile && art.back && !refsAliasees.has(`${id}:${slot}:back`))
          return { def: def as Bearer, slot, id, front: art.front, art };
      }
    }
    throw new Error('aucun slot de tenue conforme — le corpus a changé, la morsure n\'a plus de support');
  })();

  /** La garde rougirait-elle ? = la violation attendue est NEUVE au regard du stock RÉEL. */
  const aliasNeuves = (back: string) =>
    ratchet(withArt(target.def, target.slot, { ...target.art, back }, auditPartViews).alias, PART_VIEW_ALIAS_RATCHET).neuves;
  /** La violation attendue, telle que le remède l'imprime : la CLÉ nominative du site. */
  const KEY = ` :: ${target.id}:${target.slot}:back :: 1`;
  /** Une ligne de remède CONTIENT-elle la clé attendue ? (le remède décore la clé d'une phrase) */

  it('un alias enveloppé dans un <g> inerte rougit (le <g> ne porte aucune géométrie)', () => {
    expect(remedeNomme(aliasNeuves(`<g>${target.front}</g>`), KEY)).toBe(true);
  });

  it('un alias maquillé par un espace final rougit', () => {
    expect(remedeNomme(aliasNeuves(`${target.front} `), KEY)).toBe(true);
  });

  it('un alias maquillé par un commentaire SVG rougit', () => {
    expect(remedeNomme(aliasNeuves(`<!-- dos --> ${target.front}`), KEY)).toBe(true);
  });

  it('un alias RECOLORÉ (géométrie du front, autre remplissage) rougit — la comparaison de chaînes le ratait', () => {
    const recolore = target.front.replace(/fill=("|')@(\w+)("|')/g, 'fill=$1@$2O$3');
    expect(recolore, 'le support de morsure ne porte aucun token de remplissage').not.toBe(target.front);
    expect(remedeNomme(aliasNeuves(recolore), KEY)).toBe(true);
  });

  it('un slot d\'ARMURE front-only NEUF rougit (le registre des armures est bien dans le périmètre)', () => {
    const plaque = ARMOUR_DEFS.find((d) => d.id === 'plaque')! as unknown as Bearer;
    const torse = plaque.set.torse!;
    const front = typeof torse === 'object' ? torse.front : torse;
    const { format } = withArt(plaque, 'torse', front, auditPartViews); // 3 vues -> string front-only
    const neuves = ratchet(format, PART_VIEW_RATCHET).neuves;
    expect(remedeNomme(neuves, ' :: armure:plaque:torse :: 1')).toBe(true);
    // Et le site neuf NOMME le def d'armure à ouvrir, pas seulement la clé de slot.
    expect(remedeNomme(neuves, 'src/gameIso/rig/parts/armour/defs/Plaque.ts')).toBe(true);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE (aucun site ne la porte) et la porte
   *  de plage la voit à l'append. C'est ce que le plafond mort faisait, sans compter. */
  it('ALLONGER le stock rougit : une entrée que plus aucun site ne porte est PÉRIMÉE', () => {
    const { format } = auditPartViews();
    const gonfle = [...PART_VIEW_RATCHET, {
      fichier: 'src/gameIso/rig/parts/tenues/defs/TenueQuiNExistePas.ts', ref: 'gonflement:bras', occurrence: 1,
    }];
    const { perimees } = ratchet(format, gonfle);
    expect(remedeNomme(perimees, ' :: gonflement:bras :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });
});
