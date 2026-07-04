"use client"
import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    X,
    Trash2,
    ExternalLink,
    Sparkles,
    Database,
    Settings,
    Globe,
    Moon,
    Link2,
    MessageSquare,
    Info,
    Github,
    Bug,
    ArrowRight,
    Twitter,
    Lock
} from "lucide-react"
import Link from "next/link"
import { useSettings } from "@/hooks/SettingsContext"
import translations from "../locales/translations.json"

export default function SettingsModal({ isOpen, onClose }) {
    const { settings, updateSettings, t } = useSettings()
    const [activeSection, setActiveSection] = useState("general")
    const [clearing, setClearing] = useState(false)
    const [showBuilders, setShowBuilders] = useState(false)
    const [contributors, setContributors] = useState([])
    const [mcpStatus, setMcpStatus] = useState({
        google_calendar: { connected: false },
        notion: { connected: false }
    })
    const [serverStatus, setServerStatus] = useState({
        checking: false,
        online: false,
        url: ""
    })
    const [sizeCache, setSizeCache] = useState({
        status: "",
        percent: null,
        size: null,
    })

    // Fetch contributors if Meet Builders is open
    useEffect(() => {
        const fetchContributors = async () => {
            try {
                const response = await fetch("https://api.github.com/repos/SeanNachapat/Ducksy-Gemini-3-Hackathon-2026/contributors")
                if (response.ok) {
                    const data = await response.json()
                    const detailedContributors = await Promise.all(
                        data.slice(0, 6).map(async (contributor) => {
                            try {
                                const userResponse = await fetch(`https://api.github.com/users/${contributor.login}`)
                                if (userResponse.ok) {
                                    const userData = await userResponse.json()
                                    return {
                                        ...contributor,
                                        twitter_username: userData.twitter_username,
                                        blog: userData.blog,
                                        bio: userData.bio,
                                        name: userData.name
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to fetch user details", e)
                            }
                            return contributor
                        })
                    )
                    setContributors(detailedContributors)
                }
            } catch (error) {
                console.error("Failed to fetch contributors", error)
            }
        }
        if (showBuilders && contributors.length === 0) {
            fetchContributors()
        }
    }, [showBuilders])

    // Check server status
    useEffect(() => {
        if (isOpen && activeSection === "connections") {
            const isProd = process.env.NODE_ENV === 'production';
            const serverUrl = isProd
                ? "http://localhost:8080"
                : "http://localhost:8080";
            setServerStatus(prev => ({ ...prev, checking: true, url: serverUrl }));
            fetch(`${serverUrl}/health`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Server returned non-ok status');
                })
                .then(data => {
                    if (data.status === 'ok') {
                        setServerStatus(prev => ({ ...prev, checking: false, online: true }));
                    } else {
                        throw new Error('Server status not ok');
                    }
                })
                .catch(err => {
                    console.error("Server check failed", err);
                    setServerStatus(prev => ({ ...prev, checking: false, online: false }));
                });
        }
    }, [isOpen, activeSection])

    // Load MCP connection status
    useEffect(() => {
        if (!isOpen || !window.electron) return;
        if (activeSection === "connections") {
            window.electron.invoke("mcp-get-status").then((result) => {
                if (result.success) {
                    setMcpStatus({
                        google_calendar: result.google_calendar,
                        notion: result.notion
                    })
                }
            })
        }
        const handleAuthSuccess = (event, data) => {
            if (data.provider === "google_calendar") {
                setMcpStatus(prev => ({ ...prev, google_calendar: { connected: true } }))
            } else if (data.provider === "notion") {
                setMcpStatus(prev => ({ ...prev, notion: { connected: true } }))
            }
        }
        window.electron.receive("mcp-auth-success", handleAuthSuccess)
        return () => window.electron.removeListener("mcp-auth-success", handleAuthSuccess)
    }, [isOpen, activeSection])

    // Get database storage cache sizes
    useEffect(() => {
        if (!isOpen || !window.electron) return;
        if (activeSection === "memory") {
            setSizeCache({ status: "", percent: null, size: null })
            window.electron.invoke("request-sizeCache").then((event) => {
                const { status, percent, size } = event
                setSizeCache({ status, percent, size })
            })
        }
    }, [isOpen, activeSection])

    const handleClearMemory = () => {
        setClearing(true)
        if (window.electron) {
            window.electron.invoke("delete-db").then((event) => {
                if (event?.success) {
                    alert("Memory cleared successfully! The app will restart...")
                } else {
                    alert("Error: " + (event?.error || "Unknown error"))
                    setClearing(false)
                }
            }).catch((err) => {
                alert("Error: " + err.message)
                setClearing(false)
            })
        }
    }

    const getStatusColor = (status) => {
        if (status === 'warning') return { text: 'text-amber-500', bg: 'bg-amber-500', bgSoft: 'bg-amber-500/10' };
        if (status === 'danger') return { text: 'text-red-500', bg: 'bg-red-500', bgSoft: 'bg-red-500/10' };
        return { text: 'text-emerald-500', bg: 'bg-emerald-500', bgSoft: 'bg-emerald-500/10' };
    }

    const sections = [
        { id: "general", label: t.nav.general, desc: "Theme & Language", icon: Settings },
        { id: "persona", label: t.nav.persona, desc: "Personality & Voice", icon: Sparkles },
        { id: "memory", label: t.nav.memory, desc: "Context & Storage", icon: Database },
        { id: "connections", label: t.nav.connections, desc: "Integrations & MCP", icon: Link2 },
        { id: "info", label: "Info", desc: "System & About", icon: Info },
    ]

    // ESC key close support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs select-none">
                    {/* Backdrop Click */}
                    <div className="absolute inset-0 w-full h-full" onClick={onClose} />

                    {/* Modal Frame */}
                    <motion.div
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.96, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="relative w-full max-w-4xl h-[75vh] min-h-[480px] bg-[#191919] border border-white/5 rounded-lg flex overflow-hidden shadow-2xl z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button in top-right */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors cursor-pointer z-20"
                            aria-label="Close settings"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Sidebar (Left side of modal) */}
                        <aside className="w-60 bg-[#1f1f1f] border-r border-white/5 flex flex-col p-4 select-none shrink-0">
                            {/* Profile details */}
                            <div className="mb-6 px-2 flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-neutral-950 font-bold text-xs select-none">
                                    SN
                                </div>
                                <div className="truncate">
                                    <h4 className="text-xs font-bold text-neutral-200">Sean Nachapat</h4>
                                    <p className="text-[9px] text-neutral-500 truncate leading-none">Personal Account</p>
                                </div>
                            </div>

                            {/* Section Header */}
                            <div className="text-[10px] font-bold text-neutral-500 tracking-wider uppercase px-2 mb-2">
                                Settings
                            </div>

                            {/* Categories navigation list */}
                            <nav className="flex-1 space-y-0.5">
                                {sections.map((section) => {
                                    const Icon = section.icon
                                    const isActive = activeSection === section.id
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-all font-semibold ${isActive
                                                    ? "bg-white/5 text-neutral-200"
                                                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                                                }`}
                                        >
                                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neutral-300' : 'text-neutral-500'}`} />
                                            <span>{section.label}</span>
                                        </button>
                                    )
                                })}
                            </nav>
                        </aside>

                        {/* Content Area (Right side of modal) */}
                        <main className="flex-1 bg-[#191919] p-10 overflow-y-auto custom-scrollbar select-text">
                            <AnimatePresence mode="wait">
                                {activeSection === "general" && (
                                    <motion.div
                                        key="general"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-200 mb-1">{t.general.title}</h2>
                                            <p className="text-xs text-neutral-500">{t.general.desc}</p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Appearance setting */}
                                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                                <div>
                                                    <h3 className="text-xs font-bold text-neutral-200 mb-0.5">{t.general.appearance}</h3>
                                                    <p className="text-[11px] text-neutral-500">{t.general.appearanceDesc}</p>
                                                </div>
                                                <select
                                                    value={settings.theme}
                                                    onChange={(e) => updateSettings({ theme: e.target.value })}
                                                    className="bg-neutral-900 border border-white/10 text-neutral-400 text-xs font-semibold rounded px-2.5 py-1.5 outline-none focus:border-amber-500/50 transition-colors w-32 cursor-pointer"
                                                    disabled={true}
                                                >
                                                    <option value="dark">Dark Mode</option>
                                                </select>
                                            </div>

                                            {/* Language setting */}
                                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                                <div>
                                                    <h3 className="text-xs font-bold text-neutral-200 mb-0.5">{t.general.language}</h3>
                                                    <p className="text-[11px] text-neutral-500">{t.general.languageDesc}</p>
                                                </div>
                                                <select
                                                    value={settings.language}
                                                    onChange={(e) => updateSettings({ language: e.target.value })}
                                                    className="bg-neutral-900 border border-white/10 text-neutral-200 text-xs font-semibold rounded px-2.5 py-1.5 outline-none focus:border-amber-500/50 transition-colors cursor-pointer"
                                                >
                                                    <option value="en">English (US)</option>
                                                    <option value="th">ไทย (Thai)</option>
                                                    <option value="zh">中文 (Chinese)</option>
                                                    <option value="ja">日本語 (Japanese)</option>
                                                </select>
                                            </div>

                                            {/* Toggles settings */}
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <label className="text-xs font-bold text-neutral-200 block mb-0.5">{t.general.autoLaunch}</label>
                                                        <p className="text-[11px] text-neutral-500">{t.general.autoLaunchDesc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ autoStart: !settings.autoStart })}
                                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${settings.autoStart ? "bg-amber-500" : "bg-neutral-800"}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.autoStart ? "translate-x-4" : "translate-x-0"}`} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <label className="text-xs font-bold text-neutral-200 block mb-0.5">{t.general.reducedMotion}</label>
                                                        <p className="text-[11px] text-neutral-500">{t.general.reducedMotionDesc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                                                        className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${settings.reducedMotion ? "bg-amber-500" : "bg-neutral-800"}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.reducedMotion ? "translate-x-4" : "translate-x-0"}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeSection === "persona" && (
                                    <motion.div
                                        key="persona"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-200 mb-1">{t.persona.title}</h2>
                                            <p className="text-xs text-neutral-500">{t.persona.desc}</p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Personality Slider */}
                                            <div className="border border-white/5 bg-[#272727]/20 p-5 rounded-lg space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200">{t.persona.personality}</h3>
                                                        <p className="text-[10px] text-neutral-500">{t.persona.personalityDesc}</p>
                                                    </div>
                                                </div>
                                                <div className="px-1">
                                                    <div className="flex justify-between text-[11px] text-neutral-400 mb-2 font-medium">
                                                        <span>{t.persona.labels.strict}</span>
                                                        <span>{t.persona.labels.creative}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={settings.personality}
                                                        onChange={(e) => updateSettings({ personality: parseInt(e.target.value) })}
                                                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Verbosity Slider */}
                                            <div className="border border-white/5 bg-[#272727]/20 p-5 rounded-lg space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                                                        <MessageSquare className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200">{t.persona.responses}</h3>
                                                        <p className="text-[10px] text-neutral-500">{t.persona.responsesDesc}</p>
                                                    </div>
                                                </div>
                                                <div className="px-1">
                                                    <div className="flex justify-between text-[11px] text-neutral-400 mb-2 font-medium">
                                                        <span>{t.persona.labels.concise}</span>
                                                        <span>{t.persona.labels.verbose}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={settings.responses}
                                                        onChange={(e) => updateSettings({ responses: parseInt(e.target.value) })}
                                                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeSection === "memory" && (
                                    <motion.div
                                        key="memory"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-200 mb-1">Memory Module</h2>
                                            <p className="text-xs text-neutral-500">Manage the agent's long-term memory and context.</p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Cache status info */}
                                            <div className="border border-white/5 bg-[#272727]/20 p-5 rounded-lg relative overflow-hidden min-h-[140px] flex flex-col justify-center">
                                                {sizeCache.percent === null ? (
                                                    <div className="animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
                                                                <div className="h-4 w-20 bg-white/10 rounded"></div>
                                                            </div>
                                                            <div className="h-8 w-24 bg-white/10 rounded"></div>
                                                        </div>
                                                        <div className="flex-1 max-w-xs space-y-2">
                                                            <div className="h-2 w-full bg-neutral-800 rounded-full"></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className={`p-1.5 rounded-lg ${getStatusColor(sizeCache.status).bgSoft} ${getStatusColor(sizeCache.status).text}`}>
                                                                    <Database className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="text-xs font-bold text-neutral-200">Cache Status</h3>
                                                            </div>
                                                            <div className="flex items-baseline gap-1.5">
                                                                <div className="text-4xl font-extrabold tracking-tight text-white">
                                                                    {sizeCache.size}
                                                                </div>
                                                                <span className="text-xs text-neutral-500 font-bold font-mono">MB</span>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-500 mt-1">Local Vector Storage Usage</p>
                                                        </div>
                                                        <div className="flex-1 max-w-xs">
                                                            <div className="flex justify-between text-[11px] font-semibold mb-2">
                                                                <span className="text-neutral-400">Usage</span>
                                                                <span className={`${getStatusColor(sizeCache.status).text} font-mono`}>
                                                                    {Number(sizeCache?.percent).toFixed(1)}%
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${getStatusColor(sizeCache.status).bg} rounded-full transition-all duration-750 ease-out`}
                                                                    style={{ width: `${sizeCache?.percent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Purge database */}
                                            <button
                                                onClick={handleClearMemory}
                                                disabled={clearing}
                                                className="w-full group bg-red-500/5 border border-red-500/10 p-5 rounded-lg flex items-center justify-between hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer relative overflow-hidden"
                                            >
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="p-3 rounded-lg bg-red-500/10 text-red-500 group-hover:scale-105 transition-transform shrink-0">
                                                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="text-xs font-bold text-red-400 group-hover:text-red-300 mb-0.5">
                                                            {clearing ? "Data Purge in Progress..." : "Purge Entire Memory"}
                                                        </h3>
                                                        <p className="text-[10px] text-neutral-500">Irreversible action. Clears all context & vector database.</p>
                                                    </div>
                                                </div>
                                                <div className="relative z-10 w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </div>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {activeSection === "connections" && (
                                    <motion.div
                                        key="connections"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-200 mb-1">Connections & MCP</h2>
                                            <p className="text-xs text-neutral-500">Connect external accounts and Model Context Protocol servers.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Google Calendar sync */}
                                            <div className="bg-[#272727]/20 border border-white/5 p-4 rounded-lg flex items-center justify-between group hover:border-white/10 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-base overflow-hidden p-1 shrink-0">
                                                        <svg viewBox="0 0 24 24" className="w-full h-full">
                                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200">Google Calendar</h3>
                                                        <p className="text-[10px] text-neutral-500">Sync sessions to your calendar</p>
                                                    </div>
                                                </div>
                                                {mcpStatus.google_calendar.connected ? (
                                                    <button
                                                        onClick={async () => {
                                                            await window.electron.invoke("mcp-disconnect", { provider: "google_calendar" });
                                                            setMcpStatus(prev => ({ ...prev, google_calendar: { connected: false } }));
                                                        }}
                                                        className="px-3 py-1 rounded text-[11px] font-semibold transition-colors border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 cursor-pointer"
                                                    >
                                                        Connected
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => window.electron.invoke("mcp-open-google-auth")}
                                                        className="px-3 py-1 rounded text-[11px] font-semibold transition-colors border bg-white/5 border-white/5 text-white hover:bg-white/10 cursor-pointer"
                                                    >
                                                        Connect
                                                    </button>
                                                )}
                                            </div>

                                            {/* Notion sync */}
                                            <div className="bg-[#272727]/20 border border-white/5 p-4 rounded-lg flex items-center justify-between group hover:border-white/10 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-extrabold text-base shrink-0">
                                                        N
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200">Notion</h3>
                                                        <p className="text-[10px] text-neutral-500">Save notes to your workspace</p>
                                                    </div>
                                                </div>
                                                {mcpStatus.notion.connected ? (
                                                    <button
                                                        onClick={async () => {
                                                            await window.electron.invoke("mcp-disconnect", { provider: "notion" });
                                                            setMcpStatus(prev => ({ ...prev, notion: { connected: false } }));
                                                        }}
                                                        className="px-3 py-1 rounded text-[11px] font-semibold transition-colors border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 cursor-pointer"
                                                    >
                                                        Connected
                                                    </button>
                                                ) : (
                                                    <button
                                                        disabled
                                                        className="px-3 py-1 rounded text-[11px] font-semibold transition-colors border bg-white/5 border-white/5 text-neutral-600 cursor-not-allowed"
                                                    >
                                                        Connect
                                                    </button>
                                                )}
                                            </div>

                                            {/* Server Status */}
                                            <div className={`bg-[#272727]/20 border ${serverStatus.online ? 'border-emerald-500/20' : 'border-amber-500/20'} p-4 rounded-lg transition-all duration-300`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg ${serverStatus.online ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'} border flex items-center justify-center transition-colors duration-300 shrink-0`}>
                                                            <Link2 className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xs font-bold text-neutral-200">Ducksy Server</h3>
                                                            <p className="text-[10px] text-neutral-500 font-mono">API Gateway</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0">
                                                        {serverStatus.checking ? (
                                                            <span className="text-[10px] text-neutral-400 animate-pulse font-mono">Checking...</span>
                                                        ) : serverStatus.online ? (
                                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded-full border border-emerald-500/20 flex items-center gap-1">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                ONLINE
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[9px] font-bold rounded-full border border-red-500/20 flex items-center gap-1">
                                                                <span className="w-1 h-1 rounded-full bg-red-500"></span>
                                                                OFFLINE
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeSection === "info" && (
                                    <motion.div
                                        key="info"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="space-y-8"
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold text-neutral-200 mb-1">Info & About</h2>
                                            <p className="text-xs text-neutral-500">System information and application details.</p>
                                        </div>

                                        <div className="space-y-6">
                                            {/* Logo card block */}
                                            <div className="bg-[#272727]/20 border border-white/5 p-5 rounded-lg flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0">
                                                        <img src="/ducksy-logo.svg" alt="Ducksy Logo" className="w-full h-full object-contain" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-neutral-200">Ducksy Workspace</h3>
                                                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">v1.2.0-alpha</p>
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-neutral-500 font-mono uppercase">Electron</span>
                                                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-neutral-500 font-mono uppercase">React</span>
                                                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-neutral-500 font-mono uppercase">Gemini 3</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="hidden md:block text-right shrink-0 font-mono text-[9px]">
                                                    <p className="text-neutral-600 mb-0.5 uppercase tracking-wider font-semibold">BUILD ID</p>
                                                    <p className="text-neutral-400">8f314e4-aa5a</p>
                                                </div>
                                            </div>

                                            {/* Links blocks */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Link href="https://github.com/SeanNachapat/Ducksy-Gemini-3-Hackathon-2026" target="_blank" className="group bg-[#272727]/20 border border-white/5 p-4 rounded-lg flex flex-col gap-2 hover:bg-white/5 hover:border-white/10 transition-all">
                                                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
                                                        <Github className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200 mb-0.5 group-hover:text-amber-400 transition-colors">View Source</h3>
                                                        <p className="text-[10px] text-neutral-500">Explore the codebase on GitHub</p>
                                                    </div>
                                                </Link>
                                                <Link href="https://github.com/SeanNachapat/Ducksy-Gemini-3-Hackathon-2026/issues" target="_blank" className="group bg-[#272727]/20 border border-white/5 p-4 rounded-lg flex flex-col gap-2 hover:bg-white/5 hover:border-white/10 transition-all">
                                                    <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0">
                                                        <Bug className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold text-neutral-200 mb-0.5 group-hover:text-red-400 transition-colors">Report Issue</h3>
                                                        <p className="text-[10px] text-neutral-500">Found a bug? Let us know.</p>
                                                    </div>
                                                </Link>
                                            </div>

                                            {/* Meet the Builders accordion */}
                                            <div>
                                                <button
                                                    onClick={() => setShowBuilders(!showBuilders)}
                                                    className="w-full group relative overflow-hidden bg-[#272727]/20 border border-white/5 p-5 rounded-lg flex items-center justify-between hover:border-amber-500/30 transition-all text-left cursor-pointer"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                                    <div className="flex items-center gap-3 relative z-10">
                                                        <div className="p-2 rounded bg-amber-500/10 text-amber-500 group-hover:text-amber-400 transition-colors shrink-0">
                                                            <Sparkles className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xs font-bold text-neutral-200 group-hover:text-amber-400 transition-colors">Meet the Builders</h3>
                                                            <p className="text-[10px] text-neutral-500">The human minds behind the AI</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 group-hover:bg-amber-500 group-hover:text-black transition-all relative z-10 shrink-0 ${showBuilders ? "rotate-90 bg-amber-500 text-black" : ""}`}>
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>

                                                <AnimatePresence>
                                                    {showBuilders && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                                            animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                                                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                                            className="overflow-hidden space-y-3"
                                                        >
                                                            {contributors.length > 0 ? (
                                                                contributors.map((contributor) => (
                                                                    <div key={contributor.id} className="bg-[#272727]/20 border border-white/5 p-4 rounded-lg flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-base font-bold text-neutral-500 border border-white/5 overflow-hidden shrink-0">
                                                                            <img src={contributor.avatar_url} alt={contributor.login} className="w-full h-full object-cover" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                                                <h4 className="text-xs font-bold text-neutral-200">{contributor.name || contributor.login}</h4>
                                                                                {contributor.login === "SeanNachapat" && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase tracking-wide">Lead</span>}
                                                                            </div>
                                                                            <p className="text-[9px] text-neutral-500">@{contributor.login}</p>
                                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                                <a href={contributor.html_url} target="_blank" className="inline-flex text-neutral-500 hover:text-white transition-colors" title="GitHub"><Github className="w-3 h-3" /></a>
                                                                                {contributor.twitter_username && (
                                                                                    <a href={`https://twitter.com/${contributor.twitter_username}`} target="_blank" className="inline-flex text-neutral-500 hover:text-sky-400 transition-colors" title="Twitter">
                                                                                        <Twitter className="w-3 h-3" />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="text-center text-neutral-500 text-[10px] py-4 font-mono">Loading contributors...</div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </main>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
