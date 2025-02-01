import { config } from 'dotenv';
import { Elysia } from 'elysia';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import OpenAI from 'openai';
import { TarotReader } from './tarot.js';
import { createServer } from 'http';

// Load environment variables
config();

// Check required environment variables
if (!process.env.NEYNAR_API_KEY) throw new Error('NEYNAR_API_KEY is required');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');

// Initialize API clients
const neynarClient = new NeynarAPIClient(
  new Configuration({ apiKey: process.env.NEYNAR_API_KEY })
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

// Create the Elysia app
const app = new Elysia()
  .get("/", () => new Response("🔮 Tarot bot is alive"))
  .post("/webhook", async ({ request }: { request: Request }) => {
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
if (process.env.NODE_ENV !== 'production' && typeof process !== 'undefined') {
  console.log("Starting development server...");
  
  const port = process.env.PORT ? parseInt(process.env.PORT) : 12345;
  
  const server = createServer(async (req, res) => {
    try {
      // Convert Node.js request to Web Request
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const body = req.method === 'POST' ? await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      }) : undefined;

      const webRequest = new Request(url.toString(), {
        method: req.method,
        headers: new Headers(req.headers as Record<string, string>),
        body: body ? body : undefined
      });

      const response = await app.fetch(webRequest);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(await response.text());
    } catch (error) {
      console.error('Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(port, () => {
    console.log(`🔮 Tarot bot server running at http://localhost:${port}`);
  });
}

export default app;