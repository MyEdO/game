import { describe, it, expect } from 'vitest';
import { CODEX, CODEX_GROUPS, categoriesIn, categoryByKey, clustersIn, codexLookup, codexLookupVersion, invalidateCodexLookup, type CodexItem, type CodexFacet } from './registry';
import { codexMatch, deburr, filterItems, facetValues } from './search';
import { isEditableCategory } from './CodexEdit';
import { creatures, etats, trappings, gods, spells, findTraitById, findDomainById, WATER_EXPOSURE } from '../../data';
import { windSaturationEffects } from '../../data/arcanePhenomena';
import { setDataset } from '../../data/overrides';
import { CHAR_KEYS } from '../../engine/types';
import { charAbr } from '../../data';
import { MORALE_BANDS } from '../../engine/crewMorale';

/** Toutes les lignes 'ref' (cross-réf) d'une fiche, sections + onglets confondus. */
const refLabelsOf = (item: CodexItem): string[] =>
  [...(item.sections ?? []), ...(item.tabs ?? []).flatMap((t) => t.sections)]
    .flatMap((s) => s.rows)
    .flatMap((r) => (r.t === 'ref' ? [r.label] : r.t === 'choice' ? r.options.map((o) => o.label) : []));

describe('Codex registry', () => {
  it('a des catégories, toutes peuplées, à clés uniques', () => {
    expect(CODEX.length).toBeGreaterThan(0);
    const keys = CODEX.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CODEX) expect(c.items.length).toBeGreaterThan(0);
  });

  it('chaque catégorie appartient à un groupe connu', () => {
    for (const c of CODEX) expect(CODEX_GROUPS).toContain(c.group);
  });

  it('categoriesIn / categoryByKey cohérents', () => {
    for (const g of CODEX_GROUPS) {
      for (const c of categoriesIn(g)) {
        expect(c.group).toBe(g);
        expect(categoryByKey(c.key)).toBe(c);
      }
    }
    expect(categoryByKey('inexistant')).toBeUndefined();
  });

  it('les entrées portent un libellé et, le plus souvent, une source', () => {
    for (const c of CODEX) for (const it of c.items) expect(it.label).toBeTruthy();
    const races = categoryByKey('races')!;
    expect(races.items.every((i) => i.source?.book)).toBe(true);
  });

  it('codexLookup résout exact + casse ignorée, undefined sinon', () => {
    const first = categoryByKey('etats')!.items[0];
    expect(codexLookup('etats', first.label)).toBe(first);
    expect(codexLookup('etats', first.label.toUpperCase())).toBe(first);
    expect(codexLookup('etats', 'libellé inexistant')).toBeUndefined();
    expect(codexLookup('categorie-inexistante', first.label)).toBeUndefined();
  });

  it('FRAÎCHEUR après persist : setDataset (mutation en place) + invalidate → items re-projetés + lookup à jour', () => {
    // Simule le VRAI chemin de `CodexEdit.save` : le dataset source est muté EN PLACE
    // (`overrides.ts::setDataset`), puis `invalidateCodexLookup()` — index figé AVANT, frais APRÈS.
    const cat = categoryByKey('etats')!;
    const before = [...etats]; // snapshot (références d'origine) pour restauration
    const original = etats[0];
    const renamed = `${original.label} (renommé-test)`;
    try {
      expect(codexLookup('etats', renamed)).toBeUndefined(); // construit l'index de la catégorie
      setDataset('etats', etats.map((e, i) => (i === 0 ? { ...e, label: renamed } : e)));
      // Comportement défensif conservé : index ET projection figés tant que non invalidés.
      expect(codexLookup('etats', renamed)).toBeUndefined();
      const v0 = codexLookupVersion();
      invalidateCodexLookup();
      expect(codexLookupVersion()).toBe(v0 + 1);
      // Re-projection : la catégorie reflète le nouveau libellé, le lookup le résout.
      expect(cat.items.some((i) => i.label === renamed)).toBe(true);
      expect(codexLookup('etats', renamed)?.label).toBe(renamed);
      expect(codexLookup('etats', original.label)).toBeUndefined(); // l'ancien libellé a disparu
    } finally {
      setDataset('etats', before);
      invalidateCodexLookup();
    }
  });
});

describe('Codex registry — références INVERSES (relations.ts → fiches)', () => {
  it('la fiche d’un trait liste « Créatures ayant ce trait » (inversion bout-en-bout)', () => {
    // Donnée → attendu : une créature réelle + son 1er trait → la fiche du trait DOIT la lister.
    const c = creatures.find((x) => x.traits.length > 0 && findTraitById(x.traits[0].id))!;
    const trait = findTraitById(c.traits[0].id)!;
    const item = codexLookup('traits', trait.label);
    expect(item, trait.label).toBeTruthy();
    const sec = item!.sections?.find((s) => s.title === 'Créatures ayant ce trait');
    expect(sec, `${trait.label} → section inverse`).toBeTruthy();
    expect(sec!.rows.some((r) => r.t === 'ref' && r.label === c.label)).toBe(true);
  });

  it('la fiche d’une compétence porte des sections inverses (cross-réf cliquables)', () => {
    // Une compétence très référencée (carac la cite toujours) → au moins une cross-réf inverse.
    const skills = categoryByKey('skills')!.items;
    expect(skills.some((s) => refLabelsOf(s).length > 0)).toBe(true);
  });

  it('la fiche d’une Table de Corruption rend le tirage d100 → Mutation (cross-réf + badge de plage)', () => {
    const tables = categoryByKey('mutationTables')!.items;
    const t = tables[0];
    const sec = t.sections?.find((s) => /Tirage/.test(s.title));
    expect(sec, 'section de tirage').toBeTruthy();
    const refRow = sec!.rows.find((r) => r.t === 'ref');
    expect(refRow && refRow.t === 'ref' && refRow.category).toBe('mutations');
    expect(refRow && refRow.t === 'ref' && /\d+–\d+/.test(refRow.badge ?? '')).toBe(true);
  });

  it('la fiche d’un Lieu-parent liste ses Sous-lieux (inversion location.parent)', () => {
    const locs = categoryByKey('locations')!.items;
    const parent = locs.find((l) => locs.some((c) => c.sub === l.label)); // un lieu dont le label est le parent d'un autre
    expect(parent, 'un lieu-parent').toBeTruthy();
    expect(parent!.sections?.some((s) => s.title === 'Sous-lieux' && s.rows.some((r) => r.t === 'ref'))).toBe(true);
  });

  it('la fiche d’un Livre liste son contenu PAR TYPE (bookContents câblé, cross-réf cliquables)', () => {
    const books = categoryByKey('books')!.items;
    const withContent = books.find((b) => (b.sections?.length ?? 0) > 0);
    expect(withContent, 'au moins un livre a du contenu').toBeTruthy();
    expect(withContent!.sections!.some((s) => s.rows.some((r) => r.t === 'ref'))).toBe(true);
  });

  it('catégorie « Psychologie » = filtre data-driven des traits à capacité psy, groupée par type', () => {
    const psy = categoryByKey('psychologie');
    expect(psy?.group).toBe('Effets');
    expect(psy!.items.length).toBeGreaterThan(0);
    // Peur DOIT en faire partie, groupée « Peur ».
    const peur = psy!.items.find((i) => i.label.toLowerCase() === 'peur');
    expect(peur, 'Peur dans Psychologie').toBeTruthy();
    expect(peur!.group).toBe('Peur');
    // C'est un VIEW de traits (pas un dataset) → l'édition DEV passe par « Traits », pas ici.
    expect(isEditableCategory('psychologie')).toBe(false);
  });
});

describe('Codex registry — dégâts CONDITIONNELS d’une arme à capacité de qualité (#135)', () => {
  it('une pièce à Atout Siège (RÉELLE, ex. Catapulte) affiche le fait « Dégâts » + la note ×2 structure — pas juste le total imprimé', () => {
    // Requête sur la DONNÉE (zéro id en dur) : toute Possession du catalogue portant la qualité `siege`
    // fait foi — dégâts effectifs contre une structure = double du total imprimé (ADE II 8 l.292),
    // le Codex ne doit plus l'occulter.
    const siegeTrapping = trappings.find((t) => t.qualities.some((q) => q.id === 'siege'))!;
    expect(siegeTrapping, 'aucune pièce à Atout Siège dans le catalogue').toBeTruthy();
    const item = categoryByKey('trappings')!.items.find((i) => i.label === siegeTrapping.label)!;
    const damageFact = item.meta?.find((f) => f.label === 'Dégâts');
    expect(damageFact, `${siegeTrapping.label} : fait Dégâts`).toBeTruthy();
    expect(damageFact!.value).toContain('×2 contre une structure');
  });

  it('une arme normale (sans ram/siège) garde son fait « Dégâts » INCHANGÉ — juste le total imprimé', () => {
    const sword = trappings.find((t) => t.id === 'arme-simple')!;
    const item = categoryByKey('trappings')!.items.find((i) => i.label === sword.label)!;
    const damageFact = item.meta?.find((f) => f.label === 'Dégâts');
    expect(damageFact!.value).toBe('+BF+4');
    expect(damageFact!.value).not.toMatch(/structure|porte|Effets/);
  });
});

describe('Codex registry — statbloc bestiaire compact', () => {
  it('chaque créature porte un statbloc (M + 10 caracs + Blessures, traits en chips cross-réf)', () => {
    const items = categoryByKey('creatures')!.items;
    for (const it of items) {
      expect(it.statblock, it.label).toBeTruthy();
      expect(it.statblock!.profile.map((f) => f.label)).toEqual(['M', ...CHAR_KEYS.map((k) => charAbr(k)), 'B']);
      for (const f of it.statblock!.profile) expect(f.value, `${it.label} ${f.label}`).toBeTruthy();
    }
    const withTraits = items.find((i) => i.statblock!.traits.length > 0)!;
    expect(withTraits.statblock!.traits.every((r) => r.t === 'ref' && r.category === 'traits')).toBe(true);
  });
});

describe('Codex registry — Bataille de masse (ADE II 8, #148)', () => {
  it('les 5 sections de mass-battle.json sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('les machines de guerre (dont le Bélier, déjà présent en donnée — pas dupliqué) apparaissent au catalogue', () => {
    const items = categoryByKey('massBattleWarMachines')!.items;
    expect(items.map((i) => i.label)).toContain('Bélier');
    const belier = items.find((i) => i.label === 'Bélier')!;
    expect(belier.meta?.find((f) => f.label === 'Équipe')?.value).toBe('6');
    expect(belier.meta?.find((f) => f.label === 'Atouts')?.value).toBe('Siège');
    // Une seule occurrence (pas de doublon introduit ailleurs, ex. trappings.json — cf. incident #148).
    expect(items.filter((i) => i.label === 'Bélier')).toHaveLength(1);
  });

  it('les structures (cibles de siège) et les aléas de bataille sont peuplés avec leurs faits', () => {
    const structures = categoryByKey('massBattleStructures')!.items;
    const porte = structures.find((i) => i.label === 'Porte de ville')!;
    expect(porte.meta?.find((f) => f.label === 'BE')?.value).toBe('10');
    expect(porte.meta?.find((f) => f.label === 'Blessures')?.value).toBe('30');
    const hazards = categoryByKey('massBattleHazards')!.items;
    expect(hazards.map((i) => i.label)).toContain('Tempête');
    expect(hazards.find((i) => i.label === 'Tempête')!.desc).toMatch(/tempête se lève/);
  });
});

describe('Codex registry — #157 (audit d’exposition : datasets de contenu manquants au Codex)', () => {
  it('les nouveaux catalogues de contenu sont exposés, peuplés et ÉDITABLES au Codex', () => {
    const keys = [
      'structures', 'vehicles', 'celestialHouses', 'groups', 'psychologies', 'seaShanties', 'crewRoles', 'crewTestTypes', 'navalTraits',
      'traumas', 'criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe',
      'aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe',
      'incidentsMonture', 'problemesVehicule', 'montures', 'tavernGames', 'obsessions', 'structureCriticals',
      'landCargo', 'seaCargo', 'riverPerils', 'crewMoraleFactors', 'crewMoraleBands', 'steamBreakdowns',
    ];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('un Critique LDB (Tête) porte son effet immédiat (ops) en section + ses Traumatismes engendrés en cross-réf', () => {
    const items = categoryByKey('criticalsTete')!.items;
    const withOps = items.find((i) => i.sections?.some((s) => s.title === 'Effet immédiat'));
    expect(withOps, 'au moins un Critique Tête porte un effet immédiat').toBeTruthy();
    const withTrauma = items.find((i) => i.sections?.some((s) => s.title === 'Traumatismes engendrés'));
    expect(withTrauma, 'au moins un Critique Tête engendre un Traumatisme référencé').toBeTruthy();
    const traumaSec = withTrauma!.sections!.find((s) => s.title === 'Traumatismes engendrés')!;
    expect(traumaSec.rows.every((r) => r.t === 'ref' && r.category === 'traumas')).toBe(true);
  });

  it('Moral d’équipage — Effets : le dataset PORTE ses `label` (titres de bande MDG 14) et le Codex les projette TELS QUELS — jamais l’`id`', () => {
    const items = categoryByKey('crewMoraleBands')!.items;
    expect(items).toHaveLength(MORALE_BANDS.length);
    for (const b of MORALE_BANDS) {
      const it = items.find((i) => i.id === b.id)!;
      expect(it, `bande ${b.id} exposée au Codex`).toBeTruthy();
      expect(it.label).toBe(b.label);
      expect(it.label).not.toBe(b.id);
    }
  });

  it('les 4 titres de bande de Moral sont gelés nominativement (verbatim MDG 14) — non vides et distincts de l’id', () => {
    expect(MORALE_BANDS.map((b) => b.label)).toEqual([
      'Mené de main de maître !',
      'Un excellent équipage',
      'Un équipage satisfait',
      'Des canailles que je ne parviens pas à mater',
    ]);
    for (const b of MORALE_BANDS) {
      expect(b.label.trim()).not.toBe('');
      expect(b.label).not.toBe(b.id);
    }
  });
});

describe('Codex registry — #157 (suite) : 5 derniers catalogues de CONTENU (Critiques de coque, Rencontres, Longs voyages en mer, Exposition hydrique)', () => {
  it('les 16 nouvelles catégories tableaux sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = [
      'shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements',
      'riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure',
      'rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses',
      'seaManannFactors', 'seaBoardEvents', 'seaPortEvents',
    ];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('un Critique de navire (Coque) porte son effet immédiat (ops) ET son Test d’équipage (échec) en sections', () => {
    const items = categoryByKey('shipCriticalsCoque')!.items;
    const barreAbimee = items.find((i) => i.label === 'Barre abîmée');
    expect(barreAbimee, 'Barre abîmée (coque, MDG 13)').toBeTruthy();
    expect(barreAbimee!.sub).toBe('d10 2–2');
    const coqueDegradee = items.find((i) => i.label === 'Coque dégradée')!;
    expect(coqueDegradee.meta?.find((f) => f.label === 'Éclats (Indice)')?.value).toBe('4');
  });

  it('un Critique fluvial (Gréement) porte son effet immédiat + son coup à l’équipage, jet NOMMÉ jusqu’à la Caractéristique (MSRC 07 l.78)', () => {
    const items = categoryByKey('riverCriticalsGreement')!.items;
    const g = items.find((i) => i.label === 'Gréement')!;
    expect(g, 'Gréement (fluvial, MSRC 07)').toBeTruthy();
    expect(g.sections?.some((s) => s.title === 'Effet immédiat')).toBe(true);
    const coupSec = g.sections?.find((s) => s.title === 'Coup à l’équipage');
    expect(coupSec, 'section Coup à l’équipage').toBeTruthy();
    // Le jet est une CARACTÉRISTIQUE (Initiative) : le Codex la nomme — un sujet non-compétence ne
    // s'affiche plus « Automatique (aucun Test) », ce que la lecture par `crewTest.skill` faisait.
    expect(coupSec!.rows.some((r) => r.t === 'kv' && r.k === 'Jet' && r.v === 'Initiative Intermédiaire (+0)')).toBe(true);
    // La CIBLE est une réf de catalogue : le Codex rend le `label` de la station, jamais un ternaire
    // codé en dur (MSRC 07 l.78 « Toute personne présente sur le pont » → station `pont`).
    expect(coupSec!.rows.some((r) => r.t === 'kv' && r.k === 'Cible' && r.v === 'Pont')).toBe(true);
    expect(g.sections?.some((s) => s.title === 'Conséquence (échec du Test)')).toBe(true);
  });

  it('un coup à l’équipage SANS jet (Rames fluviales, MSRC 07 l.82) s’annonce automatique et porte une conséquence CERTAINE', () => {
    const items = categoryByKey('riverCriticalsAvirons')!.items;
    const rames = items.find((i) => i.label === 'Rames')!;
    const coupSec = rames.sections?.find((s) => s.title === 'Coup à l’équipage');
    expect(coupSec, 'section Coup à l’équipage').toBeTruthy();
    expect(coupSec!.rows.some((r) => r.t === 'kv' && r.k === 'Jet' && r.v === 'Automatique (aucun Test)')).toBe(true);
    expect(rames.sections?.some((s) => s.title === 'Conséquence (certaine)')).toBe(true);
    expect(rames.sections?.some((s) => s.title === 'Conséquence (échec du Test)')).toBe(false);
  });

  it('un Critique SANS coup à l’équipage (Coque fluviale) omet la section', () => {
    const items = categoryByKey('riverCriticalsCoque')!.items;
    const coque = items.find((i) => i.label === 'Coque')!;
    expect(coque.sections?.some((s) => s.title === 'Coup à l’équipage')).toBe(false);
    expect(coque.sections?.some((s) => s.title === 'Effet immédiat')).toBe(true);
  });

  it('une Rencontre de voyage (EDOC 8) porte sa plage d100 + son texte verbatim', () => {
    const items = categoryByKey('rencontresPositives')!.items;
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) { expect(it.sub).toMatch(/^d100 \d+–\d+$/); expect(it.desc).toBeTruthy(); }
  });

  it('un Facteur d’Humeur de Manann (MDG 15) affiche son effet signé (Nd10 + constante)', () => {
    const items = categoryByKey('seaManannFactors')!.items;
    const f = items.find((i) => i.label === 'Vaincre ou contrer des suivants de Stromfels')!;
    expect(f, 'facteur Stromfels').toBeTruthy();
    expect(f.meta?.find((x) => x.label === 'Effet sur l’Humeur de Manann')?.value).toBe('+3d10');
  });

  it('un Événement de bord (MDG 15) porte sa plage de jet + son texte verbatim', () => {
    const items = categoryByKey('seaBoardEvents')!.items;
    const triton = items.find((i) => i.label === 'Triton !')!;
    expect(triton, 'événement Triton').toBeTruthy();
    expect(triton.sub).toBe('-9999–-65');
    expect(triton.desc).toMatch(/Manann ne supporte plus/);
  });

  it('la fiche « Exposition à l’eau » (dataset-OBJET, MSRC 16) est éditable et projette Test + Modificateurs + Maladies (cross-réf)', () => {
    const cat = categoryByKey('waterExposure')!;
    expect(isEditableCategory('waterExposure')).toBe(true);
    expect(cat.items).toHaveLength(1); // dataset-objet UNIQUE (mode 'single', comme `details`)
    const item = cat.items[0];
    expect(item.label).toBe(WATER_EXPOSURE.label);
    expect(item.source?.book).toBeTruthy();
    expect(item.meta?.find((f) => f.label === 'Test')?.value).toMatch(/Résistance/);
    const modSec = item.sections?.find((s) => s.title === 'Modificateurs');
    expect(modSec, 'section Modificateurs').toBeTruthy();
    expect(modSec!.rows.some((r) => r.t === 'sub')).toBe(true); // groupé par table (Source d’eau / Blessures et États)
    const diseaseSec = item.sections?.find((s) => /Maladies/.test(s.title));
    expect(diseaseSec, 'section Maladies').toBeTruthy();
    expect(diseaseSec!.rows.every((r) => r.t === 'ref' && r.category === 'maladies')).toBe(true);
    expect(diseaseSec!.rows.some((r) => r.t === 'ref' && r.label !== undefined && r.label.length > 0)).toBe(true);
  });
});

describe('Codex registry — LOT 1 #422 (famille NAVALE : Ports, Progression, Navigation, Périls, Météo, Construction navale)', () => {
  it('les 8 nouvelles catégories navales sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = [
      'navalPorts', 'navalProgression', 'shipHullSizes', 'shipSpeedTraits', 'shipConstructionTraits',
      'seaNavigation', 'seaPerils', 'seaWeather',
    ];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('un Port (Index de la Mer des Griffes, MDG 15) porte ses faits + sa Production en cross-réf vers la Cargaison maritime', () => {
    const items = categoryByKey('navalPorts')!.items;
    const marienburg = items.find((i) => i.label === 'Marienburg')!;
    expect(marienburg, 'Marienburg').toBeTruthy();
    expect(marienburg.meta?.find((f) => f.label === 'Richesse')?.value).toBe('5');
    expect(marienburg.group).toBe('Wasteland');
    const prodSec = marienburg.sections?.find((s) => s.title === 'Production');
    expect(prodSec, 'section Production').toBeTruthy();
    expect(prodSec!.rows.some((r) => r.t === 'ref' && r.category === 'seaCargo')).toBe(true);
  });

  it('la table de Progression de navire (MDG 13) porte ses 5 modes avec leur fourchette de DR', () => {
    const items = categoryByKey('navalProgression')!.items;
    expect(items).toHaveLength(5);
    for (const it of items) expect(it.sub).toMatch(/^DR /);
  });

  it('les gabarits de coque (Construction navale, MDG 12) portent Coût/Équipage/Longueur', () => {
    const items = categoryByKey('shipHullSizes')!.items;
    const moyenne = items.find((i) => i.label === 'Moyenne')!;
    expect(moyenne, 'Moyenne').toBeTruthy();
    expect(moyenne.meta?.find((f) => f.label === 'Équipage')?.value).toBe('20');
    expect(moyenne.meta?.find((f) => f.label === 'Longueur')?.value).toBe('21–35 m');
  });

  it('la fiche « Navigation maritime » (dataset-OBJET, MDG 13/15) projette Salissures + Orientation + Course-poursuite', () => {
    const cat = categoryByKey('seaNavigation')!;
    expect(cat.items).toHaveLength(1);
    const item = cat.items[0];
    expect(item.sections?.some((s) => /Salissures/.test(s.title))).toBe(true);
    expect(item.sections?.some((s) => /Orientation/.test(s.title))).toBe(true);
    expect(item.sections?.some((s) => /Course-poursuite/.test(s.title))).toBe(true);
  });

  it('la fiche « Périls en mer » (dataset-OBJET, MDG 13) projette Dangers flottants + Détroits + Tourbillons', () => {
    const cat = categoryByKey('seaPerils')!;
    expect(cat.items).toHaveLength(1);
    const item = cat.items[0];
    const hazardSec = item.sections?.find((s) => s.title === 'Dangers flottants');
    expect(hazardSec, 'section Dangers flottants').toBeTruthy();
    expect(hazardSec!.rows.some((r) => r.t === 'kv' && r.k === 'Iceberg')).toBe(true);
    expect(item.sections?.some((s) => s.title === 'Tourbillons')).toBe(true);
  });

  it('la fiche « Météo de la Mer des Griffes » (dataset-OBJET, MDG 13) projette le tirage quotidien + Vents', () => {
    const cat = categoryByKey('seaWeather')!;
    expect(cat.items).toHaveLength(1);
    const item = cat.items[0];
    const tirageSec = item.sections?.find((s) => /Tirage quotidien/.test(s.title));
    expect(tirageSec, 'section Tirage quotidien').toBeTruthy();
    expect(tirageSec!.rows.length).toBeGreaterThan(0);
    expect(item.sections?.some((s) => s.title === 'Vents')).toBe(true);
  });
});

describe('Codex registry — LOT 1 #422 (famille RÈGLES LDB : Coût des Augmentations, Disponibilité & Troc, Accidents de Conduite, Ivresse, Surchargé)', () => {
  it('les 5 nouvelles catégories sont exposées, peuplées et ÉDITABLES au Codex', () => {
    const keys = ['advancementCosts', 'disponibilite', 'drivingMishap', 'drunkenness', 'encumbranceTiers'];
    for (const key of keys) {
      const cat = categoryByKey(key);
      expect(cat, key).toBeTruthy();
      expect(cat!.items.length, key).toBeGreaterThan(0);
      expect(isEditableCategory(key), key).toBe(true);
    }
  });

  it('le Coût des Augmentations (LDB 07) porte 15 bandes avec leur coût Caractéristique/Compétence', () => {
    const items = categoryByKey('advancementCosts')!.items;
    expect(items).toHaveLength(15);
    const first = items.find((i) => i.label === '0–5')!;
    expect(first.meta?.find((f) => f.label === 'Coût — Caractéristique')?.value).toBe('25');
    expect(first.meta?.find((f) => f.label === 'Coût — Compétence')?.value).toBe('10');
  });

  it('la fiche « Disponibilité & Troc » (dataset-OBJET, LDB 59) projette le % de Disponibilité + les Ratios de Troc', () => {
    const cat = categoryByKey('disponibilite')!;
    expect(cat.items).toHaveLength(1);
    const item = cat.items[0];
    const pctSec = item.sections?.find((s) => /% de Disponibilité/.test(s.title));
    expect(pctSec, 'section % de Disponibilité').toBeTruthy();
    expect(pctSec!.rows.some((r) => r.t === 'sub' && r.label === 'Limitée')).toBe(true);
    const trocSec = item.sections?.find((s) => s.title === 'Ratios de Troc (donné : acquis)');
    expect(trocSec, 'section Ratios de Troc').toBeTruthy();
    expect(trocSec!.rows.some((r) => r.t === 'kv' && r.k === 'Acquis : Exotique')).toBe(true);
  });

  it('les Accidents de Conduite d’attelage (LDB 09) portent leurs 4 issues avec leur fourchette 1d10', () => {
    const items = categoryByKey('drivingMishap')!.items;
    expect(items).toHaveLength(4);
    const crash = items.find((i) => i.label === 'Essieu cassé')!;
    expect(crash.sub).toBe('1d10 9–10');
    expect(crash.meta?.find((f) => f.label === 'Type')?.value).toBe('Essieu cassé (Accidenté)');
  });

  it('le Tableau d’Ivresse (LDB 09) porte au moins un résultat avec son effet mécanique (GameOp)', () => {
    const items = categoryByKey('drunkenness')!.items;
    expect(items).toHaveLength(5);
    const withOps = items.find((i) => i.sections?.some((s) => s.title === 'Effet'));
    expect(withOps, 'au moins un résultat d’Ivresse porte un effet').toBeTruthy();
  });

  it('les Paliers d’Encombrement (LDB 61) portent 4 paliers, du sans-pénalité à l’immobilisé', () => {
    const items = categoryByKey('encumbranceTiers')!.items;
    expect(items).toHaveLength(4);
    const tier0 = items.find((i) => i.label === 'Palier 0')!;
    expect(tier0.meta?.find((f) => f.label === 'Pénalité de Mouvement')?.value).toBe('Aucune');
    const tier3 = items.find((i) => i.label === 'Palier 3')!;
    expect(tier3.meta?.find((f) => f.label === 'Pénalité de Mouvement')?.value).toBe('Immobilisé');
  });
});

describe('Codex — facettes', () => {
  it('filterItems : ET entre facettes, OU à l’intérieur, item sans valeur écarté par une facette active', () => {
    const items: CodexItem[] = [
      { id: 'averland', label: 'Averland', source: { book: 'LDB', page: 1 }, group: 'G1' },
      { id: 'barak', label: 'Barak', source: { book: 'ADE', page: 2 }, group: 'G1' },
      { id: 'carroburg', label: 'Carroburg', source: { book: 'LDB', page: 3 }, group: 'G2' },
      { id: 'dotern', label: 'Dötern' },
    ];
    const facets: CodexFacet[] = [
      { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book },
      { key: 'group', label: 'Groupe', valueOf: (i) => i.group },
    ];
    expect(filterItems(items, '', facets, {})).toHaveLength(4); // aucune facette active = tout passe
    expect(filterItems(items, '', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Averland', 'Carroburg']);
    expect(filterItems(items, '', facets, { book: ['LDB', 'ADE'] })).toHaveLength(3); // OU interne ; Dötern sans livre écarté
    expect(filterItems(items, '', facets, { book: ['LDB'], group: ['G1'] }).map((i) => i.label)).toEqual(['Averland']); // ET entre facettes
    expect(filterItems(items, 'carro', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Carroburg']); // recherche + facette
  });

  it('facetValues dérive les valeurs des items (comptées, triées FR)', () => {
    const facet: CodexFacet = { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book };
    const items: CodexItem[] = [
      { id: 'a', label: 'A', source: { book: 'LDB', page: 1 } },
      { id: 'b', label: 'B', source: { book: 'ADE', page: 1 } },
      { id: 'c', label: 'C', source: { book: 'LDB', page: 2 } },
      { id: 'd', label: 'D' },
    ];
    expect(facetValues(items, facet)).toEqual([
      { value: 'ADE', count: 1 },
      { value: 'LDB', count: 2 },
    ]);
  });

  it('chaque catégorie déclare ses facettes sur la donnée RÉELLE (livre / groupe ssi porté par des items)', () => {
    for (const c of CODEX) {
      const hasBook = c.items.some((i) => i.source?.book);
      const hasGroup = c.items.some((i) => i.group);
      expect(!!c.facets?.some((f) => f.key === 'book'), `${c.key} facette livre`).toBe(hasBook);
      expect(!!c.facets?.some((f) => f.key === 'group'), `${c.key} facette groupe`).toBe(hasGroup);
    }
  });
});

describe('Codex registry — sous-groupes repliables (clusters, #378 volet B)', () => {
  it('clustersIn éclate flat + clusters sans perte ni doublon, cluster cohérent', () => {
    for (const g of CODEX_GROUPS) {
      const { flat, clusters } = clustersIn(g);
      const all = categoriesIn(g);
      const recomposed = [...flat, ...clusters.flatMap((c) => c.cats)];
      expect(new Set(recomposed.map((c) => c.key)).size).toBe(all.length);
      expect(recomposed.map((c) => c.key).sort()).toEqual(all.map((c) => c.key).sort());
      for (const c of flat) expect(c.cluster).toBeUndefined();
      for (const cl of clusters) for (const c of cl.cats) expect(c.cluster).toBe(cl.label);
    }
  });

  it('tout cluster déclaré regroupe AU MOINS 2 catégories (sinon = pastille à plat)', () => {
    for (const g of CODEX_GROUPS)
      for (const cl of clustersIn(g).clusters)
        expect(cl.cats.length, `${g} › ${cl.label}`).toBeGreaterThanOrEqual(2);
  });

  it('les familles touffues Effets/Tables sont dégonflées (anti-avalanche)', () => {
    for (const g of ['Effets', 'Tables'] as const) {
      const { flat, clusters } = clustersIn(g);
      // Éléments visibles dans la barre (pastilles à plat + en-têtes de dépliables) ≪ nombre brut de catégories.
      expect(flat.length + clusters.length, g).toBeLessThan(categoriesIn(g).length);
      expect(clusters.length, g).toBeGreaterThan(0);
    }
  });
});

describe('Codex registry — fiche de Carrière étoffée (#378 volet C)', () => {
  it('porte des faits-clés (Classe + Statut), un onglet Progression et sa desc verbatim', () => {
    const agitateur = categoryByKey('careers')!.items.find((i) => i.label === 'Agitateur')!;
    expect(agitateur, 'Agitateur').toBeTruthy();
    expect(agitateur.meta?.find((f) => f.label === 'Classe')?.value).toBeTruthy();
    expect(agitateur.meta?.find((f) => f.label === 'Statut')?.value).toContain('→');
    expect(agitateur.tabs?.some((t) => t.title === 'Progression')).toBe(true);
    expect(agitateur.desc).toBeTruthy();
  });

  it('chaque carrière porte Classe + Statut + un onglet Progression peuplé', () => {
    for (const it of categoryByKey('careers')!.items) {
      expect(it.meta?.find((f) => f.label === 'Classe')?.value, it.label).toBeTruthy();
      expect(it.meta?.find((f) => f.label === 'Statut')?.value, it.label).toBeTruthy();
      const prog = it.tabs?.find((t) => t.title === 'Progression');
      expect(prog, it.label).toBeTruthy();
      expect(prog!.sections.length, it.label).toBeGreaterThan(0);
    }
  });
});

describe('Codex search', () => {
  it('deburr retire accents + casse', () => {
    expect(deburr('Bénédiction')).toBe('benediction');
    expect(deburr('À Terre')).toBe('a terre');
  });

  it('terme vide = tout passe', () => {
    expect(codexMatch({ id: 'x', label: 'X' }, '')).toBe(true);
    expect(codexMatch({ id: 'x', label: 'X' }, '   ')).toBe(true);
  });

  it('match insensible casse/accents sur label, sub et desc', () => {
    const it = { id: 'benediction-de-chance', label: 'Bénédiction de Chance', sub: 'Béni', desc: 'relancer un Test' };
    expect(codexMatch(it, 'benediction')).toBe(true);
    expect(codexMatch(it, 'CHANCE')).toBe(true);
    expect(codexMatch(it, 'beni')).toBe(true);
    expect(codexMatch(it, 'relancer')).toBe(true);
    expect(codexMatch(it, 'dragon')).toBe(false);
  });
});

describe('Codex registry — Effets de Saturation par Vent (libellé de Domaine résolu au registre)', () => {
  it('porte le nom accentué du Domaine (`domains.json`), jamais l’id découpé', () => {
    const cat = categoryByKey('arcanePhenomena')!;
    const rows = cat.items.filter((i) => i.group === 'Effets de Saturation par Vent');
    expect(rows.length).toBe(windSaturationEffects.length);
    for (const w of windSaturationEffects) {
      const domain = findDomainById(w.domainId)!;
      const item = rows.find((i) => i.id === w.id)!;
      expect(item.label).toBe(`${w.wind} — ${domain.label}`);
    }
  });
});

describe('Codex — rangées de référence par id (#1897)', () => {
  /** Ids des rangées 'ref' d'une section titrée de la fiche. */
  const refIdsOf = (item: CodexItem | undefined, title: string): string[] =>
    (item?.sections ?? []).filter((s) => s.title === title).flatMap((s) => s.rows).flatMap((r) => (r.t === 'ref' ? [r.id] : []));
  const HOMONYMES: [string, string][] = [['enchevetrement', 'enchevetrement-2'], ['crevasse', 'crevasse-lumiere'], ['brume-mystique', 'brume-mystique-magie-du-marais']];

  it('les homonymes de spells.json partagent leur libellé (plié) sous deux ids', () => {
    for (const [a, b] of HOMONYMES) {
      const la = spells.find((x) => x.id === a)?.label, lb = spells.find((x) => x.id === b)?.label;
      expect(la && lb && deburr(la).toLowerCase() === deburr(lb).toLowerCase(), `${a}/${b}`).toBe(true);
    }
  });

  it('Taal › Miracles › Enchevêtrement pointe enchevetrement-2', () => {
    const taal = categoryByKey('gods')!.items.find((i) => i.id === 'taal');
    expect(refIdsOf(taal, 'Miracles')).toContain('enchevetrement-2');
    expect(refIdsOf(taal, 'Miracles')).not.toContain('enchevetrement');
  });

  it('chaque divinité lie EXACTEMENT les ids de sa donnée', () => {
    const cat = categoryByKey('gods')!;
    for (const g of gods) {
      const item = cat.items.find((i) => i.id === g.id);
      expect(refIdsOf(item, 'Bénédictions'), `${g.id} bénédictions`).toEqual(g.blessings);
      expect(refIdsOf(item, 'Miracles'), `${g.id} miracles`).toEqual(g.miracles);
      expect(refIdsOf(item, 'Sorts du Chaos'), `${g.id} chaos`).toEqual(g.chaosSpells ?? []);
    }
  });

  it('chaque créature lie EXACTEMENT les ids de ses sorts, compétences et talents', () => {
    const cat = categoryByKey('creatures')!;
    for (const c of creatures) {
      const item = cat.items.find((i) => i.id === c.id);
      expect(refIdsOf(item, 'Sorts'), `${c.id} sorts`).toEqual(c.spells);
      expect(refIdsOf(item, 'Compétences'), `${c.id} compétences`).toEqual(c.skills.map((r) => r.id));
      expect(refIdsOf(item, 'Talents'), `${c.id} talents`).toEqual(c.talents.map((r) => r.id));
    }
  });
});
