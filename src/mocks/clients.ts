/**
 * Datos de prueba del modulo de Clientes.
 *
 * Existe solo mientras el backend no expone /api/clients/... Los datos incluyen
 * a proposito los casos que activan las guardas de la seccion 7.3: un cliente
 * con tickets (no se elimina), uno sin vendedor asignado, y un cliente con dos
 * contactos para probar que marcar uno como principal desmarca al otro.
 */
import type { Client, Contact, Territory } from "../types/clients";

/** Vendedores: mismo universo de personal que el modulo de Personal, recortado
 *  a lo que esta pantalla necesita mostrar sin depender de esa API real. */
const salesReps = [
  { id: 1, name: "Yordy Acosta" },
  { id: 2, name: "Richard De León" },
  { id: 3, name: "Carla Ventura" },
];

const territories: Territory[] = [
  { id: 1, name: "Santo Domingo", code: "SDQ", isActive: true, clientCount: 1 },
  { id: 2, name: "Santiago", code: "STI", isActive: true, clientCount: 1 },
  { id: 3, name: "Este", code: "EST", isActive: true, clientCount: 2 },
  { id: 4, name: "Sur", code: "SUR", isActive: false, clientCount: 1 },
];

const clients: Client[] = [
  {
    id: 1,
    code: "CL-0001",
    name: "Distribuidora del Este, S. R. L.",
    taxId: "1-01-23456-7",
    type: "Distribuidor",
    territoryId: 3,
    salesRepStaffId: 1,
    phone: "809-555-0142",
    email: "compras@distribueste.com.do",
    address: "Av. España km 12, San Pedro de Macorís",
    notes: null,
    isActive: true,
    ticketCount: 14,
  },
  {
    id: 2,
    code: "CL-0002",
    name: "Supermercados La Cadena",
    taxId: "1-30-98765-2",
    type: "Mayorista",
    territoryId: 1,
    salesRepStaffId: 2,
    phone: "809-555-0198",
    email: "logistica@lacadena.do",
    address: null,
    notes: "Pide factura consolidada mensual.",
    isActive: true,
    ticketCount: 0,
  },
  {
    id: 3,
    code: "CL-0003",
    name: "Ferretería Reyes",
    taxId: null,
    type: "Detallista",
    territoryId: 2,
    salesRepStaffId: null,
    phone: "829-555-0110",
    email: null,
    address: "Calle Duarte 45, Santiago",
    notes: null,
    isActive: true,
    ticketCount: 3,
  },
  {
    id: 4,
    code: "CL-0004",
    name: "Ayuntamiento de Higüey",
    taxId: "4-01-11223-9",
    type: "Institucional",
    territoryId: 3,
    salesRepStaffId: 3,
    phone: null,
    email: "compras@ayuntamientohiguey.gob.do",
    address: null,
    notes: "Requiere orden de compra antes de facturar.",
    isActive: true,
    ticketCount: 0,
  },
  {
    id: 5,
    code: "CL-0005",
    name: "Colmados Unidos del Sur",
    taxId: null,
    type: "Detallista",
    territoryId: 4,
    salesRepStaffId: null,
    phone: "809-555-0177",
    email: "pedidos@colmadosunidos.do",
    address: null,
    notes: null,
    isActive: false,
    ticketCount: 0,
  },
];

const contacts: Contact[] = [
  {
    id: 1,
    clientId: 1,
    firstName: "María",
    lastName: "Reyes",
    email: "maria.reyes@distribueste.com.do",
    phone: "809-555-0143",
    position: "Encargada de compras",
    isPrimary: true,
    isActive: true,
  },
  {
    id: 2,
    clientId: 1,
    firstName: "Luis",
    lastName: "Feliz",
    email: "luis.feliz@distribueste.com.do",
    phone: null,
    position: "Recepción de almacén",
    isPrimary: false,
    isActive: true,
  },
  {
    id: 3,
    clientId: 2,
    firstName: "Ana",
    lastName: "Peña",
    email: "ana.pena@lacadena.do",
    phone: "809-555-0199",
    position: "Gerente de logística",
    isPrimary: true,
    isActive: true,
  },
];

function delay<T>(value: T, ms = 240): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const clientsMock = {
  salesReps: () => clone(salesReps),
  territories: (): Promise<Territory[]> => delay(clone(territories)),
  clients: (): Promise<Client[]> => delay(clone(clients)),
  contacts: (clientId: number): Promise<Contact[]> =>
    delay(clone(contacts.filter((contact) => contact.clientId === clientId))),
  /** Sincrono y agrupado: el listado pinta el avatar de contactos de todas las
   *  filas a la vez, y pedirlo cliente por cliente seria un N+1. */
  contactsByClient(): Record<number, Contact[]> {
    const grouped: Record<number, Contact[]> = {};
    for (const contact of clone(contacts)) {
      (grouped[contact.clientId] ??= []).push(contact);
    }
    return grouped;
  },
};
