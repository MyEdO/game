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
import { mutationTableIds, mutationTablePlayerLabel, mutationTableRows, type MutationTable } from './mutations';
import { rollMiscast, miscastRowAt, MISCAST_TABLES, type MiscastTableRow } from '../engine/miscast';
import { makeRNG } from '../engine/dice';
import { tableTotale } from '../lib/tableTotale';
import { tableStepDef, tableStepIds } from '../state/cascade';
import { stageWeatherRows } from '../state/travelFlow';
// La FAMILLE des Tableaux de Corruption s'enregistre au chargement de son module : on l'importe par
// ce qu'on en LIT (l'id de table d'une nature + un alignement), jamais par un import d'effet de bord.
import { mutationTableIdFor } from '../state/corruptionFlow';
import { setDataset, datasetArray, setObjectDataset, datasetObject, type ObjectDatasetKey } from './overrides';
import { cargoes, findCargoById, type CargoDef } from '../engine/seaVoyage';
import { landCargoes, findLandCargoById, type LandCargoDef } from '../engine/landCargo';
import { advanceCost } from '../engine/advancement';
import { shipSizeOfLength } from '../engine/shipBuild';
import {
  tickRiverWind, navBaseDifficulty, tackDifficulty, driftPctOfSpeed, navPenaltyMods, rowingAgilityDifficulty,
  capsizeRightDifficulty, capsizeRightCumulative, type RiverWindForceId,
} from '../engine/riverNavigation';
import { tickWindForce, tickWindForceDay, type SeaWindForceId } from '../engine/seaWeather';
import { rollAvailability, barterRatio } from '../engine/disponibilite';
import { dawnMinute, duskMinute, isTravelDaylight, daysPerYear } from '../engine/clock';
import { sunJeuHalfArcMin } from '../gameIso/backends/webgl/sunJeu';
import { SEA_BOARD_EVENT_TABLE } from '../state/seaVoyageFlow';
import { FLOW_STAKES, COMBAT_STAKES, flowStakeRef, combatStakeRef, resolveStake, seaShanties, maladies } from './index';
import type { RNG } from '../engine/dice';
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
/** Les datasets des vues dérivées migrées (#1692) : restaurés par le seam, comme les autres. */
const LISTES_LIVREES = tableTotale(
  ['seaCargo', 'landCargo', 'advancementCosts', 'shipHullSizes', 'calendarPhases', 'calendarMonths', 'calendarIntercalary', 'flowStakes', 'combatStakes', 'seaBoardEvents'] as const,
  (k) => structuredClone(datasetArray(k)),
) as { [K in 'seaCargo' | 'landCargo' | 'advancementCosts' | 'shipHullSizes' | 'calendarPhases' | 'calendarMonths' | 'calendarIntercalary' | 'flowStakes' | 'combatStakes' | 'seaBoardEvents']: ReturnType<typeof datasetArray<K>> };
const OBJETS_LIVRES = tableTotale(
  ['riverNavigation', 'seaWeather', 'disponibilite'] as const, (k) => structuredClone(datasetObject(k)),
) as { [K in 'riverNavigation' | 'seaWeather' | 'disponibilite']: ReturnType<typeof datasetObject<K>> };
/** Un dé qui rend toujours `n` : le cran de vent se force (seuil 1, puis « forcir »). */
const deFixe = (n: number): RNG => ({ int: () => n });

afterEach(() => {
  for (const k of Object.keys(LISTES_LIVREES) as (keyof typeof LISTES_LIVREES)[]) setDataset(k, structuredClone(LISTES_LIVREES[k]) as never);
  for (const k of Object.keys(OBJETS_LIVRES) as (keyof typeof OBJETS_LIVRES & ObjectDatasetKey)[]) setObjectDataset(k, structuredClone(OBJETS_LIVRES[k]) as never);
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
    // Le registre des tables tirables est VIVANT : la famille de `travelFlow` rend ses ids et ses defs à
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
    expect(mutationTablePlayerLabel('physique')).toBe('Physique');
    const idsAvant = mutationTableIds().length;

    const neuve: MutationTable = { ...physique, id: 'table-neuve-qc', label: 'Table neuve QC' };
    setDataset('mutationTables', [
      ...tables.map((t) => (t.id === 'physique'
        ? { ...t, label: 'physique révisée QC (LDB)', ranges: [{ ...t.ranges[0], max: 99 }, ...t.ranges.slice(1)] }
        : t)),
      neuve,
    ]);

    expect(mutationTableRows('physique')[0].max, 'la fourchette éditée n’atteint pas les lignes d’étape').toBe(99);
    expect(mutationTableRows('physique')[0].max).not.toBe(avant.max);
    expect(mutationTablePlayerLabel('physique')).toBe('Physique révisée QC');
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
    const rangees = MISCAST_TABLES.find((t) => t.id === 'miscast-mineure')!.entries;
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

describe('#1692 — les vues DÉRIVÉES d’un dataset suivent son édition', () => {
  it('une marchandise maritime NEUVE : `cargoes` et `findCargoById` la servent', () => {
    const modele = cargoes()[0];
    expect(findCargoById('cargo-qc-1692')).toBeUndefined();
    setDataset('seaCargo', [...datasetArray('seaCargo'), { ...modele, id: 'cargo-qc-1692', label: 'Cargo QC' } as CargoDef]);
    expect(cargoes().map((c) => c.id)).toContain('cargo-qc-1692');
    expect(findCargoById('cargo-qc-1692')!.label).toBe('Cargo QC');
  });

  it('une marchandise terrestre NEUVE : `landCargoes` et `findLandCargoById` la servent', () => {
    const modele = landCargoes()[0];
    expect(findLandCargoById('cargo-terre-qc-1692')).toBeUndefined();
    setDataset('landCargo', [...datasetArray('landCargo'), { ...modele, id: 'cargo-terre-qc-1692', label: 'Cargo terre QC' } as LandCargoDef]);
    expect(landCargoes().map((c) => c.id)).toContain('cargo-terre-qc-1692');
    expect(findLandCargoById('cargo-terre-qc-1692')!.label).toBe('Cargo terre QC');
  });

  it('un Coût d’Augmentation ÉDITÉ : `advanceCost` lit la NOUVELLE bande', () => {
    expect(advanceCost(0, 'characteristic')).toBe(25);
    setDataset('advancementCosts', datasetArray('advancementCosts').map((b, i) => (i === 0 ? { ...b, coutCarac: 99 } : b)));
    expect(advanceCost(0, 'characteristic')).toBe(99);
  });

  it('une bande de longueur de coque ÉDITÉE : `shipSizeOfLength` lit la NOUVELLE colonne « Taille »', () => {
    expect(shipSizeOfLength(11)).not.toBe('minuscule');
    setDataset('shipHullSizes', datasetArray('shipHullSizes').map((r) => (r.size === 'minuscule' ? { ...r, lengthM: { min: 1, max: 12 } } : r)));
    expect(shipSizeOfLength(11)).toBe('minuscule');
  });

  it('la fiche de Navigation fluviale ÉDITÉE : forces de vent et scalaires servis NEUFS', () => {
    const fiche = structuredClone(datasetObject('riverNavigation'));
    const [calme, second] = fiche.windForces;
    expect(tickRiverWind(calme.id as RiverWindForceId, deFixe(1))).toBe(second.id);
    setObjectDataset('riverNavigation', {
      ...fiche,
      windForces: fiche.windForces.map((f, i) => (i === 1 ? { ...f, id: 'brise-qc' } : f)),
      navBaseDifficulty: 'difficile', tackDifficulty: 'difficile', driftPctOfSpeed: 40, driftNavPenalty: -30,
      rowingAgility: { ...fiche.rowingAgility, difficulty: 'difficile' },
      capsize: { ...fiche.capsize, rightDifficulty: 'difficile', rightCumulativePenalty: -15 },
    });
    expect(tickRiverWind(calme.id as RiverWindForceId, deFixe(1))).toBe('brise-qc');
    expect(navBaseDifficulty()).toBe('difficile');
    expect(tackDifficulty()).toBe('difficile');
    expect(driftPctOfSpeed()).toBe(40);
    expect(navPenaltyMods({ drift: true })[0].value).toBe(-30);
    expect(rowingAgilityDifficulty()).toBe('difficile');
    expect(capsizeRightDifficulty()).toBe('difficile');
    expect(capsizeRightCumulative()).toBe(-15);
  });

  it('les vents de mer ÉDITÉS : `tickWindForce` passe au cran NEUF', () => {
    const fiche = structuredClone(datasetObject('seaWeather'));
    const [calme, second] = fiche.vents;
    expect(tickWindForce(calme.id as SeaWindForceId, deFixe(1))).toBe(second.id);
    setObjectDataset('seaWeather', { ...fiche, vents: fiche.vents.map((v, i) => (i === 1 ? { ...v, id: 'brise-mer-qc' } : v)) });
    expect(tickWindForce(calme.id as SeaWindForceId, deFixe(1))).toBe('brise-mer-qc');
  });

  it('la mise à jour du vent de mer ÉDITÉE : `tickWindForceDay` lit le seuil et le nombre de tirages NEUFS', () => {
    const fiche = structuredClone(datasetObject('seaWeather'));
    const [calme, second] = fiche.vents;
    expect(tickWindForceDay(calme.id as SeaWindForceId, deFixe(2))).toBe(calme.id);
    setObjectDataset('seaWeather', { ...fiche, windTickThreshold: 2, windTicksPerDay: 1 });
    expect(tickWindForceDay(calme.id as SeaWindForceId, deFixe(2))).toBe(second.id);
  });

  it('la fiche Disponibilité & Troc ÉDITÉE : `rollAvailability` et `barterRatio` la lisent', () => {
    const fiche = structuredClone(datasetObject('disponibilite'));
    expect(rollAvailability('Limitée', 'village', deFixe(1)).test!.target).toBe(30);
    expect(barterRatio('Commune', 'Exotique')).toEqual({ give: 8, get: 1 });
    setObjectDataset('disponibilite', {
      ...fiche,
      dispoPct: fiche.dispoPct.map((e) => (e.availability === 'Limitée' ? { ...e, pct: { ...e.pct, village: 77 } } : e)),
      barterRatios: fiche.barterRatios.map((r) => (r.give === 'Commune' ? { ...r, ratios: { ...r.ratios, Exotique: { give: 9, get: 1 } } } : r)),
    });
    expect(rollAvailability('Limitée', 'village', deFixe(1)).test!.target).toBe(77);
    expect(barterRatio('Commune', 'Exotique')).toEqual({ give: 9, get: 1 });
  });

  it('les phases du jour ÉDITÉES : aube, crépuscule, créneau de départ et arche solaire suivent', () => {
    expect(dawnMinute()).toBe(300);
    expect(isTravelDaylight(330)).toBe(true);
    setDataset('calendarPhases', datasetArray('calendarPhases').map((p) => (
      p.id === 'aube' ? { ...p, start: 360 } : p.id === 'crepuscule' ? { ...p, start: 1140 } : p)));
    expect(dawnMinute()).toBe(360);
    expect(duskMinute()).toBe(1140);
    expect(isTravelDaylight(330)).toBe(false);
    expect(sunJeuHalfArcMin()).toBe(12 * 60 - 360);
  });

  it('un jour intercalaire AJOUTÉ : `daysPerYear` le compte', () => {
    const avant = daysPerYear();
    const inter = datasetArray('calendarIntercalary');
    setDataset('calendarIntercalary', [...inter, { ...inter[0], id: 'jour-qc-1692', label: 'Jour QC' }]);
    expect(daysPerYear()).toBe(avant + 1);
  });

  it('un mois ALLONGÉ : `daysPerYear` suit `calendarMonths`', () => {
    const avant = daysPerYear();
    setDataset('calendarMonths', datasetArray('calendarMonths').map((m, i) => (i === 0 ? { ...m, days: m.days + 3 } : m)));
    expect(daysPerYear()).toBe(avant + 3);
  });

  it('un enjeu de modale ÉDITÉ : la catégorie d’ENTRÉE déclarée suit `flowStakes`', () => {
    const chanson = seaShanties[0].id;
    const ref = () => resolveStake(flowStakeRef('shanty', 'roll', { entryId: chanson })).rule;
    expect(ref()).toEqual({ category: 'seaShanties', id: chanson });
    setDataset('flowStakes', FLOW_STAKES.map((e) => (e.flow === 'shanty' && e.phase === 'roll' ? { ...e, entryCategory: undefined } : e)));
    expect(ref(), 'la catégorie d’entrée retirée au Codex reste déclarée').toEqual({ category: 'talents', id: 'chanson-de-marin' });
  });

  it('un enjeu de combat ÉDITÉ : la catégorie d’ENTRÉE déclarée suit `combatStakes`', () => {
    const maladie = maladies[0].id;
    const ref = () => resolveStake(combatStakeRef('combatEndDisease', { entryId: maladie })).rule;
    expect(ref()).toEqual({ category: 'maladies', id: maladie });
    setDataset('combatStakes', COMBAT_STAKES.map((e) => (e.kind === 'combatEndDisease' ? { ...e, entryCategory: undefined } : e)));
    expect(ref(), 'la catégorie d’entrée retirée au Codex reste déclarée').toBeUndefined();
  });

  it('un Événement de bord ÉDITÉ : la table tirable `sea-board-events` sert les NOUVELLES bornes', () => {
    const evts = datasetArray('seaBoardEvents');
    const premier = evts[0];
    expect(tableStepDef(SEA_BOARD_EVENT_TABLE)!.rows[0].max).toBe(premier.max);
    setDataset('seaBoardEvents', evts.map((e, i) => (i === 0 ? { ...e, max: premier.max - 1 } : e)));
    expect(tableStepDef(SEA_BOARD_EVENT_TABLE)!.rows[0].max).toBe(premier.max - 1);
  });
});
