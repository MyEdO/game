/**
 * GARDE DE VERBATIM — `tavernGames.json` `desc` ↔ `Source/` (AGENTS.md règle 5,
 * formatage Markdown CONSERVÉ).
 *
 * Le défaut que cette garde ferme est une CLASSE, mesurée sur le stock (#1279 S4-a) : trois entrées
 * avaient perdu le Markdown de la source en cours de route (`**Pari Accessible (+20)**` rendu en
 * texte nu, `*Exténué*` en texte nu) sans qu'aucun test ne s'en aperçoive — le schéma valide la FORME
 * d'une `desc`, jamais sa FIDÉLITÉ. Rien ne reliait la donnée à son texte.
 *
 * MÉTHODE : chaque `desc` doit être le bloc « **Jeu :** » d'une section du chapitre, à l'étiquette
 * près. Une seule tolérance, et elle est STRUCTURELLE, jamais une réécriture : Marker coupe un
 * paragraphe qui franchit une frontière de page et insère l'ancre de folio au début de la
 * continuation — le paragraphe se RECOLLE donc par-dessus l'ancre (un seul cas dans ce chapitre,
 * l'Alvatafl, dont la règle enjambe les folios 91→92). Aucun caractère n'est réécrit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAVERN_GAMES } from '../engine/tavernGame';

const CHAPITRE = 'Source/Warhammer v4 - Nuits agitees & dures journees/16 - JEUX DE TAVERNE.md';

/** Les blocs « Jeu : » du chapitre, étiquette retirée. Deux formes : la ligne telle quelle, et la
 *  ligne RECOLLÉE par-dessus les ancres de folio qui la coupent (`<span … data-folio>` en tête de la
 *  continuation, séparée par des lignes vides). */
function blocsDeJeu(): { brut: string[]; recolle: string[] } {
  const L = readFileSync(CHAPITRE, 'utf8').split('\n');
  const brut: string[] = [];
  const recolle: string[] = [];
  L.forEach((l, i) => {
    if (!l.startsWith('**Jeu :**')) return;
    const tete = l.replace(/^\*\*Jeu :\*\* /, '');
    brut.push(tete);
    let suite = tete;
    for (let k = i + 1; k < L.length; k++) {
      if (!L[k].trim()) continue;
      const m = /^<span[^>]*data-folio[^>]*><\/span>(.*)$/.exec(L[k]);
      if (!m) break;
      // La ligne coupée conserve son espace de fin : recoller en ajoutant un second le doublerait.
      suite = `${suite.replace(/\s+$/, '')} ${m[1]}`;
    }
    recolle.push(suite);
  });
  return { brut, recolle };
}

describe('tavernGames.json — chaque `desc` est le VERBATIM de sa règle dans Source/ (règle 5)', () => {
  const { brut, recolle } = blocsDeJeu();

  // Le catalogue est un SOUS-ENSEMBLE du chapitre tant que des jeux restent à ingérer : ce test
  // NOMME ce qui manque, de sorte que l’ingestion d’un jeu se voie ici (la liste doit décroître).
  it('les jeux du chapitre encore ABSENTS du catalogue sont nommés (#1279 S4-a, dette de vocabulaire)', () => {
    // Un bloc est INGÉRÉ si une desc lui est égale, ou le prolonge (cas du paragraphe recollé).
    const ingere = (b0: string) => TAVERN_GAMES.some((g) => g.desc === b0 || g.desc.startsWith(b0.replace(/\s+$/, '')));
    const absents = brut.filter((b0) => !ingere(b0));
    expect(brut.length - TAVERN_GAMES.length).toBe(2);
    expect(absents.map((a0) => a0.slice(0, 45))).toEqual([
      'la partie se joue en 7 tours. À chaque tour, ',   // QUESTIONS - RÉPONSES
      'tous les participants placent une mise dans l',   // L’IMPÉRATRICE ÉCARLATE
    ]);
  });

  for (const g of TAVERN_GAMES) {
    it(`${g.id} : desc byte-identique au bloc « Jeu : » du chapitre`, () => {
      const trouve = brut.includes(g.desc) || recolle.includes(g.desc);
      // L'échec doit MONTRER l'écart, pas dire « false ».
      if (!trouve) {
        const nu = (s: string) => s.replace(/\*/g, '');
        const proche = [...brut, ...recolle].find((c) => nu(c) === nu(g.desc));
        expect.fail(
          proche
            ? `Markdown PERDU (règle 5 : le formatage est conservé).\nSource : ${proche}\nDonnée : ${g.desc}`
            : `aucun bloc « Jeu : » du chapitre ne correspond à la desc de ${g.id}.\nDonnée : ${g.desc}`,
        );
      }
      expect(trouve).toBe(true);
    });
  }

  it('le RECOLLAGE par-dessus une ancre de folio ne sert qu’aux règles qui enjambent une page', () => {
    // Il est structurel et rare : le mesurer empêche qu'il devienne une tolérance fourre-tout qui
    // masquerait une vraie divergence.
    const parRecollage = TAVERN_GAMES.filter((g) => !brut.includes(g.desc) && recolle.includes(g.desc));
    expect(parRecollage.map((g) => g.id)).toEqual(['alvatafl']);
  });
});
