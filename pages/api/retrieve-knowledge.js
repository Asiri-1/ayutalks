import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search vector database
    const { data: matches, error } = await supabase.rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5
    });

    if (error) {
      console.error('Supabase search error:', error);
      return res.status(200).json({ 
        knowledge: { 
          bookKnowledge: [],
          hasRelevantKnowledge: false 
        }
      });
    }

    // Return knowledge
    const knowledge = {
      bookKnowledge: matches || [],
      hasRelevantKnowledge: matches && matches.length > 0
    };

    return res.status(200).json({ knowledge });

  } catch (error) {
    console.error('Error retrieving knowledge:', error);
    return res.status(200).json({ 
      knowledge: { 
        bookKnowledge: [],
        hasRelevantKnowledge: false 
      }
    });
  }
}
