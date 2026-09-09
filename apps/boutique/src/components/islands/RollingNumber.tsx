/**
 * Un nombre dont les chiffres roulent, comme un compteur mécanique, à chaque
 * changement de valeur. On lui donne le texte déjà formaté (« 12,450 DT ») :
 * chaque chiffre devient une colonne 0 à 9 qui glisse jusqu'au bon rang,
 * les autres caractères restent en place. Les colonnes sont identifiées depuis
 * la droite, pour que les unités ne sautent pas quand le nombre gagne un chiffre.
 */
interface Props {
  value: string;
  className?: string;
  /** Décalage entre colonnes, en millisecondes : les chiffres de droite partent en premier. */
  stagger?: number;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function RollingNumber({ value, className = '', stagger = 22 }: Props) {
  const chars = Array.from(value);
  const n = chars.length;
  return (
    <span
      dir="ltr"
      className={`inline-flex items-end overflow-hidden leading-none whitespace-pre ${className}`}
      aria-label={value}
      role="text"
    >
      {chars.map((ch, i) => {
        const key = n - i;
        if (!/\d/.test(ch)) {
          return (
            <span key={`c${key}`} className="block h-[1em] leading-none" aria-hidden="true">
              {ch}
            </span>
          );
        }
        const d = Number(ch);
        return (
          <span key={`d${key}`} className="relative block h-[1em] overflow-hidden tabular" aria-hidden="true">
            <span
              className="block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(${-d}em)`, transitionDelay: `${(n - 1 - i) * stagger}ms` }}
            >
              {DIGITS.map((g) => (
                <span key={g} className="block h-[1em] leading-none">
                  {g}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
