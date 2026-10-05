// Mod `harnais` (#2278) : un fichier par fonction, chacune enregistrée ici.
import type { Register } from 'claude-code'
import { suivi } from './suivi'

export const register: Register = (on) => {
  suivi(on)
}
