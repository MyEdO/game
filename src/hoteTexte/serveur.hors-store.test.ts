/**
 * LE SERVEUR MCP DE L'HÔTE TEXTE (#2898 lot D), en sous-processus, par le client du SDK : le lanceur
 * (`scripts/hote-texte.mjs`) annonce ses trois outils et ses instructions, joue une suite de gestes sur le combat d'arène
 * committé (`combat-dome.jsonl`) et l'écrit au fichier ; un second serveur, sur la même partie, se voit refuser la main
 * tant que le premier la tient, puis rejoue le fichier et rend la même vue. Un argument hors schéma est une erreur
 * d'outil, nommée. stdout ne porte que le protocole : le client échoue sur toute autre ligne.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const LANCEUR = join(RACINE, 'scripts/hote-texte.mjs');
let dossier: string;

/** Un client connecté à un serveur neuf, ses parties dans `dossier`. */
async function serveur(): Promise<Client> {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [LANCEUR], env: { ...process.env, HOTE_TEXTE_PARTIES: dossier } as Record<string, string>, stderr: 'ignore' }));
  return client;
}

type Resultat = { content: { type: string; text: string }[]; isError?: boolean; structuredContent?: unknown };
const appeler = async (client: Client, name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as Resultat;

beforeAll(() => {
  dossier = mkdtempSync(join(tmpdir(), 'hote-texte-'));
  copyFileSync(join(RACINE, 'src/hoteTexte/combat-dome.jsonl'), join(dossier, 'combat.jsonl'));
});
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

describe('le serveur MCP de l’hôte texte', () => {
  it('trois outils ; une suite de gestes s’écrit ; un second serveur attend la main, puis rejoue la même vue', { timeout: 240_000 }, async () => {
    const premier = await serveur();
    try {
      expect((await premier.listTools()).tools.map((t) => t.name).sort()).toEqual(['jouer', 'lire', 'nouvelle']);
      expect(premier.getInstructions()).toMatch(/\.hote-texte\/<nom>\.jsonl/);

      const lignes = readFileSync(join(dossier, 'combat.jsonl'), 'utf8').trimEnd().split('\n').length;
      const charge = await appeler(premier, 'jouer', { partie: 'combat', gestes: [{ offre: 'charge' }] });
      expect(charge.isError, charge.content[0].text).toBeFalsy();
      expect(readFileSync(join(dossier, 'combat.jsonl'), 'utf8').trimEnd().split('\n'), 'la Charge appliquée n’est pas écrite').toHaveLength(lignes + 1);

      const horsSchema = await appeler(premier, 'jouer', { partie: 'combat', gestes: [{ verbe: 'attackRoll', cible: 'x' }] });
      expect(horsSchema.isError).toBe(true);
      expect(horsSchema.content[0].text).toMatch(/Input validation error/);

      const second = await serveur();
      try {
        const tenue = await appeler(second, 'lire', { quoi: 'vue', partie: 'combat' });
        expect(tenue.isError).toBe(true);
        expect(tenue.content[0].text).toMatch(/^erreur permission : la partie combat est tenue par le processus \d+/);
        const vuePremier = await appeler(premier, 'lire', { quoi: 'vue' });
        await premier.close();
        const vue = await appeler(second, 'lire', { quoi: 'vue', partie: 'combat' });
        expect(vue.isError, vue.content[0].text).toBeFalsy();
        expect(vue.content[0].text, 'deux rejeux, deux vues').toBe(vuePremier.content[0].text);
        expect(vue.structuredContent, 'le texte seul porte la réponse').toBeUndefined();
        expect(vue.content[0].text, 'le second serveur ne voit pas la Charge armée').toMatch(/intention armée : charge/);
        // Les tours de l'IA du Round 1 ne se jouent que par la reprise des jetons : sans elle, aucun Round 2.
        expect(vue.content[0].text, 'les jetons ne sont pas repris : le combat n’a pas avancé').toMatch(/^R2 /);
      } finally {
        await second.close();
      }
    } finally {
      await premier.close();
    }
  });
});
