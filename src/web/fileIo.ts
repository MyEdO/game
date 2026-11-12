/** E/S fichier navigateur — motif UNIQUE de téléchargement (Blob + ancre). Source unique :
 *  sauvegardes, projets d'éditeur, export de héros le composent au lieu de recopier le bloc. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
