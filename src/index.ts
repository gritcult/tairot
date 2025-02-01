import { Elysia } from "elysia";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import OpenAI from "openai";
import { TarotReader } from "./tarot.js";

// Initialize API clients
const neynarClient = new NeynarAPIClient(
  new Configuration({ apiKey: process.env.NEYNAR_API_KEY! })
);

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const tarotReader = new TarotReader(openaiClient);

// Define webhook types
interface WebhookBody {
  type: string;
  data: {
    text: string;
    hash: string;
    mentioned_profiles?: Array<{ fid: string }>;
  };
}

// Create the server
const app = new Elysia()
  .get("/", () => new Response("🔮 Tarot bot is alive"))
  .post("/webhook", async ({ request }) => {
    try {
      const body = await request.json() as WebhookBody;
      console.log("Received webhook:", body);

      // Validate webhook data
      if (!body || !body.data || !body.type) {
        console.error("Invalid webhook data");
        return new Response(JSON.stringify({ error: "Invalid webhook data" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Check if this is a cast mention
      if (body.type !== "cast.created") {
        console.log("Ignoring non-cast webhook");
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Check if the bot was mentioned
      const botFid = process.env.BOT_FID;
      const mentioned = body.data.mentioned_profiles?.some(
        (profile: { fid: string }) => profile.fid === botFid
      );

      if (!mentioned) {
        console.log("Bot not mentioned, ignoring");
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Extract the question (remove the bot mention)
      const text = body.data.text.replace(/@tairot/g, "").trim();
      console.log("Processing question:", text);

      // Get the tarot reading
      const reading = await tarotReader.getReading(text);

      // Reply to the cast
      if (process.env.SIGNER_UID) {
        await neynarClient.publishCast({
          signerUuid: process.env.SIGNER_UID,
          text: reading,
          parent: body.data.hash
        });
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(JSON.stringify({ 
        status: "error", 
        message: "Internal error, but webhook received" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  });

// For local development
if (process.env.NODE_ENV === 'development') {
  console.log("Starting development server...");
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  Bun.serve({
    fetch: app.fetch,
    port: port
  });
  console.log(`🔮 Tarot bot server running on port ${port}`);
}

// Export for Vercel
export default {
  fetch: app.fetch
};