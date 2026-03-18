import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RyotClient } from "../clients/ryot-client.js";

export function registerRyotTools(server: McpServer, client: RyotClient) {
  // ── Search ────────────────────────────────────────────────────

  server.tool(
    "ryot_search_media",
    "Search media across all types in Ryot (movies, TV, anime, manga, books, games, etc.)",
    {
      query: z.string().describe("Search query"),
      lot: z.enum(["ANIME", "AUDIO_BOOK", "BOOK", "MANGA", "MOVIE", "PODCAST", "SHOW", "VIDEO_GAME", "VISUAL_NOVEL"])
        .describe("Media lot/type"),
      page: z.number().optional().default(1),
    },
    async ({ query, lot, page }) => {
      const data = await client.query(`
        query SearchMedia($input: MetadataSearchInput!) {
          metadataSearch(input: $input) {
            details { total nextPage }
            items { identifier title image publishYear }
          }
        }
      `, { input: { search: { query, page }, lot } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
      const data = await client.query(`
        query GetMediaDetails($metadataId: String!) {
          metadataDetails(metadataId: $metadataId) {
            id lot title description publishYear publishDate
            genres
            providerRating
            group { id name part }
            assets { images videos }
          }
        }
      `, { metadataId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_get_media_list",
    "Get user's media list filtered by type and collection",
    {
      lot: z.enum(["ANIME", "AUDIO_BOOK", "BOOK", "MANGA", "MOVIE", "PODCAST", "SHOW", "VIDEO_GAME", "VISUAL_NOVEL"])
        .optional()
        .describe("Filter by media type"),
      page: z.number().optional().default(1),
    },
    async ({ lot, page }) => {
      const data = await client.query(`
        query GetMediaList($input: MediaListInput!) {
          mediaList(input: $input) {
            details { total nextPage }
            items {
              data { identifier title image publishYear }
              averageRating
            }
          }
        }
      `, { input: { page, lot } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_get_user_summary",
    "Get user statistics summary (counts, time spent, etc.)",
    {},
    async () => {
      const data = await client.query(`
        query GetUserSummary {
          latestUserSummary {
            calculatedOn
            media {
              anime { watched episodes }
              audioBooks { played items }
              books { read pages }
              manga { read chapters }
              movies { watched }
              podcasts { played episodes }
              shows { watched watchedEpisodes watchedSeasons }
              videoGames { played }
              visualNovels { played }
            }
          }
        }
      `);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_get_collections",
    "List all collections",
    {},
    async () => {
      const data = await client.query(`
        query GetCollections {
          userCollectionsList {
            id name description numItems
            collaborators { user { name } }
          }
        }
      `);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_get_in_progress",
    "Get media currently in progress",
    {},
    async () => {
      const data = await client.query(`
        query GetInProgress {
          mediaList(input: { filter: { general: IN_PROGRESS }, page: 1 }) {
            details { total }
            items {
              data { identifier title image publishYear }
              averageRating
            }
          }
        }
      `);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── Track ─────────────────────────────────────────────────────

  server.tool(
    "ryot_add_to_list",
    "Add media to the user's list",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
    },
    async ({ metadataId }) => {
      const data = await client.mutation(`
        mutation AddToList($input: AddMediaToCollection!) {
          addMediaToCollection(input: $input)
        }
      `, { input: { metadataId, collectionName: "Watchlist" } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_update_progress",
    "Update progress on a media item (e.g. mark episodes watched)",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
      progress: z.number().min(0).max(100).describe("Progress percentage (0-100)"),
      showSeasonNumber: z.number().optional().describe("Season number (for TV/anime)"),
      showEpisodeNumber: z.number().optional().describe("Episode number (for TV/anime)"),
    },
    async ({ metadataId, progress, showSeasonNumber, showEpisodeNumber }) => {
      const data = await client.mutation(`
        mutation UpdateProgress($input: ProgressUpdateInput!) {
          deployUpdateMetadataJob(input: $input)
        }
      `, {
        input: {
          metadataId,
          progress,
          ...(showSeasonNumber !== undefined && { showSeasonNumber }),
          ...(showEpisodeNumber !== undefined && { showEpisodeNumber }),
        },
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_rate_media",
    "Rate a media item",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
      rating: z.number().min(0).max(100).describe("Rating (0-100 scale)"),
    },
    async ({ metadataId, rating }) => {
      const data = await client.mutation(`
        mutation PostReview($input: PostReviewInput!) {
          postReview(input: $input) { id }
        }
      `, { input: { metadataId, rating } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_post_review",
    "Post a text review for a media item",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
      text: z.string().describe("Review text"),
      rating: z.number().min(0).max(100).optional().describe("Rating (0-100 scale)"),
      isSpoiler: z.boolean().optional().default(false).describe("Mark as spoiler"),
    },
    async ({ metadataId, text, rating, isSpoiler }) => {
      const data = await client.mutation(`
        mutation PostReview($input: PostReviewInput!) {
          postReview(input: $input) { id }
        }
      `, { input: { metadataId, text, rating, isSpoiler } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
      const data = await client.mutation(`
        mutation CreateCollection($input: CreateOrUpdateCollectionInput!) {
          createOrUpdateCollection(input: $input) { id }
        }
      `, { input: { name, description } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_delete_from_list",
    "Remove media from a collection",
    {
      metadataId: z.string().describe("Ryot metadata ID"),
      collectionName: z.string().optional().default("Watchlist").describe("Collection name"),
    },
    async ({ metadataId, collectionName }) => {
      const data = await client.mutation(`
        mutation RemoveFromCollection($input: AddMediaToCollection!) {
          removeMediaFromCollection(input: $input)
        }
      `, { input: { metadataId, collectionName } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "ryot_import_from_source",
    "Import media data from an external source (MAL, Trakt, Goodreads, etc.)",
    {
      source: z.enum(["MAL", "TRAKT", "GOODREADS", "TMDB", "IGDB", "OPEN_LIBRARY", "AUDIBLE"])
        .describe("Import source"),
      identifier: z.string().describe("External ID from the source"),
      lot: z.enum(["ANIME", "AUDIO_BOOK", "BOOK", "MANGA", "MOVIE", "PODCAST", "SHOW", "VIDEO_GAME", "VISUAL_NOVEL"])
        .describe("Media type"),
    },
    async ({ source, identifier, lot }) => {
      const data = await client.mutation(`
        mutation CommitMedia($input: CommitMediaInput!) {
          commitMetadata(input: $input) { id }
        }
      `, { input: { identifier, lot, source } });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
