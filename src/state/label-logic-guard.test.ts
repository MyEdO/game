import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  scanLabelLogic, collectIdParamFunctions, scanLabelAsIdArg,
  scanLabelLiteralCompare, ecartsAuxDettesDeLibelle, DETTES_DE_LIBELLE, cleDeDette, fichierDeDette,
  scanCallResultLiteralCompare,
  CORPUS_RACINE, estDansLeCorpus, RATCHET_EXCEPTIONS, ratchetShortKey,
  collectLabelEntityResolvers, scanLabelResolverCalls,
  scanLabelKeyedIndex,
  collectFacesDAffichage, scanFaceDAffichageIdentite, scanFaceDeDonneeString, scanLiantsLitterauxDesFaces,
  contexteDeLaGarde, corpusDeLaGarde, scanLabelLogicFichier, scanLabelLogicCorpus, dettesParVolet, clesInterditesAuStock,
} from '../../scripts/guards/lib/labelLogic.mjs';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { couvertureDuBalayage } from '../../scripts/guards/lib/stock.mjs';
import { skillRefLabel, talentRefLabel, talents } from '../data';
import { parseSkillRef, parseTalentRef } from '../ui/editor/refFormatLivre';

/**
 * Garde-fou « logique par LABEL interdite » (#142, #289, #909, #1988 §7 ; doctrine CLAUDE.md bloc
 * agents) : toute LOGIQUE est keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue).
 *
 * UNE garde : un corpus (`estDansLeCorpus`, tout `src/` hors instruments Vitest), une composition par
 * fichier (`scanLabelLogicFichier`, TOUS les volets), appelée ici sur le corpus entier et par le hook
 * pre-commit sur les fichiers stagés. Le dossier d'un site ne décide RIEN ; son statut est l'un de trois :
 *  - COUTURE légitime, au site (`RATCHET_EXCEPTIONS`) — la couture de chargement et de saisie de
 *    `src/data/index.ts` et le parseur de saisie de l'éditeur, chacune jugée par sa DÉCLARATION
 *    (« coutures légitimes » ci-dessous) ;
 *  - DETTE, au stock par fichier ET par volet (`DETTES_DE_LIBELLE`, clé `fichier#règle`), avec le ticket qui la tue — cliquet strict
 *    dans les deux sens ;
 *  - NU : la faute.
 * Les volets (formes détectées) sont décrits et contre-éprouvés un par un plus bas.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet

/** Le balayage de la garde sur le vrai corpus — mémoïsé : l'inventaire, le cliquet du stock et celui
 *  des coutures périmées jugent le MÊME balayage. */
let _garde: ReturnType<typeof scanLabelLogicCorpus> | null = null;
const garde = (): ReturnType<typeof scanLabelLogicCorpus> => (_garde ??= scanLabelLogicCorpus(corpusDeLaGarde()));
const cleDe = (s: { rel: string; line: number }): string => ratchetShortKey(s);

describe('garde « logique par libellé » : un corpus, une composition, deux statuts de site', () => {
  it('INVENTAIRE : chaque site du corpus est une couture légitime ou une dette au stock, aucun n’est nu', () => {
    const { fichiers, sites } = garde();
    const couverture = couvertureDuBalayage({ nom: 'garde libellé', stock: [...new Set(Object.keys(DETTES_DE_LIBELLE).map(fichierDeDette))], balayes: fichiers, gisements: [CORPUS_RACINE] });
    expect(couverture.gisementsMuets, couverture.gisementsMuets.join('\n')).toEqual([]);
    expect(couverture.entreesDeStockAbsentes, couverture.entreesDeStockAbsentes.join('\n')).toEqual([]);
    const inventaire = sites.map((s) => `${s.statut.padEnd(7)} ${s.rel}:${s.line} [${s.rule}] ${s.detail}`).join('\n');
    expect(sites.filter((s) => s.statut === 'nu').map((s) => `${s.rel}:${s.line} [${s.rule}] ${s.detail}`),
      'Logique par LIBELLÉ hors couture et hors stock — migrer vers un keying par id (la seule couture label→id ' +
        'vit dans `src/data/index.ts`, au CHARGEMENT). Inventaire complet :\n' + inventaire).toEqual([]);
  });

  it('CLIQUET du stock des dettes, dans les deux sens : aucune dette neuve, aucune dette soldée restée au stock', () => {
    const drift = ecartsAuxDettesDeLibelle(dettesParVolet(garde()));
    expect(drift, drift.join('\n')).toEqual([]);
  });

  it('VOLETS SANS STOCK : aucune clé du stock ne porte `label-logic` ni `label-as-id-arg`, quel que soit le fichier', () => {
    const interdites = clesInterditesAuStock();
    expect(interdites, interdites.join('\n')).toEqual([]);
    expect(clesInterditesAuStock({
      'src/ui/sonde.tsx#label-logic': 1, 'src/data/sonde.ts#label-as-id-arg': 1, 'src/ui/sonde.tsx#label-literal': 1,
    }).map((e) => e.split(' : ')[0])).toEqual(['src/ui/sonde.tsx#label-logic', 'src/data/sonde.ts#label-as-id-arg']);
    expect(ecartsAuxDettesDeLibelle(new Map([['src/ui/sonde.tsx#label-logic', 1]]))).toHaveLength(1);
  });

  it('chaque rubrique du stock nomme son ticket `#N`', () => {
    const rel = 'scripts/guards/lib/labelLogic.mjs';
    const texte = readFileSync(join(ROOT, rel), 'utf8');
    const sf = ts.createSourceFile(rel, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const decl = sf.statements.filter(ts.isVariableStatement).flatMap((st) => [...st.declarationList.declarations])
      .find((d) => ts.isIdentifier(d.name) && d.name.text === 'DETTES_DE_LIBELLE');
    const objet = decl?.initializer;
    if (!objet || !ts.isObjectLiteralExpression(objet)) throw new Error('DETTES_DE_LIBELLE introuvable en littéral objet');
    expect(objet.properties.length).toBe(Object.keys(DETTES_DE_LIBELLE).length);
    let rubrique = '';
    const sansTicket: string[] = [];
    for (const p of objet.properties) {
      const commentaires = ts.getLeadingCommentRanges(texte, p.getFullStart()) ?? [];
      if (commentaires.length > 0) rubrique = commentaires.map((c) => texte.slice(c.pos, c.end)).join('\n');
      if (!/#\d+/.test(rubrique)) sansTicket.push(p.name?.getText(sf) ?? '?');
    }
    expect(sansTicket, 'Dette(s) sans ticket : la rubrique qui les précède doit nommer le `#N` qui les tue').toEqual([]);
  });

  it('CLIQUET des coutures : toute entrée de RATCHET_EXCEPTIONS désigne un site vu', () => {
    const vus = new Set(garde().sites.map(cleDe));
    const perimees = Object.keys(RATCHET_EXCEPTIONS).filter((k) => !vus.has(k));
    expect(perimees, 'Couture(s) PÉRIMÉE(s) (site déplacé ou assaini) — retirer/re-pointer ces entrées de RATCHET_EXCEPTIONS :\n' + perimees.join('\n')).toEqual([]);
  });

  it('CORPUS unique : tout `src/` en `.ts`/`.tsx`, instruments Vitest exclus, rien hors `src/`', () => {
    expect(estDansLeCorpus('src/scenes/test-scenarios/marche-equipement.ts')).toBe(true);
    expect(estDansLeCorpus('src/i18n/index.ts')).toBe(true);
    expect(estDansLeCorpus('src/ui/App.tsx')).toBe(true);
    expect(estDansLeCorpus('src/state/label-logic-guard.test.ts')).toBe(false);
    expect(estDansLeCorpus('scripts/guards/lib/labelLogic.mjs')).toBe(false);
    expect(estDansLeCorpus('src/data/trappings.json')).toBe(false);
    expect(estDansLeCorpus('src/vite-env.d.ts')).toBe(false);
    // `estDansLeCorpus` sur l'arbre BRUT désigne exactement le corpus lu (`corpusDeLaGarde`).
    const brut = listerArbre(join(ROOT, CORPUS_RACINE)).map((r: string) => `${CORPUS_RACINE}/${r}`).filter(estDansLeCorpus);
    expect(brut).toEqual([...garde().fichiers].sort());
  });

  it('CÂBLAGE : la composition par fichier porte CHAQUE volet, hors de tout dossier privilégié', () => {
    // Une fixture par volet, sous un chemin de `src/` qu'aucune liste de dossiers ne nommait
    // (`src/scenes/`) : si un volet sort de `scanLabelLogicFichier`, sa règle disparaît de la sortie.
    const decl = 'export function sondeId(id: string): string { return id; }\n';
    const index = 'export function findSonde(label: string): SondeData | undefined { return undefined; }\n';
    const face = 'export function sondeLabel(id: string): PlayerText { return dataLabel(id); }\n';
    const sonde = [
      "import { sondeLabel } from '../data/sonde';",
      "export const a = x.label === 'Épée';",
      'export const b = sondeId(sb.label);',
      "export const c = w.reach === 'Très longue';",
      "export const d = bandName(r) === 'Bout portant';",
      'export const e = Object.fromEntries(qs.map((q) => [q.label, q.desc]));',
      "export const f = findSonde('Orc');",
      'export const g = m[sondeLabel(id)];',
    ].join('\n');
    const dataSonde = 'export function nomDe(id: string): string { return find(id)?.label ?? id; }\n';
    const fichiers = [
      { rel: 'src/scenes/sonde-decl.ts', text: decl },
      { rel: 'src/data/index.ts', text: index },
      { rel: 'src/data/sonde.ts', text: face + dataSonde },
      { rel: 'src/scenes/sonde.ts', text: sonde },
    ];
    const ctx = contexteDeLaGarde(fichiers);
    const regles = new Set([
      ...scanLabelLogicFichier('src/scenes/sonde.ts', sonde, ctx),
      ...scanLabelLogicFichier('src/data/sonde.ts', face + dataSonde, ctx),
    ].map((s) => s.rule));
    expect([...regles].sort()).toEqual([
      'face-affichage-identite', 'face-donnee-string', 'label-as-id-arg', 'label-call-literal',
      'label-entity-resolver-call', 'label-keyed-index', 'label-literal', 'label-logic',
    ]);
    expect(scanLabelLogicFichier('src/scenes/sonde.test.ts', sonde, ctx)).toEqual([]);
  });

  it('STATUT : couture au site, dette à la clé `fichier#règle` du stock, nu ailleurs — même fichier compris', () => {
    const ctx = contexteDeLaGarde([]);
    const [couture] = Object.keys(RATCHET_EXCEPTIONS);
    const [rel, ligne] = [`src/${couture.split(':')[0]}`, Number(couture.split(':')[1])];
    const faute = "x.label === 'Épée';"; // deux volets : `label-logic`, puis `label-literal`
    const texte = (n: number) => `${'\n'.repeat(n - 1)}${faute}\n`;
    expect(scanLabelLogicFichier(rel, texte(ligne), ctx).map((s) => s.statut)).toEqual(['couture', 'couture']);
    const dette = Object.keys(DETTES_DE_LIBELLE).find((k) => k.endsWith('#label-literal'))!;
    expect(DETTES_DE_LIBELLE[`${fichierDeDette(dette)}#label-logic`]).toBeUndefined();
    const sites = scanLabelLogicFichier(fichierDeDette(dette), faute, ctx);
    expect(sites.map((s) => [cleDeDette(s), s.statut])).toEqual([[`${fichierDeDette(dette)}#label-logic`, 'nu'], [dette, 'dette']]);
    expect(scanLabelLogicFichier('src/scenes/sonde.ts', faute, ctx).map((s) => s.statut)).toEqual(['nu', 'nu']);
  });

  it('CLIQUET par volet : une dette qui passe d’un volet à l’autre d’un même fichier rougit, dans les deux sens', () => {
    const [cle, n] = Object.entries(DETTES_DE_LIBELLE)[0];
    const autre = `${fichierDeDette(cle)}#volet-voisin`;
    expect(ecartsAuxDettesDeLibelle(new Map([[cle, n], [autre, 0]]))).toEqual([]);
    const deplace = ecartsAuxDettesDeLibelle(new Map([[cle, n - 1], [autre, 1]]));
    expect(deplace.map((e) => e.split(' : ')[0])).toEqual([cle, autre]);
  });
});

describe('coutures légitimes : chaque entrée de RATCHET_EXCEPTIONS est jugée par la déclaration qui porte son site', () => {
  /** La déclaration de PREMIER NIVEAU qui porte la ligne `n` (1-based) du fichier `rel`, lue par l'AST. */
  const declarationDe = (rel: string, n: number): string => {
    const texte = readFileSync(join(ROOT, rel), 'utf8');
    const sf = ts.createSourceFile(rel, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const st of sf.statements) {
      const debut = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1;
      const fin = sf.getLineAndCharacterOfPosition(st.getEnd()).line + 1;
      if (n < debut || n > fin) continue;
      if (ts.isFunctionDeclaration(st) && st.name) return st.name.text;
      if (ts.isVariableStatement(st)) {
        const d = st.declarationList.declarations[0];
        if (ts.isIdentifier(d.name)) return d.name.text;
      }
    }
    return '';
  };
  const coutures = (prefixe: string) => Object.keys(RATCHET_EXCEPTIONS).filter((k) => k.startsWith(prefixe));

  it('seuls deux fichiers portent une couture : `data/index.ts` et le parseur `ui/editor/refFormatLivre.ts`', () => {
    const fichiers = new Set(Object.keys(RATCHET_EXCEPTIONS).map((k) => k.split(':')[0]));
    expect([...fichiers].sort()).toEqual(['data/index.ts', 'ui/editor/refFormatLivre.ts']);
  });

  it('`data/index.ts` : chaque site est DANS un résolveur par libellé de #909, ou dans un index lu par lui SEUL', () => {
    const texte = readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8');
    const resolveurs = collectLabelEntityResolvers(texte);
    const sites = coutures('data/index.ts:');
    expect(sites.length, 'aucune couture `data/index.ts` : le volet est devenu muet').toBeGreaterThan(0);
    for (const cle of sites) {
      const decl = declarationDe('src/data/index.ts', Number(cle.split(':')[1]));
      const lecteurs = new Set(texte.split('\n').flatMap((l, i) =>
        new RegExp(`\\b${decl}\\b`).test(l) && declarationDe('src/data/index.ts', i + 1) !== decl ? [declarationDe('src/data/index.ts', i + 1)] : []));
      const porteur = resolveurs.has(decl) ? decl : lecteurs.size === 1 ? [...lecteurs][0] : `${decl} (lu par ${[...lecteurs].join(', ')})`;
      expect(resolveurs.has(porteur), `${cle} : \`${porteur}\` n'est pas un résolveur par libellé de #909`).toBe(true);
    }
  });

  it('`qualityIdByLabel` : le site (c) de `data/index.ts` est la déclaration du résolveur libellé→id', () => {
    const site = garde().sites.find((s) => s.rule === 'face-donnee-string' && s.rel === 'src/data/index.ts');
    expect(site?.statut).toBe('couture');
    expect(declarationDe('src/data/index.ts', site!.line)).toBe('qualityIdByLabel');
    expect(collectLabelEntityResolvers(readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8')).has('qualityIdByLabel')).toBe(true);
  });

  /** Ce que FAIT chaque parseur de saisie qui porte une couture : il relit le texte que l'affichage
   *  compose et rend l'id d'origine — sur toute la donnée quand elle s'énumère. */
  const ALLER_RETOUR: Record<string, () => void> = {
    parseSkillRef: () => {
      for (const ref of [
        { id: 'corps-a-corps', spec: 'fleau', value: 50 },
        { id: 'savoir', choix: true as const, value: 30 },
      ]) expect(parseSkillRef(skillRefLabel(ref))).toEqual(ref);
    },
    parseTalentRef: () => {
      const faux = talents.filter(({ id }) => JSON.stringify(parseTalentRef(talentRefLabel({ id }))) !== JSON.stringify({ id }))
        .map(({ id }) => `${id} → ${JSON.stringify(parseTalentRef(talentRefLabel({ id })))}`);
      expect(talents.length).toBeGreaterThan(0);
      expect(faux, faux.join('\n')).toEqual([]);
    },
  };

  it('`refFormatLivre` : chaque site est dans le parseur de SAISIE, qui rend un id — l’aller-retour affichage → saisie tient', () => {
    const rel = 'src/ui/editor/refFormatLivre.ts';
    const lignes = readFileSync(join(ROOT, rel), 'utf8').split('\n');
    const sites = coutures('ui/editor/refFormatLivre.ts:');
    expect(sites.length).toBeGreaterThan(0);
    for (const cle of sites) {
      const decl = declarationDe(rel, Number(cle.split(':')[1]));
      const lecteurs = new Set(lignes.flatMap((l, i) => (new RegExp(`\\b${decl}\\(`).test(l) && declarationDe(rel, i + 1) !== decl ? [declarationDe(rel, i + 1)] : [])));
      const porteurs = decl in ALLER_RETOUR ? [decl] : [...lecteurs];
      expect(porteurs.length, `${cle} : \`${decl}\` n'est lu par aucun parseur`).toBeGreaterThan(0);
      for (const p of porteurs) {
        expect(ALLER_RETOUR[p], `${cle} : \`${p}\` n'a aucun aller-retour affichage → saisie prouvé`).toBeDefined();
        ALLER_RETOUR[p]();
      }
    }
  });
});

describe('garde-fou « logique par label interdite » : volets `.label` (#142)', () => {
  it('scanLabelLogic : détecte un champ d’AFFICHAGE interpolé dans une CLÉ (#598)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait en `state/triggeredEffects.ts` (Atouts d'arme keyés par
    // LIBELLÉ, corrigé en `weaponIdentity`) : la garde `.label` d'origine n'en voyait NI le champ
    // `name`, NI la construction de clé par littéral de gabarit — c'est ce trou qui l'a laissé vivre.
    const src = [
      'out.push({ effects: w.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });',
      'const key = `zone-${zone.label}-${t.x}`;',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2]);
    expect(findings.map((f) => f.rule)).toEqual(['display-key', 'display-key']);
  });

  it('scanLabelLogic : détecte une IDENTITÉ dérivée du label, quelle que soit la chaîne qui mène au `.label` (#637, #1988)', () => {
    // Cas PLANTÉS = le motif qui vivait au rig (`TENUE_BY_ID` keyé par `slugId(d.label)`), et la forme
    // de `rigSpeciesId` (`src/data/index.ts`, #1988) qu'un motif de ligne `slugId\s*\(\s*[\w.]+\.label` ne
    // voit pas : appel, `?.`, `??`, gabarit, appel sur plusieurs lignes. CONTRE-ÉPREUVES : `slugId(p.name)`
    // (fragment TEXTE saisi en éditeur, couture label→id d'authoring) et `slugId(label)` (paramètre de
    // saisie) — le détecteur vise la LECTURE d'un champ `.label` seulement.
    const src = [
      'export const defId = (c) => c.id ?? slugId(c.label);',
      'const id = findTalent(p.name)?.id ?? slugId(p.name);',
      "export const r = (x) => slugId(findSpeciesById(x)?.label ?? x ?? 'Humain');",
      'export const s = slugId(a?.b.label);',
      'export const u = slugId(x.label ?? y);',
      'export const v = slugId(`${x.label}-${n}`);',
      'export const w = slugId(',
      '  pick(x).label,',
      ');',
      'export const q = (label) => slugId(label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 3, 4, 5, 6, 7]);
    expect(new Set(findings.map((f) => f.rule))).toEqual(new Set(['label-logic']));
  });

  it('scanLabelLogic : la ligne rapportée est celle du FICHIER, sous un commentaire de bloc multiligne', () => {
    // Les volets de ligne et le volet AST (`slugId`) partagent la numérotation du fichier : c'est elle
    // que portent les clés `fichier:ligne` de `RATCHET_EXCEPTIONS`.
    const src = [
      '/**',
      ' * JSDoc de trois lignes.',
      ' */',
      'export const k = slugId(c.label);',
      'const m = X_BY_LABEL;',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => f.line)).toEqual([4, 5]);
  });

  it('scanLabelLogic : ne flague PAS la LECTURE d’affichage d’un libellé (interpolation de journal)', () => {
    // Contre-épreuve indispensable : ~700 interpolations d'AFFICHAGE existent dans src/ (`${c.name} touche
    // ${d.name}`). Les flaguer rendrait la garde inutilisable — seule la construction d'une CLÉ est visée.
    const src = [
      'log: `${attacker.name} manque ${defender.name}.`,',
      'lines.push(`${f.label} : ${rolled} Moral.`);',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE en CLÉ DE COLLECTION (#602)', () => {
    // Cas PLANTÉ = les motifs EXACTS du ticket #602 — `owned` (Set de talents possédés) keyé par LIBELLÉ
    // concret faute d'identité de spécialisation (`engine/character.ts`, corrigé en `refKey(id, spec)`),
    // et un repli d'UI keyé par le nom d'un sous-groupe (`compendium/CompendiumScreen.tsx`).
    const src = [
      'const free = specs.filter((s) => !owned.has(concreteLabel(entry.label, s)));',
      'if (!owned.has(entry.label)) return entry.label;',
      'const open = manualOpen[cl.name] ?? hasActive;',
      'seen.delete(other.label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
    expect(findings.map((f) => f.rule)).toEqual(['collection-key', 'collection-key', 'collection-key', 'collection-key']);
  });

  it('scanLabelLogic : ne flague NI la résolution par id NI la CONSTRUCTION d’un index de texte (#602)', () => {
    // Contre-épreuves : (1) lire le libellé d'un lookup PAR ID est l'usage légitime du label (~50 sites
    // dans src/data) ; (2) REMPLIR un index depuis du texte est la conversion label→id tolérée
    // (CLAUDE.md) — auto-liage de prose, import de statbloc —, seule l'INTERROGATION est une décision.
    const src = [
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const l = byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref;',
      'idx.exact.set(it.label, it);',
      'teamOf.set(named[i].name, named[i].kind === \'hero\' ? \'ally\' : \'enemy\');',
      'roots.add(e.label);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
      '(acc[it.name] ??= { name: it.name, uids: [] }).uids.push(it.uid);',
      '...Object.fromEntries(travelVehicles().map((v) => [v.id, v.label])),',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte les prédicats sur `.label` (regex .test, méthode de chaîne, switch)', () => {
    const src = [
      "const isOgre = /ogre/i.test(sp.label);",
      "const isPermanent = !/amputation|cécité|surdité/i.test(t.label);",
      "const isAffaler = eff.label.startsWith('Affaler');",
      "switch (x.label) { case 'A': break; }",
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });

  it('collectIdParamFunctions + scanLabelAsIdArg : détecte `.label` passé où le paramètre déclaré est `id` (LOT 5)', () => {
    // Cas PLANTÉ = le motif EXACT de #142 LOT 5 (`state/spawn.ts` avant correction) : `bodyShapeOf`
    // déclare un paramètre `id: string` — lui passer `sb.label` fait résoudre par un libellé d'auteur,
    // pas une identité stable.
    const decl = 'export function bodyShapeOf(id: string): BodyShape {\n  return rec.appearance.species;\n}';
    const idParamFns = collectIdParamFunctions(decl);
    expect(idParamFns.get('bodyShapeOf')).toBe(0);
    const bad = 'bodyShape: bodyShapeOf(sb.label), // BUG';
    const ok = 'bodyShape: bodyShapeOf(creature.id),';
    expect(scanLabelAsIdArg('fixture.ts', bad, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    expect(scanLabelAsIdArg('fixture.ts', ok, idParamFns)).toEqual([]);
  });

  it('collectIdParamFunctions : repère le paramètre `id` quel que soit son rang positionnel', () => {
    const decl = 'function findEntry(list, id: string, fallback) {}';
    expect(collectIdParamFunctions(decl).get('findEntry')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'findEntry(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('collectIdParamFunctions : couvre aussi un paramètre `*Id` (creatureId/entityId/refId…), pas seulement `id` (LOT 6)', () => {
    const decl = 'function resolve(list: unknown[], creatureId: string, fallback: unknown) {}';
    expect(collectIdParamFunctions(decl).get('resolve')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'resolve(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('collectIdParamFunctions : const fléchée ASYNC, générique, et paramètre `id` APRÈS un callback (LOT 6)', () => {
    const asyncArrow = 'const loadThing = async (id: string) => fetchThing(id);';
    expect(collectIdParamFunctions(asyncArrow).get('loadThing')).toBe(0);

    const generic = 'function pick<T>(id: string, list: T[]): T | undefined { return list[0]; }';
    expect(collectIdParamFunctions(generic).get('pick')).toBe(0);

    const afterCallback = 'function withCb(onDone: (n: number) => void, id: string) {}';
    expect(collectIdParamFunctions(afterCallback).get('withCb')).toBe(1);
  });

  it('collectIdParamFunctions : méthode de CLASSE et d’objet littéral (raccourci sans `function`) (LOT 6)', () => {
    const classBody = 'class Repo {\n  findById(id: string): unknown {\n    return this.map.get(id);\n  }\n}';
    expect(collectIdParamFunctions(classBody).get('findById')).toBe(0);

    const objLiteral = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};';
    expect(collectIdParamFunctions(objLiteral).get('bodyShapeOf')).toBe(0);
  });

  it('scanLabelAsIdArg : appel MULTILIGNE (le scan porte sur le corps entier, pas ligne par ligne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const call = 'const shape = bodyShapeOf(\n  sb.label,\n);\n';
    const findings = scanLabelAsIdArg('fixture.ts', decl + call, collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : enrobages triviaux (`??`, template, String(...), `as`, `!`, méthode de chaîne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const cases = [
      'bodyShapeOf(sb.label ?? "");',
      'bodyShapeOf(`${sb.label}`);',
      'bodyShapeOf(String(sb.label));',
      'bodyShapeOf(sb.label as string);',
      'bodyShapeOf(sb.label!);',
      'bodyShapeOf(sb.label.toLowerCase());',
    ];
    for (const line of cases) {
      expect(scanLabelAsIdArg('fixture.ts', decl + line, idParamFns).map((f) => f.rule), line).toEqual(['label-as-id-arg']);
    }
  });

  it('scanLabelAsIdArg : découpage d’arguments robuste aux `<`/`>` de comparaison (pas des génériques) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(a: unknown, id: string, b: unknown) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const withComparison = 'bodyShapeOf(a < b, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withComparison, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    const withCallback = 'bodyShapeOf(() => 1, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withCallback, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : appel de MÉTHODE dont le nom n’est PAS une méthode de collection connue reste un candidat (LOT 6)', () => {
    const decl = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};\n';
    const idParamFns = collectIdParamFunctions(decl);
    const via = 'helpers.bodyShapeOf(sb.label);';
    expect(scanLabelAsIdArg('fixture.ts', decl + via, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    // Contre-épreuve documentée : un nom de méthode COLLISIONNANT avec l'API Map/Set/Array reste
    // exclu, receveur inconnu ou pas — limite ASSUMÉE, cf. `COLLECTION_METHOD_NAMES` (labelLogic.mjs).
    const setDecl = 'function set(id: string) { return id; }\n';
    const setFns = collectIdParamFunctions(setDecl);
    expect(scanLabelAsIdArg('fixture.ts', 'teamOf.set(sb.label);', setFns)).toEqual([]);
  });
  it('scanLabelLogic : un `typeof x.label` compare le TYPE du champ, pas son texte', () => {
    const src = [
      "const l = estObjet(v) && typeof v.label === 'string' ? v.label : undefined;",
      "const m = typeof a?.b.label === 'string';",
      "const n = v.label === 'Épée';",
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => f.line)).toEqual([3]);
  });

  it('scanLabelLogic : le contenu d’une CHAÎNE n’est pas du code, `detail` cite la ligne source', () => {
    const src = [
      "const aide = 'écrire x.label === y est interdit';",
      "const k = x.label === 'Arme (au choix)';",
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => [f.line, f.detail])).toEqual([[2, "const k = x.label === 'Arme (au choix)';"]]);
  });
});

/**
 * Deuxième volet (#142 LOT 7) : un LIBELLÉ ne vit pas que dans un champ `label`. `weapon.reach ===
 * 'Très longue'` a vécu dans `src/engine` — zone à tolérance zéro — sans qu'aucune garde ne le voie,
 * parce que toutes ne regardaient que `label`/`name`. Le critère porte donc sur la FORME du LITTÉRAL
 * (majuscule initiale, accent ou espace = texte d'affichage, jamais un id slug de ce dépôt), quel que
 * soit le nom du champ. La dette héritée est un STOCK PAR FICHIER ET PAR VOLET (`DETTES_DE_LIBELLE`), à cliquet
 * strict dans les deux sens — pas une liste de sites exemptés.
 */
describe('garde-fou « logique par LIBELLÉ hors du champ label » (#142 LOT 7)', () => {
  it('ANTI-VACANCE : échoue sur la faute d’Allonge reconstituée, y compris portée par une variable', () => {
    // Le motif EXACT qui vivait en `engine/engagement.ts` avant migration (`REACH_ORDER` + comparaisons
    // au libellé accentué) — et sa variante par ALIAS, invisible à un scan ligne à ligne.
    const direct = "export const reachTiles = (w: Weapon) => (w.reach === 'Très longue' ? 2 : 1);";
    expect(scanLabelLiteralCompare('engagement.ts', direct).map((f) => f.rule)).toEqual(['label-literal']);
    const viaAlias = 'function f(w: Weapon) {\n  const band = w.reach;\n  return band === \'Considérable\' ? 3 : 1;\n}';
    expect(scanLabelLiteralCompare('engagement.ts', viaAlias).map((f) => f.rule)).toEqual(['label-literal']);
    const table = "const REACH_ORDER = { 'Très courte': 0, 'Moyenne': 1, 'Très longue': 2 };";
    expect(scanLabelLiteralCompare('engagement.ts', table).map((f) => f.rule)).toEqual(['label-record']);
    const aiguillage = "function g(w: Weapon) {\n  switch (w.reach) {\n    case 'Très longue': return 2;\n    default: return 1;\n  }\n}";
    expect(scanLabelLiteralCompare('engagement.ts', aiguillage).map((f) => f.rule)).toEqual(['label-switch']);
  });

  it('CONTRE-ÉPREUVES : discriminant d’union, champ d’affichage rendu, vocabulaire DOM, comparaison à une variable', () => {
    const src = [
      "if (area.kind === 'disc') return radius;", // discriminant d'union en slug ASCII
      "const melee = w.type === 'melee';",
      'return <span className="chip">{item.label}</span>;', // RENDU d'un libellé = son usage légitime
      "if (e.key === 'Enter' || e.code === 'Space') act();", // vocabulaire W3C, aucun id possible
      "if (tag === 'INPUT') return;", // alias de `el.tagName`, même vocabulaire W3C
      'if (a.reach === b.reach) return 0;', // comparaison à une VARIABLE : aucun libellé figé
      "const ids = { 'tres-longue': 2, 'considérable': 3 };", // table keyée par ids (minuscules)
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.tsx', 'const tag = el.tagName;\n' + src)).toEqual([]);
  });

  it('ANTI-VACANCE : échoue sur la faute de RÉCOLTE reconstituée (regex de libellé sur une valeur dérivée d’un champ)', () => {
    // Le motif EXACT qui vivait en `engine/harvest.ts` avant migration (#1318 V6) : le TraitInstance
    // formaté en prose FR, puis re-parsé à la regex — la voie par id (`findResolvedTrait`) existait.
    const viaCallback = 'function h(c: Creature) {\n'
      + "  return (c.traits ?? []).map(traitText).find((s) => /^Taille/.test(s)) ?? '';\n"
      + '}';
    expect(scanLabelLiteralCompare('harvest.ts', viaCallback).map((f) => f.rule)).toEqual(['label-regex']);
    const viaVariable = 'function h(c: Creature) {\n'
      + "  const t = (c.traits ?? []).map(traitText).join(' ');\n"
      + "  if (/Monstrueuse/.test(t)) return 'Monstrueuse';\n"
      + "  return t.match(/Énorme/) ? 'Énorme' : 'Moyenne';\n"
      + '}';
    expect(scanLabelLiteralCompare('harvest.ts', viaVariable).map((f) => f.rule)).toEqual(['label-regex', 'label-regex']);
  });

  it('CONTRE-ÉPREUVES `label-regex` : motif de FORME, texte non dérivé d’un champ, transformation', () => {
    const src = [
      "const slug = s.replace(/[^a-z0-9]+/g, '-');", // transformation, pas une décision
      'if (/^\\p{Lu}/u.test(raw)) return raw;', // critère de FORME (classe/échappement), aucun mot de libellé
      "if (/^Taille/.test('Taille (Grande)')) return 1;", // littéral en dur : aucun champ de donnée derrière
      'const n = txt.match(/[0-9]+/);', // motif numérique
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.ts', src)).toEqual([]);
  });

  it('CONTRE-ÉPREUVES de FORME du littéral : nom de type d’erreur, jeton de grammaire entre accolades', () => {
    // Les deux faux positifs mesurés sur `src/data` à l’ouverture du corpus : `DOMException.name` (`fsPersist.ts`)
    // et le segment de chemin `{clé}` de la grammaire des schémas (`collection-cle.ts`).
    const src = [
      "if (e instanceof DOMException && e.name === 'AbortError') return null;",
      "const cles = enfants.filter((e) => e.segment === '{clé}');",
      "if (ev.key === 'ArrowLeft') recule();",
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.ts', src)).toEqual([]);
    expect(scanLabelLiteralCompare('fixture.ts', "const t = w.tier === 'Bronze';\nconst u = w.loc === 'Tête';").map((f) => f.line)).toEqual([1, 2]);
    // Seul le NOM d'un type d'erreur échappe : un libellé en casse de chameau (`HarvestSize`) reste vu.
    expect(scanLabelLiteralCompare('fixture.ts', "const petit = h.size === 'InfMoyenne';").map((f) => f.rule)).toEqual(['label-literal']);
  });
});

/**
 * Troisième volet (#1694 B3) : le sujet comparé à un libellé n'est pas toujours un CHAMP.
 * `rangeBandName(distanceTiles, rangeM, metresPerTile) === 'Bout portant'` décidait l'Esquive contre
 * un tir (`engine/combat.ts`, LDB 14 l.40) sur le TEXTE FR d'une bande de portée, alors que la même
 * couture expose `rangeBandId(...) === 'bout-portant'`. Les deux volets ci-dessus étaient AVEUGLES à
 * cette forme — mesuré : sur la ligne isolée, `scanLabelLogic` et `scanLabelLiteralCompare` rendent
 * `[]`. Critère STRUCTUREL : égalité dont un côté est un APPEL et l'autre un littéral de FORME libellé.
 */
describe('garde-fou « retour d’APPEL comparé à un LIBELLÉ » (#1694 B3)', () => {
  it('ANTI-VACANCE : la faute d’Esquive à Bout Portant reconstituée est VUE, et les deux volets précédents ne la voient PAS', () => {
    const avant =
      "if (distanceTiles != null && rangeM != null && rangeBandName(distanceTiles, rangeM, metresPerTile) === 'Bout portant')\n"
      + "  modes.add('esquive');";
    expect(scanCallResultLiteralCompare('combat.ts', avant).map((f) => f.rule)).toEqual(['label-call-literal']);
    expect(scanLabelLogic('combat.ts', avant)).toEqual([]);
    expect(scanLabelLiteralCompare('combat.ts', avant)).toEqual([]);
    const apres = "if (rangeBandId(distanceTiles, rangeM, metresPerTile) === 'bout-portant') modes.add('esquive');";
    expect(scanCallResultLiteralCompare('combat.ts', apres)).toEqual([]);
  });

  it('CONTRE-ÉPREUVES : id kebab, comparaison à une variable, texte FABRIQUÉ (`t`/`String`)', () => {
    const src = [
      "if (rangeBandId(d, r, m) === 'bout-portant') return 1;", // l'id STABLE : la forme attendue
      'if (bandOf(a) === bandOf(b)) return 0;', // aucun libellé figé
      "if (t('roll.voile') === 'Voile') return 1;", // texte FABRIQUÉ par l'i18n, pas une clé de logique
      "if (String(n) === 'Deux') return 1;",
    ].join('\n');
    expect(scanCallResultLiteralCompare('fixture.ts', src)).toEqual([]);
  });
});

/**
 * Volet CONSTRUCTION (#909) : les volets ci-dessus jugent l'INTERROGATION d'une collection par un
 * libellé — la REMPLIR depuis du texte y est tolérée, la conversion label→id étant licite mais à UN
 * endroit (`src/data/index.ts`, CLAUDE.md). Hors de cette couture, la CONSTRUCTION est la
 * faute, et elle était MUETTE : `QUALITY_DESC` (`engine/qualities/describe.ts`) a vécu comme
 * `Record` keyé par LIBELLÉ, bâti par `fromEntries(… [q.label, q.desc])` et lu par une VARIABLE.
 */
describe('garde-fou « index keyé par un LIBELLÉ, construit dans le moteur » (#909)', () => {
  it('scanLabelKeyedIndex : échoue sur la faute QUALITY_DESC reconstituée, et sur ses deux variantes', () => {
    const src = [
      'const DATA_DESC = Object.fromEntries(qualitiesJson.filter((q) => q.desc).map((q) => [q.label, q.desc!]));',
      'idx.exact.set(it.label, it);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
    ].join('\n');
    const findings = scanLabelKeyedIndex('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3]);
    expect(findings.map((f) => f.rule)).toEqual(['label-keyed-index', 'label-keyed-index', 'label-keyed-index']);
  });

  it('CONTRE-ÉPREUVES : libellé en VALEUR, index par id, lecture d’un libellé', () => {
    const src = [
      '...Object.fromEntries(travelVehicles().map((v) => [v.id, v.label])),', // le libellé est la VALEUR
      'byId.set(e.id, e);',
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const noms = [a.label, b.label].join(\', \');', // tableau d'AFFICHAGE, pas une paire clé/valeur
    ].join('\n');
    expect(scanLabelKeyedIndex('fixture.ts', src)).toEqual([]);
  });


  it('scanLabelKeyedIndex : une CLÉ COMPOSITE bâtie par une chaîne de méthodes sur une paire par libellé est vue', () => {
    const src = [
      "export const IDX = new Map(xs.map((x) => [[x.label, x.kind].join(':'), x.id]));",
      "export const IDX = Object.fromEntries(xs.map((x) => [[x.label, x.tier].join('|'), x]));",
    ].join('\n');
    expect(scanLabelKeyedIndex('fixture.ts', src).map((f) => f.line)).toEqual([1, 2]);
  });

  it('CONTRE-ÉPREUVE : un tableau d’AFFICHAGE qui commence par un libellé, receveur d’une méthode, sous un `map`', () => {
    const src = "const rows = t.rows.map((r) => ({ v: [r.label, suffixe].filter(Boolean).join(' ') }));";
    expect(scanLabelKeyedIndex('fixture.ts', src)).toEqual([]);
  });
});

/**
 * Troisième volet (#909) : la comparaison `.label === label` d'un résolveur (`findCreature`,
 * `findSpell`…) vit DANS `src/data/index.ts`, seul fichier où la doctrine la tolère — les deux
 * premiers volets ne voient QUE cette comparaison textuelle, pas le fait d'INVOQUER un tel
 * résolveur hors de la couture. Reconnaissance : voir l’en-tête de `scanLabelResolverCalls`
 * (`labelLogic.mjs`) ; ses appels hors couture sont des dettes au stock `DETTES_DE_LIBELLE`.
 */
describe('garde-fou « appel à un résolveur d’entité par LIBELLÉ » (#909)', () => {
  const RESOLVER_NAMES = collectLabelEntityResolvers(readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8'));

  it('src/data/index.ts porte au moins un résolveur reconnu', () => {
    expect(RESOLVER_NAMES.size, 'aucun résolveur reconnu : le volet est devenu muet').toBeGreaterThan(0);
  });

  it('collectLabelEntityResolvers : reconnaît les TROIS formes d’un résolveur par libellé (#909, #1924)', () => {
    const src = [
      'export function findMachin(label: string): MachinData | undefined { return undefined; }',
      'export const findBidule = (label: string): BiduleData | undefined => undefined;',
      'export function machinIdByLabel(label: string): string { return label; }',
      "const trucParLabel = indexParChamp('trucs', trucs, (t) => t.label);",
      'export const findTruc: (label: string) => TrucData | undefined = trucParLabel;',
      // Contre-épreuves : paramètre `label` mais ni retour `XxxData` ni nom `…By…Label` —
      // et fonction NON exportée (résolveur privé, pas la surface publique du fichier).
      'export function charKeyOf(label: string): string { return label; }',
      'function privateFind(label: string): MachinData | undefined { return undefined; }',
    ].join('\n');
    expect([...collectLabelEntityResolvers(src)].sort()).toEqual(['findBidule', 'findMachin', 'findTruc', 'machinIdByLabel']);
  });

  it('scanLabelResolverCalls : détecte l’appel BARE, ignore un nom SHADOWÉ localement', () => {
    const resolverNames = new Set(['findCreature']);
    const bad = "const c = findCreature('Orc');";
    expect(scanLabelResolverCalls('fixture.ts', bad, resolverNames).map((f) => f.rule)).toEqual(['label-entity-resolver-call']);

    // Shadowing local (`collectDeclaredNames`) : le fichier définit SA PROPRE `findCreature` — son
    // appel vise la locale, pas le résolveur de `src/data/index.ts`.
    const shadowed = 'function findCreature(id: string) { return id; }\nconst c = findCreature(x);';
    expect(scanLabelResolverCalls('fixture.ts', shadowed, resolverNames)).toEqual([]);
  });

});

/**
 * FACE D'AFFICHAGE en position d'IDENTITÉ (#1988 §7) — une fonction exportée de `src/` au retour DÉCLARÉ
 * `PlayerText` rend un texte montré au joueur, qui change avec la langue : il ne sert ni de clé, ni
 * d'opérande de comparaison, ni d'argument de recherche (b). Une face de `src/data/**` qui lit `.label`
 * naît `PlayerText` (c), et ses liants vivent au catalogue (d). Cible 0 ; coutures AU SITE par
 * `RATCHET_EXCEPTIONS` (« coutures légitimes » ci-dessus), dettes au stock `DETTES_DE_LIBELLE`.
 */
describe('garde de FACE D’AFFICHAGE (#1988 §7)', () => {
  const FACES = new Map([['trappingRefLabel', 'src/data/index.ts'], ['t', 'src/i18n/index.ts'], ['specLabel', 'src/data/index.ts']]);
  const identite = (src: string, rel = 'src/ui/sonde.tsx') => scanFaceDAffichageIdentite(rel, src, FACES).map((f) => f.line);

  it('les faces sont COLLECTÉES par leur type de retour, sur le corpus de la garde', () => {
    const faces = collectFacesDAffichage(corpusDeLaGarde());
    for (const f of ['t', 'dataLabel', 'refLabel', 'trappingRefLabel', 'mutationTablePlayerLabel', 'specLabel', 'conditionLabel']) {
      expect(faces.has(f), `la face \`${f}\` doit être COLLECTÉE par son type de retour`).toBe(true);
    }
  });

  it('(b) chaque position d’identité est vue : clé calculée, index, égalité, `in`, `switch`, méthodes de clé', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'export const a = { ...choices, [trappingRefLabel(ref)]: v };',
      'export const b = choices[trappingRefLabel(ref)];',
      'export const c = trappingRefLabel(ref) === x;',
      'export const d = trappingRefLabel(ref) in choices;',
      'switch (trappingRefLabel(ref)) { default: break; }',
      'export const e = xs.includes(trappingRefLabel(ref));',
      'export const f = m.get(trappingRefLabel(ref));',
      'm.set(trappingRefLabel(ref), 1);',
    ].join('\n');
    expect(identite(src)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('(b) ALIAS suivi, import RENOMMÉ suivi ; nom de face MASQUÉ par une liaison locale ignoré', () => {
    const src = [
      'import { t as tr } from "../i18n";',
      'const k = tr("ref.ou");',
      'export const a = choices[k];',
      'export const b = xs.find((t) => t === y);',
      'export function c(t: string) { return m[t]; }',
    ].join('\n');
    expect(identite(src)).toEqual([3]);
  });

  it('(b) une méthode qui GARDE le texte reste la face : casse, blancs, forme Unicode, `String()`', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'import { t } from "../i18n";',
      'export const a = trappingRefLabel(r).toLowerCase() === y;',
      'export const b = m[trappingRefLabel(r).trim()];',
      'export const c = m[String(trappingRefLabel(r))];',
      "export const d = x === t('k').normalize().toUpperCase();",
    ].join('\n');
    expect(identite(src)).toEqual([3, 4, 5, 6]);
  });

  it('(b) positions de PRÉDICAT : receveur de méthode de texte, argument de `RegExp#test`, paire d’une table', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      "export const e = trappingRefLabel(r).includes('x');",
      "export const f = trappingRefLabel(r).startsWith('x');",
      "export const g = trappingRefLabel(r).endsWith('x');",
      'export const h = trappingRefLabel(r).match(/x/);',
      'export const i = trappingRefLabel(r).search(/x/);',
      'export const j = /x/.test(trappingRefLabel(r));',
      'export const k = new Map(xs.map((x) => [trappingRefLabel(x), x]));',
      'export const l = Object.fromEntries(xs.map((x) => [trappingRefLabel(x), 1]));',
      "export const n = [trappingRefLabel(r), 'x'].join(' ');",
    ].join('\n');
    expect(identite(src)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('(b) ALIAS par affectation (`let`) et TRANSITIF ; une ré-affectation à un id le libère', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'let u; u = trappingRefLabel(r); export const n = m[u];',
      'const v = trappingRefLabel(r); const w = v; export const o = m[w];',
      "let q = trappingRefLabel(r); q = 'id'; export const p = m[q];",
    ].join('\n');
    expect(identite(src)).toEqual([2, 3]);
  });

  it('(b) HORS du volet : l’affichage, l’attribut JSX `key=`, et un appel de fonction non-face', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'export const a = <li key={trappingRefLabel(ref)}>{trappingRefLabel(ref)}</li>;',
      'export const b = `${trappingRefLabel(ref)} (3)`;',
      'export const c = choices[refKey(id, spec)];',
    ].join('\n');
    expect(identite(src)).toEqual([]);
  });

  it('(c) une export de `src/data/**` qui lit `.label` et rend `string`, déclaré ou INFÉRÉ, est refusée ; `PlayerText`, un type déclaré, ou hors `data/` passe', () => {
    const src = [
      'export function a(id: string): string { return find(id)?.label ?? id; }',
      'export const b = (id: string): string => find(id)?.label ?? id;',
      'export function c(id: string): PlayerText { return dataLabel(find(id)?.label, id); }',
      'export function d(id: string): string { return find(id)?.id ?? id; }',
      'export function e(id: string) { return find(id)?.label ?? id; }',
      'export const g = (id: string) => find(id)?.label;',
      'export function h(label: string): SkillData | undefined { return xs.find((s) => s.label === label); }',
    ].join('\n');
    expect(scanFaceDeDonneeString('src/data/sonde.ts', src).map((f) => f.face)).toEqual(['a', 'b', 'e', 'g']);
    expect(scanFaceDeDonneeString('src/ui/sonde.ts', src)).toEqual([]);
  });

  it('(d) liant littéral d’au moins deux lettres dans une face de `data/index.ts` ; clé, id et opérande passent', () => {
    const src = [
      'export function a(xs: string[]): PlayerText { return dataLabel(xs.join(" ou ")); }',
      'export function b(n: number): PlayerText { const s = `${n} parmi : x`; return dataLabel(s); }',
      'export function c(r: R): PlayerText { return r.w === "arme" ? t("ref.armeAuChoix") : refLabel("skills", r); }',
      'export function d(r: R): PlayerText { return "choice" in r ? t(`absent.${r.n}`) : dataLabel(r.l); }',
      'export function e(r: R): string { return r.l + " ou "; }',
      'function f(xs: string[]): PlayerText { return dataLabel(xs.join(" ou ")); }',
    ].join('\n');
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', src).map((f) => `${f.face}:${f.line}`)).toEqual(['a:1', 'b:2', 'f:6']);
    expect(scanLiantsLitterauxDesFaces('src/data/autre.ts', src)).toEqual([]);
  });

  it('MUTATION (d) sur la face RÉELLE : réintroduire `\' ou \'` dans `trappingRefLabel` rougit', () => {
    const reel = readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8');
    const site = 'if (\'choice\' in ref) return ouListe(ref.choice.map(trappingRefLabel));';
    expect(reel, 'le site de la mutation a bougé : re-pointer ce test').toContain(site);
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', reel)).toEqual([]);
    const mute = reel.replace(site, 'if (\'choice\' in ref) return dataLabel(ref.choice.map(trappingRefLabel).join(\' ou \'));');
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', mute).map((f) => f.face)).toEqual(['trappingRefLabel']);
  });
});
