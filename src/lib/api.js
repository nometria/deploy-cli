/**
 * HTTP client for the Deno function endpoints at app.nometria.com.
 * All CLI calls go through the Deno function layer, NOT the Python backend.
 * Uses native fetch (Node 18+).
 */

const DEFAULT_API_URL = 'https://app.nometria.com';

function getBaseUrl() {
  return process.env.NOMETRIA_API_URL || DEFAULT_API_URL;
}

/**
 * Make a JSON POST request to a Deno function endpoint.
 * The API key is included in the request body (not as a Bearer token),
 * because CLI functions use body-based auth via cli_api_keys table.
 */
export async function apiRequest(path, { method = 'POST', body = {}, apiKey } = {}) {
  const url = `${getBaseUrl()}${path}`;

  // Include api_key in the body for CLI auth
  const payload = apiKey ? { ...body, api_key: apiKey } : body;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'nom-cli',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const raw = await res.json();
      // server.js wraps errors in { data: { error: ... } }
      const data = raw?.data || raw;
      message = data.detail || data.message || data.error || message;
    } catch { /* ignore parse errors */ }
    const err = new Error(message);
    err.status = res.status;
    if (res.status === 401) err.code = 'ERR_AUTH';
    throw err;
  }

  // server.js wraps all JSON responses in { data: ... } — unwrap automatically
  const raw = await res.json();
  return raw?.data !== undefined ? raw.data : raw;
}

/**
 * Upload a file to the Deno /cli/upload endpoint using multipart form data.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(apiKey, fileBuffer, fileName = 'code.tar.gz') {
  const url = `${getBaseUrl()}/cli/upload`;

  // Use FormData for multipart upload
  const { FormData, Blob } = globalThis;
  const formData = new FormData();
  formData.append('api_key', apiKey);
  formData.append('file', new Blob([fileBuffer], { type: 'application/gzip' }), fileName);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': 'nom-cli' },
    body: formData,
  });

  if (!res.ok) {
    let message = `Upload failed: ${res.status}`;
    try {
      const raw = await res.json();
      const data = raw?.data || raw;
      message = data.error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const raw = await res.json();
  return raw?.data !== undefined ? raw.data : raw;
}

export { getBaseUrl };
