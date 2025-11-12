import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminAnalytics() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [transcriptDate, setTranscriptDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [transcript, setTranscript] = useState("");
  const [transcriptStats, setTranscriptStats] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
        setIsAuthenticated(true);
      } else {
        alert("Invalid password");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Failed to login");
    } finally {
      setLoading(false);
    }
  };

  const loadDailyTranscript = async () => {
    setLoadingTranscript(true);
    try {
      const response = await fetch("/api/admin/daily-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          password,
          date: transcriptDate 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranscript(data.transcript);
        setTranscriptStats(data.stats);
      } else {
        alert("Failed to load transcript");
      }
    } catch (error) {
      console.error("Transcript error:", error);
      alert("Failed to load transcript");
    } finally {
      setLoadingTranscript(false);
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(transcript);
    alert("Transcript copied to clipboard!");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-2 border rounded-lg mb-4"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">AyuTalks Admin Dashboard</h1>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setPassword("");
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">📋 Daily Transcript</h2>
          <p className="text-gray-600 mb-4">
            Get all chat conversations from a specific date for manual review and improvement
          </p>
          
          <div className="flex gap-4 mb-4">
            <input
              type="date"
              value={transcriptDate}
              onChange={(e) => setTranscriptDate(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            />
            <button
              onClick={loadDailyTranscript}
              disabled={loadingTranscript}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loadingTranscript ? "Loading..." : "Get Transcript"}
            </button>
            {transcript && (
              <button
                onClick={copyTranscript}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                📋 Copy to Clipboard
              </button>
            )}
          </div>

          {transcriptStats && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {transcriptStats.totalConversations}
                  </div>
                  <div className="text-sm text-gray-600">Conversations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {transcriptStats.totalMessages}
                  </div>
                  <div className="text-sm text-gray-600">Messages</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {transcriptStats.date}
                  </div>
                  <div className="text-sm text-gray-600">Date</div>
                </div>
              </div>
            </div>
          )}

          {transcript && (
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {transcript}
              </pre>
            </div>
          )}
        </div>

        {analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-2">Avg Response Time</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {analytics.summary.avgResponseTime.toFixed(2)}s
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-2">Total Messages</h3>
                <p className="text-3xl font-bold text-green-600">
                  {analytics.summary.totalMessages}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-2">RAG Usage Rate</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {analytics.summary.ragUsageRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Message Classification</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.summary.messageTypes.casual}
                  </div>
                  <div className="text-sm text-gray-600">Casual</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.summary.messageTypes.emotional}
                  </div>
                  <div className="text-sm text-gray-600">Emotional</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.summary.messageTypes.substantive}
                  </div>
                  <div className="text-sm text-gray-600">Substantive</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {analytics.recentMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className="border-l-4 border-blue-500 pl-4 py-2"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold">
                        {msg.message_type.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Response: {msg.response_time.toFixed(2)}s
                      {msg.rag_used && " | RAG Used"}
                      {msg.concepts_mapped > 0 &&
                        ` | ${msg.concepts_mapped} concepts`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}