/**
 * Cadre de campagne (#717) — porte de DONNÉE du bloc `narratif` : l'ouverture cérémonielle et la
 * clôture du chapitre sont OPTIONNELLES (les paquets sans cadre restent valides), leurs champs
 * porteurs sont exigés, et la Condition de clôture est bornée aux kinds évaluables hors combat
 * (sinon elle serait FAUSSE en silence : le chapitre ne se fermerait jamais).
 */
import { describe, it, expect } from 'vitest';
import { narratifSchema } from './narratif';

const vide = { affaires: [], indices: [], presetsPnj: [], objets: [] };
const ouverture = { titre: 'L’Ennemi Intérieur', pitch: 'Nos héros forment un groupe hétéroclite.' };

describe('narratifSchema — cadre de campagne (#717)', () => {
  it('un narratif SANS ouverture ni clôture parse (les 4 registres suffisent)', () => {
    expect(narratifSchema.safeParse(vide).success).toBe(true);
  });

  it('une ouverture COMPLÈTE parse (surtitre/sousTitre/chapitre/source/ambiance optionnels)', () => {
    const r = narratifSchema.safeParse({
      ...vide,
      ouverture: {
        ...ouverture,
        surtitre: 'Une campagne pour Warhammer Fantasy Roleplay',
        sousTitre: 'Tome 1',
        chapitre: 'Chapitre 1',
        source: { book: 'ennemi-dans-l-ombre', page: 12, note: 'EDO 01 l.5' },
        ambiance: 'veillee',
      },
    });
    expect(r.success).toBe(true);
  });

  it('une ouverture SANS titre est refusée, et le message NOMME le champ', () => {
    const r = narratifSchema.safeParse({ ...vide, ouverture: { pitch: 'x' } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('titre');
  });

  it('une ouverture SANS pitch (ou à pitch vide) est refusée, et le message NOMME le champ', () => {
    const sans = narratifSchema.safeParse({ ...vide, ouverture: { titre: 'x' } });
    expect(sans.success).toBe(false);
    expect(JSON.stringify(sans.error?.issues)).toContain('pitch');
    const vide2 = narratifSchema.safeParse({ ...vide, ouverture: { titre: 'x', pitch: '' } });
    expect(vide2.success).toBe(false);
    expect(JSON.stringify(vide2.error?.issues)).toContain('pitch');
  });

  it('une ambiance hors des deux strates connues est refusée', () => {
    expect(narratifSchema.safeParse({ ...vide, ouverture: { ...ouverture, ambiance: 'aurore' } }).success).toBe(false);
  });

  it('une clôture `flag` parse ; un kind INCONNU et un kind non évaluable hors combat sont refusés', () => {
    expect(narratifSchema.safeParse({
      ...vide,
      cloture: { when: { kind: 'flag', expr: 'edo-ch1-altdorf-revelee' }, titre: 'Chapitre 1 — accompli' },
    }).success).toBe(true);
    expect(narratifSchema.safeParse({
      ...vide,
      cloture: { when: { kind: 'jamais-vu' }, titre: 'x' },
    }).success).toBe(false);
    const horsContexte = narratifSchema.safeParse({
      ...vide,
      cloture: { when: { kind: 'slThreshold', op: '>=', value: 2 }, titre: 'x' },
    });
    expect(horsContexte.success).toBe(false);
    expect(JSON.stringify(horsContexte.error?.issues)).toContain('slThreshold');
  });

  it('une clôture SANS titre est refusée', () => {
    const r = narratifSchema.safeParse({ ...vide, cloture: { when: { kind: 'always' } } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('titre');
  });

  /**
   * La clôture NEUVE de l'éditeur (`NarratifEditor`, « Ajouter une clôture ») naît en
   * `{kind:'flag', expr:''}` : NON satisfiable, et REFUSÉE à la sauvegarde tant que l'auteur n'a pas
   * nommé son drapeau. Le défaut d'avant (`{kind:'always'}`) était satisfiable D'EMBLÉE : le premier
   * lot d'effets de la partie fermait le chapitre.
   */
  it('la clôture NEUVE de l’éditeur ne se sauvegarde pas telle quelle : le drapeau vide est NOMMÉ', () => {
    const r = narratifSchema.safeParse({ ...vide, cloture: { when: { kind: 'flag', expr: '' }, titre: 'Chapitre 1' } });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('expr');
  });
});

/**
 * Lien vers les fiches de dossier de chapitre (#2290) : `couvre` sur un preset PNJ et sur un indice
 * (`couvreSchema`, `./communs.ts`), et le registre `ecartes` — une entrée de fiche écartée par
 * l'adaptation, au format `ID_D_ENTREE` (`src/data/source/dossier.ts`), avec un motif non vide, une
 * seule fois.
 */
describe('narratifSchema — `couvre` et `ecartes` (#2290)', () => {
  const affaire = { id: 'affaire-a', titre: 'x' };
  const indice = (over: Record<string, unknown> = {}) => ({ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'x', stades: [{ id: 'stade-1', prose: '' }], ...over });
  const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
    (r.error?.issues ?? []).map((i) => `${i.path.join('.')} :: ${i.message}`);

  it('`couvre` passe sur un preset PNJ et sur un indice ; hors format ou en double, refusé au chemin', () => {
    expect(narratifSchema.safeParse({ ...vide, presetsPnj: [{ id: 'le-borgne', base: 'gobelin', couvre: ['EDO-01#pnj2'] }] }).success).toBe(true);
    expect(narratifSchema.safeParse({ ...vide, affaires: [affaire], indices: [indice({ couvre: ['EDO-01#ind1', 'EDO-01#sec1'] })] }).success).toBe(true);
    expect(issues(narratifSchema.safeParse({ ...vide, presetsPnj: [{ id: 'le-borgne', base: 'gobelin', couvre: ['pnj2'] }] })))
      .toEqual(['presetsPnj.0.couvre.0 :: entrée de fiche : « <ABBR>-<NN>#<id> » attendu.']);
    expect(issues(narratifSchema.safeParse({ ...vide, affaires: [affaire], indices: [indice({ couvre: ['EDO-01#ind1', 'EDO-01#ind1'] })] })))
      .toEqual(['indices.0.couvre.1 :: « EDO-01#ind1 » dupliqué : « entrée de fiche » identifie l’élément dans sa liste, il y est unique.']);
  });

  it('`ecartes` : une entrée et son motif passent ; le registre est optionnel', () => {
    expect(narratifSchema.safeParse({ ...vide, ecartes: [{ entree: 'EDO-01#b7', motif: 'Scène coupée : la diligence ne s’arrête pas au relais.' }] }).success).toBe(true);
    expect(narratifSchema.safeParse({ ...vide, ecartes: [] }).success).toBe(true);
  });

  it('`ecartes` : entrée hors format, entrée en double, motif vide ou blanc, refusés au chemin', () => {
    expect(issues(narratifSchema.safeParse({ ...vide, ecartes: [{ entree: 'EDO-01', motif: 'x' }] })))
      .toEqual(['ecartes.0.entree :: entrée de fiche : « <ABBR>-<NN>#<id> » attendu.']);
    expect(issues(narratifSchema.safeParse({ ...vide, ecartes: [{ entree: 'EDO-01#b7', motif: 'x' }, { entree: 'EDO-01#b7', motif: 'y' }] })))
      .toEqual(['ecartes.1 :: « EDO-01#b7 » dupliqué : « entree » identifie l’élément dans sa liste, il y est unique.']);
    expect(issues(narratifSchema.safeParse({ ...vide, ecartes: [{ entree: 'EDO-01#b7', motif: '' }] }))).toEqual(['ecartes.0.motif :: motif vide.']);
    expect(issues(narratifSchema.safeParse({ ...vide, ecartes: [{ entree: 'EDO-01#b7', motif: '   ' }] }))).toEqual(['ecartes.0.motif :: motif vide.']);
  });
});
