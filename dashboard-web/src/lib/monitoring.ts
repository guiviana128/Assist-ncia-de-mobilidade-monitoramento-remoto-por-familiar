export type MonitoringMode = "real" | "demo";
export interface HomeAddress {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}
export interface HomeConfiguration {
  version: 1;
  address: HomeAddress;
  lat: number;
  lng: number;
  radius: number;
  confirmed: boolean;
}
export const emptyAddress: HomeAddress = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "SP",
};
export function homeValid(
  a: HomeAddress,
  point: { lat: number; lng: number },
  confirmed: boolean,
) {
  return (
    confirmed &&
    a.state === "SP" &&
    !!a.street.trim() &&
    !!a.number.trim() &&
    !!a.city.trim() &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -25.5 &&
    point.lat <= -19.5 &&
    point.lng >= -53.5 &&
    point.lng <= -44
  );
}
export function formatAddress(a: HomeAddress) {
  return `${a.street}, ${a.number}${a.complement ? " · " + a.complement : ""} · ${a.district ? a.district + " · " : ""}${a.city} / ${a.state}${a.cep ? " · CEP " + a.cep : ""}`;
}
export function readingFresh(value?: string | null, now = Date.now()) {
  const age = now - new Date(value ?? "").getTime();
  return Number.isFinite(age) && age >= -5000 && age <= 120000;
}
export interface Activity {
  state: "WAITING" | "STALE" | "MOVEMENT" | "OBSERVED" | "EMERGENCY";
  personName: string;
  room?: string;
  observedAt?: string;
  source?: string;
}
export function activityText(a: Activity) {
  if (a.state === "WAITING")
    return `Aguardando a primeira leitura de ${a.personName}`;
  if (a.state === "STALE") return `Última observação de ${a.personName}`;
  if (a.state === "EMERGENCY")
    return `Há um pedido de atenção para ${a.personName}`;
  if (a.state === "MOVEMENT")
    return `Movimento registrado para ${a.personName}`;
  return a.room
    ? `${a.personName}: última leitura ${a.room}`
    : `Leitura recebida de ${a.personName}`;
}
export function connectionOnline(
  id: string,
  c: { online: boolean; lastSeen?: string } | undefined,
  failed: boolean,
  now = Date.now(),
) {
  const ttl = id === "cane" ? 120000 : id === "robot" ? 5000 : 20000;
  const age = now - new Date(c?.lastSeen ?? "").getTime();
  return (
    !failed && !!c?.online && Number.isFinite(age) && age >= -5000 && age <= ttl
  );
}
export function modeKey(username: string) {
  return `amparo_monitoring_mode:${username.trim().toLowerCase()}`;
}
