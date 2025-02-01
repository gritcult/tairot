import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { config } from "dotenv";
import { TarotReader } from "./tarot";
import OpenAI from "openai";

config();

const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY! });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const tarotReader = new TarotReader(openai);

// Vercel serverless function handler
export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json();
    console.log("Received webhook event:", JSON.stringify(body, null, 2));
    
    // Verify webhook secret if provided
    const webhookSecret = req.headers.get("x-neynar-webhook-secret");
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (body.type === "cast.created") {
      const cast = body.data;
      const botFid = process.env.BOT_FID;
      
      // Check if the bot was mentioned
      const wasBotMentioned = cast.mentioned_profiles.some(
        (profile: any) => profile.fid.toString() === botFid
      );

      if (wasBotMentioned) {
        // Extract the question (remove the bot mention)
        const question = cast.text.replace(/@\w+/g, "").trim();
        
        // Generate tarot reading
        const reading = await tarotReader.getReading(question);
        
        // Reply to the cast using Neynar's API
        await neynar.createCast({
          text: reading,
          signer_uuid: process.env.SIGNER_UID!,
          parent: cast.hash,
        });

        console.log("Published tarot reading response:", reading);
      }
    }

    // Always return 200 OK to acknowledge receipt of the webhook
    return new Response("OK", { status: 200 });
  } catch (e: any) {
    console.error("Error processing webhook:", e);
    return new Response(e.message, { status: 500 });
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