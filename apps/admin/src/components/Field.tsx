import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { Localized } from '@ferme/core';

interface Wrap {
  label?: string;
  help?: string;
  error?: string;
  className?: string;
}

function FieldWrap({ label, help, error, className, children, htmlFor }: Wrap & { children: ReactNode; htmlFor?: string }) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <p className="error">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export function Input({ label, help, error, className, id, ...rest }: Wrap & InputHTMLAttributes<HTMLInputElement>) {
  const fid = id ?? (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <FieldWrap label={label} help={help} error={error} className={className} htmlFor={fid}>
      <input id={fid} className="field" aria-invalid={error ? 'true' : undefined} {...rest} />
    </FieldWrap>
  );
}

export function Textarea({ label, help, error, className, id, ...rest }: Wrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fid = id ?? (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <FieldWrap label={label} help={help} error={error} className={className} htmlFor={fid}>
      <textarea id={fid} className="field" rows={3} aria-invalid={error ? 'true' : undefined} {...rest} />
    </FieldWrap>
  );
}

export function Select({ label, help, error, className, id, children, ...rest }: Wrap & SelectHTMLAttributes<HTMLSelectElement>) {
  const fid = id ?? (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <FieldWrap label={label} help={help} error={error} className={className} htmlFor={fid}>
      <select id={fid} className="field" aria-invalid={error ? 'true' : undefined} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function Checkbox({ label, checked, onChange, className }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-1 text-sm font-medium ${className ?? ''}`}>
      <input type="checkbox" className="size-5 accent-prairie" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-md px-1 text-left"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {help && <span className="block text-xs text-ink-3">{help}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${checked ? 'bg-prairie' : 'bg-line-2'}`}>
        <span className={`absolute top-0.5 size-6 rounded-pill bg-paper shadow-card transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

/** Une paire FR / AR, saisie côte à côte sur bureau, l'une sous l'autre sur téléphone. */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  required,
  errors,
  rows,
}: {
  label: string;
  value: Localized;
  onChange: (v: Localized) => void;
  multiline?: boolean;
  required?: boolean;
  errors?: { fr?: string; ar?: string };
  rows?: number;
}) {
  const common = { required };
  return (
    <fieldset className="min-w-0">
      <legend className="label">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          {multiline ? (
            <textarea className="field" rows={rows ?? 3} lang="fr" value={value.fr} onChange={(e) => onChange({ ...value, fr: e.target.value })} placeholder="Français" aria-invalid={errors?.fr ? 'true' : undefined} {...common} />
          ) : (
            <input className="field" lang="fr" value={value.fr} onChange={(e) => onChange({ ...value, fr: e.target.value })} placeholder="Français" aria-invalid={errors?.fr ? 'true' : undefined} {...common} />
          )}
          {errors?.fr && <p className="error">{errors.fr}</p>}
        </div>
        <div>
          {multiline ? (
            <textarea className="field" rows={rows ?? 3} dir="rtl" lang="ar" value={value.ar} onChange={(e) => onChange({ ...value, ar: e.target.value })} placeholder="العربية" aria-invalid={errors?.ar ? 'true' : undefined} {...common} />
          ) : (
            <input className="field" dir="rtl" lang="ar" value={value.ar} onChange={(e) => onChange({ ...value, ar: e.target.value })} placeholder="العربية" aria-invalid={errors?.ar ? 'true' : undefined} {...common} />
          )}
          {errors?.ar && <p className="error">{errors.ar}</p>}
        </div>
      </div>
    </fieldset>
  );
}
