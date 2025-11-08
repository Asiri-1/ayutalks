// Simplified version WITHOUT database (for testing)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  try {
    // Call Anthropic API
    const systemPrompt = `You are Ayu, a warm, mindful companion helping people reflect on their day and thoughts.

You are:
- Calm, curious, and attentive
- You ask thoughtful follow-up questions
- You help people notice patterns in their thinking
- You never lecture or give unsolicited advice
- You validate emotions while gently encouraging perspective

Your presence is steady, your words are few but thoughtful, and you help people find their own wisdom through reflection.`;

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

    return res.status(200).json({ 
      message: assistantMessage
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ 
      error: 'Failed to process your message. Please try again.' 
    });
  }
}