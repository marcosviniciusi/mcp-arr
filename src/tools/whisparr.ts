import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArrClient } from "../clients/arr-client.js";

export function registerWhisparrTools(server: McpServer, client: ArrClient, prefix = "whisparr") {
  const p = prefix;

  server.tool(
    `${p}_get_movies`,
    `List all movies in ${p} library`,
    {},
    async () => {
      const data = await client.get("/api/v3/movie");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_movie_by_id`,
    `Get details for a specific movie in ${p}`,
    { movieId: z.number().describe("Movie ID") },
    async ({ movieId }) => {
      const data = await client.get(`/api/v3/movie/${movieId}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_search_movies`,
    `Search for a movie to add to ${p}`,
    { term: z.string().describe("Search term") },
    async ({ term }) => {
      const data = await client.get("/api/v3/movie/lookup", { term });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_add_movie`,
    `Add a new movie to ${p}`,
    {
      tmdbId: z.number().describe("TMDB ID"),
      title: z.string().describe("Title"),
      qualityProfileId: z.number().describe("Quality profile ID"),
      rootFolderPath: z.string().describe("Root folder path"),
      monitored: z.boolean().optional().default(true).describe("Monitor"),
      searchForMovie: z.boolean().optional().default(true).describe("Search on add"),
      minimumAvailability: z.enum(["announced", "inCinemas", "released"]).optional().default("released"),
    },
    async ({ tmdbId, title, qualityProfileId, rootFolderPath, monitored, searchForMovie, minimumAvailability }) => {
      const body = {
        tmdbId, title, qualityProfileId, rootFolderPath, monitored, minimumAvailability,
        addOptions: { searchForMovie },
      };
      const data = await client.post("/api/v3/movie", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_delete_movie`,
    `Delete a movie from ${p}`,
    {
      movieId: z.number().describe("Movie ID"),
      deleteFiles: z.boolean().optional().default(false).describe("Also delete files"),
    },
    async ({ movieId, deleteFiles }) => {
      const path = deleteFiles ? `/api/v3/movie/${movieId}?deleteFiles=true` : `/api/v3/movie/${movieId}`;
      await client.delete(path);
      return { content: [{ type: "text", text: `Movie ${movieId} deleted.` }] };
    },
  );

  server.tool(
    `${p}_search_movie_download`,
    `Trigger a search/download for movies in ${p}`,
    { movieIds: z.array(z.number()).describe("Movie IDs to search") },
    async ({ movieIds }) => {
      const data = await client.post("/api/v3/command", { name: "MoviesSearch", movieIds });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_queue`,
    `Get download queue in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/v3/queue");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_quality_profiles`,
    `List quality profiles in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/v3/qualityprofile");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_root_folders`,
    `List root folders in ${p}`,
    {},
    async () => {
      const data = await client.get("/api/v3/rootfolder");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    `${p}_get_system_status`,
    `Get ${p} system status`,
    {},
    async () => {
      const data = await client.get("/api/v3/system/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
