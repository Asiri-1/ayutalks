import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import VoiceInput, { speakText } from '../components/VoiceInput';

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
  const messagesEndRef = useRef(null);
  const voiceModeRef = useRef(false);
  const lastMessageRef = useRef({ text: '', timestamp: 0 }); // Prevent duplicate inputs
  const lastResponseRef = useRef({ text: '', timestamp: 0 }); // Prevent duplicate outputs
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
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowChat(false);
    setMessages([]);
    setConversationId(null);
    router.push('/');
  };

  const startConversation = async () => {
    if (!user) return;

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
        console.log('Loading existing conversation:', conversation.id);
        
        // OPTIMIZED: Load only TODAY's messages
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

        console.log(`📅 Loaded ${loadedMessages.length} messages from today`);

        // If no messages today, start fresh with greeting
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
      }
    } catch (error) {
      console.error('Error loading/creating conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  const sendMessage = async (voiceTranscript) => {
    const messageText = voiceTranscript || input;
    if (!messageText.trim() || !user || !conversationId) return;

    // PREVENT DUPLICATE INPUT (voice transcripts sending multiple times)
    const now = Date.now();
    const isDuplicateInput = 
      lastMessageRef.current.text === messageText.trim() &&
      (now - lastMessageRef.current.timestamp) < 2000; // 2 second window

    if (isDuplicateInput) {
      console.log('🚫 Blocked duplicate input:', messageText.substring(0, 30));
      return;
    }

    // Update last message tracker
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
        console.log('🎤 Voice Mode Status:', shouldSpeak);
        
        if (shouldSpeak) {
          // PREVENT DUPLICATE OUTPUT (Ayu speaking same response multiple times)
          const now = Date.now();
          const isDuplicateOutput = 
            lastResponseRef.current.text === data.message &&
            (now - lastResponseRef.current.timestamp) < 3000; // 3 second window

          if (isDuplicateOutput) {
            console.log('🚫 Blocked duplicate voice output');
            // Don't return here - still need to finish the function
          } else {
            // Update last response tracker
            lastResponseRef.current = {
              text: data.message,
              timestamp: now
            };

            console.log('🔊 SPEAKING - Pausing microphone');
            setIsAyuSpeaking(true);
            
            // Pause microphone to prevent echo
            if (window.pauseDeepgram) {
              window.pauseDeepgram();
            }
            
            // CRITICAL FIX: No setTimeout - immediate call keeps user gesture context for mobile
            speakText(data.message, () => {
              console.log('✅ Speaking finished - Resuming microphone');
              setIsAyuSpeaking(false);
              
              // Resume microphone after speaking
              if (window.resumeDeepgram) {
                window.resumeDeepgram();
              }
            });
          }
        } else {
          console.log('🔇 Voice mode OFF - silent');
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

  if (!user && !showChat) {
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

  if (!user && showChat) {
    router.push('/login');
    return null;
  }

  if (user && !showChat) {
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
              Welcome back, {user.email.split('@')[0]}!
            </p>
            <p style={styles.description}>
              Your space to pause, talk, and reconnect with yourself.
            </p>
            <div style={styles.buttonGroup}>
              <button onClick={startConversation} style={styles.button}>
                Start Talking
              </button>
              <button onClick={handleLogout} style={{...styles.button, ...styles.buttonSecondary}}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Chat - AyuTalks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <div style={chatStyles.container}>
        <div style={chatStyles.header}>
          <button onClick={() => { setShowChat(false); }} style={chatStyles.backButton}>
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

        <div style={chatStyles.inputContainer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', alignItems: 'center' }}>
            <VoiceInput
              onTranscript={(transcript) => {
                sendMessage(transcript);
              }}
              disabled={isLoading || isAyuSpeaking}
              onModeChange={(isActive) => {
                console.log('🎤 Voice mode callback:', isActive);
                setVoiceModeActive(isActive);
                voiceModeRef.current = isActive;
                
                // iOS FIX: Pre-warm speech synthesis on user interaction
                if (isActive && typeof window !== 'undefined') {
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  if (isIOS) {
                    console.log('📱 iOS detected - pre-warming speech synthesis');
                    // Create silent utterance to initialize speech
                    const warmup = new SpeechSynthesisUtterance('');
                    warmup.volume = 0;
                    warmup.rate = 1;
                    warmup.pitch = 1;
                    window.speechSynthesis.speak(warmup);
                    console.log('✅ Speech synthesis pre-warmed for iOS');
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
    opacity: 0.9',
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
};

const chatStyles = {
  container: {
    minHeight: '100vh',
    height: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
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
  inputContainer: {
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flexShrink: 0,
    alignItems: 'stretch',
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
    transition: 'opacity 0.2s',
    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
    whiteSpace: 'nowrap',
  },
};