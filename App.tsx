import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { PollinationsService } from './services/pollinationsService';
import { ChatSession, Message, AppSettings, MediaType, GenerationParams } from './types';
import { WELCOME_SUGGESTIONS, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, AUDIO_MODELS } from './constants';

const API_BASE = 'https://gen.pollinations.ai';
import { Send, Image as ImageIcon, Mic, Menu, MessageSquare, Film, Music, Monitor, Smartphone, Maximize, Wand2, Lock, Eye, Code, Square, Plus, SlidersHorizontal, CircleOff, Hash, ChevronDown, Thermometer, Brain, Clock, Zap, Link as LinkIcon, X, Ban } from 'lucide-react';

// Fix for TypeScript SpeechRecognition errors
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Dynamic models
  const [textModels, setTextModels] = useState<string[]>(TEXT_MODELS);
  const [imageModels, setImageModels] = useState<string[]>(IMAGE_MODELS);
  const [videoModels, setVideoModels] = useState<string[]>(VIDEO_MODELS);
  const [audioModels, setAudioModels] = useState<string[]>(AUDIO_MODELS);

  // UI State
  const [showParams, setShowParams] = useState(false);

  // Mode Selection
  const [selectedMode, setSelectedMode] = useState<MediaType>('text');

  // Generation Params
  const [genParams, setGenParams] = useState<GenerationParams>({
    width: 1024,
    height: 1024,
    aspectRatio: '1:1',
    enhance: true,
    private: false,
    nologo: false,
    isJSON: false,
    seed: undefined,
    system: '',
    temperature: 0.7,
    quality: '',
    imageUrl: '',
    duration: undefined,
    negativePrompt: ''
  });

  // Settings State — apiKey is the user's personal key only.
  // The developer's public key (VITE_POLLINATIONS_API_KEY) is handled
  // transparently inside pollinationsService as a fallback.
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pollinations_settings');

    return saved ? JSON.parse(saved) : {
      apiKey: 'pk_gWWKNs9f8NS8DqCW',          // empty = use the env public key as fallback
      textModel: 'openai',
      imageModel: 'flux',
      videoModel: 'veo',
      audioModel: 'openai-audio'
    };
  });

  const pollinationsService = useRef(new PollinationsService(settings)).current;
  const pollinationsServiceRef = useRef(pollinationsService);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize sessions
  useEffect(() => {
    const savedSessions = localStorage.getItem('pollinations_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Fetch models dynamically from API
  useEffect(() => {
    const effectiveKey = settings.apiKey?.trim() || (import.meta as any).env.VITE_POLLINATIONS_API_KEY || '';
    const authHeader: Record<string, string> = effectiveKey ? { Authorization: `Bearer ${effectiveKey}` } : {};

    // Text models
    fetch(`${API_BASE}/text/models`, { headers: authHeader })
      .then(r => r.json())
      .then((data: any[]) => {
        const names = data
          .filter(m => m.output_modalities?.includes('text') && !m.is_specialized)
          .map(m => m.name);
        if (names.length > 0) setTextModels(names);
      })
      .catch(() => { }); // silently fallback to constants

    // Audio models (output = audio)
    fetch(`${API_BASE}/audio/models`, { headers: authHeader })
      .then(r => r.json())
      .then((data: any[]) => {
        const names = data
          .filter(m => m.output_modalities?.includes('audio'))
          .map(m => m.name);
        if (names.length > 0) setAudioModels(names);
      })
      .catch(() => { });

    // Image & Video models (same endpoint, split by output_modalities)
    fetch(`${API_BASE}/image/models`, { headers: authHeader })
      .then(r => r.json())
      .then((data: any[]) => {
        const imgNames = data
          .filter(m => m.output_modalities?.includes('image'))
          .map(m => m.name);
        const vidNames = data
          .filter(m => m.output_modalities?.includes('video'))
          .map(m => m.name);
        if (imgNames.length > 0) setImageModels(imgNames);
        if (vidNames.length > 0) setVideoModels(vidNames);
      })
      .catch(() => { });
  }, []); // run once on mount

  // When dynamic models load, ensure selected models are still valid
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      textModel: textModels.includes(prev.textModel) ? prev.textModel : textModels[0] || prev.textModel,
      imageModel: imageModels.includes(prev.imageModel) ? prev.imageModel : imageModels[0] || prev.imageModel,
      videoModel: videoModels.includes(prev.videoModel) ? prev.videoModel : videoModels[0] || prev.videoModel,
      audioModel: audioModels.includes(prev.audioModel) ? prev.audioModel : audioModels[0] || prev.audioModel,
    }));
  }, [textModels, imageModels, videoModels, audioModels]);

  useEffect(() => {
    localStorage.setItem('pollinations_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('pollinations_settings', JSON.stringify(settings));
    pollinationsServiceRef.current.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const updateAspectRatio = (ratio: string) => {
    let width = 1024;
    let height = 1024;
    if (ratio === '16:9') {
      width = 1280;
      height = 720;
    } else if (ratio === '9:16') {
      width = 720;
      height = 1280;
    }
    setGenParams(prev => ({ ...prev, aspectRatio: ratio, width, height }));
  };

  const toggleListening = async () => {
    // --- Stop ---
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    // --- Check API support ---
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // --- Request mic permission explicitly first ---
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — stop the stream immediately (SpeechRecognition handles its own audio)
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone access denied. Please allow microphone permissions in your browser settings, then try again.');
      } else {
        alert(`Microphone error: ${err.message}`);
      }
      return;
    }

    // --- Start recognition ---
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Set listening immediately (not waiting for async onstart)
      setIsListening(true);

      recognition.onresult = (event: any) => {
        // Grab the most recent final result
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        recognitionRef.current = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
        } else if (event.error === 'no-speech') {
          // silently ignore — user just didn't speak
        } else if (event.error === 'network') {
          alert('Speech recognition requires an internet connection.');
        } else {
          console.warn('Speech recognition error (non-fatal):', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      alert('Failed to initialize speech recognition.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !currentSessionId || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: [...session.messages, userMessage],
          title: session.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : session.title
        };
      }
      return session;
    }));

    setInput('');
    setIsLoading(true);
    setShowParams(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const history = currentSession ? currentSession.messages : [];

      let botMessage: Message;
      const seed = genParams.seed || Math.floor(Math.random() * 1000000);

      if (selectedMode === 'text') {
        const responseContent = await pollinationsServiceRef.current.sendTextMessage(userMessage.content, history, { ...genParams, seed });
        botMessage = {
          id: generateId(),
          role: 'assistant',
          content: responseContent,
          timestamp: Date.now(),
          mediaType: 'text'
        };
      } else if (selectedMode === 'audio') {
        try {
          const mediaUrl = await pollinationsServiceRef.current.generateAudio(userMessage.content, seed);
          botMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Generated audio for: ${userMessage.content}`,
            timestamp: Date.now(),
            mediaType: 'audio',
            mediaUrl: mediaUrl
          };
        } catch (e: any) {
          botMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Failed to generate audio. \n\nError: ${e.message || 'Unknown error'}`,
            timestamp: Date.now(),
            mediaType: 'text'
          };
        }
      } else if (selectedMode === 'video') {
        try {
          const mediaUrl = await pollinationsServiceRef.current.generateVideo(userMessage.content, seed, genParams);
          botMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Generated video for: ${userMessage.content}`,
            timestamp: Date.now(),
            mediaType: 'video',
            mediaUrl: mediaUrl
          };
        } catch (e: any) {
          botMessage = {
            id: generateId(),
            role: 'assistant',
            content: `Failed to generate video. \n\nError: ${e.message || 'Unknown error'}`,
            timestamp: Date.now(),
            mediaType: 'text'
          };
        }
      } else {
        // Handle Image
        const mediaUrl = pollinationsServiceRef.current.getMediaUrl(userMessage.content, 'image', seed, genParams);

        botMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Here is your generated image: ${userMessage.content}`,
          timestamp: Date.now(),
          mediaType: 'image',
          mediaUrl: mediaUrl
        };

        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, botMessage]
          };
        }
        return session;
      }));

    } catch (error) {
      console.error("Failed to send message", error);
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: "Sorry, something went wrong while processing your request.",
        timestamp: Date.now(),
        mediaType: 'text'
      };
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage]
          };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name);
      setInput(prev => prev + ` [Attached: ${file.name}]`);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Get current model based on mode
  const getCurrentModel = () => {
    switch (selectedMode) {
      case 'text': return settings.textModel;
      case 'image': return settings.imageModel;
      case 'video': return settings.videoModel;
      case 'audio': return settings.audioModel;
      default: return '';
    }
  };

  // Get available models based on mode (uses live API data, falls back to constants)
  const getAvailableModels = () => {
    switch (selectedMode) {
      case 'text': return textModels;
      case 'image': return imageModels;
      case 'video': return videoModels;
      case 'audio': return audioModels;
      default: return [];
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-white overflow-hidden font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          setCurrentSessionId(id);
          setIsSidebarOpen(false);
        }}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col relative min-w-0">
        <div className="md:hidden flex items-center p-4 border-b border-[#444746]">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-400">
            <Menu size={24} />
          </button>
          <span className="ml-2 font-medium text-lg">PollenUI</span>
        </div>

        <div className="hidden md:flex items-center justify-between p-4 px-6">
          <div className="flex items-center gap-2 text-[#e3e3e3] opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
            <span className="font-medium text-lg">PollenUI</span>
            <span className="text-xs bg-[#444746] px-2 py-0.5 rounded text-gray-300">Beta</span>
          </div>
          <div></div>
        </div>

        {/* No API key warning banner */}
        {!settings.apiKey?.trim() && !(import.meta as any).env.VITE_POLLINATIONS_API_KEY && (
          <div className="mx-4 mb-2 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm">
            <span className="text-amber-400 text-lg">⚠️</span>
            <span className="text-amber-300 flex-1">
              No API key configured. Generations require an API key.{' '}
              <a href="https://enter.pollinations.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100 transition-colors">
                Get a free key at enter.pollinations.ai
              </a>
              {' '}then paste it in <button onClick={() => setIsSettingsOpen(true)} className="underline hover:text-amber-100 transition-colors">Settings</button>.
            </span>
          </div>
        )}

        <ChatArea
          messages={currentSession?.messages || []}
          isLoading={isLoading}
          onSuggestionClick={(prompt) => {
            setInput(prompt);
            if (textareaRef.current) textareaRef.current.focus();
          }}
          suggestions={WELCOME_SUGGESTIONS}
        />

        <div className="p-4 md:pb-8 w-full max-w-3xl mx-auto relative">

          {/* Mode Selector */}
          <div className="flex justify-center mb-4">
            <div className="bg-[#1e1f20] border border-[#444746] rounded-full p-1 flex gap-1 shadow-md">
              {(['text', 'image', 'video', 'audio'] as MediaType[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSelectedMode(mode);
                    // Auto-select valid aspect ratio for video
                    if (mode === 'video' && (genParams.aspectRatio === '1:1' || !genParams.aspectRatio)) {
                      updateAspectRatio('16:9');
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 
                       ${selectedMode === mode ? 'bg-[#2a2b2d] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-[#252627]'}`}
                >
                  {mode === 'text' && <MessageSquare size={16} />}
                  {mode === 'image' && <ImageIcon size={16} />}
                  {mode === 'video' && <Film size={16} />}
                  {mode === 'audio' && <Music size={16} />}
                  <span className="capitalize">{mode}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative bg-[#1e1f20] rounded-[28px] border border-[#444746] shadow-lg focus-within:bg-[#2a2b2d] transition-colors">
            <div className="flex items-end p-2 gap-2">

              {/* Upload Button */}
              <div className="p-2 pb-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={handleFileSelect}
                  className="p-2 rounded-full hover:bg-[#333537] text-gray-400 transition-colors"
                  title="Upload file"
                >
                  <Plus size={20} />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : `Enter a prompt to generate ${selectedMode}...`}
                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-[200px] py-3 text-white placeholder-gray-400"
                rows={1}
              />

              <div className="p-2 pb-3 flex items-center gap-1">
                {/* Settings Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowParams(true);
                  }}
                  className={`p-2 rounded-full hover:bg-[#333537] transition-colors ${showParams ? 'text-blue-400 bg-[#333537]' : 'text-gray-400'}`}
                  title="Generation Settings"
                >
                  <SlidersHorizontal size={20} />
                </button>

                {/* Mic Button - Always visible unless loading, changes state based on listening */}
                <button
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`p-2 rounded-full transition-colors ${isListening
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
                    : 'hover:bg-[#333537] text-gray-400'
                    }`}
                  title="Voice Input"
                >
                  <Mic size={20} />
                </button>

                {/* Send Button - Only active when text is present, replaces logic where they swapped */}
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || (!input.trim() && !isListening)} // Disable if empty and not listening
                  className={`p-2 rounded-full transition-all duration-200 ${isLoading || (!input.trim() && !isListening)
                    ? 'bg-[#333537] text-gray-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-gray-200'
                    }`}
                >
                  <Send size={18} className={isLoading ? 'opacity-50' : ''} />
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-3">
            Pollinations can make mistakes. Consider checking important information.
          </p>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />

      {/* Right Sidebar Params Implementation */}
      {/* Backdrop */}
      {showParams && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowParams(false)} />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-[#1e1f20] border-l border-[#444746] transform transition-transform duration-300 ease-in-out ${showParams ? 'translate-x-0' : 'translate-x-full'} shadow-2xl flex flex-col`}>
        <div className="p-4 border-b border-[#444746] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <SlidersHorizontal size={16} />
            Generation Options
          </h3>
          <button onClick={() => setShowParams(false)} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              Model ({selectedMode})
            </label>
            <div className="relative">
              <select
                value={getCurrentModel()}
                onChange={(e) => {
                  const newModel = e.target.value;
                  setSettings(prev => ({
                    ...prev,
                    textModel: selectedMode === 'text' ? newModel : prev.textModel,
                    imageModel: selectedMode === 'image' ? newModel : prev.imageModel,
                    videoModel: selectedMode === 'video' ? newModel : prev.videoModel,
                    audioModel: selectedMode === 'audio' ? newModel : prev.audioModel,
                  }));
                }}
                className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors appearance-none cursor-pointer"
              >
                {getAvailableModels().map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Seed Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              <Hash size={12} /> Seed (Optional)
            </label>
            <input
              type="number"
              placeholder="Random"
              value={genParams.seed || ''}
              onChange={(e) => setGenParams(p => ({ ...p, seed: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* --- IMAGE Specific --- */}
          {selectedMode === 'image' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <LinkIcon size={12} /> Reference Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={genParams.imageUrl || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <CircleOff size={12} /> Negative Prompt
                </label>
                <input
                  type="text"
                  placeholder="What to exclude..."
                  value={genParams.negativePrompt || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, negativePrompt: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <Zap size={12} /> Quality
                </label>
                <input
                  type="text"
                  placeholder="e.g. HD, Standard"
                  value={genParams.quality || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, quality: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[#333537]">
                <label className="text-xs text-gray-400">Aspect Ratio</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAspectRatio('1:1')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border transition-colors ${genParams.aspectRatio === '1:1' ? 'bg-[#2a2b2d] border-blue-500/50 text-blue-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <Square size={12} /> 1:1
                  </button>
                  <button
                    onClick={() => updateAspectRatio('16:9')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border transition-colors ${genParams.aspectRatio === '16:9' ? 'bg-[#2a2b2d] border-blue-500/50 text-blue-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <Monitor size={12} /> 16:9
                  </button>
                  <button
                    onClick={() => updateAspectRatio('9:16')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border transition-colors ${genParams.aspectRatio === '9:16' ? 'bg-[#2a2b2d] border-blue-500/50 text-blue-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <Smartphone size={12} /> 9:16
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#333537]">
                <label className="text-xs text-gray-400">Switches</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setGenParams(p => ({ ...p, enhance: !p.enhance }))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.enhance ? 'bg-[#2a2b2d] border-purple-500/50 text-purple-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <span className="flex items-center gap-2"><Wand2 size={14} /> Enhance Prompt</span>
                    <span className={`w-2 h-2 rounded-full ${genParams.enhance ? 'bg-purple-400' : 'bg-gray-600'}`} />
                  </button>

                  <button
                    onClick={() => setGenParams(p => ({ ...p, nologo: !p.nologo }))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.nologo ? 'bg-[#2a2b2d] border-orange-500/50 text-orange-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <span className="flex items-center gap-2"><CircleOff size={14} /> No Logo</span>
                    <span className={`w-2 h-2 rounded-full ${genParams.nologo ? 'bg-orange-400' : 'bg-gray-600'}`} />
                  </button>

                  <button
                    onClick={() => setGenParams(p => ({ ...p, private: !p.private }))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.private ? 'bg-[#2a2b2d] border-red-500/50 text-red-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <span className="flex items-center gap-2">{genParams.private ? <Lock size={14} /> : <Eye size={14} />} Private Mode</span>
                    <span className={`w-2 h-2 rounded-full ${genParams.private ? 'bg-red-400' : 'bg-gray-600'}`} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* --- VIDEO Specific --- */}
          {selectedMode === 'video' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <LinkIcon size={12} /> Reference Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={genParams.imageUrl || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <CircleOff size={12} /> Negative Prompt
                </label>
                <input
                  type="text"
                  placeholder="What to exclude..."
                  value={genParams.negativePrompt || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, negativePrompt: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <Zap size={12} /> Quality
                </label>
                <input
                  type="text"
                  placeholder="e.g. HD"
                  value={genParams.quality || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, quality: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} /> Duration (s)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={genParams.duration || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, duration: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[#333537]">
                <label className="text-xs text-gray-400">Aspect Ratio</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAspectRatio('16:9')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border transition-colors ${genParams.aspectRatio === '16:9' ? 'bg-[#2a2b2d] border-blue-500/50 text-blue-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <Monitor size={12} /> 16:9
                  </button>
                  <button
                    onClick={() => updateAspectRatio('9:16')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border transition-colors ${genParams.aspectRatio === '9:16' ? 'bg-[#2a2b2d] border-blue-500/50 text-blue-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <Smartphone size={12} /> 9:16
                  </button>
                </div>
              </div>
            </>
          )}

          {/* --- TEXT Specific --- */}
          {selectedMode === 'text' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <Brain size={12} /> System Prompt
                </label>
                <textarea
                  rows={4}
                  placeholder="You are a helpful assistant..."
                  value={genParams.system || ''}
                  onChange={(e) => setGenParams(p => ({ ...p, system: e.target.value }))}
                  className="w-full bg-[#0b0b0c] border border-[#444746] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-gray-400 flex items-center gap-1">
                    <Thermometer size={12} /> Temperature
                  </label>
                  <span className="text-xs text-gray-500">{genParams.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={genParams.temperature || 0.7}
                  onChange={(e) => setGenParams(p => ({ ...p, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-[#444746] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[#333537]">
                <label className="text-xs text-gray-400">Settings</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setGenParams(p => ({ ...p, isJSON: !p.isJSON }))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.isJSON ? 'bg-[#2a2b2d] border-yellow-500/50 text-yellow-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <span className="flex items-center gap-2"><Code size={14} /> JSON Mode</span>
                    <span className={`w-2 h-2 rounded-full ${genParams.isJSON ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                  </button>
                  <button
                    onClick={() => setGenParams(p => ({ ...p, private: !p.private }))}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.private ? 'bg-[#2a2b2d] border-red-500/50 text-red-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                  >
                    <span className="flex items-center gap-2">{genParams.private ? <Lock size={14} /> : <Eye size={14} />} Private Mode</span>
                    <span className={`w-2 h-2 rounded-full ${genParams.private ? 'bg-red-400' : 'bg-gray-600'}`} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
