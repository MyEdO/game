/**
 * Lecture d'une ligne de jet rendue (`RollLine`) : son NOM (la compétence, `.rm-roll-label` privé de la
 * Difficulté qu'il contient) et sa DIFFICULTÉ (`.rm-roll-diff`).
 */
const texte = (e: Element | null | undefined): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

export type LigneDeJetLue = { label: string; diff: string };

/** Les lignes de jet sous `racine`, dans l'ordre du rendu. */
export function lignesDeJet(racine: ParentNode): LigneDeJetLue[] {
  return [...racine.querySelectorAll('.rm-roll-label')].map((label) => {
    const diff = texte(label.querySelector('.rm-roll-diff'));
    return { label: texte(label).slice(0, texte(label).length - diff.length).trim(), diff };
  });
}
