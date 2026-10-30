import React, { useState } from 'react';
import { Activity, LockKeyhole } from 'lucide-react';
import { ApiError, auth } from '../services/auth';

interface LoginScreenProps {
  onLoggedIn: () => void;
  onContinueDemo: () => void;
}

/** Login do familiar (antes do pentest a API aceitava qualquer pessoa da rede, sem login). */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoggedIn, onContinueDemo }) => {
  const [username, setUsername] = useState('familia');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.login(username.trim(), password);
      onLoggedIn();
    } catch (e) {
      setOffline(!(e instanceof ApiError));
      setError(e instanceof ApiError ? e.message : 'Servidor indisponível. Verifique se o backend está rodando.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card glass-panel" onSubmit={e => void submit(e)}>
        <div className="brand"><div className="brand-symbol" aria-hidden="true"><Activity size={26} /></div><div><h1>Amparo<span>Telecuidado familiar</span></h1></div></div>
        <h2><LockKeyhole size={20} /> Entrar na central de cuidado</h2>
        <p className="muted">Acesso restrito à família. A sessão expira em 8 horas.</p>
        <label>Usuário
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required maxLength={60} />
        </label>
        <label>Senha
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required maxLength={120} />
        </label>
        {error && <p className="feedback-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        {offline && <button className="btn btn-secondary" type="button" onClick={onContinueDemo}>Continuar em modo demonstração</button>}
      </form>
    </main>
  );
};
