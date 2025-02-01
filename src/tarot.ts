import OpenAI from "openai";

export class TarotReader {
  private openai: OpenAI;
  private readonly cards = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun",
    "Judgement", "The World"
  ];

  // Track request timestamps for rate limiting
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 20000; // 20 seconds between requests (3 RPM limit)

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  private drawCards(count: number = 3): string[] {
    const drawn: string[] = [];
    const available = [...this.cards];
    
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * available.length);
      drawn.push(available.splice(index, 1)[0]);
    }
    
    return drawn;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async getReading(question: string): Promise<string> {
    try {
      await this.waitForRateLimit();
      
      const cards = this.drawCards(3);
      const prompt = `You are a mystical tarot card reader. You should:
1. Draw three cards from a standard tarot deck
2. Interpret their meaning in relation to the question
3. Keep the response concise (under 280 characters)
4. Use mystical/fortune teller language
5. Include emojis for visual flair`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: question
          }
        ],
        max_tokens: 150
      });

      return completion.choices[0].message.content || "🔮 The spirits are unclear at this time...";
    } catch (error) {
      console.error('Error getting tarot reading:', error);
      return "🔮 The spirits are unclear at this time... Please try again later.";
    }
  }
} 