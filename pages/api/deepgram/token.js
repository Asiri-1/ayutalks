import { createClient } from '@deepgram/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Create a temporary project key for the client
    const { result, error } = await deepgram.manage.createProjectKey(
      process.env.DEEPGRAM_PROJECT_ID || 'default',
      {
        comment: 'Temporary key for client',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 3600, // 1 hour
      }
    );

    if (error) {
      console.error('Deepgram error:', error);
      return res.status(500).json({ error: 'Failed to create temporary key' });
    }

    res.status(200).json({ key: result.key });
  } catch (error) {
    console.error('Error creating Deepgram token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}