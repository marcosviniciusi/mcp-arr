import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MalClient } from "../clients/mal-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

function slimAnimeNode(node: any): any {
  const s = slim(node, ["id", "title", "media_type", "status", "num_episodes", "mean"]);
  return s;
}

function slimMangaNode(node: any): any {
  const s = slim(node, ["id", "title", "media_type", "status", "num_chapters", "mean"]);
  return s;
}

function slimAnimeDetails(data: any): any {
  const s = slim(data, ["id", "title", "mean", "rank", "popularity", "status", "num_episodes", "start_date", "end_date", "genres", "source", "rating"]);
  if (Array.isArray(s.genres)) s.genres = s.genres.map((g: any) => g.name);
  return s;
}

function slimMangaDetails(data: any): any {
  const s = slim(data, ["id", "title", "mean", "rank", "popularity", "status", "num_chapters", "num_volumes", "start_date", "end_date", "genres"]);
  if (Array.isArray(s.genres)) s.genres = s.genres.map((g: any) => g.name);
  return s;
}

export function registerMalTools(server: McpServer, client: MalClient) {
  const ANIME_FIELDS = "id,title,mean,rank,popularity,media_type,status,genres,num_episodes,start_date,end_date,source,rating";
  const MANGA_FIELDS = "id,title,mean,rank,popularity,media_type,status,genres,num_volumes,num_chapters,start_date,end_date";

  // ── Search ────────────────────────────────────────────────────

  server.tool(
    "mal_search_anime",
    "Search anime on MyAnimeList",
    {
      q: z.string().describe("Search query"),
      limit: z.number().optional().default(10).describe("Max results (1-100)"),
      offset: z.number().optional().default(0),
    },
    async ({ q, limit, offset }) => {
      const data: any = await client.get("/anime", {
        q,
        limit: String(limit),
        offset: String(offset),
        fields: ANIME_FIELDS,
      });
      const items = (data.data ?? []).map((entry: any) => slimAnimeNode(entry.node));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_search_manga",
    "Search manga on MyAnimeList",
    {
      q: z.string().describe("Search query"),
      limit: z.number().optional().default(10),
      offset: z.number().optional().default(0),
    },
    async ({ q, limit, offset }) => {
      const data: any = await client.get("/manga", {
        q,
        limit: String(limit),
        offset: String(offset),
        fields: MANGA_FIELDS,
      });
      const items = (data.data ?? []).map((entry: any) => slimMangaNode(entry.node));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  // ── Read ───────────────────────────────────────────────────────

  server.tool(
    "mal_get_anime_details",
    "Get detailed information about an anime",
    { animeId: z.number().describe("MAL anime ID") },
    async ({ animeId }) => {
      const data = await client.get(`/anime/${animeId}`, { fields: ANIME_FIELDS });
      return { content: [{ type: "text", text: JSON.stringify(slimAnimeDetails(data), null, 2) }] };
    },
  );

  server.tool(
    "mal_get_manga_details",
    "Get detailed information about a manga",
    { mangaId: z.number().describe("MAL manga ID") },
    async ({ mangaId }) => {
      const data = await client.get(`/manga/${mangaId}`, { fields: MANGA_FIELDS });
      return { content: [{ type: "text", text: JSON.stringify(slimMangaDetails(data), null, 2) }] };
    },
  );

  server.tool(
    "mal_get_seasonal_anime",
    "Get seasonal anime list",
    {
      year: z.number().describe("Year"),
      season: z.enum(["winter", "spring", "summer", "fall"]).describe("Season"),
      sort: z.enum(["anime_score", "anime_num_list_users"]).optional().default("anime_score"),
      limit: z.number().optional().default(25),
    },
    async ({ year, season, sort, limit }) => {
      const data: any = await client.get(`/anime/season/${year}/${season}`, {
        sort,
        limit: String(limit),
        fields: ANIME_FIELDS,
      });
      const items = (data.data ?? []).map((entry: any) => slimAnimeNode(entry.node));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_get_anime_ranking",
    "Get anime rankings",
    {
      ranking_type: z.enum([
        "all", "airing", "upcoming", "tv", "ova", "movie", "special",
        "bypopularity", "favorite",
      ]).optional().default("all").describe("Ranking type"),
      limit: z.number().optional().default(25),
    },
    async ({ ranking_type, limit }) => {
      const data: any = await client.get("/anime/ranking", {
        ranking_type,
        limit: String(limit),
        fields: ANIME_FIELDS,
      });
      const items = (data.data ?? []).map((entry: any) => ({ ...slimAnimeNode(entry.node), ranking: entry.ranking }));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_get_manga_ranking",
    "Get manga rankings",
    {
      ranking_type: z.enum([
        "all", "manga", "oneshots", "doujin", "lightnovels", "novels",
        "manhwa", "manhua", "bypopularity", "favorite",
      ]).optional().default("all"),
      limit: z.number().optional().default(25),
    },
    async ({ ranking_type, limit }) => {
      const data: any = await client.get("/manga/ranking", {
        ranking_type,
        limit: String(limit),
        fields: MANGA_FIELDS,
      });
      const items = (data.data ?? []).map((entry: any) => ({ ...slimMangaNode(entry.node), ranking: entry.ranking }));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_get_suggested_anime",
    "Get anime suggestions for the authenticated user",
    {
      limit: z.number().optional().default(25),
    },
    async ({ limit }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: Anime suggestions require user authentication (access_token)." }], isError: true };
      }
      const data: any = await client.get("/anime/suggestions", { limit: String(limit), fields: ANIME_FIELDS }, true);
      const items = (data.data ?? []).map((entry: any) => slimAnimeNode(entry.node));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  // ── List (user-specific) ──────────────────────────────────────

  server.tool(
    "mal_get_user_animelist",
    "Get authenticated user's anime list",
    {
      status: z.enum(["watching", "completed", "on_hold", "dropped", "plan_to_watch"]).optional().describe("Filter by status"),
      sort: z.enum(["list_score", "list_updated_at", "anime_title", "anime_start_date"]).optional().default("list_updated_at"),
      limit: z.number().optional().default(25),
    },
    async ({ status, sort, limit }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: User anime list requires authentication (access_token)." }], isError: true };
      }
      const params: Record<string, string> = { sort, limit: String(limit), fields: "list_status," + ANIME_FIELDS };
      if (status) params.status = status;
      const data: any = await client.get("/users/@me/animelist", params, true);
      const items = (data.data ?? []).map((entry: any) => ({
        node: slim(entry.node, ["id", "title"]),
        list_status: slim(entry.list_status ?? {}, ["status", "score", "num_episodes_watched"]),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_get_user_mangalist",
    "Get authenticated user's manga list",
    {
      status: z.enum(["reading", "completed", "on_hold", "dropped", "plan_to_read"]).optional(),
      sort: z.enum(["list_score", "list_updated_at", "manga_title", "manga_start_date"]).optional().default("list_updated_at"),
      limit: z.number().optional().default(25),
    },
    async ({ status, sort, limit }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: User manga list requires authentication (access_token)." }], isError: true };
      }
      const params: Record<string, string> = { sort, limit: String(limit), fields: "list_status," + MANGA_FIELDS };
      if (status) params.status = status;
      const data: any = await client.get("/users/@me/mangalist", params, true);
      const items = (data.data ?? []).map((entry: any) => ({
        node: slim(entry.node, ["id", "title"]),
        list_status: slim(entry.list_status ?? {}, ["status", "score", "num_chapters_read", "num_volumes_read"]),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ data: items }, null, 2) }] };
    },
  );

  server.tool(
    "mal_update_animelist",
    "Update an anime entry on the user's list",
    {
      animeId: z.number().describe("MAL anime ID"),
      status: z.enum(["watching", "completed", "on_hold", "dropped", "plan_to_watch"]).optional(),
      score: z.number().min(0).max(10).optional().describe("Score (0-10, 0 = no score)"),
      num_watched_episodes: z.number().optional().describe("Number of watched episodes"),
    },
    async ({ animeId, status, score, num_watched_episodes }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: Updating anime list requires authentication (access_token)." }], isError: true };
      }
      const body: Record<string, string> = {};
      if (status) body.status = status;
      if (score !== undefined) body.score = String(score);
      if (num_watched_episodes !== undefined) body.num_watched_episodes = String(num_watched_episodes);
      const data = await client.patch(`/anime/${animeId}/my_list_status`, body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "mal_update_mangalist",
    "Update a manga entry on the user's list",
    {
      mangaId: z.number().describe("MAL manga ID"),
      status: z.enum(["reading", "completed", "on_hold", "dropped", "plan_to_read"]).optional(),
      score: z.number().min(0).max(10).optional(),
      num_volumes_read: z.number().optional(),
      num_chapters_read: z.number().optional(),
    },
    async ({ mangaId, status, score, num_volumes_read, num_chapters_read }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: Updating manga list requires authentication (access_token)." }], isError: true };
      }
      const body: Record<string, string> = {};
      if (status) body.status = status;
      if (score !== undefined) body.score = String(score);
      if (num_volumes_read !== undefined) body.num_volumes_read = String(num_volumes_read);
      if (num_chapters_read !== undefined) body.num_chapters_read = String(num_chapters_read);
      const data = await client.patch(`/manga/${mangaId}/my_list_status`, body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "mal_delete_animelist_item",
    "Remove an anime from the user's list",
    { animeId: z.number().describe("MAL anime ID") },
    async ({ animeId }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: Removing from anime list requires authentication (access_token)." }], isError: true };
      }
      await client.delete(`/anime/${animeId}/my_list_status`);
      return { content: [{ type: "text", text: `Anime ${animeId} removed from list.` }] };
    },
  );

  server.tool(
    "mal_delete_mangalist_item",
    "Remove a manga from the user's list",
    { mangaId: z.number().describe("MAL manga ID") },
    async ({ mangaId }) => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: Removing from manga list requires authentication (access_token)." }], isError: true };
      }
      await client.delete(`/manga/${mangaId}/my_list_status`);
      return { content: [{ type: "text", text: `Manga ${mangaId} removed from list.` }] };
    },
  );

  // ── Manage ────────────────────────────────────────────────────

  server.tool(
    "mal_get_user_info",
    "Get authenticated user profile information",
    {},
    async () => {
      if (!client.hasUserAuth) {
        return { content: [{ type: "text", text: "Error: User info requires authentication (access_token)." }], isError: true };
      }
      const data = await client.get("/users/@me", { fields: "anime_statistics,manga_statistics" }, true);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
