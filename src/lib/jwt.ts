// Lectura de claims del JWT en el cliente, solo para efectos de UI (mostrar el
// email, ocultar botones de admin, etc.). La autorización real siempre la valida
// el backend — esto nunca es una barrera de seguridad por sí sola.

interface AccessTokenClaims {
  sub: string;
  email: string;
  is_admin: "true" | "false";
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
