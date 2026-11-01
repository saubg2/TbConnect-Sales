'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  Sparkles,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Cpu,
  Volume2,
  Sliders,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';

export default function AgentsPage() {
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [instructions, setInstructions] = useState('');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [llmProvider, setLlmProvider] = useState('mock');
  const [llmModel, setLlmModel] = useState('mock-agent-v1');
  const [tone, setTone] = useState('');
  const [maxSentences, setMaxSentences] = useState(4);
  const [avoidPhrases, setAvoidPhrases] = useState<string[]>([]);
  const [newAvoidPhrase, setNewAvoidPhrase] = useState('');
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);
  const [newForbiddenTopic, setNewForbiddenTopic] = useState('');

  // Permissions
  const [allowPricing, setAllowPricing] = useState(false);
  const [allowContractTerms, setAllowContractTerms] = useState(false);
  const [allowDirectOutreach, setAllowDirectOutreach] = useState(true);
  const [requireReviewNewDomains, setRequireReviewNewDomains] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents?workspaceId=ws_default');
      const data = await res.json();
      if (data && data.agents && data.agents.length > 0) {
        setAgentsList(data.agents);
        loadAgentData(data.agents[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentData = (agent: any) => {
    setSelectedAgent(agent);
    setName(agent.name || '');
    setGoal(agent.goal || '');
    setInstructions(agent.instructions || '');
    setKnowledgeText(agent.knowledgeText || '');
    setLlmProvider(agent.llmProvider || 'mock');
    setLlmModel(agent.llmModel || 'mock-agent-v1');

    const voice = agent.voiceJson || {};
    setTone(voice.tone || 'professional, warm, concise');
    setMaxSentences(voice.maxSentences || 4);
    setAvoidPhrases(voice.avoidPhrases || ['synergy', 'touch base', 'low-hanging fruit']);
    setForbiddenTopics(voice.forbiddenTopics || ['commercial pricing quotes', 'legal commitments']);

    const perms = agent.permissionsJson || {};
    setAllowPricing(!!perms.allowCommercialPricing);
    setAllowContractTerms(!!perms.allowContractTerms);
    setAllowDirectOutreach(perms.allowDirectOutreach !== false);
    setRequireReviewNewDomains(!!perms.requireReviewForNewDomains);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        name,
        goal,
        instructions,
        knowledgeText,
        llmProvider,
        llmModel,
        voiceJson: {
          tone,
          maxSentences: Number(maxSentences),
          avoidPhrases,
          forbiddenTopics,
        },
        permissionsJson: {
          allowCommercialPricing: allowPricing,
          allowContractTerms,
          allowDirectOutreach,
          requireReviewForNewDomains: requireReviewNewDomains,
        },
      };

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          action: 'update',
          agentId: selectedAgent.id,
          data: payload,
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addAvoidPhrase = () => {
    if (newAvoidPhrase.trim() && !avoidPhrases.includes(newAvoidPhrase.trim())) {
      setAvoidPhrases([...avoidPhrases, newAvoidPhrase.trim()]);
      setNewAvoidPhrase('');
    }
  };

  const removeAvoidPhrase = (phrase: string) => {
    setAvoidPhrases(avoidPhrases.filter((p) => p !== phrase));
  };

  const addForbiddenTopic = () => {
    if (newForbiddenTopic.trim() && !forbiddenTopics.includes(newForbiddenTopic.trim())) {
      setForbiddenTopics([...forbiddenTopics, newForbiddenTopic.trim()]);
      setNewForbiddenTopic('');
    }
  };

  const removeForbiddenTopic = (topic: string) => {
    setForbiddenTopics(forbiddenTopics.filter((t) => t !== topic));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-300 bg-white sticky top-0 z-10 px-8 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition">
            ← Home
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/contacts" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Contacts
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-600" />
            <h1 className="text-lg font-black text-slate-900">Agent Studio</h1>
          </div>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/inbox" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Inbox
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/actions" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Actions
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/settings" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Settings
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Saved Successfully
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !selectedAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Identity, Goal & Knowledge */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Goal Card */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900">Goal & Operating Instructions</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Agent Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Core Goal</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Schedule discovery conversations with verified B2B partners"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                System Instructions & Behavior Rules
              </label>
              <textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-600 leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* Approved Knowledge Base */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-cyan-600" />
                <h2 className="text-base font-black text-slate-900">Approved Knowledge & Context</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">Factual Grounding Boundary</span>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Only factual claims explicitly confirmed here or in the relationship memory may be asserted in drafts.
            </p>

            <textarea
              rows={6}
              value={knowledgeText}
              onChange={(e) => setKnowledgeText(e.target.value)}
              placeholder="Enter approved product details, certified security specs, verified integration capabilities..."
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-cyan-600 leading-relaxed font-mono"
            />
          </div>

          {/* Voice & Style Profile */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <Volume2 className="w-5 h-5 text-violet-600" />
              <h2 className="text-base font-black text-slate-900">Voice Profile & Writing Style</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Tone & Persona</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Max Sentences Per Email</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={maxSentences}
                  onChange={(e) => setMaxSentences(Number(e.target.value))}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>
            </div>

            {/* Avoided Buzzwords / Phrases */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Avoided Buzzwords / Clichés</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {avoidPhrases.map((phrase) => (
                  <span
                    key={phrase}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-800 font-bold"
                  >
                    "{phrase}"
                    <button
                      onClick={() => removeAvoidPhrase(phrase)}
                      className="text-rose-400 hover:text-rose-800 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add phrase to avoid..."
                  value={newAvoidPhrase}
                  onChange={(e) => setNewAvoidPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAvoidPhrase()}
                  className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-medium"
                />
                <button
                  onClick={addAvoidPhrase}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border border-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Provider Selection & Safety Permissions */}
        <div className="space-y-6">
          {/* LLM Provider Selection */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <Cpu className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-slate-900">LLM Provider Selection</h2>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Active Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-600"
              >
                <option value="mock">Deterministic Mock (Testing & Zero-Cost)</option>
                <option value="mistral">Mistral AI (Native Structured JSON)</option>
                <option value="openai">OpenAI (GPT-4o Mini)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Model Name</label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="e.g. ministral-8b-latest"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 font-semibold">
              Provider conforms to <code className="text-amber-950 font-black">LLMProvider</code> contract with structured Zod verification.
            </div>
          </div>

          {/* Safety & Human Escalation Permissions */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black text-slate-900">Safety & Review Gates</h2>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              High-stakes commercial inquiries strictly require human sign-off before dispatch.
            </p>

            <div className="space-y-3.5 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPricing}
                  onChange={(e) => setAllowPricing(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-0"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">Autonomous Pricing Quotes</div>
                  <div className="text-xs text-slate-500 font-medium">
                    If unchecked, any price inquiry escalates to human review.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowContractTerms}
                  onChange={(e) => setAllowContractTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-0"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">Autonomous Contract Terms</div>
                  <div className="text-xs text-slate-500 font-medium">
                    If unchecked, legal statements require human sign-off.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDirectOutreach}
                  onChange={(e) => setAllowDirectOutreach(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">Allow Outbound Email Drafting</div>
                  <div className="text-xs text-slate-500 font-medium">
                    Permit agent to queue outreach actions for active relationships.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireReviewNewDomains}
                  onChange={(e) => setRequireReviewNewDomains(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-0"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">Require Review For New Domains</div>
                  <div className="text-xs text-slate-500 font-medium">
                    Escalate actions when contacting previously unseen organization domains.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
