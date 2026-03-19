import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TmdbClient } from "../clients/tmdb-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

// Genre ID → name mapping (TMDB standard IDs)
const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  // TV-specific
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

function resolveGenres(ids: number[]): string[] {
  return ids.map(id => GENRE_MAP[id] ?? String(id));
}

function isAnime(item: any): boolean {
  return item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
}

function slimTmdbResult(item: any): any {
  const mt = item.media_type;
  if (mt === "person" || item.known_for_department) {
    return slim(item, ["id", "name", "known_for_department"]);
  }
  if (mt === "tv" || item.first_air_date !== undefined) {
    const s = slim(item, ["id", "name", "first_air_date", "vote_average", "vote_count", "original_language", "popularity"]);
    if (Array.isArray(item.genre_ids)) s.genres = resolveGenres(item.genre_ids);
    if (item.media_type) s.media_type = "tv";
    s.is_anime = isAnime(item);
    if (s.is_anime) s.add_to = "sonarr_animes";
    else s.add_to = "sonarr";
    return s;
  }
  // default: movie
  const s = slim(item, ["id", "title", "release_date", "vote_average", "vote_count", "original_language", "popularity"]);
  if (Array.isArray(item.genre_ids)) s.genres = resolveGenres(item.genre_ids);
  if (item.media_type) s.media_type = "movie";
  s.is_anime = isAnime(item);
  if (s.is_anime) s.add_to = "radarr_animes";
  else s.add_to = "radarr";
  return s;
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
    "tmdb_search_keyword",
    "Search TMDB keyword IDs by name. Use this to find keyword IDs for tmdb_discover_movies/tv with_keywords parameter.",
    { query: z.string().describe("Keyword to search (e.g. cyberpunk, zombie, time-travel)") },
    async ({ query }) => {
      const data: any = await client.get("/search/keyword", { query });
      const results = (data.results ?? []).slice(0, 10).map((k: any) => ({ id: k.id, name: k.name }));
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
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
    "Get details of ONE specific movie by TMDB ID (runtime, budget, revenue, genres). Do NOT call this in a loop — discover/search already return enough info.",
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
    "Get details of ONE specific TV show by TMDB ID (seasons count, episodes count, status, genres). Do NOT call this in a loop — discover/search already return enough info.",
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
    "Discover movies by filters. Returns title, genres (names), vote_average, vote_count, popularity. Use with_keywords for subgenres like cyberpunk (12190), steampunk (10028), dystopia (4565), space (9882). Use tmdb_search_keyword to find other keyword IDs. Common genre IDs: 28=Action, 878=Sci-Fi, 16=Animation, 18=Drama, 53=Thriller. Do NOT call get_movie_details for each result.",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("pt-BR"),
      sort_by: z.string().optional().default("popularity.desc").describe("Sort: popularity.desc, vote_average.desc, primary_release_date.desc"),
      with_genres: z.string().optional().describe("Genre IDs comma-separated (878=Sci-Fi, 28=Action, 16=Animation)"),
      with_keywords: z.string().optional().describe("Keyword IDs comma-separated (12190=cyberpunk, 10028=steampunk, 4565=dystopia, 9882=space)"),
      primary_release_year: z.number().optional().describe("Filter by release year"),
      vote_average_gte: z.number().optional().describe("Minimum vote average (e.g. 7)"),
      vote_count_gte: z.number().optional().default(50).describe("Minimum vote count to filter noise (default 50)"),
      with_original_language: z.string().optional().describe("ISO 639-1 (ja=Japanese, ko=Korean, en=English, pt=Portuguese)"),
    },
    async ({ page, language, sort_by, with_genres, with_keywords, primary_release_year, vote_average_gte, vote_count_gte, with_original_language }) => {
      const params: Record<string, string> = { page: String(page), language, sort_by };
      if (with_genres) params.with_genres = with_genres;
      if (with_keywords) params.with_keywords = with_keywords;
      if (primary_release_year) params.primary_release_year = String(primary_release_year);
      if (vote_average_gte !== undefined) params["vote_average.gte"] = String(vote_average_gte);
      if (vote_count_gte !== undefined) params["vote_count.gte"] = String(vote_count_gte);
      if (with_original_language) params.with_original_language = with_original_language;
      const data = await client.get("/discover/movie", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  server.tool(
    "tmdb_discover_tv",
    "Discover TV shows by filters. Returns name, genres (names), vote_average, vote_count, popularity. Use with_keywords for subgenres like cyberpunk (12190), steampunk (10028), dystopia (4565), space (9882). Use tmdb_search_keyword to find other keyword IDs. Common genre IDs: 10765=Sci-Fi&Fantasy, 10759=Action&Adventure, 16=Animation, 18=Drama. Do NOT call get_tv_details for each result.",
    {
      page: z.number().optional().default(1),
      language: z.string().optional().default("pt-BR"),
      sort_by: z.string().optional().default("popularity.desc").describe("Sort: popularity.desc, vote_average.desc, first_air_date.desc"),
      with_genres: z.string().optional().describe("Genre IDs (10765=Sci-Fi&Fantasy, 10759=Action&Adventure, 16=Animation, 18=Drama)"),
      with_keywords: z.string().optional().describe("Keyword IDs (12681=cyberpunk, 4379=steampunk, 3801=dystopia, 9882=space)"),
      first_air_date_year: z.number().optional(),
      vote_average_gte: z.number().optional().describe("Minimum vote average (e.g. 7)"),
      vote_count_gte: z.number().optional().default(50).describe("Minimum vote count to filter noise (default 50)"),
      with_original_language: z.string().optional().describe("ISO 639-1 (ja=Japanese, ko=Korean, en=English)"),
    },
    async ({ page, language, sort_by, with_genres, with_keywords, first_air_date_year, vote_average_gte, vote_count_gte, with_original_language }) => {
      const params: Record<string, string> = { page: String(page), language, sort_by };
      if (with_genres) params.with_genres = with_genres;
      if (with_keywords) params.with_keywords = with_keywords;
      if (first_air_date_year) params.first_air_date_year = String(first_air_date_year);
      if (vote_average_gte !== undefined) params["vote_average.gte"] = String(vote_average_gte);
      if (vote_count_gte !== undefined) params["vote_count.gte"] = String(vote_count_gte);
      if (with_original_language) params.with_original_language = with_original_language;
      const data = await client.get("/discover/tv", params);
      return { content: [{ type: "text", text: JSON.stringify(slimResultsPage(data), null, 2) }] };
    },
  );

  // ── Find by genre (smart discovery) ─────────────────────────

  const REGION_LANGS: Record<string, string[]> = {
    european: ["fr","de","es","it","nl","da","sv","no","fi","pl","cs","pt","hu","ro","bg","hr","el","tr","is","ru"],
    asian: ["ja","ko","zh","th","hi","id","tl"],
    latin: ["es","pt"],
    nordic: ["da","sv","no","fi","is"],
  };

  server.tool(
    "tmdb_find_by_genre",
    "Find TV shows or movies with the SAME GENRES as a reference title, filtered by region. 1 call replaces: get_details + discover + filter. Returns results with is_anime and add_to.",
    {
      mediaType: z.enum(["tv", "movie"]).describe("Type of the reference title"),
      referenceId: z.number().describe("TMDB ID of the reference title (e.g. The Tunnel = 56336)"),
      region: z.enum(["european", "asian", "latin", "nordic", "any"]).optional().default("any").describe("Filter by region"),
      vote_average_gte: z.number().optional().default(7.5).describe("Minimum rating"),
      vote_count_gte: z.number().optional().default(50).describe("Minimum votes"),
      limit: z.number().optional().default(10).describe("Max results"),
      language: z.string().optional().default("pt-BR"),
    },
    async ({ mediaType, referenceId, region, vote_average_gte, vote_count_gte, limit, language }) => {
      // Step 1: Get genres of reference title
      const ref: any = await client.get(`/${mediaType}/${referenceId}`, { language });
      const genreIds = (ref.genres ?? []).map((g: any) => g.id).join(",");
      const refName = ref.name ?? ref.title ?? "Unknown";

      if (!genreIds) return { content: [{ type: "text", text: JSON.stringify({ error: "No genres found for reference title" }, null, 2) }] };

      // Step 2: Discover with those genres, multiple pages if needed for region filter
      const langs = region !== "any" ? REGION_LANGS[region] : null;
      const allResults: any[] = [];

      for (let page = 1; page <= 3 && allResults.length < limit; page++) {
        const params: Record<string, string> = {
          with_genres: genreIds,
          sort_by: "vote_average.desc",
          "vote_average.gte": String(vote_average_gte),
          "vote_count.gte": String(vote_count_gte),
          language,
          page: String(page),
        };
        const endpoint = mediaType === "tv" ? "/discover/tv" : "/discover/movie";
        const data: any = await client.get(endpoint, params);
        const items = (data.results ?? [])
          .filter((r: any) => r.id !== referenceId) // Exclude the reference itself
          .filter((r: any) => !langs || langs.includes(r.original_language));
        allResults.push(...items);
      }

      const results = allResults.slice(0, limit).map(slimTmdbResult);
      return { content: [{ type: "text", text: JSON.stringify({
        reference: { id: referenceId, name: refName, genres: (ref.genres ?? []).map((g: any) => g.name) },
        region,
        total_found: allResults.length,
        results,
      }, null, 2) }] };
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
