// Decodificación de claims del JWT para soporte en interfaz de usuario.

interface AccessTokenClaims {
  sub: string;
  email: string;
  is_admin: "true" | "false";
  /**
   * Accesos por departamento con los permisos de cada rol, serializados como
   * texto JSON por TokenService. El token los trae para no consultar la base en
   * cada comprobacion; se interpretan con parseDepartmentAccess.
   */
  dept_access?: string;
  exp: number;
  given_name?: string;
  family_name?: string;
  first_name?: string;
  last_name?: string;
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
