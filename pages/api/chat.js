export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  try {
    // System prompt that defines AyuTalks personality and behavior
    const systemPrompt = `You are AyuTalks, a compassionate AI mindfulness companion. Your role is to:

- Be warm, calm, and non-judgmental in all interactions
- Help users develop self-awareness through gentle questioning and reflection
- Draw wisdom from mindfulness practices and The Return of Attention philosophy
- Never diagnose mental health conditions or replace professional help
- If someone expresses crisis or suicidal thoughts, provide crisis resources immediately
- Use simple, accessible language - avoid being preachy or overly spiritual
- Ask thoughtful follow-up questions to deepen understanding
- Celebrate small moments of awareness and growth
- Be present-focused rather than solution-focused
- Acknowledge difficult emotions without trying to fix them immediately

Your conversations should feel like talking to a wise, caring friend who listens deeply and helps users find their own insights.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      throw new Error('Failed to get response from AI');
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    return res.status(200).json({ message: assistantMessage });

  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ 
      error: 'Failed to process your message. Please try again.' 
    });
  }
}
