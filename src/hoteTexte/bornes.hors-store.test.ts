/**
 * LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) : chaque sortie tient ses lignes ET ses caractères (`BORNES`), sur le
 * pire scénario mesuré (`ecuries-clayonnage` : 673 combattants, une ligne de cibles de 13 649 caractères avant les
 * bornes) et sur `siege-enceinte` (23 combattants). Les outils passent par l'hôte sur un disque en mémoire
 * (`hote.testkit.ts`), tels que le serveur MCP les appelle.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { BORNES, caracteresAuPlus, type Commande } from './vue';
import { fermerLaTable, table, verbe } from './hote.testkit';
import type { Reponse } from './serveur';

afterEach(fermerLaTable);

/** Le texte d'une réponse tient ses bornes : lignes, largeur de chaque ligne, caractères. */
function tientSesBornes(nom: string, commande: Commande, r: Reponse, erreur = false) {
  expect(r.erreur !== null, `${nom} : ${r.texte}`).toBe(erreur);
  const lignes = r.texte.split('\n');
  expect(lignes.length, `${nom} : lignes\n${r.texte}`).toBeLessThanOrEqual(BORNES.lignes[commande]);
  expect(Math.max(...lignes.map((l) => l.length)), `${nom} : la ligne la plus longue`).toBeLessThanOrEqual(BORNES.largeur);
  expect(r.texte.length, `${nom} : caractères`).toBeLessThanOrEqual(caracteresAuPlus(commande));
}

describe.each(['ecuries-clayonnage', 'siege-enceinte'])('les bornes de sortie sur `%s`', (scenario) => {
  it('nouvelle, jouer, vue, offres, carte, cases, fiche et journal tiennent leurs bornes', { timeout: 240_000 }, () => {
    const t = table();
    tientSesBornes('nouvelle', 'nouvelle', t.nouvelle(scenario, { graine: 7 }));
    tientSesBornes('confirmRoundStart', 'jouer', t.jouer(verbe('confirmRoundStart')));
    const vue = t.lire('vue');
    tientSesBornes('vue', 'vue', vue);
    expect(vue.texte, 'témoin : la vue est celle d’un tour de combat').toMatch(/^R1 tour \d+\/\d+ · actif /);
    tientSesBornes('offres', 'offres', t.lire('offres'));
    tientSesBornes('offres toutes', 'offres', t.lire('offres', { toutes: true }));
    tientSesBornes('carte', 'carte', t.lire('carte'));
    tientSesBornes('carte depuis 15', 'carte', t.lire('carte', { depuis: 15 }));
    tientSesBornes('journal', 'journal', t.lire('journal'));
    tientSesBornes('cases', 'cases', t.lire('cases'));
    const actif = /^R1 tour \d+\/\d+ · actif (\S+) /.exec(vue.texte)![1];
    tientSesBornes('fiche', 'fiche', t.lire('fiche', { id: actif }));
    tientSesBornes('offre end-turn', 'jouer', t.jouer({ offre: 'end-turn' }));
  });
});

describe('les bornes des sorties de l’exploration, des verbes et du journal', () => {
  it('`verbes`, `carte` et `vue` en exploration tiennent leurs bornes', { timeout: 120_000 }, () => {
    const t = table();
    tientSesBornes('verbes', 'verbes', t.lire('verbes'));
    tientSesBornes('verbes depuis 80', 'verbes', t.lire('verbes', { depuis: 80 }));
    tientSesBornes('verbes addPossession', 'verbes', t.lire('verbes', { id: 'addPossession' }));
    tientSesBornes('nouvelle', 'nouvelle', t.nouvelle('fenetre-ecuries'));
    tientSesBornes('carte', 'carte', t.lire('carte'));
    tientSesBornes('vue', 'vue', t.lire('vue'));
  });
  it('une erreur tient ses bornes, sur les verbes aux types les plus larges (`startCombat`, `setParty`)', { timeout: 120_000 }, () => {
    const t = table();
    expect(t.nouvelle('dome').erreur).toBeNull();
    for (const nom of ['startCombat', 'setParty', 'partyAddHero']) {
      const r = t.jouer(verbe(nom, 1));
      tientSesBornes(nom, 'jouer', r, true);
      expect(r.texte, `${nom} : l’erreur se replie, elle n’est pas coupée`).not.toMatch(/…$/m);
    }
  });
  it('le journal d’une défaite, aux entrées à saut de ligne, tient ses bornes page par page (`defaite-dome.jsonl`)', { timeout: 240_000 }, () => {
    const t = table(readFileSync(new URL('./defaite-dome.jsonl', import.meta.url), 'utf8'));
    for (const depuis of [0, 15, 30, 45, 60]) tientSesBornes(`journal depuis ${depuis}`, 'journal', t.lire('journal', { depuis }));
  });
});
