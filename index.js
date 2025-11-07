import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to AyuTalks. How are you feeling today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, { role: 'user', content: userMessage }]
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'I apologize, but I encountered an error. Please try again.' 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message 
        }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AyuTalks - AI Mindfulness Companion</title>
        <meta name="description" content="Your personal mindfulness companion powered by AI" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>AyuTalks</h1>
          <p style={styles.subtitle}>Your AI Mindfulness Companion</p>
        </div>

        <div style={styles.chatContainer}>
          <div style={styles.messagesContainer}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  ...styles.messageWrapper,
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    ...styles.message,
                    ...(message.role === 'user' ? styles.userMessage : styles.assistantMessage)
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={styles.messageWrapper}>
                <div style={{ ...styles.message, ...styles.assistantMessage }}>
                  <span style={styles.typing}>●</span>
                  <span style={styles.typing}>●</span>
                  <span style={styles.typing}>●</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Share what's on your mind..."
              style={styles.input}
              disabled={isLoading}
            />
            <button
              type="submit"
              style={{
                ...styles.sendButton,
                opacity: isLoading || !input.trim() ? 0.5 : 1
              }}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            AyuTalks provides mindfulness support. For mental health emergencies, 
            please contact a professional or call your local crisis helpline.
          </p>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    padding: '2rem',
    color: 'white',
  },
  title: {
    fontSize: '3rem',
    margin: '0',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: '1.2rem',
    margin: '0.5rem 0 0 0',
    opacity: '0.9',
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '900px',
    width: '90%',
    margin: '0 auto 2rem auto',
    backgroundColor: 'white',
    borderRadius: '20px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%',
  },
  message: {
    maxWidth: '70%',
    padding: '1rem 1.5rem',
    borderRadius: '20px',
    lineHeight: '1.6',
    fontSize: '1rem',
  },
  userMessage: {
    backgroundColor: '#667eea',
    color: 'white',
    borderBottomRightRadius: '5px',
  },
  assistantMessage: {
    backgroundColor: '#f0f0f0',
    color: '#333',
    borderBottomLeftRadius: '5px',
  },
  typing: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#999',
    margin: '0 2px',
    animation: 'typing 1.4s infinite',
  },
  inputForm: {
    display: 'flex',
    padding: '1.5rem',
    borderTop: '1px solid #e0e0e0',
    gap: '1rem',
  },
  input: {
    flex: 1,
    padding: '1rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '25px',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  sendButton: {
    padding: '1rem 2rem',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  footer: {
    padding: '1.5rem',
    textAlign: 'center',
    color: 'white',
  },
  footerText: {
    fontSize: '0.9rem',
    margin: 0,
    opacity: 0.8,
  },
};
