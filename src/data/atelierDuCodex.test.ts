/**
 * Contrat des transactions d'une entrée du Codex (`enregistrerEntree`, #3059 ; `supprimerEntree`, #4020) : l'entrée
 * valide est posée ou retirée et la source rendue sérialisée ; une entrée refusée laisse le dataset tel qu'avant. Ce qui
 * désigne une entrée (`designations`) se mesure au parse, dans `src/data` et dans les paquets passés.
 * Le dataset se pose et se restaure par son seam (`setDataset`, `resetData`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { designations, enregistrerEntree, supprimerEntree } from './atelierDuCodex';
import { reperesDuParse } from './schemas/grammaire/ref';
import { projetSchema } from './schemas/defs-scenes/projet';
import { versDisque } from './schemas/grammaire/prose';
import { suivreLeChemin } from './schemas/grammaire/cle-d-espace';
import { DATASET_DE_LA_CATEGORIE } from './schemas/_cles-de-dataset.generated';
import { RACINES_VIVANTES } from './schemas/_racines-vivantes.generated';
import diligence from '../scenes/diligence/diligence-projet.json';
import { ancetreDuDe, champDEnTete, datasetArray, deDeLaTable, entreesDuDataset, resetData, setDataset, type DatasetKey } from './overrides';
import { CATEGORY_DATASET_DERIVE } from './schemas/exposition-derivee';
import { effectTableDie, findEffectTableById } from './effectTables';
import { findTableEntry } from '../engine/tables';
import { miscastDie, miscastRowAt } from '../engine/miscast';
import { deDuVoyageRapide, resolveFastVoyage } from '../engine/seaVoyage';
import { makeRNG, type DiceSpec } from '../engine/dice';
import { deSelonLaPlage } from '../engine/dice.testkit';
import { scatter } from '../engine/scatter';
import { tirerLaReactionAuStatut, tirerLeCapricieux } from '../engine/social';
import { auChemin } from '../lib/objet.mjs';

type Entree = Record<string, unknown>;
const traits = () => datasetArray('traits');
let avant = traits().slice();
beforeEach(() => { avant = traits().slice(); });
afterEach(() => { setDataset('traits', avant); });

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

describe('enregistrerEntree — une référence morte d’un champ typé est refusée au parse, son catalogue nommé', () => {
  afterEach(() => resetData());
  /** L'issue d'une entrée `modifiee` de `categorie` à la position 0 ; le dataset reste celui d'avant. */
  const refus = (categorie: string, modifiee: (e: Entree) => Entree): string => {
    const ds = CATEGORY_DATASET_DERIVE[categorie] as DatasetKey;
    const premiere = entreesDuDataset(ds)[0];
    const issue = enregistrerEntree(categorie, modifiee(premiere), 0);
    expect(issue.ok, categorie).toBe(false);
    expect(entreesDuDataset(ds)[0], categorie).toBe(premiere);
    return issue.ok ? '' : issue.erreurs.join('\n');
  };

  it('un Trait inconnu d’une créature', () => {
    expect(refus('creatures', (e) => ({ ...e, traits: [{ id: 'trait-fantome' }] }))).toMatch(/« trait-fantome » est absent du catalogue des traits/);
  });

  it('un LIBELLÉ écrit à la place de l’id d’une séquelle de Critique (#173)', () => {
    expect(refus('criticalsTete', (e) => ({ ...e, traumas: ['Fracture'] }))).toMatch(/« Fracture » est absent du catalogue des séquelles/);
  });

  it('une dotation de POSSESSION `{ id, type }` d’un véhicule inconnu', () => {
    const marchand = datasetArray('careerLevels').findIndex((e) => e.id === 'marchand-1');
    const entree = datasetArray('careerLevels')[marchand];
    const trappings = entree.trappings.map((t) => ('type' in t && t.type === 'vehicle' ? { ...t, id: 'vehicule-fantome' } : t));
    const issue = enregistrerEntree('careerLevels', { ...entree, trappings }, marchand);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? '' : issue.erreurs.join('\n')).toMatch(/« vehicule-fantome » est absent du catalogue des véhicules/);
  });
});

describe('enregistrerEntree — écritures d’en-tête de la table (#1667)', () => {
  afterEach(() => resetData());
  const rangees = () => datasetArray('drunkenness');
  const de = (valeur: DiceSpec) => [{ ancetre: '', champ: 'die', valeur }];

  it('le dé posé s’écrit avec l’entrée, et la forme disque le porte', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de({ n: 2, sides: 10 }));
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(deDeLaTable('drunkenness')).toEqual({ n: 2, sides: 10 });
    expect(issue.texte).toMatch(/"die": \{\s*"n": 2,\s*"sides": 10\s*\}/);
  });

  it('un dé hors NdM (zéro dé) : la racine refusée REPREND l’en-tête', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de({ n: 0, sides: 10 }));
    expect(issue.ok).toBe(false);
    expect(deDeLaTable('drunkenness')).toEqual({ n: 1, sides: 10 });
  });

  it('une racine refusée par son schéma REPREND l’entrée ET l’en-tête, champ ajouté compris', () => {
    const entree = rangees()[0];
    const issue = enregistrerEntree('drunkenness', { ...entree, label: 42 }, 0, [...de({ n: 2, sides: 10 }), { ancetre: '', champ: 'ajout', valeur: 'x' }]);
    expect(issue.ok).toBe(false);
    expect(rangees()[0]).toBe(entree);
    expect(deDeLaTable('drunkenness')).toEqual({ n: 1, sides: 10 });
    expect(champDEnTete('drunkenness', '', 'ajout')).toBeUndefined();
  });

  it('toute catégorie dont un ancêtre porte le dé refuse un dé hors NdM et garde le sien', () => {
    const portees = Object.entries(CATEGORY_DATASET_DERIVE).flatMap(([categorie, ds]) => {
      const ancetre = ancetreDuDe(ds as DatasetKey);
      return ancetre === undefined ? [] : [{ categorie, ds: ds as DatasetKey, ancetre }];
    });
    expect(portees.length).toBeGreaterThan(0);
    for (const { categorie, ds, ancetre } of portees) {
      const avantDe = deDeLaTable(ds);
      const issue = enregistrerEntree(categorie, entreesDuDataset(ds)[0], 0, [{ ancetre, champ: 'die', valeur: { n: 0, sides: 10 } }]);
      expect(issue.ok, categorie).toBe(false);
      expect(deDeLaTable(ds), categorie).toEqual(avantDe);
    }
  });
});

describe('enregistrerEntree — les tables tirées s’éditent et le lecteur suit (#1667)', () => {
  afterEach(() => resetData());

  it('table d’effets : le dé et une rangée édités changent ce que tire le lecteur', () => {
    const tables = datasetArray('effectTables');
    const index = tables.findIndex((t) => t.id === 'allure-demoniaque-nurgle');
    const table = tables[index];
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 10).label).toBe(table.entries[9].label);
    const entries = table.entries.map((r, i) => (i === table.entries.length - 1 ? { ...r, max: 20, label: 'Rangée éditée' } : r));
    expect(enregistrerEntree('effectTables', { ...table, die: { n: 1, sides: 20 }, entries }, index).ok).toBe(true);
    expect(effectTableDie('allure-demoniaque-nurgle').sides).toBe(20);
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 15).label).toBe('Rangée éditée');
  });

  it('miscast VDM : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const rangees = datasetArray('imparfaiteMineureVdm');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe(rangees[0].label);
    expect(enregistrerEntree('imparfaiteMineureVdm', { ...rangees[0], label: 'Contrecoup édité' }, 0).ok).toBe(true);
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe('Contrecoup édité');
    expect(enregistrerEntree('imparfaiteMineureVdm', rangees[1], 1, [{ ancetre: '[miscast-mineure-vdm]', champ: 'die', valeur: { n: 2, sides: 50 } }]).ok).toBe(true);
    expect(miscastDie('miscast-mineure-vdm')).toMatchObject({ n: 2, sides: 50 });
  });

  it('Voyage rapide : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const paliers = datasetArray('seaFastVoyage');
    const parfait = paliers.findIndex((p) => p.id === 'parfait');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe(paliers[parfait].label);
    expect(enregistrerEntree('seaFastVoyage', { ...paliers[parfait], label: 'Palier édité' }, parfait).ok).toBe(true);
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe('Palier édité');
    expect(enregistrerEntree('seaFastVoyage', paliers[0], 0, [{ ancetre: 'fastVoyage', champ: 'die', valeur: { n: 1, sides: 20 } }]).ok).toBe(true);
    expect(deDuVoyageRapide()).toMatchObject({ n: 1, sides: 20 });
  });

  it('Dispersion : le dé édité est celui que tire le lecteur', () => {
    const rangees = datasetArray('dispersion');
    setDataset('dispersion', rangees.filter((r) => r.max <= 8));
    expect(enregistrerEntree('dispersion', rangees[0], 0, [{ ancetre: ancetreDuDe('dispersion')!, champ: 'die', valeur: { n: 1, sides: 8 } }]).ok).toBe(true);
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    // Face 8 du d8 = (+1, +1) ; 2d10 = 20 m, demi-distance 20 m → 10 tuiles.
    expect(scatter({ x: 0, y: 0 }, { x: 20, y: 20 }, de, 2)).toEqual({ x: 30, y: 30 });
    expect(plages[0]).toBe(8);
  });

  it('Capricieux et Réaction au Statut : le dé édité est celui que tire le lecteur', () => {
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    const capricieux = datasetArray('tableauCapricieux');
    setDataset('tableauCapricieux', capricieux.filter((r) => r.max <= 3));
    expect(enregistrerEntree('tableauCapricieux', capricieux[0], 0, [{ ancetre: ancetreDuDe('tableauCapricieux')!, champ: 'die', valeur: { n: 1, sides: 3 } }]).ok).toBe(true);
    expect(tirerLeCapricieux(de)).toEqual({ roll: 3, dr: -1 });
    const reaction = datasetArray('reactionAuStatut');
    setDataset('reactionAuStatut', reaction.filter((r) => r.max <= 2));
    expect(enregistrerEntree('reactionAuStatut', reaction[0], 0, [{ ancetre: ancetreDuDe('reactionAuStatut')!, champ: 'die', valeur: { n: 1, sides: 2 } }]).ok).toBe(true);
    expect(tirerLaReactionAuStatut(de)).toBe('braver-le-statut');
    expect(plages).toEqual([3, 2]);
  });
});

describe('designations et supprimerEntree — ce qui désigne une entrée, et son retrait (#4020)', () => {
  afterEach(() => resetData());
  const niveau = () => datasetArray('careerLevels')[0];

  it('un talent qu’un niveau de carrière accorde est désigné par lui, dit « fichier › chemin » ; une entrée neuve, par personne', () => {
    const cite = niveau().talents.flatMap((r) => ('id' in r ? [r.id] : []))[0];
    expect(designations('talents', cite, [])).toContain(`careerLevels.json › élément « ${niveau().id} » › Talents du Niveau 1 › identifiant`);
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: 'talent-sans-renvoi', label: 'Talent sans renvoi' }, -1).ok).toBe(true);
    expect(designations('talents', 'talent-sans-renvoi', [])).toEqual([]);
  });

  it('une entrée qui se désigne elle-même ne compte pas', () => {
    const entree = { ...datasetArray('talents')[0], id: 'talent-reflexif', label: 'Talent réflexif', passive: [{ op: 'grantTalent', talent: { id: 'talent-reflexif' } }] };
    expect(enregistrerEntree('talents', entree, -1).ok).toBe(true);
    expect(designations('talents', 'talent-reflexif', [])).toEqual([]);
  });

  it('une op posée dans une autre entrée désigne sa cible', () => {
    const base = datasetArray('talents')[0];
    expect(enregistrerEntree('talents', { ...base, id: 'talent-accorde', label: 'Talent accordé' }, -1).ok).toBe(true);
    expect(enregistrerEntree('talents', { ...base, id: 'talent-qui-accorde', label: 'Talent qui accorde', passive: [{ op: 'grantTalent', talent: { id: 'talent-accorde' } }] }, -1).ok).toBe(true);
    expect(designations('talents', 'talent-accorde', []).filter((d) => d.startsWith('talents.json › élément « talent-qui-accorde » › '))).toHaveLength(1);
  });

  it('une chaîne qu’aucun schéma ne type désigne l’entrée de même id : la mutation qu’une table de mutations tire', () => {
    const rangee = datasetArray('mutationTables').flatMap((t) => t.entries).find((r) => r.mutation !== undefined)!;
    const par = designations('mutations', rangee.mutation!, []);
    expect(par.filter((d) => d.startsWith('mutationTables.json › ')).length).toBeGreaterThan(0);
    const index = datasetArray('mutations').findIndex((m) => m.id === rangee.mutation);
    const mutations = datasetArray('mutations').slice();
    expect(supprimerEntree('mutations', index, []).ok).toBe(false);
    expect(datasetArray('mutations')).toEqual(mutations);
  });

  it('une référence typée vers un autre espace qui porte le même id ne désigne pas', () => {
    const competence = niveau().skills.flatMap((c) => ('id' in c ? [c.id] : []))[0];
    const parLaCompetence = designations('skills', competence, []).filter((d) => d.startsWith(`careerLevels.json › élément « ${niveau().id} » › `));
    expect(parLaCompetence.length).toBeGreaterThan(0);
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: competence, label: 'Talent homonyme' }, -1).ok).toBe(true);
    const datasetsDeLId = new Map<string, Set<string>>();
    for (const d of Object.values(DATASET_DE_LA_CATEGORIE)) {
      const collection = suivreLeChemin(RACINES_VIVANTES[d.fichier], d.chemin);
      for (const e of Array.isArray(collection) ? (collection as { id?: unknown }[]) : []) {
        if (typeof e.id === 'string') datasetsDeLId.set(e.id, (datasetsDeLId.get(e.id) ?? new Set()).add(d.cle));
      }
    }
    const collisions = [...datasetsDeLId].filter(([, cles]) => cles.size > 1);
    const diagnostic = `${collisions.length} id(s) portés par plusieurs datasets, qu'une chaîne non typée désigne tous : ${collisions.slice(0, 20).map(([id, cles]) => `${id} (${[...cles].join(', ')})`).join(' ; ')}`;
    expect(designations('talents', competence, []).filter((d) => parLaCompetence.includes(d)), diagnostic).toEqual([]);
    expect(designations('talents', competence, []).filter((d) => d.startsWith(`skills.json › élément « ${competence} »`)), 'la clé d’identité de la compétence homonyme ne désigne pas').toEqual([]);
  });

  it('un paquet passé compte : sa référence le désigne, dite sous son fichier', () => {
    const repere = reperesDuParse(projetSchema, versDisque(diligence)).find((r) => r.type === 'creature' && !r.parCle)!;
    const id = auChemin(diligence, repere.path) as string;
    const paquet = { fichier: 'diligence-projet.json', projet: diligence };
    expect(designations('creatures', id, [paquet]).filter((d) => d.startsWith('diligence-projet.json › ')).length).toBeGreaterThan(0);
    expect(designations('creatures', id, []).filter((d) => d.startsWith('diligence-projet.json › '))).toEqual([]);
  });

  it('supprimer une entrée désignée est refusé sans rien retirer', () => {
    const talents = datasetArray('talents').slice();
    const cite = talents.findIndex((t) => t.id === niveau().talents.flatMap((r) => ('id' in r ? [r.id] : []))[0]);
    const issue = supprimerEntree('talents', cite, []);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? [] : issue.erreurs).toContain(`désignée par careerLevels.json › élément « ${niveau().id} » › Talents du Niveau 1 › identifiant`);
    expect(datasetArray('talents')).toEqual(talents);
  });

  it('supprimer une entrée que personne ne désigne la retire, et rend la source sans elle', () => {
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: 'talent-a-retirer', label: 'Talent à retirer' }, -1).ok).toBe(true);
    const issue = supprimerEntree('talents', datasetArray('talents').findIndex((t) => (t.id as string) === 'talent-a-retirer'), []);
    expect(issue.ok).toBe(true);
    expect(issue.ok && issue.texte.includes('talent-a-retirer')).toBe(false);
    expect(datasetArray('talents').some((t) => (t.id as string) === 'talent-a-retirer')).toBe(false);
  });

  it('une racine que son schéma refuse sans l’entrée est REPRISE : le dataset revient à l’état d’avant', () => {
    const bandes = datasetArray('advancementCosts').slice();
    const issue = supprimerEntree('advancementCosts', 1, []);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? '' : issue.erreurs.join('\n')).toMatch(/ne couvrent pas les Augmentations déjà achetées d'un seul tenant/);
    expect(datasetArray('advancementCosts')).toEqual(bandes);
    expect(datasetArray('advancementCosts')[1]).toBe(bandes[1]);
  });

  it('une configuration unique ne se supprime pas', () => {
    expect(supprimerEntree('details', 0, [])).toEqual({ ok: false, erreurs: ['« details » n’est pas une liste d’entrées : rien ne s’y supprime'] });
  });
});
