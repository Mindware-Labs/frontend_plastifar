/**
 * Curva suave para una serie.
 *
 * Interpolación monotone: la curva pasa por cada punto y NO se sale del rango
 * de sus vecinos. Una spline normal sobrepasa en los picos y dibuja valores que
 * el dato nunca tuvo — en una gráfica de tiempos de respuesta eso es inventar
 * un incumplimiento que no ocurrió.
 */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  }

  // Pendientes por tramo.
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const h = points[i + 1][0] - points[i][0];
    dx.push(h);
    slope.push(h === 0 ? 0 : (points[i + 1][1] - points[i][1]) / h);
  }

  // Tangente en cada punto, recortada para no sobrepasar (Fritsch–Carlson).
  const m: number[] = [slope[0]];
  for (let i = 1; i < slope.length; i++) {
    m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  m.push(slope[slope.length - 1]);

  for (let i = 0; i < slope.length; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = (3 / Math.sqrt(s)) * slope[i];
      m[i] = t * a;
      m[i + 1] = t * b;
    }
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${points[i][0] + h} ${points[i][1] + m[i] * h}, ${points[i + 1][0] - h} ${points[i + 1][1] - m[i + 1] * h}, ${points[i + 1][0]} ${points[i + 1][1]}`;
  }
  return d;
}
