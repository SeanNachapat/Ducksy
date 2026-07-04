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
      Upload
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
function LiveSystemMetrics() {
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
      const isStale = Date.now() - metrics.lastUpdated > 60000
      return (
            <div className="flex items-center gap-3 font-mono text-xs bg-neutral-900/70 px-4 py-2.5 rounded-xl border border-white/5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                        <span className="text-neutral-500 uppercase tracking-wider text-[10px]">LAT</span>
                        <span className={`font-bold tabular-nums ${metrics.latency === 0 ? 'text-neutral-500' :
                              metrics.latency < 500 ? 'text-green-400' :
                                    metrics.latency < 1000 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                              {metrics.latency === 0 ? '--' : `${metrics.latency}ms`}
                        </span>
                  </div>
                  <span className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                        <span className="text-neutral-500 uppercase tracking-wider text-[10px]">TKN</span>
                        <span className="font-bold tabular-nums">
                              <span className={metrics.tokensUsed > 800000 ? 'text-yellow-400' : 'text-green-400'}>
                                    {formatTokens(metrics.tokensUsed)}
                              </span>
                              <span className="text-neutral-600">/</span>
                              <span className="text-neutral-500">1M</span>
                        </span>
                  </div>
                  <span className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                        <span className="text-neutral-500 uppercase tracking-wider text-[10px]">MCP</span>
                        <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${metrics.mcpConnected
                                    ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
                                    : isStale
                                          ? 'bg-neutral-500'
                                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                                    }`} />
                              <span className={`font-bold uppercase text-[10px] ${metrics.mcpConnected ? 'text-green-400' : isStale ? 'text-neutral-500' : 'text-red-400'
                                    }`}>
                                    {metrics.mcpConnected ? 'LINK' : isStale ? 'IDLE' : 'ERR'}
                              </span>
                        </div>
                  </div>
            </div>
      )
}
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
            <div className="flex-1 flex flex-col h-full bg-[#202020] text-neutral-200 font-sans overflow-y-auto custom-scrollbar selection:bg-amber-500/30 relative">
                  {/* Notion-style Cover Banner */}
                  <div className="relative w-full h-44 bg-gradient-to-r from-[#1f1f1f] via-[#2d2218] to-[#1f1f1f] border-b border-white/5 shrink-0">
                        {/* Mesh gradients / glowing orbs */}
                        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-28 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />
                        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-64 h-24 bg-orange-500/5 rounded-full blur-[50px] pointer-events-none" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.06),transparent_50%)] pointer-events-none" />
                  </div>

                  {/* Overlapping Page Emoji */}
                  <div className="max-w-5xl w-full mx-auto px-8 relative -mt-10 mb-4 z-10 select-none">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#202020] border border-white/5 text-4xl shadow-lg hover:scale-105 transition-transform duration-300">
                              🦆
                        </div>
                  </div>

                  {/* Main Document Content Canvas */}
                  <div className="max-w-5xl w-full mx-auto px-8 pb-16 space-y-8 flex-1 flex flex-col z-10">
                        {/* Page Title Header */}
                        <div className="space-y-1">
                              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                                    {t.dashboard || "Dashboard"}
                              </h1>
                              <p className="text-xs text-neutral-500 font-medium">
                                    Welcome to your Ducksy AI Workspace. Use the sidebar to navigate, or upload logs and capture screen context.
                              </p>
                        </div>

                        {/* Notion Callout Blocks (Metrics & Audio) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Callout 1: System Status & Metrics */}
                              <div className="flex gap-3.5 p-4 rounded-xl border border-l-4 border-white/5 border-l-amber-500/50 bg-[#272727]/30 backdrop-blur-md">
                                    <div className="text-xl select-none">⚡</div>
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                          <h3 className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500 leading-none">System Metrics</h3>
                                          <LiveSystemMetrics />
                                    </div>
                              </div>
                              
                              {/* Callout 2: Voice & Device Selection */}
                              <div className="flex gap-3.5 p-4 rounded-xl border border-l-4 border-white/5 border-l-amber-500/50 bg-[#272727]/30 backdrop-blur-md">
                                    <div className="text-xl select-none">🎤</div>
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                          <h3 className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-500 leading-none">Audio Device</h3>
                                          <div className="flex items-center h-full">
                                                <MicDevice setMicDevice={setMicDevice} micDevice={micDevice} />
                                          </div>
                                    </div>
                              </div>
                        </div>

                        {/* Top Controls Grid: Launch Overlay / File Upload / Up Next */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {/* Quick Action: Launch Overlay */}
                              <div className="bg-[#272727]/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-44 hover:border-white/10 hover:bg-[#272727]/40 transition-all group">
                                    <div className="space-y-1">
                                          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block leading-none">Capture Overlay</span>
                                          <h3 className="text-sm font-bold text-neutral-200 group-hover:text-amber-400 transition-colors">Go Invisible</h3>
                                          <p className="text-xs text-neutral-500 leading-normal">
                                                Minimize dashboard to system tray and launch the desktop overlay companion on your screen.
                                          </p>
                                    </div>
                                    <button
                                          onClick={() => {
                                                if (typeof window !== 'undefined' && window.electron) {
                                                      window.electron.send('open-overlay')
                                                }
                                          }}
                                          className="w-full py-2 bg-amber-500 text-neutral-950 text-xs font-bold rounded-xl hover:bg-amber-400 transition-colors shadow-sm mt-2 flex items-center justify-center gap-1.5"
                                    >
                                          <Zap className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
                                          {t.dashboardPage.launchOverlay}
                                    </button>
                              </div>

                              {/* Notion Drag & Drop Media Box */}
                              <div 
                                    className={`border border-dashed rounded-2xl p-5 h-44 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none group/dropzone
                                    ${isDragging
                                          ? 'border-amber-500 bg-amber-500/10'
                                          : 'border-white/10 bg-[#272727]/10 hover:border-amber-500/30 hover:bg-[#272727]/30'
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
                                                <Loader2 className="w-6 h-6 text-amber-500 animate-spin mb-2" />
                                                <span className="text-xs text-amber-500 font-medium animate-pulse">Processing...</span>
                                          </div>
                                    ) : (
                                          <div className="flex flex-col items-center">
                                                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover/dropzone:scale-105 transition-transform text-neutral-400 group-hover/dropzone:text-amber-500">
                                                      <Upload className="w-4 h-4" strokeWidth={1.5} />
                                                </div>
                                                <span className="text-xs text-neutral-300 font-semibold group-hover/dropzone:text-neutral-200">
                                                      Drop audio or image
                                                </span>
                                                <span className="text-[10px] text-neutral-500 mt-1">
                                                      or click to upload
                                                </span>
                                          </div>
                                    )}
                              </div>

                              {/* Up Next / Calendar Suggestions */}
                              <div className="bg-[#272727]/30 border border-white/5 rounded-2xl p-5 flex flex-col h-44">
                                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-1.5 shrink-0">
                                          <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest leading-none">{t.dashboardPage.upNext}</h2>
                                          <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                                          {suggestedEvents.length > 0 ? (
                                                suggestedEvents.map(eventData => (
                                                      <div id={`calendar-event-${eventData.id}`} key={eventData.id}>
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
                                                <div className="text-[11px] text-neutral-500 italic p-3 text-center border border-white/5 rounded-xl bg-white/[0.01] h-full flex items-center justify-center">
                                                      {t.dashboardPage?.noUpcomingEvents || "No new events detected"}
                                                </div>
                                          )}
                                    </div>
                              </div>
                        </div>

                        {/* Notion Database Block */}
                        <div className="bg-[#272727]/20 border border-white/5 rounded-2xl p-6 space-y-4">
                              {/* Database Toolbar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-3">
                                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                                                <Activity className="w-4 h-4" />
                                          </div>
                                          <div>
                                                <h2 className="text-sm font-bold text-neutral-200">{t.dashboardPage.sessionLog}</h2>
                                                <p className="text-[10px] text-neutral-500">Showing recent system interactions</p>
                                          </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
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
                                                className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                                          >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                          </button>

                                          <Link href="/sessions">
                                                <button className="text-[9px] font-bold font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-widest border border-white/5 px-2.5 py-1.5 rounded-lg hover:bg-white/5">
                                                      {t.viewAll}
                                                </button>
                                          </Link>
                                    </div>
                              </div>

                              {/* Database Content Area */}
                              <div className="min-h-[220px]">
                                    {isLoading && sessionLogs.length === 0 ? (
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
                                    ) : sessionLogs.length === 0 ? (
                                          <div className="flex flex-col items-center justify-center py-16 text-neutral-500 text-center">
                                                <FileText className="w-9 h-9 mb-2 opacity-30" />
                                                <p className="text-xs font-semibold">{t.session.noSessions}</p>
                                                <p className="text-[10px] mt-0.5 text-neutral-600">{t.session.noSessionsDesc}</p>
                                          </div>
                                    ) : databaseView === 'table' ? (
                                          /* Notion Table View */
                                          <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs border-collapse">
                                                      <thead>
                                                            <tr className="border-b border-white/5 text-neutral-500 font-bold text-[10px] uppercase tracking-wider">
                                                                  <th className="pb-2.5 font-normal pl-2">Title</th>
                                                                  <th className="pb-2.5 font-normal">Subtitle</th>
                                                                  <th className="pb-2.5 font-normal">Type</th>
                                                                  <th className="pb-2.5 font-normal pr-2">Status</th>
                                                            </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-white/[0.03]">
                                                            {sessionLogs.map((log) => (
                                                                  <tr 
                                                                        key={log.id} 
                                                                        onClick={() => setSelectedSession(log)} 
                                                                        className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                                                                  >
                                                                        <td className="py-3 font-semibold text-neutral-200 truncate max-w-[200px] pl-2 flex items-center gap-2">
                                                                              <span className="shrink-0 text-sm">
                                                                                    {log.type === 'summary' ? '📄' : log.type === 'debug' ? '🐞' : '🖼️'}
                                                                              </span>
                                                                              <span className="truncate group-hover:text-amber-400 transition-colors">
                                                                                    {log.title}
                                                                              </span>
                                                                        </td>
                                                                        <td className="py-3 text-neutral-500 truncate max-w-[240px]">
                                                                              {log.subtitle}
                                                                        </td>
                                                                        <td className="py-3">
                                                                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold font-mono tracking-wider
                                                                                    ${log.type === 'summary' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                                                      log.type === 'debug' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                                      'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}
                                                                              >
                                                                                    {log.type}
                                                                              </span>
                                                                        </td>
                                                                        <td className="py-3 pr-2">
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
                                                {sessionLogs.map((log) => (
                                                      <div 
                                                            key={log.id} 
                                                            onClick={() => setSelectedSession(log)} 
                                                            className="p-4 rounded-xl bg-neutral-900/30 border border-white/5 hover:border-white/10 hover:bg-neutral-900/40 cursor-pointer transition-all flex flex-col justify-between h-36 group"
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
                                                                  <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1.5 leading-normal">
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
                                          className="absolute inset-0 bg-black/40 backdrop-blur-sm z-45"
                                    />
                                    <motion.div
                                          initial={{ x: "100%" }}
                                          animate={{ x: 0 }}
                                          exit={{ x: "100%" }}
                                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                          className="absolute top-0 right-0 h-full w-full md:w-1/3 min-w-[350px] bg-[#202020] border-l border-white/10 z-50 shadow-2xl overflow-hidden flex flex-col"
                                    >
                                          <div className="p-6 border-b border-white/5 flex items-start justify-between bg-neutral-900/30">
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
                                                <div className="mb-6">
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
                                          <div className="p-6 border-t border-white/5 bg-neutral-900/30 flex gap-3 mt-auto shrink-0">
                                                <button className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 hover:text-white text-neutral-300 transition-colors flex items-center justify-center gap-2">
                                                      <ExternalLink className="w-4 h-4" /> {t.dashboardPage.openOverlay}
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
                                                      className="py-3 px-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                      title={t.sessionsPage?.refresh || "Refresh"}
                                                >
                                                      <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button
                                                      onClick={handleDeleteSession}
                                                      disabled={isDeleting}
                                                      className="py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                      {isDeleting ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                      ) : (
                                                            <Trash2 className="w-4 h-4" />
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