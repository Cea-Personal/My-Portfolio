const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const MAX_DRIVE_FILE_BYTES = 25 * 1024 * 1024;

export interface StoredDriveToken {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  token_type: string;
  obtained_at: string;
}

export interface GoogleDriveChange {
  fileId: string;
  removed: boolean;
  permissionLost: boolean;
  file?:
    | {
        id: string;
        name: string;
        mimeType: string;
        version: string;
        modifiedTime?: string | undefined;
        md5Checksum?: string | undefined;
        trashed: boolean;
        parents?: string[];
      }
    | undefined;
}

export interface GoogleDriveChangePage {
  changes: GoogleDriveChange[];
  nextPageToken?: string | undefined;
  newStartPageToken?: string | undefined;
}

export interface GoogleDriveFilePage {
  changes: GoogleDriveChange[];
  nextPageToken?: string | undefined;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  modifiedTime?: string;
}

export async function getDriveFolder(
  accessToken: string,
  folderId: string
): Promise<GoogleDriveFolder> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(folderId)) throw new Error("DRIVE_FOLDER_INVALID");
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(folderId)}`);
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,trashed");
  url.searchParams.set("supportsAllDrives", "true");
  const folder = await driveJson(url, accessToken);
  if (
    folder.id !== folderId ||
    folder.mimeType !== "application/vnd.google-apps.folder" ||
    folder.trashed === true
  )
    throw new Error("DRIVE_SHARED_FOLDER_UNAVAILABLE");
  return {
    id: folderId,
    name: safeDriveName(folder.name, "Resumes"),
    ...(typeof folder.modifiedTime === "string" ? { modifiedTime: folder.modifiedTime } : {})
  };
}

function safeDriveName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : fallback;
}

async function driveJson(url: URL, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(20_000)
  });
  if (response.status === 401) throw new Error("DRIVE_TOKEN_REJECTED");
  if (response.status === 403) throw new Error("DRIVE_PERMISSION_DENIED");
  if (response.status === 429 || response.status >= 500) throw new Error("DRIVE_RETRYABLE_ERROR");
  if (!response.ok) throw new Error(`DRIVE_REQUEST_FAILED_${String(response.status)}`);
  return (await response.json()) as Record<string, unknown>;
}

export async function refreshDriveToken(
  token: StoredDriveToken,
  clientId: string,
  clientSecret: string
): Promise<StoredDriveToken> {
  if (!token.refresh_token) throw new Error("DRIVE_RECONNECT_REQUIRED");
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.access_token !== "string") {
    throw new Error(response.status >= 500 ? "DRIVE_RETRYABLE_ERROR" : "DRIVE_RECONNECT_REQUIRED");
  }
  return {
    access_token: payload.access_token,
    refresh_token: token.refresh_token,
    expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
    token_type: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
    obtained_at: new Date().toISOString()
  };
}

export function driveTokenNeedsRefresh(token: StoredDriveToken, now = Date.now()): boolean {
  if (!token.expires_in) return false;
  const obtainedAt = Date.parse(token.obtained_at);
  return !Number.isFinite(obtainedAt) || obtainedAt + token.expires_in * 1000 - 60_000 <= now;
}

export async function getDriveStartPageToken(accessToken: string): Promise<string> {
  const payload = await driveJson(
    new URL(`${DRIVE_API}/changes/startPageToken?spaces=drive`),
    accessToken
  );
  if (typeof payload.startPageToken !== "string") throw new Error("DRIVE_CURSOR_MISSING");
  return payload.startPageToken;
}

export async function listDriveChanges(
  accessToken: string,
  pageToken: string
): Promise<GoogleDriveChangePage> {
  const url = new URL(`${DRIVE_API}/changes`);
  url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("includeRemoved", "true");
  url.searchParams.set(
    "fields",
    "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,version,modifiedTime,md5Checksum,trashed,parents,capabilities(canDownload)))"
  );
  const payload = await driveJson(url, accessToken);
  const rawChanges = Array.isArray(payload.changes) ? payload.changes : [];
  const changes = rawChanges.flatMap((entry): GoogleDriveChange[] => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    if (typeof raw.fileId !== "string") return [];
    const fileRaw =
      raw.file && typeof raw.file === "object" ? (raw.file as Record<string, unknown>) : null;
    const capabilities =
      fileRaw?.capabilities && typeof fileRaw.capabilities === "object"
        ? (fileRaw.capabilities as Record<string, unknown>)
        : null;
    const removed = raw.removed === true || fileRaw?.trashed === true;
    const permissionLost = !removed && (!fileRaw || capabilities?.canDownload === false);
    const file = fileRaw
      ? {
          id: typeof fileRaw.id === "string" ? fileRaw.id : raw.fileId,
          name: safeDriveName(fileRaw.name, raw.fileId),
          mimeType:
            typeof fileRaw.mimeType === "string" ? fileRaw.mimeType : "application/octet-stream",
          version: typeof fileRaw.version === "string" ? fileRaw.version : "unknown",
          modifiedTime: typeof fileRaw.modifiedTime === "string" ? fileRaw.modifiedTime : undefined,
          md5Checksum: typeof fileRaw.md5Checksum === "string" ? fileRaw.md5Checksum : undefined,
          trashed: fileRaw.trashed === true,
          ...(Array.isArray(fileRaw.parents)
            ? {
                parents: fileRaw.parents.filter(
                  (value): value is string => typeof value === "string"
                )
              }
            : {})
        }
      : undefined;
    return [{ fileId: raw.fileId, removed, permissionLost, file }];
  });
  return {
    changes,
    nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined,
    newStartPageToken:
      typeof payload.newStartPageToken === "string" ? payload.newStartPageToken : undefined
  };
}

export async function listDriveFiles(
  accessToken: string,
  pageToken?: string,
  folderId?: string
): Promise<GoogleDriveFilePage> {
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set(
    "q",
    folderId
      ? `'${folderId.replace(/[^a-zA-Z0-9_-]/g, "")}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`
      : "trashed = false"
  );
  url.searchParams.set(
    "fields",
    "nextPageToken,files(id,name,mimeType,version,modifiedTime,md5Checksum,trashed,parents,capabilities(canDownload))"
  );
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  const payload = await driveJson(url, accessToken);
  const files = Array.isArray(payload.files) ? payload.files : [];
  const changes = files.flatMap((entry): GoogleDriveChange[] => {
    if (!entry || typeof entry !== "object") return [];
    const file = entry as Record<string, unknown>;
    if (typeof file.id !== "string") return [];
    const capabilities =
      file.capabilities && typeof file.capabilities === "object"
        ? (file.capabilities as Record<string, unknown>)
        : null;
    return [
      {
        fileId: file.id,
        removed: false,
        permissionLost: capabilities?.canDownload === false,
        file: {
          id: file.id,
          name: safeDriveName(file.name, file.id),
          mimeType: typeof file.mimeType === "string" ? file.mimeType : "application/octet-stream",
          version: typeof file.version === "string" ? file.version : "unknown",
          modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : undefined,
          md5Checksum: typeof file.md5Checksum === "string" ? file.md5Checksum : undefined,
          trashed: false,
          ...(Array.isArray(file.parents)
            ? {
                parents: file.parents.filter((value): value is string => typeof value === "string")
              }
            : {})
        }
      }
    ];
  });
  return {
    changes,
    nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined
  };
}

export async function listDriveFolders(accessToken: string): Promise<GoogleDriveFolder[]> {
  const url = new URL(`${DRIVE_API}/files`);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("q", "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  const payload = await driveJson(url, accessToken);
  return (Array.isArray(payload.files) ? payload.files : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const folder = entry as Record<string, unknown>;
    if (typeof folder.id !== "string" || typeof folder.name !== "string") return [];
    return [
      {
        id: folder.id,
        name: folder.name,
        ...(typeof folder.modifiedTime === "string" ? { modifiedTime: folder.modifiedTime } : {})
      }
    ];
  });
}

const GOOGLE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": { mimeType: "text/plain", extension: "txt" },
  "application/vnd.google-apps.spreadsheet": { mimeType: "text/csv", extension: "csv" },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/pdf",
    extension: "pdf"
  }
};

export async function downloadDriveFile(
  accessToken: string,
  file: NonNullable<GoogleDriveChange["file"]>
): Promise<{ bytes: Uint8Array; mimeType: string; filename: string }> {
  const exportFormat = GOOGLE_EXPORTS[file.mimeType];
  const url = exportFormat
    ? new URL(`${DRIVE_API}/files/${encodeURIComponent(file.id)}/export`)
    : new URL(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`);
  if (exportFormat) url.searchParams.set("mimeType", exportFormat.mimeType);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000)
  });
  if (response.status === 401) throw new Error("DRIVE_TOKEN_REJECTED");
  if (response.status === 403 || response.status === 404) throw new Error("DRIVE_PERMISSION_LOST");
  if (response.status === 429 || response.status >= 500) throw new Error("DRIVE_RETRYABLE_ERROR");
  if (!response.ok) throw new Error(`DRIVE_DOWNLOAD_FAILED_${String(response.status)}`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_DRIVE_FILE_BYTES) throw new Error("DRIVE_FILE_TOO_LARGE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DRIVE_FILE_BYTES) throw new Error("DRIVE_FILE_TOO_LARGE");
  const mimeType = exportFormat?.mimeType ?? response.headers.get("content-type") ?? file.mimeType;
  const filename = exportFormat ? `${file.name}.${exportFormat.extension}` : file.name;
  return { bytes, mimeType: mimeType.split(";")[0] ?? "application/octet-stream", filename };
}
