import React from 'react';
import { Network, Shield, Lock, Clock, FileBadge } from 'lucide-react';

interface PhaseSelectorProps {
    currentPhase: number;
    onSelectPhase: (phase: number) => void;
}

export const PhaseSelector: React.FC<PhaseSelectorProps> = ({ currentPhase, onSelectPhase }) => {
    const phases = [
        { id: 1, name: 'Plain WebSocket', icon: Network, desc: 'Unencrypted, Vulnerable' },
        { id: 2, name: 'Digital Signatures', icon: Shield, desc: 'Authenticated, Integrity' },
        { id: 3, name: 'Hybrid Encryption', icon: Lock, desc: 'Confidentiality (AES+RSA)' },
        { id: 4, name: 'Replay Protection', icon: Clock, desc: 'Timestamps & Nonces' },
        { id: 5, name: 'Auth Key Exchange', icon: FileBadge, desc: 'Certificates (Mini-CA)' },
    ];

    return (
        <div className="flex flex-col md:flex-col flex-row gap-2 p-2 md:p-4 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 h-auto md:h-full w-full md:w-64 overflow-x-auto md:overflow-visible shrink-0">
            <h2 className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Protocol Phase</h2>
            <div className="flex flex-row md:flex-col gap-2 min-w-max md:min-w-0">
                {phases.map((phase) => {
                    const Icon = phase.icon;
                    const isActive = currentPhase === phase.id;
                    return (
                        <button
                            key={phase.id}
                            onClick={() => onSelectPhase(phase.id)}
                            className={`text-left p-2 md:p-3 rounded-lg transition-all duration-200 group flex items-center gap-3 ${isActive
                                ? 'bg-black text-white shadow-lg'
                                : 'hover:bg-gray-200 text-gray-700 bg-white md:bg-transparent border md:border-none border-gray-200'
                                }`}
                        >
                            <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                            <div className="flex flex-col">
                                <span className="font-medium text-sm whitespace-nowrap">{phase.name}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
            {/* Desktop Descriptions (Hidden on Mobile) */}
            <div className="hidden md:block mt-4 text-xs text-gray-400 px-2">
                {phases.find(p => p.id === currentPhase)?.desc}
            </div>
        </div>
    );
};
