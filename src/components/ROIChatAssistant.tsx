import { useState, useRef, useEffect } from 'react';
import type { SiteResult } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  siteResult: SiteResult;
}

const SUGGESTED = [
  'When will this site break even?',
  'What grants are available?',
  'How can I reduce competitor risk?',
  'What charger type should I choose?',
];

function buildContext(site: SiteResult): string {
  return [
    `Address: ${site.address}`,
    `Property type: ${site.propertyType}`,
    `Charger type: ${site.chargerType} × ${site.targetChargers}`,
    `Site score: ${site.siteScore}/100`,
    `Monthly net revenue: $${site.roiCalculation.monthlyNet.toLocaleString()}`,
    `Break-even: ${Math.round(site.roiCalculation.breakEvenMonths)} months`,
    `Year-1 profit: $${site.roiCalculation.year1Profit.toLocaleString()}`,
    `Year-3 revenue: $${site.roiCalculation.year3Revenue.toLocaleString()}`,
    `EV demand level: ${site.evDemandLevel}`,
    `Competitor risk: ${site.competitorRisk}`,
    site.aiInsight ? `AI insight: ${site.aiInsight}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function ROIChatAssistant({ siteResult }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your site analysis assistant for **${siteResult.address.split(',')[0]}**. Ask me anything about the ROI, break-even, grants, or charger recommendations.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          systemContext: buildContext(siteResult),
        }),
        signal: AbortSignal.timeout(12000),
      });

      const data = await res.json() as { reply: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not reach the AI. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full text-white shadow-lg transition-transform hover:scale-105 focus:outline-none z-50"
        style={{ backgroundColor: '#2563EB' }}
        aria-label="Open AI chat assistant"
      >
        <span className="text-lg">💬</span>
        <span className="text-sm font-semibold hidden sm:block">Ask AI</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col"
      style={{ maxHeight: '520px', backgroundColor: 'white' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-2xl"
        style={{ backgroundColor: '#1A2332' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Site AI Assistant</p>
            <p className="text-xs leading-tight" style={{ color: '#93C5FD' }}>
              {siteResult.address.split(',')[0].slice(0, 28)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close chat"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-snug"
              style={
                m.role === 'user'
                  ? { backgroundColor: '#2563EB', color: 'white' }
                  : { backgroundColor: '#F1F5F9', color: '#1A2332' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl text-sm bg-gray-100 text-gray-400">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs px-2 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about ROI, grants, risks…"
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#2563EB' } as React.CSSProperties}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#2563EB' }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
