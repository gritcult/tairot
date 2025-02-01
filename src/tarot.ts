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
      const prompt = `You are a wise and mystical tarot reader. The querent asks: "${question}"
      
You have drawn these three cards in order:
1. ${cards[0]} (Past/Influence)
2. ${cards[1]} (Present/Challenge)
3. ${cards[2]} (Future/Outcome)

Provide a concise but insightful tarot reading that interprets these cards in relation to their question.
Keep the response under 280 characters to fit in a Farcaster cast. Use emojis to make it engaging.
Format: [Cards Drawn] followed by the interpretation.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      });

      return response.choices[0].message.content || "I'm unable to provide a reading at this time. Please try again later. 🔮";
    } catch (error: any) {
      console.error('Error in tarot reading:', error);
      
      if (error?.error?.type === 'insufficient_quota') {
        return "⚠️ The spirits are resting. The tarot reader needs to recharge their energy (API quota exceeded). Please try again tomorrow. 🔮";
      }
      
      if (error?.error?.code === 'rate_limit_exceeded') {
        return "🕐 The cards need a moment to realign. Please try again in a few minutes. 🔮";
      }
      
      return "🌌 The cosmic energies are unclear at this moment. Please try again later. 🔮";
    }
  }
} 