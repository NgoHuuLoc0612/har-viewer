'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles, ChevronDown, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HarAnalysis } from '@har-viewer/shared';
import { groqApi } from '@/lib/api';
import { useHarStore } from '@/store/har-store';
import { downloadFile } from '@/lib/utils';

interface AiViewProps {
  uuid: string;
  analysis: HarAnalysis;
}

const ANALYSIS_TYPES = [
  { id: 'general', label: '📊 General Analysis', desc: 'Comprehensive overview' },
  { id: 'performance', label: '⚡ Performance Analysis', desc: 'Load times & bottlenecks' },
  { id: 'security', label: '🔒 Security Analysis', desc: 'Vulnerabilities & risks' },
];

const SUGGESTED_PROMPTS = [
  "What are the top 3 performance bottlenecks in this HAR file?",
  "Identify any security vulnerabilities or concerns.",
  "Which domains are contributing the most to load time?",
  "Are there any requests that should be cached but aren't?",
  "What compression improvements could be made?",
  "Summarize the API call patterns in this application.",
  "Are there any duplicate or redundant requests?",
  "What is causing the high TTFB on certain requests?",
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

export function AiView({ uuid, analysis }: AiViewProps) {
  const { groqModel, setGroqModel, groqModels, aiChatHistory, addAiMessage, clearAiHistory } = useHarStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState('general');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuickAnalysis = async (type: string) => {
    const prompts: Record<string, string> = {
      general: 'Provide a comprehensive analysis of this HAR file including performance, security, and optimization opportunities.',
      performance: 'Analyze the performance characteristics of this HAR file. Identify bottlenecks, slow requests, missing optimizations, and provide specific recommendations.',
      security: 'Perform a security analysis of this HAR file. Check for insecure connections, missing security headers, cookie security issues, and any other vulnerabilities.',
    };

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: prompts[type] };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const result = await groqApi.analyze(uuid, { model: groqModel, analysisType: type, prompt: prompts[type] });
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, content: result.result, loading: false } : m));
      toast.success(`Analysis complete`, { description: `${result.tokensUsed} tokens used` });
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== loadingMsg.id));
      toast.error('Analysis failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    const historyMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const result = await groqApi.chat(uuid, historyMsgs, groqModel);
      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id ? { ...m, content: result.result, loading: false } : m
      ));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== loadingMsg.id));
      toast.error('Failed to get response', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const exportChat = () => {
    const text = messages.map(m => `### ${m.role === 'user' ? 'You' : 'AI'}\n${m.content}`).join('\n\n---\n\n');
    downloadFile(text, 'har-ai-analysis.md', 'text/markdown');
    toast.success('Chat exported');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)' }}>
            <Bot size={15} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Analysis</span>
            <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>powered by Groq</span>
          </div>
        </div>

        {/* Model selector */}
        <div className="relative ml-4">
          <button onClick={() => setModelMenuOpen(!modelMenuOpen)}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Sparkles size={11} style={{ color: 'var(--color-accent)' }} />
            {groqModel}
            <ChevronDown size={11} />
          </button>
          {modelMenuOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 mt-1 rounded-lg shadow-2xl z-50 overflow-hidden"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', minWidth: 260, maxHeight: 280, overflowY: 'auto' }}>
              {groqModels.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading models...</div>
              ) : (
                groqModels.map((model: any) => (
                  <button key={model.id}
                    onClick={() => { setGroqModel(model.id); setModelMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{
                      background: groqModel === model.id ? 'var(--color-accent-bg)' : 'transparent',
                      color: groqModel === model.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}>
                    <div className="font-medium">{model.id}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {model.owned_by} · {(model.context_window / 1000).toFixed(0)}K ctx
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button onClick={exportChat} className="p-1.5 rounded"
                style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <Download size={13} />
              </button>
              <button onClick={() => setMessages([])} className="p-1.5 rounded"
                style={{ color: 'var(--color-error)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick analysis buttons */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Quick Analysis:</span>
        {ANALYSIS_TYPES.map(at => (
          <button key={at.id} onClick={() => handleQuickAnalysis(at.id)} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {at.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)' }}>
                <Bot size={28} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                AI-Powered HAR Analysis
              </h3>
              <p className="text-xs max-w-md" style={{ color: 'var(--color-text-muted)' }}>
                Ask questions about your HAR file or use the quick analysis buttons above.
                The AI has access to all request data, timings, and statistics.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt}
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="text-xs px-3 py-2.5 rounded-lg text-left transition-colors"
                  style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                style={{
                  background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                }}>
                {msg.role === 'user'
                  ? <User size={14} style={{ color: '#000' }} />
                  : <Bot size={14} style={{ color: 'var(--color-accent)' }} />}
              </div>

              <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="rounded-xl px-4 py-3"
                  style={{
                    background: msg.role === 'user' ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--color-accent-glow)' : 'var(--color-border)'}`,
                  }}>
                  {msg.loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Analyzing with {groqModel}...</span>
                    </div>
                  ) : msg.role === 'user' ? (
                    <p className="text-xs" style={{ color: 'var(--color-text-primary)' }}>{msg.content}</p>
                  ) : (
                    <div className="prose-xs max-w-none"
                      style={{ color: 'var(--color-text-primary)' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: ({ children, className }) => (
                            <code className={className}
                              style={{ background: 'var(--color-surface-3)', padding: '1px 4px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, overflow: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                              {children}
                            </pre>
                          ),
                          h1: ({ children }) => <h1 style={{ color: 'var(--color-accent)', fontSize: 14, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h1>,
                          h2: ({ children }) => <h2 style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600, margin: '10px 0 4px' }}>{children}</h2>,
                          h3: ({ children }) => <h3 style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h3>,
                          ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '4px 0', fontSize: 12 }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ paddingLeft: 16, margin: '4px 0', fontSize: 12 }}>{children}</ol>,
                          li: ({ children }) => <li style={{ color: 'var(--color-text-secondary)', marginBottom: 2 }}>{children}</li>,
                          p: ({ children }) => <p style={{ color: 'var(--color-text-secondary)', margin: '4px 0', fontSize: 12, lineHeight: 1.6 }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{children}</strong>,
                          table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>{children}</table>,
                          th: ({ children }) => <th style={{ border: '1px solid var(--color-border)', padding: '4px 8px', background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', textAlign: 'left' }}>{children}</th>,
                          td: ({ children }) => <td style={{ border: '1px solid var(--color-border)', padding: '4px 8px', color: 'var(--color-text-secondary)' }}>{children}</td>,
                        }}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <div className="flex items-end gap-2 rounded-xl p-2"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your HAR file... (Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none outline-none text-sm bg-transparent"
            style={{ color: 'var(--color-text-primary)', lineHeight: 1.5, maxHeight: 120 }}
          />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            className="p-2.5 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'var(--color-accent)', color: '#000', flexShrink: 0 }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Using {groqModel} · Press Enter to send, Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
