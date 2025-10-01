import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

const fetchCSRFToken = async () => {
  try {
    await axios.get('/api/users/csrf/');
  } catch (err) {
    console.error('Error fetching CSRF token:', err);
  }
};

function Login({ setUser }) {
  useEffect(() => {
    fetchCSRFToken();
  }, []);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', email: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const response = await axios.post('/api/users/login/', { username: formData.username, password: formData.password });
        setUser(response.data.user);
        navigate('/chat');
      } else {
        await axios.post('/api/users/register/', formData);
        const loginResponse = await axios.post('/api/users/login/', { username: formData.username, password: formData.password });
        setUser(loginResponse.data.user);
        navigate('/chat');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🏥 MediBot</h1>
        <p className="subtitle">Your AI-Powered Healthcare Assistant</p>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required />
          {!isLogin && <><input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          <input type="text" placeholder="First Name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
          <input type="text" placeholder="Last Name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></>}
          <input type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
          {error && <div className="error">{error}</div>}
          <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
        </form>
        <p className="toggle-auth" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </p>
      </div>
    </div>
  );
}

function Chat({ user, setUser }) {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/api/chatbot/conversations/');
      setConversations(response.data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await axios.post('/api/chatbot/conversations/create/', { title: 'New Conversation' });
      setConversations([response.data, ...conversations]);
      selectConversation(response.data.id);
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  };

  const selectConversation = async (id) => {
    try {
      const response = await axios.get(`/api/chatbot/conversations/${id}/`);
      setCurrentConversation(response.data);
      setMessages(response.data.messages || []);
    } catch (err) {
      console.error('Error fetching conversation:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentConversation) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`/api/chatbot/conversations/${currentConversation.id}/message/`, { content: inputMessage });
      setMessages([...messages, response.data.user_message, response.data.ai_message]);
      setInputMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/users/logout/');
      setUser(null);
      navigate('/');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>MediBot</h2>
          <button onClick={createNewConversation}>+ New Chat</button>
        </div>
        <div className="conversations-list">
          {conversations.map(conv => (
            <div key={conv.id} className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`} onClick={() => selectConversation(conv.id)}>
              <div className="conversation-title">{conv.title}</div>
              <div className="conversation-count">{conv.message_count} messages</div>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">👤 {user.username}</div>
          <button onClick={handleLogout}>Logout</button>
          <Link to="/admin" className="admin-link">📊 Admin Dashboard</Link>
        </div>
      </div>
      <div className="chat-main">
        {currentConversation ? (
          <>
            <div className="messages-container">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.is_emergency && <span className="emergency-badge">⚠️ EMERGENCY</span>}
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && <div className="message assistant"><div className="message-content">Thinking...</div></div>}
            </div>
            <form className="input-container" onSubmit={sendMessage}>
              <input type="text" placeholder="Describe your symptoms or ask a health question..." value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} disabled={loading} />
              <button type="submit" disabled={loading}>Send</button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <h2>Welcome to MediBot! 🏥</h2>
            <p>Create a new conversation to start chatting with your AI healthcare assistant.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard({ user }) {
  const [stats, setStats] = useState({ total_users: 0, total_conversations: 0, total_messages: 0, emergency_count: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>📊 Admin Dashboard</h1>
        <button onClick={() => navigate('/chat')}>← Back to Chat</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.active_users}</div>
          <div className="stat-label">Active Users Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.total_conversations}</div>
          <div className="stat-label">Total Conversations</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.total_messages}</div>
          <div className="stat-label">Total Messages</div>
        </div>
        <div className="stat-card emergency">
          <div className="stat-number">{stats.emergency_count}</div>
          <div className="stat-label">Emergency Detections</div>
        </div>
      </div>
      <div className="admin-info">
        <h2>System Information</h2>
        <p>Logged in as: <strong>{user.username}</strong></p>
        <p>MediBot is actively monitoring health conversations and providing AI-powered assistance.</p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/chat" /> : <Login setUser={setUser} />} />
        <Route path="/chat" element={user ? <Chat user={user} setUser={setUser} /> : <Navigate to="/" />} />
        <Route path="/admin" element={user ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
