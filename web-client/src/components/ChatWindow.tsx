import React, { useState, useEffect, useRef } from 'react';
import { Send, Lock, User, RefreshCw } from 'lucide-react';

interface Message {
    id: string;
    sender: string;
    text: string;
    isOwn: boolean;
    isSystem?: boolean;
    timestamp: Date;
    isEncrypted?: boolean;
}

interface User {
    id: string;
    hasKey?: boolean;
    hasCert?: boolean;
}

interface ChatWindowProps {
    messages: Message[];
    connected: boolean;
    users: User[];
    myId: string;
    targetId: string | null;
    onSendMessage: (text: string) => void;
    onConnectToUser: (userId: string) => void;
    phase: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    messages, connected, users, myId, targetId, onSendMessage, onConnectToUser, phase
}) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="flex flex-1 h-full bg-white relative">
            {/* Sidebar: Users */}
            <div className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col hidden md:flex">
                <div className="p-4 border-b border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Online Users</h3>
                    <div className="text-xs text-gray-400 truncate">My ID: <span className="text-black font-mono">{myId || '...'}</span></div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {users.filter(u => u.id !== myId).map(user => (
                        <button
                            key={user.id}
                            onClick={() => onConnectToUser(user.id)}
                            className={`w-full text-left p-2 rounded flex items-center justify-between text-sm mb-1 ${targetId === user.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            <span className="font-mono">{user.id}</span>
                            {phase >= 2 && (
                                <div className="flex gap-1">
                                    {(user.hasKey || user.hasCert) && <Lock size={12} className="text-green-500" />}
                                </div>
                            )}
                        </button>
                    ))}
                    {users.length <= 1 && (
                        <div className="text-xs text-center text-gray-400 mt-4">No other users online.</div>
                    )}
                </div>
            </div>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col relative w-full">
                {!connected && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="text-center">
                            <RefreshCw className="animate-spin mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">Connecting to server...</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-gray-700">
                            {targetId ? `Secure Chat with ${targetId}` : 'Broadcast / Lobby'}
                        </span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.isSystem
                                    ? 'bg-gray-100 text-gray-500 text-xs w-full text-center shadow-none'
                                    : msg.isOwn
                                        ? 'bg-black text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                {!msg.isSystem && !msg.isOwn && (
                                    <div className="text-[10px] text-gray-400 mb-1 font-mono">{msg.sender}</div>
                                )}
                                {msg.text}
                                {msg.isEncrypted && <Lock size={10} className="inline ml-2 opacity-50" />}
                            </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={targetId ? `Message ${targetId}...` : "Broadcast message..."}
                            className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all pr-12"
                            disabled={!connected}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || !connected}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-black transition-colors"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
