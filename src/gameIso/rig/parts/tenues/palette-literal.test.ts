/**
 * LITTÉRAL == JETON — garde de cliquet (#583).
 *
 * Un littéral hex (`fill`/`stroke`/`stop-color`) qui vaut EXACTEMENT une valeur déclarée dans la
 * `palette` du MÊME def aurait dû être le jeton `@<clé>` correspondant. Le recoloriage
 * (`buildTokenMap`/`applyTokenMap`, `palette.ts`) ne peut agir que sur les jetons : un littéral
 * gravé reste figé quel que soit l'espèce/la carrière du porteur, quelle que soit la matière (chair,
 * cuir, tissu, plume…). Un arrêt littéral de dégradé dérivé `url(#dg-…)` compte comme un
 * `stop-color` (#1903).
 *
 * PÉRIMÈTRE : comparaison EXACTE (distance ZÉRO, insensible casse/guillemets) contre les valeurs
 * déclarées PAR LE MÊME def — sans ambiguïté, sans faux positif possible. Jamais une distance
 * colorimétrique globale (faux positifs confirmés #583 : `Bailli|tete` réutilise `@peauH`/`@peauO`
 * pour un panache de plume, pas de la chair — mais ICI la réponse est la MÊME : littéral == jeton
 * du même def est une faute, peu importe la matière).
 *
 * La MESURE vit dans `scripts/guards/lib/paletteLiteralAudit.ts` — partagée avec la régénération
 * (`regenerations`), pour qu'aucune des deux n'ait sa propre lecture.
 *
 * STOCK NOMINATIF (#1727) : une entrée `{ fichier, ref, occurrence }` par occurrence, comparée par
 * `ecartDuVolet` (`scripts/guards/lib/stock.mjs`) — la forme d'entrée de TOUT stock du dépôt. Aucun
 * PLAFOND de taille ne vit ici : ce que l'entrée NOMMANTE rend impossible, c'est d'allonger le stock
 * sans que la porte de plage le voie (`croissanceDesStocks`, mesurée sur ce stock même par
 * `scripts/hooks/stocks-nominatifs.test.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { fichierDeTenue, regenerations, sitesPaletteLiteral } from '../../../../../scripts/guards/lib/paletteLiteralAudit';
import { PALETTE_LITERAL_RATCHET } from '../../../../../scripts/guards/lib/paletteLiteralStock.mjs';
import { SEPARATEUR_DE_CLE, cleDeSite, ecartDuVolet, groupeDeSite, type EntreeDeSite } from '../../../../../scripts/guards/lib/stock.mjs';
import { FORMAT_MJS, ecartDeRegeneration, texteEnPlace, texteRegenere } from '../../../../../scripts/guards/lib/stockDeSites.mjs';
import type { TenueDef } from './types';
import type { View } from '../../facing';
import { declaredView } from '../../viewArt';
import { TENUE_DEFS } from './_registry.generated';

const STOCK = 'scripts/guards/lib/paletteLiteralStock.mjs';

/** L'écart du volet, dans les deux sens et en phrases de remède (site NEUF / entrée SOLDÉE). */
function ecart(defs: readonly TenueDef[] = TENUE_DEFS) {
  return ecartDuVolet({ sites: sitesPaletteLiteral(defs), stock: PALETTE_LITERAL_RATCHET, ou: STOCK });
}

/** La clé d'un site telle que le remède l'imprime (`cleDeSite`). */
const cle = (fichier: string, ref: string, occurrence: number) => cleDeSite({ fichier, ref, occurrence });

describe('littéral == jeton : aucune tenue neuve ne recopie une valeur de SA palette (cliquet #583)', () => {
  it('aucun site NEUF, et aucune entrée SOLDÉE ne traîne au stock', () => {
    const { neuves, perimees } = ecart();
    expect(neuves, `Sites NEUFS d'un littéral == valeur de sa PROPRE palette — peindre avec le jeton\n`
      + `@<clé> déclaré (peu importe la matière : chair, cuir, tissu, plume…) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de ${STOCK} dont le site ne recopie plus (migré ou disparu) — les RETIRER\n`
      + `(ou : npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/paletteLiteralAudit.ts), sinon le stock\n`
      + `ment :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it('le stock committé est un point fixe de sa régénération', () => {
    for (const r of regenerations(sitesPaletteLiteral())) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });
});

/**
 * MORSURE — la garde rougit-elle vraiment sur un littéral neuf == jeton ? Réintroduit un littéral
 * hex identique à une valeur de palette sur un slot aujourd'hui propre, vérifie que le site ressort
 * en `neuves` EN NOMMANT son def, puis restaure. Vérifie aussi le cas insensible-casse/guillemets
 * (piège `Marchand`).
 */
describe('morsure : un littéral neuf == jeton du même def rougit (#583)', () => {
  /** Premier def À PALETTE dont AUCUN slot n'est déjà au stock — la mutation ne peut pas se
   *  confondre avec une violation existante. */
  const target = (() => {
    const stocked = new Set(PALETTE_LITERAL_RATCHET.map((e) => e.ref.slice(0, e.ref.indexOf(':'))));
    for (const def of TENUE_DEFS) {
      if (!def.palette || Object.keys(def.palette).length === 0) continue;
      const id = def.id;
      if (stocked.has(id)) continue;
      for (const slot of ['bras', 'torse', 'jambes', 'tete'] as const) {
        const art = def.set[slot];
        if (declaredView(art, 'front')) return { def, id, slot };
      }
    }
    throw new Error("aucun def À PALETTE hors-stock avec un slot exploitable — le corpus a changé, la morsure n'a plus de support");
  })();
  const fichier = fichierDeTenue(target.def);

  /** Peint un littéral == jeton dans la vue `front` du slot cible, rend l'écart, restaure. */
  const sousLitteral = (peindre: (hex: string, art: string) => string) => {
    const saved = target.def.set[target.slot]!;
    const front = declaredView(saved, 'front')!;
    const [, hex] = Object.entries(target.def.palette!)[0];
    try {
      target.def.set[target.slot] = peindre(hex, front);
      return ecart();
    } finally {
      target.def.set[target.slot] = saved;
    }
  };

  it('un littéral == jeton (guillemets doubles) rougit la garde, et le site neuf NOMME son def', () => {
    const { neuves } = sousLitteral((hex, art) => `<path d="M0 0 L1 1" fill="${hex}"/>${art}`);
    expect(neuves.join('\n')).toContain(cle(fichier, `${target.id}:${target.slot}:front`, 1));
  });

  it('un littéral == jeton (guillemets simples, CASSE différente) rougit aussi la garde', () => {
    const { neuves } = sousLitteral((hex, art) => `<path d='M0 0 L1 1' fill='${hex.toUpperCase()}'/>${art}`);
    expect(neuves.join('\n')).toContain(cle(fichier, `${target.id}:${target.slot}:front`, 1));
  });

  it("le remède d'un site NEUF dit le geste : corriger, ou déclarer l'entrée par `CLIQUET:`", () => {
    const { neuves } = sousLitteral((hex, art) => `<path d="M0 0 L1 1" fill="${hex}"/>${art}`);
    expect(neuves[0]).toContain('site NEUF');
    expect(neuves[0]).toContain(STOCK);
    expect(neuves[0]).toContain('CLIQUET:');
  });

  it('restaurée, la même tenue redevient verte (aucun site neuf résiduel)', () => {
    const { neuves } = ecart();
    expect(neuves.filter((l) => l.includes(` :: ${target.id}:`))).toEqual([]);
  });
});

/**
 * MORSURE — le contournement exact du juge (2026-07-18) : injecter DES DIZAINES de littéraux
 * NEUFS dans un slot:vue DÉJÀ stocké (au lieu d'un slot vierge). Sans le grain de l'OCCURRENCE,
 * ce cas est invisible (0 site neuf, garde verte à tort) : le `slot:vue` était déjà au stock, donc
 * rien à y ajouter.
 */
describe('morsure : 40 littéraux NEUFS dans un slot déjà stocké rougissent (#583, contournement du juge)', () => {
  const stockee = PALETTE_LITERAL_RATCHET[0];
  const [stockedId, stockedSlot, stockedView] = stockee.ref.split(':') as [string, 'torse' | 'jambes' | 'bras' | 'tete', View];
  const target = TENUE_DEFS.find((d) => d.id === stockedId)!;

  it('40 littéraux neufs ajoutés dans un slot déjà fautif produisent 40 sites neufs', () => {
    const saved = target.set[stockedSlot]!;
    const original = declaredView(saved, stockedView)!;
    const [, hex] = Object.entries(target.palette!)[0];
    const injected = Array.from({ length: 40 }, (_, i) => `<circle cx="${i}" cy="0" r="1" fill="${hex}"/>`).join('');
    try {
      target.set[stockedSlot] = typeof saved === 'string' ? injected + original : { ...saved, [stockedView]: injected + original };
      const { neuves } = ecart();
      const groupe = groupeDeSite({ fichier: stockee.fichier, ref: `${stockedId}:${stockedSlot}:${stockedView}`, occurrence: 1 }) + SEPARATEUR_DE_CLE;
      const fraiches = neuves.filter((l) => l.includes(groupe));
      expect(fraiches.length).toBeGreaterThanOrEqual(40);
    } finally {
      target.set[stockedSlot] = saved;
    }
  });

  it('restaurée, aucun site neuf résiduel sur ce def', () => {
    const { neuves } = ecart();
    expect(neuves.filter((l) => l.includes(` :: ${stockedId}:`))).toEqual([]);
  });
});

describe("l'autre sens du cliquet : une entrée que plus aucun site ne porte est SOLDÉE", () => {
  it('une entrée fantôme ressort en `perimees`, avec le geste (la retirer du stock)', () => {
    const fantome = { fichier: PALETTE_LITERAL_RATCHET[0].fichier, ref: 'tenue-qui-n-existe-plus:torse:front', occurrence: 1 };
    const { perimees } = ecartDuVolet({
      sites: sitesPaletteLiteral(), stock: [...PALETTE_LITERAL_RATCHET, fantome], ou: STOCK,
    });
    expect(perimees).toHaveLength(1);
    expect(perimees[0]).toContain('entrée SOLDÉE');
    expect(perimees[0]).toContain(fantome.ref);
    expect(perimees[0]).toContain(STOCK);
  });
});

/**
 * MORSURE DE LA RÉGÉNÉRATION (`regenerations`, politique `DECROISSANT`, #1727) — son refus se juge
 * site par site (`refusDeCroissance`), jamais sur un total. Un ÉCHANGE à taille CONSTANTE (une entrée
 * du stock retirée pendant qu'un site mesuré n'est plus couvert) laisse les deux longueurs égales : un
 * refus qui compare des nombres écrirait le stock et entérinerait le site neuf en silence, la garde
 * ci-dessus verte ensuite. Forgé EN MÉMOIRE (le stock du disque n'est jamais touché) sur la mesure
 * RÉELLE du corpus.
 */
describe('régénérateur : un échange à taille constante est REFUSÉ, en nommant le site (#1727)', () => {
  const [regeneration] = regenerations(sitesPaletteLiteral());
  const enPlace = texteEnPlace(regeneration.chemin) ?? '';
  /** Le texte du stock en place, sa collection remplacée par `stock`. */
  const avecStock = (stock: readonly EntreeDeSite[]) => {
    const image = FORMAT_MJS.lire(enPlace, regeneration.chemin);
    if (!image) throw new Error(`${regeneration.chemin} illisible`);
    image.collections.set('PALETTE_LITERAL_RATCHET', [...stock]);
    return FORMAT_MJS.ecrire(image);
  };

  it("une entrée retirée + une entrée fantôme (même longueur) : refus qui NOMME le site découvert", () => {
    const [decouvert, ...reste] = PALETTE_LITERAL_RATCHET;
    const echange = [...reste, {
      fichier: 'src/gameIso/rig/parts/tenues/defs/TenueQuiNExistePlus.ts',
      ref: 'tenue-qui-n-existe-plus:torse:front', occurrence: 1,
    }];
    expect(echange, 'la forge doit rester à TAILLE CONSTANTE, sinon elle ne prouve rien')
      .toHaveLength(PALETTE_LITERAL_RATCHET.length);
    const rendu = texteRegenere(regeneration, { enPlace: avecStock(echange) });
    expect('refus' in rendu, 'un site mesuré hors du stock doit refuser même à taille constante').toBe(true);
    expect('refus' in rendu && rendu.refus).toContain(cleDeSite(decouvert));
  });

  it('le stock en place couvre la mesure : aucun refus, le régénérateur peut écrire', () => {
    expect('refus' in texteRegenere(regeneration, { enPlace: avecStock(PALETTE_LITERAL_RATCHET) })).toBe(false);
  });
});
