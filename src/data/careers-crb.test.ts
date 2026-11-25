/**
 * #4898 — les 64 Carrières du livre de base 5e (`<id v4>-5e`), source de Carrières de plus derrière la règle
 * optionnelle `carrieres-crb` (`gatedByRule`, servie par `ouvertParSaRegle`), leurs listes jouées par les ids 4e.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { careerLevels, careers, ouvertParSaRegle, carrieresTirables, findSpeciesById, offreDuJet } from '.';
import { resetRule, setRule } from '../engine/policy';

const REGLE = 'carrieres-crb';
const CRB = careers.filter((c) => c.id.endsWith('-5e'));
const niveauxDe = (career: string) =>
  careerLevels.filter((l) => l.career.id === career).sort((a, b) => a.level - b.level);

afterEach(() => resetRule(REGLE));

describe('Carrières du CRB derrière leur règle optionnelle', () => {
  it('règle inactive (défaut) : aucune Carrière -5e ouverte ; active : les 64', () => {
    expect(CRB).toHaveLength(64);
    expect(CRB.filter(ouvertParSaRegle)).toEqual([]);
    setRule(REGLE, true);
    expect(CRB.filter(ouvertParSaRegle)).toHaveLength(64);
  });
});

describe('Au tirage, la Carrière du CRB s’offre à la place de sa jumelle, aux espèces de sa Classe (CRB 013 l.7-11)', () => {
  const espece = (id: string) => findSpeciesById(id)!;

  it('règle active : le jet du Soldat offre aussi soldat-5e ; inactive : la seule jumelle', () => {
    expect(offreDuJet(espece('humains-reiklander'), { id: 'soldat' })).toEqual(['soldat']);
    setRule(REGLE, true);
    expect(offreDuJet(espece('humains-reiklander'), { id: 'soldat' })).toEqual(['soldat', 'soldat-5e']);
  });

  it('la Classe borne l’espèce : le Tueur du CRB aux seuls Nains (CRB 018 l.3057)', () => {
    setRule(REGLE, true);
    expect(carrieresTirables(espece('nains'), false).map((c) => c.id)).toContain('tueur-5e');
    expect(carrieresTirables(espece('humains-reiklander'), false).map((c) => c.id)).not.toContain('tueur-5e');
  });

  it('chaque Carrière du CRB se substitue à sa jumelle v4', () => {
    expect(CRB.filter((c) => c.aLaPlaceDe?.id !== c.id.slice(0, -'-5e'.length))).toEqual([]);
  });
});

describe('soldat-5e : les listes de CRB 018 l.3209-3239, en ids 4e', () => {
  const [recrue, soldat, sergent, officier] = niveauxDe('soldat-5e');

  it('Recrue — CRB 018 l.3209-3213 ; Schéma CRB 018 l.3203-3205', () => {
    expect(recrue.skills).toEqual([
      { id: 'athletisme' }, { id: 'escalade' }, { id: 'calme' }, { id: 'esquive' }, { id: 'resistance' }, { id: 'pari' },
      { id: 'langue', spec: 'bataille' }, { id: 'corps-a-corps', choix: true }, { id: 'corps-a-corps', spec: 'base' },
      { id: 'projectiles', choix: true },
    ]);
    expect(recrue.talents).toEqual([{ id: 'coude-a-coude' }, { id: 'savoir-vivre', spec: 'soldats' }, { id: 'infatigable' }, { id: 'guerrier-ne' }]);
    expect(recrue.status).toEqual({ tier: 'bronze', standing: 5 });
    expect(recrue.characteristics).toEqual(['capacite-de-combat', 'capacite-de-tir', 'force']);
  });

  // Niveaux 2-4 : cases verte, argent et or du Schéma (CRB 018 l.41), lues dans le PDF au folio 96.
  it('Soldat — CRB 018 l.3217-3221', () => {
    expect(soldat.skills).toEqual([
      { id: 'resistance-a-l-alcool' }, { id: 'divertissement', spec: 'narration' }, { id: 'intimidation' },
      { id: 'survie-en-exterieur' }, { id: 'perception' }, { id: 'musicien', choix: ['tambour', 'flute', 'cor'] },
    ]);
    expect(soldat.talents).toEqual([{ id: 'maitrise-des-des' }, { id: 'tireur-de-precision' }, { id: 'rechargement-rapide' }, { id: 'porte-bouclier' }]);
    expect(soldat.status).toEqual({ tier: 'argent', standing: 2 });
    expect(soldat.characteristics).toEqual(['force-mentale']);
  });

  it('Sergent — CRB 018 l.3225-3229', () => {
    expect(sergent.skills).toEqual([{ id: 'guerison' }, { id: 'commandement' }, { id: 'savoir', spec: 'guerre' }, { id: 'orientation' }]);
    expect(sergent.talents).toEqual([{ id: 'vigilance' }, { id: 'combattant-en-espace-clos' }, { id: 'inebranlable' }, { id: 'seigneur-de-guerre' }]);
    expect(sergent.status).toEqual({ tier: 'argent', standing: 3 });
    expect(sergent.characteristics).toEqual(['endurance']);
  });

  it('Officier — CRB 018 l.3233-3237', () => {
    expect(officier.skills).toEqual([{ id: 'savoir', spec: 'heraldique' }, { id: 'chevaucher', spec: 'cheval' }]);
    expect(officier.talents).toEqual([{ id: 'exaltant' }, { id: 'orateur' }, { id: 'lire-ecrire' }, { id: 'coeur-vaillant' }]);
    expect(officier.status).toEqual({ tier: 'or', standing: 1 });
    expect(officier.characteristics).toEqual(['initiative']);
  });
});

describe('Schéma de progression des Carrières -5e : 3/1/1/1 nouvelles par niveau, comme la donnée 4e (CRB 018 l.41-43)', () => {
  it.each(CRB.map((c) => c.id))('%s', (id) => {
    const niveaux = niveauxDe(id);
    expect(niveaux.map((l) => l.level)).toEqual([1, 2, 3, 4]);
    expect(niveaux.map((l) => l.characteristics.length)).toEqual([3, 1, 1, 1]);
    expect(new Set(niveaux.flatMap((l) => l.characteristics)).size).toBe(6);
  });
});
