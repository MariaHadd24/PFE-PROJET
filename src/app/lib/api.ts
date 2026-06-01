type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL ?? '/api';

async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getActorHeaders(): Record<string, string> {
  try {
    const email = String(localStorage.getItem('leoni-auth-current-email') ?? '').trim();
    const role = String(localStorage.getItem('leoni-auth-current-role') ?? '').trim();
    const name = String(localStorage.getItem('leoni-auth-current-name') ?? '').trim();

    const headers: Record<string, string> = {};
    if (email) headers['X-Actor-Email'] = email;
    if (role) headers['X-Actor-Role'] = role;
    if (name) headers['X-Actor-Name'] = name;
    return headers;
  } catch {
    return {};
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...getActorHeaders(),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const body = await readJsonSafe(res);
    const message = typeof body === 'string' ? body : body?.detail ?? body?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return (await readJsonSafe(res)) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' satisfies HttpMethod });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST' satisfies HttpMethod, body: JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH' satisfies HttpMethod, body: JSON.stringify(body) });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' satisfies HttpMethod });
}

export async function apiPostFormData<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getActorHeaders(),
      ...(init?.headers ?? {}),
    },
    body: formData,
    ...init,
  });

  if (!res.ok) {
    const body = await readJsonSafe(res);
    const message = typeof body === 'string' ? body : body?.detail ?? body?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return (await readJsonSafe(res)) as T;
}

export type PdfHistoryUploadResult = {
  ok: true;
  file: string;
  size?: string;
  date?: string;
};

export async function uploadPdfToHistory(pdf: File, source: string = 'upload', entityId?: string): Promise<PdfHistoryUploadResult> {
  const src = String(source || 'upload').trim() || 'upload';
  const id = String(entityId || '').trim();

  const fileName = id ? `${id}_${pdf.name || 'document.pdf'}` : (pdf.name || 'document.pdf');
  const form = new FormData();
  form.append('file', pdf, fileName);

  const qs = new URLSearchParams({ source: src });
  return apiPostFormData<PdfHistoryUploadResult>(`/pdfs/upload?${qs.toString()}`, form);
}
