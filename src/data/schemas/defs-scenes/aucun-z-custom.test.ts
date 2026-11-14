/**
 * Garde : AUCUN `z.custom` dans `defs-scenes/` (#1466, #4171).
 *
 * Un `z.custom<T>()` accepte tout au runtime : il ne tient que le type TypeScript, et le document mal
 * formé passe la porte. Le répertoire n'en porte aucun ; un site neuf est ROUGE et se NOMME.
 *
 * En-tête structuré `GARDE` (#1475) : la garde se déclare elle-même, et un test tient cette
 * déclaration — angles morts compris.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { estFichierVitest, estKitDeTest } from '../../../../scripts/guards/lib/fichierVitest.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GARDE = {
  question:
    'A — quelles portes de `defs-scenes/` n’en sont pas (un `z.custom<T>()` ne tient que le type TS, ' +
    'le document mal formé passe) ? B — chacune est-elle NOMMÉE par son fichier et son symbole ? ' +
    'C — le répertoire n’en porte-t-il aucune ?',
  primitive:
    'scan TEXTUEL du motif `z.custom` ligne à ligne (`sitesZCustom(dir)`), clé `<fichier>:<symbole exporté ' +
    'ou champ porteur>` — le `dir` est un PARAMÈTRE : la garde est jouable sur un répertoire-jouet, donc ' +
    'sa propre mutation est testable.',
  perimetre:
    'les `*.ts` de PRODUCTION du seul répertoire `src/data/schemas/defs-scenes/` (`listerDossier(__dirname)`, ' +
    'non récursif).',
  angleMort: [
    'un `z.custom` ALIASÉ (`const c = z.custom; c<T>()`) ou ré-exporté depuis un autre module échappe au ' +
      'scan textuel : le motif, pas le symbole résolu.',
    'les INSTRUMENTS Vitest (`*.test.ts`, `*.bench.ts`) et les kits de test sont exclus — le trou qu’on tient est celui des SCHÉMAS servis à la porte, ' +
      'pas des fixtures.',
    'le PÉRIMÈTRE est le RÉPERTOIRE : les autres répertoires de schémas (`grammaire/**`, `defs/**`) sont ' +
      'HORS garde — 0 site `z.custom` y est mesuré aujourd’hui (relevé du juge, 2026-08-24), un trou qui ' +
      'y naîtrait serait donc INVISIBLE ici et exige d’étendre ce périmètre.',
    'le scan ignore les lignes de COMMENTAIRE : un `z.custom` posé en fin de ligne après du code commenté lui échappe.',
  ],
  ticket: '#1466',
} as const;

/** Sites `z.custom` d'un répertoire de schémas : `<fichier>:<symbole exporté ou champ porteur>`, dans
 *  l'ordre du scan. `dir` est paramétré : la garde se joue aussi sur un répertoire-jouet (câblage). */
function sitesZCustom(dir: string): string[] {
  const out: string[] = [];
  for (const f of listerDossier(dir).filter((n) => n.endsWith('.ts') && !estFichierVitest(n) && !estKitDeTest(n))) {
    readFileSync(join(dir, f), 'utf8')
      .split(/\r?\n/)
      .forEach((ligne) => {
        if (!ligne.includes('z.custom')) return;
        if (/^\s*(\/\/|\/?\*)/.test(ligne)) return; // ligne de COMMENTAIRE
        // Le champ porteur d'un `z.custom` inline, nu (`objets: z.custom…`) ou élément d'une fabrique de
        // liste (`objets: listeCle(z.custom…)`).
        const nomme = /export\s+const\s+(\w+)\s*=/.exec(ligne) ?? /(\w+)\s*:\s*(?:\w+\()?z\./.exec(ligne);
        out.push(`${f}:${nomme ? nomme[1] : '<site non nommé>'}`);
      });
  }
  return out;
}

describe('garde « aucun `z.custom` » — en-tête structuré (#1475)', () => {
  it('la garde se déclare : question A→B→C, primitive, périmètre, angles morts, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('z.custom');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER le répertoire scanné.').toContain('defs-scenes');
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    expect(
      GARDE.angleMort.some((a) => /grammaire|defs\/\*\*/.test(a)),
      'l’angle mort de PÉRIMÈTRE-RÉPERTOIRE doit être déclaré nommément.',
    ).toBe(true);
    expect(GARDE.ticket).toBe('#1466');
  });
});

describe('`z.custom` de defs-scenes', () => {
  it('AUCUN `z.custom` — un site neuf est ROUGE et NOMMÉ', () => {
    const sites = sitesZCustom(__dirname);
    expect(sites, `\`z.custom\` dans defs-scenes :\n${sites.join('\n')}`).toEqual([]);
  });

  it('la garde elle-même, jouée sur un répertoire-jouet : un `z.custom` de production est vu et nommé, un instrument Vitest non', () => {
    const jouet = mkdtempSync(join(tmpdir(), 'z-custom-jouet-'));
    try {
      writeFileSync(join(jouet, 'zzz-neuf.ts'), "import { z } from 'zod';\nexport const zzzSchema = z.custom<unknown>();\n");
      writeFileSync(join(jouet, 'zzz-fixture.test.ts'), "export const ignore = 'z.custom';\n");
      expect(sitesZCustom(jouet)).toEqual(['zzz-neuf.ts:zzzSchema']);
    } finally {
      rmSync(jouet, { recursive: true, force: true });
    }
  });
});
