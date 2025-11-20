import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import VoiceInput, { speakText } from '../components/VoiceInput';
import MindStudySession from '../components/MindStudySession';

function getStartOfToday() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return startOfDay.toISOString();
}

function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 10) {
    return "Good morning. How are you feeling as you start your day?";
  } else if (hour >= 10 && hour < 16) {
    return "Hey. How's your day going so far?";
  } else if (hour >= 16 && hour < 21) {
    return "Good evening. How did today feel for you?";
  } else {
    return "Hey. Couldn't sleep?";
  }
}

function getFirstTimeGreeting() {
  return "Hey, I'm Ayu. I'm here as a friend to talk through your day, your thoughts, or whatever's on your mind. No pressure, no judgment—just a space to reflect. How's it going?";
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isAyuSpeaking, setIsAyuSpeaking] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [autoStartSession, setAutoStartSession] = useState(false);
  const [sessionModeEnabled, setSessionModeEnabled] = useState(false);
  
  const messagesEndRef = useRef(null);
  const voiceModeRef = useRef(false);
  const lastMessageRef = useRef({ text: '', timestamp: 0 });
  const lastResponseRef = useRef({ text: '', timestamp: 0 });
  const router = useRouter();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        autoLoadConversation(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      await autoLoadConversation(user);
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  const autoLoadConversation = async (currentUser) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Checking for existing conversation...');
      
      const { data: existingConversations, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching conversations:', fetchError);
        setLoading(false);
        return;
      }

      if (existingConversations && existingConversations.length > 0) {
        const conversation = existingConversations[0];
        setConversationId(conversation.id);
        console.log('✅ Found conversation, showing landing page');
      }
      
      // DON'T auto-load messages or show chat
      // Just set loading to false - this shows the landing page
      setLoading(false);
    } catch (error) {
      console.error('Error in autoLoadConversation:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowChat(false);
    setMessages([]);
    setConversationId(null);
    setAutoStartSession(false);
    setSessionModeEnabled(false);
    router.push('/');
  };

  const startConversation = async (withSession = false) => {
    if (!user) return;

    // Set whether this is a session mode or casual chat mode
    setSessionModeEnabled(withSession);

    try {
      const { data: existingConversations, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let conversation;

      if (existingConversations && existingConversations.length > 0) {
        conversation = existingConversations[0];
        
        const startOfToday = getStartOfToday();
        
        const { data: messageData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .gte('timestamp', startOfToday)
          .order('timestamp', { ascending: true });

        if (messagesError) throw messagesError;

        const loadedMessages = messageData.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        if (loadedMessages.length === 0) {
          const initialMessage = {
            role: 'assistant',
            content: getGreeting()
          };
          
          setMessages([initialMessage]);
          
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              user_id: user.id,
              sender: 'assistant',
              content: initialMessage.content,
              timestamp: new Date().toISOString()
            });
        } else {
          setMessages(loadedMessages);
        }

        setConversationId(conversation.id);
        setShowChat(true);
        
        if (withSession) {
          setAutoStartSession(true);
        }
      } else {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            title: 'Chat with Ayu',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;

        conversation = newConversation;
        setConversationId(conversation.id);
        setShowChat(true);

        const isFirstTime = !localStorage.getItem('ayutalks_visited');
        const initialMessage = {
          role: 'assistant',
          content: isFirstTime ? getFirstTimeGreeting() : getGreeting()
        };
        
        setMessages([initialMessage]);
        
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            user_id: user.id,
            sender: 'assistant',
            content: initialMessage.content,
            timestamp: new Date().toISOString()
          });

        if (isFirstTime) {
          localStorage.setItem('ayutalks_visited', 'true');
        }
        
        if (withSession) {
          setAutoStartSession(true);
        }
      }
    } catch (error) {
      console.error('Error loading/creating conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  const sendMessage = async (voiceTranscript) => {
    const messageText = voiceTranscript || input;
    if (!messageText.trim() || !user || !conversationId) return;

    const now = Date.now();
    const isDuplicateInput = 
      lastMessageRef.current.text === messageText.trim() &&
      (now - lastMessageRef.current.timestamp) < 2000;

    if (isDuplicateInput) {
      console.log('🚫 Blocked duplicate input:', messageText.substring(0, 30));
      return;
    }

    lastMessageRef.current = {
      text: messageText.trim(),
      timestamp: now
    };

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          conversationId: conversationId,
          userId: user.id
        })
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
        
        const shouldSpeak = voiceModeRef.current;
        
        if (shouldSpeak) {
          const now = Date.now();
          const isDuplicateOutput = 
            lastResponseRef.current.text === data.message &&
            (now - lastResponseRef.current.timestamp) < 3000;

          if (isDuplicateOutput) {
            console.log('🚫 Blocked duplicate voice output');
          } else {
            lastResponseRef.current = {
              text: data.message,
              timestamp: now
            };

            setIsAyuSpeaking(true);
            
            if (window.pauseDeepgram) {
              window.pauseDeepgram();
            }
            
            speakText(data.message, () => {
              setIsAyuSpeaking(false);
              
              if (window.resumeDeepgram) {
                window.resumeDeepgram();
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, something went wrong. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ color: 'white', fontSize: '1.5rem' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Head>
          <title>AyuTalks - Your Space to Reflect</title>
          <meta name="description" content="A mindful space for everyday conversations" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>
        <div style={styles.container}>
          <div style={styles.hero}>
            <h1 style={styles.title}>AyuTalks</h1>
            <p style={styles.subtitle}>
              Your space to pause, talk, and reconnect with yourself.
            </p>
            <p style={styles.description}>
              Everyday conversations that help you reflect, unwind, and grow — one mindful talk at a time. 
              No lessons, no judgment. Just an honest chat, whenever you need it.
            </p>
            <div style={styles.buttonGroup}>
              <button onClick={() => router.push('/login')} style={styles.button}>
                Login
              </button>
              <button onClick={() => router.push('/signup')} style={{...styles.button, ...styles.buttonSecondary}}>
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (user && !showChat) {
    return (
      <>
        <Head>
          <title>AyuTalks - Welcome Back</title>
          <meta name="description" content="Choose your conversation style" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>
        <div style={styles.container}>
          <div style={styles.welcomeContainer}>
            <h1 style={styles.welcomeTitle}>Welcome back!</h1>
            <p style={styles.welcomeSubtitle}>Ready to chat with Ayu?</p>
            
            <div style={styles.optionsGrid}>
              <div style={styles.optionCard}>
                <div style={styles.cardIcon}>🧠</div>
                <h2 style={styles.cardTitle}>Mechanics of Mind</h2>
                <p style={styles.cardSubtitle}>Transformation to Happiness That Stays</p>
                <ul style={styles.featureList}>
                  <li>⏱️ Guided sessions (20-60 min)</li>
                  <li>🎯 Structured exploration</li>
                  <li>📊 Track your progress</li>
                  <li>💡 Discover how your mind works</li>
                </ul>
                <button 
                  style={styles.cardButton}
                  onClick={() => startConversation(true)}
                >
                  Start Mechanics Session
                </button>
              </div>

              <div style={styles.optionCard}>
                <div style={styles.cardIcon}>💬</div>
                <h2 style={styles.cardTitle}>Daily Conversations</h2>
                <p style={styles.cardSubtitle}>Talk with Ayu about anything</p>
                <ul style={styles.featureList}>
                  <li>🗣️ Share your thoughts and feelings</li>
                  <li>🤗 Get emotional support</li>
                  <li>🎤 Use voice mode for natural conversation</li>
                  <li>⏰ Chat as long as you need</li>
                </ul>
                <button 
                  style={{...styles.cardButton, ...styles.casualButton}}
                  onClick={() => startConversation(false)}
                >
                  Start Chatting with Ayu
                </button>
              </div>
            </div>

            <button style={styles.logoutButtonBottom} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Chat - AyuTalks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div style={chatStyles.container}>
        <div style={chatStyles.header}>
          <button onClick={() => { 
            setShowChat(false); 
            setAutoStartSession(false);
            setSessionModeEnabled(false);
          }} style={chatStyles.backButton}>
            ← Back
          </button>
          <h2 style={chatStyles.title}>AyuTalks</h2>
          <button onClick={handleLogout} style={chatStyles.logoutButton}>
            Logout
          </button>
        </div>
        
        <div style={chatStyles.messagesContainer}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                ...chatStyles.message,
                ...(msg.role === 'user' ? chatStyles.userMessage : chatStyles.assistantMessage)
              }}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div style={{...chatStyles.message, ...chatStyles.assistantMessage}}>
              Ayu is thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {user && conversationId && sessionModeEnabled && (
          <div style={chatStyles.sessionContainer}>
            <MindStudySession
              userId={user.id}
              conversationId={conversationId}
              autoStart={autoStartSession}
              onSessionStateChange={(active, data) => {
                setSessionActive(active);
                setSessionData(data);
                if (!active) setAutoStartSession(false);
              }}
            />
          </div>
        )}

        <div style={chatStyles.inputContainer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
            <VoiceInput
              onTranscript={(transcript) => sendMessage(transcript)}
              disabled={isLoading || isAyuSpeaking}
              onModeChange={(isActive) => {
                setVoiceModeActive(isActive);
                voiceModeRef.current = isActive;
                
                if (isActive && typeof window !== 'undefined') {
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  if (isIOS) {
                    const warmup = new SpeechSynthesisUtterance('');
                    warmup.volume = 0;
                    window.speechSynthesis.speak(warmup);
                  }
                }
              }}
            />
            
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                placeholder="Type or speak..."
                style={chatStyles.input}
                disabled={isLoading || isAyuSpeaking}
              />
              <button
                onClick={() => sendMessage()}
                style={{
                  ...chatStyles.sendButton,
                  opacity: isLoading || !input.trim() ? 0.5 : 1
                }}
                disabled={isLoading || !input.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  hero: {
    textAlign: 'center',
    color: 'white',
    maxWidth: '800px',
    width: '100%',
    padding: '0 1rem',
  },
  title: {
    fontSize: 'clamp(2.5rem, 8vw, 4rem)',
    fontWeight: 'bold',
    marginBottom: '1rem',
    textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
    marginBottom: '1.5rem',
    opacity: 0.95,
    lineHeight: '1.4',
  },
  description: {
    fontSize: 'clamp(0.95rem, 3vw, 1.1rem)',
    lineHeight: '1.6',
    marginBottom: '2rem',
    opacity: 0.9,
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1rem 2.5rem',
    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
    fontWeight: '600',
    borderRadius: '50px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    minWidth: '150px',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid white',
  },
  welcomeContainer: {
    textAlign: 'center',
    color: 'white',
    maxWidth: '1200px',
    width: '100%',
    padding: '2rem',
  },
  welcomeTitle: {
    fontSize: 'clamp(2rem, 6vw, 3rem)',
    fontWeight: '700',
    marginBottom: '0.5rem',
  },
  welcomeSubtitle: {
    fontSize: 'clamp(1rem, 3vw, 1.3rem)',
    marginBottom: '3rem',
    opacity: 0.9,
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '2rem',
    marginBottom: '2rem',
  },
  optionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: '20px',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
  },
  cardIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  cardTitle: {
    color: '#667eea',
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
  },
  cardSubtitle: {
    color: '#666',
    fontSize: '1rem',
    marginBottom: '1.5rem',
    fontStyle: 'italic',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    textAlign: 'left',
    color: '#333',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    lineHeight: '2',
  },
  cardButton: {
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '25px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  casualButton: {
    backgroundColor: '#764ba2',
  },
  logoutButtonBottom: {
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid white',
    padding: '0.75rem 2rem',
    borderRadius: '20px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '1rem',
  },
};

const chatStyles = {
  container: {
    minHeight: '100vh',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backdropFilter: 'blur(10px)',
    flexShrink: 0,
  },
  backButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid white',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
  },
  title: {
    color: 'white',
    margin: 0,
    fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
  },
  messagesContainer: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
  },
  message: {
    padding: '1rem 1.25rem',
    borderRadius: '20px',
    maxWidth: '85%',
    wordWrap: 'break-word',
    fontSize: 'clamp(0.95rem, 3vw, 1rem)',
    lineHeight: '1.5',
  },
  userMessage: {
    backgroundColor: '#667eea',
    color: 'white',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    borderBottomRightRadius: '4px',
  },
  assistantMessage: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: '#333',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: '4px',
  },
  sessionContainer: {
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  inputContainer: {
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    padding: '1rem',
    borderRadius: '25px',
    border: 'none',
    fontSize: 'clamp(0.95rem, 3vw, 1rem)',
    outline: 'none',
    minWidth: 0,
  },
  sendButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1rem 1.5rem',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
    whiteSpace: 'nowrap',
  },
};
