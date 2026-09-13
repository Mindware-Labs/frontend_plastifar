import {
  AlarmClock,
  AlertTriangle,
  ClipboardCheck,
  Clock,
  History,
  Inbox,
  PauseCircle,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useDashboard } from "../dashboardContext";
import { useApplyFilter, type DashboardFilter } from "../filters";
import { useCountUp } from "../../../hooks/useCountUp";
import { C, FONT, NUM, R, S, T, hueFor, n, type Role } from "../styles";

/**
 * La fila de cifras.
 *
 * ==================================================================
 * LA ANATOMÍA ES LA DE LA REFERENCIA
 * ==================================================================
 * Cinco piezas por tarjeta, en este orden y sin agregar ninguna:
 *
 *   1. Un filete de acento de 3 px en el borde izquierdo. Es lo que hace que
 *      cinco tarjetas se lean como un CONJUNTO en vez de cinco cajas sueltas.
 *   2. Un icono dentro de un cuadro tintado del mismo tono, muy lavado.
 *   3. El rótulo en versalita diminuta y trackeada, al lado del icono.
 *   4. La cifra, con su variación en la misma línea base.
 *   5. El calificador debajo: contra qué se lee esa cifra.
 *
 * El calificador es la pieza que más trabaja y la que casi siempre se omite.
 * Una cifra sola obliga a preguntar «¿comparado con qué?»; ahí está la
 * respuesta, sin un clic de por medio.
 *
 * ==================================================================
 * CINCO EN UNA FILA
 * ==================================================================
 * Con seis no entraban: cada tarjeta quedaba en unos 190 px y el bloque de la
 * derecha se partía. Al sacar «Cierre promedio» —que medía HCA y no la cola de
 * tickets, o sea otra cosa que las demás— quedan cinco, con unos 216 px cada
 * una, y ahí la anatomía entra completa.
 *
 * Ayuda que la cifra bajara a 20 px y que la variación sea una píldora compacta:
 * el mismo bloque que antes no cabía, ahora sí.
 *
 * ==================================================================
 * EL ACENTO NO ES DECORACIÓN
 * ==================================================================
 * El filete y el círculo toman el tono del ROL, no un verde de marca repetido
 * seis veces. Un acento idéntico en las seis tarjetas es pintura; el tono del
 * rol es la misma información que ya llevan las pastillas de la tabla de abajo.
 */

interface Kpi {
  label: string;
  role: Role;
  icon: LucideIcon;
  /**
   * El numero SIN formatear. La tarjeta lo cuenta desde cero al montar y lo
   * formatea en cada fotograma, asi que necesita la magnitud, no el texto.
   */
  count: number;
  /** Calificador: contra qué se lee. */
  qualifier: string;
  /**
   * EL ACOMPAÑANTE. Un hecho del presente, al lado de la cifra.
   *
   * Aquí vivía «cuánto se movió contra ayer», y era imposible de sostener:
   * vencidos, por vencer, en espera y HCA abiertas son cantidades del INSTANTE
   * —se deducen comparando una fecha de compromiso contra el reloj— así que el
   * valor de ayer no está guardado en ninguna tabla y no se puede reconstruir.
   * Los cinco deltas que había eran literales escritos a mano.
   *
   * Lo que hay ahora sale de una consulta y además contesta algo más útil: no
   * «ayer estábamos mejor» sino DÓNDE ACTUAR. `null` cuando no hay nada que
   * señalar, y entonces no se pinta nada: una pastilla que dice «0» ocupa sitio
   * para no informar.
   */
  hint: { icon: LucideIcon; text: string; urgent: boolean } | null;
  filter: DashboardFilter;
}

/**
 * La variación, en píldora.
 *
 * ------------------------------------------------------------------
 * POR QUÉ HAY FLECHA Y NO UN SIGNO
 * ------------------------------------------------------------------
 * Acá conviven DOS hechos distintos: hacia dónde se movió la cifra, y si eso
 * es buena o mala noticia. No son lo mismo — en «Abiertos», bajar es bueno —
 * así que cada uno necesita su propia señal.
 *
 * Antes los dos viajaban encima del mismo carácter: un «−3» pintado de verde.
 * El signo decía «bajó», el color decía «bien», y como el ojo lee el menos como
 * algo negativo, los dos parecían contradecirse. La lógica estaba bien y la
 * lectura estaba mal, que a los efectos es lo mismo que estar mal.
 *
 * Ahora la FLECHA dice la dirección y el COLOR dice el veredicto. Una flecha
 * hacia abajo sobre verde se lee sin esfuerzo: «bajó, y eso está bien».
 */
function Acompanante({ kpi }: { kpi: Kpi }) {
  if (kpi.hint === null) return null;

  const hue = hueFor(kpi.hint.urgent ? "vencido" : "cumplido");
  const fg = kpi.hint.urgent ? hue.color : C.soft;
  const bg = kpi.hint.urgent ? hue.tint : C.chip;
  const Icon = kpi.hint.icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px 2px 6px",
        borderRadius: 999,
        background: bg,
        color: fg,
        ...T.caption,
        ...NUM,
        fontSize: 10.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} strokeWidth={2.5} aria-hidden />
      {kpi.hint.text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const applyFilter = useApplyFilter();
  /*
   * Las cinco cifras arrancan a la vez y tardan lo mismo, asi que la velocidad
   * de cada una dice su magnitud: 137 abiertos corre visiblemente mas rapido
   * que 19 fuera de plazo. El escalon de 60 ms por tarjeta ordena la lectura de
   * izquierda a derecha sin convertirla en un desfile —240 ms en total—.
   */
  const shown = useCountUp(kpi.count, { duration: 750, delay: index * 60 });
  const hue = hueFor(kpi.role);
  const Icon = kpi.icon;

  return (
    <div className="cx-card cx-hover" style={{ display: "flex" }}>
      {/* El filete de acento es un div, no un `border-left`: un borde de un
          solo lado contra un radio se corta en las esquinas y deja dos
          muescas. Como hermano del contenido, el radio de la tarjeta lo
          recorta limpio. */}
      <span aria-hidden style={{ width: 3, flexShrink: 0, background: hue.color }} />

      <button
        type="button"
        className="cx-link"
        onClick={() => applyFilter(kpi.filter)}
        title={`Ver ${kpi.filter.label}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          width: "100%",
          minWidth: 0,
          padding: "11px 13px",
          border: "none",
          background: "transparent",
          textAlign: "left",
          fontFamily: FONT,
          cursor: "pointer",
        }}
      >
        {/* Icono y rótulo en la primera línea, no en columnas.
            Con cinco tarjetas en una fila cada una queda en unos 206 px, y ahí
            el bloque secundario NO puede ir al costado: medido en pantalla,
            «Fuera de plazo» pedía 87 px de rótulo y le quedaban 40. Apilado,
            el rótulo recupera el ancho entero de la tarjeta. Es geometría, no
            preferencia. */}
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
          <span
            aria-hidden
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              borderRadius: R.control,
              background: hue.tint,
              color: hue.color,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon size={13} strokeWidth={2} />
          </span>
          <span
            style={{
              ...T.micro,
              color: C.soft,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {kpi.label}
          </span>
        </span>

        {/* Cifra y variación comparten línea base: cuánto hay y hacia dónde va
            son el mismo hecho leído dos veces. */}
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ ...T.figure, ...NUM, fontSize: 24, color: C.ink }}>{n(shown)}</span>
          <Acompanante kpi={kpi} />
        </span>

        <span
          style={{
            ...T.caption,
            ...NUM,
            color: C.soft,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {kpi.qualifier}
        </span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function KpiRow() {
  const { counts, quality, attention } = useDashboard();

  /* `live` viene del SERVIDOR y no se recompone sumando tramos: «abierto» y
     «vencido» se solapan, así que la suma contaba dos veces el mismo ticket y
     todos estos porcentajes salían sobre un total inflado. */
  const live = counts.live;
  const pct = (v: number) => (live === 0 ? "—" : `${Math.round((v / live) * 100)}% de los vivos`);

  const kpis: Kpi[] = [
    {
      label: "Fuera de plazo",
      role: "vencido",
      icon: AlertTriangle,
      count: counts.overdue,
      qualifier: pct(counts.overdue),
      // Cuánto lleva esperando el peor caso. Diez vencidos de ayer y diez de
      // hace tres semanas son el mismo número y no son el mismo problema.
      hint:
        attention.oldestOverdueDays === null
          ? null
          : {
              icon: History,
              text: `${n(attention.oldestOverdueDays)} d el más viejo`,
              urgent: attention.oldestOverdueDays >= 1,
            },
      filter: { kind: "estado", value: "vencidos", label: "los tickets vencidos" },
    },
    {
      label: "Por vencer",
      role: "porVencer",
      icon: Clock,
      count: counts.upcoming,
      qualifier: pct(counts.upcoming),
      // La emergencia dentro de la ventana de 24 h: lo que hay que tocar ya.
      hint:
        attention.dueWithin2h === 0
          ? null
          : { icon: AlarmClock, text: `${n(attention.dueWithin2h)} en 2 h`, urgent: true },
      filter: { kind: "estado", value: "por-vencer", label: "los tickets por vencer" },
    },
    {
      label: "Abiertos",
      role: "abierto",
      icon: Inbox,
      count: counts.open,
      qualifier: pct(counts.open),
      // Trabajo que nadie tomó. No está atrasado todavía, y por eso no aparece
      // en ninguna otra cifra de esta fila.
      hint:
        attention.unassigned === 0
          ? null
          : { icon: UserX, text: `${n(attention.unassigned)} sin asignar`, urgent: true },
      filter: { kind: "estado", value: "abiertos", label: "los tickets abiertos" },
    },
    {
      label: "En espera",
      role: "espera",
      icon: PauseCircle,
      count: counts.waitingOnClient,
      qualifier: "del cliente",
      // Esperar al cliente es normal; esperar una semana es una fuga. El reloj
      // se cuenta desde que entró en espera, no desde que se creó.
      hint:
        attention.waitingOver7Days === 0
          ? null
          : {
              icon: History,
              text: `${n(attention.waitingOver7Days)} > 7 días`,
              urgent: true,
            },
      filter: { kind: "estado", value: "espera", label: "los tickets en espera del cliente" },
    },
    {
      label: "HCA abiertas",
      role: "hca",
      icon: ClipboardCheck,
      count: quality.openNow,
      // El acompañante ya dice cuántas están vencidas; repetirlo aquí gastaba
      // las dos líneas de la tarjeta en el mismo dato.
      qualifier: "hojas sin cerrar",
      hint:
        quality.overdueNow === 0
          ? null
          : { icon: AlertTriangle, text: `${n(quality.overdueNow)} vencidas`, urgent: true },
      filter: { kind: "hca", value: "abiertas", label: "las HCA abiertas" },
    },
  ];

  return (
    <div
      className="cx-kpis"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: S.md,
        alignItems: "stretch",
      }}
    >
      {kpis.map((kpi, index) => (
        <KpiCard key={kpi.label} kpi={kpi} index={index} />
      ))}
    </div>
  );
}
