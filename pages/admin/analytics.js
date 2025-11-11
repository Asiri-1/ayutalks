import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function AdminAnalytics() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  // Simple password protection (you can make this more secure)
  const checkPassword = () => {
   // Hardcoded password for simplicity
  const ADMIN_PASSWORD = 'ayutalks2024';
  
  if (password === ADMIN_PASSWORD) {
    setIsAuthorized(true);
    loadAnalytics();
  } else {
      alert('Incorrect password');
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/summary');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
    setLoading(false);
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(analytics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ayutalks-analytics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const copyForClaude = () => {
    const summary = `
AyuTalks Analytics Summary - ${new Date().toLocaleDateString()}

PERFORMANCE (Last 7 Days):
- Total Messages: ${analytics?.summary?.total_messages || 0}
- Avg Response Time: ${((analytics?.summary?.avg_response_time || 0) / 1000).toFixed(2)}s
- Avg RAG Time: ${((analytics?.summary?.avg_rag_time || 0) / 1000).toFixed(2)}s
- Avg Claude Time: ${((analytics?.summary?.avg_claude_time || 0) / 1000).toFixed(2)}s

MESSAGE TYPES:
- Casual: ${analytics?.summary?.casual_messages || 0}
- Emotional: ${analytics?.summary?.emotional_messages || 0}
- Substantive: ${analytics?.summary?.substantive_messages || 0}

CONCEPT TRACKING:
- Total Concepts Mapped: ${analytics?.summary?.successful_mappings || 0}
- Success Rate: ${analytics?.summary?.mapping_success_rate || 0}%
- Avg Concepts per Message: ${(analytics?.summary?.avg_concepts_per_message || 0).toFixed(2)}

TOP 5 CONCEPTS:
${Object.entries(analytics?.concepts || {})
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([concept, count]) => `- ${concept}: ${count}`)
  .join('\n')}

INSIGHTS:
${analytics?.insights || 'No insights available'}
    `.trim();

    navigator.clipboard.writeText(summary);
    alert('Analytics summary copied! Paste it in your chat with Claude.');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-4">Admin Access</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && checkPassword()}
            placeholder="Enter admin password"
            className="w-full px-4 py-2 border rounded mb-4"
          />
          <button
            onClick={checkPassword}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Access Analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">AyuTalks Analytics Dashboard</h1>
          <div className="space-x-4">
            <button
              onClick={copyForClaude}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              📋 Copy for Claude
            </button>
            <button
              onClick={exportJSON}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              📥 Export JSON
            </button>
            <button
              onClick={loadAnalytics}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading analytics...</div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Performance Cards */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard
                title="Total Messages"
                value={analytics.summary?.total_messages || 0}
                subtitle="Last 7 days"
              />
              <MetricCard
                title="Avg Response Time"
                value={`${((analytics.summary?.avg_response_time || 0) / 1000).toFixed(2)}s`}
                subtitle="User to Ayu"
              />
              <MetricCard
                title="RAG Usage"
                value={`${analytics.summary?.rag_used_count || 0}`}
                subtitle={`${((analytics.summary?.rag_used_count / analytics.summary?.total_messages * 100) || 0).toFixed(0)}% of messages`}
              />
              <MetricCard
                title="Concepts Mapped"
                value={analytics.summary?.successful_mappings || 0}
                subtitle={`${analytics.summary?.mapping_success_rate || 0}% success`}
              />
            </div>

            {/* Message Type Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Message Type Distribution</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics.summary?.casual_messages || 0}
                  </div>
                  <div className="text-gray-600">Casual</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {analytics.summary?.emotional_messages || 0}
                  </div>
                  <div className="text-gray-600">Emotional</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {analytics.summary?.substantive_messages || 0}
                  </div>
                  <div className="text-gray-600">Substantive</div>
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Daily Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Date</th>
                      <th className="text-right py-2">Messages</th>
                      <th className="text-right py-2">Avg Time</th>
                      <th className="text-right py-2">RAG Used</th>
                      <th className="text-right py-2">Concepts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.daily?.map(day => (
                      <tr key={day.date} className="border-b">
                        <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                        <td className="text-right">{day.total_messages}</td>
                        <td className="text-right">{((day.avg_response_time || 0) / 1000).toFixed(2)}s</td>
                        <td className="text-right">{day.rag_used_count}</td>
                        <td className="text-right">{day.successful_mappings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Concepts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Concepts (Last 30 Days)</h2>
              <div className="space-y-2">
                {Object.entries(analytics.concepts || {})
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([concept, count]) => (
                    <div key={concept} className="flex justify-between items-center py-2 border-b">
                      <span className="font-medium">{concept.replace(/_/g, ' ')}</span>
                      <div className="flex items-center space-x-4">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(count / Math.max(...Object.values(analytics.concepts))) * 100}%`
                            }}
                          />
                        </div>
                        <span className="text-gray-600 w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">No analytics data available</div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}