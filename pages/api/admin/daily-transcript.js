import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTodayRange() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  
  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString()
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, date } = req.body;
    
    if (password !== 'ayutalks2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    let startDate, endDate;
    if (date) {
      const targetDate = new Date(date);
      startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0)).toISOString();
      endDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999)).toISOString();
    } else {
      const today = getTodayRange();
      startDate = today.start;
      endDate = today.end;
    }
    
    // Get all messages for the date range
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, sender, timestamp, conversation_id')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: true });
    
    if (messagesError) throw messagesError;
    
    if (!messages || messages.length === 0) {
      return res.status(200).json({
        transcript: `No conversations found for ${new Date(startDate).toLocaleDateString()}`,
        stats: {
          date: new Date(startDate).toLocaleDateString(),
          totalConversations: 0,
          totalMessages: 0
        }
      });
    }
    
    // Get unique conversation IDs
    const conversationIds = [...new Set(messages.map(m => m.conversation_id))];
    
    // Get conversation details
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id')
      .in('id', conversationIds);
    
    // Get user emails
    const userIds = [...new Set(conversations?.map(c => c.user_id).filter(Boolean))];
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);
    
    // Build user lookup map
    const userMap = {};
    users?.forEach(u => {
      userMap[u.id] = u.email;
    });
    
    // Build conversation lookup map
    const convMap = {};
    conversations?.forEach(c => {
      convMap[c.id] = {
        userId: c.user_id,
        userEmail: userMap[c.user_id] || 'Unknown'
      };
    });
    
    // Group messages by conversation
    const conversationMap = new Map();
    messages.forEach(msg => {
      const convId = msg.conversation_id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          userId: convMap[convId]?.userId,
          userEmail: convMap[convId]?.userEmail || 'Unknown',
          messages: []
        });
      }
      conversationMap.get(convId).messages.push({
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp
      });
    });
    
    // Build transcript
    let transcript = `=================================================\n`;
    transcript += `AYUTALKS DAILY TRANSCRIPT\n`;
    transcript += `Date: ${new Date(startDate).toLocaleDateString()}\n`;
    transcript += `Total Conversations: ${conversationMap.size}\n`;
    transcript += `Total Messages: ${messages.length}\n`;
    transcript += `=================================================\n\n`;
    
    let conversationNumber = 1;
    for (const [convId, data] of conversationMap) {
      transcript += `\n${'='.repeat(80)}\n`;
      transcript += `CONVERSATION #${conversationNumber}\n`;
      transcript += `User: ${data.userEmail}\n`;
      transcript += `Conversation ID: ${convId}\n`;
      transcript += `Messages: ${data.messages.length}\n`;
      transcript += `${'='.repeat(80)}\n\n`;
      
      data.messages.forEach((msg) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.sender === 'user' ? 'USER' : 'AYU';
        
        transcript += `[${time}] ${sender}:\n`;
        transcript += `${msg.content}\n\n`;
      });
      
      conversationNumber++;
    }
    
    transcript += `\n${'='.repeat(80)}\n`;
    transcript += `END OF TRANSCRIPT\n`;
    transcript += `${'='.repeat(80)}\n`;
    
    return res.status(200).json({
      transcript,
      stats: {
        date: new Date(startDate).toLocaleDateString(),
        totalConversations: conversationMap.size,
        totalMessages: messages.length
      }
    });
    
  } catch (error) {
    console.error('Daily transcript error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate transcript',
      details: error.message 
    });
  }
}