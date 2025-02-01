import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { config } from "dotenv";
import { TarotReader } from "./tarot";
import OpenAI from "openai";

config();

// Simple health check function
function healthCheck() {
  const missingVars = [];
  const required = ['NEYNAR_API_KEY', 'OPENAI_API_KEY', 'SIGNER_UID', 'BOT_FID'];
  
  for (const varName of required) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
  }
}

// Initialize API clients
const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tarotReader = new TarotReader(openai);

export default async function handler(req: Request) {
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    // Run health check
    healthCheck();

    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    // Handle cast.created events
    if (body.type === 'cast.created') {
      const cast = body.data;
      const botFid = process.env.BOT_FID;

      // Check if our bot was mentioned
      const wasBotMentioned = cast.mentioned_profiles?.some(
        (profile: any) => profile.fid?.toString() === botFid
      );

      if (wasBotMentioned) {
        // Get the question (remove mentions)
        const question = cast.text.replace(/@\w+/g, '').trim();
        console.log('Processing question:', question);

        // Generate tarot reading
        const reading = await tarotReader.getReading(question);
        console.log('Generated reading:', reading);

        // Reply to the cast
        await neynar.publishCast({
          signerUuid: process.env.SIGNER_UID!,
          text: reading,
          parent: cast.hash
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Return 200 for unhandled events
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Local development server
if (process.env.NODE_ENV !== 'production') {
  const server = Bun.serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    fetch: handler
  });

  console.log(`🔮 Tarot bot server running on port ${server.port}`);
}