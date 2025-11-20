// pages/api/admin/daily-transcript.js
// PRODUCTION VERSION - Segregates Mind Mechanics Sessions from Casual Conversations

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

  const { password, date } = req.body;

  // ================================================
  // PASSWORD CHECK
  // ================================================
  if (password !== 'ayutalks2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ================================================
    // STEP 1: Parse Date Range
    // ================================================
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
      const today = getTodayRange();
      startDate = today.start;
      endDate = today.end;
    }

    // ================================================
    // STEP 2: Get All Messages for the Day
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
        is_session_message,
        session_phase
      `)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    if (!messages || messages.length === 0) {
      return res.status(200).json({
        transcript: generateEmptyTranscript(startDate),
        stats: {
          date: new Date(startDate).toLocaleDateString(),
          totalMessages: 0,
          sessionMessages: 0,
          casualMessages: 0,
          totalSessions: 0,
          completedSessions: 0,
          sessionsInProgress: 0,
          avgSessionDuration: 0,
          avgSessionRating: 'N/A',
          totalConversations: 0
        }
      });
    }

    // ================================================
    // STEP 3: Get User Emails
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
    // STEP 4: Get Session Metadata
    // ================================================
    const sessionIds = [...new Set(messages.filter(m => m.session_id).map(m => m.session_id))];
    let sessions = [];
    
    if (sessionIds.length > 0) {
      // Try active_sessions first
      const { data: activeSessions, error: activeError } = await supabase
        .from('active_sessions')
        .select('*')
        .in('id', sessionIds);

      if (!activeError && activeSessions) {
        sessions = activeSessions;
      }

      // Also check session_history for completed sessions
      const { data: historySessions, error: historyError } = await supabase
        .from('session_history')
        .select('*')
        .in('id', sessionIds);

      if (!historyError && historySessions) {
        sessions = [...sessions, ...historySessions];
      }
    }

    // Create session lookup
    const sessionMap = {};
    sessions.forEach(s => {
      sessionMap[s.id] = s;
    });

    // ================================================
    // STEP 5: Separate Session vs Casual Messages
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
    // STEP 6: Build Transcript
    // ================================================
    let transcript = '';
    
    // Header
    transcript += '='.repeat(80) + '\n';
    transcript += 'AYUTALKS DAILY TRANSCRIPT\n';
    transcript += `Date: ${new Date(startDate).toLocaleDateString()}\n`;
    transcript += `Total Messages: ${messages.length} (${sessionMessages.length} session + ${casualMessages.length} casual)\n`;
    transcript += `Total Sessions: ${Object.keys(sessionGroups).length}\n`;
    transcript += `Total Conversations: ${Object.keys(casualConvos).length}\n`;
    transcript += '='.repeat(80) + '\n\n';

    // ================================================
    // SECTION 1: MIND MECHANICS SESSIONS
    // ================================================
    if (Object.keys(sessionGroups).length > 0) {
      transcript += '\n';
      transcript += '┌' + '─'.repeat(78) + '┐\n';
      transcript += '│ MIND MECHANICS SESSIONS' + ' '.repeat(54) + '│\n';
      transcript += '└' + '─'.repeat(78) + '┘\n\n';

      let sessionNumber = 1;
      for (const [sessionId, sessionMsgs] of Object.entries(sessionGroups)) {
        const session = sessionMap[sessionId];
        const firstMsg = sessionMsgs[0];
        const userId = convToUser[firstMsg.conversation_id];
        const userEmail = userEmails[userId] || 'Unknown';

        // Session header
        transcript += '\n' + '='.repeat(80) + '\n';
        transcript += `SESSION #${sessionNumber}\n`;
        transcript += `User: ${userEmail}\n`;
        transcript += `Session ID: ${sessionId}\n`;
        transcript += `Conversation ID: ${firstMsg.conversation_id}\n`;
        
        if (session) {
          const startTime = new Date(session.started_at).toLocaleTimeString();
          const duration = session.actual_duration_seconds || session.time_elapsed_seconds
            ? Math.floor((session.actual_duration_seconds || session.time_elapsed_seconds) / 60) 
            : 0;
          
          transcript += `Started: ${startTime}\n`;
          transcript += `Planned Duration: ${session.duration_minutes || 'N/A'} minutes\n`;
          transcript += `Actual Duration: ${duration} minutes\n`;
          transcript += `Phase: ${session.current_phase || session.final_phase || 'Unknown'}\n`;
          transcript += `Status: ${session.is_active ? '⚠️  In Progress' : '✅ Complete'}\n`;
          
          if (session.end_reason) {
            transcript += `End Reason: ${session.end_reason}\n`;
          }
          
          if (session.user_rating) {
            transcript += `User Rating: ${'⭐'.repeat(session.user_rating)} (${session.user_rating}/5)\n`;
          }

          if (session.concepts_explored && session.concepts_explored.length > 0) {
            transcript += `Concepts Explored: ${session.concepts_explored.join(', ')}\n`;
          }

          if (session.insights_count) {
            transcript += `Insights Recorded: ${session.insights_count}\n`;
          }
        }
        
        transcript += `Messages: ${sessionMsgs.length}\n`;
        transcript += '='.repeat(80) + '\n\n';

        // Session messages
        sessionMsgs.forEach(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const sender = msg.sender === 'user' ? 'USER' : 'AYU';
          const phase = msg.session_phase ? ` [${msg.session_phase.toUpperCase()}]` : '';
          
          transcript += `[${time}]${phase} ${sender}:\n`;
          transcript += `${msg.content}\n\n`;
        });

        // Session summary
        if (session && !session.is_active) {
          transcript += `--- SESSION SUMMARY ---\n`;
          transcript += `Total Duration: ${Math.floor((session.actual_duration_seconds || session.time_elapsed_seconds || 0) / 60)} minutes\n`;
          transcript += `Messages Exchanged: ${sessionMsgs.length}\n`;
          transcript += `Final Phase: ${session.current_phase || session.final_phase || 'N/A'}\n`;
          if (session.concepts_explored && session.concepts_explored.length > 0) {
            transcript += `Concepts: ${session.concepts_explored.join(', ')}\n`;
          }
          transcript += '\n';
        }

        sessionNumber++;
      }
    } else {
      transcript += '\n📊 No Mind Mechanics Sessions on this date.\n\n';
    }

    // ================================================
    // SECTION 2: CASUAL CONVERSATIONS
    // ================================================
    if (Object.keys(casualConvos).length > 0) {
      transcript += '\n';
      transcript += '┌' + '─'.repeat(78) + '┐\n';
      transcript += '│ CASUAL CONVERSATIONS' + ' '.repeat(58) + '│\n';
      transcript += '└' + '─'.repeat(78) + '┘\n\n';

      let convoNumber = 1;
      for (const [convoId, convoMsgs] of Object.entries(casualConvos)) {
        const userId = convToUser[convoId];
        const userEmail = userEmails[userId] || 'Unknown';

        transcript += '\n' + '='.repeat(80) + '\n';
        transcript += `CONVERSATION #${convoNumber}\n`;
        transcript += `User: ${userEmail}\n`;
        transcript += `Conversation ID: ${convoId}\n`;
        transcript += `Messages: ${convoMsgs.length}\n`;
        transcript += '='.repeat(80) + '\n\n';

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
    // STEP 7: Calculate Stats
    // ================================================
    const completedSessions = sessions.filter(s => !s.is_active).length;
    const avgSessionDuration = sessions.length > 0
      ? Math.floor(sessions.reduce((sum, s) => sum + ((s.actual_duration_seconds || s.time_elapsed_seconds) || 0), 0) / sessions.length / 60)
      : 0;
    
    const ratedSessions = sessions.filter(s => s.user_rating && s.user_rating > 0);
    const avgRating = ratedSessions.length > 0
      ? (ratedSessions.reduce((sum, s) => sum + s.user_rating, 0) / ratedSessions.length).toFixed(1)
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
    res.status(500).json({ 
      error: 'Failed to generate transcript', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function generateEmptyTranscript(startDate) {
  let transcript = '';
  transcript += '='.repeat(80) + '\n';
  transcript += 'AYUTALKS DAILY TRANSCRIPT\n';
  transcript += `Date: ${new Date(startDate).toLocaleDateString()}\n`;
  transcript += 'Total Messages: 0\n';
  transcript += 'Total Sessions: 0\n';
  transcript += 'Total Conversations: 0\n';
  transcript += '='.repeat(80) + '\n\n';
  transcript += '📭 No conversations on this date.\n\n';
  transcript += '='.repeat(80) + '\n';
  transcript += 'END OF TRANSCRIPT\n';
  transcript += '='.repeat(80) + '\n';
  return transcript;
}