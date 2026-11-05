// ============================================================
// AgriSweep — Firebase Realtime Database Service
// Lightweight RTDB client built on the REST API so it runs in
// Expo Go and on the web without native Firebase modules.
//
// - Live telemetry: Server-Sent Events stream of `/system`
//   (read through XMLHttpRequest progress events, which both
//   React Native and browsers support), with automatic fallback
//   to REST polling if streaming repeatedly fails.
// - Commands: multi-path PATCH writes to `/system`.
// - Reconnects with exponential backoff.
//
// Paths match esp32_firmware.ino and firebase_db_structure.json.
// ============================================================

import { APP_CONFIG } from '../constants/config';
import {
  FirebaseCommandPatch,
  FirebaseConfig,
  FirebaseConnectionState,
  FirebasePingResult,
  FirebaseSystemConfig,
  FirebaseSystemSnapshot,
  JsonObject,
  JsonValue,
} from '../types';

type DataListener = (snapshot: FirebaseSystemSnapshot) => void;
type StateListener = (state: FirebaseConnectionState, error: string | null) => void;
type FailureKind = 'offline' | 'error';

// Recycle the stream once the XHR buffer grows past this size,
// since `responseText` keeps every byte received on the connection.
const MAX_STREAM_BYTES = 512 * 1024;
// Streaming failures in a row before falling back to polling.
const STREAM_FAILURES_BEFORE_POLLING = 3;

class FirebaseRequestError extends Error {
  constructor(message: string, public readonly kind: FailureKind) {
    super(message);
  }
}

// ---- URL helpers ----

export function normalizeDatabaseUrl(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, '').replace(/\.json$/, '');
  if (trimmed && !/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  return trimmed;
}

function buildUrl(config: FirebaseConfig, path: string, query: Record<string, string> = {}): string {
  const params = { ...query };
  if (config.authToken.trim()) params.auth = config.authToken.trim();
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${normalizeDatabaseUrl(config.databaseUrl)}/${path}.json${qs ? `?${qs}` : ''}`;
}

function describeHttpFailure(status: number, body: string): FirebaseRequestError {
  let serverMessage = '';
  try {
    const parsed: JsonValue = JSON.parse(body);
    if (isObject(parsed) && typeof parsed.error === 'string') serverMessage = parsed.error;
  } catch {
    // Non-JSON body; ignore.
  }

  if (status === 0) {
    return new FirebaseRequestError('Cannot reach the database. Check the internet connection and URL.', 'offline');
  }
  if (status === 401 || status === 403) {
    return new FirebaseRequestError('Permission denied. Check the auth token and database rules.', 'error');
  }
  if (status === 404) {
    return new FirebaseRequestError('Database not found. Check the database URL.', 'error');
  }
  if (status === 423) {
    return new FirebaseRequestError('Database is disabled in the Firebase console.', 'error');
  }
  return new FirebaseRequestError(`HTTP ${status}${serverMessage ? `: ${serverMessage}` : ''}`, 'error');
}

// ---- JSON tree helpers ----

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setIn(node: JsonValue, segments: string[], value: JsonValue): JsonValue {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  const copy: JsonObject = isObject(node) ? { ...node } : {};
  copy[head] = setIn(copy[head] ?? null, rest, value);
  return copy;
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function asNumber(value: JsonValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asBoolean(value: JsonValue | undefined): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 'true') return true;
  if (value === 0 || value === 'false') return false;
  return null;
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

export function parseSystemSnapshot(tree: JsonValue): FirebaseSystemSnapshot {
  const system = isObject(tree) ? tree : {};
  const scraper = isObject(system.scraper) ? system.scraper : {};
  const pump = isObject(system.pump) ? system.pump : {};
  const controls = isObject(system.controls) ? system.controls : {};
  const config = isObject(system.config) ? system.config : {};

  const parsedConfig: Partial<FirebaseSystemConfig> = {};
  const maxScraperRuntimeMs = asNumber(config.maxScraperRuntimeMs);
  const pumpDurationMs = asNumber(config.pumpDurationMs);
  const ammoniaWarningThreshold = asNumber(config.ammoniaWarningThreshold);
  const binWarningDistanceCm = asNumber(config.binWarningDistanceCm);
  if (maxScraperRuntimeMs !== null) parsedConfig.maxScraperRuntimeMs = maxScraperRuntimeMs;
  if (pumpDurationMs !== null) parsedConfig.pumpDurationMs = pumpDurationMs;
  if (ammoniaWarningThreshold !== null) parsedConfig.ammoniaWarningThreshold = ammoniaWarningThreshold;
  if (binWarningDistanceCm !== null) parsedConfig.binWarningDistanceCm = binWarningDistanceCm;

  return {
    status: asString(system.status),
    operatingMode: asString(system.operatingMode),
    ammoniaRaw: asNumber(system.ammoniaRaw),
    ammoniaLevel: asNumber(system.ammoniaLevel),
    distanceCm: asNumber(system.distanceCm),
    binCapacity: asNumber(system.binCapacity),
    lastUpdated: asNumber(system.lastUpdated),
    lastCleaningCycleTime: asNumber(system.lastCleaningCycleTime),
    manualCleanTrigger: asBoolean(system.manualCleanTrigger) ?? false,
    scraper: {
      running: asBoolean(scraper.running),
      direction: asString(scraper.direction),
      stage: asString(scraper.stage),
      limitSwitchForward: asBoolean(scraper.limitSwitchForward),
      limitSwitchReverse: asBoolean(scraper.limitSwitchReverse),
      fault: asString(scraper.fault),
    },
    pump: {
      active: asBoolean(pump.active),
      runtimeMs: asNumber(pump.runtimeMs),
      fault: asString(pump.fault),
    },
    controls: {
      manualScraperForward: asBoolean(controls.manualScraperForward) ?? false,
      manualScraperReverse: asBoolean(controls.manualScraperReverse) ?? false,
      manualPumpTrigger: asBoolean(controls.manualPumpTrigger) ?? false,
      emergencyStop: asBoolean(controls.emergencyStop) ?? false,
    },
    config: parsedConfig,
  };
}

// ---- Service ----

class FirebaseService {
  private config: FirebaseConfig = { databaseUrl: '', authToken: '' };
  private state: FirebaseConnectionState = 'idle';
  private lastError: string | null = null;
  private tree: JsonValue = null;
  private dataListeners = new Set<DataListener>();
  private stateListeners = new Set<StateListener>();

  private running = false;
  private usePolling = false;
  private streamFailures = 0;
  private retryAttempt = 0;
  // Bumped on every teardown so callbacks from stale connections are ignored.
  private generation = 0;

  private xhr: XMLHttpRequest | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Public API ----

  configure(config: FirebaseConfig): void {
    const next: FirebaseConfig = {
      databaseUrl: normalizeDatabaseUrl(config.databaseUrl),
      authToken: config.authToken.trim(),
    };
    const changed =
      next.databaseUrl !== this.config.databaseUrl || next.authToken !== this.config.authToken;
    this.config = next;
    if (changed && this.running) {
      this.stop();
      this.start();
    }
  }

  isConfigured(): boolean {
    return this.config.databaseUrl.length > 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.usePolling = false;
    this.streamFailures = 0;
    this.retryAttempt = 0;
    if (!this.isConfigured()) {
      this.setState('error', 'No database URL configured. Add it in Settings.');
      return;
    }
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.teardown();
    this.tree = null;
    this.setState('idle', null);
  }

  /** One-shot REST read of `/system`, e.g. for pull-to-refresh. */
  async refresh(): Promise<void> {
    if (!this.isConfigured()) return;
    const gen = this.generation;
    const json = await this.request('GET', 'system');
    if (gen !== this.generation) return;
    this.tree = json;
    this.emitData();
  }

  onData(callback: DataListener): () => void {
    this.dataListeners.add(callback);
    if (this.tree !== null) callback(parseSystemSnapshot(this.tree));
    return () => {
      this.dataListeners.delete(callback);
    };
  }

  onStateChange(callback: StateListener): () => void {
    this.stateListeners.add(callback);
    callback(this.state, this.lastError);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  getState(): FirebaseConnectionState {
    return this.state;
  }

  /** Writes control flags with one atomic multi-path PATCH on `/system`. */
  async sendCommand(patch: FirebaseCommandPatch): Promise<void> {
    await this.request('PATCH', 'system', patch);
  }

  async writeConfig(config: Partial<FirebaseSystemConfig>): Promise<void> {
    await this.request('PATCH', 'system/config', config);
  }

  /** Measures round-trip time to the database without downloading the whole tree. */
  async ping(config: FirebaseConfig = this.config): Promise<FirebasePingResult> {
    if (!normalizeDatabaseUrl(config.databaseUrl)) {
      return { ok: false, latencyMs: null, hasSystemNode: false, error: 'Enter a database URL first.' };
    }
    const started = Date.now();
    try {
      const json = await this.request('GET', 'system', undefined, { shallow: 'true' }, config);
      return { ok: true, latencyMs: Date.now() - started, hasSystemNode: json !== null, error: null };
    } catch (e) {
      return {
        ok: false,
        latencyMs: null,
        hasSystemNode: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  // ---- Connection lifecycle ----

  private connect(): void {
    this.teardown();
    if (!this.running) return;
    if (this.state !== 'online') this.setState('connecting', this.lastError);
    if (this.usePolling) {
      this.poll();
    } else {
      this.openStream();
    }
  }

  private teardown(): void {
    this.generation++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.retryTimer = null;
    this.watchdogTimer = null;
    this.pollTimer = null;
    if (this.xhr) {
      this.xhr.onprogress = null;
      this.xhr.onreadystatechange = null;
      this.xhr.abort();
      this.xhr = null;
    }
  }

  private handleFailure(message: string, kind: FailureKind): void {
    this.teardown();
    if (!this.running) return;
    if (!this.usePolling) {
      this.streamFailures++;
      if (this.streamFailures >= STREAM_FAILURES_BEFORE_POLLING && kind === 'offline') {
        this.usePolling = true;
      }
    }
    this.setState(kind, message);
    const delay = Math.min(1000 * 2 ** this.retryAttempt, APP_CONFIG.firebaseMaxBackoffMs);
    this.retryAttempt++;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private markOnline(): void {
    this.retryAttempt = 0;
    this.streamFailures = 0;
    if (this.state !== 'online' || this.lastError !== null) this.setState('online', null);
  }

  // ---- SSE streaming ----

  private openStream(): void {
    const gen = this.generation;
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let buffer = '';

    xhr.open('GET', buildUrl(this.config, 'system'));
    xhr.setRequestHeader('Accept', 'text/event-stream');

    xhr.onprogress = () => {
      if (gen !== this.generation) return;
      const text = xhr.responseText;
      buffer += text.slice(cursor).replace(/\r\n/g, '\n');
      cursor = text.length;
      this.armWatchdog();

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        this.handleSseEvent(buffer.slice(0, boundary));
        if (gen !== this.generation) return; // event handler tore the stream down
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }

      if (cursor > MAX_STREAM_BYTES) this.connect();
    };

    xhr.onreadystatechange = () => {
      if (gen !== this.generation || xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        // Server closed a healthy stream; reconnect right away.
        this.connect();
      } else {
        const err = describeHttpFailure(xhr.status, xhr.responseText);
        this.handleFailure(err.message, err.kind);
      }
    };

    this.xhr = xhr;
    xhr.send();
    this.armWatchdog();
  }

  private armWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(
      () => this.handleFailure('Live stream stalled. Reconnecting…', 'offline'),
      APP_CONFIG.firebaseStreamWatchdogMs
    );
  }

  private handleSseEvent(raw: string): void {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.join('\n');

    switch (event) {
      case 'put':
      case 'patch': {
        let payload: JsonValue;
        try {
          payload = JSON.parse(data);
        } catch {
          return;
        }
        if (!isObject(payload) || typeof payload.path !== 'string') return;
        const segments = splitPath(payload.path);
        const value = payload.data ?? null;
        if (event === 'put') {
          this.tree = setIn(this.tree, segments, value);
        } else if (isObject(value)) {
          for (const [key, child] of Object.entries(value)) {
            this.tree = setIn(this.tree, [...segments, ...splitPath(key)], child);
          }
        }
        this.markOnline();
        this.emitData();
        return;
      }
      case 'keep-alive':
        this.markOnline();
        return;
      case 'cancel':
        this.handleFailure('Permission denied. Check the auth token and database rules.', 'error');
        return;
      case 'auth_revoked':
        this.handleFailure('Auth token expired or was revoked. Update it in Settings.', 'error');
        return;
      default:
        return;
    }
  }

  // ---- Polling fallback ----

  private poll(): void {
    const gen = this.generation;
    this.request('GET', 'system')
      .then((json) => {
        if (gen !== this.generation) return;
        this.tree = json;
        this.markOnline();
        this.emitData();
        this.pollTimer = setTimeout(() => this.poll(), APP_CONFIG.firebasePollIntervalMs);
      })
      .catch((e: unknown) => {
        if (gen !== this.generation) return;
        if (e instanceof FirebaseRequestError) this.handleFailure(e.message, e.kind);
        else this.handleFailure('Cannot reach the database.', 'offline');
      });
  }

  // ---- REST ----

  private async request(
    method: 'GET' | 'PATCH' | 'PUT',
    path: string,
    body?: FirebaseCommandPatch | Partial<FirebaseSystemConfig>,
    query: Record<string, string> = {},
    config: FirebaseConfig = this.config
  ): Promise<JsonValue> {
    if (!normalizeDatabaseUrl(config.databaseUrl)) {
      throw new FirebaseRequestError('No database URL configured. Add it in Settings.', 'error');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.connectionTimeoutMs);
    let response: Response;
    try {
      response = await fetch(buildUrl(config, path, query), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new FirebaseRequestError(
        controller.signal.aborted
          ? 'Request timed out. The database did not respond.'
          : 'Cannot reach the database. Check the internet connection and URL.',
        'offline'
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    if (!response.ok) throw describeHttpFailure(response.status, text);
    try {
      return text ? (JSON.parse(text) as JsonValue) : null;
    } catch {
      return null;
    }
  }

  // ---- Listeners ----

  private setState(state: FirebaseConnectionState, error: string | null): void {
    this.state = state;
    this.lastError = error;
    this.stateListeners.forEach((cb) => cb(state, error));
  }

  private emitData(): void {
    const snapshot = parseSystemSnapshot(this.tree);
    this.dataListeners.forEach((cb) => cb(snapshot));
  }
}

export const firebaseService = new FirebaseService();
export default firebaseService;
