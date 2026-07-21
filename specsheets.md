# Ducksy: Agent Harness Evolution Specification

## 1. Project Overview & Vision
**Ducksy** is evolving from a targeted AI workspace companion into a comprehensive, cross-platform desktop **Agent Harness**. 

Leaving behind the standalone character avatar, Ducksy now utilizes a sleek, unobtrusive **Dynamic Notch** interface that anchors to the top of the user's screen. It acts as an always-on utility, seamlessly integrating with the operating system to provide real-time screen context (via Magic Lens) and audio processing. Moving forward, Ducksy's backend will serve as a central runtime scaffold orchestrating multi-step AI workflows, managing agent memory, and acting as a Model Context Protocol (MCP) host to dynamically execute local and external tools.

## 2. Architecture: Current State vs. Target Stack
Ducksy currently utilizes a four-workspace monorepo (`ducksy-ui`, `ducksy-app`, `ducksy-server`, `ducksy-web`). The migration to an Agent Harness requires strategic updates to this existing architecture:

*   **Language Migration:** The codebase is currently 99.8% JavaScript. A gradual migration to **TypeScript** is required to enforce strict typing for tool schemas, agent state, and MCP configurations.
*   **Frontend (`ducksy-ui`):** Next.js, Tailwind CSS, and Framer Motion will pivot from character rigging to managing the fluid state morphologies of the dynamic notch container (expanding for execution logs, collapsing for idle states).
*   **Desktop Runtime (`ducksy-app`):** Electron will continue handling OS-level permissions but must be refactored to support a transparent, frameless window anchored to the top-center of the screen, dynamically resizing its hit-box via IPC messages to prevent blocking underlying apps.
*   **Backend Orchestration (`ducksy-server`):** Express.js will evolve into the core **Agent Engine**, managing the execution loop, maintaining context windows, and acting as the primary MCP server host.
*   **LLM Router Pattern (`ducksy-server`):** The Express backend will implement an abstraction layer (Adapter Pattern). Instead of hardcoding the Gemini SDK, the execution loop will interface with a generic `ModelProvider`. 
    *   **Cloud Provider:** Google Gemini API (for high-reasoning, complex multi-step MCP tasks).
    *   **Local Provider:** Local API endpoint running Gemma 4 (via Ollama or Google AI Edge) deployed either directly on the host machine or on a self-hosted local server network.

## 3. Key Harness Capabilities

### 3.1. Model Context Protocol (MCP) Orchestration
*   **Standardized Tool Calling:** Existing integrations (Google Calendar, Notion) and new local capabilities (audio summarization) will be refactored into strict MCP schemas.
*   **Dynamic Discovery:** The harness will allow the agent to discover and execute tools on the fly based on user intent.
*   **Extensibility:** Developers can drop in new MCP servers to instantly grant the Ducksy agent new capabilities without recompiling the core Electron app.

### 3.2. Runtime Scaffolding & State Management
*   **Execution Loop:** Implementation of a secure loop handling thought generation, tool execution, observation, and reflection within `ducksy-server`.
*   **Error Recovery:** Automatic, context-aware retries when the agent hallucinates a tool parameter (building on the existing retry mechanism).
*   **Memory Management:** Short-term sliding window memory for active sessions and structured long-term memory for cross-session continuity.
*   **Human-in-the-Loop (HITL):** Configurable pause points where the notch drops down to require user approval before the agent executes destructive actions (e.g., file deletion, sending emails).

### 3.3. Dynamic Model Selection & Routing
To balance privacy, latency, and reasoning capabilities, Ducksy will feature a tri-state model selection system:
*   **Strict Local (Privacy First):** Forces all requests through the local Gemma model. Ideal for processing sensitive screen context, local file reading, and secure audio summarization.
*   **Strict Cloud (Max Capability):** Forces all requests to Gemini. Best for heavy coding tasks, complex data transformations, or when operating on low-power hardware.
*   **Auto-Router (Hybrid):** An intelligent middleware that routes the prompt based on the task. Fast, low-context tasks are handled locally by Gemma, while high-context reasoning tasks are escalated to the cloud.

## 4. The Dynamic Notch Interface
The primary interaction paradigm shifts from a clickable character to a system-native experience:

*   **Morphological States:** The UI maps directly to the agent's execution loop:
    *   *Resting:* A minimal, unobtrusive pill at the top of the screen.
    *   *Ingesting:* Expands slightly with a live audio waveform or "Lens mode" indicator.
    *   *Executing:* Pulsing or scanning animations indicating active MCP tool usage or AI processing.
    *   *Dashboard/HITL:* Fully dropped-down panel displaying the Agent Harness Dashboard, execution logs, and intervention prompts.
*   **Trigger Mechanisms:** Global keyboard shortcuts (`globalShortcut`), precise mouse-hover events, and voice wake-word detection serve as the primary methods for expanding the notch.
*   **Model Status Indicator:** The notch UI will include a subtle visual indicator (e.g., a localized color dot or icon) to show whether the agent is currently utilizing the local Gemma engine or the cloud-based Gemini API.
*   **Quick-Toggle Menu:** A dropdown within the expanded dashboard allowing the user to override the Auto-Router and manually select their preferred inference engine for the current session.

## 5. Development Roadmap & Action Items

**Phase 1: Foundation & Tech Debt**
*   **Electron Window Refactor:** Update `ducksy-app` to anchor a frameless, transparent window to the top of the display and implement dynamic bounds resizing via IPC.
*   **TypeScript Integration:** Establish a TS config and begin migrating core `ducksy-server` utility functions and IPC handlers.
*   **Testing Infrastructure:** Implement a visible test suite (e.g., Playwright or Jest) specifically targeting Electron IPC boundaries and AI API integration points.

**Phase 2: The Agent Harness Build**
*   **Backend Refactor:** Upgrade `ducksy-server` to host the agent execution loop and manage state.
*   **LLM Router & MCP Wrappers:** Implement the `ModelProvider` adapter and wrap existing Express routes and AI API calls into compliant Model Context Protocol tools.
*   **Harness Dashboard UI:** Build out the frontend components within the expanded notch state to visualize agent thoughts, active tool calls, and token usage.

**Phase 3: Polish & Deployment**
*   **Dynamic Notch State Engine:** Finalize the Framer Motion physics for seamless transitions between the resting pill, listening states, and full dashboard dropdowns.
*   **CI/CD Pipeline:** Establish GitHub Actions to automate universal macOS DMG builds and Windows NSIS installers, removing local build friction.
