import { useState, useEffect, useRef } from 'react';
import { getLocalIdentity } from '../lib/identity';
import { apiFetch } from '../lib/api';
import { Subtask, TaxEffect, Tone } from '../types';
import { MessageSquare, Send, Sparkles, Flame, ThumbsUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

interface CompanionHubProps {
  subtasks: Subtask[];
  taxes: TaxEffect[];
  virtualTime: number;
  tone: Tone;
}

type Mood = 'happy' | 'encouraging' | 'neutral' | 'annoyed' | 'angry' | 'fiery';

export function CompanionHub({ subtasks, taxes, virtualTime, tone }: CompanionHubProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState<Mood>('neutral');
  const [statusLabel, setStatusLabel] = useState('Monitoring');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('last_minute_saver_chat');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved chat', e);
      }
    } else {
      // Welcome message
      const welcome: Message = {
        id: 'welcome',
        role: 'model',
        content: "Hello! I am Quorum, your AI Accountability Engine. I monitor your execution, track focus consistency, and manage structural penalties to ensure you meet your commitments.\n\nType below or use the quick actions to analyze your progress.",
        timestamp: Date.now()
      };
      setMessages([welcome]);
    }
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('last_minute_saver_chat', JSON.stringify(messages));
    }
  }, [messages]);

  // Adjust avatar mood based on active penalties automatically
  useEffect(() => {
    const isMaxFirmness = taxes.some(t => t.type === 'max_firmness' && t.active);
    const isShorten = taxes.some(t => t.type === 'shorten_next_block' && t.active);
    const isLocked = taxes.some(t => t.type === 'lock_element' && t.active);

    if (isMaxFirmness) {
      setMood('fiery');
      setStatusLabel('System Locked');
    } else if (isShorten || isLocked) {
      setMood('annoyed');
      setStatusLabel('Alert State');
    } else {
      // Default fallback if no custom response is loading
      if (!loading) {
        const missedCount = subtasks.filter(s => s.status === 'missed').length;
        const completedCount = subtasks.filter(s => s.status === 'completed').length;
        if (missedCount > 0 && completedCount === 0) {
          setMood('annoyed');
          setStatusLabel('Attention Required');
        } else if (completedCount > 0 && missedCount === 0) {
          setMood('happy');
          setStatusLabel('Optimal Flow');
        } else {
          setMood('neutral');
          setStatusLabel('Active Monitoring');
        }
      }
    }
  }, [taxes, subtasks, loading]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    if (!customText) {
      setInput('');
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Optimization: Template-based responses for simple nudges to save API quota
    if (textToSend.toLowerCase().includes('nudge me')) {
      let nudgeText = "Keep pushing forward! You've got this.";
      let nudgeMood: Mood = 'encouraging';
      let nudgeStatus = 'Cheering';

      if (tone === 'gentle') {
        nudgeText = "Take a deep breath. Even a small step counts! I'm right here supporting you.";
      } else if (tone === 'firm') {
        nudgeText = "Focus! The clock doesn't stop for anyone. Let's clear that next block now.";
        nudgeMood = 'annoyed';
        nudgeStatus = 'Nudging';
      } else if (tone === 'maximum_firmness') {
        nudgeText = "STOP PROCRASTINATING. Every second you wait is a second closer to another tax! ACT NOW.";
        nudgeMood = 'fiery';
        nudgeStatus = 'ROASTING';
      }

      const modelMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'model',
        content: nudgeText,
        timestamp: Date.now()
      };
      
      // Artificial delay for realism
      setTimeout(() => {
        setMessages(prev => [...prev, modelMessage]);
        setMood(nudgeMood);
        setStatusLabel(nudgeStatus);
      }, 600);
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getLocalIdentity(),
          'x-timezone-offset': new Date().getTimezoneOffset().toString()
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          virtualTime
        })
      });

      if (res.ok) {
        const data = await res.json();
        const modelMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'model',
          content: data.text,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, modelMessage]);
        setMood(data.mood);
        setStatusLabel(data.statusLabel);
      } else {
        throw new Error('Failed to fetch companion response');
      }
    } catch (e) {
      console.error(e);
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'model',
        content: "Oops! I lost connection to my central intelligence core. Make sure your API Key is valid or retry in a second.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      setMood('neutral');
      setStatusLabel('Disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear conversation history?')) {
      const welcome: Message = {
        id: 'welcome',
        role: 'model',
        content: "Hello! I am your AI Productivity Companion. I schedule your tasks, track your focus, and enforce accountability penalties if you slip up.\n\nType below or click **Nudge Me** or **Critique Progress** to see how you're tracking!",
        timestamp: Date.now()
      };
      setMessages([welcome]);
      localStorage.removeItem('last_minute_saver_chat');
    }
  };

  // Mini helper to render simple formatting (bold, bullet lists) beautifully without full react-markdown
  const renderMessageContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      // Bullet point lines
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const cleaned = line.replace(/^[-*]\s+/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-xs leading-relaxed mt-1">
            {renderInlineFormatting(cleaned)}
          </li>
        );
      }
      // Double star bold text parsing
      if (line.trim() === '') return <div key={idx} className="h-2" />;
      return (
        <p key={idx} className="text-xs leading-relaxed mt-1.5 first:mt-0">
          {renderInlineFormatting(line)}
        </p>
      );
    });
  };

  const renderInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Abstract status indicator replacing the literal face
  const renderAvatar = () => {
    let pulseColor = "bg-sky-400";
    let ringColor = "ring-sky-400/30";
    let shadowColor = "shadow-sky-400/20";

    switch (mood) {
      case 'happy':
        pulseColor = "bg-emerald-400";
        ringColor = "ring-emerald-400/30";
        shadowColor = "shadow-emerald-400/20";
        break;
      case 'annoyed':
      case 'encouraging':
        pulseColor = "bg-amber-400";
        ringColor = "ring-amber-400/30";
        shadowColor = "shadow-amber-400/20";
        break;
      case 'angry':
      case 'fiery':
        pulseColor = "bg-red-500";
        ringColor = "ring-red-500/40";
        shadowColor = "shadow-red-500/30";
        break;
    }

    return (
      <div className="flex flex-col items-center">
        <div className={`relative w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-lg ${shadowColor}`}>
          <div className={`w-3 h-3 rounded-full ${pulseColor} animate-pulse relative`}>
            <div className={`absolute -inset-2 rounded-full ring-4 ${ringColor} animate-ping opacity-60`} />
          </div>
        </div>

        <div className="mt-3 text-center">
          <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md border ${
            mood === 'fiery' ? 'bg-red-600 border-red-700 text-white animate-pulse' :
            'bg-slate-50 border-slate-100 text-slate-500'
          }`}>
            {statusLabel}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white flex flex-col h-full overflow-hidden">
      {/* Messages Window */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[12px] shadow-sm border leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white border-slate-800 rounded-br-none'
                    : 'bg-slate-50 text-slate-800 border-slate-100 rounded-bl-none'
                }`}>
                  {renderMessageContent(msg.content)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Action Suggestion pills */}
        <div className="px-3 py-2 bg-slate-50/50 border-y border-slate-100 flex items-center gap-2 overflow-x-auto whitespace-nowrap shrink-0 scrollbar-none">
          <button
            onClick={() => handleSendMessage("Nudge me! Let's get moving.")}
            disabled={loading}
            className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            Nudge Me
          </button>
          <button
            onClick={() => handleSendMessage("Critique my progress. How am I doing overall?")}
            disabled={loading}
            className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <ThumbsUp className="w-3 h-3 text-emerald-500" />
            Critique Progress
          </button>
          {taxes.length > 0 && (
            <button
              onClick={() => handleSendMessage("Explain active penalties. What taxes am I currently suffering?")}
              disabled={loading}
              className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Flame className="w-3 h-3 text-red-500 animate-pulse" />
              Explain Penalty
            </button>
          )}
        </div>

        {/* Text Input Footer */}
        <div className="p-4 bg-white flex gap-2 items-center shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder="Communicate with Quorum..."
            disabled={loading}
            className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
