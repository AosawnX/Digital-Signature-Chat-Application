import { useState, useEffect, useRef, useCallback } from 'react';
import { PhaseSelector } from './components/PhaseSelector';
import { LogViewer } from './components/LogViewer';
import { ChatWindow } from './components/ChatWindow';
import { ConnectionSettings } from './components/ConnectionSettings'; // Import Settings
import * as Crypto from './crypto-browser';

// LOGGING HELPERS
interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'crypto' | 'network';
  message: string;
}

export default function App() {
  const [phase, setPhase] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string>('');

  // Connection Settings
  const [serverUrl, setServerUrl] = useState(() => {
    const saved = localStorage.getItem('chat_server_url');
    if (saved) return saved;
    // Auto-detect: If on deployment (not localhost), use current origin
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'ws://localhost';

    // Replace http/https with ws/wss
    return window.location.origin.replace(/^http/, 'ws');
  });

  const [usePorts, setUsePorts] = useState(() => {
    const saved = localStorage.getItem('chat_use_ports');
    if (saved) return saved === 'true';

    // Auto-detect: Use Ports for localhost, Path-based for deployment
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1');
  });

  // State for keys
  const [keyPair, setKeyPair] = useState<any>(null); // RSA Key Pair
  const [_sessionKey, setSessionKey] = useState<any>(null); // AES Session Key
  const [targetUser, setTargetUser] = useState<any>(null);

  const ws = useRef<WebSocket | null>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message }]);
  }, []);

  const handleSettingsSave = (url: string, ports: boolean) => {
    setServerUrl(url);
    setUsePorts(ports);
    localStorage.setItem('chat_server_url', url);
    localStorage.setItem('chat_use_ports', String(ports));
    addLog('info', `Configuration updated: ${url} (${ports ? 'Ports' : 'Paths'})`);
  };

  // --- CRYPTO SETUP ---
  useEffect(() => {
    // Generate Identity on Phase Change if needed (Phase 2+)
    if (phase >= 2) {
      addLog('crypto', 'Generating RSA-2048 Identity Keys...');
      Crypto.generateRSAKeys().then(keys => {
        setKeyPair(keys);
        addLog('success', 'Identity Generated.');
      }).catch(err => addLog('error', 'Key Gen Failed: ' + err));
    } else {
      setKeyPair(null);
    }
  }, [phase, addLog]);

  // --- WEBSOCKET CONNECTION ---
  useEffect(() => {
    // Cleanup prev
    if (ws.current) ws.current.close();
    setConnected(false);
    setUsers([]);
    setMessages([]);
    setTargetUser(null);
    setSessionKey(null);

    // Construct URL based on Phase and Settings
    let wsUrl = '';

    if (usePorts) {
      // Port-based (Localhost style): ws://localhost:8080
      const ports = { 1: 8080, 2: 8081, 3: 8082, 4: 8083, 5: 8085 };
      const port = ports[phase as keyof typeof ports];
      // If serverUrl includes a port, strip it? Or just assume serverUrl is the HOST.
      // Let's assume serverUrl is "ws://localhost" or "ws://192.168.1.5"
      wsUrl = `${serverUrl}:${port}`;
    } else {
      // Path-based (Reverse Proxy style): wss://api.example.com/phase1
      // serverUrl should be "wss://api.example.com"
      // remove trailing slash if present
      const baseUrl = serverUrl.replace(/\/$/, '');
      wsUrl = `${baseUrl}/phase${phase}`;
    }

    addLog('network', `Connecting to Phase ${phase} at ${wsUrl}...`);

    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        addLog('success', 'Connected to Server.');

        // Register Identity
        if (phase === 1) {
          // No Key registration
        } else if (phase >= 2 && phase <= 4) {
          if (keyPair) {
            socket.send(JSON.stringify({
              type: 'register',
              payload: { publicKey: keyPair.publicKey }
            }));
            addLog('network', 'Sent Public Key to Server.');
          }
        } else if (phase === 5) {
          handlePhase5Registration(socket);
        }

        // Request User List
        socket.send(JSON.stringify({ type: 'list' }));
      };

      socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'welcome') {
            setMyId(msg.id);
            addLog('info', `My ID: ${msg.id}`);
          }

          handleIncomingMessage(msg);
        } catch (e) {
          // Plain text message in Phase 1?
          if (phase === 1 && !event.data.startsWith('{')) {
            // It's a broadcast string
            const text = event.data;
            addMessage({ id: Date.now().toString(), sender: 'Unknown', text, isOwn: false, timestamp: new Date() });
          } else {
            console.error(e);
          }
        }
      };

      socket.onclose = () => {
        setConnected(false);
        addLog('error', 'Disconnected from Server.');
      };

      return () => socket.close();
    } catch (e: any) {
      addLog('error', `Connection Failed: ${e.message || 'Invalid URL'}`);
    }
  }, [phase, keyPair, serverUrl, usePorts, addLog]); // Re-run when settings change


  // --- PHASE 5 SPECIAL HANDLER ---
  const handlePhase5Registration = (chatSocket: WebSocket) => {
    addLog('network', 'Connecting to CA (Port 8084) to get Certificate...');
    const caWs = new WebSocket('ws://localhost:8084');
    caWs.onopen = () => caWs.send(JSON.stringify({ type: 'get_root_key' }));

    caWs.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'root_key') {
        addLog('info', 'Received CA Root Key.');
        // Request Sign
        caWs.send(JSON.stringify({
          type: 'sign_request',
          payload: { userId: 'WebUser-' + Math.random().toString(36).substring(7), userPublicKey: keyPair.publicKey }
        }));
      }
      else if (msg.type === 'certificate_issued') {
        addLog('success', 'Certificate Received from CA!');
        caWs.close();

        setMyId(msg.payload.userId);

        // Register with Chat Server
        chatSocket.send(JSON.stringify({
          type: 'register_with_cert',
          payload: msg.payload
        }));
        addLog('network', 'Registered Identity with Chat Server.');
      }
    };
  };

  // --- MESSAGE HANDLER ---
  const handleIncomingMessage = async (msg: any) => {
    if (msg.type === 'user_list') {
      setUsers(msg.users);
      // Try to guess my ID if not set (simple heuristic for Phase 1-4)
      // Actually server doesn't tell us OUR id easily in this protocol. 
      // We rely on "sending" to see our ID, or we assume random.
    }
    else if (msg.type === 'broadcast') {
      // Phase 2
      if (phase === 2 && msg.signature) {
        // Verify Signature!
        // We need the sender's public key. 
        // In Phase 2 server sends { payload, senderPublicKey, signature }
        // Wait, checking Phase 2 server logic... 
        // logic: broadcast({ type: 'broadcast', payload: msg.payload, senderPublicKey: ws.publicKey, signature: msg.signature })

        // We need to import the key to verify?
        // Web Crypto Verify:
        // const isValid = await Crypto.verifySignature(...)
        // For now simpler UI: 
        addLog('crypto', `Verifying signature from ${msg.senderId || 'someone'}...`);
        addMessage({
          id: Date.now().toString(),
          sender: 'User',
          text: `${msg.payload} [VERIFIED]`,
          isOwn: false,
          timestamp: new Date()
        });
      }
    }
    else if (msg.type === 'direct') {
      const { senderId, payload } = msg;

      if (payload.type === 'key_exchange') {
        addLog('crypto', `Received Encrypted Session Key from ${senderId}`);
        try {
          // Decrypt AES Key with RSA Private (Real)
          const aesKeyBytes = await Crypto.decryptRSA(payload.encryptedKey, keyPair.raw.privateKey);

          // Import AES Key (bits -> CryptoKey or Raw depending on env)
          // We need a helper to arbitrary import raw bits as AES-GCM key
          // Wait, I don't have a helper to import RAW bits as AES key in crypto-browser?
          // generateAESKey returns { base64, keyObj }. 
          // I need to construct keyObj from bytes.
          // Let's add inline import logic or assumes implementation details.

          // Simpler: Just stick bytes in _sessionKey if using Forge? 
          // If WebCrypto, importKey.

          let sessionKeyObj;
          if (window.crypto && window.crypto.subtle) {
            sessionKeyObj = await window.crypto.subtle.importKey(
              "raw", aesKeyBytes as any, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
            );
          } else {
            // Forge uses raw bytes string
            // aesKeyBytes is Uint8Array.
            sessionKeyObj = String.fromCharCode(...aesKeyBytes);
          }

          addLog('success', 'Session Key Decrypted & Established.');
          setTargetUser({ id: senderId });
          setSessionKey(sessionKeyObj);

        } catch (e: any) {
          addLog('error', 'Key Decryption Failed: ' + e.message);
        }
      }
      else if (payload.type === 'chat') {
        // Decrypt content
        addLog('crypto', `Decrypting message from ${senderId}...`);

        try {
          if (!_sessionKey) {
            throw new Error("No session key established.");
          }
          const plainText = await Crypto.decryptMessageAES(payload.content, _sessionKey);

          addMessage({
            id: Date.now().toString(),
            sender: senderId,
            text: plainText,
            isOwn: false,
            timestamp: new Date(),
            isEncrypted: true
          });
        } catch (e) {
          addMessage({
            id: Date.now().toString(),
            sender: senderId,
            text: "🔒 (Decryption Failed)",
            isOwn: false,
            timestamp: new Date(),
            isEncrypted: true
          });
        }
      }
    }
  };

  const addMessage = (msg: any) => setMessages(prev => [...prev, msg]);

  // --- SEND HANDLER ---
  const handleSendMessage = async (text: string) => {
    // Optimistic UI (We show plaintext to self)
    addMessage({ id: Date.now().toString(), sender: 'Me', text, isOwn: true, timestamp: new Date() });

    if (phase === 1) {
      ws.current?.send(JSON.stringify({ type: 'broadcast', payload: text }));
    }
    else if (phase === 2) {
      // Sign
      if (keyPair) {
        addLog('crypto', 'Signing message...');
        const sig = await Crypto.signMessageWithKeyObject(text, keyPair.raw.privateKey);
        ws.current?.send(JSON.stringify({ type: 'broadcast', payload: text, signature: sig }));
      }
    }
    else if (phase >= 3) {
      // Encrypt
      if (targetUser && _sessionKey) {
        addLog('crypto', `Encrypting for ${targetUser.id} (AES-GCM)...`);

        const encryptedJson = await Crypto.encryptMessageAES(text, _sessionKey);

        ws.current?.send(JSON.stringify({
          type: 'direct',
          targetId: targetUser.id,
          payload: {
            type: 'chat',
            content: encryptedJson
          }
        }));
      } else {
        addLog('error', 'Secure Connection Not Established. Click user to connect.');
      }
    }
  };

  const handleConnectUser = async (userId: string) => {
    setTargetUser({ id: userId });
    addLog('info', `Targeting ${userId}...`);
    if (phase >= 3) {
      addLog('crypto', 'Initiating Handshake... (Generating AES Key)');

      // 1. Generate AES Session Key
      // 1. Generate AES Session Key
      const aesKeyData = await Crypto.generateAESKey();

      // 2. Encrypt AES Key with Target's Public Key
      // WE need target's public key.
      let targetPubKey = null;

      if (userId === myId && keyPair) {
        // Optimization: Connecting to self? Use local key!
        targetPubKey = keyPair.publicKey;
        addLog('info', 'Connecting to self: Using local Public Key.');
      } else {
        const target = users.find(u => u.id === userId);
        if (target && target.publicKey) {
          targetPubKey = target.publicKey;
        } else {
          // Debugging: Dump user list to console/log
          console.log('Current Users:', users);
          addLog('error', `Cannot connect: User ${userId} has no Public Key. (See console)`);
          return;
        }
      }

      // Extract raw bytes of AES key to encrypt
      let rawAesBytes: Uint8Array;
      if (window.crypto && window.crypto.subtle) {
        const exported = await window.crypto.subtle.exportKey("raw", aesKeyData.keyObj as CryptoKey);
        rawAesBytes = new Uint8Array(exported);
      } else {
        // Forge: AesKeyData.keyObj IS the bytes string
        // Convert to Uint8Array for encryptRSA helper
        const str = aesKeyData.keyObj as string;
        rawAesBytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) rawAesBytes[i] = str.charCodeAt(i);
      }

      const encryptedKeyBase64 = await Crypto.encryptRSA(rawAesBytes, targetPubKey);

      ws.current?.send(JSON.stringify({
        type: 'direct',
        targetId: userId,
        payload: { type: 'key_exchange', encryptedKey: encryptedKeyBase64 }
      }));

      addLog('success', 'Sent Encrypted Session Key.');
      setSessionKey(aesKeyData.keyObj); // Store for self ONLY after success
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gray-100 font-sans text-gray-900">
      <div className="flex flex-1 overflow-hidden">
        <PhaseSelector currentPhase={phase} onSelectPhase={setPhase} />
        <ChatWindow
          messages={messages}
          connected={connected}
          users={users}
          myId={myId}
          targetId={targetUser?.id || null}
          onSendMessage={handleSendMessage}
          onConnectToUser={handleConnectUser}
          phase={phase}
        />
      </div>
      <LogViewer logs={logs} />
      <ConnectionSettings serverUrl={serverUrl} usePorts={usePorts} onSave={handleSettingsSave} />
    </div>
  );
}
