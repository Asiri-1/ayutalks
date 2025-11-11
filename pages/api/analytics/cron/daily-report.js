// This runs as a cron job (set up in Vercel or use a service like EasyCron)
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Security: Only allow cron jobs
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch yesterday's analytics
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/summary`);
    const analytics = await response.json();

    // Send email
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // or your email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL, // Your email
      subject: `AyuTalks Daily Report - ${new Date().toLocaleDateString()}`,
      html: generateEmailHTML(analytics)
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Daily report failed:', error);
    return res.status(500).json({ error: error.message });
  }
}

function generateEmailHTML(analytics) {
  return `
    <h2>AyuTalks Daily Analytics</h2>
    <h3>Performance Summary</h3>
    <ul>
      <li>Total Messages: ${analytics.summary.total_messages}</li>
      <li>Avg Response Time: ${(analytics.summary.avg_response_time / 1000).toFixed(2)}s</li>
      <li>RAG Usage: ${analytics.summary.rag_used_count}</li>
      <li>Concepts Mapped: ${analytics.summary.successful_mappings}</li>
    </ul>
    <h3>Top Concepts</h3>
    <ol>
      ${Object.entries(analytics.concepts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([concept, count]) => `<li>${concept}: ${count}</li>`)
        .join('')}
    </ol>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/analytics">View Full Dashboard</a></p>
  `;
}
