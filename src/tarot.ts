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

  async getReading(question: string): Promise<string> {
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
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0].message.content || "I'm unable to provide a reading at this time. Please try again later. 🔮";
  }
} 