import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerRadarrTools(server: McpServer, client: ArrClient) {
  server.tool(
    "radarr_get_movies",
    "List all movies in Radarr library",
    {},
    async () => {
      const data = await client.get("/api/v3/movie");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_movie_by_id",
    "Get details for a specific movie",
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data = await client.get(`/api/v3/movie/${movieId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_search_movies",
    "Search for a movie to add to Radarr",
    { term: z.string().describe("Search term (movie name)") },
    async ({ term }) => {
      const data = await client.get("/api/v3/movie/lookup", { term });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_add_movie",
    "Add a new movie to Radarr",
    {
      tmdbId: z.number().describe("TMDB ID of the movie"),
      title: z.string().describe("Movie title"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      rootFolderPath: z.string().describe("Root folder path (e.g. /movies)"),
      monitored: z.boolean().optional().default(true).describe("Monitor the movie"),
      searchForMovie: z.boolean().optional().default(true).describe("Search for movie on add"),
      minimumAvailability: z.enum(["announced", "inCinemas", "released"]).optional().default("released").describe("Minimum availability"),
    },
    async ({ tmdbId, title, qualityProfileId, rootFolderPath, monitored, searchForMovie, minimumAvailability }) => {
      const body = {
        tmdbId,
        title,
        qualityProfileId,
        rootFolderPath,
        monitored,
        minimumAvailability,
        addOptions: { searchForMovie },
      };
      const data = await client.post("/api/v3/movie", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_delete_movie",
    "Delete a movie from Radarr",
    {
      movieId: z.number().describe("Movie ID to delete"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files on disk"),
    },
    async ({ movieId, deleteFiles }) => {
      const path = deleteFiles ? `/api/v3/movie/${movieId}?deleteFiles=true` : `/api/v3/movie/${movieId}`;
      await client.delete(path);
      return { content: [{ type: "text", text: `Movie ${movieId} deleted.` }] };
    },
  );

  server.tool(
    "radarr_search_movie_download",
    "Trigger a search/download for a movie",
    { movieIds: z.array(z.number()).describe("List of movie IDs to search for") },
    async ({ movieIds }) => {
      const data = await client.post("/api/v3/command", {
        name: "MoviesSearch",
        movieIds,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_calendar",
    "Get upcoming movies from Radarr calendar",
    {
      start: z.string().optional().describe("Start date (ISO 8601)"),
      end: z.string().optional().describe("End date (ISO 8601)"),
    },
    async ({ start, end }) => {
      const params: Record<string, string> = {};
      if (start) params.start = start;
      if (end) params.end = end;
      const data = await client.get("/api/v3/calendar", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_queue",
    "Get current download queue in Radarr",
    {},
    async () => {
      const data = await client.get("/api/v3/queue");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_quality_profiles",
    "List available quality profiles",
    {},
    async () => {
      const data = await client.get("/api/v3/qualityprofile");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_root_folders",
    "List configured root folders",
    {},
    async () => {
      const data = await client.get("/api/v3/rootfolder");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "radarr_get_system_status",
    "Get Radarr system status",
    {},
    async () => {
      const data = await client.get("/api/v3/system/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
