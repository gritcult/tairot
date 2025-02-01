# Farcaster Tarot Bot 🔮

A Farcaster bot that provides AI-powered tarot readings. Mention the bot in a cast with your question to receive a mystical tarot reading.

## Features

- Responds to @mentions on Farcaster
- Draws three tarot cards for each reading
- Provides AI-generated interpretations using GPT-4
- Keeps readings concise and engaging with emojis

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Configure your environment variables in `.env`:
   - Get your Neynar API key from https://dev.neynar.com
   - Set your bot's FID (Farcaster ID)
   - Add your OpenAI API key
   - (Optional) Set a webhook secret

5. Set up a webhook in the Neynar developer portal:
   - Go to https://dev.neynar.com/dashboard
   - Navigate to the Webhooks tab
   - Create a new webhook
   - Add your bot's FID to the `mentioned_fids` field
   - Set the target URL to your server's URL

## Running the Bot

Development mode with auto-reload:
```bash
bun dev
```

Production mode:
```bash
bun start
```

## Usage

1. On Farcaster, mention the bot with your question:
   ```
   @yourbot What does my career path look like?
   ```

2. The bot will draw three tarot cards and provide an interpretation specific to your question.

## Notes

- Make sure your server is publicly accessible for receiving webhook events
- The bot's responses are limited to 280 characters to fit in a Farcaster cast
- Each reading draws three cards representing Past/Influence, Present/Challenge, and Future/Outcome

## License

MIT 