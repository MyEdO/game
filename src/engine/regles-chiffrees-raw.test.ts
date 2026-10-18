import { describe, it, expect } from 'vitest';
import { RANGEES_DE_REGLE, type RegleChiffree } from './ruleRefs';
import { modDeRangee, rangeesDeRegle } from './reglesChiffrees';
import { findTraitById, findQualityById, findTalentById, findSpellById } from '../data';
import { oupsTable } from '../data/oups';

/**
 * Les valeurs chiffrées LUES en donnée, confrontées au LIVRE (#1173). Un test de table : chaque rangée
 * de chaque règle chiffrée, et chaque valeur d'entité, porte le nombre imprimé à sa réf. La table couvre
 * EXACTEMENT le vocabulaire `RANGEES_DE_REGLE` : une rangée neuve y entre avec sa valeur du livre.
 */
type Attendu = { mod: number; seuil?: number; plafond?: number; ref: string };

const LIVRE: { [R in RegleChiffree]: Record<(typeof RANGEES_DE_REGLE)[R][number], Attendu> } = {
  viser: { viser: { mod: 20, ref: 'LDB 14 l.52-86' } },
  'viser-une-localisation': { localisation: { mod: -20, ref: 'LDB 14 l.52-86' } },
  'superiorite-numerique': {
    'deux-contre-un': { mod: 20, seuil: 2, ref: 'LDB 14 l.110' },
    'trois-contre-un': { mod: 40, seuil: 3, ref: 'LDB 14 l.110' },
  },
  'tirer-dans-le-tas': {
    'petit-groupe': { mod: 20, seuil: 3, ref: 'LDB 14 l.106' },
    'groupe-important': { mod: 40, seuil: 7, ref: 'LDB 14 l.106' },
    foule: { mod: 60, seuil: 13, ref: 'LDB 14 l.106' },
  },
  'sur-la-defensive': { 'sur-la-defensive': { mod: 20, ref: 'LDB 13 l.110' } },
  'attaque-de-flanc-ou-de-dos': { 'flanc-ou-dos': { mod: 20, ref: 'LDB 14 l.52-86' } },
  fuite: { 'dos-tourne': { mod: 20, ref: 'LDB 15 l.63-66' } },
  'tir-en-mouvement': { 'tir-en-mouvement': { mod: -10, ref: 'LDB 14 l.52-86' } },
  'tir-dans-un-combat-au-corps-a-corps': { 'tir-dans-la-melee': { mod: -20, ref: 'LDB 14 l.116' } },
  'cible-en-contrebas': { 'en-contrebas': { mod: -10, ref: 'LDB 14 l.52-86' } },
  'combat-monte': {
    'cible-plus-petite': { mod: 20, ref: 'LDB 14 l.180' },
    'cibler-le-cavalier': { mod: -10, ref: 'LDB 14 l.181' },
    'esquive-a-cheval': { mod: -20, ref: 'LDB 14 l.184' },
  },
  'possession-pas-a-sa-taille': { 'possession-pas-a-sa-taille': { mod: -20, ref: 'ADE II 2 l.710' } },
  empoignade: {
    'avantage-le-plus-faible': { mod: 20, ref: 'LDB 14 l.169' },
    'avantage-le-plus-fort': { mod: 10, ref: 'LDB 14 l.169' },
  },
  'portee-d-une-arme': {
    'bout-portant': { mod: 40, plafond: 0.1, ref: 'LDB 62 l.200-206' },
    courte: { mod: 20, plafond: 0.5, ref: 'LDB 62 l.200-206' },
    moyenne: { mod: 0, plafond: 1, ref: 'LDB 62 l.200-206' },
    longue: { mod: -10, plafond: 2, ref: 'LDB 62 l.200-206' },
    extreme: { mod: -30, plafond: 3, ref: 'LDB 62 l.200-206' },
  },
  'main-secondaire': { 'main-secondaire': { mod: -20, ref: 'LDB 14 l.78' } },
  'taille-modificateurs-en-combat': { 'plus-petit': { mod: 10, ref: 'LDB 85 l.366' } },
  'allonge-longueur-d-arme': { 'arme-plus-longue': { mod: -10, ref: 'LDB 62 l.172' } },
  'equipe-incomplete-machine-de-guerre': { 'equipe-incomplete': { mod: -20, ref: 'ADE II 8 l.233' } },
  avantage: { 'par-point': { mod: 10, ref: 'LDB 14 l.215' } },
};

describe('règles chiffrées — la donnée porte le nombre du livre', () => {
  for (const regle of Object.keys(LIVRE) as RegleChiffree[]) {
    const attendues = LIVRE[regle] as Record<string, Attendu>;
    it(`${regle} : rangées et valeurs du livre`, () => {
      const lues = rangeesDeRegle(regle);
      expect(lues.map((r) => r.id)).toEqual(Object.keys(attendues));
      for (const r of lues) {
        const a = attendues[r.id];
        expect({ mod: modDeRangee(r), seuil: r.seuil, plafond: r.plafond }, `${regle}/${r.id} — ${a.ref}`)
          .toEqual({ mod: a.mod, seuil: a.seuil, plafond: a.plafond });
      }
    });
  }
});

/** Cherche, dans une entrée de donnée, l'op `op` (où qu'elle soit nichée). */
function opDe(entree: unknown, op: string): Record<string, unknown> | undefined {
  if (Array.isArray(entree)) for (const x of entree) { const t = opDe(x, op); if (t) return t; }
  else if (entree && typeof entree === 'object') {
    const o = entree as Record<string, unknown>;
    if (o.op === op) return o;
    for (const v of Object.values(o)) { const t = opDe(v, op); if (t) return t; }
  }
  return undefined;
}

describe('valeurs chiffrées des entités — la donnée porte le nombre du livre', () => {
  it('Nuée : +40 au tir contre elle (LDB 85 l.253) ; Parasité : −10 en mêlée (LDB 85 l.257)', () => {
    expect(findTraitById('nuee')?.passive).toContainEqual({ op: 'incomingAttackMod', mode: 'ranged', amount: 40 });
    expect(findTraitById('parasite')?.passive).toContainEqual({ op: 'incomingAttackMod', mode: 'melee', amount: -10 });
  });
  it('Salve : −10 par tir suivant (AA 10 l.262) ; Arme d’équipe : −10 par Défaut redoublé (MDG 12 l.460)', () => {
    expect(findQualityById('salve')?.capabilities?.salvo).toBe(-10);
    expect(findQualityById('arme-d-equipe')?.capabilities?.crewedTeam).toBe(-10);
  });
  it('Maniement de deux armes : −10 aux défenses après la double frappe (LDB 10 l.773)', () => {
    expect(findTalentById('maniement-de-deux-armes')?.combat?.dualStrikeDefense).toBe(-10);
  });
  it('N’écoutez point la Sorcière : −20 au Test de Langue (Magick) (LDB 43 l.145)', () => {
    expect(opDe(findSpellById('n-ecoutez-point-la-sorciere'), 'castWard')?.mod).toBe(-20);
  });
  it('Oups ! 41-60 : −10 à l’Action du prochain Round (LDB 14 l.26)', () => {
    expect(oupsTable().find((e) => e.kind === 'actionPenalty')).toMatchObject({ min: 41, max: 60, mod: -10 });
  });
});
