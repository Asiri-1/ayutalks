// pages/api/admin/daily-transcript.js
// ENHANCED VERSION - Segregates Mind Study Sessions from Casual Conversations

import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, date } = req.body;

  // Password check
  if (password !== 'ayutalks2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Parse date and get full day range (UTC)
    let startDate, endDate;
    if (date) {
      const targetDate = new Date(date);
      startDate = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0, 0, 0, 0
      )).toISOString();
      endDate = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        23, 59, 59, 999
      )).toISOString();
    } else {
      // Default to today
      const now = new Date();
      startDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      )).toISOString();
      endDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23, 59, 59, 999
      )).toISOString();
    }

    // ================================================
    // STEP 1: Get all messages for the day
    // ================================================
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        sender,
        timestamp,
        conversation_id,
        session_id,
        is_session_message
      `)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    // ================================================
    // STEP 2: Get user emails (separate query)
    // ================================================
    const conversationIds = [...new Set(messages.map(m => m.conversation_id))];
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .in('id', conversationIds);

    if (convError) throw convError;

    const userIds = [...new Set(conversations.map(c => c.user_id))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);

    if (usersError) throw usersError;

    // Create lookup maps
    const convToUser = {};
    conversations.forEach(c => {
      convToUser[c.id] = c.user_id;
    });

    const userEmails = {};
    users.forEach(u => {
      userEmails[u.id] = u.email;
    });

    // ================================================
    // STEP 3: Get session metadata
    // ================================================
    const sessionIds = [...new Set(messages.filter(m => m.session_id).map(m => m.session_id))];
    let sessions = [];
    
    if (sessionIds.length > 0) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('active_sessions')
        .select('*')
        .in('id', sessionIds);

      if (sessionError) {
        console.error('Session fetch error:', sessionError);
      } else {
        sessions = sessionData || [];
      }
    }

    // Create session lookup
    const sessionMap = {};
    sessions.forEach(s => {
      sessionMap[s.id] = s;
    });

    // ================================================
    // STEP 4: Separate session vs casual messages
    // ================================================
    const sessionMessages = messages.filter(m => m.session_id);
    const casualMessages = messages.filter(m => !m.session_id);

    // Group session messages by session
    const sessionGroups = {};
    sessionMessages.forEach(msg => {
      if (!sessionGroups[msg.session_id]) {
        sessionGroups[msg.session_id] = [];
      }
      sessionGroups[msg.session_id].push(msg);
    });

    // Group casual messages by conversation
    const casualConvos = {};
    casualMessages.forEach(msg => {
      if (!casualConvos[msg.conversation_id]) {
        casualConvos[msg.conversation_id] = [];
      }
      casualConvos[msg.conversation_id].push(msg);
    });

    // ================================================
    // STEP 5: Build transcript with segregation
    // ================================================
    let transcript = '';
    
    // Header
    transcript += '=================================================\n';
    transcript += 'AYUTALKS DAILY TRANSCRIPT\n';
    transcript += `Date: ${new Date(startDate).toLocaleDateString()}\n`;
    transcript += `Total Messages: ${messages.length} (${sessionMessages.length} session + ${casualMessages.length} casual)\n`;
    transcript += `Total Sessions: ${Object.keys(sessionGroups).length}\n`;
    transcript += `Total Conversations: ${Object.keys(casualConvos).length}\n`;
    transcript += '=================================================\n\n';

    // ================================================
    // SECTION 1: MIND STUDY SESSIONS
    // ================================================
    if (Object.keys(sessionGroups).length > 0) {
      transcript += '\n';
      transcript += '┌─────────────────────────────────────────────────────────────────┐\n';
      transcript += '│ MIND STUDY SESSIONS                                              │\n';
      transcript += '└─────────────────────────────────────────────────────────────────┘\n\n';

      let sessionNumber = 1;
      for (const [sessionId, sessionMsgs] of Object.entries(sessionGroups)) {
        const session = sessionMap[sessionId];
        const firstMsg = sessionMsgs[0];
        const userId = convToUser[firstMsg.conversation_id];
        const userEmail = userEmails[userId] || 'Unknown';

        // Session header
        transcript += `\n${'='.repeat(80)}\n`;
        transcript += `SESSION #${sessionNumber}\n`;
        transcript += `User: ${userEmail}\n`;
        transcript += `Session ID: ${sessionId}\n`;
        transcript += `Conversation ID: ${firstMsg.conversation_id}\n`;
        
        if (session) {
          const startTime = new Date(session.started_at).toLocaleTimeString();
          const duration = session.time_elapsed_seconds 
            ? Math.floor(session.time_elapsed_seconds / 60) 
            : 0;
          
          transcript += `Started: ${startTime}\n`;
          transcript += `Duration: ${duration} minutes\n`;
          transcript += `Phase: ${session.current_phase || 'Unknown'}\n`;
          transcript += `Completion: ${session.is_active ? '⚠️  In Progress' : '✅ Complete'}\n`;
          
          if (session.end_reason) {
            transcript += `End Reason: ${session.end_reason}\n`;
          }
          
          if (session.user_rating) {
            transcript += `User Rating: ${session.user_rating}/5 ⭐\n`;
          }
        }
        
        transcript += `Messages: ${sessionMsgs.length}\n`;
        transcript += `${'='.repeat(80)}\n\n`;

        // Session messages
        sessionMsgs.forEach(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const sender = msg.sender === 'user' ? 'USER' : 'AYU';
          
          transcript += `[${time}] ${sender}:\n`;
          transcript += `${msg.content}\n\n`;
        });

        // Session summary
        if (session && !session.is_active) {
          transcript += `--- SESSION SUMMARY ---\n`;
          transcript += `Total Duration: ${Math.floor((session.time_elapsed_seconds || 0) / 60)} minutes\n`;
          transcript += `Messages Exchanged: ${sessionMsgs.length}\n`;
          transcript += `Final Phase: ${session.current_phase || 'N/A'}\n\n`;
        }

        sessionNumber++;
      }
    } else {
      transcript += '\n📊 No Mind Study Sessions on this date.\n\n';
    }

    // ================================================
    // SECTION 2: CASUAL CONVERSATIONS
    // ================================================
    if (Object.keys(casualConvos).length > 0) {
      transcript += '\n';
      transcript += '┌─────────────────────────────────────────────────────────────────┐\n';
      transcript += '│ CASUAL CONVERSATIONS                                             │\n';
      transcript += '└─────────────────────────────────────────────────────────────────┘\n\n';

      let convoNumber = 1;
      for (const [convoId, convoMsgs] of Object.entries(casualConvos)) {
        const userId = convToUser[convoId];
        const userEmail = userEmails[userId] || 'Unknown';

        transcript += `\n${'='.repeat(80)}\n`;
        transcript += `CONVERSATION #${convoNumber}\n`;
        transcript += `User: ${userEmail}\n`;
        transcript += `Conversation ID: ${convoId}\n`;
        transcript += `Messages: ${convoMsgs.length}\n`;
        transcript += `${'='.repeat(80)}\n\n`;

        convoMsgs.forEach(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const sender = msg.sender === 'user' ? 'USER' : 'AYU';
          
          transcript += `[${time}] ${sender}:\n`;
          transcript += `${msg.content}\n\n`;
        });

        convoNumber++;
      }
    } else {
      transcript += '\n💬 No casual conversations on this date.\n\n';
    }

    // Footer
    transcript += '\n';
    transcript += '='.repeat(80) + '\n';
    transcript += 'END OF TRANSCRIPT\n';
    transcript += '='.repeat(80) + '\n';

    // ================================================
    // STEP 6: Calculate stats
    // ================================================
    const completedSessions = sessions.filter(s => !s.is_active).length;
    const avgSessionDuration = sessions.length > 0
      ? Math.floor(sessions.reduce((sum, s) => sum + (s.time_elapsed_seconds || 0), 0) / sessions.length / 60)
      : 0;
    
    const avgRating = sessions.filter(s => s.user_rating).length > 0
      ? (sessions.reduce((sum, s) => sum + (s.user_rating || 0), 0) / sessions.filter(s => s.user_rating).length).toFixed(1)
      : 'N/A';

    res.status(200).json({
      transcript,
      stats: {
        date: new Date(startDate).toLocaleDateString(),
        totalMessages: messages.length,
        sessionMessages: sessionMessages.length,
        casualMessages: casualMessages.length,
        totalSessions: Object.keys(sessionGroups).length,
        completedSessions: completedSessions,
        sessionsInProgress: sessions.filter(s => s.is_active).length,
        avgSessionDuration: avgSessionDuration,
        avgSessionRating: avgRating,
        totalConversations: Object.keys(casualConvos).length
      }
    });

  } catch (error) {
    console.error('Daily transcript error:', error);
    res.status(500).json({ error: 'Failed to generate transcript', details: error.message });
  }
}