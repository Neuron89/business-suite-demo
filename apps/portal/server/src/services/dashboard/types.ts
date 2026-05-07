/**
 * Shared shape for every dashboard widget data source. The frontend is built
 * around this — a widget always knows how to render `not_configured`,
 * `error`, and `ok` states. When the user wires real credentials tomorrow,
 * each integration just starts returning `ok` with real data.
 */
export type WidgetState = 'ok' | 'not_configured' | 'error';

export interface WidgetEnvelope<T> {
  state: WidgetState;
  /** Human-readable hint shown on the widget when state !== 'ok'. */
  message?: string;
  data?: T;
  /** ISO timestamp the data was fetched (server side). */
  refreshed_at: string;
}

export function notConfigured<T>(message: string): WidgetEnvelope<T> {
  return { state: 'not_configured', message, refreshed_at: new Date().toISOString() };
}

export function ok<T>(data: T): WidgetEnvelope<T> {
  return { state: 'ok', data, refreshed_at: new Date().toISOString() };
}

export function err<T>(message: string): WidgetEnvelope<T> {
  return { state: 'error', message, refreshed_at: new Date().toISOString() };
}
