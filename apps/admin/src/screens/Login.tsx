import { useState, type FormEvent } from 'react';
import { brand } from '@ferme/core';
import { DEMO_CREDENTIALS, isDemo } from '@/lib/data';
import { errorMessage } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo-96.png`} alt="" width={48} height={48} className="size-12 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">{brand.name.fr}</h1>
            <div className="text-sm text-ink-3">Espace de gestion</div>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="label">E-mail</span>
            <input className="field" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Mot de passe</span>
            <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        {isDemo && (
          <div className="mt-5 rounded-md bg-yolk-soft p-3 text-sm">
            <div className="font-bold">Mode démo</div>
            <div className="mt-1 text-ink-2">
              <span className="tabular">{DEMO_CREDENTIALS.email}</span> / <span className="tabular">{DEMO_CREDENTIALS.password}</span>
            </div>
            <button
              type="button"
              className="btn-yolk btn-sm mt-2"
              onClick={() => {
                setEmail(DEMO_CREDENTIALS.email);
                setPassword(DEMO_CREDENTIALS.password);
              }}
            >
              Remplir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
