import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { searchItineraries } from "@/lib/tc-api-client";
import { translateToPOI } from "@/lib/poi-loader";
import { searchStations } from "@/lib/stations-loader";

export const runtime = "nodejs";
export const maxDuration = 60;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt for the travel assistant
const SYSTEM_PROMPT = `You are a helpful travel assistant for busferrytrain.com, a meta-search engine for ground and sea transportation (buses, ferries, and trains) in Southeast Asia.

Your role:
- Help users find the best routes for their journeys
- Search for trips using the search_trips tool when users ask about routes
- Provide travel tips and suggestions about Thailand
- Answer questions about stations, operators, and routes
- Be conversational, helpful, and concise

When users ask about trips or routes:
1. Use the search_trips tool to find actual options
2. Present the results clearly with departure/arrival times, duration, price, and operator
3. Add helpful tips when relevant (e.g., "Early morning buses are usually less crowded")

Important guidelines:
- Always search for real data - don't make up trip information
- If a search returns no results, suggest alternative routes or dates
- Use emojis sparingly: 🚌 for bus, ⛴️ for ferry, 🚂 for train, 💡 for tips
- Keep responses concise but informative
- When presenting multiple trips, highlight the best value or fastest option

Example response format when showing trips:
"I found X options for you:

🚌 **Fastest**: Depart 08:00 → Arrive 14:00 (6h)
   Operator: 12Go Asia | ฿450

🚌 **Cheapest**: Depart 22:00 → Arrive 06:00 (8h)
   Operator: 12Go Asia | ฿320

💡 Tip: Night buses save time and a hotel stay!"`;

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "search_trips",
    description:
      "Search for bus, ferry, or train trips between two locations on a specific date. Use this whenever a user asks about traveling between cities.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: {
          type: "string",
          description:
            "Origin city or station name (e.g., 'Bangkok', 'Phuket', 'Chiang Mai')",
        },
        destination: {
          type: "string",
          description: "Destination city or station name",
        },
        date: {
          type: "string",
          description:
            "Travel date in YYYY-MM-DD format. If the user says 'tomorrow', calculate the actual date.",
        },
      },
      required: ["origin", "destination", "date"],
    },
  },
  {
    name: "find_stations",
    description:
      "Find stations matching a search query. Use this to help users find the correct station name.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query for station name or city",
        },
      },
      required: ["query"],
    },
  },
];

// Handle tool calls
async function handleToolCall(
  toolName: string,
  toolInput: Record<string, string>
): Promise<{ result: string; trips?: unknown[] }> {
  try {
    switch (toolName) {
      case "search_trips": {
        const { origin, destination, date } = toolInput;

        // Translate place names to POI IDs
        const originPoi = await translateToPOI(origin);
        const destPoi = await translateToPOI(destination);

        if (!originPoi) {
          return {
            result: `Could not find a location matching "${origin}". Try searching for a different city name.`,
          };
        }

        if (!destPoi) {
          return {
            result: `Could not find a location matching "${destination}". Try searching for a different city name.`,
          };
        }

        try {
          const trips = await searchItineraries({
            departurePoi: originPoi.poi,
            arrivalPoi: destPoi.poi,
            departureDate: date,
          });

          if (trips.length === 0) {
            return {
              result: `No trips found from ${originPoi.name} to ${destPoi.name} on ${date}. This route might not have service on this date, or all trips might be sold out.`,
            };
          }

          // Format trips for the LLM
          const tripSummary = trips.slice(0, 5).map((trip) => ({
            departureTime: trip.departureTime,
            arrivalTime: trip.arrivalTime,
            duration: `${Math.floor(trip.duration / 60)}h ${trip.duration % 60}m`,
            price: `${trip.price.currency} ${trip.price.amount}`,
            operator: trip.operator,
            vehicleType: trip.vehicleType,
            availableSeats: trip.availableSeats,
          }));

          return {
            result: JSON.stringify({
              found: trips.length,
              from: originPoi.name,
              to: destPoi.name,
              date,
              trips: tripSummary,
            }),
            trips: trips.slice(0, 5),
          };
        } catch (error) {
          console.error("Search error:", error);
          return {
            result: `Search failed for ${originPoi.name} to ${destPoi.name}. The service might be temporarily unavailable.`,
          };
        }
      }

      case "find_stations": {
        const { query } = toolInput;
        const stations = searchStations(query, { limit: 5 });

        if (stations.length === 0) {
          return {
            result: `No stations found matching "${query}".`,
          };
        }

        const stationList = stations.map((s) => ({
          name: s.name,
          city: s.city,
          province: s.province,
        }));

        return {
          result: JSON.stringify(stationList),
        };
      }

      default:
        return { result: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool error (${toolName}):`, error);
    return { result: `Error executing ${toolName}: ${error}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory || []),
      { role: "user" as const, content: message },
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          });

          let allTrips: unknown[] = [];

          // Handle tool use loop
          while (currentResponse.stop_reason === "tool_use") {
            const toolUseBlock = currentResponse.content.find(
              (block): block is Anthropic.ToolUseBlock =>
                block.type === "tool_use"
            );

            if (!toolUseBlock) break;

            // Execute tool
            const toolResult = await handleToolCall(
              toolUseBlock.name,
              toolUseBlock.input as Record<string, string>
            );

            // Collect trips from tool results
            if (toolResult.trips) {
              allTrips = [...allTrips, ...toolResult.trips];
            }

            // Continue conversation with tool result
            currentResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: SYSTEM_PROMPT,
              tools,
              messages: [
                ...messages,
                { role: "assistant" as const, content: currentResponse.content },
                {
                  role: "user" as const,
                  content: [
                    {
                      type: "tool_result" as const,
                      tool_use_id: toolUseBlock.id,
                      content: toolResult.result,
                    },
                  ],
                },
              ],
            });
          }

          // Extract text from final response
          const textBlock = currentResponse.content.find(
            (block): block is Anthropic.TextBlock => block.type === "text"
          );

          if (textBlock) {
            // Send text content
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", content: textBlock.text })}\n\n`
              )
            );

            // Send embedded trips if any
            if (allTrips.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "trips", trips: allTrips })}\n\n`
                )
              );
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Chat error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: "Failed to generate response",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
