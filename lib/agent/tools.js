// lib/agent/tools.js
// Single source of truth for every tool the agent can call.
// Shape matches OpenAI function calling spec exactly.

export const TOOL_DEFINITIONS = [

  {
    type: "function",
    function: {
      name: "search_photos",
      description: `Search the user's own photo library. Supports location (place_name or ai_description), 
person name (tagged faces), relative or absolute dates, and semantic description. 
Always call this first when you need to identify a set of photos before acting on them.
Returns photo IDs, URLs, metadata. Max 200 results.`,
      parameters: {
        type: "object",
        properties: {
          location:    { type: "string",  description: "City, country, venue, or vague place. e.g. 'Italy', 'beach', 'grandma's house'" },
          person_name: { type: "string",  description: "Full or partial name of a tagged person" },
          days_ago:    { type: "number",  description: "Photos from the last N days" },
          date_from:   { type: "string",  description: "ISO date e.g. '2024-06-01'" },
          date_to:     { type: "string",  description: "ISO date e.g. '2024-08-31'" },
          semantic:    { type: "string",  description: "Free-text semantic description e.g. 'smiling at dinner', 'sunset on the water'" },
          limit:       { type: "number",  description: "Max results, default 100" },
        },
      },
    },
  },

  {
    type: "function",
    function: {
      name: "get_album",
      description: `Get all photos and members of a specific album the user owns or has access to.
Use fuzzy name matching when the user says 'the Italy album' or 'our family album'.
Returns album_id, photo list, member usernames, and ownership info.`,
      parameters: {
        type: "object",
        properties: {
          album_name: { type: "string", description: "Album name, fuzzy matched" },
          album_id:   { type: "number", description: "Exact album ID if known" },
        },
      },
    },
  },

  {
    type: "function",
    function: {
      name: "list_albums",
      description: "List all albums the user owns or has access to. Use when user says 'my albums' or you need to find an album by browsing.",
      parameters: { type: "object", properties: {} },
    },
  },

  {
    type: "function",
    function: {
      name: "create_album",
      description: "Create a new album and optionally add photos and share with users in one step.",
      parameters: {
        type: "object",
        properties: {
          name:       { type: "string",                        description: "Album name" },
          description:{ type: "string",                        description: "Optional description" },
          photo_ids:  { type: "array", items: { type: "number" }, description: "Photo IDs to add" },
          share_with: { type: "array", items: { type: "string" }, description: "Usernames to share with immediately" },
        },
        required: ["name"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "share_album",
      description: "Share an existing album with one or more users by username.",
      parameters: {
        type: "object",
        properties: {
          album_id:   { type: "number",                        description: "ID of the album to share" },
          share_with: { type: "array", items: { type: "string" }, description: "Usernames to share with" },
        },
        required: ["album_id", "share_with"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "ask_user_confirmation",
      description: `MUST be called before any destructive or irreversible action: deleting photos, 
bulk modifications, or any action affecting more than 20 photos at once.
This pauses execution and shows the user a confirmation dialog.
Describe exactly what you're about to do and why.`,
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Plain-English summary of what will happen" },
          action_preview: { type: "string", description: "Specifics: count, names, IDs affected" },
          severity: { type: "string", enum: ["low", "medium", "high"], description: "low=reversible, high=permanent" },
        },
        required: ["message", "severity"],
      },
    },
  },

];

// Tool names as a typed set — used for validation in executor
export const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map(t => t.function.name));