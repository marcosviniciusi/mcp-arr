import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TmdbClient } from "../clients/tmdb-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

function slimTmdbResult(item: any): any {
  const mt = item.media_type;
  if (mt === "person" || item.known_for_department) {
    return slim(item, ["id", "name", "known_for_department"]);
  }
  if (mt === "tv" || item.first_air_date !== undefined) {
    return slim(item, ["id", "name", "first_air_date", "vote_average", "original_language"]);
  }
  // default: movie
  return slim(item, ["id", "title", "release_date", "vote_average", "original_language"]);
}

function slimResultsPage(data: any, limit = 10): any {
  const results = (data.results ?? []).slice(0, limit).map(slimTmdbResult);
  return { page: data.page, total_pages: data.total_pages, total_results: data.total_results, results };
}

export function registerTmdbTools(server: McpServer, client: TmdbClient) {
  // ── Search ────────────────────────────────────────────────────

  server.tool(
    "tmdb_search_multi",
    "Search movies, TV shows, and people on TMDB",
    {
      query: z.string().describe("Search term"),
      page: z.number().optional().default(1).describe("Page number"),
      language: z.string().optional().default("en-US").describe("Language (e.g. pt-BR, en-US)"),
    },
    async ({ query, page, language }) => {
      const data = await client.get("/search/multi", { query, page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_search_movies",
    "Search movies on TMDB",
    {
      query: z.string().describe("Movie name"),
      page: z.number().optional().default(1),
      year: z.number().optional().describe("Filter by release year"),
      language: z.string().optional().default("en-US"),
    },
    async ({ query, page, year, language }) => {
      const params: Record<string, string> = { query, page: String(page), language };
      if (year) params.year = String(year);
      const data = await client.get("/search/movie", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_search_tv",
    "Search TV shows on TMDB",
    {
      query: z.string().describe("TV show name"),
      page: z.number().optional().default(1),
      first_air_date_year: z.number().optional().describe("Filter by first air date year"),
      language: z.string().optional().default("en-US"),
    },
    async ({ query, page, first_air_date_year, language }) => {
      const params: Record<string, string> = { query, page: String(page), language };
      if (first_air_date_year) params.first_air_date_year = String(first_air_date_year);
      const data = await client.get("/search/tv", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_search_person",
    "Search people (actors, directors) on TMDB",
    {
      query: z.string().describe("Person name"),
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
    },
    async ({ query, page, language }) => {
      const data = await client.get("/search/person", { query, page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  // ── Read ───────────────────────────────────────────────────────

  server.tool(
    "tmdb_get_movie_details",
    "Get detailed information about a movie",
    {
      movieId: z.number().describe("TMDB movie ID"),
      language: z.string().optional().default("en-US"),
    },
    async ({ movieId, language }) => {
      const data: any = await client.get(`/movie/${movieId}`, { language });
      const s = slim(data, ["id", "title", "release_date", "runtime", "vote_average", "genres", "status", "original_language"]);
      if (Array.isArray(s.genres)) s.genres = s.genres.map((g: any) => g.name);
      return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_tv_details",
    "Get detailed information about a TV show",
    {
      tvId: z.number().describe("TMDB TV show ID"),
      language: z.string().optional().default("en-US"),
    },
    async ({ tvId, language }) => {
      const data: any = await client.get(`/tv/${tvId}`, { language });
      const s = slim(data, ["id", "name", "first_air_date", "status", "vote_average", "genres", "number_of_seasons", "number_of_episodes", "networks", "original_language"]);
      if (Array.isArray(s.genres)) s.genres = s.genres.map((g: any) => g.name);
      if (Array.isArray(s.networks)) s.networks = s.networks.map((n: any) => n.name);
      return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_person_details",
    "Get info about a person (actor, director). Returns their name and known-for department.",
    {
      personId: z.number().describe("TMDB person ID"),
      language: z.string().optional().default("en-US"),
    },
    async ({ personId, language }) => {
      const data: any = await client.get(`/person/${personId}`, { language });
      return { content: [{ type: "text", text: JSON.stringify(slim(data, ["id", "name", "birthday", "known_for_department"]), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_person_credits",
    "Get movies and TV shows an actor/director has worked on. Returns tmdbId ready for radarr/sonarr lookup.",
    {
      personId: z.number().describe("TMDB person ID (use tmdb_search_person to find it)"),
      language: z.string().optional().default("pt-BR"),
    },
    async ({ personId, language }) => {
      const data: any = await client.get(`/person/${personId}/combined_credits`, { language });
      const cast = (data.cast ?? [])
        .sort((a: any, b: any) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, 20)
        .map((c: any) => ({
          tmdbId: c.id,
          title: c.title ?? c.name,
          media_type: c.media_type,
          year: (c.release_date ?? c.first_air_date ?? "").slice(0, 4),
          vote_average: c.vote_average,
          character: c.character,
        }));
      return { content: [{ type: "text", text: JSON.stringify({ personId, total: (data.cast ?? []).length, credits: cast }, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_trending",
    "Get trending movies, TV shows, or all",
    {
      mediaType: z.enum(["all", "movie", "tv", "person"]).optional().default("all").describe("Media type"),
      timeWindow: z.enum(["day", "week"]).optional().default("week").describe("Time window"),
      language: z.string().optional().default("en-US"),
    },
    async ({ mediaType, timeWindow, language }) => {
      const data = await client.get(`/trending/${mediaType}/${timeWindow}`, { language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_popular_movies",
    "Get popular movies on TMDB",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
    },
    async ({ page, language }) => {
      const data = await client.get("/movie/popular", { page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_popular_tv",
    "Get popular TV shows on TMDB",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
    },
    async ({ page, language }) => {
      const data = await client.get("/tv/popular", { page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_movie_credits",
    "Get cast and crew for a movie",
    {
      movieId: z.number().describe("TMDB movie ID"),
      language: z.string().optional().default("en-US"),
    },
    async ({ movieId, language }) => {
      const data: any = await client.get(`/movie/${movieId}/credits`, { language });
      const cast = (data.cast ?? []).slice(0, 15).map((c: any) => slim(c, ["id", "name", "character", "order"]));
      const crew = (data.crew ?? []).slice(0, 10).map((c: any) => slim(c, ["id", "name", "job", "department"]));
      return { content: [{ type: "text", text: JSON.stringify({ id: data.id, cast, crew }, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_tv_credits",
    "Get cast and crew for a TV show",
    {
      tvId: z.number().describe("TMDB TV show ID"),
      language: z.string().optional().default("en-US"),
    },
    async ({ tvId, language }) => {
      const data: any = await client.get(`/tv/${tvId}/credits`, { language });
      const cast = (data.cast ?? []).slice(0, 15).map((c: any) => slim(c, ["id", "name", "character", "order"]));
      const crew = (data.crew ?? []).slice(0, 10).map((c: any) => slim(c, ["id", "name", "job", "department"]));
      return { content: [{ type: "text", text: JSON.stringify({ id: data.id, cast, crew }, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_recommendations",
    "Get recommendations based on a movie or TV show",
    {
      mediaType: z.enum(["movie", "tv"]).describe("Media type"),
      mediaId: z.number().describe("TMDB ID"),
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
    },
    async ({ mediaType, mediaId, page, language }) => {
      const data = await client.get(`/${mediaType}/${mediaId}/recommendations`, { page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_genres",
    "List movie or TV genres",
    {
      mediaType: z.enum(["movie", "tv"]).describe("Media type"),
      language: z.string().optional().default("en-US"),
    },
    async ({ mediaType, language }) => {
      const data = await client.get(`/genre/${mediaType}/list`, { language });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── Discover ──────────────────────────────────────────────────

  server.tool(
    "tmdb_discover_movies",
    "Discover movies with advanced filters (genre, year, rating, etc.)",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
      sort_by: z.string().optional().default("popularity.desc").describe("Sort (e.g. popularity.desc, vote_average.desc)"),
      with_genres: z.string().optional().describe("Genre IDs comma-separated"),
      primary_release_year: z.number().optional().describe("Filter by release year"),
      vote_average_gte: z.number().optional().describe("Minimum vote average"),
      vote_average_lte: z.number().optional().describe("Maximum vote average"),
      with_original_language: z.string().optional().describe("ISO 639-1 language code (e.g. ja, ko, en)"),
    },
    async ({ page, language, sort_by, with_genres, primary_release_year, vote_average_gte, vote_average_lte, with_original_language }) => {
      const params: Record<string, string> = { page: String(page), language, sort_by };
      if (with_genres) params.with_genres = with_genres;
      if (primary_release_year) params.primary_release_year = String(primary_release_year);
      if (vote_average_gte !== undefined) params["vote_average.gte"] = String(vote_average_gte);
      if (vote_average_lte !== undefined) params["vote_average.lte"] = String(vote_average_lte);
      if (with_original_language) params.with_original_language = with_original_language;
      const data = await client.get("/discover/movie", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_discover_tv",
    "Discover TV shows with advanced filters",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("en-US"),
      sort_by: z.string().optional().default("popularity.desc"),
      with_genres: z.string().optional().describe("Genre IDs comma-separated"),
      first_air_date_year: z.number().optional(),
      vote_average_gte: z.number().optional(),
      with_original_language: z.string().optional(),
    },
    async ({ page, language, sort_by, with_genres, first_air_date_year, vote_average_gte, with_original_language }) => {
      const params: Record<string, string> = { page: String(page), language, sort_by };
      if (with_genres) params.with_genres = with_genres;
      if (first_air_date_year) params.first_air_date_year = String(first_air_date_year);
      if (vote_average_gte !== undefined) params["vote_average.gte"] = String(vote_average_gte);
      if (with_original_language) params.with_original_language = with_original_language;
      const data = await client.get("/discover/tv", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  // ── Description & Similar ────────────────────────────────────

  server.tool(
    "tmdb_get_description",
    "Get the synopsis/overview of a movie or TV show. Use this when you need to know what a title is about.",
    {
      mediaType: z.enum(["movie", "tv"]).describe("Media type"),
      mediaId: z.number().describe("TMDB ID"),
      language: z.string().optional().default("pt-BR"),
    },
    async ({ mediaType, mediaId, language }) => {
      const data: any = await client.get(`/${mediaType}/${mediaId}`, { language });
      const title = mediaType === "tv" ? data.name : data.title;
      return { content: [{ type: "text", text: JSON.stringify({ id: data.id, title, overview: data.overview ?? "", tagline: data.tagline ?? "" }, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_get_similar",
    "Get similar movies or TV shows based on genres and keywords. Use this to find titles like a given one.",
    {
      mediaType: z.enum(["movie", "tv"]).describe("Media type"),
      mediaId: z.number().describe("TMDB ID"),
      page: z.number().optional().default(1),
      language: z.string().optional().default("pt-BR"),
    },
    async ({ mediaType, mediaId, page, language }) => {
      const data = await client.get(`/${mediaType}/${mediaId}/similar`, { page: String(page), language });
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  // ── Rate ──────────────────────────────────────────────────────

  server.tool(
    "tmdb_rate_movie",
    "Rate a movie on TMDB (requires session)",
    {
      movieId: z.number().describe("TMDB movie ID"),
      value: z.number().min(0.5).max(10).describe("Rating value (0.5 to 10, in 0.5 increments)"),
    },
    async ({ movieId, value }) => {
      const data = await client.post(`/movie/${movieId}/rating`, { value });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "tmdb_rate_tv",
    "Rate a TV show on TMDB (requires session)",
    {
      tvId: z.number().describe("TMDB TV show ID"),
      value: z.number().min(0.5).max(10).describe("Rating value (0.5 to 10, in 0.5 increments)"),
    },
    async ({ tvId, value }) => {
      const data = await client.post(`/tv/${tvId}/rating`, { value });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
