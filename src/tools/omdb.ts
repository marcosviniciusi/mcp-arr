import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OmdbClient } from "../clients/omdb-client.js";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

export function registerOmdbTools(server: McpServer, client: OmdbClient) {

  server.tool(
    "omdb_search",
    "Search movies/series on OMDb with ratings from IMDb, Rotten Tomatoes, Metacritic. Returns enriched results with genre and all ratings.",
    {
      query: z.string().describe("Search term"),
      type: z.enum(["movie", "series", "episode"]).optional().describe("Filter by type"),
      year: z.string().optional().describe("Filter by year"),
      limit: z.number().optional().default(10).describe("Max results to return (1-30). Each result costs 1 API call for ratings."),
    },
    async ({ query, type, year, limit }) => {
      const params: Record<string, string> = { s: query, page: "1" };
      if (type) params.type = type;
      if (year) params.y = year;

      // OMDb search returns 10/page — fetch multiple pages if needed
      const allResults: any[] = [];
      const pages = Math.ceil(Math.min(limit, 30) / 10);
      for (let p = 1; p <= pages; p++) {
        try {
          params.page = String(p);
          const data: any = await client.get(params);
          allResults.push(...(data.Search ?? []));
        } catch {
          break; // no more pages
        }
      }

      // Enrich each result with ratings (parallel, capped at limit)
      const items = allResults.slice(0, limit);
      const enriched = await Promise.all(
        items.map(async (item) => {
          try {
            const detail: any = await client.get({ i: item.imdbID, plot: "short" });
            return {
              title: detail.Title,
              year: detail.Year,
              imdbID: detail.imdbID,
              type: detail.Type,
              genre: detail.Genre,
              imdbRating: detail.imdbRating,
              imdbVotes: detail.imdbVotes,
              metascore: detail.Metascore,
              ratings: detail.Ratings,
              totalSeasons: detail.totalSeasons,
            };
          } catch {
            return {
              title: item.Title,
              year: item.Year,
              imdbID: item.imdbID,
              type: item.Type,
            };
          }
        }),
      );
      return ok({ totalResults: allResults.length, results: enriched });
    },
  );

  server.tool(
    "omdb_get_by_id",
    "Get movie/series details from OMDb by IMDb ID. Returns ratings from IMDb, Rotten Tomatoes, and Metacritic, plus genre, actors, awards.",
    {
      imdbId: z.string().describe("IMDb ID (e.g. tt0903747)"),
    },
    async ({ imdbId }) => {
      const data: any = await client.get({ i: imdbId, plot: "short" });
      return ok({
        title: data.Title,
        year: data.Year,
        rated: data.Rated,
        runtime: data.Runtime,
        genre: data.Genre,
        director: data.Director,
        actors: data.Actors,
        awards: data.Awards,
        imdbRating: data.imdbRating,
        imdbVotes: data.imdbVotes,
        imdbID: data.imdbID,
        metascore: data.Metascore,
        ratings: data.Ratings,
        type: data.Type,
        totalSeasons: data.totalSeasons,
        boxOffice: data.BoxOffice,
      });
    },
  );

  server.tool(
    "omdb_get_ratings",
    "Get ONLY ratings for a title from IMDb, Rotten Tomatoes, and Metacritic. Lightweight — use for quick comparisons.",
    {
      imdbId: z.string().describe("IMDb ID (e.g. tt0903747)"),
    },
    async ({ imdbId }) => {
      const data: any = await client.get({ i: imdbId, plot: "short" });
      return ok({
        title: data.Title,
        year: data.Year,
        type: data.Type,
        genre: data.Genre,
        imdbRating: data.imdbRating,
        imdbVotes: data.imdbVotes,
        metascore: data.Metascore,
        ratings: data.Ratings,
      });
    },
  );
}
