import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import {
  deriveExposition,
  CATEGORY_DATASET_DERIVE,
  OBJECT_CATEGORY_DERIVE,
  FICHIERS_DECLARES,
  EXEMPTS,
} from './exposition-derivee';
import { DATASET_KEYS, OBJECT_DATASET_KEYS } from '../overrides';
import type { SchemaDef } from './types';
import type { Exposition } from './grammaire/document';

/**
 * Contrats d'EXPOSITION du Codex (#1472). Le mapping fichier → catégorie(s) et les exemptions sont
 * DÉRIVÉS des déclarations `exposition` des defs (`exposition-derivee.ts`) ; ce qu'aucune dérivation
 * ne donne gratuitement se prouve ici :
 *  (a) ancre FILESYSTEM — un `.json` déposé sous `src/data` SANS def rougit (demande utilisateur
 *      2026-07-14, verbatim : « On a une guard sur les jsons qui ne sont pas dans le codex ? ») ;
 *  (b) et (c), qui lisent le registre Codex VIVANT : `src/noyau/codex/codex-exposition-contrats.test.ts` ;
 *  (d) cliquet des exemptions de DETTE — liste nominative, ticketée, DÉCROISSANTE ;
 *  (e) routes ⊆ bindings (`ARRAYS`/`OBJECTS` d'`overrides.ts`) — ce qui tient le cast de `CodexEdit`.
 */

const DATA_DIR = resolve(__dirname, '..');
const jsonSurDisque = () => listerDossier(DATA_DIR).filter((f) => f.endsWith('.json'));

/**
 * Cliquet des exemptions de DETTE : fichier → ticket daté. Un `exempt.kind === 'dette'` est une
 * exposition Codex NON FAITE, pas une dispense de principe — il ne vit que nommé ici, avec son
 * ticket, et cette liste ne fait que DÉCROÎTRE. Un exempt à texte libre serait une amnistie sans
 * cliquet ; une entrée sans exempt réel en face est une entrée à retirer.
 */
const DETTES_EXEMPT: Record<string, string> = {
  'merchants.json': '#747 (2026-08-29)',
  'reseau-routier.json': '#684 (2026-08-31)',
};

describe('exposition Codex — contrats de la dérivation (#1472)', () => {
  it('(a) ancre filesystem : chaque src/data/*.json est déclaré par un def, et chaque def pointe un fichier présent', () => {
    const surDisque = jsonSurDisque();
    const sansDef = surDisque.filter((f) => !FICHIERS_DECLARES.has(f));
    expect(
      sansDef,
      `Fichier(s) de \`src/data\` sans def de schéma — déclarer le document (\`document(type, famille, …)\`) :\n${sansDef.join('\n')}`,
    ).toEqual([]);

    const presents = new Set(surDisque);
    const fantomes = [...FICHIERS_DECLARES].filter((f) => !presents.has(f));
    expect(
      fantomes,
      `Def(s) pointant un fichier absent du disque — nettoyer la déclaration :\n${fantomes.join('\n')}`,
    ).toEqual([]);
  });

  it('(d) cliquet dette : chaque exempt.kind === "dette" est nommé ici avec son ticket, et la liste ne porte rien de mort', () => {
    const dettes = Object.entries(EXEMPTS).filter(([, e]) => e.kind === 'dette').map(([f]) => f);

    const nonInscrites = dettes.filter((f) => !DETTES_EXEMPT[f]?.trim());
    expect(
      nonInscrites,
      `Exemption(s) de DETTE hors cliquet — inscrire \`fichier: '#ticket (AAAA-MM-JJ)'\` dans DETTES_EXEMPT :\n${nonInscrites.join('\n')}`,
    ).toEqual([]);

    const sansTicketAuDef = dettes.filter((f) => !EXEMPTS[f].ticket?.trim());
    expect(
      sansTicketAuDef,
      `Exemption(s) de DETTE sans \`ticket\` au def — une dette sans ticket est une amnistie :\n${sansTicketAuDef.join('\n')}`,
    ).toEqual([]);

    const aRetirer = Object.keys(DETTES_EXEMPT).filter((f) => !dettes.includes(f));
    expect(
      aRetirer,
      `Entrée(s) de DETTES_EXEMPT sans exemption de dette en face — à RETIRER (le cliquet ne fait que décroître) :\n${aRetirer.join('\n')}`,
    ).toEqual([]);

    // Le cliquet et le def nomment le MÊME ticket : une dette re-étiquetée sur un autre numéro
    // quitterait le cliquet par la porte de service.
    const desaccord = dettes
      .filter((f) => !DETTES_EXEMPT[f].includes(EXEMPTS[f].ticket!.trim()))
      .map((f) => `${f} : def '${EXEMPTS[f].ticket}' ≠ cliquet '${DETTES_EXEMPT[f]}'`);
    expect(
      desaccord,
      `Dette(s) dont le ticket du def contredit le cliquet :\n${desaccord.join('\n')}`,
    ).toEqual([]);
  });

  it('(e) routes ⊆ bindings : chaque dataset routé existe dans ARRAYS / OBJECTS (overrides.ts)', () => {
    const listes = new Set<string>(DATASET_KEYS);
    const objets = new Set<string>(OBJECT_DATASET_KEYS);

    const listesInconnues = Object.entries(CATEGORY_DATASET_DERIVE)
      .filter(([, ds]) => !listes.has(ds))
      .map(([cle, ds]) => `${cle} → '${ds}' (absent d'ARRAYS)`);
    expect(listesInconnues, `Route(s) de dataset-LISTE sans binding :\n${listesInconnues.join('\n')}`).toEqual([]);

    const objetsInconnus = Object.entries(OBJECT_CATEGORY_DERIVE)
      .filter(([, r]) => !objets.has(r.ds))
      .map(([cle, r]) => `${cle} → '${r.ds}' (absent d'OBJECTS)`);
    expect(objetsInconnus, `Route(s) de dataset-OBJET sans binding :\n${objetsInconnus.join('\n')}`).toEqual([]);
  });
});

/**
 * Refus de la dérivation, prouvés à FAUTE INJECTÉE sur des defs SYNTHÉTIQUES : la vraie donnée ne se
 * mutile pas pour vérifier qu'un garde mord. `deriveExposition` étant PURE, chaque refus se joue sur
 * un jeu de defs fabriqué ici — fail-fast, et NOMMANT le document fautif.
 */
describe('deriveExposition — refus fail-fast sur defs synthétiques (#1472)', () => {
  const faux = (file: string, exposition?: Exposition): SchemaDef =>
    ({ file, root: 'src/data', schema: undefined, famille: 'entite', exposition }) as unknown as SchemaDef;

  it('dérive normalement un jeu de defs conforme (témoin VERT du même harnais)', () => {
    const t = deriveExposition([
      faux('a.json', { codex: { keys: ['races'] }, edit: { dataset: 'species' } }),
      faux('b.json', { codex: { keys: ['reglages'] }, edit: { object: 'unique' } }),
      faux('c.json', { codex: { exempt: { kind: 'dette', raison: 'exposition due, lot séparé', ticket: '#1' } }, edit: { none: 'rien' } }),
    ]);
    expect(t.categoryDataset).toEqual({ races: 'species' });
    expect(t.objectCategory).toEqual({ reglages: { ds: 'reglages', mode: 'unique' } });
    expect([...t.fichiersDeclares]).toEqual(['a.json', 'b.json', 'c.json']);
    expect(Object.keys(t.exempts)).toEqual(['c.json']);
  });

  it('(i) dataset à PLUSIEURS clés dont aucune n’égale le dataset : REFUS nominatif', () => {
    expect(() =>
      deriveExposition([faux('trap.json', { codex: { keys: ['armes', 'armures'] }, edit: { dataset: 'trappings' } })]),
    ).toThrow(/`trap\.json` édite le dataset 'trappings'.*\[armes, armures\] ne le départage/s);
  });

  it('(ii) dataset-OBJET à 0 ou 2 clés Codex : REFUS nominatif', () => {
    expect(() =>
      deriveExposition([faux('conf.json', { codex: { keys: [] }, edit: { object: 'unique' } })]),
    ).toThrow(/`conf\.json` s'édite comme dataset-OBJET mais déclare 0 clés Codex/);
    expect(() =>
      deriveExposition([faux('conf.json', { codex: { keys: ['x', 'y'] }, edit: { object: 'parCle' } })]),
    ).toThrow(/`conf\.json` s'édite comme dataset-OBJET mais déclare 2 clés Codex/);
  });

  it('(iii) COLLISION de route : deux documents revendiquant la même clé sont NOMMÉS, jamais écrasés en silence', () => {
    expect(() =>
      deriveExposition([
        faux('un.json', { codex: { keys: ['sorts'] }, edit: { dataset: 'sorts' } }),
        faux('deux.json', { codex: { keys: ['sorts'] }, edit: { dataset: 'sorts' } }),
      ]),
    ).toThrow(/catégorie Codex « sorts » est revendiquée par DEUX documents \(`un\.json` et `deux\.json`\)/);
    // La collision vaut aussi entre familles de route (liste ⇔ objet, liste ⇔ nichée).
    expect(() =>
      deriveExposition([
        faux('un.json', { codex: { keys: ['sorts'] }, edit: { dataset: 'sorts' } }),
        faux('deux.json', { codex: { keys: ['sorts'] }, edit: { object: 'unique' } }),
      ]),
    ).toThrow(/« sorts » est revendiquée par DEUX documents/);
    expect(() =>
      deriveExposition([
        faux('un.json', { codex: { keys: ['sorts'] }, edit: { dataset: 'sorts' } }),
        faux('trois.json', { codex: { keys: ['sorts'] }, edit: { niche: { categories: { sorts: 'sorts' } } } }),
      ]),
    ).toThrow(/« sorts » est revendiquée par DEUX documents \(`un\.json` et `trois\.json`\)/);
  });

  it('(iii bis) COLLISION de FICHIER : deux documents éditant le MÊME dataset sous des clés Codex DIFFÉRENTES sont NOMMÉS', () => {
    // Les clés de catégorie diffèrent : `revendique` laisse passer, seule la route de FICHIER mord —
    // sans elle, `datasetFichier` retiendrait le DERNIER def et le save écrirait le mauvais document.
    expect(() =>
      deriveExposition([
        faux('un.json', { codex: { keys: ['sortsA'] }, edit: { dataset: 'sorts' } }),
        faux('deux.json', { codex: { keys: ['sortsB'] }, edit: { dataset: 'sorts' } }),
      ]),
    ).toThrow(/le dataset 'sorts' est édité par DEUX documents \(`un\.json` et `deux\.json`\)/);
    // Vaut aussi entre une route de dataset et une route NICHÉE portant le même nom de dataset.
    expect(() =>
      deriveExposition([
        faux('un.json', { codex: { keys: ['sortsA'] }, edit: { dataset: 'sorts' } }),
        faux('trois.json', { codex: { keys: ['sorts'] }, edit: { niche: { categories: { sorts: 'sorts' } } } }),
      ]),
    ).toThrow(/le dataset 'sorts' est édité par DEUX documents \(`un\.json` et `trois\.json`\)/);
  });

  it('(iv) def SANS `exposition` : REFUS nominatif (aucun document ne se déclare muet)', () => {
    expect(() => deriveExposition([faux('muet.json')])).toThrow(
      /`muet\.json` ne déclare aucune `exposition`/,
    );
  });
});
