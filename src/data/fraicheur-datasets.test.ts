/**
 * CONTRAT DE FRAÎCHEUR (#1692) — une écriture au seam est vue par les LECTEURS, sans rechargement.
 *
 * CONTRAT : après une édition au Codex (`setDataset`, la porte de `CodexEdit.save`), chaque accesseur
 * sert l'entrée ÉDITÉE et voit une entrée NEUVE — aucun lecteur ne peut tenir un index figé à l'import.
 * Ces cas ne sont pas théoriques : `traits`, `trappings`, `characteristics` et `props` sont tous édités par l'atelier
 * (`exposition.edit` de leur def).
 *
 * Restauration `afterEach` par le seam lui-même : aucun test ne touche un dataset autrement.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  traits, trappings, characteristics, props, etats, weather, vehicles,
  findTraitById, findTrappingById, findPropById, charAbr, traitIdByLabel,
} from './index';
import { travelVehicles, travelModeLabels } from '../engine/travel';
import { consolidateAmputations, traumaById, type TraumaFiche } from '../engine/trauma';
import type { Combatant } from '../engine/types';
import { mutationTableIds, mutationTableLabel, mutationTableRows, type MutationTable } from './mutations';
import { rollMiscast, miscastRowAt, MISCAST_TABLE_ROWS, type MiscastTableRow } from '../engine/miscast';
import { makeRNG } from '../engine/dice';
import { tableStepDef, tableStepIds } from '../state/cascade';
import { stageWeatherRows } from '../state/travelFlow';
// La FAMILLE des Tableaux de Corruption s'enregistre au chargement de son module : on l'importe par
// ce qu'on en LIT (l'id de table d'une nature + un alignement), jamais par un import d'effet de bord.
import { mutationTableIdFor } from '../state/corruptionFlow';
import { setDataset, datasetArray } from './overrides';
import { knownTraitId, traitLabelById } from '../engine/traits/dispatch';
import { conditionIdInText, conditionSeverity } from '../engine/conditions';
import { versionDuDataset } from './versionDataset';
import { emptyScene, sceneMetresPerTile } from '../state/scene';
import { worldBakeDeps } from '../gameIso/backends/webgl/sceneMeshes';

const TRAITS_LIVRES = [...traits];
const POSSESSIONS_LIVREES = [...trappings];
const CARACS_LIVREES = [...characteristics];
const DECORS_LIVRES = [...props];
const ETATS_LIVRES = [...etats];
const SAISONS_LIVREES = [...weather];
const VEHICULES_LIVRES = [...vehicles];
const TRAUMAS_LIVRES = [...(datasetArray('traumas') as TraumaFiche[])];
const TABLES_MUTATION_LIVREES = [...(datasetArray('mutationTables') as MutationTable[])];
const MISCAST_MINEURE_LIVREE = [...(datasetArray('miscastMinor') as MiscastTableRow[])];

afterEach(() => {
  setDataset('mutationTables', TABLES_MUTATION_LIVREES);
  setDataset('miscastMinor', MISCAST_MINEURE_LIVREE);
  setDataset('weather', SAISONS_LIVREES);
  setDataset('vehicles', VEHICULES_LIVRES);
  setDataset('traumas', TRAUMAS_LIVRES);
  setDataset('traits', TRAITS_LIVRES);
  setDataset('trappings', POSSESSIONS_LIVREES);
  setDataset('characteristics', CARACS_LIVREES);
  setDataset('props', DECORS_LIVRES);
  setDataset('etats', ETATS_LIVRES);
});

describe('#1692 — une édition au seam est SERVIE aux lecteurs', () => {
  it('un Trait RENOMMÉ : `findTraitById`, `traitLabelById` et `knownTraitId` servent le NOUVEAU libellé', () => {
    const avant = findTraitById('venin')!;
    expect(avant.label).toBe('Venin');
    setDataset('traits', traits.map((t) => (t.id === 'venin' ? { ...t, label: 'Venin des marais' } : t)));
    expect(findTraitById('venin')!.label).toBe('Venin des marais');
    expect(traitLabelById('venin')).toBe('Venin des marais');
    // L'`id` est STABLE : un renommage ne le déplace pas — c'est le LIBELLÉ reconnu qui change (le
    // texte d'un statbloc « Venin des marais » résout l'id `venin`, « Venin » ne nomme plus rien).
    expect(knownTraitId('Venin des marais')).toBe('venin');
    expect(knownTraitId('Venin')).toBeUndefined();
    expect(traitIdByLabel('venin des marais')).toBe('venin');
  });

  it('une Possession NEUVE est résolue par `findTrappingById` dès son ajout', () => {
    expect(findTrappingById('sonde-1692')).toBeUndefined();
    setDataset('trappings', [...trappings, { ...trappings[0], id: 'sonde-1692', label: 'Sonde 1692' }]);
    expect(findTrappingById('sonde-1692')!.label).toBe('Sonde 1692');
  });

  it('une Caractéristique dont l’ABRÉVIATION change : l’écran la lit à la donnée', () => {
    expect(charAbr('capacite-de-combat')).toBe('CC');
    setDataset('characteristics', characteristics.map((c) => (c.id === 'capacite-de-combat' ? { ...c, abr: 'ZZ' } : c)));
    expect(charAbr('capacite-de-combat')).toBe('ZZ');
  });

  it('un décor ÉDITÉ : `findPropById` rend la NOUVELLE entrée ET le READ-SET du bake porte une dep NEUVE', () => {
    // La scène pose un décor VOLUMIQUE : `worldBakeDeps` y lit sa RECETTE (`propRecipeDeps`), donc la
    // fraîcheur se MESURE sur la dep elle-même — pas seulement sur l'identité rendue par l'accesseur.
    // L'édition porte donc sur ce qui CUIT (la recette) : un libellé seul ne recuit rien, par dessein.
    const scene = emptyScene(6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);
    const avant = findPropById('tonneau')!;
    expect(depsAvant).toContain(avant.volume); // la recette du tonneau EST une dep du bake

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau ébréché', volume: { ...p.volume! } } : p)));
    const apres = findPropById('tonneau')!;
    expect(apres.label).toBe('Tonneau ébréché');
    expect(apres).not.toBe(avant);

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.some((d, i) => d !== depsAvant[i]), 'aucune dep du bake n’a bougé : le monde resterait cuit sur l’ancien décor').toBe(true);
    expect(depsApres).toContain(apres.volume);
  });

  it('ISOLANT : un décor édité HORS de sa recette ne fait bouger AUCUNE dep du bake', () => {
    // Contrepartie du cas précédent : il assère qu'une dep CHANGE, ce qui ne vaut que si toute
    // édition ne les fait pas toutes changer. Ici l'édition ne touche QUE le libellé — la recette
    // (`volume`) garde son identité —, et le read-set doit être identique élément par élément.
    const scene = emptyScene(6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau signé' } : p)));
    expect(findPropById('tonneau')!.label).toBe('Tonneau signé');

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.filter((d, i) => d !== depsAvant[i]), 'le bake se déclencherait sur une édition qui ne cuit rien').toEqual([]);
  });

  it('un État RENOMMÉ : le journal reconnaît le NOUVEAU libellé, et son importance suit l’id', () => {
    expect(conditionIdInText('Grim est Sonné')).toBe('sonne');
    setDataset('etats', etats.map((e) => (e.id === 'sonne' ? { ...e, label: 'Assommé' } : e)));
    expect(conditionIdInText('Grim est Assommé')).toBe('sonne');
    expect(conditionIdInText('Grim est Sonné')).toBeUndefined();
    // Ce que le journal en fait (`state/combatLog.isImportantEvent`) : la sévérité se lit sur l’ID rendu,
    // 80 pour `sonne` — le libellé n’a servi qu’à le reconnaître dans un texte français.
    expect(conditionSeverity(conditionIdInText('Grim est Assommé')!)).toBe(80);
  });

  it('un marqueur NARRATIF hors catalogue (Pétrifié, LDB 85) reste reconnu par le même scan', () => {
    expect(conditionIdInText('La statue : Ulrika est Pétrifié')).toBe('petrifie');
    expect(conditionSeverity('petrifie')).toBe(95);
  });

  it('une saison RETIRÉE de `weather` quitte le REGISTRE des tables d’étape, pour tout lecteur', () => {
    // Le registre des tables tirables est VIF : la famille de `travelFlow` rend ses ids et ses defs à
    // CHAQUE lecture. Avec l'enregistrement posé par effet de bord d'un mémo, la table survivait à la
    // suppression de sa saison, et n'existait pour un lecteur (cascade reprise d'une sauvegarde,
    // fenêtre de pose) qu'après le passage du site qui ouvrait l'étape.
    const saison = weather[weather.length - 1];
    const id = `stage-weather-${saison.id}`;
    expect(tableStepDef(id)!.rows).toEqual(stageWeatherRows(saison.ranges));
    expect(tableStepIds()).toContain(id);

    setDataset('weather', weather.filter((s) => s.id !== saison.id));
    expect(tableStepDef(id), 'une saison supprimée au Codex garde sa table tirable').toBeUndefined();
    expect(tableStepIds()).not.toContain(id);

    // Et la saison qui RESTE garde la sienne : la famille n'a pas vidé le registre, elle l'a refait.
    expect(tableStepDef(`stage-weather-${weather[0].id}`)).toBeDefined();
  });

  it('un Tableau de Corruption ÉDITÉ : fourchettes, libellé et table NEUVE servis à tous ses lecteurs', () => {
    // La sonde du juge, promue en cas POSITIF : `mutations.ts` indexait `mutationTables` à l'import
    // (`TABLE_BY_ID`/`ROWS_BY_TABLE`/`MUTATION_TABLE_IDS`), si bien qu'une édition au Codex laissait
    // les lignes d'étape, le libellé et le registre des tables tirables sur l'état d'AVANT.
    const tables = datasetArray('mutationTables') as MutationTable[];
    const physique = tables.find((t) => t.id === 'physique')!;
    const avant = mutationTableRows('physique')[0];
    expect(mutationTableLabel('physique')).toBe(physique.label);
    const idsAvant = mutationTableIds().length;

    const neuve: MutationTable = { ...physique, id: 'table-neuve-qc', label: 'Table neuve QC' };
    setDataset('mutationTables', [
      ...tables.map((t) => (t.id === 'physique'
        ? { ...t, label: 'Physique (révisée QC)', ranges: [{ ...t.ranges[0], max: 99 }, ...t.ranges.slice(1)] }
        : t)),
      neuve,
    ]);

    expect(mutationTableRows('physique')[0].max, 'la fourchette éditée n’atteint pas les lignes d’étape').toBe(99);
    expect(mutationTableRows('physique')[0].max).not.toBe(avant.max);
    expect(mutationTableLabel('physique')).toBe('Physique (révisée QC)');
    expect(mutationTableIds()).toContain('table-neuve-qc');
    expect(mutationTableIds().length).toBe(idsAvant + 1);
    // Et le REGISTRE des tables tirables suit : la table neuve est jouable, pour tout lecteur.
    expect(tableStepDef('table-neuve-qc')).toBeDefined();
    expect(tableStepIds()).toContain('table-neuve-qc');
    expect(tableStepDef(mutationTableIdFor('physique', 'khorne'))).toBeDefined();
    expect(tableStepDef('physique')!.rows[0].max).toBe(99);
  });

  it('une rangée d’Incantation Imparfaite ÉDITÉE : `rollMiscast` joue la NOUVELLE, comme `miscastRowAt`', () => {
    // `RUNTIME_ROWS` dépliait les rangées (ops closées, Tests) une fois à l'import : `rollMiscast`
    // servait le libellé d'AVANT pendant que `miscastRowAt` servait déjà le nouveau.
    const rangees = MISCAST_TABLE_ROWS['miscast-mineure'];
    const premiere = rangees[0];
    const de = premiere.min;
    expect(rollMiscast('mineure', makeRNG(1), 0, undefined, de).label).toBe(premiere.label);

    setDataset('miscastMinor', rangees.map((r) => (r.id === premiere.id ? { ...r, label: 'Contrecoup révisé QC' } : r)));

    expect(miscastRowAt('miscast-mineure', de).label).toBe('Contrecoup révisé QC');
    expect(rollMiscast('mineure', makeRNG(1), 0, undefined, de).label).toBe('Contrecoup révisé QC');
  });

  it('un véhicule de voyage ÉDITÉ ou NEUF : `travelVehicles` et les libellés de mode le servent', () => {
    // `engine/travel.ts` atteint `vehicles.json` par IMPORT JSON DIRECT + alias (`VEHICLES_LIST`) :
    // ses transports payants et sa table de libellés étaient figés à l'import, donc une diligence
    // renommée au Codex gardait son ancien nom à l'écran de voyage, et un véhicule neuf n'existait pas.
    const diligence = vehicles.find((v) => v.id === 'diligence')!;
    expect(travelModeLabels().diligence).toBe(diligence.label);
    const neuf = { ...diligence, id: 'coche-1692', label: 'Coche 1692' };
    setDataset('vehicles', [
      ...vehicles.map((v) => (v.id === 'diligence' ? { ...v, label: 'Diligence révisée QC' } : v)),
      neuf,
    ]);
    expect(travelVehicles().map((v) => v.id)).toContain('coche-1692');
    expect(travelModeLabels()['coche-1692']).toBe('Coche 1692');
    expect(travelModeLabels().diligence).toBe('Diligence révisée QC');
    expect(travelModeLabels().pied, 'les modes FIXES restent servis').toBe('À pied');
  });

  it('une règle de CUMUL éditée (`traumas.json`) : la consolidation applique la NOUVELLE', () => {
    // `engine/trauma.ts` lit `traumas.json` par import direct + alias (`FICHES`) : les fiches à cumul
    // étaient filtrées une fois à l'import — un seuil d'escalade édité au Codex ne changeait rien.
    const fiches = datasetArray('traumas') as TraumaFiche[];
    const doigt = fiches.find((f) => f.id === 'doigt-ampute')!;
    expect(doigt.cumul!.escalade!.atLeast).toBe(4);
    const porteur = (): Combatant => ({
      ...({ id: 'h1', label: 'Grim' } as Combatant),
      traumas: [traumaById('doigt-ampute', undefined, 'brasG'), traumaById('doigt-ampute', undefined, 'brasG')],
    });

    const avant = porteur();
    consolidateAmputations(avant);
    expect(avant.traumas!.map((t) => t.traumaId)).not.toContain('main-bras-ampute');

    setDataset('traumas', fiches.map((f) => (f.id === 'doigt-ampute'
      ? { ...f, cumul: { ...f.cumul!, escalade: { ...f.cumul!.escalade!, atLeast: 2 } } }
      : f)));

    const apres = porteur();
    consolidateAmputations(apres);
    expect(apres.traumas!.map((t) => t.traumaId), 'le seuil édité n’atteint pas la consolidation').toContain('main-bras-ampute');
  });

  it('la VERSION du dataset est le témoin : elle avance à chaque écriture, et à elle seule', () => {
    const v = versionDuDataset('traits');
    const vAutre = versionDuDataset('trappings');
    setDataset('traits', [...traits]);
    expect(versionDuDataset('traits')).toBe(v + 1);
    expect(versionDuDataset('trappings')).toBe(vAutre);
  });
});
