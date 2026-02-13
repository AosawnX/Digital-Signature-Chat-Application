import React, { useState, useEffect } from 'react';
import { Settings, X, Save, Server, Globe } from 'lucide-react';

interface ConnectionSettingsProps {
    serverUrl: string;
    usePorts: boolean;
    onSave: (url: string, usePorts: boolean) => void;
}

export const ConnectionSettings: React.FC<ConnectionSettingsProps> = ({ serverUrl, usePorts, onSave }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [url, setUrl] = useState(serverUrl);
    const [portsMode, setPortsMode] = useState(usePorts);

    // Sync when props change (if updated from parent)
    useEffect(() => {
        setUrl(serverUrl);
        setPortsMode(usePorts);
    }, [serverUrl, usePorts]);

    const handleSave = () => {
        let cleanUrl = url.trim();
        // Auto-add prefix if missing (heuristic)
        if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
            // Default to ws:// for IPs, wss:// for domains? Hard to guess.
            // Let's just default to ws:// if localhost or IP, wss:// otherwise?
            // Safer to just ask user, or default to ws:// since that's our current setup.
            cleanUrl = `ws://${cleanUrl}`;
        }
        // Remove trailing slash
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        setUrl(cleanUrl); // Update state
        onSave(cleanUrl, portsMode);
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all hover:scale-110"
                title="Connection Settings"
            >
                <Settings size={20} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Server size={18} />
                        Connection Settings
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Server Base URL</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="ws://localhost or wss://api.example.com"
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            The base address of your WebSocket server.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Routing Mode</label>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPortsMode(true)}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${portsMode
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                            >
                                <div className="font-bold mb-1">Port-Based</div>
                                <div className="text-xs opacity-75">ws://host:8080</div>
                                <div className="text-xs opacity-75">For Localhost</div>
                            </button>

                            <button
                                onClick={() => setPortsMode(false)}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${!portsMode
                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                            >
                                <div className="font-bold mb-1">Path-Based</div>
                                <div className="text-xs opacity-75">wss://host/phase1</div>
                                <div className="text-xs opacity-75">For Deployment</div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
                    >
                        <Save size={16} />
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};
