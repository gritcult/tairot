import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { config } from "dotenv";
import { TarotReader } from "./tarot";
import OpenAI from "openai";

config();

// Initialize API clients only if environment variables are present
let neynar: NeynarAPIClient | null = null;
let openai: OpenAI | null = null;
let tarotReader: TarotReader | null = null;

try {
  if (!process.env.NEYNAR_API_KEY) {
    throw new Error('Missing NEYNAR_API_KEY');
  }
  neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  tarotReader = new TarotReader(openai);

  console.log('Successfully initialized API clients');
} catch (error) {
  console.error('Error initializing API clients:', error);
}

// Vercel serverless function handler
export default async function handler(req: Request) {
  console.log('Received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return new Response('OK', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-neynar-webhook-secret'
        }
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Check if APIs are initialized
    if (!neynar || !openai || !tarotReader) {
      throw new Error('API clients not properly initialized. Check environment variables.');
    }

    const body = await req.json();
    console.log("Received webhook event:", JSON.stringify(body, null, 2));
    
    // Verify webhook secret if provided
    const webhookSecret = req.headers.get("x-neynar-webhook-secret");
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      console.error("Webhook secret mismatch");
      return new Response("Unauthorized", { status: 401 });
    }

    if (body.type === "cast.created") {
      const cast = body.data;
      const botFid = process.env.BOT_FID;
      
      if (!botFid) {
        throw new Error('Missing BOT_FID environment variable');
      }

      console.log("Processing cast:", {
        hash: cast.hash,
        text: cast.text,
        author: cast.author?.fid,
        mentioned_profiles: cast.mentioned_profiles
      });

      // Check if the bot was mentioned
      const wasBotMentioned = cast.mentioned_profiles?.some(
        (profile: any) => profile.fid?.toString() === botFid
      );

      if (wasBotMentioned) {
        // Extract the question (remove the bot mention)
        const question = cast.text.replace(/@\w+/g, "").trim();
        console.log("Extracted question:", question);
        
        // Generate tarot reading
        const reading = await tarotReader.getReading(question);
        console.log("Generated reading:", reading);
        
        try {
          if (!process.env.SIGNER_UID) {
            throw new Error('Missing SIGNER_UID environment variable');
          }

          // Reply to the cast using Neynar's API
          await neynar.publishCast({
            signerUuid: process.env.SIGNER_UID,
            text: reading,
            parent: cast.hash,
          });
          console.log("Successfully published response");
        } catch (castError) {
          console.error("Error publishing cast:", castError);
          throw castError; // Re-throw to be caught by main error handler
        }
      } else {
        console.log("Bot was not mentioned in this cast");
      }
    }

    // Always return 200 OK to acknowledge receipt of the webhook
    return new Response("OK", { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e: any) {
    console.error("Error processing webhook:", {
      error: e.message,
      stack: e.stack,
      name: e.name
    });
    return new Response(JSON.stringify({
      error: e.message,
      name: e.name,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// For local development with Bun
if (process.env.NODE_ENV !== "production") {
  const server = Bun.serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    fetch: handler
  });

  console.log(`🔮 Tarot bot server running on port ${server.port}`);
}