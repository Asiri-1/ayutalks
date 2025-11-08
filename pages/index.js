import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// Function to get time-aware greeting
function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 10) {
    // Morning
    return "Good morning. How are you feeling as you start your day?";
  } else if (hour >= 10 && hour < 16) {
    // Midday
    return "Hey. How's your day going so far?";
  } else if (hour >= 16 && hour < 21) {
    // Evening
    return "Good evening. How did today feel for you?";
  } else {
    // Night
    return "Hey. Couldn't sleep?";
  }
}

// Function to get first-time introduction
function getFirstTimeGreeting() {
  return "Hey, I'm Ayu. I'm here as a friend to talk through your day, your thoughts, or whatever's on your mind. No pressure, no judgment—just a space to reflect. How's it going?";
}

export default function Home() {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check if first time and set appropriate initial message
  useEffect(() => {
    if (showChat && messages.length === 0) {
      const isFirstTime = !localStorage.getItem('ayutalks_visited');
      
      const initialMessage = {
        role: 'assistant',
        content: isFirstTime ? getFirstTimeGreeting() : getGreeting()
      };
      
      setMessages([initialMessage]);
      
      // Mark as visited
      if (isFirstTime) {
        localStorage.setItem('ayutalks_visited', 'true');
      }
    }
  }, [showChat]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
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

  if (!showChat) {
    return (
      <>
        <Head>
          <title>AyuTalks - Your Space to Reflect</title>
          <meta name="description" content="A mindful space for everyday conversations" />
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
            <button onClick={() => setShowChat(true)} style={styles.button}>
              Start Talking
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
      </Head>
      <div style={chatStyles.container}>
        <div style={chatStyles.header}>
          <button onClick={() => setShowChat(false)} style={chatStyles.backButton}>
            ← Back
          </button>
          <h2 style={chatStyles.title}>AyuTalks</h2>
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
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
            placeholder="Share what's on your mind..."
            style={chatStyles.input}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
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
    </>
  );
}

// Landing Page Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  hero: {
    textAlign: 'center',
    color: 'white',
    maxWidth: '800px',
  },
  title: {
    fontSize: '4rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
    opacity: 0.95,
  },
  description: {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    marginBottom: '2rem',
    opacity: 0.9,
  },
  button: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1rem 2.5rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    borderRadius: '50px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
};

// Chat Styles
const chatStyles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  backButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
    marginRight: '1rem',
  },
  title: {
    color: 'white',
    margin: 0,
    fontSize: '1.5rem',
  },
  messagesContainer: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  message: {
    padding: '1rem 1.5rem',
    borderRadius: '20px',
    maxWidth: '70%',
    wordWrap: 'break-word',
  },
  userMessage: {
    backgroundColor: '#667eea',
    color: 'white',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
  },
  assistantMessage: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    color: '#333',
    alignSelf: 'flex-start',
  },
  inputContainer: {
    padding: '1.5rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    gap: '1rem',
  },
  input: {
    flex: 1,
    padding: '1rem',
    borderRadius: '25px',
    border: 'none',
    fontSize: '1rem',
    outline: 'none',
  },
  sendButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'opacity 0.2s',
  },
};