/**
 * Champs de Groupe typés au parse (#1463, #3045 A0-a) : toute feuille `idDe('groupe')` des schémas refuse un
 * id fantôme ; un champ de PORTEUR (`DECLARABLE_PAR_UN_PORTEUR`) refuse un Groupe-Cible joker, un champ de
 * CIBLE l'admet ; la Condition `has` résout `value` dans le registre de son `what`, et la `spec` d'un Talent
 * dans les spécialisations de ce Talent.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { catalogueSpecs, declarationDeFeuilleDId, entreeOuverte, estSpecialisable, idsDe, idsDeLaSousListe, type FeuilleDId, type TypeEntite } from './ref';
import { DECLARABLE_PAR_UN_PORTEUR } from './sousListes';
import { conditionSchema, famillesConstruites, hasConditionSchema, hasWhatSchema } from './mecanique';
import { descendre, ouverts, pasDeDonnee } from './descente';
import { valeursDe } from './meta';
import { DEFS_DE_DOCUMENT } from '../validate';
import { tableTotale } from '../../../lib/tableTotale';

/** Chaque feuille `idDe('groupe')` atteinte depuis les documents et les payloads d'op, avec son path de schéma. */
const FEUILLES: readonly { path: string; noeud: z.ZodType; decl: FeuilleDId }[] = (() => {
  const racines = [...DEFS_DE_DOCUMENT.map((d) => d.schema), ...famillesConstruites().flatMap((f) => Object.values(f.opDefs))];
  const vues: { path: string; noeud: z.ZodType; decl: FeuilleDId }[] = [];
  descendre(racines, ({ noeud, path }) => {
    const decl = declarationDeFeuilleDId(noeud);
    if (decl?.type === 'groupe') vues.push({ path, noeud: noeud as z.ZodType, decl });
  });
  return vues;
})();

const PORTEUSES = FEUILLES.filter((f) => f.decl.sousListe === DECLARABLE_PAR_UN_PORTEUR);
const CIBLES = FEUILLES.filter((f) => f.decl.sousListe === undefined);
const DECLARABLES = new Set(idsDeLaSousListe('groupe', DECLARABLE_PAR_UN_PORTEUR));
const JOKERS = [...idsDe('groupe')].filter((id) => !DECLARABLES.has(id));
const FANTOME = 'groupe-fantome-qu-aucun-registre-ne-porte';

/** Le dernier champ nommé d'un path de schéma (`.groups[]` → `groups`). */
const champDuPath = (path: string): string | undefined => /\.([A-Za-z]+)[^.]*$/.exec(path)?.[1];

describe('feuilles `idDe(\'groupe\')` — un id de Groupe résout au parse', () => {
  it('la descente en trouve, porteuses et cibles', () => {
    expect(PORTEUSES.length).toBeGreaterThan(0);
    expect(CIBLES.length).toBeGreaterThan(0);
    expect(FEUILLES.filter((f) => !PORTEUSES.includes(f) && !CIBLES.includes(f)).map((f) => f.path)).toEqual([]);
  });

  it('chaque feuille refuse un id fantôme', () => {
    expect(FEUILLES.filter((f) => f.noeud.safeParse(FANTOME).success).map((f) => f.path)).toEqual([]);
  });

  it('un champ qui DÉCLARE des Groupes (`grantGroups`, `groups`, `vsGroups`) est une feuille porteuse', () => {
    const declarants = FEUILLES.filter((f) => ['grantGroups', 'groups', 'vsGroups'].includes(champDuPath(f.path) ?? ''));
    expect(declarants.length).toBeGreaterThan(0);
    expect(declarants.filter((f) => !PORTEUSES.includes(f)).map((f) => f.path)).toEqual([]);
  });

  it('un joker est refusé par chaque feuille porteuse, admis par chaque feuille cible', () => {
    expect(JOKERS.length).toBeGreaterThan(0);
    const [declarable] = DECLARABLES;
    for (const joker of JOKERS) {
      expect(PORTEUSES.filter((f) => f.noeud.safeParse(joker).success).map((f) => `${f.path} ← ${joker}`)).toEqual([]);
      expect(CIBLES.filter((f) => !f.noeud.safeParse(joker).success).map((f) => `${f.path} ← ${joker}`)).toEqual([]);
    }
    expect(PORTEUSES.filter((f) => !f.noeud.safeParse(declarable).success).map((f) => f.path)).toEqual([]);
  });
});

describe('Condition `has` — `value` résout dans le registre de son `what`', () => {
  const REGISTRE: Record<string, TypeEntite> = { group: 'groupe', talent: 'talent', trait: 'trait', psych: 'psychology', immunity: 'damageType' };
  const WHATS = Object.keys(valeursDe(hasWhatSchema) ?? {});
  const branche = (what: string) => pasDeDonnee(ouverts([hasConditionSchema], { what }), 'value').map(declarationDeFeuilleDId).find((d) => d !== undefined);

  it('chaque `what` nommé a sa branche, et sa `value` est une feuille de son registre', () => {
    expect(WHATS.length).toBeGreaterThan(0);
    expect(tableTotale(WHATS, (w) => branche(w)?.type)).toEqual(REGISTRE);
  });

  it('un id d’un autre registre, absent du sien, est refusé ; un id du sien est admis', () => {
    for (const what of WHATS) {
      const siens = idsDe(REGISTRE[what]);
      const [sien] = siens;
      const etranger = WHATS.filter((w) => w !== what).flatMap((w) => [...idsDe(REGISTRE[w])]).find((id) => !siens.has(id));
      expect(etranger, what).toBeDefined();
      expect(conditionSchema.safeParse({ kind: 'has', who: 'target', what, value: sien }).success, `${what} ← ${sien}`).toBe(true);
      expect(conditionSchema.safeParse({ kind: 'has', who: 'target', what, value: etranger }).success, `${what} ← ${etranger}`).toBe(false);
    }
  });

  it('la spécialisation n’appartient qu’au Talent', () => {
    for (const what of WHATS.filter((w) => w !== 'talent')) {
      const [sien] = idsDe(REGISTRE[what]);
      expect(conditionSchema.safeParse({ kind: 'has', who: 'target', what, value: sien, spec: 'x' }).success, what).toBe(false);
    }
  });

  it('la spécialisation d’un Talent est une des siennes ; un Talent sans spécialisation n’en admet aucune', () => {
    const talents = [...idsDe('talent')];
    const specialise = talents.find((id) => !entreeOuverte('talent', id) && catalogueSpecs('talent', id).length > 0);
    const nu = talents.find((id) => !estSpecialisable('talent', id));
    expect(specialise).toBeDefined();
    expect(nu).toBeDefined();
    const has = (value: string, spec?: string) => conditionSchema.safeParse({ kind: 'has', who: 'target', what: 'talent', value, ...(spec === undefined ? {} : { spec }) }).success;
    const [sienne] = catalogueSpecs('talent', specialise!);
    expect(has(specialise!), specialise).toBe(true);
    expect(has(specialise!, sienne), `${specialise} (${sienne})`).toBe(true);
    expect(has(specialise!, FANTOME), `${specialise} (${FANTOME})`).toBe(false);
    expect(has(nu!), nu).toBe(true);
    expect(has(nu!, sienne), `${nu} (${sienne})`).toBe(false);
  });
});

describe('Condition `skill` — la spécialisation est une de celles de la Compétence', () => {
  it('Compétence fermée à catalogue : la sienne admise, une fantôme refusée ; sans catalogue : aucune', () => {
    const competences = [...idsDe('skill')];
    const specialisee = competences.find((id) => !entreeOuverte('skill', id) && catalogueSpecs('skill', id).length > 0);
    const nue = competences.find((id) => !estSpecialisable('skill', id));
    expect(specialisee).toBeDefined();
    expect(nue).toBeDefined();
    const skill = (id: string, spec?: string) => conditionSchema.safeParse({ kind: 'skill', id, ...(spec === undefined ? {} : { spec }) }).success;
    const [sienne] = catalogueSpecs('skill', specialisee!);
    expect(skill(specialisee!, sienne), `${specialisee} (${sienne})`).toBe(true);
    expect(skill(specialisee!, FANTOME), `${specialisee} (${FANTOME})`).toBe(false);
    expect(skill(nue!), nue).toBe(true);
    expect(skill(nue!, sienne), `${nue} (${sienne})`).toBe(false);
  });
});
