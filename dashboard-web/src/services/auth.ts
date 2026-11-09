// Sessão do familiar (correção V-01 do pentest: a API agora exige login).
// O token fica em sessionStorage: some ao fechar a aba e não é enviado automaticamente como cookie.
// Com "Manter conectado neste aparelho" ele vai para localStorage (a sessão do backend continua expirando em 8 h).

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
const STORAGE_KEY = "amparo_session";

export class AuthRequiredError extends Error {
  constructor() {
    super("Login necessário");
    this.name = "AuthRequiredError";
  }
}

export class ApiError extends Error {
  /** offline = o proxy do Vite respondeu 5xx sem corpo, ou seja, o backend não está rodando */
  constructor(
    readonly status: number,
    message: string,
    readonly offline = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  const text = await res.text().catch(() => "");
  let message = fallback;
  try {
    message = (JSON.parse(text) as { message?: string }).message ?? fallback;
  } catch {
    /* corpo não é JSON */
  }
  return new ApiError(
    res.status,
    message,
    res.status >= 500 && text.trim() === "",
  );
}

interface Session {
  token: string;
  username: string;
}

const readSession = (): Session | null => {
  for (const getStorage of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = getStorage().getItem(STORAGE_KEY);
      if (!raw) continue;
      const saved = JSON.parse(raw) as Partial<Session>;
      if (
        typeof saved.token === "string" &&
        saved.token &&
        typeof saved.username === "string"
      ) {
        return saved as Session;
      }
    } catch {
      // One storage may be unavailable while the other still holds a valid session.
    }
  }
  return null;
};

const clearStored = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* armazenamento indisponível */
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* armazenamento indisponível */
  }
};

let session: Session | null = readSession();
let persistenceWarning = "";
function saveSession(next: Session, keepSignedIn: boolean) {
  session = next;
  persistenceWarning = "";
  clearStored();
  try {
    (keepSignedIn ? localStorage : sessionStorage).setItem(
      STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    persistenceWarning =
      "Sua conta foi acessada, mas este navegador não permitiu salvar a sessão. Ao fechar, será necessário entrar novamente.";
  }
}
const listeners = new Set<() => void>();

let generation = 0;
const notify = () => {
  generation++;
  listeners.forEach((listener) => listener());
};

export const auth = {
  get persistenceWarning() {
    return persistenceWarning;
  },
  get generation() {
    return generation;
  },
  get username() {
    return session?.username ?? null;
  },
  isLoggedIn: () => session !== null,
  onChange(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async login(
    username: string,
    password: string,
    keepSignedIn = false,
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const error = await readError(res, "Não foi possível entrar.");
      if (error.offline) throw new TypeError("Backend indisponível");
      throw error;
    }
    const body = (await res.json()) as { token: string; username: string };
    saveSession({ token: body.token, username: body.username }, keepSignedIn);
    notify();
  },
  async register(
    name: string,
    email: string,
    password: string,
    personName: string,
    invite: string,
    keepSignedIn = false,
  ): Promise<{
    username: string;
    deviceId: string;
    robotId: string;
    /** Vazio para quem entra por convite: a chave fica com quem cadastrou os equipamentos. */
    deviceKey: string;
    recoveryCode: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        ...(personName ? { personName } : {}),
        ...(invite ? { invite } : {}),
      }),
    });
    if (!res.ok) throw await readError(res, "Não foi possível criar a conta.");
    const body = await res.json();
    saveSession({ token: body.token, username: body.username }, keepSignedIn);
    notify();
    return body;
  },
  async logout(): Promise<void> {
    const token = session?.token;
    session = null;
    persistenceWarning = "";
    clearStored();
    notify();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  },
};

/**
 * fetch para a API Amparo com o token do familiar.
 * - 401: a sessão expirou ou não existe -> limpa a sessão e lança AuthRequiredError (o App mostra o login).
 * - erro de rede: a exceção original segue (quem chama decide entrar em modo demonstração).
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const startedGeneration = generation;
  const headers = new Headers(init.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(30000),
  });
  if (startedGeneration !== generation) throw new AuthRequiredError();
  if (res.status === 401) {
    if (session) {
      session = null;
      clearStored();
    }
    notify();
    throw new AuthRequiredError();
  }
  return res;
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await readError(res, `A API respondeu ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
