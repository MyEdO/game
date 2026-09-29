/**
 * NOM PROPRE rendu MOT À MOT : il se coupe entre ses mots, jamais dans un mot composé
 * (« Pierre-de-Fer ») — chaque mot est une boîte insécable (nom.css). R-M2,
 * docs/plans/2026-08-16-spec-hud-combat.md:71-74. Module FEUILLE, sans boîte à lui : l'hôte (le
 * segment tonné, la légende, l'arche) porte la sienne.
 */
export function Nom({ texte }: { texte: string }) {
  return <>{texte.split(' ').map((mot, j) => <span key={j}>{j > 0 ? ' ' : ''}<span className="nom-mot">{mot}</span></span>)}</>;
}
