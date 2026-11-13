/**
 * CONTRAT DE FRAÎCHEUR (#1692) — une écriture au seam est vue par les LECTEURS, sans rechargement.
 *
 * CONTRAT : après une édition au Codex (`setDataset`, la porte de `CodexEdit.save`), chaque accesseur
 * sert l'entrée ÉDITÉE et voit une entrée NEUVE — aucun lecteur ne peut tenir un index figé à l'import.
 * Ces cas ne sont pas théoriques : `traits`, `trappings` et `characteristics` sont tous édités par l'atelier
 * (`exposition.edit` de leur def).
 *
 * Restauration `afterEach` par le seam lui-même : aucun test ne touche un dataset autrement.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import {
  traits, trappings, characteristics, etats, weather, vehicles,
  findTraitById, findTrappingById, charAbr,
} from '../data/index';
import { parseTraitInstance } from '../data/refFormatLivre';
import { travelVehicles, travelModeLabels } from '../engine/travel';
import { consolidateAmputations, traumaById, type TraumaFiche, avecSequelles } from '../engine/trauma';
import type { Combatant } from '../engine/types';
import { mutationTableIds, mutationTablePlayerLabel, mutationTableRows, type MutationTable } from '../data/mutations';
import { rollMiscast, miscastRowAt, type MiscastTableRow } from '../engine/miscast';
import { makeRNG } from '../engine/dice';
import { tableTotale } from '../lib/tableTotale';
import { tableStepDef, tableStepIds } from './cascade';
import { stageWeatherRows } from './travelFlow';
// La FAMILLE des Tableaux de Corruption s'enregistre au chargement de son module : on l'importe par
// ce qu'on en LIT (l'id de table d'une nature + un alignement), jamais par un import d'effet de bord.
import { mutationTableIdFor } from './corruptionFlow';
import { setDataset, datasetArray, setObjectDataset, datasetObject, type ObjectDatasetKey } from '../data/overrides';
import { marchandisesDe, findCargoById, rollSeasonalCargo, type CargoDef } from '../engine/cargo';
import { advanceCost } from '../engine/advancement';
import { shipSizeOfLength } from '../engine/shipBuild';
import {
  tickRiverWind, navBaseDifficulty, tackDifficulty, driftPctOfSpeed, navPenaltyMods,
  capsizeRightDifficulty, capsizeRightCumulative, type RiverWindForceId,
} from '../engine/riverNavigation';
import { tickWindForce, tickWindForceDay, type SeaWindForceId } from '../engine/seaWeather';
import { overloadMaxEnc, offerPricePct } from '../engine/seaVoyage';
import { minCargoEnc, partialSurchargePct, rollMerchantSkill } from '../engine/landCargo';
import { rollAvailability, barterRatio } from '../engine/disponibilite';
import { dawnMinute, duskMinute, isTravelDaylight, daysPerYear } from '../engine/clock';
import { SEA_BOARD_EVENT_TABLE } from './seaVoyageFlow';
import { STAKES, flowStakeRef, combatStakeRef, resolveStake, seaShanties, maladies } from '../data/index';
import { traitLabelById } from '../engine/traits/dispatch';
import { conditionIdInText, conditionSeverity } from '../engine/conditions';
import { versionDuDataset } from '../data/versionDataset';
import type { EntreeVivante } from '../data/datasets';
import { deFixe } from '../engine/dice.testkit';

const TRAITS_LIVRES = [...traits];
const POSSESSIONS_LIVREES = [...trappings];
const CARACS_LIVREES = [...characteristics];
const ETATS_LIVRES = [...etats];
const SAISONS_LIVREES = [...weather];
const VEHICULES_LIVRES = [...vehicles];
const TRAUMAS_LIVRES = [...(datasetArray('traumas') as TraumaFiche[])];
const TABLES_MUTATION_LIVREES = [...(datasetArray('mutationTables') as MutationTable[])];
const MISCAST_MINEURE_LIVREE = [...(datasetArray('imparfaiteMineure') as MiscastTableRow[])];
/** Les datasets des vues dérivées migrées (#1692) : restaurés par le seam, comme les autres. */
const LISTES_LIVREES = tableTotale(
  ['cargoes', 'cargaisonsAleatoires', 'advancementCosts', 'shipHullSizes', 'calendarPhases', 'calendarMonths', 'calendarIntercalary', 'stakes', 'seaBoardEvents'] as const,
  (k) => structuredClone(datasetArray(k)),
) as { [K in 'cargoes' | 'cargaisonsAleatoires' | 'advancementCosts' | 'shipHullSizes' | 'calendarPhases' | 'calendarMonths' | 'calendarIntercalary' | 'stakes' | 'seaBoardEvents']: ReturnType<typeof datasetArray<K>> };
const OBJETS_LIVRES = tableTotale(
  ['riverNavigation', 'seaWeather', 'disponibilite', 'seaCargo', 'landCargo'] as const, (k) => structuredClone(datasetObject(k)),
) as { [K in 'riverNavigation' | 'seaWeather' | 'disponibilite' | 'seaCargo' | 'landCargo']: ReturnType<typeof datasetObject<K>> };

beforeEach(() => { ouvrirLeBanc(); });

afterEach(() => {
  for (const k of Object.keys(LISTES_LIVREES) as (keyof typeof LISTES_LIVREES)[]) setDataset(k, structuredClone(LISTES_LIVREES[k]) as never);
  for (const k of Object.keys(OBJETS_LIVRES) as (keyof typeof OBJETS_LIVRES & ObjectDatasetKey)[]) setObjectDataset(k, structuredClone(OBJETS_LIVRES[k]) as never);
  setDataset('mutationTables', TABLES_MUTATION_LIVREES);
  setDataset('imparfaiteMineure', MISCAST_MINEURE_LIVREE);
  setDataset('weather', SAISONS_LIVREES);
  setDataset('vehicles', VEHICULES_LIVRES);
  setDataset('traumas', TRAUMAS_LIVRES);
  setDataset('traits', TRAITS_LIVRES);
  setDataset('trappings', POSSESSIONS_LIVREES);
  setDataset('characteristics', CARACS_LIVREES);
  setDataset('etats', ETATS_LIVRES);
});

describe('#1692 — une édition au seam est SERVIE aux lecteurs', () => {
  it('un Trait RENOMMÉ : `findTraitById`, `traitLabelById` et la saisie « format livre » servent le NOUVEAU libellé', () => {
    const ancien = findTraitById('venin')!.label;
    const nouveau = `${ancien} des marais`;
    setDataset('traits', traits.map((t) => (t.id === 'venin' ? { ...t, label: nouveau } : t.id === 'morsure' ? { ...t, label: ancien } : t)));
    expect(findTraitById('venin')!.label).toBe(nouveau);
    expect(traitLabelById('venin')).toBe(nouveau);
    // L'`id` est STABLE : un renommage ne le déplace pas — c'est le LIBELLÉ reconnu qui change (le
    // nouveau libellé saisi résout l'id `venin`, l'ancien résout le Trait qui le porte à son tour).
    expect(parseTraitInstance(nouveau).id).toBe('venin');
    expect(parseTraitInstance(nouveau.toLowerCase()).id).toBe('venin');
    expect(parseTraitInstance(ancien).id).toBe('morsure');
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

  it('un État RENOMMÉ : le journal reconnaît le NOUVEAU libellé, et son importance suit l’id', () => {
    expect(conditionIdInText('Grim est Sonné')).toBe('sonne');
    setDataset('etats', etats.map((e) => (e.id === 'sonne' ? { ...e, label: 'Assommé' } : e)));
    expect(conditionIdInText('Grim est Assommé')).toBe('sonne');
    expect(conditionIdInText('Grim est Sonné')).toBeUndefined();
    // Ce que le journal en fait (`noyau/combatLog.isImportantEvent`) : la sévérité se lit sur l’ID rendu,
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
    expect(tableStepDef(id)!.rows).toEqual(stageWeatherRows(saison.entries));
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
    expect(mutationTablePlayerLabel('physique')).toBe('Tableau de Corruption physique');
    const idsAvant = mutationTableIds().length;

    const neuve: EntreeVivante<MutationTable> = { ...physique, id: 'table-neuve-qc', label: 'Table neuve QC' };
    setDataset('mutationTables', [
      ...tables.map((t) => (t.id === 'physique'
        ? { ...t, label: 'physique révisée QC (LDB)', entries: [{ ...t.entries[0], max: 99 }, ...t.entries.slice(1)] }
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
    const rangees = datasetArray('imparfaiteMineure');
    const premiere = rangees[0];
    const de = premiere.min;
    if (de === null) throw new Error('miscast-mineure : la première rangée a une borne basse ouverte');
    expect(rollMiscast('mineure', makeRNG(1), 0, undefined, de).label).toBe(premiere.label);

    setDataset('imparfaiteMineure', rangees.map((r) => (r.id === premiere.id ? { ...r, label: 'Contrecoup révisé QC' } : r)));

    expect(miscastRowAt('miscast-mineure', de).label).toBe('Contrecoup révisé QC');
    expect(rollMiscast('mineure', makeRNG(1), 0, undefined, de).label).toBe('Contrecoup révisé QC');
  });

  it('un véhicule de voyage ÉDITÉ ou NEUF : `travelVehicles` et les libellés de mode le servent', () => {
    // Les transports payants et la table de libellés de `engine/travel.ts` se lisent sur le dataset vivant
    // `vehicles` : une diligence renommée au Codex garde son nouveau nom à l'écran de voyage, un véhicule neuf y entre.
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
      traumas: avecSequelles([], [traumaById('doigt-ampute', undefined, 'brasG'), traumaById('doigt-ampute', undefined, 'brasG')]),
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
  it('une marchandise NEUVE : `marchandisesDe` la sert dans SA voie seule, `findCargoById` la résout', () => {
    for (const voie of ['mer', 'terre'] as const) {
      const id = `cargo-${voie}-qc-1692`;
      const autre = voie === 'mer' ? 'terre' : 'mer';
      expect(findCargoById(id)).toBeUndefined();
      setDataset('cargoes', [...datasetArray('cargoes'), { ...marchandisesDe(voie)[0], id, label: `Cargo ${voie} QC` } as CargoDef]);
      expect(marchandisesDe(voie).map((c) => c.id)).toContain(id);
      expect(marchandisesDe(autre).map((c) => c.id)).not.toContain(id);
      expect(findCargoById(id)!.label).toBe(`Cargo ${voie} QC`);
    }
  });

  it('une marchandise NEUVE rangée dans une colonne ÉDITÉE : `rollSeasonalCargo` la tire de SA colonne seule', () => {
    for (const voie of ['mer', 'terre'] as const) {
      const id = `cargo-${voie}-qc-1692`;
      expect(findCargoById(id)).toBeUndefined();
      setDataset('cargoes', [...datasetArray('cargoes'), { ...marchandisesDe(voie)[0], id, label: `Cargo ${voie} QC` } as CargoDef]);
      setDataset('cargaisonsAleatoires', datasetArray('cargaisonsAleatoires').map((t) => (t.voie === voie && t.saison === 'ete' ? { ...t, entries: [{ ...t.entries[0], id: id as (typeof t.entries)[number]['id'], min: 1, max: 100 }] } : t)));
      expect(rollSeasonalCargo(voie, 'ete', deFixe(37)).label).toBe(`Cargo ${voie} QC`);
      expect(rollSeasonalCargo(voie, 'hiver', deFixe(37)).id).not.toBe(id);
    }
  });

  it('un Coût d’Augmentation ÉDITÉ : `advanceCost` lit la NOUVELLE bande', () => {
    expect(advanceCost(0, 'caracteristique')).toBe(25);
    setDataset('advancementCosts', datasetArray('advancementCosts').map((b, i) => (i === 0 ? { ...b, coutCarac: 99 } : b)));
    expect(advanceCost(0, 'caracteristique')).toBe(99);
  });

  it('une bande de longueur de coque ÉDITÉE : `shipSizeOfLength` lit la NOUVELLE colonne « Taille »', () => {
    expect(shipSizeOfLength(11)).not.toBe('minuscule');
    setDataset('shipHullSizes', datasetArray('shipHullSizes').map((r) => (r.size === 'minuscule' ? { ...r, lengthM: { min: 1, max: 12 } } : r)));
    expect(shipSizeOfLength(11)).toBe('minuscule');
  });

  it('la fiche de Navigation fluviale ÉDITÉE : forces de vent et scalaires servis NEUFS', () => {
    const fiche = structuredClone(datasetObject('riverNavigation'));
    const [calme, second] = fiche.windForces.entries;
    expect(tickRiverWind(calme.id as RiverWindForceId, deFixe(1))).toBe(second.id);
    setObjectDataset('riverNavigation', {
      ...fiche,
      windForces: { ...fiche.windForces, entries: fiche.windForces.entries.map((f, i) => (i === 1 ? { ...f, id: 'brise-qc' } : f)) },
      navBaseDifficulty: 'difficile', tackDifficulty: 'difficile', driftPctOfSpeed: 40, driftNavPenalty: -30,
      capsize: { ...fiche.capsize, rightDifficulty: 'difficile', rightCumulativePenalty: -15 },
    });
    expect(tickRiverWind(calme.id as RiverWindForceId, deFixe(1))).toBe('brise-qc');
    expect(navBaseDifficulty()).toBe('difficile');
    expect(tackDifficulty()).toBe('difficile');
    expect(driftPctOfSpeed()).toBe(40);
    expect(navPenaltyMods({ derive: true })[0].value).toBe(-30);
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
    expect(rollAvailability('limitee', 'village', deFixe(1)).test!.target).toBe(30);
    expect(barterRatio('commune', 'exotique')).toEqual({ give: 8, get: 1 });
    setObjectDataset('disponibilite', {
      ...fiche,
      dispoPct: fiche.dispoPct.map((e) => (e.availability === 'limitee' ? { ...e, pct: { ...e.pct, village: 77 } } : e)),
      barterRatios: fiche.barterRatios.map((r) => (r.give === 'commune' ? { ...r, ratios: { ...r.ratios, exotique: { give: 9, get: 1 } } } : r)),
    });
    expect(rollAvailability('limitee', 'village', deFixe(1)).test!.target).toBe(77);
    expect(barterRatio('commune', 'exotique')).toEqual({ give: 9, get: 1 });
  });

  it('les phases du jour ÉDITÉES : aube, crépuscule, créneau de départ et arche solaire suivent', () => {
    expect(dawnMinute()).toBe(300);
    expect(isTravelDaylight(330)).toBe(true);
    setDataset('calendarPhases', datasetArray('calendarPhases').map((p) => (
      p.id === 'aube' ? { ...p, seuil: 360 } : p.id === 'crepuscule' ? { ...p, seuil: 1140 } : p)));
    expect(dawnMinute()).toBe(360);
    expect(duskMinute()).toBe(1140);
    expect(isTravelDaylight(330)).toBe(false);
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

  it('un enjeu de modale ÉDITÉ : la catégorie d’ENTRÉE déclarée suit `stakes`', () => {
    const chanson = seaShanties[0].id;
    const ref = () => resolveStake(flowStakeRef('chanson-de-marin-test', { entryId: chanson })).rule;
    expect(ref()).toEqual({ category: 'seaShanties', id: chanson });
    setDataset('stakes', STAKES.map((e) => (e.id === 'chanson-de-marin-test' ? { ...e, entryCategory: undefined } : e)));
    expect(ref(), 'la catégorie d’entrée retirée au Codex reste déclarée').toEqual({ category: 'talents', id: 'chanson-de-marin' });
  });

  it('un enjeu de combat ÉDITÉ : la catégorie d’ENTRÉE déclarée suit `stakes`', () => {
    const maladie = maladies[0].id;
    const ref = () => resolveStake(combatStakeRef('combat-fin-maladie', { entryId: maladie })).rule;
    expect(ref()).toEqual({ category: 'maladies', id: maladie });
    setDataset('stakes', STAKES.map((e) => (e.id === 'combat-fin-maladie' ? { ...e, entryCategory: undefined } : e)));
    expect(ref(), 'la catégorie d’entrée retirée au Codex reste déclarée').toBeUndefined();
  });

  it('un Événement de bord ÉDITÉ : la table tirable `evenements-de-bord` sert les NOUVELLES bornes', () => {
    const evts = datasetArray('seaBoardEvents');
    const premier = evts[0];
    expect(tableStepDef(SEA_BOARD_EVENT_TABLE)!.rows[0].max).toBe(premier.max);
    setDataset('seaBoardEvents', evts.map((e, i) => (i === 0 ? { ...e, max: premier.max! - 1 } : e)));
    expect(tableStepDef(SEA_BOARD_EVENT_TABLE)!.rows[0].max).toBe(premier.max! - 1);
  });

  it('les règles de négoce maritime ÉDITÉES (#3433) : plafond de surcharge et bandes du Prix d’offre servis NEUFS', () => {
    const fiche = structuredClone(datasetObject('seaCargo'));
    const port = { taille: 1, richesse: 1, production: [] };
    expect(overloadMaxEnc(100)).toBe(fiche.surcharge.pctPlafond);
    expect(offerPricePct(port, 'x')).toBe(100 + fiche.vente.prixDOffre.find((b) => b.min === 2)!.pct);
    setObjectDataset('seaCargo', {
      ...fiche,
      surcharge: { ...fiche.surcharge, pctPlafond: 175 },
      vente: { ...fiche.vente, prixDOffre: fiche.vente.prixDOffre.map((b) => (b.min === 2 ? { ...b, pct: -33 } : b)) },
    });
    expect(overloadMaxEnc(100)).toBe(175);
    expect(offerPricePct(port, 'x')).toBe(67);
  });

  it('les règles de négoce terrestre ÉDITÉES (#3433) : lot minimal, surcoût partiel et dés du marchand servis NEUFS', () => {
    const fiche = structuredClone(datasetObject('landCargo'));
    const { d10, plus } = fiche.achat.competenceDuMarchand;
    expect(rollMerchantSkill(deFixe(1))).toBe(d10 + plus);
    setObjectDataset('landCargo', { ...fiche, achat: { ...fiche.achat, encMin: 20, pctSurcoutPartiel: 15, competenceDuMarchand: { d10: d10 + 1, plus } } });
    expect(minCargoEnc()).toBe(20);
    expect(partialSurchargePct()).toBe(15);
    expect(rollMerchantSkill(deFixe(1))).toBe(d10 + 1 + plus);
  });
});
