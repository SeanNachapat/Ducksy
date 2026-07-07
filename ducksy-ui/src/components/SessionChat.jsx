import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSettings } from "@/hooks/SettingsContext";

export default function SessionChat({ fileId, initialHistory = [] }) {
    const { settings } = useSettings();
    const [history, setHistory] = useState(Array.isArray(initialHistory) ? initialHistory : []);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        setHistory(Array.isArray(initialHistory) ? initialHistory : []);
    }, [initialHistory]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, loading]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setLoading(true);
        setError(null);

        setHistory(prev => [...prev, { role: 'user', content: userMsg, timestamp: Date.now() }]);

        if (window.electron) {
            try {
                const result = await window.electron.invoke('chat-session', { fileId, message: userMsg, settings });
                if (result.success) {
                    setHistory(result.history);
                } else {
                    setError(result.error || 'Failed to send message');
                }
            } catch (err) {
                setError('Communication error');
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#171717]/80 rounded-2xl border border-white/5 overflow-hidden shadow-xl">
            <div className="p-3.5 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                    <Bot className="w-3.5 h-3.5 text-amber-500" />
                    Session Assistant
                </h3>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4.5 space-y-4.5 min-h-[220px] max-h-[400px] custom-scrollbar"
            >
                {history.length === 0 && (
                    <div className="text-center text-neutral-500 text-xs py-8">
                        <p>Ask anything about this session context.</p>
                    </div>
                )}

                {history.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-white/5 border-white/5 text-neutral-400'}`}>
                            {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className={`p-3.5 rounded-2xl text-[13px] leading-relaxed max-w-[80%] shadow-md ${msg.role === 'user'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-tr-xs shadow-[0_2px_12px_rgba(245,158,11,0.1)]'
                            : 'bg-white/[0.02] text-neutral-200 border border-white/5 rounded-tl-xs'
                            }`}>
                            {msg.role === 'user' ? (
                                msg.content
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="ml-1" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props} />,
                                        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-white/30 pl-3 italic my-2 text-white/70" {...props} />,
                                        code: ({ node, inline, className, children, ...props }) => {
                                            return inline ? (
                                                <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-xs text-amber-200" {...props}>
                                                    {children}
                                                </code>
                                            ) : (
                                                <div className="bg-black/30 p-2 rounded-lg my-2 overflow-x-auto border border-white/10">
                                                    <code className="font-mono text-xs text-amber-200 block whitespace-pre" {...props}>
                                                        {children}
                                                    </code>
                                                </div>
                                            )
                                        },
                                        a: ({ node, ...props }) => <a className="text-amber-400 hover:text-amber-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
                                        table: ({ node, ...props }) => <div className="overflow-x-auto my-2 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10" {...props} /></div>,
                                        th: ({ node, ...props }) => <th className="bg-white/5 px-3 py-2 text-left text-xs font-medium text-white uppercase tracking-wider" {...props} />,
                                        td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-nowrap text-xs text-neutral-300 border-t border-white/5" {...props} />,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            )}
                        </div>
                    </motion.div>
                ))}

                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                        <div className="w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 border bg-white/5 border-white/5 text-neutral-400">
                            <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 text-neutral-400 rounded-2xl rounded-tl-xs p-3.5 flex items-center gap-2 text-xs shadow-sm">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                            <span className="text-xs">Thinking...</span>
                        </div>
                    </motion.div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs justify-center p-2 bg-red-500/10 rounded-lg">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="p-3.5 border-t border-white/5 bg-neutral-950/20 flex gap-2.5 items-center">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 bg-neutral-950/40 border border-white/5 hover:border-white/10 focus:border-amber-500/30 focus:bg-neutral-950/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-amber-500 text-neutral-950 rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_2px_12px_rgba(245,158,11,0.15)] flex items-center justify-center cursor-pointer shrink-0"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
            </form>
        </div>
    );
}
