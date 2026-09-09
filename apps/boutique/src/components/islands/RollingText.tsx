import RollingNumber from './RollingNumber';

/**
 * Un texte dont seuls les chiffres roulent : « 25,330 DT », « 19 produits ».
 *
 * RollingNumber pose chaque caractère dans une colonne d'un conteneur flex.
 * Dans une page arabe, ce conteneur suit le sens d'écriture et les chiffres
 * partent à l'envers : 19 devient 91, 25,330 devient 033,52. On isole donc le
 * groupe de chiffres dans une boîte en `dir="ltr"` (un nombre s'écrit de gauche
 * à droite dans les deux langues) et on laisse le reste de la phrase au moteur
 * bidirectionnel du navigateur, qui la place comme n'importe quel autre texte.
 */
interface Props {
  value: string;
  className?: string;
}

/** Le premier groupe de chiffres, séparateurs de milliers et décimale compris. */
const NUMBER = /\d[\d.,    ]*\d|\d/;

export default function RollingText({ value, className = '' }: Props) {
  const m = value.match(NUMBER);
  if (!m || m.index === undefined) return <span className={className}>{value}</span>;
  const num = m[0];
  return (
    <span className={className}>
      {value.slice(0, m.index)}
      <span dir="ltr" className="inline-flex">
        <RollingNumber value={num} />
      </span>
      {value.slice(m.index + num.length)}
    </span>
  );
}
