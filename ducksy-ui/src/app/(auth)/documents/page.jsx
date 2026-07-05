"use client"
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
      FileText,
      Edit2,
      Eye,
      Sparkles,
      Check,
      Copy,
      Plus,
      Trash2,
      Save,
      FileEdit,
      Loader2,
      Heading1,
      Bold,
      Italic,
      Code,
      Maximize2
} from "lucide-react"
import { useSessionLogs } from "@/hooks/useSessionLogs"
import { useSettings } from "@/hooks/SettingsContext"

export default function DocumentEditorPage() {
      const { sessionLogs, isLoading: dbLoading, refetch } = useSessionLogs()
      const { t } = useSettings()

      const [documents, setDocuments] = useState([])
      const [selectedDoc, setSelectedDoc] = useState(null)
      const [title, setTitle] = useState("")
      const [content, setContent] = useState("")
      const [isAiLoading, setIsAiLoading] = useState(false)
      const [saveStatus, setSaveStatus] = useState("")
      const [isCopied, setIsCopied] = useState(false)

      // Sync database sessions as document entries
      useEffect(() => {
            if (sessionLogs && sessionLogs.length > 0) {
                  const mapped = sessionLogs.map(log => ({
                        id: log.fileId || log.id,
                        title: log.title || "Untitled Session",
                        content: log.content || log.summary || "# Untitled Session\n\nNo content yet.",
                        isDbFile: true,
                        rawLog: log
                  }))
                  setDocuments(mapped)
                  if (!selectedDoc && mapped.length > 0) {
                        handleSelectDoc(mapped[0])
                  }
            }
      }, [sessionLogs])

      const handleSelectDoc = (doc) => {
            setSelectedDoc(doc)
            setTitle(doc.title)
            setContent(doc.content)
            setSaveStatus("")
      }

      const handleCreateNew = () => {
            const newDoc = {
                  id: `draft-${Date.now()}`,
                  title: "New Draft Notepad",
                  content: "# New Draft Notepad\n\nStart writing your Markdown notes here...",
                  isDbFile: false
            }
            setDocuments(prev => [newDoc, ...prev])
            handleSelectDoc(newDoc)
      }

      const handleFormatText = (prefix, suffix = "") => {
            const textarea = document.getElementById("notepad-editor")
            if (!textarea) return

            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const text = textarea.value
            const selected = text.substring(start, end)
            
            const replacement = prefix + selected + suffix
            const newContent = text.substring(0, start) + replacement + text.substring(end)
            setContent(newContent)
            
            // Re-focus and set selection
            setTimeout(() => {
                  textarea.focus()
                  textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
            }, 0)
      }

      const handleAiAssist = async (action) => {
            if (!content || isAiLoading) return

            const textarea = document.getElementById("notepad-editor")
            let selectedText = content
            let start = 0
            let end = content.length

            if (textarea) {
                  const selectionStart = textarea.selectionStart
                  const selectionEnd = textarea.selectionEnd
                  if (selectionStart !== selectionEnd) {
                        selectedText = content.substring(selectionStart, selectionEnd)
                        start = selectionStart
                        end = selectionEnd
                  }
            }

            setIsAiLoading(true)
            try {
                  const isProd = process.env.NODE_ENV === 'production'
                  const serverUrl = isProd ? "http://localhost:8080" : "http://localhost:8080"

                  const response = await fetch(`${serverUrl}/api/document/rewrite`, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                              text: selectedText,
                              action: action
                        })
                  })

                  if (response.ok) {
                        const result = await response.json()
                        const rewritten = result.data || ""
                        const newContent = content.substring(0, start) + rewritten + content.substring(end)
                        setContent(newContent)
                  } else {
                        throw new Error("AI Assistant call failed.")
                  }
            } catch (err) {
                  console.error("AI Error:", err)
                  alert("Failed to reach AI service: " + err.message)
            } finally {
                  setIsAiLoading(false)
            }
      }

      const handleSave = async () => {
            if (!selectedDoc) return
            setSaveStatus("saving")
            
            try {
                  if (selectedDoc.isDbFile && window.electron) {
                        // Update in local SQLite DB
                        const result = await window.electron.invoke("update-transcription", {
                              fileId: selectedDoc.id,
                              type: selectedDoc.rawLog?.transcriptionType || "summary",
                              title: title,
                              summary: selectedDoc.rawLog?.summary || title,
                              content: content,
                              language: selectedDoc.rawLog?.language || "en",
                              status: "completed",
                              details: selectedDoc.rawLog?.details || {}
                        })
                        
                        if (result.success) {
                              setSaveStatus("success")
                              setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, title, content } : d))
                              if (refetch) refetch()
                        } else {
                              throw new Error(result.error)
                        }
                  } else {
                        // Local storage draft update
                        setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, title, content } : d))
                        setSaveStatus("success")
                  }
            } catch (err) {
                  console.error("Save error:", err)
                  setSaveStatus("error")
            } finally {
                  setTimeout(() => setSaveStatus(""), 2000)
            }
      }

      const handleCopy = () => {
            navigator.clipboard.writeText(content)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length
      const charCount = content.length

      return (
            <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] relative overflow-hidden">
                  {/* cover banner */}
                  <div className="h-40 w-full relative bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-900 flex-shrink-0">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
                        <div className="absolute bottom-6 left-8 flex items-end gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center text-3xl shadow-xl">
                                    📄
                              </div>
                              <div>
                                    <h1 className="text-2xl font-bold text-white leading-tight">Document Editor</h1>
                                    <p className="text-neutral-400 text-xs mt-1">Review, write, and expand workspace reports and meeting transcripts using inline AI helpers.</p>
                              </div>
                        </div>
                  </div>

                  {/* Main Grid */}
                  <div className="flex-1 flex overflow-hidden">
                        {/* Left Side: Document File Selector */}
                        <aside className="w-80 border-r border-white/5 bg-[#171717]/60 flex flex-col overflow-hidden flex-shrink-0">
                              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Workspace Files</span>
                                    <button
                                          onClick={handleCreateNew}
                                          className="p-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                    >
                                          <Plus className="w-3 h-3" />
                                          New Draft
                                    </button>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                                    {documents.length === 0 ? (
                                          <div className="text-center p-6 text-xs text-neutral-600">
                                                No documents found.
                                          </div>
                                    ) : (
                                          documents.map((doc) => (
                                                <button
                                                      key={doc.id}
                                                      onClick={() => handleSelectDoc(doc)}
                                                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer ${selectedDoc?.id === doc.id
                                                            ? "bg-white/5 border-white/10 text-neutral-200"
                                                            : "bg-transparent border-transparent hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                                                            }`}
                                                >
                                                      <div className="flex items-center gap-2">
                                                            <FileText className={`w-3.5 h-3.5 shrink-0 ${doc.isDbFile ? 'text-blue-500/80' : 'text-neutral-500'}`} />
                                                            <span className="text-xs truncate flex-1 font-bold leading-none">{doc.title}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 mt-1.5 pl-5.5">
                                                            <span className={`text-[8px] px-1 py-0.2 rounded font-mono uppercase tracking-wider border ${doc.isDbFile
                                                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                                  : 'bg-neutral-800 border-white/5 text-neutral-500'
                                                                  }`}
                                                            >
                                                                  {doc.isDbFile ? 'Session' : 'Draft'}
                                                            </span>
                                                      </div>
                                                </button>
                                          ))
                                    )}
                              </div>
                        </aside>

                        {/* Right Canvas: Split Screen Editor */}
                        <main className="flex-1 flex flex-col bg-[#1c1c1c] overflow-hidden">
                              {selectedDoc ? (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                          {/* Toolbar Header */}
                                          <div className="p-4 border-b border-white/5 bg-neutral-900/30 flex items-center justify-between flex-shrink-0">
                                                <input
                                                      type="text"
                                                      value={title}
                                                      onChange={(e) => setTitle(e.target.value)}
                                                      className="bg-transparent border-none focus:outline-none text-sm font-bold text-white flex-1 min-w-0 mr-4 selection:bg-amber-500/30"
                                                      placeholder="Document title..."
                                                />
                                                
                                                <div className="flex items-center gap-2">
                                                      {/* AI Helpers */}
                                                      <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-wider mr-1">AI Assistant</span>
                                                      <button
                                                            onClick={() => handleAiAssist("expand")}
                                                            disabled={isAiLoading || !content}
                                                            className="px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 hover:text-white transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                                      >
                                                            <Sparkles className="w-3 h-3 text-amber-500" />
                                                            Expand
                                                      </button>
                                                      <button
                                                            onClick={() => handleAiAssist("summarize")}
                                                            disabled={isAiLoading || !content}
                                                            className="px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 hover:text-white transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                                      >
                                                            <FileEdit className="w-3 h-3 text-blue-500" />
                                                            Summarize
                                                      </button>
                                                      <button
                                                            onClick={() => handleAiAssist("improve")}
                                                            disabled={isAiLoading || !content}
                                                            className="px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 hover:text-white transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                                      >
                                                            <Check className="w-3 h-3 text-green-500" />
                                                            Improve
                                                      </button>

                                                      <span className="w-px h-5 bg-white/10 mx-1" />

                                                      <button
                                                            onClick={handleCopy}
                                                            className="px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-white/10 bg-neutral-900/50 hover:bg-neutral-800 text-[10px] font-bold text-neutral-400 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                                                      >
                                                            <Copy className="w-3 h-3" />
                                                            {isCopied ? "Copied!" : "Copy"}
                                                      </button>
                                                      <button
                                                            onClick={handleSave}
                                                            disabled={saveStatus === 'saving'}
                                                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                                                      >
                                                            {saveStatus === 'saving' ? (
                                                                  <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : saveStatus === 'success' ? (
                                                                  <Check className="w-3 h-3 text-green-500" />
                                                            ) : (
                                                                  <Save className="w-3 h-3" />
                                                            )}
                                                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved' : 'Save changes'}
                                                      </button>
                                                </div>
                                          </div>

                                          {/* Markdown Formatting Action Row */}
                                          <div className="px-4 py-1.5 border-b border-white/5 bg-neutral-950/20 flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                      onClick={() => handleFormatText("# ", "\n")}
                                                      className="p-1 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                                                      title="Heading"
                                                >
                                                      <Heading1 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                      onClick={() => handleFormatText("**", "**")}
                                                      className="p-1 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                                                      title="Bold text"
                                                >
                                                      <Bold className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                      onClick={() => handleFormatText("*", "*")}
                                                      className="p-1 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                                                      title="Italic text"
                                                >
                                                      <Italic className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                      onClick={() => handleFormatText("```\n", "\n```")}
                                                      className="p-1 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                                                      title="Code block"
                                                >
                                                      <Code className="w-3.5 h-3.5" />
                                                </button>
                                                {isAiLoading && (
                                                      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-neutral-500">
                                                            <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                                            AI rewriting document...
                                                      </div>
                                                )}
                                          </div>

                                          {/* Split Screen Container */}
                                          <div className="flex-1 flex overflow-hidden">
                                                {/* Left Editor */}
                                                <div className="flex-1 flex flex-col border-r border-white/5">
                                                      <textarea
                                                            id="notepad-editor"
                                                            value={content}
                                                            onChange={(e) => setContent(e.target.value)}
                                                            className="flex-1 p-6 bg-[#1a1a1a] text-sm text-neutral-300 focus:outline-none resize-none select-text custom-scrollbar font-mono leading-relaxed selection:bg-amber-500/30"
                                                            placeholder="Write markdown here..."
                                                      />
                                                      {/* Character Counters */}
                                                      <div className="px-6 py-2 border-t border-white/5 bg-[#171717]/60 text-[10px] text-neutral-500 flex items-center justify-between font-mono">
                                                            <span>Words: {wordCount}</span>
                                                            <span>Characters: {charCount}</span>
                                                      </div>
                                                </div>

                                                {/* Right Preview */}
                                                <div className="flex-1 bg-[#1c1c1c] p-6 overflow-y-auto custom-scrollbar select-text selection:bg-blue-500/20">
                                                      <div className="prose prose-invert prose-sm max-w-none text-neutral-300 leading-relaxed font-sans">
                                                            <div className="whitespace-pre-wrap">
                                                                  {content}
                                                            </div>
                                                      </div>
                                                </div>
                                          </div>
                                    </div>
                              ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                          <FileText className="w-12 h-12 text-neutral-700 mb-3" />
                                          <h3 className="text-sm font-bold text-neutral-200">No Document Selected</h3>
                                          <p className="text-neutral-500 text-xs mt-1">Select a workspace session log on the left sidebar to edit, or create a new notepad draft.</p>
                                    </div>
                              )}
                        </main>
                  </div>
            </div>
      )
}
