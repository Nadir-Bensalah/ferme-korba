import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { source } from '@/lib/data';
import { compressImage, safeFileName } from '@/lib/image';
import { imageUrl } from '@/lib/format';
import { useToast } from '@/hooks/useToast';

/**
 * Envoi d'images avec aperçu : compression côté client, puis `uploadImage`.
 * `single` pour une image (catégorie, recette), sinon une galerie ordonnable.
 */
export function ImageUploader({
  value,
  onChange,
  pathPrefix,
  single,
  label = 'Photos',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  pathPrefix: string;
  single?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const toast = useToast();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, single ? 1 : 8);
    setBusy(list.length);
    const urls: string[] = [];
    for (const f of list) {
      try {
        const small = await compressImage(f);
        const path = `${pathPrefix}/${Date.now()}-${safeFileName(small.name) || 'photo.jpg'}`;
        urls.push(await source.uploadImage(small, path));
      } catch (e) {
        toast.error('Envoi impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (urls.length) onChange(single ? urls.slice(0, 1) : [...value, ...urls]);
    if (input.current) input.current.value = '';
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
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
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div key={`${src.slice(0, 40)}-${i}`} className="relative size-28 overflow-hidden rounded-md border border-line bg-cream">
            <img src={imageUrl(src)} alt="" className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/55 p-0.5">
              {!single ? (
                <button type="button" aria-label="Avancer" className="flex size-8 items-center justify-center text-white disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronLeft className="size-4" />
                </button>
              ) : (
                <span />
              )}
              <button type="button" aria-label="Retirer" className="flex size-8 items-center justify-center text-white" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                <Trash2 className="size-4" />
              </button>
              {!single ? (
                <button type="button" aria-label="Reculer" className="flex size-8 items-center justify-center text-white disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
            {i === 0 && !single && <span className="absolute left-1 top-1 rounded-sm bg-yolk px-1 text-[10px] font-bold">1re</span>}
          </div>
        ))}
        {busy > 0 && <div className="skeleton size-28" aria-label="Envoi en cours" />}
        {(!single || value.length === 0) && (
          <button type="button" className="flex size-28 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line-2 text-xs font-semibold text-ink-3 hover:border-prairie hover:text-prairie" onClick={() => input.current?.click()}>
            <ImagePlus className="size-6" />
            Ajouter
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple={!single} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <p className="help">Compressée avant envoi : 1600 px maximum, JPEG.</p>
    </div>
  );
}
