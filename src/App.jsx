import React, { useState, useEffect } from 'react';

const API_BASE = 'https://staging.empromptu.ai/api_tools';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer 22c3d153c7f536d80c3c384fb6ddc93c',
  'X-Generated-App-ID': 'a57e3d04-dd0c-4484-8fbd-5bcc655a9ac7',
  'X-Usage-Key': '369397c6ffb66469db3dc7796c8f70f9'
};

const TinyHabitsTracker = () => {
  const [habits, setHabits] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showApiLogs, setShowApiLogs] = useState(false);
  const [createdObjects, setCreatedObjects] = useState([]);

  useEffect(() => {
    const savedHabits = localStorage.getItem('tinyHabits');
    if (savedHabits) {
      setHabits(JSON.parse(savedHabits));
    }
    
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tinyHabits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const logApiCall = (method, endpoint, payload, response) => {
    const log = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      payload,
      response,
      id: Date.now()
    };
    setApiLogs(prev => [log, ...prev]);
  };

  const analyzeHabit = async () => {
    if (!newHabit.trim()) return;
    
    setIsAnalyzing(true);
    
    try {
      // Step 1: Input the habit data
      const inputPayload = {
        created_object_name: 'user_habit',
        data_type: 'strings',
        input_data: [newHabit]
      };

      const inputResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(inputPayload)
      });

      const inputResult = await inputResponse.json();
      logApiCall('POST', '/input_data', inputPayload, inputResult);
      
      if (!createdObjects.includes('user_habit')) {
        setCreatedObjects(prev => [...prev, 'user_habit']);
      }

      // Step 2: Apply BJ Fogg's analysis
      const promptPayload = {
        created_object_names: ['habit_analysis'],
        prompt_string: `Analyze this habit goal using BJ Fogg's Tiny Habits methodology: {user_habit}

Apply these key principles:
1. Start ridiculously small (make it so easy you can't say no)
2. Anchor to an existing routine (after I...)
3. Celebrate immediately after completing it
4. Focus on consistency over intensity

Provide:
- A "tiny" version of this habit (2 minutes or less)
- A specific anchor routine suggestion
- A celebration idea
- Why this approach will work better than the original goal

Format your response as practical, encouraging advice that feels personal and actionable.`,
        inputs: [{
          input_object_name: 'user_habit',
          mode: 'combine_events'
        }]
      };

      const promptResponse = await fetch(`${API_BASE}/apply_prompt`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(promptPayload)
      });

      const promptResult = await promptResponse.json();
      logApiCall('POST', '/apply_prompt', promptPayload, promptResult);
      
      if (!createdObjects.includes('habit_analysis')) {
        setCreatedObjects(prev => [...prev, 'habit_analysis']);
      }

      // Step 3: Get the analysis result
      const returnPayload = {
        object_name: 'habit_analysis',
        return_type: 'pretty_text'
      };

      const returnResponse = await fetch(`${API_BASE}/return_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(returnPayload)
      });

      const returnResult = await returnResponse.json();
      logApiCall('POST', '/return_data', returnPayload, returnResult);

      setCurrentSuggestion(returnResult.value);
      setShowSuggestion(true);
      
    } catch (error) {
      console.error('Error analyzing habit:', error);
      logApiCall('ERROR', 'analyzeHabit', { error: error.message }, null);
      alert('Sorry, there was an error analyzing your habit. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteAllObjects = async () => {
    for (const objectName of createdObjects) {
      try {
        const response = await fetch(`${API_BASE}/objects/${objectName}`, {
          method: 'DELETE',
          headers: API_HEADERS
        });
        const result = await response.json();
        logApiCall('DELETE', `/objects/${objectName}`, {}, result);
      } catch (error) {
        logApiCall('ERROR', `/objects/${objectName}`, { error: error.message }, null);
      }
    }
    setCreatedObjects([]);
  };

  const addHabit = (habitText) => {
    const newHabitObj = {
      id: Date.now(),
      text: habitText,
      createdDate: new Date().toISOString().split('T')[0],
      completions: {}
    };
    setHabits([...habits, newHabitObj]);
    setNewHabit('');
    setShowSuggestion(false);
    setCurrentSuggestion('');
  };

  const toggleCompletion = (habitId, date) => {
    setHabits(habits.map(habit => {
      if (habit.id === habitId) {
        const newCompletions = { ...habit.completions };
        newCompletions[date] = !newCompletions[date];
        return { ...habit, completions: newCompletions };
      }
      return habit;
    }));
  };

  const deleteHabit = (habitId) => {
    setHabits(habits.filter(habit => habit.id !== habitId));
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getStreak = (habit) => {
    const today = new Date();
    let streak = 0;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (habit.completions[dateStr]) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-white flex-1">
            ð± Tiny Habits Tracker
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-primary-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? 'âï¸' : 'ð'}
          </button>
        </div>

        {/* Debug Controls */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setShowApiLogs(!showApiLogs)}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            aria-label="Toggle API logs"
          >
            {showApiLogs ? 'Hide' : 'Show'} API Logs
          </button>
          <button
            onClick={deleteAllObjects}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            aria-label="Delete all API objects"
          >
            Delete Objects ({createdObjects.length})
          </button>
        </div>

        {/* API Logs */}
        {showApiLogs && (
          <div className="mb-6 bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 max-h-64 overflow-y-auto">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">API Call Logs</h3>
            {apiLogs.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-sm">No API calls yet</p>
            ) : (
              <div className="space-y-2">
                {apiLogs.map(log => (
                  <div key={log.id} className="text-xs bg-white dark:bg-gray-700 p-2 rounded border-l-4 border-primary-500">
                    <div className="font-mono text-primary-600 dark:text-primary-400">
                      {log.method} {log.endpoint}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 mt-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Details</summary>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        Payload: {JSON.stringify(log.payload, null, 2)}
                        Response: {JSON.stringify(log.response, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add New Habit Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Add New Habit</h3>
          <div className="space-y-4">
            <textarea
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder="What habit would you like to build? (e.g., 'I want to exercise more')"
              className="w-full min-h-[100px] p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:border-primary-500 focus:outline-none transition-colors bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              aria-label="Enter your habit goal"
            />
            <button
              onClick={analyzeHabit}
              disabled={!newHabit.trim() || isAnalyzing}
              className="w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-primary-200 dark:focus:ring-primary-800 disabled:cursor-not-allowed"
              aria-label="Get AI habit suggestion"
            >
              {isAnalyzing ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="spinner"></div>
                  ð¤ Analyzing...
                </div>
              ) : (
                'ð Get Tiny Habit Suggestion'
              )}
            </button>
          </div>
        </div>

        {/* AI Suggestion */}
        {showSuggestion && (
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-2xl p-6 mb-6 fade-in">
            <h4 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              ð¡ Tiny Habit Suggestion
            </h4>
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed mb-6">
              {currentSuggestion}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => addHabit(newHabit)}
                className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-green-200 dark:focus:ring-green-800"
                aria-label="Use original habit goal"
              >
                â Use Original Goal
              </button>
              <button
                onClick={() => {
                  const lines = currentSuggestion.split('\n');
                  const tinyVersion = lines.find(line => 
                    line.toLowerCase().includes('tiny') && (line.includes('-') || line.includes('â¢'))
                  );
                  if (tinyVersion) {
                    const cleanVersion = tinyVersion.replace(/^[-â¢]\s*/, '').trim();
                    addHabit(cleanVersion);
                  } else {
                    addHabit(newHabit);
                  }
                }}
                className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-orange-200 dark:focus:ring-orange-800"
                aria-label="Use AI suggested tiny version"
              >
                ð¯ Use Tiny Version
              </button>
            </div>
          </div>
        )}

        {/* Habits List */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            My Habits ({habits.length})
          </h3>
          
          {habits.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-6xl mb-4">ð±</div>
              <p className="text-gray-600 dark:text-gray-400">
                No habits yet. Add your first tiny habit above!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {habits.map(habit => (
                <div key={habit.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 fade-in">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 dark:text-white text-lg mb-2">
                        {habit.text}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-orange-500">ð¥</span>
                        <span>{getStreak(habit)} day streak</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800"
                      aria-label="Delete habit"
                    >
                      â
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Today:</span>
                    <button
                      onClick={() => toggleCompletion(habit.id, getTodayDate())}
                      className={`py-2 px-6 rounded-full font-semibold transition-all focus:outline-none focus:ring-4 ${
                        habit.completions[getTodayDate()]
                          ? 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-200 dark:focus:ring-green-800'
                          : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 focus:ring-gray-200 dark:focus:ring-gray-600'
                      }`}
                      aria-label={habit.completions[getTodayDate()] ? 'Mark as not done' : 'Mark as done'}
                    >
                      {habit.completions[getTodayDate()] ? 'â Done!' : 'â­ Mark Done'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-8 text-gray-500 dark:text-gray-400 text-sm">
          Based on BJ Fogg's Tiny Habits method ð
        </div>
      </div>
    </div>
  );
};

export default TinyHabitsTracker;
