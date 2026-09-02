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
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    // atob devuelve bytes, no texto: se decodifican como UTF-8 por si el correo lleva acentos.
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AccessTokenClaims;
  } catch {
    return null;
  }
}
