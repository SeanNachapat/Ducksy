"use client"
import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
      MessageSquare,
      Send,
      Bot,
      Terminal,
      Cpu,
      Sliders,
      Sparkles,
      Check,
      User,
      AlertCircle,
      Code,
      Search,
      Loader2
} from "lucide-react"
import { useSettings } from "@/hooks/SettingsContext"

const AGENTS = [
      {
            id: "general",
            name: "General Assistant",
            emoji: "🤖",
            description: "Balanced AI agent for reasoning, explanations, and creative writing.",
            systemPrompt: "You are a helpful, professional AI assistant. Provide structured, clean answers.",
            avatarColor: "bg-amber-500/10 border-amber-500/20 text-amber-500"
      },
      {
            id: "research",
            name: "Research Specialist",
            emoji: "🔍",
            description: "Agent optimized for information gathering, synthesis, and deep research.",
            systemPrompt: "You are a research agent. Structure findings with clear bullet points and references.",
            avatarColor: "bg-blue-500/10 border-blue-500/20 text-blue-400"
      },
      {
            id: "coder",
            name: "Code Debugger",
            emoji: "💻",
            description: "Advanced coding model configured with syntax tools and debugger access.",
            systemPrompt: "You are a technical programmer. Explain adjustments, print code blocks cleanly, and list fixes.",
            avatarColor: "bg-purple-500/10 border-purple-500/20 text-purple-400"
      }
]

export default function AgentChatPage() {
      const { settings } = useSettings()
      const [selectedAgent, setSelectedAgent] = useState(AGENTS[0])
      const [messages, setMessages] = useState([
            {
                  id: "welcome",
                  role: "assistant",
                  content: "Hello! I am your General Assistant. How can I help you in the workspace today?",
                  agent: AGENTS[0]
            }
      ])
      const [inputMessage, setInputMessage] = useState("")
      const [isLoading, setIsLoading] = useState(false)
      const [temperature, setTemperature] = useState(0.7)
      const [customPrompt, setCustomPrompt] = useState("")
      const [toolLogs, setToolLogs] = useState([])
      const messagesEndRef = useRef(null)

      const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }

      useEffect(() => {
            scrollToBottom()
      }, [messages, isLoading, toolLogs])

      const handleAgentChange = (agent) => {
            setSelectedAgent(agent)
            setCustomPrompt(agent.systemPrompt)
            setMessages([
                  {
                        id: `welcome-${agent.id}`,
                        role: "assistant",
                        content: `Hello! I am your ${agent.name}. How can I assist you with your tasks today?`,
                        agent: agent
                  }
            ])
            setToolLogs([])
      }

      useEffect(() => {
            setCustomPrompt(selectedAgent.systemPrompt)
      }, [])

      const handleSend = async (e) => {
            e.preventDefault()
            if (!inputMessage.trim() || isLoading) return

            const userText = inputMessage.trim()
            setInputMessage("")

            const userMsg = {
                  id: `user-${Date.now()}`,
                  role: "user",
                  content: userText
            }
            setMessages(prev => [...prev, userMsg])
            setIsLoading(true)
            setToolLogs([])

            // Simulate agent thoughts and tool calls based on agent type
            const logSteps = []
            if (selectedAgent.id === "research") {
                  logSteps.push({ tool: "web_search", query: userText, status: "running" })
            } else if (selectedAgent.id === "coder") {
                  logSteps.push({ tool: "locate_syntax", query: "Scanning workspace files...", status: "running" })
            } else {
                  logSteps.push({ tool: "read_memory", query: "Fetching session logs context...", status: "running" })
            }

            setToolLogs(logSteps)

            // Step 1 log timeout
            await new Promise(resolve => setTimeout(resolve, 800))
            setToolLogs(prev => prev.map((step, idx) => idx === 0 ? { ...step, status: "completed" } : step))

            // Step 2 log timeout
            if (selectedAgent.id === "research") {
                  setToolLogs(prev => [...prev, { tool: "fetch_sources", query: "Extracting details from Google search...", status: "running" }])
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  setToolLogs(prev => prev.map((step, idx) => idx === 1 ? { ...step, status: "completed" } : step))
            } else if (selectedAgent.id === "coder") {
                  setToolLogs(prev => [...prev, { tool: "run_compiler", query: "Validating code compilation logic...", status: "running" }])
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  setToolLogs(prev => prev.map((step, idx) => idx === 1 ? { ...step, status: "completed" } : step))
            }

            try {
                  // Connect to express server chat route
                  const isProd = process.env.NODE_ENV === 'production'
                  const serverUrl = isProd ? "http://localhost:8080" : "http://localhost:8080"
                  
                  const response = await fetch(`${serverUrl}/api/chat`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                              context: customPrompt || selectedAgent.systemPrompt,
                              message: userText,
                              history: messages.slice(-4).map(m => ({
                                    role: m.role,
                                    content: m.content
                              })),
                              settings: {
                                    temperature: temperature
                              }
                        })
                  })

                  if (response.ok) {
                        const result = await response.json()
                        const assistantMsg = {
                              id: `assistant-${Date.now()}`,
                              role: "assistant",
                              content: result.data || "No response received.",
                              agent: selectedAgent
                        }
                        setMessages(prev => [...prev, assistantMsg])
                  } else {
                        throw new Error("Failed to contact agent server.")
                  }
            } catch (err) {
                  setMessages(prev => [...prev, {
                        id: `error-${Date.now()}`,
                        role: "assistant",
                        content: `⚠️ Error contacting the agent server: ${err.message}. Please verify the backend server is running.`,
                        agent: selectedAgent,
                        isError: true
                  }])
            } finally {
                  setIsLoading(false)
                  setToolLogs([])
            }
      }

      return (
            <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] relative overflow-hidden">
                  {/* cover banner */}
                  <div className="h-40 w-full relative bg-gradient-to-r from-purple-900/40 via-neutral-900 to-amber-950/20 flex-shrink-0">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
                        <div className="absolute bottom-6 left-8 flex items-end gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-3xl shadow-xl">
                                    🤖
                              </div>
                              <div>
                                    <h1 className="text-2xl font-bold text-white leading-tight">Agent Playground</h1>
                                    <p className="text-neutral-400 text-xs mt-1">Deploy specialized agents equipped with automated tool configurations.</p>
                              </div>
                        </div>
                  </div>

                  {/* Main Grid */}
                  <div className="flex-1 flex overflow-hidden">
                        {/* Left Panel: Settings */}
                        <aside className="w-80 border-r border-white/5 bg-[#171717]/60 flex flex-col overflow-y-auto p-6 space-y-6 flex-shrink-0">
                              <div>
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                          <Bot className="w-3.5 h-3.5" />
                                          Select Agent
                                    </h3>
                                    <div className="space-y-2">
                                          {AGENTS.map((agent) => (
                                                <button
                                                      key={agent.id}
                                                      onClick={() => handleAgentChange(agent)}
                                                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedAgent.id === agent.id
                                                            ? "bg-white/5 border-white/10 text-neutral-200"
                                                            : "bg-transparent border-transparent hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                                                            }`}
                                                >
                                                      <div className="flex items-center gap-2.5">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border shrink-0 ${agent.avatarColor}`}>
                                                                  {agent.emoji}
                                                            </div>
                                                            <div className="truncate">
                                                                  <h4 className="text-xs font-bold leading-none">{agent.name}</h4>
                                                                  <p className="text-[10px] text-neutral-500 mt-1 line-clamp-1">{agent.description}</p>
                                                            </div>
                                                      </div>
                                                </button>
                                          ))}
                                    </div>
                              </div>

                              <span className="h-px bg-white/5" />

                              {/* Configurations */}
                              <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                          <Sliders className="w-3.5 h-3.5" />
                                          Parameters
                                    </h3>
                                    
                                    <div className="space-y-1.5">
                                          <div className="flex items-center justify-between text-xs">
                                                <span className="text-neutral-400">Temperature</span>
                                                <span className="font-mono text-neutral-500">{temperature}</span>
                                          </div>
                                          <input
                                                type="range"
                                                min="0.1"
                                                max="1.0"
                                                step="0.05"
                                                value={temperature}
                                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                          />
                                    </div>

                                    <div className="space-y-2">
                                          <label className="text-xs text-neutral-400">System Prompt</label>
                                          <textarea
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                className="w-full h-36 bg-neutral-900 border border-white/5 hover:border-white/10 focus:border-amber-500/50 rounded-xl p-3 text-xs text-neutral-300 resize-none focus:outline-none transition-all placeholder-neutral-600 custom-scrollbar"
                                                placeholder="Custom system instructions..."
                                          />
                                    </div>
                              </div>
                        </aside>

                        {/* Right Chat Canvas */}
                        <main className="flex-1 flex flex-col bg-[#1c1c1c] overflow-hidden relative">
                              {/* Messages list */}
                              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                    <div className="max-w-2xl mx-auto space-y-6">
                                          {messages.map((msg) => (
                                                <motion.div
                                                      key={msg.id}
                                                      initial={{ opacity: 0, y: 8 }}
                                                      animate={{ opacity: 1, y: 0 }}
                                                      className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                      {msg.role === 'assistant' && (
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 text-base ${msg.agent?.avatarColor || 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                                  {msg.agent?.emoji || '🤖'}
                                                            </div>
                                                      )}

                                                      <div className={`max-w-[85%] rounded-2xl p-4 border text-sm leading-relaxed ${msg.role === 'user'
                                                            ? 'bg-neutral-800 border-white/5 text-neutral-100 rounded-tr-none'
                                                            : msg.isError
                                                                  ? 'bg-red-500/5 border-red-500/10 text-red-400 rounded-tl-none'
                                                                  : 'bg-neutral-900/40 border-white/5 text-neutral-200 rounded-tl-none'
                                                            }`}
                                                      >
                                                            {msg.role === 'assistant' && (
                                                                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1.5">
                                                                        {msg.agent?.name || 'Assistant'}
                                                                  </div>
                                                            )}
                                                            <div className="whitespace-pre-wrap select-text selection:bg-amber-500/30">
                                                                  {msg.content}
                                                            </div>
                                                      </div>

                                                      {msg.role === 'user' && (
                                                            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-white/5 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                                                                  <User className="w-4 h-4 text-neutral-400" />
                                                            </div>
                                                      )}
                                                </motion.div>
                                          ))}

                                          {/* Tool execution logs / thoughts */}
                                          {isLoading && toolLogs.length > 0 && (
                                                <motion.div
                                                      initial={{ opacity: 0 }}
                                                      animate={{ opacity: 1 }}
                                                      className="flex gap-4 justify-start"
                                                >
                                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 text-base animate-pulse ${selectedAgent.avatarColor}`}>
                                                            {selectedAgent.emoji}
                                                      </div>
                                                      <div className="max-w-[85%] rounded-2xl p-4 bg-neutral-900/30 border border-white/5 text-xs text-neutral-400 space-y-2 rounded-tl-none w-full">
                                                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1.5 flex items-center gap-1.5">
                                                                  <Terminal className="w-3 h-3" />
                                                                  Agent Tools Active
                                                            </div>
                                                            <div className="space-y-1.5 font-mono text-[11px]">
                                                                  {toolLogs.map((log, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2">
                                                                              <span className="text-amber-500">[{log.tool}]</span>
                                                                              <span className="text-neutral-300">{log.query}</span>
                                                                              {log.status === 'running' ? (
                                                                                    <span className="text-yellow-500 animate-pulse">● running</span>
                                                                              ) : (
                                                                                    <span className="text-green-500">● success</span>
                                                                              )}
                                                                        </div>
                                                                  ))}
                                                            </div>
                                                      </div>
                                                </motion.div>
                                          )}

                                          {/* Loader */}
                                          {isLoading && toolLogs.length === 0 && (
                                                <div className="flex gap-4 justify-start">
                                                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center animate-spin shrink-0">
                                                            <Loader2 className="w-4 h-4 text-amber-500" />
                                                      </div>
                                                </div>
                                          )}

                                          <div ref={messagesEndRef} />
                                    </div>
                              </div>

                              {/* Input Area */}
                              <div className="p-6 border-t border-white/5 bg-[#171717]/40 backdrop-blur-md">
                                    <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-3">
                                          <div className="flex-1 relative flex items-center">
                                                <input
                                                      type="text"
                                                      value={inputMessage}
                                                      onChange={(e) => setInputMessage(e.target.value)}
                                                      disabled={isLoading}
                                                      placeholder={`Send message to ${selectedAgent.name}...`}
                                                      className="w-full bg-neutral-900 border border-white/5 hover:border-white/10 focus:border-amber-500/50 rounded-xl py-3.5 pl-4 pr-12 text-sm text-neutral-200 focus:outline-none transition-all placeholder-neutral-600 disabled:opacity-50"
                                                />
                                                <div className="absolute right-4 text-neutral-600">
                                                      <MessageSquare className="w-4 h-4" />
                                                </div>
                                          </div>
                                          <button
                                                type="submit"
                                                disabled={!inputMessage.trim() || isLoading}
                                                className="bg-neutral-800 hover:bg-neutral-700 text-white disabled:bg-neutral-900 disabled:text-neutral-600 border border-white/5 hover:border-white/10 rounded-xl p-3.5 transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer"
                                          >
                                                <Send className="w-4 h-4" />
                                          </button>
                                    </form>
                              </div>
                        </main>
                  </div>
            </div>
      )
}
