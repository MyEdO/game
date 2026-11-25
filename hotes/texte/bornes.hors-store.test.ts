/**
 * LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) : chaque sortie tient ses lignes ET ses caractères (`BORNES`), sur
 * `siege-enceinte` (23 combattants) ; un jeu joue le même parcours (`bornes.testkit.ts`) sur ses scénarios, dans sa
 * suite. Les outils passent par l'hôte sur un disque en mémoire
 * (`hote.testkit.ts`), tels que le serveur MCP les appelle.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fermerLaTable, table, verbe } from './hote.testkit';
import { lesBornesDuCombat, tientSesBornes } from './bornes.testkit';

afterEach(fermerLaTable);

describe('les bornes de sortie sur `siege-enceinte`', () => {
  it('nouvelle, jouer, vue, offres, carte, cases, fiche et journal tiennent leurs bornes', { timeout: 240_000 }, () => {
    lesBornesDuCombat(table(), 'siege-enceinte');
  });
});

describe('les bornes des sorties de l’exploration, des verbes et du journal', () => {
  it('`verbes`, `carte` et `vue` en exploration tiennent leurs bornes', { timeout: 120_000 }, () => {
    const t = table();
    tientSesBornes('verbes', 'verbes', t.lire('verbes'));
    tientSesBornes('verbes depuis 80', 'verbes', t.lire('verbes', { depuis: 80 }));
    tientSesBornes('verbes fenetreChoisir', 'verbes', t.lire('verbes', { id: 'fenetreChoisir' }));
    tientSesBornes('nouvelle', 'nouvelle', t.nouvelle('fenetre-ecuries'));
    tientSesBornes('carte', 'carte', t.lire('carte'));
    tientSesBornes('vue', 'vue', t.lire('vue'));
  });
  it('une erreur tient ses bornes, sur les verbes aux formes les plus larges (`fenetreChoisir`, `partirEnVoyage`, `jouerALaTaverne`)', { timeout: 120_000 }, () => {
    const t = table();
    expect(t.nouvelle('dome').erreur).toBeNull();
    for (const nom of ['fenetreChoisir', 'partirEnVoyage', 'jouerALaTaverne']) {
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
