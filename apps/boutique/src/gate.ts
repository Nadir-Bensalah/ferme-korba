/**
 * Verrou d'accès au site de démonstration. Le mot de passe n'est jamais dans
 * le code : seule son empreinte SHA-256 l'est. Pour le changer :
 *   printf 'nouveau-mot-de-passe' | shasum -a 256
 * Mettre une chaîne vide pour ouvrir le site à tous.
 */
export const GATE_HASH = '551489f8513889104bd1efad7703f9ad5f92f3dcf76c0f8a88e4dc9ac106eca9';
