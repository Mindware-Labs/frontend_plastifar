// Tokens de sesión: access token en memoria y refresh token en almacenamiento persistente.

const REFRESH_KEY = "plastifar.refreshToken";

type Listener = () => void;

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Sincronización entre pestañas ante rotación de token o cierre de sesión.
window.addEventListener("storage", (event) => {
  if (event.key !== REFRESH_KEY) return;

  refreshToken = event.newValue;
  if (!event.newValue) accessToken = null; // cerraron sesion en otra pestana
  notify();
});

export const tokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

  /** Relee el refresh token persistido: otra pestana pudo rotarlo antes de que llegara el evento "storage". */
  reloadFromStorage() {
    refreshToken = localStorage.getItem(REFRESH_KEY);
    return refreshToken;
  },

  setTokens(access: string | null, refresh: string | null) {
    accessToken = access;
    refreshToken = refresh;

    if (refresh) {
      localStorage.setItem(REFRESH_KEY, refresh);
    } else {
      localStorage.removeItem(REFRESH_KEY);
    }

    notify();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
