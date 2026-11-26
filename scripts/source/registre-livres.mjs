import booksData from '../../src/data/books.json' with { type: 'json' }
import { estLivreExtrait } from '../../src/data/schemas/source/livre-extrait.ts'

// Registre BRUT des livres, tel que `books.json` le porte — la lecture du fichier vit ICI et nulle
// part ailleurs, pour que tout consommateur puisse recevoir un registre FIXTURE par injection.
export const REGISTRE_LIVRES = booksData
/** L'entrée du registre d'un livre EXTRAIT (porteur d'un `dir`), par son id STABLE — ou `null`.
 *  SEULE résolution id → livre de l'outillage : un outil reçoit un id, il ne compare rien lui-même. */
export const livreExtraitDe = (id, registre = REGISTRE_LIVRES) =>
  registre.find((b) => b.id === id && estLivreExtrait(b)) ?? null
