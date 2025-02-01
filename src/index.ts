import { Elysia } from "elysia";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import OpenAI from "openai";
import { TarotReader } from "./tarot";

// Initialize API clients only if environment variables are present
let neynarClient: NeynarAPIClient | null = null;
let openaiClient: OpenAI | null = null;
let tarotReader: TarotReader | null = null;

try {
  if (!process.env.NEYNAR_API_KEY) {
    console.error("Missing NEYNAR_API_KEY environment variable");
  } else {
    const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
    neynarClient = new NeynarAPIClient(config);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY environment variable");
  } else {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    tarotReader = new TarotReader(openaiClient);
  }
} catch (error) {
  console.error("Error initializing API clients:", error);
}

interface WebhookBody {
  type: string;
  data: {
    text: string;
    hash: string;
    mentioned_profiles?: Array<{ fid: string }>;
  };
}

const app = new Elysia()
  .get("/", () => "🔮 Tarot bot is alive")
  .post("/webhook", async ({ body, set }: { body: WebhookBody, set: { status: number } }) => {
    try {
      console.log("Received webhook:", body);

      // Validate webhook data
      if (!body || !body.data || !body.type) {
        console.error("Invalid webhook data");
        set.status = 400;
        return { error: "Invalid webhook data" };
      }

      // Check if this is a cast mention
      if (body.type !== "cast.created") {
        console.log("Ignoring non-cast webhook");
        return { status: "ok" };
      }

      // Check if the bot was mentioned
      const botFid = process.env.BOT_FID;
      const mentioned = body.data.mentioned_profiles?.some(
        (profile) => profile.fid === botFid
      );

      if (!mentioned) {
        console.log("Bot not mentioned, ignoring");
        return { status: "ok" };
      }

      // Extract the question (remove the bot mention)
      const text = body.data.text.replace(/@tairot/g, "").trim();
      console.log("Processing question:", text);

      // Check if API clients are initialized
      if (!neynarClient || !openaiClient || !tarotReader) {
        console.error("API clients not initialized. Check environment variables.");
        set.status = 503;
        return { error: "Service unavailable - missing configuration" };
      }

      // Get the tarot reading
      const reading = await tarotReader.getReading(text);

      // Reply to the cast
      if (process.env.SIGNER_UID) {
        await neynarClient.publishCast({
          signerUuid: process.env.SIGNER_UID,
          text: reading,
          parent: body.data.hash
        });
      } else {
        console.error("Missing SIGNER_UID environment variable");
      }

      return { status: "ok" };
    } catch (error) {
      console.error("Error processing webhook:", error);
      // Always return 200 to acknowledge receipt
      return { status: "error", message: "Internal error, but webhook received" };
    }
  });

// Local development server
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  console.log(`🔮 Tarot bot server running on port ${port}`);
  
  const server = Bun.serve({
    fetch: app.fetch,
    port: port
  });
}

// Export for serverless deployment
export default app;