import React, { useEffect, useRef } from 'react';

interface LogEntry {
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'crypto' | 'network';
    message: string;
}

interface LogViewerProps {
    logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const getColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return 'text-green-600';
            case 'error': return 'text-red-600';
            case 'crypto': return 'text-purple-600';
            case 'network': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="flex flex-col h-64 border-t border-gray-200 bg-gray-50 font-mono text-xs">
            <div className="px-4 py-2 border-b border-gray-200 bg-white flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase tracking-widest">System Logs</span>
                <span className="text-gray-400">{logs.length} events</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {logs.length === 0 && (
                    <div className="text-gray-400 italic">No activity yet. Connect to a phase to begin.</div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 hover:bg-gray-100 p-0.5 rounded">
                        <span className="text-gray-400 shrink-0">
                            {log.timestamp.toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                        </span>
                        <span className={`break-all ${getColor(log.type)}`}>
                            {log.type === 'crypto' && <span className="font-bold mr-2">[CRYPTO]</span>}
                            {log.type === 'network' && <span className="font-bold mr-2">[NET]</span>}
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};
