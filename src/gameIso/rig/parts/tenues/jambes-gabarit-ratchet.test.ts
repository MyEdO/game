import { describe, it, expect } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_DEFS, sitesJambeInline } from '../../../../../scripts/guards/lib/jambesGabaritAudit';
import { JAMBE_INLINE_RATCHET, JAMBE_SILHOUETTE_OVERRIDES } from '../../../../../scripts/guards/lib/jambesGabaritStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../../../../scripts/guards/lib/stock.mjs';

/**
 * CLIQUET — migration de la jambe vers le GABARIT partagé (#633 Lot 0).
 *
 * Chaque tenue redessinait sa jambe INLINE, recopiant le défaut de galbe genou/mollet. Le gabarit
 * `jambeVetue` (`parts/bodies/jambe-gabarit.ts`) porte le contour + le galbe lissé UNE fois ; une
 * tenue le consomme (ou compose le corps via `BODIES.`).
 *
 * La MESURE vit dans `scripts/guards/lib/jambesGabaritAudit.ts` — partagée avec le régénérateur
 * `scripts/rig/regen-jambes-gabarit-stock.mts`, pour qu'aucun des deux n'ait sa propre lecture du
 * corpus. Le STOCK vit dans `scripts/guards/lib/jambesGabaritStock.mjs`, en entrées
 * `{ fichier, ref, occurrence }` : la forme UNIQUE du dépôt, celle que la porte de plage
 * (`croissanceDesStocks`) VOIT — un id nu (`'apothicaire'`) lui est invisible, un append ne coûte
 * alors rien.
 *
 * DEUX sens, aucun PLAFOND : une jambe inline hors des deux collections échoue (`neuves`) ; une
 * entrée que plus aucun def ne porte échoue (`perimees`). Solder = migrer PUIS régénérer.
 */
const STOCK = 'scripts/guards/lib/jambesGabaritStock.mjs';

/** Les deux collections réunies : la dette mesurée, et les silhouettes ASSUMÉES (décision, non
 *  mesurable — elle s'écrit à la main, et reste un cliquet même tenue à zéro). */
const stockComplet = (): EntreeNominative[] => [...JAMBE_INLINE_RATCHET, ...JAMBE_SILHOUETTE_OVERRIDES];

const ecart = (stock: Iterable<EntreeNominative> = stockComplet(), dossier?: string) =>
  ecartDuVolet({ sites: sitesJambeInline(dossier), stock, ou: STOCK });

describe('jambe : migration vers le gabarit partagé (cliquet #633 Lot 0)', () => {
  it('aucune jambe inline NEUVE, et un id soldé ne traîne pas hors stock', () => {
    const { neuves } = ecart();
    expect(neuves, `Jambe(s) INLINE hors stock — consommer \`jambeVetue(\`/\`BODIES.\`, ou (silhouette\n` +
      `assumée) inscrire dans JAMBE_SILHOUETTE_OVERRIDES. Une entrée retirée de JAMBE_INLINE_RATCHET\n` +
      `alors que le def est encore inline RETOMBE ici :\n  ${neuves.join('\n  ')}`).toEqual([]);
  });

  it('le stock ne MENT pas : un def migré en sort', () => {
    const { perimees } = ecart();
    expect(perimees, `Entrées de stock dont le def n'est plus inline (migré) — les RETIRER (ou :\n` +
      `npx tsx scripts/rig/regen-jambes-gabarit-stock.mts), sinon le stock surestime ce qui reste à\n` +
      `migrer :\n  ${perimees.join('\n  ')}`).toEqual([]);
  });

  it("chaque entrée NOMME le def à ouvrir — c'est ce que la porte de plage voit", () => {
    const muettes = stockComplet()
      .filter((e) => !new RegExp(`^${DOSSIER_DEFS}/.+\\.ts$`).test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de def : elles seraient INVISIBLES à\n` +
      `\`croissanceDesStocks\`, et un append ne coûterait rien :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucun def ne porte est PÉRIMÉE', () => {
    const gonfle = [...stockComplet(), {
      fichier: `${DOSSIER_DEFS}/TenueQuiNExistePas.ts`, ref: 'gonflement:jambes:inline', occurrence: 1,
    }];
    const { perimees } = ecart(gonfle);
    expect(remedeNomme(perimees, ' :: gonflement:jambes:inline :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });
});

/**
 * MORSURE — la garde rougit-elle vraiment ? Le corpus de defs est COPIÉ sous `os.tmpdir()`, la
 * migration (`jambeVetue(`) est forgée sur la copie, et la mesure porte sur ce dossier
 * (`sitesJambeInline(dossier)`) : l'ARBRE n'est JAMAIS écrit — un def d'art réel, partagé avec
 * d'autres sessions, ne peut pas rester corrompu si la morsure est interrompue, et aucun test ne
 * dépend du `finally` d'un autre. La copie porte TOUT le corpus : seul le def forgé sort de la
 * mesure, donc seule SON entrée de stock devient PÉRIMÉE — les deux sens sont prouvés à la fois.
 */
describe('morsure : migrer un def le rend PÉRIMÉ au stock (#633 Lot 0)', () => {
  const RACINE = fileURLToPath(new URL('../../../../../', import.meta.url));

  it('un def du stock qui migre ressort en `perimees`, en NOMMANT son fichier', () => {
    const cible = JAMBE_INLINE_RATCHET[0];
    expect(cible, 'le stock doit porter au moins une entrée pour ce contrat').toBeDefined();
    const tmp = mkdtempSync(join(tmpdir(), 'jambes-gabarit-morsure-'));
    try {
      cpSync(`${RACINE}${DOSSIER_DEFS}`, tmp, { recursive: true });
      const copie = join(tmp, cible.fichier.slice(`${DOSSIER_DEFS}/`.length));
      writeFileSync(copie, `${readFileSync(copie, 'utf8')}\n// jambeVetue( — migration forgée par la morsure\n`);
      const { perimees } = ecart(stockComplet(), tmp);
      expect(remedeNomme(perimees, ` :: ${cible.ref} :: ${cible.occurrence}`)).toBe(true);
      expect(remedeNomme(perimees, cible.fichier)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("l'arbre n'a pas été écrit : le corpus RÉEL ne porte aucune périmée", () => {
    expect(ecart().perimees).toEqual([]);
  });
});
