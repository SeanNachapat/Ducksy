"use client"
import React, { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import WindowControls from "@/components/WindowControls"

export default function GlobalWindowFrame({ children }) {
    const [platform, setPlatform] = useState("mac")
    const pathname = usePathname()
    const isLanding = pathname === "/"
    const isOverlay = pathname?.toLowerCase().includes('onrecord') || 
                      (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('onrecord'))
    const isInit = pathname?.startsWith("/init")

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase()
        if (userAgent.includes("win")) {
            setPlatform("windows")
        }
    }, [])

    if (isOverlay) {
        return (
            <div className="h-screen w-screen bg-transparent">
                {children}
            </div>
        )
    }

    if (platform === 'mac') {
        return (
            <div className="relative h-screen flex flex-col overflow-hidden">
                <div className="flex-1 w-full h-full">
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-screen flex flex-col overflow-hidden">
            {!isLanding && !isInit && (
                <div className={`fixed top-0 w-full z-50 flex items-center h-10 bg-transparent pointer-events-none ${platform === 'windows' ? 'justify-end pr-4 pt-2 items-start' : 'justify-start pl-6 pt-4 items-start'}`} style={{ WebkitAppRegion: 'drag' }}>
                    <div className="pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' }}>
                        <WindowControls platform={platform} />
                    </div>
                </div>
            )}

            <div className="flex-1 w-full h-full">
                {children}
            </div>
        </div>
    )
}
