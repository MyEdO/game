/**
 * CLIQUET des trous de validation de `defs-scenes/` (#1466 L1a T3-c).
 *
 * Un `z.custom<T>()` accepte tout au runtime : c'est un trou déclaré, pas un schéma. Le contrat est
 * BIDIRECTIONNEL — aucun site hors `TROUS_DE_VALIDATION` (un trou neuf est ROUGE et se NOMME), et
 * aucune entrée sans site (la liste DÉCROÎT : le commit qui écrit le schéma retire l'entrée).
 *
 * En-tête structuré `GARDE` (#1475) : la garde se déclare elle-même, et un test tient cette
 * déclaration — angles morts compris.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { estFichierVitest } from '../../../../scripts/guards/lib/fichierVitest.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TROUS_DE_VALIDATION } from './trous-de-validation';

const GARDE = {
  question:
    'A — quelles portes de `defs-scenes/` n’en sont pas (un `z.custom<T>()` ne tient que le type TS, ' +
    'le document mal formé passe) ? B — chacune est-elle DÉCLARÉE avec sa raison mesurée et son lot de ' +
    'mort ? C — la liste ne peut-elle que DÉCROÎTRE (aucun trou neuf hors liste, aucune entrée sans site) ?',
  primitive:
    'scan TEXTUEL du motif `z.custom` ligne à ligne (`sitesZCustom(dir)`), clé `<fichier>:<symbole exporté ' +
    'ou champ porteur>` — le `dir` est un PARAMÈTRE : le cliquet est jouable sur un répertoire-jouet, donc ' +
    'sa propre mutation est testable.',
  perimetre:
    'les `*.ts` de PRODUCTION du seul répertoire `src/data/schemas/defs-scenes/` (`listerDossier(__dirname)`, ' +
    'non récursif).',
  angleMort: [
    'un `z.custom` ALIASÉ (`const c = z.custom; c<T>()`) ou ré-exporté depuis un autre module échappe au ' +
      'scan textuel : le motif, pas le symbole résolu.',
    'les INSTRUMENTS Vitest (`*.test.ts`, `*.bench.ts`) sont exclus — le trou qu’on tient est celui des SCHÉMAS servis à la porte, ' +
      'pas des fixtures.',
    'le PÉRIMÈTRE est le RÉPERTOIRE : les autres répertoires de schémas (`grammaire/**`, `defs/**`) sont ' +
      'HORS cliquet — 0 site `z.custom` y est mesuré aujourd’hui (relevé du juge, 2026-08-24), un trou qui ' +
      'y naîtrait serait donc INVISIBLE ici et exige d’étendre ce périmètre.',
    'le scan ignore les lignes de COMMENTAIRE (la liste se cite elle-même) : un `z.custom` posé en fin de ' +
      'ligne après du code commenté lui échappe.',
  ],
  baseline: {
    fichier: 'trous-de-validation.ts',
    decroissant: true,
    raison:
      'Les 4 entrées sont le dénominateur des trous de `defs-scenes/` : chacune meurt par le commit qui ÉCRIT ' +
      'le schéma de sa forme, dans le lot nommé par son champ `lot` (`L2 #1463` / `L3 #1463`, soldables par ' +
      'grep du lot). Une entrée neuve est une dérive, jamais une exception à inscrire.',
  },
  ticket: '#1466',
} as const;

/** Répertoire des schémas `defs-scenes/` — périmètre par DÉFAUT du cliquet. */
const DEFS_SCENES = __dirname;

/** Sites `z.custom` d'un répertoire de schémas : `<fichier>:<symbole exporté ou champ porteur>`, dans
 *  l'ordre du scan. `dir` est paramétré : le cliquet se joue aussi sur un répertoire-jouet (câblage). */
function sitesZCustom(dir: string): string[] {
  const out: string[] = [];
  for (const f of listerDossier(dir).filter((n) => n.endsWith('.ts') && !estFichierVitest(n))) {
    readFileSync(join(dir, f), 'utf8')
      .split(/\r?\n/)
      .forEach((ligne) => {
        if (!ligne.includes('z.custom')) return;
        if (/^\s*(\/\/|\/?\*)/.test(ligne)) return; // ligne de COMMENTAIRE (la liste se cite elle-même)
        // Le champ porteur d'un `z.custom` inline, nu (`objets: z.custom…`) ou élément d'une fabrique de
        // liste (`objets: listeCle(z.custom…)`).
        const nomme = /export\s+const\s+(\w+)\s*=/.exec(ligne) ?? /(\w+)\s*:\s*(?:\w+\()?z\./.exec(ligne);
        out.push(`${f}:${nomme ? nomme[1] : '<site non nommé>'}`);
      });
  }
  return out;
}

describe('garde des trous de validation — en-tête structuré (#1475)', () => {
  it('la garde se déclare : question A→B→C, primitive, périmètre, angles morts, baseline décroissante, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('z.custom');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER le répertoire scanné.').toContain('defs-scenes');
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    expect(
      GARDE.angleMort.some((a) => /grammaire|defs\/\*\*/.test(a)),
      'l’angle mort de PÉRIMÈTRE-RÉPERTOIRE doit être déclaré nommément.',
    ).toBe(true);
    expect(GARDE.baseline).toMatchObject({ fichier: 'trous-de-validation.ts', decroissant: true });
    expect(GARDE.ticket).toBe('#1466');
  });
});

describe('`z.custom` de defs-scenes — liste nominative datée, DÉCROISSANTE', () => {
  const sites = sitesZCustom(DEFS_SCENES);

  it('le scan VOIT des sites (un scan aveugle rendrait le cliquet vacueux)', () => {
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((s) => !s.endsWith('<site non nommé>'))).toBe(true);
  });

  it('AUCUN `z.custom` hors liste — un trou neuf est ROUGE et NOMMÉ', () => {
    const horsListe = sites.filter((s) => !(s in TROUS_DE_VALIDATION));
    expect(horsListe, `\`z.custom\` non déclaré(s) dans TROUS_DE_VALIDATION :\n${horsListe.join('\n')}`).toEqual([]);
  });

  it('AUCUNE entrée sans site — la liste ne peut que DÉCROÎTRE', () => {
    const orphelines = Object.keys(TROUS_DE_VALIDATION).filter((k) => !sites.includes(k));
    expect(orphelines, `Entrée(s) de TROUS_DE_VALIDATION sans \`z.custom\` correspondant :\n${orphelines.join('\n')}`).toEqual([]);
  });

  it('chaque entrée porte sa RAISON et son LOT de mort (une liste sans échéance est un régime)', () => {
    const muettes = Object.entries(TROUS_DE_VALIDATION)
      .filter(([, v]) => !v.raison?.trim() || !v.lot?.trim())
      .map(([k]) => k);
    expect(muettes, `Entrée(s) sans raison ou sans lot :\n${muettes.join('\n')}`).toEqual([]);
  });

  it('chaque `lot` porte le JETON du stock du chantier (`L2 #1463` / `L3 #1463`) — un solde par grep du lot les trouve', () => {
    const horsGraphie = Object.entries(TROUS_DE_VALIDATION)
      .filter(([, v]) => !/^L[23] #1463 — /.test(v.lot))
      .map(([k, v]) => `${k} → « ${v.lot.slice(0, 40)}… »`);
    expect(horsGraphie, `Entrée(s) dont le \`lot\` n'est pas à la graphie du stock :\n${horsGraphie.join('\n')}`).toEqual([]);
  });
});

describe('le cliquet lui-même — joué sur un répertoire-jouet (preuve de câblage)', () => {
  it('un `z.custom` NON déclaré est vu hors liste ; un site DISPARU laisse son entrée orpheline', () => {
    const jouet = mkdtempSync(join(tmpdir(), 'trous-jouet-'));
    try {
      writeFileSync(join(jouet, 'zzz-neuf.ts'), "import { z } from 'zod';\nexport const zzzSchema = z.custom<unknown>();\n");
      writeFileSync(join(jouet, 'zzz-fixture.test.ts'), "export const ignore = 'z.custom';\n");
      const sitesJouet = sitesZCustom(jouet);
      expect(sitesJouet).toEqual(['zzz-neuf.ts:zzzSchema']); // le `*.test.ts` est bien hors périmètre
      expect(sitesJouet.filter((s) => !(s in TROUS_DE_VALIDATION))).toEqual(['zzz-neuf.ts:zzzSchema']);
      expect(Object.keys(TROUS_DE_VALIDATION).filter((k) => !sitesJouet.includes(k))).toHaveLength(
        Object.keys(TROUS_DE_VALIDATION).length,
      );
    } finally {
      rmSync(jouet, { recursive: true, force: true });
    }
  });
});
