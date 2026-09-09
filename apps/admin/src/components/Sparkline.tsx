import { formatPrice } from '@ferme/core';
import { fmtDay } from '@/lib/format';

interface Point {
  date: string;
  orders: number;
  revenue: number;
}

/** Petite courbe des 14 derniers jours, SVG maison, sans bibliothèque. */
export function Sparkline({ data }: { data: Point[] }) {
  const w = 560;
  const h = 140;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const n = data.length;
  const x = (i: number) => padX + (i * (w - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => padTop + (h - padTop - padBottom) * (1 - v / max);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${(h - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(h - padBottom).toFixed(1)} Z`;
  const last = data[n - 1];
  const best = data.reduce((a, d) => (d.revenue > a.revenue ? d : a), data[0] ?? { date: '', orders: 0, revenue: 0 });

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label="Chiffre des 14 derniers jours">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1e7a3c" stopOpacity="0.28" />
            <stop offset="1" stopColor="#1e7a3c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <line key={f} x1={padX} x2={w - padX} y1={y(max * f)} y2={y(max * f)} stroke="#e5e3da" strokeDasharray="3 4" />
        ))}
        {n > 1 && <path d={area} fill="url(#spark-fill)" />}
        {n > 1 && <path d={line} fill="none" stroke="#1e7a3c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => (
          <g key={d.date}>
            <circle cx={x(i)} cy={y(d.revenue)} r={d.orders > 0 ? 3.5 : 2} fill={d.orders > 0 ? '#1e7a3c' : '#d3d0c4'}>
              <title>{`${fmtDay(d.date)} : ${d.orders} commande${d.orders > 1 ? 's' : ''}, ${formatPrice(d.revenue, 'fr')}`}</title>
            </circle>
            {(i === 0 || i === n - 1 || i % 4 === 0) && (
              <text x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="#6b7566">
                {fmtDay(d.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-ink-3">
        <span>Meilleur jour : {best.revenue > 0 ? `${fmtDay(best.date)}, ${formatPrice(best.revenue, 'fr')}` : 'aucune vente'}</span>
        {last && <span>Aujourd'hui : {formatPrice(last.revenue, 'fr')}</span>}
      </figcaption>
    </figure>
  );
}
