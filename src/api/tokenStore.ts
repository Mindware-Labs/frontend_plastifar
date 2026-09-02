// Fuente única de verdad para los tokens de sesión. El access token vive solo en
// memoria (nunca en localStorage: reduce la ventana de robo por XSS); el refresh
// token se persiste para poder restaurar la sesión al recargar la página.

const REFRESH_KEY = "plastifar.refreshToken";

type Listener = () => void;

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Otra pestana puede rotar el refresh token o cerrar sesion. Sin escuchar el
// evento "storage", esta pestana seguiria usando un token ya rotado y provocaria
// una falsa alarma de reutilizacion en el servidor.
window.addEventListener("storage", (event) => {
  if (event.key !== REFRESH_KEY) return;

  refreshToken = event.newValue;
  if (!event.newValue) accessToken = null; // cerraron sesion en otra pestana
  notify();
});

export const tokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

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
