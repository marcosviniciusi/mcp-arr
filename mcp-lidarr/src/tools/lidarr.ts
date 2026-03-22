import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerLidarrTools(server: McpServer, client: ArrClient, prefix = "lidarr") {
  const p = prefix;

  const ok = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  });

  const slim = (obj: any, keys: string[]) =>
    keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

  // ── Read Tools ──────────────────────────────────────────────────────

  server.tool(
    `${p}_get_artists`,
    `List artists in ${p} (top 25). Use search_artists to find a specific one by name.`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/artist");
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((a: any) =>
          slim(a, ["id", "artistName", "foreignArtistId", "status", "monitored", "artistType", "disambiguation"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_get_artist_by_id`,
    `Get details for a specific artist in ${p}`,
    { artistId: z.number().describe("Artist ID") },
    async ({ artistId }) => {
      const data = await client.get(`/api/v1/artist/${artistId}`);
      return ok(slim(data, ["id", "artistName", "foreignArtistId", "status", "monitored", "artistType", "overview", "path", "qualityProfileId", "metadataProfileId", "statistics"]));
    },
  );

  server.tool(
    `${p}_get_albums`,
    `Get albums, optionally filtered by artist in ${p}`,
    { artistId: z.number().optional().describe("Filter by artist ID") },
    async ({ artistId }) => {
      const params: Record<string, string> = {};
      if (artistId !== undefined) params.artistId = String(artistId);
      const data: any[] = await client.get("/api/v1/album", params);
      return ok({
        total: data.length,
        items: data.slice(0, 25).map((a: any) =>
          slim(a, ["id", "title", "foreignAlbumId", "artistId", "releaseDate", "monitored", "albumType"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_get_album_by_id`,
    `Get details for a specific album in ${p}`,
    { albumId: z.number().describe("Album ID") },
    async ({ albumId }) => {
      const data = await client.get(`/api/v1/album/${albumId}`);
      return ok(slim(data, ["id", "title", "foreignAlbumId", "artistId", "releaseDate", "monitored", "albumType", "overview", "statistics"]));
    },
  );

  server.tool(
    `${p}_get_tracks`,
    `Get tracks for an album in ${p}`,
    { albumId: z.number().describe("Album ID to get tracks for") },
    async ({ albumId }) => {
      const data: any[] = await client.get("/api/v1/track", { albumId: String(albumId) });
      return ok({
        total: data.length,
        items: data.map((t: any) => slim(t, ["id", "title", "trackNumber", "duration", "hasFile"])),
      });
    },
  );

  server.tool(
    `${p}_get_calendar`,
    `Get upcoming album releases from ${p} calendar`,
    {
      start: z.string().optional().describe("Start date (ISO 8601)"),
      end: z.string().optional().describe("End date (ISO 8601)"),
      unmonitored: z.boolean().optional().describe("Include unmonitored albums"),
    },
    async ({ start, end, unmonitored }) => {
      const params: Record<string, string> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (unmonitored !== undefined) params.unmonitored = String(unmonitored);
      const data: any[] = await client.get("/api/v1/calendar", params);
      return ok(data.map((a: any) => slim(a, ["id", "title", "artistId", "releaseDate", "monitored", "albumType"])));
    },
  );

  server.tool(
    `${p}_get_queue`,
    `Get current download queue in ${p}`,
    {},
    async () => {
      const data: any = await client.get("/api/v1/queue");
      const records = Array.isArray(data) ? data : (data.records ?? []);
      return ok(records.map((q: any) => slim(q, ["id", "title", "status", "size", "sizeleft", "timeleft", "estimatedCompletionTime"])));
    },
  );

  server.tool(
    `${p}_get_quality_profiles`,
    `List available quality profiles in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/qualityprofile");
      return ok(data.map((p: any) => slim(p, ["id", "name"])));
    },
  );

  server.tool(
    `${p}_get_root_folders`,
    `List configured root folders in ${p}`,
    {},
    async () => {
      const data: any[] = await client.get("/api/v1/rootfolder");
      return ok(data.map((f: any) => slim(f, ["id", "path", "freeSpace"])));
    },
  );

  // ── Search Tools ────────────────────────────────────────────────────

  server.tool(
    `${p}_search_artists`,
    `Search for an artist to add to ${p}. Returns results + qualityProfiles + metadataProfiles + rootFolders so you can call add_artist directly.`,
    { term: z.string().describe("Search term (artist name)") },
    async ({ term }) => {
      const [data, qProfiles, mProfiles, folders] = await Promise.all([
        client.get("/api/v1/artist/lookup", { term }) as Promise<any[]>,
        client.get("/api/v1/qualityprofile") as Promise<any[]>,
        client.get("/api/v1/metadataprofile") as Promise<any[]>,
        client.get("/api/v1/rootfolder") as Promise<any[]>,
      ]);
      return ok({
        total: data.length,
        results: data.slice(0, 10).map((a: any) =>
          slim(a, ["artistName", "foreignArtistId", "status", "artistType", "disambiguation"]),
        ),
        qualityProfiles: qProfiles.map((p: any) => ({ id: p.id, name: p.name })),
        metadataProfiles: mProfiles.map((p: any) => ({ id: p.id, name: p.name })),
        rootFolders: folders.map((f: any) => ({ path: f.path, freeSpace: f.freeSpace })),
      });
    },
  );

  server.tool(
    `${p}_search_albums`,
    `Search for an album in ${p}`,
    { term: z.string().describe("Search term (album name)") },
    async ({ term }) => {
      const data: any[] = await client.get("/api/v1/album/lookup", { term });
      return ok({
        total: data.length,
        results: data.slice(0, 10).map((a: any) =>
          slim(a, ["title", "foreignAlbumId", "artistId", "releaseDate", "albumType"]),
        ),
      });
    },
  );

  server.tool(
    `${p}_search_artist_download`,
    `Trigger a search/download for an artist's missing albums in ${p}`,
    { artistId: z.number().describe("Artist ID to search for") },
    async ({ artistId }) => {
      const data = await client.post("/api/v1/command", {
        name: "ArtistSearch",
        artistId,
      });
      return ok(data);
    },
  );

  server.tool(
    `${p}_search_album_download`,
    `Trigger a search/download for specific albums in ${p}`,
    { albumIds: z.array(z.number()).describe("List of album IDs to search for") },
    async ({ albumIds }) => {
      const data = await client.post("/api/v1/command", {
        name: "AlbumSearch",
        albumIds,
      });
      return ok(data);
    },
  );

  // ── Manage Tools ────────────────────────────────────────────────────

  server.tool(
    `${p}_add_artist`,
    `Add a new artist to ${p}`,
    {
      foreignArtistId: z.string().describe("MusicBrainz artist ID"),
      artistName: z.string().describe("Artist name"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      metadataProfileId: z.number().describe("Metadata profile ID"),
      rootFolderPath: z.string().describe("Root folder path (e.g. /music)"),
      monitored: z.boolean().optional().default(true).describe("Monitor the artist"),
      monitorNewItems: z.enum(["all", "none", "new"]).optional().default("all").describe("How to monitor new items"),
      searchForMissingAlbums: z.boolean().optional().default(true).describe("Search for missing albums on add"),
      tags: z.array(z.number()).optional().default([]).describe("Tag IDs to apply"),
    },
    async ({ foreignArtistId, artistName, qualityProfileId, metadataProfileId, rootFolderPath, monitored, monitorNewItems, searchForMissingAlbums, tags }) => {
      const body = {
        foreignArtistId,
        artistName,
        qualityProfileId,
        metadataProfileId,
        rootFolderPath,
        monitored,
        monitorNewItems,
        tags,
        addOptions: { searchForMissingAlbums },
      };
      const data: any = await client.post("/api/v1/artist", body);
      return ok(slim(data, ["id", "artistName", "foreignArtistId", "status", "monitored", "artistType", "path", "added"]));
    },
  );

  server.tool(
    `${p}_delete_artist`,
    `Delete an artist from ${p}`,
    {
      artistId: z.number().describe("Artist ID to delete"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
      addImportListExclusion: z.boolean().optional().default(false).describe("Add import list exclusion"),
    },
    async ({ artistId, deleteFiles, addImportListExclusion }) => {
      const params: string[] = [];
      if (deleteFiles) params.push("deleteFiles=true");
      if (addImportListExclusion) params.push("addImportListExclusion=true");
      const query = params.length ? `?${params.join("&")}` : "";
      await client.delete(`/api/v1/artist/${artistId}${query}`);
      return { content: [{ type: "text" as const, text: `Artist ${artistId} deleted.` }] };
    },
  );

  server.tool(
    `${p}_update_artist`,
    `Edit/update an artist in ${p} (PUT). Fetch the artist first, modify fields, and send the full object back.`,
    {
      artistId: z.number().describe("Artist ID to update"),
      monitored: z.boolean().optional().describe("Set monitored status"),
      qualityProfileId: z.number().optional().describe("Change quality profile ID"),
      metadataProfileId: z.number().optional().describe("Change metadata profile ID"),
      tags: z.array(z.number()).optional().describe("Replace tag IDs"),
      path: z.string().optional().describe("Change artist path"),
    },
    async ({ artistId, monitored, qualityProfileId, metadataProfileId, tags, path }) => {
      const artist = await client.get<Record<string, unknown>>(`/api/v1/artist/${artistId}`);
      if (monitored !== undefined) artist.monitored = monitored;
      if (qualityProfileId !== undefined) artist.qualityProfileId = qualityProfileId;
      if (metadataProfileId !== undefined) artist.metadataProfileId = metadataProfileId;
      if (tags !== undefined) artist.tags = tags;
      if (path !== undefined) artist.path = path;
      const data = await client.put(`/api/v1/artist/${artistId}`, artist);
      return ok(data);
    },
  );
}
