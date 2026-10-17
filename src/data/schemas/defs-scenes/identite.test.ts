/**
 * Porte de l'IDENTITÉ d'un état `heros` (EDO 02 l.112-127, #686) : chaque contrôle refuse SA faute, au
 * chemin de la valeur fautive, par la porte du narratif (`narratifSchema`).
 */
import { describe, it, expect } from 'vitest';
import { narratifSchema } from './narratif';
import { emptyNarratif, type NarratifBlock } from '../../../state/campaignNarratif';

const P27 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.114-125' };
const L127 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.127' };

type Identite = Record<string, unknown>;
const identite = (): Identite => ({
  ancres: ['Kastor', 'Lieberung'],
  reperes: [{ id: 'complet', texte: 'Kastor Lieberung' }, { id: 'nom', texte: 'Lieberung' }],
  lignes: [
    { espece: 'humain', sexe: 'M', valeurs: { complet: { texte: 'Kastor Lieberung', source: P27 }, nom: { texte: 'Lieberung', source: P27 } } },
    { espece: 'nain', sexe: 'F', valeurs: { complet: { texte: 'Kallar Linkassniz', source: P27 }, nom: { texte: 'Linkassniz', adapteDe: L127 } } },
  ],
});
const narratif = (id: Identite): NarratifBlock => ({
  ...emptyNarratif(),
  etats: [{ id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' }, forme: { kind: 'heros', identite: id } }],
} as NarratifBlock);

/** Les fautes `chemin sous l'identité → message`. */
function fautes(id: Identite): string[] {
  const r = narratifSchema.safeParse(narratif(id));
  return r.success ? [] : r.error.issues.map((i) => `${i.path.slice(4).join('.')} → ${i.message}`);
}

describe('identité d’un état `heros` — la porte refuse chaque faute à sa place', () => {
  it('l’identité complète PARSE', () => {
    expect(fautes(identite())).toEqual([]);
  });

  it('un repère sans ancre est refusé', () => {
    const id = identite();
    (id.reperes as { texte: string }[])[1].texte = 'Herr Kuftsos';
    expect(fautes(id)).toEqual(['reperes.1.texte → repère « Herr Kuftsos » sans ancre : il contient au moins l’une de « Kastor », « Lieberung ».']);
  });

  it('une ancre ne compte qu’en mot entier', () => {
    const id = identite();
    (id.reperes as { texte: string }[])[1].texte = 'Lieberungen';
    expect(fautes(id)).toEqual(['reperes.1.texte → repère « Lieberungen » sans ancre : il contient au moins l’une de « Kastor », « Lieberung ».']);
  });

  it('une valeur sans provenance est refusée', () => {
    const id = identite();
    (id.lignes as { valeurs: Record<string, Record<string, unknown>> }[])[1].valeurs.nom = { texte: 'Linkassniz' };
    expect(fautes(id)).toEqual(['lignes.1.valeurs.nom.source → provenance manquante : la page copiée (source) ou le passage adapté (adapté de).']);
  });

  it('une valeur copiée ET adaptée est refusée', () => {
    const id = identite();
    (id.lignes as { valeurs: Record<string, Record<string, unknown>> }[])[1].valeurs.nom = { texte: 'Linkassniz', source: P27, adapteDe: L127 };
    expect(fautes(id)).toEqual(['lignes.1.valeurs.nom.adapteDe → texte à la fois copié et adapté d’un passage : garde l’un ou l’autre.']);
  });

  it('un métacaractère Markdown est refusé : ancre, repère, valeur', () => {
    const id = identite();
    (id.ancres as string[])[0] = '*Kastor*';
    (id.reperes as { texte: string }[])[1].texte = 'Lieberung_';
    (id.lignes as { valeurs: Record<string, { texte: string }> }[])[1].valeurs.complet.texte = 'Kallar [Linkassniz]';
    const f = fautes(id);
    expect(f).toContain('ancres.0 → ancre : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
    expect(f).toContain('reperes.1.texte → texte du repère : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
    expect(f).toContain('lignes.1.valeurs.complet.texte → texte de la valeur : métacaractère Markdown refusé (\\ ` * _ [ ] < > # | ~).');
  });

  it('une ligne qui ne couvre pas tous les repères est refusée', () => {
    const id = identite();
    delete (id.lignes as { valeurs: Record<string, unknown> }[])[1].valeurs.nom;
    expect(fautes(id)).toEqual(['lignes.1.valeurs → repère « nom » sans valeur : une ligne couvre tous les repères.']);
  });

  it('une valeur d’un repère inconnu est refusée', () => {
    const id = identite();
    (id.lignes as { valeurs: Record<string, unknown> }[])[1].valeurs.titre = { texte: 'Frau', adapteDe: L127 };
    expect(fautes(id)).toEqual(['lignes.1.valeurs.titre → repère inconnu « titre ».']);
  });

  it('un couple espèce × sexe en double est refusé', () => {
    const id = identite();
    (id.lignes as { espece: string }[])[1].espece = 'humain';
    (id.lignes as { sexe: string }[])[1].sexe = 'M';
    expect(fautes(id).some((f) => f.startsWith('lignes') && f.includes('humain M'))).toBe(true);
  });

  it('une identité sans ancre ni repère est refusée', () => {
    expect(fautes({ ancres: [], reperes: [], lignes: [] })).toEqual([
      'ancres → aucune ancre : une identité en déclare au moins une.',
      'reperes → aucun repère : une identité en déclare au moins un.',
    ]);
  });
});
