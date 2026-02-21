import { useState, useCallback } from "react";
import { ArrowLeft, MessageSquare, Hand, Mic, Bot } from "lucide-react";
import WebcamCapture from "./WebcamCapture";
import AudioRecorder from "./AudioRecorder";
import ChatWindow, { type ChatMessage } from "./ChatWindow";
import AiChatPanel from "./AiChatPanel";

type Mode = "deaf" | "hearing";
type Tab = "conversation" | "ai";

interface CommunicationHubProps {
  mode: Mode;
  onBack: () => void;
}

const CommunicationHub = ({ mode, onBack }: CommunicationHubProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("conversation");

  const addMessage = useCallback((text: string, sender: "deaf" | "hearing") => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        sender,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleGestureDetected = useCallback(
    (text: string) => addMessage(text, "deaf"),
    [addMessage]
  );

  const handleTranscription = useCallback(
    (text: string) => addMessage(text, "hearing"),
    [addMessage]
  );

  const handleSpeak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }, []);

  const isDeaf = mode === "deaf";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="glass-panel flex items-center justify-between px-4 py-3 border-b z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-lg font-semibold">
              Sign<span className="text-primary">Bridge</span>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {isDeaf ? (
                <>
                  <Hand className="h-3 w-3" /> Sign Language Mode
                </>
              ) : (
                <>
                  <Mic className="h-3 w-3" /> Speech Mode
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success recording-pulse" />
            Connected
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Input Panel */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-border lg:w-[380px] shrink-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className={`h-2 w-2 rounded-full ${isDeaf ? "bg-deaf-accent" : "bg-hearing-accent"}`} />
            <h2 className="text-sm font-semibold">
              {isDeaf ? "Camera Input" : "Microphone Input"}
            </h2>
          </div>
          <div className="flex-1 p-4 flex flex-col justify-center">
            {isDeaf ? (
              <WebcamCapture onGestureDetected={handleGestureDetected} isActive />
            ) : (
              <AudioRecorder onTranscription={handleTranscription} isActive />
            )}
          </div>
        </div>

        {/* Right Panel with Tabs */}
        <div className="flex flex-1 flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("conversation")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "conversation"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Conversation
              {messages.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {messages.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "ai"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="h-4 w-4" />
              AI Assistant
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "conversation" ? (
              <ChatWindow messages={messages} onSpeak={handleSpeak} />
            ) : (
              <AiChatPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationHub;
