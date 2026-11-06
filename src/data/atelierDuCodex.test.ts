/**
 * Contrat de la transaction d'enregistrement d'une entrée du Codex (`enregistrerEntree`, #3059) :
 * l'entrée valide est posée et rendue sérialisée ; une entrée refusée laisse le dataset tel qu'avant.
 * Le dataset se pose et se restaure par son seam (`setDataset`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enregistrerEntree } from './atelierDuCodex';
import { datasetArray, deDeLaTable, resetData, setDataset } from './overrides';

type Entree = Record<string, unknown>;
const traits = () => datasetArray('traits') as unknown as Entree[];
let avant: Entree[] = [];
beforeEach(() => { avant = traits().slice(); });
afterEach(() => { setDataset('traits', avant as never); });

describe('enregistrerEntree — transaction d’une entrée éditée', () => {
  it('une entrée valide est posée à sa position et rendue en forme disque', () => {
    const editee = { ...avant[0], label: 'Libellé édité' };
    const issue = enregistrerEntree('traits', editee, 0);
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(issue.fichier).toBe('traits.json');
    expect(issue.texte).toContain('"label": "Libellé édité"');
    expect(traits()[0].label).toBe('Libellé édité');
    expect(traits()).toHaveLength(avant.length);
  });

  it('une entrée NEUVE (index −1) est ajoutée en fin de dataset', () => {
    const neuve = { ...avant[0], id: 'trait-neuf-du-contrat', label: 'Trait neuf' };
    expect(enregistrerEntree('traits', neuve, -1).ok).toBe(true);
    expect(traits()[traits().length - 1].id).toBe('trait-neuf-du-contrat');
    expect(traits()).toHaveLength(avant.length + 1);
  });

  it('une racine que son schéma refuse est REPRISE : le dataset revient à l’état d’avant', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], label: 42 }, 0);
    expect(issue.ok).toBe(false);
    if (issue.ok) return;
    expect(issue.erreurs.length).toBeGreaterThan(0);
    expect(traits()).toEqual(avant);
    expect(traits()[0]).toBe(avant[0]);
  });

  it('une collision d’id est refusée sans rien poser', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], id: avant[1].id }, 0);
    expect(issue).toEqual({ ok: false, erreurs: [`id « ${String(avant[1].id)} » déjà pris par une autre entrée`] });
    expect(traits()[0]).toBe(avant[0]);
  });

  it('une réf d’op requise manquante est refusée sans rien poser', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], passive: [{ op: 'grantTalent', talent: {} }] }, 0);
    expect(issue).toEqual({ ok: false, erreurs: ['Accorder un Talent : Talent à choisir'] });
    expect(traits()[0]).toBe(avant[0]);
  });
});

describe('enregistrerEntree — dé de tirage de la table (#1667)', () => {
  afterEach(() => resetData());
  const rangees = () => datasetArray('drunkenness') as unknown as Entree[];

  it('le dé posé s’écrit avec l’entrée, et la forme disque le porte', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, '2d10');
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(deDeLaTable('drunkenness')).toBe('2d10');
    expect(issue.texte).toContain('"die": "2d10"');
  });

  it('un dé illisible est refusé sans rien poser', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, 'beaucoup');
    expect(issue.ok).toBe(false);
    expect(deDeLaTable('drunkenness')).toBe('d10');
  });

  it('une racine refusée par son schéma REPREND aussi le dé', () => {
    const issue = enregistrerEntree('drunkenness', { ...rangees()[0], label: 42 }, 0, '2d10');
    expect(issue.ok).toBe(false);
    expect(deDeLaTable('drunkenness')).toBe('d10');
  });
});
