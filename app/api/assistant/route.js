// app/api/assistant/route.js
// Unified AI assistant — handles all user photo queries.
// Uses GPT-4o with function calling. Runs an agentic loop (up to 8 turns).
// Returns a structured response the UI can render: text + photos + actions.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/assistant/tools";

const SYSTEM_PROMPT = `You are Gathrd's AI memory assistant. You help users explore, search, and manage their photo memories. You have access to a set of tools to fetch real data — always use them, never make up answers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNDERSTANDING USER QUERIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Map user questions to the right tool:

• "show me photos with mom / dad / sister / [name]" → search_photos with the person's name
• "photos from my birthday / wedding / trip" → search_photos with the event as query
• "what was I doing last October / in summer 2023" → get_timeline with month/year params
• "tell me my life story / life chapters" → get_life_chapters
• "2024 year in review / what was 2024 like" → generate_year_in_review
• "who do I take the most photos with?" → get_people_stats (no person_name)
• "best photos for instagram / top photos / what should I post?" → get_best_photos_for_instagram
• "suggest instagram captions for these photos" → generate_captions
• "find duplicates / clean up my library" → find_duplicates
• "create an album of [X]" → search_photos first to get IDs, then create_album
• "send/share these photos with [username]" → share_photos
• "share this album with [username]" → share_album
• "delete these photos" → ALWAYS ask for confirmation first, then delete_photos

For multi-step tasks (e.g. "find my birthday photos and create an album"):
1. First call search_photos to find the photos
2. Then call create_album with the photo IDs from step 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NEVER output raw image URLs, markdown images (![...](url)), or embed URLs in your text.
- The UI renders photos automatically from tool results — you don't need to describe individual photos.
- After getting search results, write ONE warm sentence about what you found. Don't list filenames.
- For people stats: "You take the most photos with [name]! Here are some highlights." — then stop.
- If search_photos returns resolved_people, mention who was found by name.
- If search_photos returns no_together_message, relay that message to the user.
- For instagram suggestions: be enthusiastic and give brief tips on WHY these photos work well for IG.
- For timeline: summarize what you see in the data — where they were, what mood the photos show.
- For year in review: introduce the narrative warmly, then let the UI show it.
- For captions: present each caption clearly labeled.
- For destructive actions (delete): ALWAYS describe what you'll do and ask for confirmation first. Never call delete_photos without explicit "yes" from the user.
- For sharing: confirm the action was done and who it was sent to.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Warm, personal, conversational — like a thoughtful friend who has seen all your photos and genuinely cares about your memories. Be concise but human. When you find something delightful in the data (lots of travel, a recurring happy face), mention it.`;

const MAX_TURNS = 8;

export async function POST(req) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const username = session.user.username;
    const { messages } = await req.json();

    if (!messages?.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

    // Build message history for OpenAI
    const openaiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // ── Agentic loop ──────────────────────────────────────────────────────────
    let turn = 0;
    const toolResults = []; // collect all tool results to return to UI

    while (turn < MAX_TURNS) {
      turn++;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 1500,
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
          messages: openaiMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      if (!message) throw new Error("No message in OpenAI response");

      // Add assistant message to history
      openaiMessages.push(message);

      // ── No tool calls → we're done ────────────────────────────────────────
      if (!message.tool_calls?.length || choice.finish_reason === "stop") {
        return NextResponse.json({
          reply: message.content || "",
          tool_results: toolResults,
          turns: turn,
        });
      }

      // ── Execute all tool calls in this turn ───────────────────────────────
      const toolCallResults = await Promise.all(
        message.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          let params = {};
          try { params = JSON.parse(toolCall.function.arguments); } catch {}

          let result;
          try {
            result = await executeTool(toolName, params, username);
          } catch (err) {
            result = { error: err.message };
          }

          // Track for UI rendering
          toolResults.push({
            tool: toolName,
            params,
            result,
          });

          return {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Add all tool results to history for next turn
      openaiMessages.push(...toolCallResults);
    }

    // Hit max turns — return whatever we have
    return NextResponse.json({
      reply: "I've gathered the information. Here's what I found.",
      tool_results: toolResults,
      turns: turn,
    });
  } catch (err) {
    console.error("Assistant error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}