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

// System prompt for the travel assistant (dynamic to include today's date)
function getSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];

  return `You are a helpful travel assistant for busferrytrain.com, a meta-search engine for ground and sea transportation (buses, ferries, and trains) in Southeast Asia.

Today's date is ${today}. Use this to calculate dates when users say "tomorrow", "next week", etc.

Your role:
- Help users find the best routes for their journeys
- Search for trips using the search_trips tool when users ask about routes
- Provide travel tips and suggestions about Thailand
- Answer questions about stations, operators, and routes
- When users ask about destinations, things to do, places to visit, day trips, food, nightlife, or want travel recommendations - use the search_travel_content tool to find relevant articles
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
}

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
  {
    name: "search_travel_content",
    description:
      "Search for travel articles and recommendations about Thailand destinations. Use this when users ask about things to do, places to visit, day trips, beaches, food, nightlife, wildlife, or want travel tips for a specific destination. Returns up to 3 most relevant articles with images that will be displayed as cards to the user. Only call this once per destination - don't repeat calls for the same place.",
    input_schema: {
      type: "object" as const,
      properties: {
        destination: {
          type: "string",
          description: "The destination or place the user is asking about (e.g., 'Koh Samui', 'Phuket', 'Chiang Mai', 'Krabi')",
        },
        topic: {
          type: "string",
          description: "Optional specific topic like 'beaches', 'food', 'nightlife', 'day trips', 'things to do' - helps find more relevant articles",
        },
      },
      required: ["destination"],
    },
  },
];

// Bookaway blog base URL for Thailand content
const BOOKAWAY_BLOG_BASE = "https://www.bookaway.com/blog/category/destinations/thailand/";

// Article structure for display
interface ArticleData {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  excerpt?: string;
  destination?: string;
}

// Fetch and parse travel content from Bookaway
async function fetchTravelContent(destination: string, topic?: string): Promise<{ result: string; articles: ArticleData[] }> {
  try {
    // Normalize destination name for URL matching
    const destLower = destination.toLowerCase().replace(/\s+/g, "-").replace(/^koh-/, "ko-");

    // Common destination URL patterns on Bookaway
    const searchTerms = [
      destLower,
      destLower.replace("ko-", "koh-"),
      destination.toLowerCase().replace(/\s+/g, "-"),
    ];

    // First, try to fetch the Thailand blog index to find relevant articles
    const indexResponse = await fetch(BOOKAWAY_BLOG_BASE, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BusFerryTrain/1.0)",
      },
    });

    if (!indexResponse.ok) {
      return { result: `Could not fetch travel content. Status: ${indexResponse.status}`, articles: [] };
    }

    const indexHtml = await indexResponse.text();

    // Extract article links and images from the index page
    const articlePattern = /<a[^>]*href="(https:\/\/www\.bookaway\.com\/blog\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
    const simpleArticlePattern = /href="(https:\/\/www\.bookaway\.com\/blog\/[^"]+)"/g;

    const articlesWithImages: { url: string; image?: string }[] = [];
    let match;

    // Try to extract articles with images first
    while ((match = articlePattern.exec(indexHtml)) !== null) {
      articlesWithImages.push({ url: match[1], image: match[2] });
    }

    // Also get simple article links
    const allArticleUrls = new Set<string>();
    while ((match = simpleArticlePattern.exec(indexHtml)) !== null) {
      allArticleUrls.add(match[1]);
    }

    // Find articles matching the destination
    const relevantUrls = [...allArticleUrls].filter(url => {
      const urlLower = url.toLowerCase();
      return searchTerms.some(term => urlLower.includes(term)) ||
             (topic && urlLower.includes(topic.toLowerCase().replace(/\s+/g, "-")));
    });

    // If no exact match, try broader Thailand articles
    const thailandUrls = relevantUrls.length > 0
      ? relevantUrls
      : [...allArticleUrls].filter(url => url.includes("thailand")).slice(0, 4);

    if (thailandUrls.length === 0) {
      return {
        result: `No specific articles found for ${destination}. Try asking about popular destinations like Phuket, Koh Samui, Chiang Mai, or Krabi.`,
        articles: []
      };
    }

    // Fetch details for articles (fetch more, filter by title relevancy later)
    const articleDetails: ArticleData[] = [];
    const articlesToFetch = thailandUrls.slice(0, 8); // Fetch more to filter down

    for (const articleUrl of articlesToFetch) {
      try {
        const articleResponse = await fetch(articleUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; BusFerryTrain/1.0)",
          },
        });

        if (!articleResponse.ok) continue;

        const articleHtml = await articleResponse.text();

        // Extract title
        const titleMatch = articleHtml.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/ \| Bookaway.*$/i, "").trim() : "Travel Guide";

        // Extract og:image or first article image
        const ogImageMatch = articleHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        const featuredImageMatch = articleHtml.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i);
        const firstImageMatch = articleHtml.match(/<article[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i);
        const imageUrl = ogImageMatch?.[1] || featuredImageMatch?.[1] || firstImageMatch?.[1];

        // Extract meta description or first paragraph as excerpt
        const descMatch = articleHtml.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
        let excerpt = descMatch?.[1];

        if (!excerpt) {
          const firstParagraph = articleHtml.match(/<article[^>]*>[\s\S]*?<p[^>]*>([^<]+)/i);
          excerpt = firstParagraph?.[1]?.substring(0, 150);
        }

        // Only include article if destination name appears in title
        const titleLower = title.toLowerCase();
        const destWords = destination.toLowerCase().split(/\s+/);
        const hasDestInTitle = destWords.some(word =>
          word.length > 2 && titleLower.includes(word)
        );

        if (hasDestInTitle) {
          articleDetails.push({
            id: `article_${articleDetails.length}_${Date.now()}`,
            title,
            url: articleUrl,
            imageUrl,
            excerpt: excerpt ? excerpt.trim() + (excerpt.length >= 150 ? "..." : "") : undefined,
            destination,
          });
        }
      } catch (err) {
        console.error(`Error fetching article ${articleUrl}:`, err);
      }
    }

    // Get content from first article for LLM context
    let content = "";
    if (articleDetails.length > 0) {
      const mainArticleUrl = articleDetails[0].url;
      try {
        const mainResponse = await fetch(mainArticleUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BusFerryTrain/1.0)" },
        });
        if (mainResponse.ok) {
          const mainHtml = await mainResponse.text();
          content = mainHtml
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 2000);
        }
      } catch {
        // Ignore, we'll use what we have
      }
    }

    return {
      result: JSON.stringify({
        destination,
        articlesFound: articleDetails.length,
        mainArticle: articleDetails[0]?.title,
        content: content || "Article content could not be extracted",
      }),
      articles: articleDetails,
    };

  } catch (error) {
    console.error("Error fetching travel content:", error);
    return { result: `Error fetching travel content for ${destination}: ${error}`, articles: [] };
  }
}

// Handle tool calls
async function handleToolCall(
  toolName: string,
  toolInput: Record<string, string>
): Promise<{ result: string; trips?: unknown[]; articles?: ArticleData[] }> {
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

          // Sort by duration (ascending), then by price (ascending) as tiebreaker
          const sortedTrips = [...trips].sort((a, b) => {
            if (a.duration !== b.duration) {
              return a.duration - b.duration;
            }
            return a.price.amount - b.price.amount;
          });

          // Take top 3 only
          const topTrips = sortedTrips.slice(0, 3);

          // Format trips for the LLM
          const tripSummary = topTrips.map((trip) => ({
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
              showing: topTrips.length,
              from: originPoi.name,
              to: destPoi.name,
              date,
              trips: tripSummary,
            }),
            trips: topTrips,
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

      case "search_travel_content": {
        const { destination, topic } = toolInput;
        console.log(`Fetching travel content for: ${destination}${topic ? ` (topic: ${topic})` : ""}`);

        const { result, articles } = await fetchTravelContent(destination, topic);
        return {
          result,
          articles,
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
        let isClosed = false;

        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            controller.enqueue(data);
          }
        };

        const safeClose = () => {
          if (!isClosed) {
            isClosed = true;
            controller.close();
          }
        };

        try {
          let currentResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: getSystemPrompt(),
            tools,
            messages,
          });

          let allTrips: unknown[] = [];
          let allArticles: ArticleData[] = [];

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

            // Collect articles from tool results
            if (toolResult.articles) {
              allArticles = [...allArticles, ...toolResult.articles];
            }

            // Continue conversation with tool result
            currentResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 4096,
              system: getSystemPrompt(),
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
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", content: textBlock.text })}\n\n`
              )
            );

            // Send embedded trips if any
            if (allTrips.length > 0) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "trips", trips: allTrips })}\n\n`
                )
              );
            }

            // Send embedded articles if any (max 3, most relevant first)
            if (allArticles.length > 0) {
              const topArticles = allArticles.slice(0, 3);
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "articles", articles: topArticles })}\n\n`
                )
              );
            }
          }

          safeEnqueue(encoder.encode("data: [DONE]\n\n"));
          safeClose();
        } catch (error) {
          console.error("Chat error:", error);
          safeEnqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: "Failed to generate response",
              })}\n\n`
            )
          );
          safeClose();
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
