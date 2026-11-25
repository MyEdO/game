import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { fileURLToPath } from 'node:url';
import { skills, talents, careerLevels, species, stars, specPoolOf, specEntryId } from './index';
import tablesJson from './tables.json';
import activitiesJson from './activities.json';
import talentsJson from './talents.json';
import tavernGamesJson from './tavernGames.json';
import crewRolesJson from './crew-roles.json';
import { schema as activitiesSchema } from './schemas/defs/activities';
import { schema as talentsSchema } from './schemas/defs/talents';
import { estSpecialisable, refOuSpec, specAuCatalogue } from './schemas/grammaire/ref';
import { nommerNoeud } from './schemas/grammaire/meta';

/**
 * CONTRAT DE DONNÉE #1342 L3 — deux axes ORTHOGONAUX sur une entrée `specs[]` : `source` dit d'où
 * l'entrée vient, `pool: false` dit qu'elle n'est pas PROPOSÉE d'office (`LDB 09 l.40`).
 *
 * BORNE DE CE FICHIER : les datasets SCANNÉS ci-dessous (`PORTES_JOUEUR`) — pas « le LDB 09 ». La
 * mesure du 2026-08-23 interdit le contrat « toute entrée du pool est énumérée par le LDB 09 » :
 * ~150 entrées héritées (Langue, Métier, Savoir…) ne figurent dans AUCUNE liste « Spécialisations : »
 * du chapitre et ne portent pas de `source`. Ce qui EST gardé ici rend le pool correct :
 *  1. une entrée hors pool est attestée ailleurs → elle porte une `source` ;
 *  2. toute spec demandée par une PORTE JOUEUR résout, et résout DANS le pool — sinon l'écran qui
 *     l'affiche ne peut pas l'offrir. Sur une entrée OUVERTE, le parse admet le texte libre : ce
 *     contrat l'y refuse. Le libellé et la sentinelle « au choix », eux, sont refusés AU PARSE
 *     (`ref.ts#refusDeSpec`) ;
 *  3. un EMPLACEMENT (`choix: true`, joker « au choix ») ne vise jamais une entrée à pool vide
 *     (`LDB 09 l.40`) — garde `#1897` en fin de fichier (`choixSansPoolJoueur`). Pour un TALENT, des
 *     `specs` inline ne font pas un domaine groupé (`LDB 10 l.17` ; `attirant`, `EDOC 12 l.83`) ; une
 *     COMPÉTENCE à `specs` est Groupée (`LDB 09 l.40`) et son pool vide est refusé par « aucune
 *     Compétence spécialisable n’a un pool VIDE » (describe `L2 #1548`, catalogue RÉSOLU, inline compris) ;
 *  4. CATALOGUE ⊇ POOL, par construction, sur chaque def.
 */
const DEFS = [...skills, ...talents];

/** Datasets qui PROPOSENT une spec à un joueur : liste de Carrière, liste d'espèce, signe astral,
 *  op passive `grantCareerSkill` d'un Talent (`engine/talentEffects.ts#careerSkillAdditions`), table
 *  d'effets, Activité hors combat, jeu de taverne, rôle d'équipage. */
const PORTES_JOUEUR: [string, unknown][] = [
  ['careerLevels', careerLevels], ['species', species], ['stars', stars],
  ['talents(passive/grantCareerSkill)', talents], ['tables', tablesJson],
  ['activities', activitiesJson], ['tavernGames', tavernGamesJson], ['crewRoles', crewRolesJson],
];

const DEF_BY_ID = new Map<string, (typeof DEFS)[number]>(DEFS.map((d) => [d.id, d]));
/** Ids de COMPÉTENCE — le concept dont la sentinelle est ÉTEINTE (L2 #1548). */
const EST_COMPETENCE = new Set<string>(skills.map((s) => s.id));
/** La spéc `spec` est-elle au catalogue de la def `def` (`specAuCatalogue`) ? Son type se lit à
 *  l'IDENTITÉ de la def : un id peut nommer une Compétence ET un Talent. */
const auCatalogue = (def: (typeof DEFS)[number], spec: string): boolean =>
  specAuCatalogue((skills as readonly object[]).includes(def) ? 'skill' : 'talent', def.id, spec);

/** Toutes les refs `(defId, spec)` d'une porte joueur. La clé de def se lit d'ABORD sur les champs
 *  QUALIFIÉS (`skillId`/`talentId`/`skill`), PUIS sur l'`id` du nœud lui-même : depuis la référence
 *  emboîtée du lot 3b (L2 #1548), une réf de Compétence s'écrit `skill: { id, spec }` — la spéc est
 *  posée À CÔTÉ de l'id du nœud, donc ce repli est le chemin NORMAL de cette composition plate. */
function refsDePorte(): { where: string; defId: string; spec: string }[] {
  const out: { where: string; defId: string; spec: string }[] = [];
  const walk = (node: unknown, where: string): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, where)); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    const defId = (n.skillId ?? n.talentId ?? n.skill ?? n.id) as string | undefined;
    if (typeof defId === 'string' && typeof n.spec === 'string') out.push({ where, defId, spec: n.spec });
    for (const v of Object.values(n)) walk(v, where);
  };
  for (const [where, data] of PORTES_JOUEUR) walk(data, where);
  return out;
}

describe('#1342 L3 — contrat `pool` des spécialisations', () => {
  it('toute entrée `pool: false` porte une `source`', () => {
    const nues: string[] = [];
    for (const def of DEFS) {
      for (const e of def.specs ?? []) if (e.pool === false && !e.source) nues.push(`${def.id}/${e.id}`);
    }
    expect(nues, `entrée(s) hors pool sans attestation :\n${nues.join('\n')}`).toEqual([]);
  });

  it('toute spec demandée par une PORTE JOUEUR résout et est DANS le pool', () => {
    const fautes: string[] = [];
    for (const { where, defId, spec } of refsDePorte()) {
      const def = DEF_BY_ID.get(defId);
      if (!def) continue; // le defId n'est pas une Compétence/Talent (son existence se juge au parse)
      const cle = `${where}|${defId}|${spec}`;
      if (!auCatalogue(def, spec)) {
        fautes.push(`${cle} : absente du catalogue`);
      } else if (!specPoolOf(def).includes(spec)) {
        fautes.push(`${cle} : hors pool (l'écran ne peut pas l'offrir)`);
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('CATALOGUE ⊇ POOL', () => {
    const fuites: string[] = [];
    for (const def of DEFS) {
      for (const id of specPoolOf(def)) if (!auCatalogue(def, id)) fuites.push(`${def.id}/${id}`);
      const inline = (def.specs ?? []).map(specEntryId);
      if (inline.length) expect(specPoolOf(def).length, def.id).toBeLessThanOrEqual(inline.length);
    }
    expect(fuites, `spec(s) proposées mais hors catalogue :\n${fuites.join('\n')}`).toEqual([]);
  });
});

describe('#1600 — spécialisations de Compétence au parse des Talents et des Activités', () => {
  it('Concocter désigne Savoir (Apothicaire) dans le LDB et Métier (Apothicaire ou Alchimiste) dans VDM', () => {
    const [concocter] = talentsSchema.parse([talentsJson.find((t) => t.id === 'concocter')]);
    expect(concocter.test?.matches.map((m) => m.skill)).toEqual([{ id: 'savoir', spec: 'apothicaire' }]);
    const vdm = concocter.variants?.find((v) => v.source?.book === 'vents-de-la-magie');
    expect(vdm?.test?.matches.map((m) => m.skill)).toEqual([
      { id: 'metier', spec: 'apothicaire' },
      { id: 'metier', spec: 'alchimiste' },
    ]);

    const talent = structuredClone(concocter);
    talent.test!.matches[0].skill!.spec = 'Apothicaire';
    expect(talentsSchema.safeParse([talent]).error?.issues).toEqual([
      expect.objectContaining({
        path: [0, 'test', 'matches', 0, 'skill', 'spec'],
        message: expect.stringMatching(/LIBELLÉ d'une spécialisation de « savoir »/),
      }),
    ]);
  });

  it('Établir des cartes désigne Art (Dessin) par son id de catalogue', () => {
    const [cartes] = activitiesSchema.parse([activitiesJson.find((a) => a.id === 'etablir-cartes')]);
    const index = cartes.tests!.findIndex((t) => t.skill?.id === 'art');
    expect(cartes.tests![index]?.skill).toEqual({ id: 'art', spec: 'dessin' });

    const activite = structuredClone(cartes);
    activite.tests![index].skill!.spec = 'Dessin';
    expect(activitiesSchema.safeParse([activite]).error?.issues).toEqual([
      expect.objectContaining({
        path: [0, 'tests', index, 'skill', 'spec'],
        message: expect.stringMatching(/absente des spécialisations de « art » au catalogue/),
      }),
    ]);
  });
});

/** Les DEUX racines de donnée authorée : `src/data` et les projets de scène, qui composent la MÊME
 *  grammaire (`defs-scenes/communs.ts#competenceChiffreeSchema` = `refOuSpec('skill', { value })`). */
const DOSSIER_DATA = __dirname;
const DOSSIER_SCENES = fileURLToPath(new URL('../scenes/', import.meta.url));
const RACINES: [string, string][] = [['data/', DOSSIER_DATA], ['scenes/', DOSSIER_SCENES]];

const fichiersDeDonnees = (dir: string): string[] =>
  listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => join(dir, rel));

/**
 * VERROU PAR CONSTRUCTION de la sentinelle — le schéma REFUSE, il ne se contente pas d'être scanné.
 * Un contrat qui n'inspecte que les fichiers d'un dossier laisse revenir la sentinelle par TOUTE
 * donnée neuve ; `savoir` est une entrée OUVERTE (`ref.ts#entreeOuverte`), donc le garde-fou
 * « catalogue fermé » ne l'atteint pas : le refus lui est propre.
 */
describe('L2 #1548 — `refOuSpec` refuse la sentinelle AU PARSE (`ref.ts#SENTINELLE_DE_SPEC`)', () => {
  /** LE nœud du statbloc de créature : `refOuSpec('skill', { value }, 'specOuChoixFacultatifs')`
   *  (`defs/creatures.ts`, porteur d'EMPLACEMENT) — la sonde porte donc sa `value`. */
  const skillRef = refOuSpec('skill', { value: nommerNoeud(z.number().optional(), { nom: 'valeur' }) }, 'specOuChoixFacultatifs');

  it('refuse le littéral « au choix » posé en `spec` d’une Compétence spécialisable', () => {
    const r = skillRef.safeParse({ id: 'savoir', spec: 'au choix', value: 65 });
    expect(r.success).toBe(false);
  });

  it('refuse la sentinelle quelle que soit sa CASSE et son séparateur', () => {
    for (const graphie of ['Au choix', 'AU CHOIX', 'au-choix', 'Au  choix']) {
      expect(skillRef.safeParse({ id: 'savoir', spec: graphie, value: 65 }).success, graphie).toBe(false);
    }
  });

  it('refuse la sentinelle glissée dans un `choix` BORNÉ', () => {
    expect(skillRef.safeParse({ id: 'savoir', choix: ['loi', 'au choix'] }).success).toBe(false);
  });

  it('accepte les deux formes LÉGITIMES : une spéc du catalogue, et l’emplacement non désigné `choix`', () => {
    expect(skillRef.safeParse({ id: 'savoir', spec: 'loi', value: 65 }).success).toBe(true);
    expect(skillRef.safeParse({ id: 'savoir', choix: true, value: 65 }).success).toBe(true);
  });

  it('refuse `spec` ET `choix` ensemble (XOR des deux régimes)', () => {
    expect(skillRef.safeParse({ id: 'savoir', spec: 'loi', choix: true }).success).toBe(false);
  });

  it('refuse un `choix` sur une Compétence qui ne déclare AUCUNE spécialisation', () => {
    expect(skillRef.safeParse({ id: 'esquive', choix: true }).success).toBe(false);
  });
});

/**
 * INVARIANT `estSpecialisable ⟹ specPoolOf ≠ []` — une Compétence dont le catalogue est NON VIDE doit
 * proposer au moins une spéc `pool` : sinon le tirage d'une spéc n'a aucun candidat et le `throw` de
 * `designateSpec` (`src/noyau/monde/spawn.ts`) devient atteignable en partie.
 *
 * PÉRIMÈTRE : `estSpecialisable` lit le catalogue RÉSOLU (espace `<fichier>#[<id>].specs` de l'INDEX
 * DES IDS), `specs[]` inline et `specsSource` compris — mesuré 2026-08-31 : `corps-a-corps`,
 * `focalisation` et `projectiles` ont 0 spéc inline pour 8/9/10 au registre.
 */
describe('L2 #1548 — toute Compétence spécialisable propose au moins une spéc au tirage', () => {
  it('les défs à `specsSource` sont bien DANS le périmètre (le volet inline les saute)', () => {
    const parSource = skills.filter((s) => s.specsSource && (s.specs ?? []).length === 0);
    expect(parSource.length).toBeGreaterThan(0);
    expect(parSource.every((s) => estSpecialisable('skill', s.id))).toBe(true);
  });

  it('aucune Compétence spécialisable n’a un pool VIDE', () => {
    const vides = skills.filter((s) => estSpecialisable('skill', s.id) && specPoolOf(s).length === 0).map((s) => s.id);
    expect(
      vides,
      `Compétence(s) au catalogue NON VIDE mais sans aucune spéc \`pool\` — \`designateSpec\` (src/noyau/monde/spawn.ts) n'a aucun candidat à tirer et LÈVE :\n${vides.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * SENS MANQUANT du critère #1342 L3 (#1457 B2) — le premier `it` de ce fichier ne garde qu'un sens
 * (`pool: false ⇒ source`) : rien n'exigeait qu'une entrée statbloc-only SOIT mise hors pool. Elle
 * restait donc PROPOSÉE d'office par le créateur/l'avancement (`LDB 09 l.40`, `specPoolOf`), et le
 * geste de la migration `2026-08-23-specs-statbloc-hors-pool.mjs` n'était rejouable que par sa TABLE
 * — mesure du 2026-09-01 : `skills.json` porte 32 entrées hors pool, `talents.json` en portait 0.
 *
 * CONTRAT POSITIF, sur les DEUX catalogues (Compétences ET Talents) : une entrée de `specs[]` qui
 *  1. porte une `source` — donc n'appartient PAS au pool imprimé de base (cf. premier `it` : hors
 *     pool ⇒ attestée ailleurs ; contraposée : une entrée NUE ne peut pas être mise hors pool), et
 *  2. n'est employée, sur les DEUX racines authorées, que par `src/data/creatures.json`,
 * porte `pool: false`. Même mesure que la migration statbloc-hors-pool (critères « employée par un
 * statbloc » / « citée par aucune ligne joueur »), élargie des 3 listes joueur de la migration à
 * TOUS les datasets — donc plus prudente : un consommateur hors `creatures.json`, quel qu'il soit,
 * suffit à laisser l'entrée au pool.
 *
 * ANGLES MORTS ÉNONCÉS :
 *  - le critère RAW de la migration (« libellé ÉNUMÉRÉ par la liste imprimée du LDB ») n'est PAS
 *    remesuré ici : ce fichier ne lit aucun `Source/` (cf. borne en tête). Le filtre `source` le
 *    couvre en pratique — aucune des entrées attestées ne cite le pool imprimé de base — mais une
 *    entrée sourcée qu'une liste imprimée énumérerait serait réclamée hors pool à tort ;
 *  - « statbloc » est lu comme « le fichier `creatures.json` » : un statbloc inline d'un projet de
 *    `src/scenes` compte comme un consommateur ORDINAIRE, donc laisse l'entrée au pool ;
 *  - la clé de def se lit sur `skillId`/`talentId`/`skill`/`id` du nœud porteur, comme partout dans
 *    ce fichier : une réf portée par un champ d'un autre nom échappe à la mesure.
 */
describe('#1457 B2 — une spec ATTESTÉE dont le seul consommateur est un statbloc est HORS POOL', () => {
  const FICHIER_STATBLOCS = 'data/creatures.json';

  /** `defId|specId` → fichiers qui l'emploient (`data/x.json`, `scenes/y.json`). */
  const consommateurs = new Map<string, Set<string>>();
  for (const [racine, dir] of RACINES) {
    for (const abs of fichiersDeDonnees(dir)) {
      const ou = `${racine}${relative(dir, abs).replace(/\\/g, '/')}`;
      let data: unknown;
      try { data = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        const n = node as Record<string, unknown>;
        const defId = (n.skillId ?? n.talentId ?? n.skill ?? n.id) as string | undefined;
        if (typeof defId === 'string' && typeof n.spec === 'string' && DEF_BY_ID.has(defId)) {
          const cle = `${defId}|${n.spec}`;
          if (!consommateurs.has(cle)) consommateurs.set(cle, new Set());
          consommateurs.get(cle)!.add(ou);
        }
        for (const v of Object.values(n)) walk(v);
      };
      walk(data);
    }
  }

  const statblocSeul = (defId: string, specId: string): boolean => {
    const ou = consommateurs.get(`${defId}|${specId}`);
    return !!ou && ou.size === 1 && ou.has(FICHIER_STATBLOCS);
  };

  it('la mesure ATTEINT bien les statblocs (sinon le contrat est vide et toujours vert)', () => {
    const vues = [...consommateurs.values()].filter((ou) => ou.has(FICHIER_STATBLOCS));
    expect(vues.length).toBeGreaterThan(50);
  });

  it('les DEUX catalogues sont dans le périmètre (Compétences ET Talents)', () => {
    const horsPool = DEFS.filter((d) => (d.specs ?? []).some((e) => e.pool === false)).map((d) => d.id);
    expect(horsPool.some((id) => EST_COMPETENCE.has(id)), 'aucune Compétence hors pool').toBe(true);
    expect(horsPool.some((id) => !EST_COMPETENCE.has(id)), 'aucun Talent hors pool').toBe(true);
  });

  it('toute spec ATTESTÉE employée par les SEULS statblocs porte `pool: false`', () => {
    const manquants: string[] = [];
    for (const def of DEFS) {
      for (const e of def.specs ?? []) {
        if (!e.source || e.pool === false) continue;
        if (statblocSeul(def.id, specEntryId(e))) {
          manquants.push(
            `${def.id}/${specEntryId(e)} (${e.source.book} ${e.source.page ?? '?'}) : ${FICHIER_STATBLOCS} est son SEUL consommateur`,
          );
        }
      }
    }
    expect(
      manquants,
      'spéc(s) attestées que seul un statbloc emploie et que le pool PROPOSE quand même — poser ' +
        `\`pool: false\` (par la migration qui les a créées, jamais à la main) :\n${manquants.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * #1897 — un emplacement libre (`choix: true`) se désigne dans le pool joueur de son entrée
 * (`LDB 09 l.40` ; `wildcardSpecs` au créateur et à l'avancement, `designateSpec` au spawn).
 * Un choix borné (`choix: [ids]`) propose ses propres ids. Le contrôle du pool joueur porte
 * sur les deux racines authorées. Pour un id commun à une Compétence et à un Talent
 * (`resistance`), l'emplacement est fautif si les deux pools sont vides.
 */
type DefASpecs = Parameters<typeof specPoolOf>[0];
function choixSansPoolJoueur(documents: [string, unknown][], defsDe: (id: string) => DefASpecs[]): { vus: number; fautes: string[] } {
  let vus = 0;
  const fautes: string[] = [];
  const walk = (node: unknown, ou: string): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, ou)); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.id === 'string' && n.choix === true) {
      const defs = defsDe(n.id);
      if (defs.length) {
        vus++;
        if (defs.every((d) => specPoolOf(d).length === 0)) fautes.push(`${ou} : « ${n.id} » en « choix » — pool joueur VIDE`);
      }
    }
    for (const v of Object.values(n)) walk(v, ou);
  };
  for (const [ou, doc] of documents) walk(doc, ou);
  return { vus, fautes };
}

describe('#1897 — un emplacement ne vise jamais une entrée à pool JOUEUR vide', () => {
  const defsDe = (id: string): DefASpecs[] => [...skills, ...talents].filter((d) => d.id === id);
  const documents: [string, unknown][] = RACINES.flatMap(([racine, dir]) =>
    fichiersDeDonnees(dir).map((abs): [string, unknown] => [`${racine}${relative(dir, abs).replace(/\\/g, '/')}`, JSON.parse(readFileSync(abs, 'utf8'))]),
  );

  it('les deux racines authorées : aucun emplacement sur une entrée sans pool joueur', () => {
    const { vus, fautes } = choixSansPoolJoueur(documents, defsDe);
    expect(vus, 'aucun emplacement libre `choix: true` mesuré').toBeGreaterThan(0);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('un catalogue composé de specs `pool: false` rend l’emplacement libre fautif', () => {
    const fixture: DefASpecs[] = [{ specs: [{ id: 'statbloc-seul', label: 'Statbloc seul', pool: false }] } as DefASpecs];
    const { fautes } = choixSansPoolJoueur(
      [['fixture.json', [{ id: 'x', choix: true }, { id: 'x', choix: ['statbloc-seul'] }, { id: 'x', spec: 'statbloc-seul' }]]],
      (id) => (id === 'x' ? fixture : []),
    );
    expect(fautes).toEqual(['fixture.json : « x » en « choix » — pool joueur VIDE']);
  });

  it('une entrée à `specs` inline toutes `pool: false` et SANS emplacement qui la vise n’est pas fautive (`attirant`, `LDB 10 l.17`)', () => {
    const fixture: DefASpecs[] = [{ specs: [{ id: 'public-restreint', label: 'Public restreint', pool: false }] } as DefASpecs];
    const { fautes } = choixSansPoolJoueur([['fixture.json', [{ id: 'x' }, { id: 'x', spec: 'public-restreint' }]]], (id) => (id === 'x' ? fixture : []));
    expect(fautes).toEqual([]);
  });
});
