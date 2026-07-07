"use client"
import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
      Mic,
      Monitor,
      Camera,
      FileText,
      Bug,
      MessageSquare,
      ChevronRight,
      Activity,
      Zap,
      HardDrive,
      Calendar,
      CalendarPlus,
      Layers,
      SlidersHorizontal,
      X,
      Check,
      Copy,
      Trash2,
      ExternalLink,
      Loader2,
      RefreshCw,
      Plus,
      Upload,
      Search,
      Cpu
} from "lucide-react"
import Link from "next/link"
import { useSettings } from "@/hooks/SettingsContext"
import { useSessionLogs } from "@/hooks/useSessionLogs"
import Voice from "@/components/Voice"
import MicDevice from "@/components/MicDevice"
import SessionChat from "@/components/SessionChat"
import MediaPreview from "@/components/MediaPreview"
import CalendarEventCard from "@/components/CalendarEventCard"
import EditableEventModal from "@/components/EditableEventModal"
import ThinkingIndicator from "@/components/ThinkingIndicator"
import DashboardSearch from "@/components/DashboardSearch"
export default function DashboardPage() {
      const [selectedSession, setSelectedSession] = useState(null)
      const [micDevice, setMicDevice] = useState(null)
      const [isDeleting, setIsDeleting] = useState(false)
      const [isDragging, setIsDragging] = useState(false)
      const [isProcessingFile, setIsProcessingFile] = useState(false)
      const [databaseView, setDatabaseView] = useState('table')
      const fileInputRef = useRef(null)
      const [showCalendarModal, setShowCalendarModal] = useState(false)
      const [eventDate, setEventDate] = useState('')
      const [eventTime, setEventTime] = useState('')
      const [calendarLoading, setCalendarLoading] = useState(false)
      const [calendarSuccess, setCalendarSuccess] = useState(false)
      const [editingEvent, setEditingEvent] = useState(null)
      
      const [searchQuery, setSearchQuery] = useState('')
      const [metrics, setMetrics] = useState({
            latency: 0,
            tokensUsed: 0,
            tokensTotal: 1000000,
            mcpConnected: false,
            lastUpdated: 0
      })

      useEffect(() => {
            const fetchMetrics = async () => {
                  if (typeof window !== 'undefined' && window.electron) {
                        try {
                              const result = await window.electron.invoke('get-system-metrics')
                              if (result.success && result.data) {
                                    setMetrics(result.data)
                              }
                        } catch (err) {
                              console.error('Failed to fetch metrics:', err)
                        }
                  }
            }
            fetchMetrics()
            const interval = setInterval(fetchMetrics, 3000)
            return () => clearInterval(interval)
      }, [])

      const formatTokens = (num) => {
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
            if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
            return num.toString()
      }

      const { t, settings } = useSettings()
      const { sessionLogs, isLoading, error, refetch, deleteSession } = useSessionLogs()
      const suggestedEvents = sessionLogs.reduce((acc, log) => {
            if (log.transcriptionStatus !== 'completed' || !log.details?.actionItems) return acc;
            const events = log.details.actionItems
                  .map((item, index) => ({ item, index, parentFileId: log.fileId || log.id }))
                  .filter(({ item }) =>
                        item.type === 'event' &&
                        item.calendarEvent?.detected &&
                        !item.dismissed
                  )
                  .map(({ item, index, parentFileId }) => ({
                        ...item.calendarEvent,
                        id: `${parentFileId}-${index}`,
                        parentFileId,
                        actionItemIndex: index,
                        originalSession: log
                  }));
            return [...acc, ...events];
      }, []).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

      const filteredSessionLogs = sessionLogs ? sessionLogs.filter(log => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                  (log.title && log.title.toLowerCase().includes(q)) ||
                  (log.subtitle && log.subtitle.toLowerCase().includes(q)) ||
                  (log.type && log.type.toLowerCase().includes(q))
            );
      }) : [];

      const handleDismissCalendarEvent = async (fileId, index) => {
            if (!window.electron) return
            try {
                  const result = await window.electron.invoke('calendar-dismiss-event', { fileId, index })
                  if (result.success) {
                        refetch()
                  } else {
                        console.error("Failed to dismiss event:", result.error)
                  }
            } catch (err) {
                  console.error(err)
            }
      }
      const handleConfirmCalendarEvent = async (eventDetails) => {
            if (!editingEvent || !window.electron) return
            setCalendarLoading(true)
            try {
                  const result = await window.electron.invoke('calendar-create-event', eventDetails)
                  if (result.success) {
                        if (editingEvent.actionItemIndex !== undefined) {
                              try {
                                    await window.electron.invoke('confirm-action-item', {
                                          fileId: editingEvent.parentFileId || selectedSession?.fileId || selectedSession?.id,
                                          index: editingEvent.actionItemIndex,
                                          eventDetails
                                    })
                              } catch (e) {
                                    console.error("Failed to mark action item as confirmed", e)
                              }
                        }
                        setCalendarSuccess(true)
                        setTimeout(() => {
                              setCalendarSuccess(false)
                              setEditingEvent(null)
                              refetch()
                        }, 2000)
                  } else {
                        console.error("Failed to create event:", result.error)
                        alert(t.errors?.calendarCreate || "Failed to create event on calendar")
                  }
            } catch (err) {
                  console.error(err)
                  alert(err.message)
            } finally {
                  setCalendarLoading(false)
            }
      }
      React.useEffect(() => {
            const handleSelection = async (selection) => {
                  if (!selection) return
                  console.log("Received selection:", selection)
                  try {
                        const sources = await window.electron.invoke("get-screen-sources")
                        if (!sources || sources.length === 0) {
                              console.error("No screen sources found")
                              return
                        }
                        const source = sources[0]
                        const stream = await navigator.mediaDevices.getUserMedia({
                              audio: false,
                              video: {
                                    mandatory: {
                                          chromeMediaSource: "desktop",
                                          chromeMediaSourceId: source.id,
                                    },
                              },
                        })
                        console.log("Stream:", stream)
                        const video = document.createElement("video")
                        video.srcObject = stream
                        video.onloadedmetadata = () => {
                              video.play()
                              setTimeout(() => {
                                    const canvas = document.createElement("canvas")
                                    canvas.width = video.videoWidth
                                    canvas.height = video.videoHeight
                                    const ctx = canvas.getContext("2d")
                                    ctx.drawImage(video, 0, 0)
                                    const dataUrl = canvas.toDataURL("image/png")
                                    window.electron.invoke("save-image-file", {
                                          buffer: dataUrl,
                                          mimeType: "image/png",
                                          width: video.videoWidth,
                                          height: video.videoHeight,
                                          title: `Magic Lens Capture`,
                                          selection: selection,
                                          settings: settings
                                    })
                                    stream.getTracks().forEach(track => track.stop())
                                    video.remove()
                                    canvas.remove()
                              }, 100)
                        }
                  } catch (err) {
                        console.error("Failed to capture screen selection:", err)
                  }
            }
            if (window.electron) {
                  window.electron.receive("magic-lens-selection", handleSelection)
            }
            return () => {
                  if (window.electron && window.electron.removeAllListeners) {
                        window.electron.removeAllListeners("magic-lens-selection")
                  }
            }
      }, [settings])
      React.useEffect(() => {
            if (!window.electron) return;
            const handleTranscriptionUpdate = (data) => {
                  if (selectedSession && (data.fileId === selectedSession.fileId || data.fileId === selectedSession.id)) {
                        refetch();
                  }
            };
            window.electron.receive('transcription-updated', handleTranscriptionUpdate);
            return () => {
                  if (window.electron.removeAllListeners) {
                        window.electron.removeAllListeners('transcription-updated');
                  }
            };
      }, [selectedSession, refetch]);
      const handleDeleteSession = async () => {
            if (!selectedSession || isDeleting) return
            setIsDeleting(true)
            const result = await deleteSession(selectedSession.fileId)
            if (result.success) {
                  setSelectedSession(null)
            } else {
                  console.error("Failed to delete session:", result.error)
            }
            setIsDeleting(false)
      }
      const getStatusBadge = (status) => {
            switch (status) {
                  case 'pending':
                        return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                    {t.status.pending}
                              </span>
                        )
                  case 'processing':
                        return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t.status.processing}
                              </span>
                        )
                  case 'completed':
                        return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                                    {t.status.completed}
                              </span>
                        )
                  case 'failed':
                        return (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                                    {t.status.failed}
                              </span>
                        )
                  default:
                        return null
            }
      }
      const handleDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const files = e.dataTransfer.files;
            if (files.length === 0) return;
            processFile(files[0]);
      };
      const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
      };
      const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
      };
      const handleFileSelect = (e) => {
            const files = e.target.files;
            if (files.length === 0) return;
            processFile(files[0]);
      };
      const processFile = async (file) => {
            const mimeType = file.type;
            const isAudio = mimeType.startsWith('audio/');
            const isImage = mimeType.startsWith('image/');
            if (!isAudio && !isImage) {
                  console.warn('Unsupported file type:', mimeType);
                  return;
            }
            setIsProcessingFile(true);
            try {
                  const arrayBuffer = await file.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);
                  let binary = '';
                  const chunkSize = 8192;
                  for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.subarray(i, i + chunkSize);
                        binary += String.fromCharCode.apply(null, chunk);
                  }
                  const base64 = btoa(binary);
                  const storedSettings = localStorage.getItem('ducksy-settings');
                  const settings = storedSettings ? JSON.parse(storedSettings) : {};
                  if (typeof window !== 'undefined' && window.electron) {
                        if (isAudio) {
                              const result = await window.electron.invoke('save-audio-file', {
                                    audioData: base64,
                                    mimeType: mimeType,
                                    settings: settings
                              });
                              console.log('Audio file saved:', result);
                              if (result.success) {
                                    setTimeout(refetch, 2000);
                              }
                        } else if (isImage) {
                              const result = await window.electron.invoke('save-image-file', {
                                    buffer: base64,
                                    mimeType: mimeType,
                                    settings: settings
                              });
                              console.log('Image file saved:', result);
                              if (result.success) {
                                    setTimeout(refetch, 2000);
                              }
                        }
                  }
            } catch (err) {
                  console.error('Error processing file:', err);
            } finally {
                  setIsProcessingFile(false);
            }
      };
      const formatDate = (dateString) => {
            if (!dateString) return ""

            let parsedDate = dateString
            if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
                  parsedDate = dateString.replace(' ', 'T') + 'Z'
            }
            const date = new Date(parsedDate)
            const now = new Date()
            const diff = now - date

            const minutes = Math.floor(diff / (1000 * 60))
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const days = Math.floor(diff / (1000 * 60 * 60 * 24))

            if (minutes < 1) return t.sessionsPage?.justNow || "Just now"
            if (minutes < 60) return `${minutes} ${minutes === 1 ? (t.sessionsPage?.minuteAgo || "minute ago") : (t.sessionsPage?.minutesAgo || "minutes ago")}`
            if (hours < 24) return `${hours} ${hours === 1 ? (t.sessionsPage?.hourAgo || "hour ago") : (t.sessionsPage?.hoursAgo || "hours ago")}`
            if (days === 1) return t.yesterday || "Yesterday"
            if (days < 7) return `${days} ${t.sessionsPage?.daysAgo || "days ago"}`
            return date.toLocaleDateString()
      }

      return (
            <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] text-neutral-200 font-sans overflow-y-auto custom-scrollbar selection:bg-amber-500/30 relative">
                  {/* Premium Cyber Grid Banner Cover */}
                  <div className="relative w-full h-48 bg-[#151515] overflow-hidden shrink-0 border-b border-white/5">
                        {/* Grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:28px_28px] opacity-70" />
                        
                        {/* Soft colorful gradient spotlights */}
                        <div className="absolute -top-20 left-1/4 w-[500px] h-60 bg-amber-500/10 rounded-full blur-[100px] animate-pulse duration-[8000ms]" />
                        <div className="absolute top-10 right-1/4 w-80 h-40 bg-orange-600/5 rounded-full blur-[85px] animate-pulse duration-[12000ms]" />
                        
                        {/* Dark fading vignette */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#151515_90%)]" />
                        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#1e1e1e] to-transparent" />
                  </div>

                  {/* Overlapping Page Emoji Avatar */}
                  <div className="max-w-5xl w-full mx-auto px-8 relative -mt-12 mb-4 z-10 select-none shrink-0">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/10 text-5xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:scale-105 hover:rotate-2 hover:border-amber-500/30 transition-all duration-500 ease-out cursor-default group">
                              <span className="group-hover:animate-bounce inline-block">🦆</span>
                        </div>
                  </div>

                  {/* Main Workspace Canvas */}
                  <div className="max-w-5xl w-full mx-auto px-8 pb-16 space-y-8 flex-1 flex flex-col z-10">
                        {/* Page Header */}
                        <div className="space-y-1.5">
                              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                                    {t.dashboard || "Dashboard"}
                              </h1>
                              <p className="text-xs text-neutral-500 font-medium leading-relaxed max-w-xl">
                                    Welcome to your Ducksy AI Workspace. Control settings, manage system operations, drop content, and inspect logs.
                              </p>
                        </div>

                        {/* Workspace Live Status Control Strip */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Card 1: Network Latency */}
                              <div className="flex items-center justify-between p-4.5 rounded-2xl bg-neutral-900/35 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/20 transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.01] rounded-full blur-2xl" />
                                    <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                                                <Activity className="w-4 h-4" />
                                          </div>
                                          <div className="space-y-0.5">
                                                <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">Network Latency</h4>
                                                <span className={`text-sm font-bold font-mono tracking-tight leading-none ${
                                                      metrics.latency === 0 ? 'text-neutral-500' :
                                                      metrics.latency < 500 ? 'text-green-400' :
                                                      metrics.latency < 1000 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                      {metrics.latency === 0 ? '--' : `${metrics.latency}ms`}
                                                </span>
                                          </div>
                                    </div>
                                    <div className="text-right z-10">
                                          {(() => {
                                                const isStale = Date.now() - metrics.lastUpdated > 60000;
                                                const mcpStatusText = metrics.mcpConnected ? 'Linked' : isStale ? 'Idle' : 'Offline';
                                                const mcpStatusColor = metrics.mcpConnected ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.1)]' :
                                                                       isStale ? 'bg-neutral-800 text-neutral-400 border-white/5' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]';
                                                return (
                                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold tracking-wider uppercase ${mcpStatusColor}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${metrics.mcpConnected ? 'bg-green-400 animate-pulse' : isStale ? 'bg-neutral-400' : 'bg-red-400 animate-ping'}`} />
                                                            {mcpStatusText}
                                                      </span>
                                                )
                                          })()}
                                    </div>
                              </div>

                              {/* Card 2: Token Utilization */}
                              <div className="flex flex-col justify-between p-4.5 rounded-2xl bg-neutral-900/35 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/20 transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/[0.01] rounded-full blur-2xl" />
                                    {(() => {
                                          const pct = Math.min(100, Math.max(0, (metrics.tokensUsed / metrics.tokensTotal) * 100))
                                          return (
                                                <>
                                                      <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-1.5">
                                                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">Token Usage</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold font-mono text-neutral-400 leading-none">
                                                                  {formatTokens(metrics.tokensUsed)} <span className="text-neutral-600">/</span> 1M
                                                            </span>
                                                      </div>
                                                      <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-white/5">
                                                            <div 
                                                                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                                                  style={{ width: `${pct}%` }}
                                                            />
                                                      </div>
                                                </>
                                          )
                                    })()}
                              </div>

                              {/* Card 3: Mic Hardware */}
                              <div className="flex items-center gap-3 p-4.5 rounded-2xl bg-neutral-900/35 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/20 transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/[0.01] rounded-full blur-2xl" />
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-sm shrink-0">
                                          <Mic className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                          <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">Audio Device</h4>
                                          <div className="relative">
                                                <MicDevice setMicDevice={setMicDevice} micDevice={micDevice} />
                                          </div>
                                    </div>
                              </div>
                        </div>

                        {/* Top Action Controls Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {/* Launch Companion Overlay */}
                              <div className="bg-neutral-900/35 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-48 hover:border-amber-500/20 hover:bg-neutral-900/40 hover:-translate-y-0.5 transition-all duration-300 group shadow-lg">
                                    <div className="space-y-1.5">
                                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                                <Zap className="w-4 h-4 fill-current" strokeWidth={0} />
                                          </div>
                                          <h3 className="text-xs font-bold text-neutral-200 group-hover:text-amber-400 transition-colors">Go Invisible</h3>
                                          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                                                Minimize dashboard to system tray and launch the desktop overlay companion on your screen.
                                          </p>
                                    </div>
                                    <button
                                          onClick={() => {
                                                if (typeof window !== 'undefined' && window.electron) {
                                                      window.electron.send('open-overlay')
                                                }
                                          }}
                                          className="w-full py-2.5 bg-amber-500 text-neutral-950 text-xs font-extrabold rounded-xl hover:bg-amber-400 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(245,158,11,0.15)] flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          {t.dashboardPage.launchOverlay}
                                    </button>
                              </div>

                              {/* Notion Drag & Drop Media Box */}
                              <div 
                                    className={`border border-dashed rounded-2xl p-5 h-48 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer select-none group/dropzone relative overflow-hidden
                                    ${isDragging
                                          ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                                          : 'border-white/10 bg-neutral-900/15 hover:border-amber-500/20 hover:bg-neutral-900/30'
                                    }`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                              >
                                    <input
                                          type="file"
                                          ref={fileInputRef}
                                          className="hidden"
                                          onChange={handleFileSelect}
                                          accept="audio/*,image/*"
                                    />
                                    {isProcessingFile ? (
                                          <div className="flex flex-col items-center">
                                                <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-2" />
                                                <span className="text-xs text-amber-500 font-bold tracking-wide animate-pulse">Processing file...</span>
                                          </div>
                                    ) : (
                                          <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-2.5 group-hover/dropzone:scale-105 group-hover/dropzone:bg-amber-500/10 group-hover/dropzone:text-amber-500 transition-all duration-300 text-neutral-400">
                                                      <Upload className="w-4 h-4" strokeWidth={1.5} />
                                                </div>
                                                <span className="text-xs text-neutral-300 font-bold tracking-tight">
                                                      Drop audio or image
                                                </span>
                                                <span className="text-[10px] text-neutral-500 font-medium mt-1">
                                                      or click to browse local files
                                                </span>
                                          </div>
                                    )}
                              </div>

                              {/* Up Next Suggestions */}
                              <div className="bg-neutral-900/35 border border-white/5 rounded-2xl p-5.5 flex flex-col h-48 hover:border-white/10 transition-all duration-300 shadow-lg">
                                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2 shrink-0">
                                          <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                                <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">{t.dashboardPage.upNext}</h2>
                                          </div>
                                          {suggestedEvents.length > 0 && (
                                                <span className="flex h-2 w-2 relative">
                                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                </span>
                                          )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                          {suggestedEvents.length > 0 ? (
                                                suggestedEvents.map(eventData => (
                                                      <div id={`calendar-event-${eventData.id}`} key={eventData.id} className="transition-all duration-200">
                                                            <CalendarEventCard
                                                                  event={eventData}
                                                                  t={t}
                                                                  onReview={() => setEditingEvent({
                                                                        calendarEvent: eventData,
                                                                        actionItemIndex: eventData.actionItemIndex,
                                                                        parentFileId: eventData.parentFileId
                                                                  })}
                                                                  onDismiss={() => handleDismissCalendarEvent(eventData.parentFileId, eventData.actionItemIndex)}
                                                            />
                                                      </div>
                                                ))
                                          ) : (
                                                <div className="text-[11px] text-neutral-500 italic p-3 text-center border border-white/5 rounded-xl bg-white/[0.01] h-full flex flex-col items-center justify-center gap-1">
                                                      <span>No suggestions found</span>
                                                      <span className="text-[9px] text-neutral-600 font-normal">Action items will be logged here</span>
                                                </div>
                                          )}
                                    </div>
                              </div>
                        </div>

                        {/* Notion Database Block */}
                        <div className="bg-[#272727]/10 border border-white/5 rounded-2xl p-6 space-y-4 shadow-lg">
                              {/* Database Toolbar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3.5">
                                    <div className="flex items-center gap-3">
                                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                <Layers className="w-4 h-4" />
                                          </div>
                                          <div>
                                                <h2 className="text-sm font-bold text-neutral-200">{t.dashboardPage.sessionLog}</h2>
                                                <p className="text-[10px] text-neutral-500 mt-0.5">Unified activity logging registry</p>
                                          </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                                          {/* Client search filtering */}
                                          <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                                                <input
                                                      type="text"
                                                      placeholder="Search sessions..."
                                                      value={searchQuery}
                                                      onChange={(e) => setSearchQuery(e.target.value)}
                                                      className="pl-8 pr-3 py-1.5 bg-neutral-900/50 hover:bg-neutral-900/80 focus:bg-neutral-900 border border-white/5 hover:border-white/10 focus:border-amber-500/30 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none w-44 transition-all"
                                                />
                                          </div>

                                          <span className="w-px h-4 bg-white/10" />

                                          {/* View Selector */}
                                          <div className="flex items-center gap-1 bg-neutral-900/40 rounded-lg p-0.5 border border-white/5">
                                                <button
                                                      onClick={() => setDatabaseView('table')}
                                                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${databaseView === 'table' ? 'bg-white/5 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                                                >
                                                      Table
                                                </button>
                                                <button
                                                      onClick={() => setDatabaseView('gallery')}
                                                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${databaseView === 'gallery' ? 'bg-white/5 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                                                >
                                                      Gallery
                                                </button>
                                          </div>

                                          <span className="w-px h-4 bg-white/10" />

                                          <button
                                                onClick={refetch}
                                                disabled={isLoading}
                                                className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                                          >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                          </button>

                                          <Link href="/sessions">
                                                <button className="text-[9px] font-bold font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-widest border border-white/5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                                                      {t.viewAll}
                                                </button>
                                          </Link>
                                    </div>
                              </div>

                              {/* Database Content Area */}
                              <div className="min-h-[220px]">
                                    {isLoading && filteredSessionLogs.length === 0 ? (
                                          <div className="flex flex-col items-center justify-center py-16">
                                                <Loader2 className="w-7 h-7 text-amber-500 animate-spin mb-3" />
                                                <p className="text-xs text-neutral-500">{t.session.loading}</p>
                                          </div>
                                    ) : error ? (
                                          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                                                <p className="text-xs mb-2">{t.session.loadFailed}</p>
                                                <button
                                                      onClick={refetch}
                                                      className="text-xs text-amber-500 hover:underline flex items-center gap-1.5"
                                                >
                                                      <RefreshCw className="w-3.5 h-3.5" />
                                                      {t.session.tryAgain}
                                                </button>
                                          </div>
                                    ) : filteredSessionLogs.length === 0 ? (
                                          <div className="flex flex-col items-center justify-center py-16 text-neutral-500 text-center">
                                                <FileText className="w-9 h-9 mb-2 opacity-30 text-amber-500" />
                                                <p className="text-xs font-bold">{searchQuery ? "No matching sessions" : t.session.noSessions}</p>
                                                <p className="text-[10px] mt-0.5 text-neutral-600">{searchQuery ? "Try refining your search keywords" : t.session.noSessionsDesc}</p>
                                          </div>
                                    ) : databaseView === 'table' ? (
                                          /* Notion Table View */
                                          <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs border-collapse">
                                                      <thead>
                                                            <tr className="border-b border-white/5 text-neutral-500 font-bold text-[10px] uppercase tracking-wider">
                                                                  <th className="pb-2.5 font-bold pl-2">Title</th>
                                                                  <th className="pb-2.5 font-bold">Subtitle</th>
                                                                  <th className="pb-2.5 font-bold">Type</th>
                                                                  <th className="pb-2.5 font-bold pr-2">Status</th>
                                                            </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-white/[0.03]">
                                                            {filteredSessionLogs.map((log) => (
                                                                  <tr 
                                                                        key={log.id} 
                                                                        onClick={() => setSelectedSession(log)} 
                                                                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                                                                  >
                                                                        <td className="py-3.5 font-bold text-neutral-200 truncate max-w-[200px] pl-2 flex items-center gap-2">
                                                                              <span className="shrink-0 text-sm">
                                                                                    {log.type === 'summary' ? '📄' : log.type === 'debug' ? '🐞' : '🖼️'}
                                                                              </span>
                                                                              <span className="truncate group-hover:text-amber-400 transition-colors">
                                                                                    {log.title}
                                                                              </span>
                                                                        </td>
                                                                        <td className="py-3.5 text-neutral-500 truncate max-w-[240px]">
                                                                              {log.subtitle}
                                                                        </td>
                                                                        <td className="py-3.5">
                                                                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold font-mono tracking-wider
                                                                                    ${log.type === 'summary' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                                                      log.type === 'debug' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                                      'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}
                                                                              >
                                                                                    {log.type}
                                                                              </span>
                                                                        </td>
                                                                        <td className="py-3.5 pr-2">
                                                                              <div className="flex items-center justify-between">
                                                                                    {getStatusBadge(log.transcriptionStatus)}
                                                                                    <ChevronRight className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                                                                              </div>
                                                                        </td>
                                                                  </tr>
                                                            ))}
                                                      </tbody>
                                                </table>
                                          </div>
                                    ) : (
                                          /* Notion Gallery View */
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                {filteredSessionLogs.map((log) => (
                                                      <div 
                                                            key={log.id} 
                                                            onClick={() => setSelectedSession(log)} 
                                                            className="p-4 rounded-xl bg-neutral-900/35 border border-white/5 hover:border-amber-500/25 hover:bg-neutral-900/50 cursor-pointer transition-all flex flex-col justify-between h-36 group shadow-md"
                                                      >
                                                            <div>
                                                                  <div className="flex items-center justify-between mb-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold font-mono tracking-wider
                                                                              ${log.type === 'summary' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                                                log.type === 'debug' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                                'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}
                                                                        >
                                                                              {log.type}
                                                                        </span>
                                                                        {getStatusBadge(log.transcriptionStatus)}
                                                                  </div>
                                                                  <h3 className="text-xs font-bold text-neutral-200 truncate group-hover:text-amber-400 transition-colors">
                                                                        {log.title}
                                                                  </h3>
                                                                  <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1.5 leading-normal font-medium">
                                                                        {log.subtitle}
                                                                  </p>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[9px] text-neutral-600 font-mono mt-3 border-t border-white/5 pt-1.5">
                                                                  <span>{formatDate(log.createdAt)}</span>
                                                                  <span className="flex items-center gap-0.5 text-neutral-500 group-hover:text-neutral-300">
                                                                        Open <ChevronRight className="w-2.5 h-2.5" />
                                                                  </span>
                                                            </div>
                                                      </div>
                                                ))}
                                          </div>
                                    )}
                              </div>
                        </div>
                  </div>

                  <EditableEventModal
                        isOpen={!!editingEvent}
                        onClose={() => setEditingEvent(null)}
                        event={editingEvent?.calendarEvent}
                        onConfirm={handleConfirmCalendarEvent}
                        t={t}
                  />

                  <AnimatePresence>
                        {selectedSession && (
                              <>
                                    <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                          onClick={() => setSelectedSession(null)}
                                          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-45"
                                    />
                                    <motion.div
                                          initial={{ x: "100%" }}
                                          animate={{ x: 0 }}
                                          exit={{ x: "100%" }}
                                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                          className="fixed top-0 right-0 h-full w-full md:w-[420px] bg-[#191919] border-l border-white/5 z-50 shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
                                    >
                                          <div className="p-6 border-b border-white/5 flex items-start justify-between bg-neutral-900/10">
                                                <div>
                                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 text-neutral-400 border border-white/5">
                                                                  {selectedSession.mode}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                                  {selectedSession.type}
                                                            </span>
                                                            {getStatusBadge(selectedSession.transcriptionStatus)}
                                                      </div>
                                                      <h2 className="text-xl font-bold text-white leading-tight">{selectedSession.title}</h2>
                                                      <p className="text-xs text-neutral-500 mt-1">{selectedSession.subtitle}</p>
                                                      {selectedSession.duration > 0 && (
                                                            <p className="text-xs text-neutral-600 mt-1">
                                                                  {t.session.duration}: {Math.floor(selectedSession.duration / 60)}m {selectedSession.duration % 60}s
                                                            </p>
                                                      )}
                                                </div>
                                                <button
                                                      onClick={() => setSelectedSession(null)}
                                                      className="p-2 rounded-full hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                                                >
                                                      <X className="w-5 h-5" />
                                                </button>
                                          </div>
                                          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                                <div className="mb-6 p-4.5 rounded-2xl bg-neutral-950/40 border border-white/5">
                                                      <MediaPreview
                                                            fileId={selectedSession.id}
                                                            filePath={selectedSession.filePath}
                                                            mimeType={selectedSession.mimeType}
                                                            duration={selectedSession.duration}
                                                      />
                                                </div>
                                                {selectedSession.transcriptionStatus === 'pending' && (
                                                      <div className="flex flex-col items-center justify-center h-48 text-neutral-500">
                                                            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
                                                                  <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                                                            </div>
                                                            <p className="text-sm font-medium">{t.session.waiting}</p>
                                                            <p className="text-xs mt-1 text-neutral-600">{t.session.queue}</p>
                                                      </div>
                                                )}
                                                {selectedSession.transcriptionStatus === 'processing' && (
                                                      <div className="flex flex-col items-center justify-center h-64 w-full">
                                                            <ThinkingIndicator type={selectedSession.mimeType?.startsWith('image') ? 'image' : 'audio'} />
                                                      </div>
                                                )}
                                                {selectedSession.transcriptionStatus === 'failed' && (
                                                      <div className="flex flex-col items-center justify-center h-48 text-neutral-500">
                                                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                                                  <X className="w-6 h-6 text-red-500" />
                                                            </div>
                                                            <p className="text-sm font-medium text-red-400">{t.session.failedTitle}</p>
                                                            <p className="text-xs mt-1 text-neutral-600 mb-4">{t.session.failedDesc}</p>
                                                            <button
                                                                  onClick={async () => {
                                                                        if (window.electron && selectedSession) {
                                                                              try {
                                                                                    const result = await window.electron.invoke('retry-transcription', {
                                                                                          fileId: selectedSession.fileId || selectedSession.id
                                                                                    })
                                                                                    if (result.success) {
                                                                                          setSelectedSession(prev => ({
                                                                                                ...prev,
                                                                                                transcriptionStatus: 'processing'
                                                                                          }))
                                                                                          refetch()
                                                                                    }
                                                                              } catch (e) {
                                                                                    console.error("Retry failed:", e)
                                                                              }
                                                                        }
                                                                  }}
                                                                  className="px-6 py-2.5 bg-neutral-800 text-white hover:bg-neutral-700 rounded-xl text-xs font-semibold transition-colors border border-white/5"
                                                            >
                                                                  {t.session.retry}
                                                            </button>
                                                      </div>
                                                )}
                                                {selectedSession.transcriptionStatus === 'completed' && selectedSession.details && (
                                                      <>
                                                            {selectedSession.type === 'summary' && (
                                                                  <div className="space-y-6">
                                                                        <div>
                                                                              <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2">{t.dashboardPage.summary}</h4>
                                                                              <p className="text-neutral-300 text-sm leading-relaxed">{selectedSession.details.summary}</p>
                                                                        </div>
                                                                        <div>
                                                                              <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">{t.dashboardPage.actionItems}</h4>
                                                                              <ul className="space-y-2.5">
                                                                                    {(() => {
                                                                                          let itemIndex = 0;
                                                                                          return selectedSession.details.actionItems?.map((item, originalIndex) => {
                                                                                                const isInactive = item.dismissed || item.confirmed;
                                                                                                const isEvent = item.type === 'event';
                                                                                                const hasTool = item.toolCall && item.toolCall.tool;
                                                                                                const tool = hasTool ? item.toolCall.tool : null;
                                                                                                const params = hasTool ? item.toolCall.params : null;
                                                                                                const iconIndex = itemIndex;
                                                                                                if (!isInactive) {
                                                                                                      itemIndex++;
                                                                                                }
                                                                                                return (
                                                                                                      <li 
                                                                                                            key={originalIndex} 
                                                                                                            className={`flex items-start gap-3 p-3.5 rounded-xl border border-white/5 transition-all
                                                                                                                  ${isInactive 
                                                                                                                        ? 'bg-neutral-900/10 border-transparent text-neutral-600' 
                                                                                                                        : 'bg-[#272727]/20 text-neutral-200 hover:border-white/10 hover:bg-[#272727]/30'
                                                                                                                  }`}
                                                                                                      >
                                                                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs font-mono font-bold mt-0.5
                                                                                                                  ${isInactive ? 'bg-neutral-800 text-neutral-600' : 'bg-amber-500/10 text-amber-500'}`}
                                                                                                            >
                                                                                                                  {isInactive ? '✓' : iconIndex + 1}
                                                                                                            </div>
                                                                                                            <div className="flex-1 min-w-0">
                                                                                                                  <p className={`text-xs font-medium leading-normal ${isInactive ? 'line-through' : ''}`}>
                                                                                                                        {item.text}
                                                                                                                  </p>
                                                                                                                  {isEvent && item.calendarEvent?.detected && !isInactive && (
                                                                                                                        <div className="mt-2.5 p-3 rounded-lg bg-neutral-900/40 border border-white/5 space-y-1.5">
                                                                                                                              <div className="flex items-center justify-between">
                                                                                                                                    <span className="text-[10px] font-mono text-amber-500/80 uppercase tracking-wider font-bold">Suggested Event</span>
                                                                                                                                    <span className="text-[10px] text-neutral-500">{new Date(item.calendarEvent.dateTime).toLocaleDateString()}</span>
                                                                                                                              </div>
                                                                                                                              <h5 className="text-xs font-bold text-white truncate">{item.calendarEvent.title}</h5>
                                                                                                                              <button
                                                                                                                                    onClick={(e) => {
                                                                                                                                          e.stopPropagation();
                                                                                                                                          setEventDate(item.calendarEvent.dateTime.split('T')[0]);
                                                                                                                                          setEventTime(item.calendarEvent.dateTime.split('T')[1]?.substring(0, 5) || '');
                                                                                                                                          setEditingEvent({
                                                                                                                                                calendarEvent: item.calendarEvent,
                                                                                                                                                actionItemIndex: originalIndex,
                                                                                                                                                parentFileId: selectedSession.fileId || selectedSession.id
                                                                                                                                          });
                                                                                                                                    }}
                                                                                                                                    className="w-full mt-1.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                                                                                              >
                                                                                                                                    <CalendarPlus className="w-3 h-3" /> Approve Suggestion
                                                                                                                              </button>
                                                                                                                        </div>
                                                                                                                  )}
                                                                                                                  <div className="flex items-center gap-2 mt-3">
                                                                                                                        <button
                                                                                                                              onClick={async (e) => {
                                                                                                                                    e.stopPropagation();
                                                                                                                                    if (item?.confirmed || isInactive) return;
                                                                                                                                    if (window.electron) {
                                                                                                                                          await window.electron.invoke('calendar-dismiss-event', {
                                                                                                                                                fileId: selectedSession.fileId || selectedSession.id,
                                                                                                                                                index: originalIndex
                                                                                                                                          });
                                                                                                                                    }
                                                                                                                              }}
                                                                                                                              disabled={item?.confirmed || isInactive}
                                                                                                                              title="Reject Suggestion"
                                                                                                                              className={`w-7 h-7 rounded-md border border-neutral-600 text-neutral-400 flex items-center justify-center transition-all ${isInactive ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'}`}
                                                                                                                        >
                                                                                                                              <X className="w-4 h-4" />
                                                                                                                        </button>
                                                                                                                        {tool && (
                                                                                                                              <button
                                                                                                                                    onClick={(e) => {
                                                                                                                                          e.stopPropagation();
                                                                                                                                          if (window.electron) {
                                                                                                                                                window.electron.invoke('execute-tool', { tool, params })
                                                                                                                                                      .then(res => {
                                                                                                                                                            if (res.success) alert("Action Executed!");
                                                                                                                                                            else alert("Error: " + res.error);
                                                                                                                                                      });
                                                                                                                                          }
                                                                                                                                    }}
                                                                                                                                    className="h-7 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-medium rounded-md transition-colors border border-amber-500/20 flex items-center gap-2"
                                                                                                                              >
                                                                                                                                    <Zap className="w-3 h-3" />
                                                                                                                                    Execute
                                                                                                                              </button>
                                                                                                                        )}
                                                                                                                  </div>
                                                                                                            </div>
                                                                                                      </li>
                                                                                                );
                                                                                          });
                                                                                    })()}
                                                                              </ul>
                                                                        </div>
                                                                  </div>
                                                            )}
                                                            {selectedSession.type === 'debug' && (
                                                                  <div className="space-y-6">
                                                                        <div>
                                                                              <h4 className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                                    <Bug className="w-3 h-3" /> {t.dashboardPage.reportedBug}
                                                                              </h4>
                                                                              <p className="text-white font-mono text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                                                    {selectedSession.details.bug}
                                                                                </p>
                                                                        </div>
                                                                        <div>
                                                                              <h4 className="text-xs font-mono text-green-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                                    <Zap className="w-3 h-3" /> {t.dashboardPage.solutionApplied}
                                                                              </h4>
                                                                              <p className="text-neutral-300 text-sm leading-relaxed">
                                                                                    {selectedSession.details.fix}
                                                                              </p>
                                                                        </div>
                                                                        {selectedSession.details.code && (
                                                                              <div className="relative group">
                                                                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                          <button className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors">
                                                                                                <Copy className="w-3 h-3" />
                                                                                          </button>
                                                                                    </div>
                                                                                    <pre className="bg-[#0d1117] p-4 rounded-xl border border-white/10 text-xs font-mono text-neutral-300 overflow-x-auto">
                                                                                          <code>{selectedSession.details.code}</code>
                                                                                    </pre>
                                                                              </div>
                                                                        )}
                                                                  </div>
                                                            )}
                                                      </>
                                                )}
                                                <div className="mt-8 pt-6 border-t border-white/5">
                                                      <SessionChat
                                                            fileId={selectedSession.id}
                                                            initialHistory={selectedSession.chatHistory || []}
                                                      />
                                                </div>
                                          </div>
                                          <div className="p-6 border-t border-white/5 bg-neutral-950/60 flex gap-3 mt-auto shrink-0 items-center">
                                                <button 
                                                      onClick={() => {
                                                            if (typeof window !== 'undefined' && window.electron) {
                                                                  window.electron.send('open-overlay')
                                                            }
                                                      }}
                                                      className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                                >
                                                      <ExternalLink className="w-3.5 h-3.5" /> {t.dashboardPage.openOverlay}
                                                </button>
                                                <button
                                                      onClick={async () => {
                                                            if (window.electron && selectedSession) {
                                                                  const result = await window.electron.invoke('get-session', { fileId: selectedSession.fileId || selectedSession.id })
                                                                  if (result.success && result.data) {
                                                                        setSelectedSession(result.data)
                                                                  }
                                                                  refetch()
                                                            }
                                                      }}
                                                      className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
                                                      title={t.sessionsPage?.refresh || "Refresh"}
                                                >
                                                      <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                      onClick={handleDeleteSession}
                                                      disabled={isDeleting}
                                                      className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                                >
                                                      {isDeleting ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                      ) : (
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                      )}
                                                </button>
                                          </div>
                                    </motion.div>
                              </>
                        )}
                  </AnimatePresence>

                  <AnimatePresence>
                        {showCalendarModal && (
                              <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                                    onClick={() => setShowCalendarModal(false)}
                              >
                                    <motion.div
                                          initial={{ scale: 0.95, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          exit={{ scale: 0.95, opacity: 0 }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4"
                                    >
                                          {calendarSuccess ? (
                                                <div className="text-center py-4">
                                                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                                                            <CalendarPlus className="w-8 h-8 text-green-500" />
                                                      </div>
                                                      <h3 className="text-lg font-bold text-white mb-2">Event Added!</h3>
                                                      <p className="text-sm text-neutral-400 mb-4">
                                                            "{selectedSession?.title}" has been added to Google Calendar
                                                      </p>
                                                      <button
                                                            onClick={() => setShowCalendarModal(false)}
                                                            className="px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors"
                                                      >
                                                            Done
                                                      </button>
                                                </div>
                                          ) : (
                                                <>
                                                      <h3 className="text-lg font-bold text-white mb-4">Add to Calendar</h3>
                                                      <div className="space-y-4">
                                                            <div>
                                                                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2">Date</label>
                                                                  <input
                                                                        type="date"
                                                                        value={eventDate}
                                                                        onChange={(e) => setEventDate(e.target.value)}
                                                                        className="w-full px-4 py-3 bg-neutral-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                                                                  />
                                                            </div>
                                                            <div>
                                                                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2">Time</label>
                                                                  <input
                                                                        type="time"
                                                                        value={eventTime}
                                                                        onChange={(e) => setEventTime(e.target.value)}
                                                                        className="w-full px-4 py-3 bg-neutral-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                                                                  />
                                                            </div>
                                                      </div>
                                                      <div className="flex gap-3 mt-6">
                                                            <button
                                                                  onClick={() => setShowCalendarModal(false)}
                                                                  className="flex-1 py-3 bg-neutral-800 text-neutral-300 text-sm font-medium rounded-xl hover:bg-neutral-700 transition-colors"
                                                            >
                                                                  Cancel
                                                            </button>
                                                            <button
                                                                  onClick={async () => {
                                                                        if (!eventDate || !eventTime || !selectedSession) return
                                                                        setCalendarLoading(true)
                                                                        try {
                                                                              const startTime = new Date(`${eventDate}T${eventTime}:00`).toISOString()
                                                                              const endTime = new Date(new Date(`${eventDate}T${eventTime}:00`).getTime() + 60 * 60 * 1000).toISOString()
                                                                              const result = await window.electron.invoke('calendar-create-event', {
                                                                                    title: selectedSession.title,
                                                                                    description: selectedSession.details?.summary || '',
                                                                                    startTime,
                                                                                    endTime
                                                                              })
                                                                              if (result.success) {
                                                                                    setCalendarSuccess(true)
                                                                              } else {
                                                                                    alert(result.error || 'Failed to add event')
                                                                              }
                                                                        } catch (e) {
                                                                              console.error('Calendar error:', e)
                                                                              alert('Failed to add event')
                                                                        } finally {
                                                                              setCalendarLoading(false)
                                                                        }
                                                                  }}
                                                                  disabled={calendarLoading || !eventDate || !eventTime}
                                                                  className="flex-1 py-3 bg-amber-500 text-black text-sm font-bold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50"
                                                            >
                                                                  {calendarLoading ? 'Adding...' : 'Add Event'}
                                                            </button>
                                                      </div>
                                                </>
                                          )}
                                    </motion.div>
                              </motion.div>
                        )}
                  </AnimatePresence>
            </div >
      )
}