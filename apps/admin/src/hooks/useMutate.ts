import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from './useToast';
import { errorMessage } from '@/lib/format';

interface Options<TResult> {
  invalidate?: QueryKey[];
  success?: string;
  onSuccess?: (result: TResult) => void;
}

/** Une mutation = un retour visuel (succès ou erreur) et les listes rafraîchies. */
export function useMutate<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, opts: Options<TResult> = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<TResult, Error, TArgs>({
    mutationFn: fn,
    onSuccess: (result) => {
      for (const key of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(result);
    },
    onError: (e) => toast.error('Échec', errorMessage(e)),
  });
}
