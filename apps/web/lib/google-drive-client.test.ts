import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadDriveFile,
  driveTokenNeedsRefresh,
  listDriveChanges,
  listDriveFiles,
  listDriveFolders,
  refreshDriveToken
} from "./google-drive-client";

afterEach(() => vi.unstubAllGlobals());

describe("Google Drive ingestion boundary", () => {
  it("maps tombstones and permission loss without inventing file content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            newStartPageToken: "cursor-2",
            changes: [
              { fileId: "gone", removed: true },
              {
                fileId: "locked",
                file: {
                  id: "locked",
                  name: "Private",
                  mimeType: "text/plain",
                  version: "3",
                  capabilities: { canDownload: false }
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const page = await listDriveChanges("token", "cursor-1");
    expect(page.newStartPageToken).toBe("cursor-2");
    expect(page.changes).toMatchObject([
      { fileId: "gone", removed: true },
      { fileId: "locked", permissionLost: true }
    ]);
  });

  it("refreshes expiring tokens without replacing the durable refresh token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: "new-access", expires_in: 3600 }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const stale = {
      access_token: "old-access",
      refresh_token: "durable-refresh",
      expires_in: 60,
      token_type: "Bearer",
      obtained_at: "2020-01-01T00:00:00.000Z"
    };
    expect(driveTokenNeedsRefresh(stale)).toBe(true);
    await expect(refreshDriveToken(stale, "client", "secret")).resolves.toMatchObject({
      access_token: "new-access",
      refresh_token: "durable-refresh"
    });
  });

  it("uses bounded native-document export and returns the exported MIME", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("career notes", {
        status: 200,
        headers: { "content-type": "text/plain", "content-length": "12" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await downloadDriveFile("token", {
      id: "doc-1",
      name: "Career notes",
      mimeType: "application/vnd.google-apps.document",
      version: "1",
      trashed: false
    });
    expect(result).toMatchObject({ mimeType: "text/plain", filename: "Career notes.txt" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/export?mimeType=text%2Fplain");
  });

  it("scopes initial listing to the selected folder and exposes folder names only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [{ id: "folder-1", name: "Career" }] }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listDriveFolders("token")).resolves.toEqual([{ id: "folder-1", name: "Career" }]);
    await listDriveFiles("token", undefined, "folder-1");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("in+parents");
  });
});
