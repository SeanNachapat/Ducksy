"use client"
import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    FileText,
    Bug,
    ChevronRight,
    Activity,
    Zap,
    Layers,
    X,
    Copy,
    Trash2,
    ExternalLink,
    Loader2,
    RefreshCw,
    ArrowLeft,
    Search,
    Filter,
    Calendar,
    Clock,
    Image,
    Plus
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSettings } from "@/hooks/SettingsContext"
import { useSessionLogs } from "@/hooks/useSessionLogs"
import SessionChat from "@/components/SessionChat"
import MediaPreview from "@/components/MediaPreview"
import EditableEventModal from "@/components/EditableEventModal"
import ThinkingIndicator from "@/components/ThinkingIndicator"

function SessionsPageContent() {
    const [selectedSession, setSelectedSession] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [editingEvent, setEditingEvent] = useState(null)
    const { t, settings } = useSettings()

    const searchParams = useSearchParams()
    const urlFileId = searchParams.get('fileId')

    const { sessionLogs, isLoading, error, refetch, deleteSession } = useSessionLogs()

    // Sync selectedSession with URL search parameter
    React.useEffect(() => {
        if (urlFileId && sessionLogs && sessionLogs.length > 0) {
            const foundSession = sessionLogs.find(log => log.fileId === urlFileId || log.id === urlFileId)
            if (foundSession) {
                setSelectedSession(foundSession)
            }
        }
    }, [urlFileId, sessionLogs])

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

    const handleRefreshSession = async () => {
        if (!selectedSession || isRefreshing) return

        setIsRefreshing(true)
        try {
            if (window.electron) {
                const result = await window.electron.invoke('retry-transcription', {
                    fileId: selectedSession.fileId,
                    userLanguage: settings?.language || 'en',
                    settings: settings || {}
                })
                if (result.success) {
                    setSelectedSession(prev => ({
                        ...prev,
                        transcriptionStatus: 'processing'
                    }))
                    refetch()
                } else {
                    console.error("Failed to refresh session:", result.error)
                }
            }
        } catch (err) {
            console.error("Failed to refresh session:", err)
        } finally {
            setIsRefreshing(false)
        }
    }

    React.useEffect(() => {
        if (!window.electron) return;

        const handleTranscriptionUpdate = (event, data) => {
            if (selectedSession && (data.fileId === selectedSession.fileId || data.fileId === selectedSession.id)) {
                // If the update contains details, we can update local state directly for immediate feedback
                if (data.details) {
                    setSelectedSession(prev => ({
                        ...prev,
                        details: data.details
                    }));
                }
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

    const filteredSessions = sessionLogs.filter(log => {
        const matchesSearch = log.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = filterType === "all" || log.type === filterType
        return matchesSearch && matchesFilter
    })

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                        {t.status?.pending || "Pending"}
                    </span>
                )
            case 'processing':
                return (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t.status?.processing || "Processing"}
                    </span>
                )
            case 'completed':
                return (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                        {t.status?.completed || "Completed"}
                    </span>
                )
            case 'failed':
                return (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                        {t.status?.failed || "Failed"}
                    </span>
                )
            default:
                return null
        }
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'summary':
                return <FileText className="w-5 h-5" strokeWidth={1.5} />
            case 'debug':
                return <Bug className="w-5 h-5" strokeWidth={1.5} />
            case 'image':
                return <Image className="w-5 h-5" strokeWidth={1.5} />
            default:
                return <FileText className="w-5 h-5" strokeWidth={1.5} />
        }
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'summary':
                return 'bg-blue-500/10 text-blue-400'
            case 'debug':
                return 'bg-red-500/10 text-red-400'
            case 'image':
                return 'bg-purple-500/10 text-purple-400'
            default:
                return 'bg-amber-500/10 text-amber-400'
        }
    }

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
            <div className="relative w-full h-44 bg-gradient-to-r from-[#1f1f1f] via-[#1a2d2f] to-[#1f1f1f] border-b border-white/5 shrink-0">
                {/* Mesh gradients / glowing orbs */}
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-28 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />
                <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-64 h-24 bg-cyan-500/5 rounded-full blur-[50px] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.06),transparent_50%)] pointer-events-none" />
            </div>

            {/* Overlapping Page Emoji */}
            <div className="max-w-5xl w-full mx-auto px-8 relative -mt-10 mb-4 z-10 select-none">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#202020] border border-white/5 text-4xl shadow-lg hover:scale-105 transition-transform duration-300">
                    📝
                </div>
            </div>

            {/* Main Document Content Canvas */}
            <div className="max-w-5xl w-full mx-auto px-8 pb-16 space-y-8 flex-1 flex flex-col z-10">
                {/* Page Title Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                            {t.sessionsPage?.title || "All Sessions"}
                        </h1>
                        <p className="text-xs text-neutral-500 font-medium">
                            Manage and review your recorded audio meetings and screen analysis sessions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0 self-start md:self-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                            <input
                                type="text"
                                placeholder={t.sessionsPage?.searchPlaceholder || "Search sessions..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 w-56 bg-neutral-900/40 border border-white/5 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 focus:bg-neutral-900/60 transition-all font-sans"
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-neutral-900/50 rounded-xl p-1 border border-white/5">
                            {["all", "summary", "debug"].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === type
                                        ? "bg-white/5 text-white border border-white/5"
                                        : "text-neutral-500 hover:text-white"
                                        }`}
                                >
                                    {type === "all" ? (t.sessionsPage?.filterAll || "All") :
                                        type === "summary" ? (t.sessionsPage?.filterSummary || "Summary") :
                                            (t.sessionsPage?.filterDebug || "Debug")}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={refetch}
                            disabled={isLoading}
                            className="p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-neutral-500 hover:text-white transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Notion Database Table View of Sessions */}
                <div className="bg-[#272727]/20 border border-white/5 rounded-2xl p-6">
                    {isLoading && sessionLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
                            <p className="text-sm text-neutral-500">{t.session?.loading || "Loading sessions..."}</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                            <p className="text-sm mb-3">{t.session?.loadFailed || "Failed to load sessions"}</p>
                            <button
                                onClick={refetch}
                                className="text-xs text-amber-500 hover:underline flex items-center gap-2"
                            >
                                <RefreshCw className="w-3 h-3" />
                                {t.session?.tryAgain || "Try again"}
                            </button>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500 text-center">
                            <FileText className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm font-semibold">{t.session?.noSessions || "No sessions yet"}</p>
                            <p className="text-xs mt-1 text-neutral-600">{t.session?.noSessionsDesc || "Start recording to see your sessions here"}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredSessions.map((log, index) => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={() => setSelectedSession(log)}
                                    className="group p-5 rounded-xl bg-neutral-900/30 border border-white/5 hover:border-white/10 hover:bg-neutral-900/50 transition-all cursor-pointer flex flex-col justify-between h-40"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getTypeColor(log.type)}`}>
                                                {getTypeIcon(log.type)}
                                            </div>
                                            {getStatusBadge(log.transcriptionStatus)}
                                        </div>

                                        <h3 className="text-sm font-bold text-neutral-200 line-clamp-1 group-hover:text-amber-400 transition-colors">
                                            {log.title}
                                        </h3>
                                        <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">
                                            {log.subtitle}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-neutral-600 font-mono mt-4 border-t border-white/5 pt-2 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3 text-neutral-500" />
                                            <span>{formatDate(log.timestamp || log.createdAt)}</span>
                                        </div>
                                        {log.duration ? (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-neutral-500" />
                                                <span>{Math.floor(log.duration / 60)}m {log.duration % 60}s</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editable Event Modal */}
            <EditableEventModal
                isOpen={!!editingEvent}
                onClose={() => setEditingEvent(null)}
                event={editingEvent?.calendarEvent}
                onSave={async (updatedEvent) => {
                    if (window.electron && selectedSession && editingEvent) {
                        try {
                            const result = await window.electron.invoke(
                                'calendar-create-event',
                                {
                                    event: updatedEvent,
                                    fileId: selectedSession.fileId || selectedSession.id,
                                    index: editingEvent.actionItemIndex
                                }
                            );

                            if (result.success) {
                                setEditingEvent(null);
                            } else {
                                console.error("Failed to create event:", result.error);
                                alert("Failed to create event: " + result.error);
                            }
                        } catch (error) {
                            console.error("Error creating event:", error);
                            alert("Error creating event: " + error.message);
                        }
                    }
                }}
            />

            {/* Selected Session Drawer */}
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
                            className="absolute top-0 right-0 h-full w-full md:w-1/3 min-w-[350px] bg-neutral-950/95 backdrop-blur-xl border-l border-white/10 z-50 shadow-2xl overflow-hidden flex flex-col"
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
                                    <h2 className="text-lg font-bold text-white leading-tight">{selectedSession.title}</h2>
                                    <p className="text-xs text-neutral-500 mt-1">{selectedSession.subtitle}</p>
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
                                        <p className="text-sm font-medium">{t.session?.waiting || "Waiting..."}</p>
                                        <p className="text-xs mt-1 text-neutral-600">{t.session?.queue || "In transcription queue"}</p>
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
                                        <p className="text-sm font-medium text-red-400">{t.session?.failedTitle || "Analysis Failed"}</p>
                                        <p className="text-xs mt-1 text-neutral-600 mb-4">{t.session?.failedDesc || "An error occurred during speech/image recognition."}</p>
                                        <button
                                            onClick={handleRefreshSession}
                                            className="px-6 py-2.5 bg-neutral-800 text-white hover:bg-neutral-700 rounded-xl text-xs font-semibold transition-colors border border-white/5"
                                        >
                                            {t.session?.retry || "Retry"}
                                        </button>
                                    </div>
                                )}

                                {selectedSession.transcriptionStatus === 'completed' && selectedSession.details && (
                                    <>
                                        {selectedSession.type === 'summary' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-2">
                                                        {t.dashboardPage?.summary || "Summary"}
                                                    </h4>
                                                    <p className="text-neutral-300 text-sm leading-relaxed">
                                                        {selectedSession.details.summary}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">
                                                        {t.dashboardPage?.actionItems || "Action Items"}
                                                    </h4>
                                                    <ul className="space-y-2.5">
                                                        {(() => {
                                                            let itemIndex = 0
                                                            return selectedSession.details.actionItems?.map((item, originalIndex) => {
                                                                const isInactive = item.dismissed || item.confirmed
                                                                const isEvent = item.type === 'event'
                                                                const hasTool = item.toolCall && item.toolCall.tool
                                                                const tool = hasTool ? item.toolCall.tool : null
                                                                const params = hasTool ? item.toolCall.params : null
                                                                const iconIndex = itemIndex
                                                                if (!isInactive) {
                                                                    itemIndex++
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
                                                                                            setEditingEvent({
                                                                                                calendarEvent: item.calendarEvent,
                                                                                                actionItemIndex: originalIndex,
                                                                                                parentFileId: selectedSession.fileId || selectedSession.id
                                                                                            });
                                                                                        }}
                                                                                        className="w-full mt-1.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                                                    >
                                                                                        <Calendar className="w-3 h-3" /> Approve Suggestion
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
                                                                )
                                                            })
                                                        })()}
                                                        {(!selectedSession.details.actionItems || selectedSession.details.actionItems.length === 0) && (
                                                            <li className="text-sm text-neutral-500 italic">{t.dashboardPage?.noActionItems || "No action items identified"}</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                        {selectedSession.type === 'debug' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <Bug className="w-3 h-3" /> {t.dashboardPage?.reportedBug || "Reported bug"}
                                                    </h4>
                                                    <p className="text-white font-mono text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                        {selectedSession.details?.bug}
                                                    </p>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-mono text-green-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <Zap className="w-3 h-3" /> {t.dashboardPage?.solutionApplied || "Solution applied"}
                                                    </h4>
                                                    <p className="text-neutral-300 text-sm leading-relaxed">
                                                        {selectedSession.details?.fix}
                                                    </p>
                                                </div>
                                                {selectedSession.details?.code && (
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
                                <button
                                    onClick={handleRefreshSession}
                                    disabled={isRefreshing || selectedSession.transcriptionStatus === 'processing'}
                                    className="py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isRefreshing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4" />
                                    )}
                                    <span className="text-sm font-medium">{t.sessionsPage?.refresh || "Refresh"}</span>
                                </button>
                                <button className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 hover:text-white text-neutral-300 transition-colors flex items-center justify-center gap-2">
                                    <ExternalLink className="w-4 h-4" /> {t.dashboardPage?.openOverlay || "Open Overlay"}
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

            <EditableEventModal
                isOpen={!!editingEvent}
                onClose={() => setEditingEvent(null)}
                event={editingEvent?.calendarEvent}
                onSave={async (updatedEvent) => {
                    if (window.electron && selectedSession && editingEvent) {
                        try {
                            const result = await window.electron.invoke(
                                'calendar-create-event',
                                {
                                    event: updatedEvent,
                                    fileId: selectedSession.fileId || selectedSession.id,
                                    index: editingEvent.actionItemIndex
                                }
                            );

                            if (result.success) {
                                setEditingEvent(null);
                            } else {
                                console.error("Failed to create event:", result.error);
                                alert("Failed to create event: " + result.error);
                            }
                        } catch (error) {
                            console.error("Error creating event:", error);
                            alert("Error creating event: " + error.message);
                        }
                    }
                }}
            />
        </div>
    )
}

export default function SessionsPage() {
    return (
        <React.Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center bg-[#202020] text-neutral-500 min-h-screen">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
                <p className="text-sm">Loading workspace...</p>
            </div>
        }>
            <SessionsPageContent />
        </React.Suspense>
    )
}
