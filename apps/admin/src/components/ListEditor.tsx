import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

/** Liste de textes, un par ligne : ajouter, retirer, monter, descendre. */
export function ListEditor({ label, value, onChange, dir, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; dir?: 'rtl'; placeholder?: string }) {
  const set = (i: number, v: string) => onChange(value.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[i] = b;
    next[j] = a;
    onChange(next);
  };
  return (
    <div>
      <div className="label">{label}</div>
      <ol className="flex flex-col gap-1.5">
        {value.map((line, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="w-5 shrink-0 text-right text-xs text-ink-3 tabular">{i + 1}.</span>
            <input className="field field-sm" dir={dir} value={line} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
            <button type="button" aria-label="Monter" className="btn-ghost btn-icon size-10 shrink-0" disabled={i === 0} onClick={() => move(i, -1)}>
              <ChevronUp className="size-4" />
            </button>
            <button type="button" aria-label="Descendre" className="btn-ghost btn-icon size-10 shrink-0" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <ChevronDown className="size-4" />
            </button>
            <button type="button" aria-label="Retirer" className="btn-ghost btn-icon size-10 shrink-0 text-paprika" onClick={() => onChange(value.filter((_, k) => k !== i))}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-soft btn-sm mt-2" onClick={() => onChange([...value, ''])}>
        <Plus className="size-4" /> Ajouter une ligne
      </button>
    </div>
  );
}
