import { useState } from 'react';
import Head from 'next/head';
import Chat from '../components/Chat';

export default function Home() {
  const [showChat, setShowChat] = useState(false);

  if (showChat) {
    return <Chat onBack={() => setShowChat(false)} />;
  }

  return (
    <>
      <Head>
        <title>AyuTalks - Your Space to Pause and Reconnect</title>
        <meta name="description" content="Everyday conversations that help you reflect, unwind, and grow — one mindful talk at a time." />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={styles.container}>
        {/* Hero Section */}
        <section style={styles.hero}>
          <div style={styles.heroContent}>
            <h1 style={styles.title}>AyuTalks</h1>
            <p style={styles.tagline}>
              Your space to pause, talk, and reconnect with yourself.
            </p>
            <p style={styles.subtext}>
              Everyday conversations that help you reflect, unwind, and grow — one mindful talk at a time. 
              No lessons, no judgment. Just an honest chat, whenever you need it.
            </p>
            <button 
              onClick={() => setShowChat(true)}
              style={styles.ctaButton}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Start Talking
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section style={styles.features}>
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>💭</div>
              <h3 style={styles.featureTitle}>Honest Conversations</h3>
              <p style={styles.featureText}>
                Share what's on your mind without fear of judgment. Just real, mindful dialogue.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🌱</div>
              <h3 style={styles.featureTitle}>Daily Reflection</h3>
              <p style={styles.featureText}>
                Develop self-awareness through gentle questions and thoughtful exchanges.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🧘</div>
              <h3 style={styles.featureTitle}>At Your Pace</h3>
              <p style={styles.featureText}>
                No pressure, no schedule. Talk whenever you need to pause and reconnect.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section style={styles.howItWorks}>
          <h2 style={styles.sectionTitle}>How It Works</h2>
          <div style={styles.stepsContainer}>
            <div style={styles.step}>
              <div style={styles.stepNumber}>1</div>
              <h3 style={styles.stepTitle}>Click "Start Talking"</h3>
              <p style={styles.stepText}>Begin a conversation anytime, from anywhere</p>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>2</div>
              <h3 style={styles.stepTitle}>Share What's On Your Mind</h3>
              <p style={styles.stepText}>Talk about your day, feelings, or whatever you need</p>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>3</div>
              <h3 style={styles.stepTitle}>Reflect & Grow</h3>
              <p style={styles.stepText}>Gain clarity through mindful, supportive dialogue</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={styles.ctaSection}>
          <h2 style={styles.ctaTitle}>Ready to reconnect with yourself?</h2>
          <p style={styles.ctaText}>Start your first conversation today. It's free, private, and judgment-free.</p>
          <button 
            onClick={() => setShowChat(true)}
            style={styles.ctaButtonLarge}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Start Talking Now
          </button>
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <p style={styles.footerText}>
            AyuTalks provides mindfulness support. For mental health emergencies, 
            please contact a professional or call your local crisis helpline.
          </p>
          <p style={styles.footerCopyright}>© 2024 AyuTalks. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  hero: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    minHeight: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    maxWidth: '800px',
    textAlign: 'center',
    color: 'white',
    zIndex: 1,
  },
  title: {
    fontSize: 'clamp(3rem, 8vw, 5rem)',
    fontWeight: '700',
    margin: '0 0 1.5rem 0',
    letterSpacing: '-0.02em',
    textShadow: '0 2px 20px rgba(0,0,0,0.2)',
  },
  tagline: {
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    fontWeight: '400',
    margin: '0 0 1.5rem 0',
    lineHeight: '1.4',
    opacity: '0.95',
  },
  subtext: {
    fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
    fontWeight: '300',
    lineHeight: '1.8',
    margin: '0 0 3rem 0',
    opacity: '0.9',
    maxWidth: '700px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  ctaButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1.25rem 3rem',
    fontSize: '1.25rem',
    fontWeight: '600',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  features: {
    padding: '6rem 2rem',
    backgroundColor: '#f8f9fa',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  featureCard: {
    backgroundColor: 'white',
    padding: '2.5rem',
    borderRadius: '20px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    transition: 'transform 0.3s ease',
  },
  featureIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  featureTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: '0 0 1rem 0',
    color: '#333',
  },
  featureText: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#666',
    margin: '0',
  },
  howItWorks: {
    padding: '6rem 2rem',
    backgroundColor: 'white',
  },
  sectionTitle: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: '700',
    textAlign: 'center',
    margin: '0 0 4rem 0',
    color: '#333',
  },
  stepsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '3rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  step: {
    textAlign: 'center',
  },
  stepNumber: {
    width: '60px',
    height: '60px',
    backgroundColor: '#667eea',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: '0 auto 1.5rem auto',
  },
  stepTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: '0 0 1rem 0',
    color: '#333',
  },
  stepText: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#666',
    margin: '0',
  },
  ctaSection: {
    padding: '6rem 2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textAlign: 'center',
    color: 'white',
  },
  ctaTitle: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: '700',
    margin: '0 0 1.5rem 0',
  },
  ctaText: {
    fontSize: '1.25rem',
    margin: '0 0 3rem 0',
    opacity: '0.9',
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  ctaButtonLarge: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '1.5rem 4rem',
    fontSize: '1.5rem',
    fontWeight: '600',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
  footer: {
    padding: '3rem 2rem',
    backgroundColor: '#1a1a1a',
    textAlign: 'center',
    color: 'white',
  },
  footerText: {
    fontSize: '0.9rem',
    margin: '0 0 1rem 0',
    opacity: '0.8',
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  footerCopyright: {
    fontSize: '0.85rem',
    margin: '0',
    opacity: '0.6',
  },
};
