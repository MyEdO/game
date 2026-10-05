/**
 * Garde de CLASSE (#2113) : un champ de catalogue tagué « rendu pur » (`MetaChamp.renduPur`) n'est jamais
 * recopié dans une instance — ni l'objet (`itemFromTrappingById`), ni l'arme qui en dérive (`weaponFromItem`),
 * sous AUCUN nom : une valeur SENTINELLE posée dans chaque champ tagué du catalogue est cherchée dans le
 * JSON entier des instances. Le dessin résout ces champs au catalogue courant par `trappingId` (`formeResolue`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { meta } from '../data/schemas/defs/trappings';
import { trappings, trappingsInstanciables } from '../data';
import { setDataset } from '../data/overrides';
import { itemFromTrappingById, weaponFromItem } from './items';

const RENDU_PUR = Object.entries(meta)
  .filter(([, m]) => m.renduPur)
  .map(([cle]) => cle);
const SENTINELLE = '__rendu-pur__';
const catalogueDOrigine = trappings.slice();
afterEach(() => setDataset('trappings', catalogueDOrigine));

describe('rendu pur : aucune instance ne recopie un champ de rendu du catalogue', () => {
  it('le tag est posé (la garde mord sur au moins un champ)', () => {
    expect(RENDU_PUR).toContain('shape');
  });

  it('objets et armes construits depuis le catalogue : la sentinelle n’apparaît nulle part', () => {
    const tagues = (t: object) => RENDU_PUR.filter((cle) => cle in t);
    const marque = <T extends { id: string }>(t: T): T => {
      const copie: Record<string, unknown> = { ...t };
      for (const cle of tagues(t)) copie[cle] = `${SENTINELLE}${t.id}.${cle}`;
      return copie as T;
    };
    setDataset('trappings', catalogueDOrigine.map(marque));
    const porteurs = trappingsInstanciables().filter((t) => tagues(t).length);
    expect(porteurs.length, 'la sonde mord : des objets instanciables portent un champ de rendu').toBeGreaterThan(0);
    const recopies: string[] = [];
    for (const t of porteurs) {
      const objet = itemFromTrappingById(t.id)!;
      const arme = objet.kind === 'melee' || objet.kind === 'ranged' ? weaponFromItem(objet) : undefined;
      if (JSON.stringify(objet).includes(SENTINELLE)) recopies.push(`objet:${t.id}`);
      if (arme && JSON.stringify(arme).includes(SENTINELLE)) recopies.push(`arme:${t.id}`);
    }
    expect(recopies).toEqual([]);
  });
});
