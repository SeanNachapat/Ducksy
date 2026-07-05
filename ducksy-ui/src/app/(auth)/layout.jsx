"use client"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { 
    Layout, 
    Search, 
    Settings, 
    FileText, 
    Bug, 
    Image as ImageIcon, 
    Activity, 
    ChevronDown, 
    Sparkles, 
    PlusCircle,
    User,
    LogOut,
    Home,
    Mic,
    HelpCircle,
    ChevronRight,
    MessageSquare,
    Globe,
    Database,
    ChevronLeft
} from "lucide-react"
import { useSettings } from "@/hooks/SettingsContext"
import { useSessionLogs } from "@/hooks/useSessionLogs"
import SettingsModal from "@/components/SettingsModal"

export default function AuthLayout({ children }) {
    const pathname = usePathname()
    const router = useRouter()
    const { t, settings } = useSettings()
    const { sessionLogs, isLoading } = useSessionLogs()
    const [recentSessions, setRecentSessions] = useState([])
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Update recent sessions
    useEffect(() => {
        if (sessionLogs && sessionLogs.length > 0) {
            setRecentSessions(sessionLogs.slice(0, 5))
        } else {
            setRecentSessions([])
        }
    }, [sessionLogs])

    const getSessionIcon = (type) => {
        switch (type) {
            case 'summary':
                return <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-400 transition-colors" />
            case 'debug':
                return <Bug className="w-3.5 h-3.5 text-neutral-400 group-hover:text-red-400 transition-colors" />
            case 'image':
                return <ImageIcon className="w-3.5 h-3.5 text-neutral-400 group-hover:text-purple-400 transition-colors" />
            default:
                return <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-400 transition-colors" />
        }
    }

    // Handlers for quick actions
    const handleQuickSearch = () => {
        // Focus the search input on the dashboard if we are there, or redirect
        const searchInput = document.querySelector('input[placeholder*="Search"]')
        if (searchInput) {
            searchInput.focus()
        } else {
            router.push('/sessions')
        }
    }

    const handleNewRecording = () => {
        if (typeof window !== 'undefined' && window.electron) {
            window.electron.send('open-overlay')
        }
    }

    const isRecordRoute = pathname?.toLowerCase().includes('onrecord') || 
                          (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('onrecord'))

    if (isRecordRoute) {
        return (
            <div className="h-screen w-screen bg-transparent overflow-hidden select-none">
                {children}
            </div>
        )
    }

    return (
        <div className="flex h-screen w-screen bg-[#191919] text-neutral-200 font-sans overflow-hidden select-none relative">
            {/* Left Notion Sidebar */}
            <aside 
                className="flex flex-col h-full bg-[#191919] text-[14px] text-neutral-400 font-medium select-none z-30 shrink-0 transition-all duration-300 ease-in-out border-r border-white/5 overflow-hidden"
                style={{ 
                    width: isCollapsed ? 0 : 256, 
                    minWidth: isCollapsed ? 0 : 256,
                    opacity: isCollapsed ? 0 : 1,
                    borderRightWidth: isCollapsed ? 0 : 1
                }}
            >
                {/* Header Logo & Collapse Trigger */}
                <div className="p-4 flex items-center justify-between border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 font-bold text-sm">
                            🦆
                        </div>
                        <div className="truncate">
                            <h2 className="text-xs font-bold text-neutral-200 leading-tight">Ducksy</h2>
                            <p className="text-[8px] text-neutral-500 font-mono tracking-wide leading-none mt-0.5">V3.5.0</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsCollapsed(true)}
                        className="p-1 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-all cursor-pointer shrink-0"
                        title="Collapse Sidebar"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                </div>


                {/* Quick Actions */}
                <div className="px-3 py-1 space-y-0.5">
                    <button 
                        onClick={handleQuickSearch}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-left text-neutral-400 hover:text-neutral-200 transition-all group"
                    >
                        <Search className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                        <span className="flex-1 truncate">Search</span>
                        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] font-medium text-neutral-500 opacity-100">
                            <span className="text-[10px]">⌘</span>K
                        </kbd>
                    </button>

                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all group ${isSettingsOpen ? 'bg-white/5 text-neutral-200' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}
                    >
                        <Settings className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                        <span>Settings</span>
                    </button>

                    <button 
                        onClick={handleNewRecording}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-left text-neutral-400 hover:text-neutral-200 transition-all group"
                    >
                        <PlusCircle className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                        <span>New Recording</span>
                    </button>
                </div>

                <span className="h-px bg-white/5 my-2 mx-3" />

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto px-3 space-y-4 py-2 custom-scrollbar">
                    {/* General Section */}
                    <div className="space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                            Pages
                        </div>
                        <Link href="/dashboard" className="block">
                            <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/dashboard' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <Home className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                <span>Dashboard</span>
                            </div>
                        </Link>

                        <Link href="/agent-chat" className="block">
                            <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/agent-chat' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <MessageSquare className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                <span>Agent Playground</span>
                            </div>
                        </Link>

                        <Link href="/research" className="block">
                            <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/research' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <Globe className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                <span>Deep Research</span>
                            </div>
                        </Link>

                        <Link href="/documents" className="block">
                            <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/documents' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <FileText className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                <span>Document Editor</span>
                            </div>
                        </Link>

                        <Link href="/model-gallery" className="block">
                            <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/model-gallery' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <Database className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                <span>Model Gallery</span>
                            </div>
                        </Link>
                        
                        <Link href="/sessions" className="block">
                            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all group cursor-pointer ${pathname === '/sessions' ? 'bg-white/5 text-neutral-200 font-semibold' : 'hover:bg-white/5 text-neutral-400 hover:text-neutral-200'}`}>
                                <div className="flex items-center gap-2.5">
                                    <Activity className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300" />
                                    <span>Sessions</span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500 group-hover:text-neutral-300 font-mono">
                                    {sessionLogs?.length || 0}
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Sub-pages Tree: Recent Sessions */}
                    {recentSessions.length > 0 && (
                        <div className="space-y-0.5">
                            <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-600 uppercase tracking-widest flex items-center justify-between group">
                                <span>Recent Sessions</span>
                            </div>
                            <div className="pl-2.5 border-l border-white/5 ml-4.5 space-y-0.5">
                                {recentSessions.map((session) => (
                                    <Link key={session.id} href={`/sessions?fileId=${session.fileId}`} className="block">
                                        <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-all text-xs cursor-pointer group truncate">
                                            {getSessionIcon(session.type)}
                                            <span className="truncate flex-1 font-normal">{session.title || "Untitled Session"}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>


            </aside>

            {/* Main Canvas content */}
            <div className="flex-1 flex flex-col h-full bg-[#202020] relative overflow-hidden select-text">
                {isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="absolute top-4 left-4 z-40 p-1.5 rounded-lg border border-white/5 bg-[#191919] hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-lg flex items-center justify-center"
                        title="Expand Sidebar"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
                {children}
            </div>

            {/* Notion-Style Settings Dialog */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    )
}
