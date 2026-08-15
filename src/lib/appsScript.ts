import 'server-only';

/**
 * Server-only bridge to the Apps Script web app. APPS_SCRIPT_URL and
 * APPS_SCRIPT_SHARED_SECRET are read from process.env and never sent
 * to the client — every file that imports this module is guaranteed
 * (by the `server-only` package) to fail the build if it's ever
 * pulled into a client component.
 */

const TIMEOUT_MS = 10_000;

class AppsScriptError extends Error {}

function getConfig() {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!url || !secret) {
    throw new AppsScriptError(
      'Apps Script is not configured. Set APPS_SCRIPT_URL and APPS_SCRIPT_SHARED_SECRET.'
    );
  }
  return { url, secret };
}

async function request(params: Record<string, string>, method: 'GET' | 'POST'): Promise<unknown> {
  const { url, secret } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let res: Response;
    if (method === 'GET') {
      const target = new URL(url);
      for (const [key, value] of Object.entries({ ...params, secret })) {
        target.searchParams.set(key, value);
      }
      res = await fetch(target.toString(), {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
    } else {
      res = await fetch(url, {
        method: 'POST',
        // text/plain avoids a CORS preflight if this is ever called
        // cross-origin; Apps Script parses the JSON body regardless.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...params, secret }),
        signal: controller.signal,
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      throw new AppsScriptError(`Apps Script responded with HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof AppsScriptError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppsScriptError('Apps Script did not respond in time.');
    }
    throw new AppsScriptError('Could not reach Apps Script.');
  } finally {
    clearTimeout(timeout);
  }
}

export function appsScriptGet<T>(params: Record<string, string>): Promise<T> {
  return request(params, 'GET') as Promise<T>;
}

export function appsScriptPost<T>(params: Record<string, string>): Promise<T> {
  return request(params, 'POST') as Promise<T>;
}

export { AppsScriptError };
