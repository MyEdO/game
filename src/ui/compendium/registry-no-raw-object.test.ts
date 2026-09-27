import { describe, it, expect } from 'vitest';
import { CODEX, combatantSections } from './registry';
import { pregen, PREGEN } from '../../data/pregens';
import miscastRawJson from '../../data/miscast.json';

/**
 * Garde-fou anti-régression de la classe de bug « [object Object] » au Codex.
 *
 * `fact(label, value)` fait `String(value)` (registry.ts:276) : un champ STRUCTURÉ (SpellRange,
 * ManeuverMeasure, WeaponDamageSpec, WeaponRangeSpec…) passé BRUT à `fact()` est stringifié en
 * « [object Object] » à l'écran. Ce test matérialise TOUT le Codex (CODEX est construit au chargement)
 * et échoue si un meta contient cette chaîne. Tout nouveau champ objet DOIT passer par un formateur
 * (formatSpellRange, formatManeuverMeasure, damageString, rangeSpecLabel…) avant `fact()`.
 */
describe('Codex — aucun champ structuré rendu brut', () => {
  it('aucun meta ne produit « [object Object] »', () => {
    const offenders: string[] = [];
    for (const cat of CODEX) {
      for (const item of cat.items) {
        for (const f of item.meta ?? []) {
          if (f.value.includes('[object Object]')) offenders.push(`${cat.label} › ${item.label} › ${f.label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('statbloc combattant (InspectPanel / inspection) : aucune ligne ne produit « [object Object] »', () => {
    // Chemin DISTINCT de CODEX : `combatantSections(c)` rend les armes/armure/caracs d'un combattant LIVE
    // (inspection en combat). Les prétirés portent des armes → exercent le rang d'armes (où w.damage est un
    // WeaponDamageSpec qui doit passer par damageString, pas être rendu brut).
    const offenders: string[] = [];
    for (const key of Object.keys(PREGEN) as (keyof typeof PREGEN)[]) {
      const c = pregen(PREGEN[key]);
      for (const sec of combatantSections(c)) {
        for (const row of sec.rows) {
          if (JSON.stringify(row).includes('[object Object]')) offenders.push(`${String(key)} › ${sec.title} › ${JSON.stringify(row)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('RANGÉES du Codex (sections + onglets de TOUTES les catégories) : aucune ne produit « [object Object] »', () => {
    // Chemin DISTINCT des deux précédents : le 1ᵉʳ ne lit que `item.meta`, le 2ᵉ que les rangées d'un
    // combattant LIVE. Les rangées d'un ITEM de catégorie (`sections`/`tabs`) n'étaient lues par
    // aucun des deux — c'est là que vivaient les 27 « [object Object] » des 3 tables d'Imparfaites
    // (une réf de Compétence `{id}` passée à `String()`, `registry.ts`).
    const parCategorie: Record<string, number> = {};
    let total = 0;
    const scan = (o: unknown, categorie: string) => {
      if (o && typeof o === 'object') { for (const v of Object.values(o)) scan(v, categorie); return; }
      if (typeof o === 'string' && o.includes('[object Object]')) {
        total++;
        parCategorie[categorie] = (parCategorie[categorie] ?? 0) + 1;
      }
    };
    for (const cat of CODEX) {
      for (const item of cat.items ?? []) {
        for (const s of item.sections ?? []) scan(s, cat.label);
        for (const t of item.tabs ?? []) scan(t, cat.label);
      }
    }
    expect({ total, parCategorie }).toEqual({ total: 0, parCategorie: {} });
  });
});

/**
 * Le Codex ne DÉCLARE une mitigation que si la donnée la porte. « Ressentez ma colère » (LDB 40
 * l.68) n'énonce AUCUNE exception — `ignoreAP: false` en donnée, `miscast-ops.test.ts` le verrouille
 * côté moteur, et l'écran doit dire la même chose que la table.
 */
describe('Codex — la mitigation affichée est celle de la DONNÉE', () => {
  it('chaque mitigation (`ignoreAP`, `ignoreTB`) n’est dite QUE là où la donnée la déclare', () => {
    const documents = miscastRawJson as unknown as { entries?: { label: string; ops?: { op: string; ignoreAP?: boolean; ignoreTB?: boolean }[] }[] }[];
    /** Les DEUX mitigations déclarables, chacune avec la phrase que le Codex imprime. */
    const MITIGATIONS = [
      { champ: 'ignoreAP', phrase: 'les PA' },
      { champ: 'ignoreTB', phrase: 'le Bonus d’Endurance' },
    ] as const;
    const porteurs = new Map(MITIGATIONS.map((m) => [m.champ, new Set<string>()]));
    for (const doc of documents) {
      for (const e of doc.entries ?? []) {
        for (const o of e.ops ?? []) {
          if (o.op !== 'wounds') continue;
          for (const m of MITIGATIONS) if (o[m.champ] === true) porteurs.get(m.champ)!.add(e.label);
        }
      }
    }

    const ecarts: string[] = [];
    const dits: Record<string, number> = {};
    for (const cat of CODEX.filter((c) => c.key.startsWith('miscast'))) {
      for (const item of cat.items ?? []) {
        const rendu = (item.sections ?? []).flatMap((s) => s.rows.map((r) => JSON.stringify(r)));
        for (const m of MITIGATIONS) {
          const dit = rendu.some((r) => new RegExp(`ignorant [^"]*${m.phrase}`).test(r));
          if (dit) dits[m.champ] = (dits[m.champ] ?? 0) + 1;
          const porte = porteurs.get(m.champ)!.has(item.label);
          if (dit !== porte) ecarts.push(`${cat.label} › ${item.label} : Codex ${dit ? 'DIT' : 'tait'} « ${m.phrase} », donnée ${porte ? 'porte' : 'ne porte pas'} \`${m.champ}\``);
        }
      }
    }
    expect(ecarts, 'le Codex dit chaque mitigation EXACTEMENT là où la donnée la porte').toEqual([]);
    expect(
      MITIGATIONS.filter((m) => !dits[m.champ]).map((m) => m.champ),
      'mitigation(s) jamais dite au Codex : la sonde ne mesurerait rien de ce côté-là.',
    ).toEqual([]);
  });
});
