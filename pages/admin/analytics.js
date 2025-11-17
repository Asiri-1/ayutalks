import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  const [transcript, setTranscript] = useState('');
  const [transcriptStats, setTranscriptStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAnalyticsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setAnalytics(data);
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Failed to authenticate');
    }

    setAnalyticsLoading(false);
  };

  const loadTranscript = async (date) => {
    setTranscriptLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/daily-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, date })
      });

      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
        setTranscriptStats(data.stats);
      } else {
        setError('Failed to load transcript');
      }
    } catch (err) {
      setError('Error loading transcript');
    }

    setTranscriptLoading(false);
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    loadTranscript(newDate);
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setPassword('');
    setAnalytics(null);
  };

  const copySummaryToClipboard = async () => {
    const summary = `
AYUTALKS ENHANCED ANALYTICS SUMMARY
Date: ${new Date().toLocaleDateString()}

👥 USER JOURNEY (Last 30 Days):
- Total Users: ${analytics?.userJourney?.activeUsers?.total || 0}
- Active Today: ${analytics?.userJourney?.activeUsers?.today || 0}
- Active This Week: ${analytics?.userJourney?.activeUsers?.week || 0}
- Active This Month: ${analytics?.userJourney?.activeUsers?.month || 0}

ENGAGEMENT LEVELS:
- Onboarding (1-5 msgs): ${analytics?.userJourney?.engagementLevels?.onboarding || 0} users
- Building Rapport (6-20 msgs): ${analytics?.userJourney?.engagementLevels?.building || 0} users
- Engaged (21-50 msgs): ${analytics?.userJourney?.engagementLevels?.engaged || 0} users
- Deep Connection (50+ msgs): ${analytics?.userJourney?.engagementLevels?.deep || 0} users

USER LIFECYCLE:
- New This Week: ${analytics?.userJourney?.lifecycle?.new_week || 0}
- New This Month: ${analytics?.userJourney?.lifecycle?.new_month || 0}
- Returning Active: ${analytics?.userJourney?.lifecycle?.returning || 0}
- At Risk (inactive 7d): ${analytics?.userJourney?.lifecycle?.at_risk || 0}

🧠 CONCEPT MASTERY:
- Ready for Assessment: ${analytics?.userJourney?.readiness?.readyForAssessment || 0} users (${analytics?.userJourney?.readiness?.readinessRate || 0}%)
- Avg Mastery Score: ${analytics?.conceptAnalytics?.summary?.avgMasteryAcrossAll || 0}

TOP ENGAGED CONCEPTS:
${analytics?.conceptAnalytics?.topEngaged?.map((c, i) => 
  `${i + 1}. ${c.name}: ${c.userCount} users (understanding: ${c.avgMastery}%, encounters: ${c.avgEncounters})`
).join('\n') || 'N/A'}

🎭 QUALITY SCORE: ${analytics?.quality?.qualityScore || 0}%
Issues Detected (Last 7 Days):
- AI Reveals: ${analytics?.quality?.issues?.aiReveals || 0}
- Numbered Lists in Casual Chat: ${analytics?.quality?.issues?.numberedLists || 0}
- Religious Terms Leakage: ${analytics?.quality?.issues?.religiousTerms || 0}
Status: ${analytics?.quality?.status || 'UNKNOWN'}

⚡ PERFORMANCE (Last 30 Days):
- Total Messages: ${analytics?.summary?.total_messages || 0}
- Avg Response Time: ${((analytics?.summary?.avg_response_time || 0) / 1000).toFixed(2)}s
- RAG Usage Rate: ${(((analytics?.summary?.rag_used_count || 0) / (analytics?.summary?.total_messages || 1)) * 100).toFixed(1)}%

MESSAGE TYPES:
- Casual: ${analytics?.summary?.casual_messages || 0}
- Emotional: ${analytics?.summary?.emotional_messages || 0}
- Substantive: ${analytics?.summary?.substantive_messages || 0}
- Mind Study Sessions: ${analytics?.summary?.session_messages || 0}

💰 API COSTS:
- Today: $${(analytics?.costs?.today || 0).toFixed(3)}
- This Week: $${(analytics?.costs?.week || 0).toFixed(2)}
- This Month: $${(analytics?.costs?.month || 0).toFixed(2)}
- Per User: $${(analytics?.costs?.per_user || 0).toFixed(4)}

Breakdown:
- Claude API: $${(analytics?.costs?.claude || 0).toFixed(3)} (${analytics?.costs?.claude_pct || 0}%)
- OpenAI Embeddings: $${(analytics?.costs?.openai || 0).toFixed(4)} (${analytics?.costs?.openai_pct || 0}%)
- Deepgram Voice: $${(analytics?.costs?.deepgram || 0).toFixed(4)} (${analytics?.costs?.deepgram_pct || 0}%)

⚠️ ERRORS (Last 24 Hours):
- Concept Mapping Failures: ${analytics?.errors?.concept_mapping_failures || 0}
- Claude API Errors: ${analytics?.errors?.claude_api_errors || 0}
- RAG No Results: ${analytics?.errors?.rag_no_results || 0}
- Database Errors: ${analytics?.errors?.database_errors || 0}

🚨 STATUS:
${analytics?.summary?.avg_response_time > 7000 ? '🔴 HIGH PRIORITY: Response times too slow' :
  analytics?.errors?.concept_mapping_failures > 3 ? '🔴 HIGH PRIORITY: Concept mapping failing' :
  analytics?.quality?.issues?.aiReveals > 0 ? '🔴 CRITICAL: Ayu revealed AI nature' :
  analytics?.summary?.rag_used_count / analytics?.summary?.total_messages < 0.15 ? '🟡 MEDIUM: RAG usage low' :
  '🟢 ALL CLEAR: All systems operating normally'}
    `.trim();

    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  const copyTranscriptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  useEffect(() => {
    if (authenticated && activeTab === 'transcript' && !transcript) {
      loadTranscript(selectedDate);
    }
  }, [authenticated, activeTab]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6">AyuTalks Admin</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={analyticsLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {analyticsLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">AyuTalks Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Logout
          </button>
        </div>

        {/* ========== TABS: Analytics + Daily Transcript ========== */}
        <div className="mb-6 flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'analytics'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📊 Analytics
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'transcript'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📝 Daily Transcript
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={copySummaryToClipboard}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <span>📋</span>
                <span>{copySuccess ? 'Copied!' : 'Copy Enhanced Summary'}</span>
              </button>
            </div>

            {/* ========== EXISTING: DAILY ALERTS ========== */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">🚨</span>
                Action Required Today
              </h2>
              <div className="space-y-3">
                {/* CRITICAL: Quality Issues */}
                {analytics?.quality?.issues?.aiReveals > 0 && (
                  <div className="flex items-start space-x-3 bg-red-50 p-3 rounded-lg border border-red-200">
                    <span className="text-red-600 font-bold">🔴 CRITICAL:</span>
                    <span className="text-red-800">
                      Ayu revealed AI nature {analytics.quality.issues.aiReveals} times in past week. 
                      Review conversations immediately!
                    </span>
                  </div>
                )}

                {/* HIGH: Response Times */}
                {analytics?.summary?.avg_response_time > 7000 && (
                  <div className="flex items-start space-x-3 bg-red-50 p-3 rounded-lg border border-red-200">
                    <span className="text-red-600 font-bold">🔴 HIGH:</span>
                    <span className="text-red-800">
                      Response times averaging {((analytics.summary.avg_response_time) / 1000).toFixed(2)}s 
                      (target: &lt;5s). Check server performance.
                    </span>
                  </div>
                )}
                
                {/* HIGH: Concept Mapping */}
                {analytics?.errors?.concept_mapping_failures > 3 && (
                  <div className="flex items-start space-x-3 bg-red-50 p-3 rounded-lg border border-red-200">
                    <span className="text-red-600 font-bold">🔴 HIGH:</span>
                    <span className="text-red-800">
                      {analytics.errors.concept_mapping_failures} concept mapping failures today. 
                      Check Claude API logs.
                    </span>
                  </div>
                )}

                {/* MEDIUM: RAG Usage */}
                {analytics?.summary?.rag_used_count / analytics?.summary?.total_messages < 0.15 && (
                  <div className="flex items-start space-x-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <span className="text-yellow-600 font-bold">🟡 MEDIUM:</span>
                    <span className="text-yellow-800">
                      RAG usage at {((analytics.summary.rag_used_count / analytics.summary.total_messages) * 100).toFixed(1)}% 
                      (lower than usual). Users may not be asking deep questions.
                    </span>
                  </div>
                )}

                {/* OPPORTUNITY: Ready Users */}
                {analytics?.userJourney?.readiness?.readyForAssessment >= 3 && (
                  <div className="flex items-start space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                    <span className="text-green-600 font-bold">🎯 OPPORTUNITY:</span>
                    <span className="text-green-800">
                      {analytics.userJourney.readiness.readyForAssessment} users ready for MindValuation assessment! 
                      Consider triggering suggestions.
                    </span>
                  </div>
                )}

                {/* All Clear */}
                {analytics?.summary?.avg_response_time <= 7000 && 
                 (!analytics?.errors?.concept_mapping_failures || analytics.errors.concept_mapping_failures <= 3) && 
                 analytics?.summary?.rag_used_count / analytics?.summary?.total_messages >= 0.15 &&
                 (!analytics?.quality?.issues?.aiReveals || analytics.quality.issues.aiReveals === 0) && (
                  <div className="flex items-start space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                    <span className="text-green-600 font-bold">🟢 ALL CLEAR:</span>
                    <span className="text-green-800">All systems operating normally</span>
                  </div>
                )}
              </div>
            </div>

            {/* ========== NEW: USER JOURNEY ========== */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">👥 User Journey (Last 30 Days)</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-3xl font-bold text-blue-600">{analytics?.userJourney?.activeUsers?.today || 0}</p>
                  <p className="text-sm text-gray-600">Active Today</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-3xl font-bold text-blue-600">{analytics?.userJourney?.activeUsers?.week || 0}</p>
                  <p className="text-sm text-gray-600">Active This Week</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-3xl font-bold text-blue-600">{analytics?.userJourney?.activeUsers?.month || 0}</p>
                  <p className="text-sm text-gray-600">Active This Month</p>
                </div>
                <div className="text-center p-4 bg-blue-100 rounded">
                  <p className="text-3xl font-bold text-blue-700">{analytics?.userJourney?.activeUsers?.total || 0}</p>
                  <p className="text-sm text-gray-600">Total Users</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Engagement Levels</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm">Onboarding (1-5 msgs)</span>
                      <span className="font-bold text-gray-700">{analytics?.userJourney?.engagementLevels?.onboarding || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm">Building Rapport (6-20)</span>
                      <span className="font-bold text-gray-700">{analytics?.userJourney?.engagementLevels?.building || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Engaged (21-50)</span>
                      <span className="font-bold text-green-700">{analytics?.userJourney?.engagementLevels?.engaged || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-100 rounded">
                      <span className="text-sm">Deep Connection (50+)</span>
                      <span className="font-bold text-green-800">{analytics?.userJourney?.engagementLevels?.deep || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">User Lifecycle</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">New This Week</span>
                      <span className="font-bold text-blue-700">{analytics?.userJourney?.lifecycle?.new_week || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm">New This Month</span>
                      <span className="font-bold text-blue-700">{analytics?.userJourney?.lifecycle?.new_month || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">Returning Active</span>
                      <span className="font-bold text-green-700">{analytics?.userJourney?.lifecycle?.returning || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm">At Risk (7d inactive)</span>
                      <span className="font-bold text-red-700">{analytics?.userJourney?.lifecycle?.at_risk || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded">
                <h3 className="font-semibold text-gray-700 mb-2">🎯 MindValuation Readiness</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Users ready for assessment (3+ concepts at 60%+)</span>
                  <span className="text-2xl font-bold text-purple-700">
                    {analytics?.userJourney?.readiness?.readyForAssessment || 0} ({analytics?.userJourney?.readiness?.readinessRate || 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* ========== NEW: CONCEPT MASTERY ========== */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🧠 Concept Mastery Analytics</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-3xl font-bold text-purple-600">{analytics?.conceptAnalytics?.summary?.totalConcepts || 0}</p>
                  <p className="text-sm text-gray-600">Total Concepts</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-3xl font-bold text-purple-600">{analytics?.conceptAnalytics?.summary?.conceptsEngaged || 0}</p>
                  <p className="text-sm text-gray-600">Actively Engaged</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-3xl font-bold text-purple-600">{analytics?.conceptAnalytics?.summary?.avgMasteryAcrossAll || 0}</p>
                  <p className="text-sm text-gray-600">Avg Mastery</p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 mb-3">Top Engaged Concepts</h3>
              <div className="space-y-2">
                {analytics?.conceptAnalytics?.topEngaged?.map((concept, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded hover:bg-gray-100">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{index + 1}. {concept.name}</span>
                        <span className="ml-2 text-xs text-gray-500">Difficulty: {concept.difficulty}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700">{concept.userCount} users</p>
                        <p className="text-xs text-gray-600">Understanding: {concept.avgMastery}% | Encounters: {concept.avgEncounters}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ========== NEW: QUALITY MONITORING ========== */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">🎭 Quality Monitoring (Last 7 Days)</h2>
              
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Overall Quality Score</span>
                  <span className={`text-3xl font-bold ${
                    parseFloat(analytics?.quality?.qualityScore || 0) >= 95 ? 'text-green-600' :
                    parseFloat(analytics?.quality?.qualityScore || 0) >= 85 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {analytics?.quality?.qualityScore || 0}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Reviewed {analytics?.quality?.issues?.totalReviewed || 0} messages
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded ${analytics?.quality?.issues?.aiReveals > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className="text-sm text-gray-600">AI Nature Reveals</p>
                  <p className={`text-2xl font-bold ${analytics?.quality?.issues?.aiReveals > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {analytics?.quality?.issues?.aiReveals || 0}
                  </p>
                  {analytics?.quality?.issues?.aiReveals > 0 && (
                    <p className="text-xs text-red-600 mt-1">❌ CRITICAL: Review immediately</p>
                  )}
                </div>

                <div className={`p-4 rounded ${(analytics?.quality?.issues?.numberedLists || 0) > 5 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <p className="text-sm text-gray-600">Numbered Lists in Casual Chat</p>
                  <p className={`text-2xl font-bold ${(analytics?.quality?.issues?.numberedLists || 0) > 5 ? 'text-yellow-700' : 'text-green-700'}`}>
                    {analytics?.quality?.issues?.numberedLists || 0}
                  </p>
                  {(analytics?.quality?.issues?.numberedLists || 0) > 5 && (
                    <p className="text-xs text-yellow-600 mt-1">⚠️ Ayu being robotic</p>
                  )}
                </div>

                <div className={`p-4 rounded ${analytics?.quality?.issues?.religiousTerms > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <p className="text-sm text-gray-600">Religious Terms Leakage</p>
                  <p className={`text-2xl font-bold ${analytics?.quality?.issues?.religiousTerms > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                    {analytics?.quality?.issues?.religiousTerms || 0}
                  </p>
                  {analytics?.quality?.issues?.religiousTerms > 0 && (
                    <p className="text-xs text-yellow-600 mt-1">⚠️ Frontend should be secular</p>
                  )}
                </div>
              </div>
            </div>

            {/* ========== EXISTING: COST TRACKING ========== */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">💰</span>
                API Costs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Today</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${(analytics?.costs?.today || 0).toFixed(3)}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">This Week</div>
                  <div className="text-2xl font-bold text-purple-600">
                    ${(analytics?.costs?.week || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">This Month</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${(analytics?.costs?.month || 0).toFixed(2)}
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Per User</div>
                  <div className="text-2xl font-bold text-orange-600">
                    ${(analytics?.costs?.per_user || 0).toFixed(4)}
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Claude API (chat):</span>
                  <span className="font-mono">${(analytics?.costs?.claude || 0).toFixed(3)} ({analytics?.costs?.claude_pct || 0}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OpenAI Embeddings (RAG):</span>
                  <span className="font-mono">${(analytics?.costs?.openai || 0).toFixed(4)} ({analytics?.costs?.openai_pct || 0}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deepgram (voice):</span>
                  <span className="font-mono">${(analytics?.costs?.deepgram || 0).toFixed(4)} ({analytics?.costs?.deepgram_pct || 0}%)</span>
                </div>
              </div>
            </div>

            {/* ========== EXISTING: ERROR LOG ========== */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">⚠️</span>
                Errors & Failures (Last 24 Hours)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${
                  (analytics?.errors?.concept_mapping_failures || 0) > 0 ? 'bg-red-50' : 'bg-green-50'
                }`}>
                  <div className="text-sm text-gray-600">Concept Mapping Failures</div>
                  <div className={`text-3xl font-bold ${
                    (analytics?.errors?.concept_mapping_failures || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analytics?.errors?.concept_mapping_failures || 0}
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${
                  (analytics?.errors?.claude_api_errors || 0) > 0 ? 'bg-red-50' : 'bg-green-50'
                }`}>
                  <div className="text-sm text-gray-600">Claude API Errors</div>
                  <div className={`text-3xl font-bold ${
                    (analytics?.errors?.claude_api_errors || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analytics?.errors?.claude_api_errors || 0}
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${
                  (analytics?.errors?.rag_no_results || 0) > 5 ? 'bg-yellow-50' : 'bg-green-50'
                }`}>
                  <div className="text-sm text-gray-600">RAG No Results</div>
                  <div className={`text-3xl font-bold ${
                    (analytics?.errors?.rag_no_results || 0) > 5 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {analytics?.errors?.rag_no_results || 0}
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${
                  (analytics?.errors?.database_errors || 0) > 0 ? 'bg-red-50' : 'bg-green-50'
                }`}>
                  <div className="text-sm text-gray-600">Database Errors</div>
                  <div className={`text-3xl font-bold ${
                    (analytics?.errors?.database_errors || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analytics?.errors?.database_errors || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* ========== EXISTING: PERFORMANCE METRICS ========== */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Performance Summary (Last 30 Days)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600">Total Messages</div>
                  <div className="text-3xl font-bold">{analytics?.summary?.total_messages || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Avg Response Time</div>
                  <div className="text-3xl font-bold">
                    {((analytics?.summary?.avg_response_time || 0) / 1000).toFixed(2)}s
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">RAG Usage</div>
                  <div className="text-3xl font-bold">
                    {(((analytics?.summary?.rag_used_count || 0) / (analytics?.summary?.total_messages || 1)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* ========== EXISTING: MESSAGE TYPES ========== */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Message Types</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Casual:</span>
                  <span className="font-bold">{analytics?.summary?.casual_messages || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Emotional:</span>
                  <span className="font-bold">{analytics?.summary?.emotional_messages || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Substantive:</span>
                  <span className="font-bold">{analytics?.summary?.substantive_messages || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Mind Study Sessions:</span>
                  <span className="font-bold">{analytics?.summary?.session_messages || 0}</span>
                </div>
              </div>
            </div>

            {/* ========== EXISTING: RECENT MESSAGES ========== */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-bold">Recent Messages</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Time</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">RAG</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Concepts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics?.recentMessages?.map((msg, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(msg.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            msg.message_type === 'casual' ? 'bg-blue-100 text-blue-800' :
                            msg.message_type === 'emotional' ? 'bg-purple-100 text-purple-800' :
                            msg.message_type === 'session' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {msg.message_type?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {msg.query_preview || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {((msg.total_time || 0) / 1000).toFixed(2)}s
                        </td>
                        <td className="px-6 py-4 text-center">
                          {msg.used_rag ? '✓' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {msg.concepts_mapped || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ========== EXISTING: DAILY TRANSCRIPT TAB ========== */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={copyTranscriptToClipboard}
                disabled={!transcript}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <span>📋</span>
                <span>{copySuccess ? 'Copied!' : 'Copy Transcript for Claude'}</span>
              </button>
            </div>

            {transcriptStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="text-xl font-bold">{transcriptStats.date}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Total Conversations</div>
                  <div className="text-xl font-bold">{transcriptStats.totalConversations}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">Total Messages</div>
                  <div className="text-xl font-bold">{transcriptStats.totalMessages}</div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h2 className="text-xl font-semibold">Conversation Transcript</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Copy and paste this to Claude for daily conversation review
                </p>
              </div>
              <div className="p-6">
                {transcriptLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <div className="mt-4 text-gray-600">Loading transcript...</div>
                  </div>
                ) : transcript ? (
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                    {transcript}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select a date to view transcript
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}