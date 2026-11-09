import { auth } from "./auth";
import { modeKey, type MonitoringMode } from "../lib/monitoring";
let mode: MonitoringMode = "real";
let generation = 0;
const saved = new Map<string, MonitoringMode>();
const listeners = new Set<() => void>();
function read() {
  const username = auth.username;
  if (!username) return "real";
  if (saved.has(username)) return saved.get(username)!;
  try {
    const value = localStorage.getItem(modeKey(username));
    if (value === "demo" || value === "real") return value;
  } catch {
    /* session only */
  }
  return saved.get(username) ?? "real";
}
mode = read();
function notify() {
  generation++;
  listeners.forEach((f) => f());
}
auth.onChange(() => {
  mode = read();
  notify();
});
export const presentation = {
  get: () => mode,
  get generation() {
    return generation;
  },
  subscribe(f: () => void) {
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  },
  set(value: MonitoringMode) {
    mode = value;
    let persisted = true;
    if (auth.username) {
      saved.set(auth.username, value);
      try {
        localStorage.setItem(modeKey(auth.username), value);
      } catch {
        persisted = false;
      }
    }
    notify();
    return persisted;
  },
};
