import React, { useState, useEffect, useRef } from 'react';
import { useAppMessage, useDaily } from '@daily-co/daily-react';
import { Send, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
    id: string;
    sender: {
        username: string;
        displayName?: string;
        pfpUrl?: string;
    };
    text: string;
    timestamp: number;
}

interface SpaceChatProps {
    currentUser: {
        username: string;
        displayName?: string;
        pfpUrl?: string;
    };
}

const SpaceChat = ({ currentUser }: SpaceChatProps) => {
    const daily = useDaily();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendAppMessage = useAppMessage({
        onAppMessage: (ev) => {
            if (ev.data.type === 'chat-message') {
                const newMessage = ev.data.payload as ChatMessage;
                setMessages((prev) => [...prev, newMessage]);
            }
        },
    });

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !daily) return;

        const newMessage: ChatMessage = {
            id: crypto.randomUUID(),
            sender: currentUser,
            text: inputValue.trim(),
            timestamp: Date.now(),
        };

        // Send to others
        daily.sendAppMessage({
            type: 'chat-message',
            payload: newMessage,
        });

        // Add to local state
        setMessages((prev) => [...prev, newMessage]);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-80 lg:w-96">
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white">Space Chat</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const isMe = msg.sender.username === currentUser.username;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <div className="flex-shrink-0">
                                    {msg.sender.pfpUrl ? (
                                        <img
                                            src={msg.sender.pfpUrl}
                                            alt={msg.sender.username}
                                            className="w-8 h-8 rounded-full border border-slate-700"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                                            <UserIcon className="w-4 h-4 text-slate-400" />
                                        </div>
                                    )}
                                </div>
                                <div
                                    className={`flex flex-col max-w-[80%] ${
                                        isMe ? 'items-end' : 'items-start'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-slate-400 font-medium">
                                            {msg.sender.displayName || msg.sender.username}
                                        </span>
                                        <span className="text-[10px] text-slate-600">
                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    <div
                                        className={`px-3 py-2 rounded-2xl text-sm ${
                                            isMe
                                                ? 'bg-purple-600 text-white rounded-tr-none'
                                                : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                        }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900">
                <div className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-slate-700"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-full text-white hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SpaceChat;
