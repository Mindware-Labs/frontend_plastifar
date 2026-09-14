/** Variables de entorno validadas al arrancar: un despliegue sin API_URL falla aquí, no en la primera petición. */
const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

if (!rawApiUrl) {
  throw new Error("Falta VITE_API_URL: define la URL del backend en el archivo .env antes de compilar.");
}

// Sin la barra final: "…app/" + "/api/…" da "//api/…", que no coincide con ninguna ruta.
export const API_URL = rawApiUrl.replace(/\/+$/, "");
