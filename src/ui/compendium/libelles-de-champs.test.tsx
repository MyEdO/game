/**
 * #1466 L1a T4 — l'atelier affiche un LIBELLÉ, plus la clé technique brute.
 *
 * Ce que ce fichier verrouille :
 *  - la CASCADE (`libelleDuChamp`) : clé d'ENVELOPPE → table FR de la fabrique (`document.ts`, seule
 *    détentrice de ces noms puisque `document()` refuse une méta sur une clé d'enveloppe) ; sinon la
 *    méta d'édition du def (canal `SchemaDef.meta`) ; sinon la clé technique ;
 *  - le CANAL registre→atelier (`metaPourFichier`) ;
 *  - le CANAL atelier→picker de réf (`RefField` reçoit le libellé, pas la clé) ;
 *  - la CONVENTION D'EXPORT que le générateur de registre sait lire (export PLAT `export const meta`).
 * Les champs de charge utile suivent la méta du def : leur libellé FR arrive avec l'adoption de
 * `document()` par le def (lot L1b #1467). Au 2026-08-28 les 76 defs `entite` ont adopté ; `oups.json`
 * reste le SEUL document registré sans méta (schéma d'UNION, hors des vagues d'adoption), et c'est lui
 * qui sert de témoin au canal « document sans méta » ci-dessous.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { libelleDuChamp, inferFields } from './editFields';
import { RefField, refFieldCfg } from './RefField';
import { editableEntries, isEditableCategory } from './CodexEdit';
import { CODEX } from './registry';
import { CLES_ENVELOPPE, LIBELLES_ENVELOPPE, document } from '../../data/schemas/grammaire/document';
import { metaPourFichier, DEFS_DE_DOCUMENT, noeudObjet, schemaForFile } from '../../data/schemas/validate';
import { enumNomme } from '../../data/schemas/grammaire/valeurs';
import { defDe } from '../../data/schemas/grammaire/slots';
import { stripComments } from '../../../scripts/guards/lib/hardcode.mjs';

const handleDemo = () => document(
  'demo', 'entite',
  { portee: z.number() },
  { portee: { label: 'Portée' } },
  { codex: { keys: ['demo'] }, edit: { none: 'fixture de test' } },
);

describe('table FR de l’enveloppe', () => {
  it('chaque clé d’enveloppe a son libellé FR non vide', () => {
    const manquants = CLES_ENVELOPPE.filter((k) => !LIBELLES_ENVELOPPE[k]?.trim());
    expect(manquants, `clés d’enveloppe sans libellé : ${manquants.join(', ')}`).toEqual([]);
  });

  it('la table ne se lit QUE sur ses propres clés (jamais la chaîne de prototypes)', () => {
    expect(libelleDuChamp('toString')).toBe('toString');
    expect(libelleDuChamp('constructor')).toBe('constructor');
  });
});

describe('cascade du libellé', () => {
  it('clé d’enveloppe → libellé FR de la fabrique', () => {
    expect(libelleDuChamp('id')).toBe('Identifiant');
    expect(libelleDuChamp('labelF')).toBe('Libellé (forme féminine)');
    expect(libelleDuChamp('alsoIn')).toBe('Aussi publié dans');
  });

  it('`type` sur un document SANS handle reste la clé (discriminant de charge utile, jamais « Type de document »)', () => {
    expect(libelleDuChamp('type')).toBe('type');
  });

  it('`type` sur un document À handle est bien le type de document', () => {
    expect(libelleDuChamp('type', { meta: handleDemo().meta })).toBe('Type de document');
  });

  it('champ de charge utile → label FR de la méta du def', () => {
    expect(libelleDuChamp('portee', { meta: handleDemo().meta })).toBe('Portée');
  });

  it('champ inconnu de la méta → clé technique (seam d’extinction, L1b #1467)', () => {
    expect(libelleDuChamp('cadence', { meta: handleDemo().meta })).toBe('cadence');
    expect(libelleDuChamp('cadence')).toBe('cadence');
  });
});

describe('cascade sur DONNÉE RÉELLE (`trappings`, def ADOPTÉ)', () => {
  const champs = () => inferFields(editableEntries('trappings') as Record<string, unknown>[], { meta: metaPourFichier('trappings.json') });

  /** Le discriminant de catalogue s'appelle `categorie` depuis #1467 L1b V-P5, et `trappings` a adopté
   *  `document()` à la vague 12b : il porte donc MAINTENANT une clé d'enveloppe `type` sur les mêmes
   *  entrées. Le CONTRAT que ce test tient est celui de la CASCADE : un champ de CHARGE UTILE prend le
   *  libellé que SON def déclare, et jamais celui d'une clé d'enveloppe homonyme — les deux coexistent
   *  sans se confondre. */
  it('`categorie` prend le libellé de SON def, jamais celui de la clé d’enveloppe `type` qui la côtoie', () => {
    const entrees = editableEntries('trappings') as Record<string, unknown>[];
    expect(entrees.some((e) => typeof e.categorie === 'string'), 'la population `categorie` a disparu de trappings.json').toBe(true);
    const meta = metaPourFichier('trappings.json');
    expect(meta, '`trappings` a adopté `document()` : sa méta doit arriver au canal').toBeDefined();
    expect(libelleDuChamp('categorie', { meta })).toBe('Catégorie');
    expect(champs().find((f) => f.key === 'categorie')!.label).toBe('Catégorie');
    // Le voisin d'ENVELOPPE garde SON nom à lui : aucune des deux clés n'emprunte le libellé de l'autre.
    expect(libelleDuChamp('type', { meta })).toBe(LIBELLES_ENVELOPPE.type);
    expect(libelleDuChamp('categorie', { meta })).not.toBe(LIBELLES_ENVELOPPE.type);
  });

  it('un champ d’enveloppe réel (`desc`) porte son libellé FR', () => {
    const desc = champs().find((f) => f.key === 'desc');
    expect(desc, '`desc` a disparu de trappings.json').toBeDefined();
    expect(desc!.label).toBe('Description');
  });
});

describe('inferFields porte le libellé sans perdre la clé', () => {
  it('avec méta : enveloppe libellée, charge utile libellée, inconnu en clé', () => {
    const champs = inferFields([{ id: 'a', label: 'A', portee: 3, cadence: 1 }], { meta: handleDemo().meta });
    expect(champs.map((f) => [f.key, f.label])).toEqual([
      ['id', 'Identifiant'],
      ['label', 'Libellé'],
      ['portee', 'Portée'],
      ['cadence', 'cadence'],
    ]);
  });

  it('sans méta (appel à 1 argument) : la table d’enveloppe s’applique seule, `type` excepté', () => {
    const champs = inferFields([{ id: 'a', type: 'melee', portee: 3 }]);
    expect(champs.map((f) => [f.key, f.label])).toEqual([
      ['id', 'Identifiant'],
      ['type', 'type'],
      ['portee', 'portee'],
    ]);
  });
});

/**
 * L'ENVELOPPE n'existe qu'au PREMIER NIVEAU. Population réelle mesurée : `naval-traits.json`
 * `install.installation.bands[]` porte `maison` sur 20 entrées, `activities.json` `outcomes[].ops[]` porte
 * `id` (« extenue ») sur 20 ops — homonymes de champs d'enveloppe, à NE PAS libeller.
 */
describe('régime PROFONDEUR — pas de fuite des libellés d’enveloppe dans les sous-formulaires', () => {
  it('un `maison` de bande de coût reste sa clé (jamais « Arbitrage maison »)', () => {
    const bandes = [{ maxLengthM: 35, value: 10 }, { maxLengthM: null, value: 20, maison: 'arbitrage' }];
    const cols = inferFields(bandes, { niveau: 'profondeur' });
    expect(cols.find((f) => f.key === 'maison')!.label).toBe('maison');
    expect(libelleDuChamp('maison', { niveau: 'profondeur' })).toBe('maison');
  });

  it('un `id` d’op de profondeur reste sa clé (jamais « Identifiant »)', () => {
    const ops = [{ op: 'condition', id: 'extenue' }];
    expect(inferFields(ops, { niveau: 'profondeur' }).find((f) => f.key === 'id')!.label).toBe('id');
    expect(libelleDuChamp('desc', { niveau: 'profondeur' })).toBe('desc');
  });

  it('le PREMIER NIVEAU garde ses libellés d’enveloppe (non-régression)', () => {
    expect(libelleDuChamp('maison')).toBe('Arbitrage maison');
    expect(libelleDuChamp('id')).toBe('Identifiant');
    expect(libelleDuChamp('desc')).toBe('Description');
    expect(inferFields([{ id: 'a', desc: 'd' }]).map((f) => f.label)).toEqual(['Identifiant', 'Description']);
  });

  it('la méta d’un def ne nomme pas non plus un sous-champ homonyme', () => {
    expect(libelleDuChamp('portee', { meta: handleDemo().meta, niveau: 'profondeur' })).toBe('portee');
  });
});

describe('canal registre → atelier (`metaPourFichier`)', () => {
  // `oups.json` tenait ce rôle tant que son schéma d'union le laissait hors de `document()` : il était
  // le DERNIER document registré sans méta. Son adoption (#1467 L1b V-UNION) vide cette population, si
  // bien que le témoin négatif n'a plus de porteur. Le contrat qui reste se dit au POSITIF, et il est
  // plus fort : le canal sert TOUT le registre, `undefined` signalant seulement le hors-registre.
  it('plus AUCUN document registré n’est sans méta — les DEUX racines comprises', () => {
    const sansMeta = DEFS_DE_DOCUMENT.filter((d) => metaPourFichier(d.file) === undefined).map((d) => `${d.root} · ${d.file}`);
    expect(sansMeta, `document(s) registré(s) sans méta — le canal atelier y retombe sur la clé technique :\n${sansMeta.join('\n')}`).toEqual([]);
  });

  it('les 4 projets de scène tiennent leur méta du HANDLE partagé (`defs-scenes/projet.ts`)', () => {
    // Un projet est UN document déclaré une seule fois : les 4 defs de `defs-scenes/` nomment leur
    // fichier et ré-exportent la méta du même handle. Le canal rend donc la MÊME table pour les 4.
    const projets = DEFS_DE_DOCUMENT.filter((d) => d.root === 'src/scenes');
    expect(projets.map((d) => d.file).sort()).toEqual([
      'arene/arene-projet.json',
      'barge-du-sel/barge-du-sel-projet.json',
      'diligence/diligence-projet.json',
      'loup-et-saumure/loup-et-saumure-projet.json',
    ]);
    for (const d of projets) {
      expect(metaPourFichier(d.file)?.versionContenu?.label, `${d.file} : méta du handle absente`).toBe('Version de contenu');
    }
    const tables = new Set(projets.map((d) => metaPourFichier(d.file)));
    expect(tables.size, 'les 4 defs doivent partager la MÊME table de méta (un seul handle)').toBe(1);
  });

  it('`oups.json` rend bien ses libellés de champs par le canal (témoin nominatif de l’adoption)', () => {
    expect(metaPourFichier('oups.json')?.kind?.label).toBe('Effet mécanique');
  });

  it('un fichier inconnu du registre rend `undefined` (jamais une exception)', () => {
    expect(metaPourFichier('fichier-qui-nexiste-pas.json')).toBeUndefined();
  });

  it('la clé du canal est le `file` du registre TEL QUEL — chemin relatif pour `src/scenes`, sans collision de basename', () => {
    const scenes = DEFS_DE_DOCUMENT.filter((d) => d.root === 'src/scenes');
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((d) => d.file.includes('/')), `un def de scène sans chemin relatif : ${scenes.map((d) => d.file).join(', ')}`).toBe(true);
    const files = DEFS_DE_DOCUMENT.map((d) => d.file);
    expect(new Set(files).size, 'deux defs partagent la même clé de canal').toBe(files.length);
    const basenames = scenes.map((d) => d.file.split('/').pop()!);
    const collisions = basenames.filter((b) => DEFS_DE_DOCUMENT.some((d) => d.file === b));
    expect(collisions, `basename de scène en collision avec un document de src/data : ${collisions.join(', ')}`).toEqual([]);
  });
});

describe('canal atelier → picker de référence (`RefField`)', () => {
  it('un champ à config REF affiche le LIBELLÉ reçu, jamais sa clé technique', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="type" label="Type de document" value="" onChange={() => {}} />);
    expect(html).toContain('Type de document');
    expect(html).not.toContain('<span>type<');
  });

  it('sans libellé, le picker retombe sur la clé (appelants qui ne connaissent que la clé)', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="subType" value="" onChange={() => {}} />);
    expect(html).toContain('subType');
  });

  /**
   * BUG de recette (2026-08-26) : la config de `skills.characteristic` peuplait ses options par
   * `abr` alors que `skills.json` stocke l'`id` — le select rendait « dexterite (inconnu) » sur une
   * donnée VALIDE, et les 7 `abr` vides collidaient en une même clé React.
   */
  it('`skills.characteristic` : la valeur STOCKÉE est une option, et les clés d’option sont uniques', () => {
    const skills = editableEntries('skills') as Record<string, unknown>[];
    const stockees = [...new Set(skills.map((s) => String(s.characteristic ?? '')))].filter(Boolean);
    expect(stockees.length, 'la population `characteristic` a disparu de skills.json').toBeGreaterThan(0);
    const cfg = refFieldCfg('skills', 'characteristic')!;
    for (const v of stockees) {
      const html = renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={v} onChange={() => {}} />);
      expect(html, `valeur stockée « ${v} » rendue « (inconnu) » — la config du select ne parle pas la langue de la donnée`).not.toContain('(inconnu)');
      expect(html).toContain(`value="${v}"`);
    }
    const valeursDOption = [...renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={stockees[0]} onChange={() => {}} />).matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    const doublons = valeursDOption.filter((v, i) => valeursDOption.indexOf(v) !== i);
    expect(doublons, `clés d’option dupliquées (warning React « same key ») : ${doublons.join(', ')}`).toEqual([]);
  });

  it('les champs à config REF des catégories réelles sont bien porteurs d’un libellé (même projection que `CodexEdit`)', () => {
    const refs = CODEX.filter((c) => isEditableCategory(c.key)).flatMap((c) =>
      inferFields(editableEntries(c.key) as Record<string, unknown>[], { meta: metaPourFichier(`${c.key}.json`) })
        .filter((f) => refFieldCfg(c.key, f.key))
        .map((f) => ({ cat: c.key, key: f.key, label: f.label })),
    );
    expect(refs.length, 'aucun champ à config REF trouvé — la projection a changé de forme').toBeGreaterThan(0);
    const nus = refs.filter((r) => !r.label);
    expect(nus, `champ REF sans libellé : ${nus.map((r) => `${r.cat}.${r.key}`).join(', ')}`).toEqual([]);
  });
});

/**
 * CLIQUET DU SEAM D'EXTINCTION (L1b #1467) — quelle PART des champs affichés au premier niveau de
 * l'atelier porte un libellé FR plutôt que sa clé technique. La mesure est REFAITE ici par le code
 * (mêmes projections que `CodexEdit` : catégories éditables × entrées réelles × `inferFields`), jamais
 * un couple de nombres recopié : chaque def qui adopte `document()` la fait MONTER, une régression du
 * canal (méta perdue, table d'enveloppe amputée) la fait DESCENDRE et rougit.
 */
describe('cliquet — part des champs de premier niveau qui portent un libellé', () => {
  const champsAffiches = () =>
    CODEX.filter((c) => isEditableCategory(c.key)).flatMap((c) =>
      inferFields(editableEntries(c.key) as Record<string, unknown>[], { meta: metaPourFichier(`${c.key}.json`) }),
    );

  // PLANCHER NOMINAL : 819/1220 = 67,1 % — mesure du 2026-08-28 sur l'arbre, les 76 defs `entite`
  // ayant adopté `document()`. Le 31,8 % (356/1118) du 2026-08-26 valait pour 0 def adoptant.
  //
  // CAUSES, mesurées — les DEUX termes ont bougé, et pour des raisons distinctes :
  //  • NUMÉRATEUR 356 → 819 : c'est l'essentiel du gain, et il est ENTIÈREMENT dû à l'adoption — la
  //    méta des defs adoptés arrive au canal `metaPourFichier` et libelle des champs de charge utile
  //    qui rendaient jusque-là leur clé technique.
  //  • DÉNOMINATEUR 1118 → 1220 (+102) : il n'est PAS imputable à la seule clé `type`. Mesuré sur
  //    l'arbre : 63 des 117 catégories éditables portent `type`, soit 63 champs de la population de
  //    1220 — dont 6 seulement entrent à CE lot, les 57 autres venant des vagues 11a/11b/12a. Le
  //    reste de la croissance s'étale sur ces mêmes vagues (entre la mesure du 26 et celle du 28) et
  //    ne se ventile pas d'ici : la ligne dit ce qu'elle a mesuré, elle n'invente pas le solde.
  // La mesure est refaite par la projection réelle de `CodexEdit`, jamais recopiée. Marge du plancher :
  // 0,6 pt — la perte de la méta d'un seul def moyen (une dizaine de champs) rougit.
  it('la part libellée ne redescend pas sous son plancher (66,5 % au 2026-08-28 — 76 defs adoptants)', () => {
    const champs = champsAffiches();
    const libelles = champs.filter((f) => f.label && f.label !== f.key);
    expect(champs.length, 'la projection des champs affichés a changé de forme').toBeGreaterThan(500);
    const part = libelles.length / champs.length;
    expect(
      part,
      `part libellée = ${libelles.length}/${champs.length} = ${(part * 100).toFixed(1)} %`,
    ).toBeGreaterThanOrEqual(0.665);
  });

  it('le cliquet mesure bien le CANAL : tout champ libellé l’est PAR LA CASCADE, jamais par la projection', () => {
    // Non-vacuité : chaque libellé compté se retrouve en repassant la clé dans `libelleDuChamp` avec la
    // méta de sa catégorie — aucun n'est un artefact d'`inferFields`.
    const ecarts = CODEX.filter((c) => isEditableCategory(c.key)).flatMap((c) => {
      const meta = metaPourFichier(`${c.key}.json`);
      return inferFields(editableEntries(c.key) as Record<string, unknown>[], { meta })
        .filter((f) => f.label !== f.key && libelleDuChamp(f.key, { meta }) !== f.label)
        .map((f) => `${c.key}.${f.key} → ${f.label}`);
    });
    expect(ecarts, 'un libellé affiché que la cascade ne rend pas').toEqual([]);
  });
});

/**
 * CONVENTION D'EXPORT du générateur de registre (`scripts/gen-registry.mjs`) : il est TEXTUEL et
 * lit chaque nom PAR REGEX — `fields: ['file', 'schema', 'famille', 'exposition']` plus
 * `optionalFields: ['meta']`, pour les DEUX registres de schémas. Conséquences MESURÉES, une par export :
 *  - `file` non conforme au filtre `scripts/gen-registry.mjs:388` (`^export const file = '`, guillemet
 *    SIMPLE littéral) : le def est ÉCARTÉ du registre, en silence — double quote, `: string` annoté,
 *    littéral gabarit et `= doc.file` compilent tous et sortent pourtant du registre ;
 *  - `meta` non PLAT : invisible de `presents()` (`scripts/gen-registry.mjs:400`), donc absent de
 *    l'entrée générée — l'atelier retombe sur la clé technique sans qu'aucun gate ne rougisse ;
 *  - `schema`/`famille` destructurés (`export const { schema } = doc`) COMPILERAIENT (la destructuration
 *    crée un vrai nom importé) : ici la garde ne protège pas la compilation mais la CONVENTION du lot
 *    — forme plate unique sur les adoptions, lisible par le codemod. C'est cette garde qui la tient.
 *
 * POPULATION : les modules de `RACINES_DE_DEFS` qui déclarent un document ET nomment un fichier (cf.
 * `NOMME_UN_FICHIER` ci-dessous). Le contrat mord donc sur les defs adoptants ; les fixtures de source
 * en prouvent chaque bras, forme par forme, y compris les deux formes HORS population.
 */
const RACINES_DE_DEFS = ['src/data/schemas/defs', 'src/data/schemas/defs-scenes'];
const APPELLE_DOCUMENT = /\bdocument\s*\(/;
/**
 * Ce qui fait d'un module un DEF : nommer un fichier de données. C'est le critère du générateur
 * lui-même (`scripts/gen-registry.mjs:388`, registre à champ `file`) — un module du dossier qui ne
 * déclare aucun `export const file` n'entre pas au registre : c'est un module de FORME partagé entre
 * defs (`defs-scenes/projet.ts` déclare LE document de projet, que les 4 defs de campagne nomment
 * chacun pour SON fichier). Ici cette forme large (`export const file`, guillemet libre) borne la
 * POPULATION ; le verdict d'appartenance, lui, reste la regex STRICTE du gen (`FILE_DU_GEN`), si bien
 * qu'un `file` à double quote/annoté/indirect reste ROUGE au lieu de sortir du périmètre.
 * La forme large couvre AUSSI la destructuration (`export const { file, … } = doc`) : ce module-là
 * PRÉTEND nommer un fichier, il reste donc jugé — et rouge, la forme n'étant pas celle du gen.
 * ANGLE MORT ASSUMÉ, et c'est celui DU GÉNÉRATEUR : un def qui omettrait `file` ENTIÈREMENT est
 * structurellement indiscernable d'un module de forme — le gen l'écarte en silence, la garde aussi.
 */
const NOMME_UN_FICHIER = /^export const (?:file\b|\{[^}]*\bfile\b[^}]*\})/m;
/** Les quatre exports PLATS lus par le gen, dans l'ordre du message d'échec. */
const EXPORTS_PLATS = ['file', 'schema', 'famille', 'meta'] as const;
/** LA regex du générateur pour `file`, recopiée de `scripts/gen-registry.mjs:388` — guillemet SIMPLE
 *  littéral : elle seule décide de l'appartenance au registre. */
const FILE_DU_GEN = /^export const file = '/m;
const exportPlat = (nom: string) =>
  nom === 'file' ? FILE_DU_GEN : new RegExp(`^export const ${nom}\\b`, 'm');

/**
 * Defs qui déclarent un document sans exporter les quatre noms À PLAT — une ligne
 * `fichier : manque <noms>` par def, la liste que la garde exige vide.
 */
export function defsSansExportsPlats(sources: { file: string; src: string }[]): string[] {
  // `stripComments` (lib de garde partagée) : une PROSE qui dit « intra-document » n'est pas un appel
  // à la fabrique, et l'import nommé de `document` non plus — seuls les SITES d'appel comptent.
  return sources
    .filter((s) => APPELLE_DOCUMENT.test(stripComments(s.src)) && NOMME_UN_FICHIER.test(stripComments(s.src)))
    .map((s) => ({ file: s.file, manquants: EXPORTS_PLATS.filter((nom) => !exportPlat(nom).test(s.src)) }))
    .filter((r) => r.manquants.length > 0)
    .map((r) => `${r.file} : manque ${r.manquants.join(', ')}`);
}

/** Les modules DIRECTS des racines de defs : la population est celle du générateur, qui liste chaque
 *  racine À PLAT (`scripts/gen-registry.mjs:371,543,582` — aucune récursion) ; un module posé dans un
 *  sous-dossier n'entre pas au registre, il n'a donc pas la convention à tenir. Le corpus est
 *  récursif : la profondeur se borne ICI, comme la garde le mesure. */
function sourcesDesDefs(): { file: string; src: string }[] {
  return readCorpus(RACINES_DE_DEFS)
    .filter(({ rel }) => RACINES_DE_DEFS.some((dir) => rel.startsWith(`${dir}/`) && !rel.slice(dir.length + 1).includes('/')))
    .filter(({ rel }) => !rel.slice(rel.lastIndexOf('/') + 1).startsWith('_'))
    .map(({ rel, text }) => ({ file: rel, src: text }));
}

describe('convention d’export lue par le générateur de registre', () => {
  it('tout def qui appelle `document(` exporte `file`, `schema`, `famille` et `meta` À PLAT', () => {
    const muets = defsSansExportsPlats(sourcesDesDefs());
    expect(
      muets,
      `la convention du gen exige l'export PLAT — un export destructuré/ré-exporté/absent est muet au registre :\n${muets.join('\n')}`,
    ).toEqual([]);
  });

  it('la garde MORD sur chaque forme muette, et NOMME l’export manquant (fixtures de source)', () => {
    const PLAT = "export const file = 'z.json';\nexport const schema = doc.schema;\nexport const famille = doc.famille;\nexport const meta = doc.meta;\n";
    const muets = defsSansExportsPlats([
      { file: 'destructure.ts', src: "const doc = document('x', 'entite', {}, {}, {});\nexport const { file, schema, famille, meta } = doc;\n" },
      { file: 'reexport.ts', src: "const doc = document('y', 'entite', {}, {}, {});\nconst meta = doc.meta;\nexport { meta };\nexport const file = 'y.json';\nexport const schema = doc.schema;\nexport const famille = doc.famille;\n" },
      { file: 'sans-schema.ts', src: `const doc = document('a', 'entite', {}, {}, {});\n${PLAT.replace('export const schema = doc.schema;\n', '')}` },
      { file: 'sans-famille.ts', src: `const doc = document('b', 'entite', {}, {}, {});\n${PLAT.replace('export const famille = doc.famille;\n', '')}` },
      { file: 'file-double-quote.ts', src: `const doc = document('d', 'entite', {}, {}, {});\n${PLAT.replace("export const file = 'z.json';", 'export const file = "z.json";')}` },
      { file: 'file-type-annote.ts', src: `const doc = document('e', 'entite', {}, {}, {});\n${PLAT.replace('export const file =', 'export const file: string =')}` },
      { file: 'file-indirect.ts', src: `const doc = document('f', 'entite', {}, {}, {});\n${PLAT.replace("export const file = 'z.json';", 'export const file = doc.file;')}` },
      { file: 'plat.ts', src: `const doc = document('z', 'entite', {}, {}, {});\n${PLAT}` },
      { file: 'sans-fabrique.ts', src: 'export const schema = z.array(z.object({}));\n' },
      // MODULE DE FORME (forme réelle de `defs-scenes/projet.ts`) : il déclare LE document et n'en
      // nomme aucun fichier — hors registre par le critère du gen, donc hors population de la garde.
      { file: 'forme-partagee.ts', src: "export const doc = document('h', 'config', {}, {}, {});\nexport const monSchema = doc.schema;\n" },
    ]);
    expect(muets).toEqual([
      'destructure.ts : manque file, schema, famille, meta',
      'reexport.ts : manque meta',
      'sans-schema.ts : manque schema',
      'sans-famille.ts : manque famille',
      'file-double-quote.ts : manque file',
      'file-type-annote.ts : manque file',
      'file-indirect.ts : manque file',
    ]);
  });

  it('le bras `file` rend le verdict DU GEN, forme par forme (un `file` qui compile peut être hors registre)', () => {
    // Verdicts du générateur MESURÉS sur son filtre `scripts/gen-registry.mjs:388` : seule la forme
    // `= '…'` (guillemet SIMPLE littéral) entre au registre — les quatre autres compilent et en sortent.
    const formes: { nom: string; ligne: string; auRegistre: boolean }[] = [
      { nom: 'simple-quote', ligne: "export const file = 'z.json';", auRegistre: true },
      { nom: 'double-quote', ligne: 'export const file = "z.json";', auRegistre: false },
      { nom: 'type-annote', ligne: "export const file: string = 'z.json';", auRegistre: false },
      { nom: 'gabarit', ligne: 'export const file = `z.json`;', auRegistre: false },
      { nom: 'indirect', ligne: 'export const file = doc.file;', auRegistre: false },
    ];
    const verdicts = formes.map((f) => {
      const src = `const doc = document('g', 'entite', {}, {}, {});\n${f.ligne}\nexport const schema = doc.schema;\nexport const famille = doc.famille;\nexport const meta = doc.meta;\n`;
      const garde = defsSansExportsPlats([{ file: `${f.nom}.ts`, src }]);
      return { nom: f.nom, gardeAccepte: garde.length === 0, genAccepte: f.auRegistre };
    });
    expect(
      verdicts.filter((v) => v.gardeAccepte !== v.genAccepte),
      'la garde diverge du filtre du gen : une forme qu’elle accepte serait ÉCARTÉE du registre en silence',
    ).toEqual([]);
    expect(verdicts.map((v) => v.gardeAccepte)).toEqual([true, false, false, false, false]);
  });

  it('la marche des defs voit une population réelle (le contrat n’est pas vide par erreur de chemin)', () => {
    expect(sourcesDesDefs().length).toBeGreaterThan(100);
  });

  it('ANCRAGE au dépôt : le module de FORME est hors population, les 4 defs qui le nomment y sont', () => {
    const parFichier = new Map(sourcesDesDefs().map((s) => [s.file, s.src]));
    const forme = parFichier.get('src/data/schemas/defs-scenes/projet.ts')!;
    expect(APPELLE_DOCUMENT.test(stripComments(forme)), 'projet.ts déclare bien LE document de projet').toBe(true);
    expect(NOMME_UN_FICHIER.test(stripComments(forme)), 'projet.ts ne nomme AUCUN fichier de données').toBe(false);
    expect(defsSansExportsPlats([{ file: 'projet.ts', src: forme }])).toEqual([]);

    // Les 4 defs de campagne, eux, NOMMENT leur fichier et n'appellent pas la fabrique : ils
    // ré-exportent le handle du module de forme. C'est EUX que le générateur collecte — leurs quatre
    // exports sont vérifiés par la COMPILATION du registre généré, qui les importe par leur nom.
    for (const nom of ['arene', 'barge-du-sel', 'diligence', 'loup-et-saumure']) {
      const src = parFichier.get(`src/data/schemas/defs-scenes/${nom}.ts`)!;
      expect(NOMME_UN_FICHIER.test(stripComments(src)), `${nom}.ts nomme son fichier de campagne`).toBe(true);
      expect(FILE_DU_GEN.test(src), `${nom}.ts : \`file\` à la forme que le gen collecte`).toBe(true);
    }
  });
});

/**
 * #1694 — le libellé d'une VALEUR vit sur le NŒUD (`enumNomme`), donc il vaut à TOUTE profondeur :
 * un enum niché sous un tableau d'objets se rend en `select` NOMMÉ dès que le sous-formulaire reçoit
 * le nœud de SON champ. La COPIE de def verrouille le MÉCANISME (un `select` nommé, un `select`
 * anonyme sans nœud) ; les deux cas RÉELS qui suivent le verrouillent sur la POPULATION livrée
 * (Phénomènes arcaniques niché, Ivresse en rangée — #1694 train B1).
 */
const docNiche = () => document(
  'demo-niche', 'entite',
  { rangees: z.array(z.object({ nature: enumNomme({ physique: 'Physique', mentale: 'Mentale' }) })) },
  { rangees: { label: 'Rangées' } },
  { codex: { keys: ['demo-niche'] }, edit: { none: 'fixture de test' } },
);

describe('libellés de VALEURS à toute profondeur', () => {
  const noeudDesRangees = (): unknown => (defDe(noeudObjet(docNiche().schema))?.shape ?? {})['rangees'];

  it('inferFields en PROFONDEUR rend les valeurs de l’enum niché', () => {
    const cols = inferFields([{ nature: 'physique' }], { niveau: 'profondeur', noeud: noeudObjet(noeudDesRangees()) });
    const nature = cols.find((f) => f.key === 'nature')!;
    expect(nature.kind).toBe('select');
    expect(nature.valeurs).toEqual({ physique: 'Physique', mentale: 'Mentale' });
    expect(nature.label).toBe('nature');
  });

  it('sans le nœud, le sous-formulaire ne peut rien nommer — le NŒUD est le porteur', () => {
    const cols = inferFields([{ nature: 'physique' }], { niveau: 'profondeur' });
    expect(cols.find((f) => f.key === 'nature')!.valeurs).toBeUndefined();
  });

  /**
   * PÉRIMÈTRE RÉEL : les `GenericArrayField` DÉDIÉS de `CodexEdit.tsx` (ceux montés sur un champ nommé
   * `entry.X`) — eux seuls peuvent recevoir `noeud={noeudDe('X')}`. Les éditeurs dédiés qui rendent
   * LEUR PROPRE `select` (`ProsthesisField`, `TraitListField`) ne passent pas par ici : ils lisent
   * directement `valeursDe` du nœud qu'ils importent, ou restent au stock des Records
   * (`grammaire/records-de-libelles.test.ts`).
   */
  it('cas RÉEL niché — `arcane-phenomena.json` `phenomena[].kind` rend un select nommé', () => {
    const phenomena = (defDe(noeudObjet(schemaForFile('arcane-phenomena.json')))?.shape ?? {})['phenomena'];
    const cols = inferFields([{ kind: 'nexus' }], { niveau: 'profondeur', noeud: noeudObjet(phenomena) });
    const kind = cols.find((f) => f.key === 'kind')!;
    expect(kind.kind).toBe('select');
    expect(kind.valeurs?.nexus).toBe('Jonction tellurique');
    expect(Object.keys(kind.valeurs ?? {})).toHaveLength(8);
  });

  it('cas RÉEL en RANGÉE — `drunkenness.json` `outcome` rend un select nommé', () => {
    // Un document à `rangee` porte sa charge en `entries` (`grammaire/document.ts`) : le nœud du
    // sous-formulaire est celui de la RANGÉE, pas celui de l'enveloppe.
    const entries = (defDe(noeudObjet(schemaForFile('drunkenness.json')))?.shape ?? {})['entries'];
    const cols = inferFields([{ outcome: 'blackout' }], { niveau: 'profondeur', noeud: noeudObjet(entries) });
    const outcome = cols.find((f) => f.key === 'outcome')!;
    expect(outcome.kind).toBe('select');
    expect(outcome.valeurs?.blackout).toBe('Trou noir (gueule de bois)');
    expect(Object.keys(outcome.valeurs ?? {})).toHaveLength(5);
  });

  it('chaque `GenericArrayField` dédié de tableau d’objets reçoit le nœud de SON champ', () => {
    const src = readFileSync(join(process.cwd(), 'src/ui/compendium/CodexEdit.tsx'), 'utf8');
    const balises = src.match(/<GenericArrayField\b[\s\S]*?\/>/g) ?? [];
    expect(balises.length, 'le matcher voit les balises du fichier').toBeGreaterThan(20);
    const sansNoeud: string[] = [];
    for (const balise of balises) {
      const champ = /value=\{entry\.([A-Za-z_$][\w$]*)\b/.exec(balise)?.[1];
      if (!champ) continue;
      if (!balise.includes(`noeud={noeudDe('${champ}')}`)) sansNoeud.push(champ);
    }
    expect(sansNoeud, 'ces champs dédiés rendraient un select ANONYME en profondeur').toEqual([]);
  });
});
