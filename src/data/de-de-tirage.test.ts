/**
 * Le DÉ DE TIRAGE d'un document-table (`options.deDeTirage`, `grammaire/document.ts`) : il vit dans le
 * document, et le lecteur le tire de là (`deDeTirageDe`, `src/data/rangees.ts`). #1667
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS_DE_DOCUMENT, validateDataset } from './schemas/validate';
import { z } from 'zod';
import { META_CHARGE, tableTiree } from './schemas/grammaire/document';
import { deDeTirageDe } from './rangees';
import { formatDice } from '../engine/dice';
import { deDeLaTableTiree } from '../engine/tables';
import { weatherDie, type Season } from '../engine/travelStages';
import { encounterDie } from '../engine/travelTables';
import { SHIP_CRIT_SET } from './shipCriticals';
import { massBattleHazardsDie, starSubDie, weather } from './index';
import { peripetieSeuilDie } from './peripeties';
import type * as obsessions from './schemas/defs/obsessions';
import type * as miscast from './schemas/defs/miscast';

/** Le dé IMPRIMÉ par le livre pour chaque document-table, à sa réf. */
const LIVRE: Record<string, { die: string; ref: string }> = {
  'artillery-misfire': { die: '1d10', ref: 'AA 10 l.272' },
  dispersion: { die: '1d10', ref: 'LDB 14 l.144' },
  'reaction-au-statut': { die: '1d10', ref: 'LDB 08 l.40' },
  'tableau-capricieux': { die: '1d10', ref: 'MSRC 15 l.151' },
  'incidents-monte': { die: '1d100', ref: 'EDOC 07 l.150' },
  'problemes-vehicule': { die: '1d100', ref: 'EDOC 07 l.259' },
  'structure-criticals': { die: '1d100', ref: 'AA 10 l.118' },
  obsessions: { die: '2d10', ref: 'EDOC 12 l.172' },
  'talents-aleatoires': { die: '1d100', ref: 'LDB 05 l.514' },
  'races-ldb': { die: '1d100', ref: 'LDB 04 l.95' },
  'races-gnome': { die: '1d100', ref: 'NADJ 14 l.68' },
  'races-ogre': { die: '1d100', ref: 'ADE II 02 l.110' },
  'races-gnome-et-ogre': { die: '1d100', ref: 'maison, NADJ 14 l.68, ADE II 02 l.110' },
  'mutation-nature-humain': { die: '1d100', ref: 'LDB 19 l.76' },
  'mutation-nature-halfling': { die: '1d100', ref: 'LDB 19 l.76' },
  'mutation-nature-nain': { die: '1d100', ref: 'LDB 19 l.76' },
  'mutation-nature-haut-elfe': { die: '1d100', ref: 'LDB 19 l.76' },
  'mutation-nature-elfe-sylvain': { die: '1d100', ref: 'LDB 19 l.76' },
  'mutation-nature-ogre': { die: '1d100', ref: 'ADE II 02 l.172, LDB 19 l.76' },
  'mutation-nature-gnome': { die: '1d100', ref: 'NADJ 15 l.173, LDB 19 l.76' },
  'cargaisons-mer-printemps': { die: '1d100', ref: 'MDG 15 l.404, l.406' },
  'cargaisons-mer-ete': { die: '1d100', ref: 'MDG 15 l.404, l.406' },
  'cargaisons-mer-automne': { die: '1d100', ref: 'MDG 15 l.404, l.406' },
  'cargaisons-mer-hiver': { die: '1d100', ref: 'MDG 15 l.404, l.406' },
  'cargaisons-terre-printemps': { die: '1d100', ref: 'MSRC 13 l.69, l.75' },
  'cargaisons-terre-ete': { die: '1d100', ref: 'MSRC 13 l.69, l.76' },
  'cargaisons-terre-automne': { die: '1d100', ref: 'MSRC 13 l.69, l.77' },
  'cargaisons-terre-hiver': { die: '1d100', ref: 'MSRC 13 l.69, l.78' },
  humain: { die: '1d100', ref: 'LDB 05 l.210' },
  halfling: { die: '1d100', ref: 'LDB 05 l.210' },
  nain: { die: '1d100', ref: 'LDB 05 l.210' },
  'haut-elfe': { die: '1d100', ref: 'LDB 05 l.210' },
  'elfe-sylvain': { die: '1d100', ref: 'LDB 05 l.210' },
  gnome: { die: '1d100', ref: 'NADJ 14 l.79, LDB 05 l.210' },
  ogre: { die: '1d100', ref: 'ADE II 02 l.126, LDB 05 l.210' },
  middenheim: { die: '1d100', ref: 'Middenheim 09 l.13, LDB 05 l.210' },
  middenland: { die: '1d100', ref: 'Middenheim 09 l.13, LDB 05 l.210' },
  nordland: { die: '1d100', ref: 'Middenheim 09 l.13, LDB 05 l.210' },
  norse: { die: '1d100', ref: 'MDG 07 l.271' },
  'cotiers-humain': { die: '1d100', ref: 'MDG 09 l.9, LDB 05 l.210' },
  'cotiers-halfling': { die: '1d100', ref: 'MDG 09 l.9, LDB 05 l.210' },
  'cotiers-nain': { die: '1d100', ref: 'MDG 09 l.9, LDB 05 l.210' },
  'cotiers-haut-elfe': { die: '1d100', ref: 'MDG 09 l.9, LDB 05 l.210' },
  'cotiers-elfe-sylvain': { die: '1d100', ref: 'MDG 09 l.9, LDB 05 l.210' },
  'variantes-cavalier': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-chevalier': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-pretre-guerrier': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-soldat': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-colporteur': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-erudit': { die: '1d100', ref: 'AA 02 l.117-128' },
  'variantes-ingenieur': { die: '1d100', ref: 'AA 02 l.117-128' },
  ivresse: { die: '1d10', ref: 'LDB 09 l.477' },
  'accidents-conduite-attelage': { die: '1d10', ref: 'LDB 09 l.142' },
  'force-des-vents': { die: '1d10', ref: 'LDB 46 l.183' },
  'miscast-mineure': { die: '1d100', ref: 'LDB 46 l.34' },
  'miscast-majeure': { die: '1d100', ref: 'LDB 46 l.58' },
  'miscast-mineure-vdm': { die: '1d100', ref: 'VDM 02 l.218' },
  'miscast-majeure-vdm': { die: '1d100', ref: 'VDM 02 l.243' },
  'miscast-colere': { die: '1d100', ref: 'LDB 40 l.54' },
  'mendier-ennuis': { die: '1d10', ref: 'maison, LDB 09 l.97' },
  'allure-demoniaque-nurgle': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-slaanesh': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-tzeentch': { die: '1d10', ref: 'EDOC 13 l.276' },
  'allure-demoniaque-indivisible': { die: '1d10', ref: 'EDOC 13 l.276' },
  'contremaitre-lieu': { die: '1d100', ref: 'AA 12 l.70' },
  'contremaitre-objectif': { die: '1d100', ref: 'AA 12 l.96' },
  'contremaitre-personnalite': { die: '1d100', ref: 'AA 12 l.124' },
  'vdm-incantateur-hasardeux-domaine': { die: '1d100', ref: 'VDM 15 l.188' },
  'vdm-siphonnage-de-sort': { die: '1d10', ref: 'VDM 15 l.212' },
  'vdm-marques-arcaniques-lumiere': { die: '1d10', ref: 'VDM 04 l.156' },
  'vdm-marques-arcaniques-metal': { die: '1d10', ref: 'VDM 05 l.142' },
  'vdm-marques-arcaniques-vie': { die: '1d10', ref: 'VDM 06 l.141' },
  'vdm-marques-arcaniques-cieux': { die: '1d10', ref: 'VDM 07 l.142' },
  'vdm-marques-arcaniques-ombres': { die: '1d10', ref: 'VDM 08 l.136' },
  'vdm-marques-arcaniques-mort': { die: '1d10', ref: 'VDM 09 l.136' },
  'vdm-marques-arcaniques-feu': { die: '1d10', ref: 'VDM 10 l.122' },
  'vdm-marques-arcaniques-bete': { die: '1d10', ref: 'VDM 11 l.142' },
  'vdm-maladie-coups-de-poing-maudits': { die: '1d10', ref: 'VDM 12 l.920' },
  'vdm-catastrophes-de-brassage': { die: '1d10', ref: 'VDM 12 l.389' },
  'vdm-symboles-augure': { die: '1d10', ref: 'VDM 03 l.503' },
  physique: { die: '1d100', ref: 'LDB 19 l.116' },
  mentale: { die: '1d100', ref: 'LDB 19 l.144' },
  'edoc-phys-toute': { die: '1d100', ref: 'EDOC 12 l.65' },
  'edoc-phys-khorne': { die: '1d100', ref: 'EDOC 12 l.65' },
  'edoc-phys-nurgle': { die: '1d100', ref: 'EDOC 12 l.65' },
  'edoc-phys-slaanesh': { die: '1d100', ref: 'EDOC 12 l.65' },
  'edoc-phys-tzeentch': { die: '1d100', ref: 'EDOC 12 l.65' },
  'edoc-tete-bestiale-toute': { die: '1d100', ref: 'EDOC 12 l.152' },
  'edoc-tete-bestiale-khorne': { die: '1d100', ref: 'EDOC 12 l.152' },
  'edoc-tete-bestiale-nurgle': { die: '1d100', ref: 'EDOC 12 l.152' },
  'edoc-tete-bestiale-slaanesh': { die: '1d100', ref: 'EDOC 12 l.152' },
  'edoc-tete-bestiale-tzeentch': { die: '1d100', ref: 'EDOC 12 l.152' },
  'edoc-mental-toute': { die: '1d100', ref: 'EDOC 12 l.204' },
  'edoc-mental-khorne': { die: '1d100', ref: 'EDOC 12 l.204' },
  'edoc-mental-nurgle': { die: '1d100', ref: 'EDOC 12 l.204' },
  'edoc-mental-slaanesh': { die: '1d100', ref: 'EDOC 12 l.204' },
  'edoc-mental-tzeentch': { die: '1d100', ref: 'EDOC 12 l.204' },
  'criticals-ldb-tete': { die: '1d100', ref: 'LDB 18 l.53' },
  'criticals-ldb-bras': { die: '1d100', ref: 'LDB 18 l.53' },
  'criticals-ldb-corps': { die: '1d100', ref: 'LDB 18 l.53' },
  'criticals-ldb-jambe': { die: '1d100', ref: 'LDB 18 l.53' },
  'criticals-aa-tete': { die: '1d100', ref: 'AA 07 l.32' },
  'criticals-aa-bras': { die: '1d100', ref: 'AA 07 l.32' },
  'criticals-aa-corps': { die: '1d100', ref: 'AA 07 l.32' },
  'criticals-aa-jambe': { die: '1d100', ref: 'AA 07 l.32' },
  'tableau-des-oups': { die: '1d100', ref: 'LDB 14 l.23-30 (« bandes 01-00 »)' },
  'tableau-des-evenements': { die: '1d100', ref: 'LDB 22 l.5' },
  'panne-de-vapeur': { die: '1d100', ref: 'MDG 12 l.323' },
  'signes-astrologiques': { die: '1d100', ref: 'ADE II 03 l.42' },
  'couleur-des-yeux': { die: '2d10', ref: 'LDB 05 l.744' },
  'couleur-des-cheveux': { die: '2d10', ref: 'LDB 05 l.758' },
  peripeties: { die: '1d10', ref: 'LDB 51 l.210' },
};

/** Le dé IMPRIMÉ par le livre pour chaque table tirée NICHÉE (`tableTiree`, `grammaire/document.ts`),
 *  par `fichier › chemin` (une table d'une liste à clé s'y nomme par son `id`). */
const TABLES_NICHEES_LIVRE: Record<string, { die: string; ref: string }> = {
  'arcane-phenomena.json › tables.vdm-corruption-chaotique': { die: '1d100', ref: 'VDM 14 l.49-58 (« bandes 1–00 »)' },
  'arcane-phenomena.json › tables.vdm-corruption-necromantique': { die: '1d100', ref: 'VDM 14 l.66-75 (« bandes 1–00 »)' },
  'arcane-phenomena.json › tables.vdm-flux-magique': { die: '1d10', ref: 'VDM 14 l.96' },
  'land-cargo.json › rumeurs': { die: '1d100', ref: 'MSRC 13 l.283' },
  'land-cargo.json › qualiteDuVin': { die: '1d10', ref: 'MSRC 13 l.97' },
  'mass-battle.json › hazards': { die: '1d10', ref: 'ADE II 08 l.311' },
  'river-navigation.json › windDirections': { die: '1d10', ref: 'MSRC 7 l.25' },
  'river-navigation.json › windForces': { die: '1d10', ref: 'MSRC 7 l.27' },
  'sea-events.json › boardEvents': { die: '1d100', ref: 'MDG 15 l.134' },
  'sea-events.json › fastVoyage': { die: '1d10', ref: 'MDG 15 l.32' },
  'sea-events.json › portEvents': { die: '2d10', ref: 'MDG 15 l.243' },
  'sea-navigation.json › orientation.changementDeCap': { die: '1d10', ref: 'MDG 13 l.326' },
  'sea-weather.json › roseDesVents': { die: '1d10', ref: 'MDG 13 l.252' },
  'sea-weather.json › table': { die: '1d10', ref: 'MDG 13 l.170' },
  'water-exposure.json › diseases': { die: '1d100', ref: 'MSRC 16 l.53' },
  'weather.json › seasons.printemps': { die: '1d100', ref: 'EDOC 8 l.52-59' },
  'weather.json › seasons.ete': { die: '1d100', ref: 'EDOC 8 l.52-59' },
  'weather.json › seasons.automne': { die: '1d100', ref: 'EDOC 8 l.52-59' },
  'weather.json › seasons.hiver': { die: '1d100', ref: 'EDOC 8 l.52-59' },
};

/** Toute table tirée NICHÉE d'un document, lue au disque : un objet sous le document qui porte un `die` et
 *  des `entries`, hors table INLINE d'une op `rollTable` (`grammaire/mecanique.ts`). */
function tablesNichees(): { ou: string; die: string }[] {
  const vues: { ou: string; die: string }[] = [];
  const visite = (v: unknown, fichier: string, chemin: string[], document: boolean) => {
    if (Array.isArray(v)) return v.forEach((x, i) => visite(x, fichier, [...chemin, (x as { id?: string } | null)?.id ?? String(i)], document && !chemin.length));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (!document && !('op' in o) && typeof o.die === 'string' && Array.isArray(o.entries)) vues.push({ ou: `${fichier} › ${chemin.join('.')}`, die: o.die });
    for (const [k, x] of Object.entries(o)) visite(x, fichier, [...chemin, k], false);
  };
  for (const d of DEFS_DE_DOCUMENT) visite(JSON.parse(readFileSync(join(process.cwd(), d.root, d.file), 'utf8')), d.file, [], true);
  return vues;
}

/** Tout document dont la FABRIQUE pose `die` (elle en publie la méta, `META_CHARGE`), lu au disque. */
function documentsADe(): { id: string; die: string }[] {
  return DEFS_DE_DOCUMENT.filter((d) => d.meta?.die === META_CHARGE.die).flatMap((d) => {
    const doc = JSON.parse(readFileSync(join(process.cwd(), d.root, d.file), 'utf8')) as { id: string; die: string } | { id: string; die: string }[];
    return Array.isArray(doc) ? doc : [doc];
  });
}

describe('dé de tirage — en donnée, lu par le lecteur (#1667)', () => {
  it('chaque document-table nommé porte le dé imprimé par le livre', () => {
    const docs = documentsADe();
    for (const [id, livre] of Object.entries(LIVRE)) {
      expect(formatDice(deDeTirageDe<typeof miscast>(docs, id)), `${id} (${livre.ref})`).toBe(livre.die);
    }
  });

  it('chaque saison de `weather.json` porte le dé imprimé par le livre, lu par le moteur', () => {
    for (const s of weather) {
      const livre = TABLES_NICHEES_LIVRE[`weather.json › seasons.${s.id}`];
      expect(formatDice(weatherDie(s.id as Season)), `${s.id} (${livre.ref})`).toBe(livre.die);
    }
  });

  it('chaque table tirée nichée nommée porte le dé imprimé par le livre', () => {
    const vues = new Map(tablesNichees().map((t) => [t.ou, t]));
    for (const [ou, livre] of Object.entries(TABLES_NICHEES_LIVRE)) {
      const t = vues.get(ou);
      expect(t, `${ou} : table tirée nichée absente de la donnée`).toBeDefined();
      expect(formatDice(deDeLaTableTiree({ die: t!.die, id: ou })), `${ou} (${livre.ref})`).toBe(livre.die);
    }
  });

  it('les tables à dé hors fabrique portent le dé imprimé par le livre, tel que leur lecteur le tire', () => {
    expect(formatDice(SHIP_CRIT_SET.die!), 'ship-criticals (MDG 13 l.692)').toBe('1d10');
    expect(formatDice(encounterDie()), 'rencontres-edoc (EDOC 08 l.190)').toBe('1d100');
    expect(formatDice(starSubDie()), 'stars.json › sub (ADE II 03 l.63)').toBe('1d10');
    expect(formatDice(peripetieSeuilDie()), 'peripeties.json › tirageQuotidien (LDB 51 l.208)').toBe('1d10');
    expect(formatDice(massBattleHazardsDie()), 'mass-battle.json › hazards (ADE II 08 l.311)').toBe('1d10');
  });

  it('un sous-tirage n’a qu’une forme, `{ die }` : le `Tirage` (`{ dice }`) est refusé à la porte du Codex', () => {
    for (const [fichier, cle] of [['stars.json', 'sub'], ['peripeties.json', 'tirageQuotidien']] as const) {
      const doc = JSON.parse(readFileSync(join(process.cwd(), 'src/data', fichier), 'utf8')) as Record<string, unknown>;
      expect(validateDataset(fichier, { ...doc, [cle]: { die: 'd10' } }), `${fichier} › ${cle} en \`{ die }\``).toBeNull();
      expect(validateDataset(fichier, { ...doc, [cle]: { dice: { n: 1, sides: 10 } } }), `${fichier} › ${cle} en \`Tirage\``).toContain('"dice"');
    }
  });

  it('le dé se lit VIVANT sur le document, à l’appel', () => {
    const doc = { id: 'fixture', type: 'obsessions', label: 'Fixture', die: '2d10', entries: [] };
    expect(deDeTirageDe<typeof obsessions>(doc)).toEqual({ n: 2, sides: 10 });
    doc.die = 'd100';
    expect(deDeTirageDe<typeof obsessions>(doc)).toEqual({ n: 1, sides: 100 });
  });

  it('une table tirée sans rangée est refusée', () => {
    const table = tableTiree(z.strictObject({ min: z.number(), max: z.number() }));
    expect(table.safeParse({ die: 'd10', entries: [{ min: 1, max: 10 }] }).success).toBe(true);
    expect(table.safeParse({ die: 'd10', entries: [] }).success, 'table tirée vide').toBe(false);
  });

  it('un document sans dé est refusé, jamais tiré à un dé par défaut', () => {
    expect(() => deDeTirageDe<typeof obsessions>({ id: 'fixture', type: 'obsessions', label: 'Fixture', entries: [] })).toThrow(/aucun dé de tirage/);
  });
});
