import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RyotClient } from "../clients/ryot-client.js";

const slim = (obj: any, keys: string[]) => keys.reduce((r: any, k) => { if (obj[k] !== undefined) r[k] = obj[k]; return r; }, {});

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const MEDIA_LOT = z.enum([
  "ANIME", "AUDIO_BOOK", "BOOK", "COMIC_BOOK", "MANGA",
  "MOVIE", "MUSIC", "PODCAST", "SHOW", "VIDEO_GAME", "VISUAL_NOVEL",
]);

const MEDIA_SOURCE = z.enum([
  "ANILIST", "AUDIBLE", "CUSTOM", "GIANT_BOMB", "GOOGLE_BOOKS",
  "HARDCOVER", "IGDB", "ITUNES", "LISTENNOTES", "MANGA_UPDATES",
  "METRON", "MUSIC_BRAINZ", "MYANIMELIST", "OPENLIBRARY",
  "SPOTIFY", "TMDB", "TVDB", "VNDB", "YOUTUBE_MUSIC",
]);

export function registerRyotTools(server: McpServer, getClient: () => RyotClient) {
  // ── Search ────────────────────────────────────────────────────

  server.tool(
    "ryot_search_media",
    "Search media across all types in Ryot (movies, TV, anime, manga, books, games, etc.)",
    {
      query: z.string().describe("Search query"),
      lot: MEDIA_LOT.describe("Media lot/type"),
      source: MEDIA_SOURCE.describe("Media source. Use TMDB for movies/shows, ANILIST for anime, MYANIMELIST for anime/manga, IGDB for games, AUDIBLE for audiobooks, OPENLIBRARY for books"),
      page: z.number().optional().default(1),
    },
    async ({ query, lot, source, page }) => {
      const data: any = await getClient().query(`
        query SearchMedia($input: MetadataSearchInput!) {
          metadataSearch(input: $input) {
            response {
              details { totalItems nextPage }
              items
            }
          }
        }
      `, { input: { search: { query, page }, lot, source } });
      const resp = data?.metadataSearch?.response;
      if (resp && Array.isArray(resp.items)) {
        resp.items = resp.items.map((i: any) => slim(i, ["identifier", "title", "publishYear"]));
      }
      return ok(data);
    },
  );

  // ── Read ───────────────────────────────────────────────────────

  server.tool(
    "ryot_get_media_details",
    "Get detailed information about a media item in Ryot",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
    },
    async ({ metadataId }) => {
      const data: any = await getClient().query(`
        query GetMediaDetails($metadataId: String!) {
          metadataDetails(metadataId: $metadataId) {
            id lot title publishYear publishDate
            genres
            providerRating
            group { id name part }
          }
        }
      `, { metadataId });
      return ok(data);
    },
  );

  server.tool(
    "ryot_get_media_list",
    "Get user's media list filtered by type",
    {
      lot: MEDIA_LOT.optional().describe("Filter by media type"),
    },
    async ({ lot }) => {
      const data: any = await getClient().query(`
        query GetMediaList($input: UserMetadataListInput!) {
          userMetadataList(input: $input) {
            response {
              details { totalItems nextPage }
              items
            }
          }
        }
      `, { input: { lot } });
      const resp = data?.userMetadataList?.response;
      if (resp && Array.isArray(resp.items)) {
        resp.items = resp.items.map((i: any) => slim(i, ["identifier", "title", "lot", "publishYear"]));
      }
      return ok(data);
    },
  );

  server.tool(
    "ryot_get_user_summary",
    "Get user statistics summary (counts, time spent, etc.)",
    {
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD). Defaults to 1 year ago."),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD). Defaults to today."),
    },
    async ({ startDate, endDate }) => {
      const end = endDate || new Date().toISOString().slice(0, 10);
      const start = startDate || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const data = await getClient().query(`
        query GetUserSummary($input: UserAnalyticsInput!) {
          userAnalytics(input: $input) {
            activities {
              totalCount totalDuration itemCount
              items {
                day
                animeCount movieCount showCount bookCount mangaCount
                podcastCount videoGameCount visualNovelCount audioBookCount
                totalMovieDuration totalShowDuration totalBookPages
                totalMetadataCount totalDuration
              }
            }
          }
        }
      `, { input: { dateRange: { startDate: start, endDate: end } } });
      return ok(data);
    },
  );

  server.tool(
    "ryot_get_collections",
    "List all collections",
    {},
    async () => {
      const data: any = await getClient().query(`
        query GetCollections {
          userCollectionsList {
            response { id name description count isDefault }
          }
        }
      `);
      const resp = data?.userCollectionsList?.response;
      if (Array.isArray(resp)) {
        data.userCollectionsList.response = resp.map((c: any) => slim(c, ["id", "name", "count", "isDefault"]));
      }
      return ok(data);
    },
  );

  server.tool(
    "ryot_get_in_progress",
    "Get media currently in progress",
    {},
    async () => {
      const data: any = await getClient().query(`
        query GetInProgress {
          userMetadataList(input: { filter: { general: IN_PROGRESS } }) {
            response {
              details { total }
              items
            }
          }
        }
      `);
      const resp = data?.userMetadataList?.response;
      if (resp && Array.isArray(resp.items)) {
        resp.items = resp.items.map((i: any) => slim(i, ["identifier", "title", "lot", "publishYear"]));
      }
      return ok(data);
    },
  );

  // ── Track ─────────────────────────────────────────────────────

  server.tool(
    "ryot_add_to_list",
    "Add media to a collection (requires creatorUserId)",
    {
      creatorUserId: z.string().describe("Ryot user ID (owner of the collection)"),
      metadataId: z.string().describe("Ryot metadata ID"),
      collectionName: z.string().optional().default("Watchlist").describe("Collection name"),
    },
    async ({ creatorUserId, metadataId, collectionName }) => {
      const data = await getClient().mutation(`
        mutation AddToCollection($input: ChangeCollectionToEntitiesInput!) {
          deployAddEntitiesToCollectionJob(input: $input)
        }
      `, {
        input: {
          creatorUserId,
          collectionName,
          entities: [{ entityId: metadataId, entityLot: "METADATA" }],
        },
      });
      return ok(data);
    },
  );

  server.tool(
    "ryot_update_progress",
    "Update progress on a media item (e.g. mark episodes watched)",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
      progress: z.number().min(0).max(100).describe("Progress percentage (0-100)"),
      lot: MEDIA_LOT.describe("Media type"),
      showSeasonNumber: z.number().optional().describe("Season number (for TV/anime)"),
      showEpisodeNumber: z.number().optional().describe("Episode number (for TV/anime)"),
    },
    async ({ metadataId, progress, lot, showSeasonNumber, showEpisodeNumber }) => {
      const data = await getClient().mutation(`
        mutation UpdateProgress($input: [ProgressUpdateInput!]!) {
          deployBulkMetadataProgressUpdate(input: $input)
        }
      `, {
        input: [{
          metadataId,
          progress,
          lot,
          ...(showSeasonNumber !== undefined && { showSeasonNumber }),
          ...(showEpisodeNumber !== undefined && { showEpisodeNumber }),
        }],
      });
      return ok(data);
    },
  );

  server.tool(
    "ryot_rate_media",
    "Rate a media item",
    {
      entityId: z.string().describe("Ryot metadata ID"),
      rating: z.number().min(0).max(100).describe("Rating (0-100 scale)"),
    },
    async ({ entityId, rating }) => {
      const data = await getClient().mutation(`
        mutation PostReview($input: CreateOrUpdateReviewInput!) {
          createOrUpdateReview(input: $input) { id }
        }
      `, { input: { entityId, entityLot: "METADATA", rating } });
      return ok(data);
    },
  );

  server.tool(
    "ryot_post_review",
    "Post a text review for a media item",
    {
      entityId: z.string().describe("Ryot metadata ID"),
      text: z.string().describe("Review text"),
      rating: z.number().min(0).max(100).optional().describe("Rating (0-100 scale)"),
      isSpoiler: z.boolean().optional().default(false).describe("Mark as spoiler"),
    },
    async ({ entityId, text, rating, isSpoiler }) => {
      const data = await getClient().mutation(`
        mutation PostReview($input: CreateOrUpdateReviewInput!) {
          createOrUpdateReview(input: $input) { id }
        }
      `, { input: { entityId, entityLot: "METADATA", text, rating, isSpoiler } });
      return ok(data);
    },
  );

  // ── Manage ────────────────────────────────────────────────────

  server.tool(
    "ryot_create_collection",
    "Create a new collection",
    {
      name: z.string().describe("Collection name"),
      description: z.string().optional().describe("Collection description"),
    },
    async ({ name, description }) => {
      const data = await getClient().mutation(`
        mutation CreateCollection($input: CreateOrUpdateCollectionInput!) {
          createOrUpdateCollection(input: $input) { id }
        }
      `, { input: { name, description } });
      return ok(data);
    },
  );

  server.tool(
    "ryot_delete_from_list",
    "Remove media from a collection (requires creatorUserId)",
    {
      creatorUserId: z.string().describe("Ryot user ID (owner of the collection)"),
      metadataId: z.string().describe("Ryot metadata ID"),
      collectionName: z.string().optional().default("Watchlist").describe("Collection name"),
    },
    async ({ creatorUserId, metadataId, collectionName }) => {
      const data = await getClient().mutation(`
        mutation RemoveFromCollection($input: ChangeCollectionToEntitiesInput!) {
          deployRemoveEntitiesFromCollectionJob(input: $input)
        }
      `, {
        input: {
          creatorUserId,
          collectionName,
          entities: [{ entityId: metadataId, entityLot: "METADATA" }],
        },
      });
      return ok(data);
    },
  );

  server.tool(
    "ryot_import_from_source",
    "Import/commit a media item from an external source into Ryot",
    {
      entityId: z.string().describe("External ID from the source"),
      entityLot: z.enum(["METADATA", "METADATA_GROUP", "PERSON"]).default("METADATA")
        .describe("Entity type"),
    },
    async ({ entityId, entityLot }) => {
      const data = await getClient().mutation(`
        mutation ImportMedia($input: EntityWithLotInput!) {
          deployUpdateMediaEntityJob(input: $input)
        }
      `, { input: { entityId, entityLot } });
      return ok(data);
    },
  );
}
