const DEFAULT_BASE_URL = "/api";

function resolveBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (!envBase) {
    return DEFAULT_BASE_URL;
  }
  return envBase.endsWith("/") ? envBase.slice(0, -1) : envBase;
}

const API_BASE_URL = resolveBaseUrl();

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  parseJson: boolean = true
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const contentType = response.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      const message =
        (data && (data.error ?? data.message)) ||
        `Request failed (${response.status} ${response.statusText})`;
      throw new Error(message);
    }
    const bodyText = await response.text();
    throw new Error(
      bodyText || `Request failed (${response.status} ${response.statusText})`
    );
  }

  if (!parseJson) {
    return (await response.text()) as unknown as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected JSON response from API.");
  }

  return (await response.json()) as T;
}

export async function downloadApiFile(path: string, fallbackFilename: string): Promise<void> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Download failed (${response.status} ${response.statusText})`);
  }

  let filename = fallbackFilename;
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (match?.[1]) {
    filename = decodeURIComponent(match[1]);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

