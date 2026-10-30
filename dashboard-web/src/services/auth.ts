// Sessão do familiar (correção V-01 do pentest: a API agora exige login).
// O token fica em sessionStorage: some ao fechar a aba e não é enviado automaticamente como cookie.

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const STORAGE_KEY = 'amparo_session';

export class AuthRequiredError extends Error {
  constructor() {
    super('Login necessário');
    this.name = 'AuthRequiredError';
  }
}

export class ApiError extends Error {
  /** offline = o proxy do Vite respondeu 5xx sem corpo, ou seja, o backend não está rodando */
  constructor(readonly status: number, message: string, readonly offline = false) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  let message = fallback;
  try { message = (JSON.parse(text) as { message?: string }).message ?? fallback; } catch { /* corpo não é JSON */ }
  return new ApiError(res.status, message, res.status >= 500 && text.trim() === '');
}

interface Session {
  token: string;
  username: string;
}

const readSession = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

let session: Session | null = readSession();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

export const auth = {
  get username() {
    return session?.username ?? null;
  },
  isLoggedIn: () => session !== null,
  onChange(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  async login(username: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const error = await readError(res, 'Não foi possível entrar.');
      if (error.offline) throw new TypeError('Backend indisponível');
      throw error;
    }
    const body = await res.json() as { token: string; username: string };
    session = { token: body.token, username: body.username };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* armazenamento indisponível */ }
    notify();
  },
  async logout(): Promise<void> {
    const token = session?.token;
    session = null;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* armazenamento indisponível */ }
    notify();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
  }
};

/**
 * fetch para a API Amparo com o token do familiar.
 * - 401: a sessão expirou ou não existe -> limpa a sessão e lança AuthRequiredError (o App mostra o login).
 * - erro de rede: a exceção original segue (quem chama decide entrar em modo demonstração).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    if (session) {
      session = null;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* armazenamento indisponível */ }
    }
    notify();
    throw new AuthRequiredError();
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await readError(res, `A API respondeu ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
