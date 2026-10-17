/**
 * #1659 L-1659-3 — le nom d'une SAISON vit dans la DONNÉE, une seule fois.
 *
 * La doctrine du dépôt (CLAUDE.md, « toute LOGIQUE est keyée par id STABLE — le `label` est de
 * l'AFFICHAGE ») : le libellé est authoré (`weather.json › seasons[].label`, éditable au Codex) et se
 * lit par `seasonLabel(id)` (`src/data/index.ts`), au même patron que `specLabel`/`refLabel`. Une
 * carte id→libellé en code fait ÉCRAN à la donnée : renommer au Codex ne changerait rien à l'écran.
 *
 * Ce que ce volet garde : plus aucun libellé de saison écrit EN DUR dans le code de production.
 *
 * COUVERTURE, et ses deux bords : (1) la marche ignore les lignes de COMMENTAIRE — une table du RAW
 * recopiée en JSDoc (`src/engine/travelStages.ts:74`, tableau de Météo EDOC 8) est une citation, pas
 * un libellé d'écran ; (2) elle ignore les fichiers de TEST, qui doivent pouvoir asserter le texte
 * RENDU — c'est là que les libellés attendus se vérifient (`src/ui/PlageField.test.tsx`).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { weather, seasonLabel } from './index';
import { setDataset } from './overrides';
import { schema as seaWeatherSchema } from './schemas/defs/sea-weather';
import { metaDesChamps } from './schemas/grammaire/meta';
import { descendre } from './schemas/grammaire/descente';

/** Les libellés que la donnée porte — cherchés tels qu'elle les écrit, jamais recopiés ici. */
const LIBELLES = weather.map((s) => s.label);

/** Une ligne de COMMENTAIRE ne pose aucun libellé à l'écran (citation de table RAW en JSDoc). */
const estCommentaire = (ligne: string) => /^\s*(\/\/|\/\*|\*)/.test(ligne);

describe('libellés de saison — une SOURCE, la donnée (#1659)', () => {
  it('la même méta saisonnière relit chaque libellé modifié dans le dataset', () => {
    const initiales = structuredClone(weather);
    let noeudSaisonnier: z.ZodObject | undefined;
    descendre([seaWeatherSchema], ({ noeud, path }) => {
      if (path === '.seasonMod' && noeud instanceof z.ZodObject) { noeudSaisonnier = noeud; return 'arreter'; }
    });
    expect(noeudSaisonnier).toBeDefined();
    if (!noeudSaisonnier) throw new Error('objet saisonnier absent du schéma maritime');
    const metas = metaDesChamps(noeudSaisonnier, { exigees: true });
    try {
      for (const saison of initiales) {
        const meta = metas[saison.id];
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.label).toBe(saison.label);
        const nouveauNom = `Saison éditée ${saison.id}`;
        setDataset('weather', initiales.map((s) => s.id === saison.id ? { ...s, label: nouveauNom } : s));
        expect(meta.label).toBe(nouveauNom);
        expect(seasonLabel(saison.id)).toBe(nouveauNom);
        expect(metaDesChamps(noeudSaisonnier, { exigees: true })[saison.id]).toBe(meta);
      }
    } finally {
      setDataset('weather', initiales);
    }
  });

  it('`seasonLabel` résout les quatre saisons par leur id STABLE', () => {
    expect(weather.map((s) => s.id)).toEqual(['printemps', 'ete', 'automne', 'hiver']);
    for (const s of weather) expect(seasonLabel(s.id)).toBe(s.label);
  });

  it('une saison INCONNUE est NOMMÉE, jamais rendue en silence', () => {
    expect(seasonLabel('vendemiaire')).toContain('vendemiaire');
  });

  it('aucun libellé de saison écrit EN DUR dans le code de production', () => {
    const sites: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      text.split('\n').forEach((ligne, i) => {
        if (estCommentaire(ligne)) return;
        for (const l of LIBELLES) if (ligne.includes(`'${l}'`) || ligne.includes(`"${l}"`)) sites.push(`${rel}:${i + 1} « ${l} »`);
      });
    }
    expect(
      sites,
      'un libellé de saison est écrit en dur : il vit dans `weather.json › seasons[].label` et se lit par `seasonLabel(id)` (`src/data/index.ts`) — une table d’écran en fait un second gisement, que la traduction et l’édition au Codex ne suivent pas.',
    ).toEqual([]);
  });
});
