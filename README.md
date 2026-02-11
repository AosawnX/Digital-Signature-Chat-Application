# Secure Chat System

A step-by-step implementation of a secure chat system, evolving from insecure plaintext to authenticated, encrypted communication.

## Quick Start (Phase 1)

**Prerequisites:**
- Node.js installed
- Dependencies installed: `npm install`
- Code compiled: `npx tsc`

### How to Run

You will need **3 separate terminal windows**:

**Terminal 1 (Server):**
```bash
node dist/01_plain/server.js
```
*You should see: "Phase 1 Server started on ws://localhost:8080"*

**Terminal 2 (Client A):**
```bash
node dist/01_plain/client.js
```
*Type a message and press Enter.*

**Terminal 3 (Client B):**
```bash
node dist/01_plain/client.js
```
*You should see messages from Client A appear here.*

---
## Project Structure

- `src/01_plain/`: Phase 1 - Insecure WebSocket Chat (Baseline)
- `src/02_signatures/`: Phase 2 - Digital Signatures

## Phase 2: Digital Signatures

**Terminal 1 (Server):**
```bash
node dist/02_signatures/server.js
```

**Terminal 2 & 3 (Clients):**
```bash
node dist/02_signatures/client.js
```
*Note: Clients will now generate RSA keys on startup (taking ~1s).*
