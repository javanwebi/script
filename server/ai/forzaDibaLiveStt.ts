import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { WebSocket, WebSocketServer } from 'ws';
import { selectForzaSttProvider } from './forzaSttProvider';

type LiveWorker = {
  child: ChildProcessWithoutNullStreams;
  ready: boolean;
  failed: boolean;
  readyPromise: Promise<void>;
  sessions: Map<string, WebSocket>;
};

const WORKER_SCRIPT = path.resolve(process.cwd(), 'scripts/forza_diba_live_worker.py');
const MAX_SESSIONS = 40;

function modelPath(): string {
  return process.env.FORZA_STT_DIBA_MODEL_PATH || '/opt/diba-stt/model';
}
function pythonPath(): string {
  return process.env.FORZA_STT_PYTHON || '/opt/forza-pocket/bin/python';
}
function workerCount(): number {
  return Math.max(1, Math.min(4, Number(process.env.FORZA_STT_LIVE_WORKERS || 4) || 4));
}
function sessionsPerWorker(): number {
  return Math.ceil(MAX_SESSIONS / workerCount());
}
const MAX_STDIN_BUFFER = 512 * 1024;
const workers: LiveWorker[] = [];
let warmPromise: Promise<boolean> | null = null;
let warmAttemptAt = 0;

function providerEnabled(): boolean {
  return selectForzaSttProvider(process.env).provider === 'diba' &&
    existsSync(path.join(modelPath(), 'am')) &&
    existsSync(path.join(modelPath(), 'conf'));
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]);
  return Buffer.from(data as ArrayBuffer);
}

function send(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify(payload)); } catch {}
}

function closeSession(worker: LiveWorker, streamId: string, cancel = true): void {
  const socket = worker.sessions.get(streamId);
  if (!socket) return;
  worker.sessions.delete(streamId);
  if (cancel && !worker.failed && worker.child.exitCode === null) {
    writeWorker(worker, { type: 'cancel', streamId });
  }
}

function failWorker(worker: LiveWorker, code: string): void {
  if (worker.failed) return;
  worker.failed = true;
  worker.ready = false;
  for (const [streamId, socket] of worker.sessions) {
    send(socket, { type: 'error', code });
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, 'Diba worker unavailable');
    worker.sessions.delete(streamId);
  }
}

function writeWorker(worker: LiveWorker, payload: Record<string, unknown>): boolean {
  if (worker.failed || worker.child.exitCode !== null || worker.child.stdin.destroyed) return false;
  if (worker.child.stdin.writableLength > MAX_STDIN_BUFFER) return false;
  try {
    worker.child.stdin.write(JSON.stringify(payload) + '\n', error => {
      if (error) failWorker(worker, 'diba_stream_worker_write_failed');
    });
    return true;
  } catch {
    failWorker(worker, 'diba_stream_worker_write_failed');
    return false;
  }
}

function startWorker(): LiveWorker {
  const child = spawn(pythonPath(), [WORKER_SCRIPT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORZA_STT_DIBA_MODEL_PATH: modelPath(),
      FORZA_STT_LIVE_SESSIONS_PER_WORKER: String(sessionsPerWorker()),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const worker: LiveWorker = {
    child,
    ready: false,
    failed: false,
    readyPromise: Promise.resolve(),
    sessions: new Map(),
  };

  worker.readyPromise = new Promise<void>((resolve, reject) => {
    const readyTimer = setTimeout(() => {
      failWorker(worker, 'diba_stream_worker_start_timeout');
      reject(new Error('diba_stream_worker_start_timeout'));
      child.kill('SIGKILL');
    }, 30_000);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let message: any;
      try { message = JSON.parse(line); } catch { return; }
      if (message?.type === 'ready') {
        worker.ready = true;
        clearTimeout(readyTimer);
        resolve();
        return;
      }
      const streamId = String(message?.streamId || '');
      if (!streamId) return;
      const socket = worker.sessions.get(streamId);
      if (!socket) return;
      if (message?.type === 'partial' || message?.type === 'final') {
        const text = String(message.text || '').trim();
        // Empty finals are meaningful result boundaries for the browser's
        // Diba admission state; do not drop them between worker and client.
        if (text || message.type === 'final') send(socket, { type: message.type, text, streamId });
      } else if (message?.type === 'error') {
        send(socket, { type: 'error', code: String(message.code || 'diba_stream_error') });
        closeSession(worker, streamId, false);
        if (socket.readyState === WebSocket.OPEN) socket.close(1011, 'Diba stream error');
      } else if (message?.type === 'ended') {
        send(socket, { type: 'ended', streamId });
        worker.sessions.delete(streamId);
      }
    });
    child.once('error', () => {
      clearTimeout(readyTimer);
      failWorker(worker, 'diba_stream_worker_process_error');
      reject(new Error('diba_stream_worker_process_error'));
    });
    child.once('exit', () => {
      clearTimeout(readyTimer);
      failWorker(worker, 'diba_stream_worker_exited');
      if (!worker.ready) reject(new Error('diba_stream_worker_exited'));
    });
    // Never echo Python decoder stderr into logs; it may contain request details.
    child.stderr.on('data', () => {});
  });
  return worker;
}

export function isForzaDibaLiveSttConfigured(): boolean {
  return providerEnabled();
}

export function isForzaDibaLiveSttReady(): boolean {
  return workers.some(worker => worker.ready && !worker.failed && worker.child.exitCode === null);
}

export async function warmForzaDibaLiveStt(): Promise<boolean> {
  if (!providerEnabled()) return false;
  const healthy = workers.filter(worker => worker.ready && !worker.failed && worker.child.exitCode === null);
  if (healthy.length >= workerCount()) return true;
  if (warmPromise) return warmPromise;
  if (Date.now() - warmAttemptAt < 3000 && workers.every(worker => worker.failed)) return false;
  warmAttemptAt = Date.now();
  warmPromise = (async () => {
    for (let index = workers.length - 1; index >= 0; index--) {
      const worker = workers[index];
      if (worker.failed || worker.child.exitCode !== null) workers.splice(index, 1);
    }
    while (workers.length < workerCount()) workers.push(startWorker());
    // Let the first healthy Diba process accept a live call immediately while
    // the remaining pool members continue warming in the background.
    const readiness = workers.map(worker => worker.readyPromise.then(() => true).catch(() => false));
    return await new Promise<boolean>(resolve => {
      let completed = 0;
      for (const ready of readiness) {
        ready.then(ok => {
          if (ok) { resolve(true); return; }
          completed += 1;
          if (completed === readiness.length) resolve(false);
        });
      }
    });
  })().catch(() => false).finally(() => { warmPromise = null; });
  return warmPromise;
}

function chooseWorker(): LiveWorker | null {
  return workers
    .filter(worker => worker.ready && !worker.failed && worker.child.exitCode === null &&
      worker.sessions.size < sessionsPerWorker())
    .sort((left, right) => left.sessions.size - right.sessions.size)[0] || null;
}

function rejectUpgrade(socket: import('node:stream').Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Attach a same-origin Diba streaming endpoint to the existing HTTP server. */
export function setupForzaDibaLiveSttWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  const connectionsPerIp = new Map<string, number>();
  let activeConnections = 0;

  server.on('upgrade', (request, socket, head) => {
    let url: URL;
    try { url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`); }
    catch { return; }
    if (url.pathname !== '/api/forza-stt-stream') return;

    const origin = request.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.host) {
          rejectUpgrade(socket, 403, 'Forbidden');
          return;
        }
      } catch {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });

  wss.on('connection', (socket, request) => {
    // Nginx sets X-Real-IP from $remote_addr; socket.remoteAddress alone
    // would collapse every visitor to 127.0.0.1 behind the reverse proxy.
    const ip = String(request.headers['x-real-ip'] || request.socket.remoteAddress || 'unknown').slice(0, 96);
    const activeForIp = connectionsPerIp.get(ip) || 0;
    if (activeConnections >= MAX_SESSIONS) {
      send(socket, { type: 'error', code: 'diba_stream_capacity_reached' });
      socket.close(1013, 'Diba stream capacity reached');
      return;
    }
    if (activeForIp >= MAX_SESSIONS) {
      send(socket, { type: 'error', code: 'diba_stream_ip_limit' });
      socket.close(1013, 'Too many Diba streams from this address');
      return;
    }
    activeConnections += 1;
    connectionsPerIp.set(ip, activeForIp + 1);
    let worker: LiveWorker | null = null;
    let streamId = '';
    let startPending = false;
    let closed = false;
    let handshakeTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = (cancel = true) => {
      if (closed) return;
      closed = true;
      if (handshakeTimer !== null) clearTimeout(handshakeTimer);
      handshakeTimer = null;
      activeConnections = Math.max(0, activeConnections - 1);
      if (worker && streamId) closeSession(worker, streamId, cancel);
      worker = null;
      streamId = '';
      const remaining = Math.max(0, (connectionsPerIp.get(ip) || 1) - 1);
      if (remaining) connectionsPerIp.set(ip, remaining);
      else connectionsPerIp.delete(ip);
    };
    handshakeTimer = setTimeout(() => {
      if (closed || worker || startPending) return;
      send(socket, { type: 'error', code: 'diba_stream_start_timeout' });
      cleanup(false);
      socket.close(1008, 'Diba stream start timed out');
    }, 10_000);

    socket.on('message', (data, isBinary) => {
      if (closed) return;
      if (isBinary) {
        if (!worker || !streamId) {
          send(socket, { type: 'error', code: 'diba_stream_not_started' });
          return;
        }
        const pcm = toBuffer(data);
        if (!pcm.length || pcm.length > 48_000 || pcm.length % 2) {
          send(socket, { type: 'error', code: 'invalid_pcm_chunk' });
          return;
        }
        if (worker.child.stdin.writableLength > MAX_STDIN_BUFFER) {
          send(socket, { type: 'error', code: 'diba_stream_overloaded' });
          socket.close(1013, 'Diba stream overloaded');
          cleanup();
          return;
        }
        if (!writeWorker(worker, { type: 'audio', streamId, pcmBase64: pcm.toString('base64') })) {
          send(socket, { type: 'error', code: 'diba_stream_worker_unavailable' });
          socket.close(1011, 'Diba worker unavailable');
          cleanup(false);
        }
        return;
      }

      let message: any;
      try { message = JSON.parse(toBuffer(data).toString('utf8')); }
      catch { send(socket, { type: 'error', code: 'invalid_stream_message' }); return; }

      if (message?.type === 'start') {
        if (worker || startPending) return;
        if (handshakeTimer !== null) clearTimeout(handshakeTimer);
        handshakeTimer = null;
        if (message.sampleRate !== 16000) {
          send(socket, { type: 'error', code: 'unsupported_sample_rate' });
          socket.close(1003, '16 kHz PCM required');
          cleanup(false);
          return;
        }
        startPending = true;
        send(socket, { type: 'warming' });
        void (async () => {
          if (!providerEnabled() || !(await warmForzaDibaLiveStt())) {
            send(socket, { type: 'error', code: 'diba_live_unavailable' });
            socket.close(1013, 'Diba live STT unavailable');
            cleanup(false);
            return;
          }
          if (closed || socket.readyState !== WebSocket.OPEN) return;
          const selected = chooseWorker();
          if (!selected || sessionsCount() >= MAX_SESSIONS) {
            send(socket, { type: 'error', code: 'diba_stream_capacity_reached' });
            socket.close(1013, 'Diba stream capacity reached');
            cleanup(false);
            return;
          }
          worker = selected;
          streamId = randomUUID();
          worker.sessions.set(streamId, socket);
          if (!writeWorker(worker, { type: 'start', streamId })) {
            worker.sessions.delete(streamId);
            worker = null;
            streamId = '';
            send(socket, { type: 'error', code: 'diba_stream_worker_unavailable' });
            socket.close(1011, 'Diba worker unavailable');
            cleanup(false);
            return;
          }
          startPending = false;
          send(socket, { type: 'ready', streamId, sampleRate: 16000 });
        })().catch(() => {
          send(socket, { type: 'error', code: 'diba_live_unavailable' });
          socket.close(1011, 'Diba live STT unavailable');
          cleanup(false);
        });
        return;
      }

      if (message?.type === 'stop' && worker && streamId) {
        writeWorker(worker, { type: 'end', streamId });
        cleanup(false);
      }
    });

    socket.on('close', () => cleanup(true));
    socket.on('error', () => cleanup(true));
    socket.on('pong', () => { (socket as any).isAlive = true; });
    (socket as any).isAlive = true;
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if ((socket as any).isAlive === false) {
        socket.terminate();
        continue;
      }
      (socket as any).isAlive = false;
      try { socket.ping(); } catch { socket.terminate(); }
    }
  }, 30_000);
  heartbeat.unref();
  const shutdown = () => {
    clearInterval(heartbeat);
    for (const worker of workers) {
      for (const [streamId, socket] of worker.sessions) {
        send(socket, { type: 'error', code: 'diba_server_shutdown' });
        if (socket.readyState === WebSocket.OPEN) socket.close(1012, 'Server restarting');
        worker.sessions.delete(streamId);
      }
      try { worker.child.stdin.end(); } catch {}
      try { worker.child.kill('SIGTERM'); } catch {}
    }
  };
  server.once('close', shutdown);
}

function sessionsCount(): number {
  return workers.reduce((total, worker) => total + worker.sessions.size, 0);
}
