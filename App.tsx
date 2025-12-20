import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { PollinationsService } from './services/pollinationsService';
import { ChatSession, Message, AppSettings, MediaType, GenerationParams } from './types';
import { WELCOME_SUGGESTIONS, DEFAULT_ENDPOINT, TEXT_MODELS, IMAGE_MODELS, VIDEO_MODELS, AUDIO_MODELS } from './constants';
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
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pollinations_settings');
    const envKey = process.env.POLLINATIONS_API_KEY || '';
    
    return saved ? JSON.parse(saved) : {
      apiKey: envKey,
      useCustomEndpoint: false,
      customEndpoint: DEFAULT_ENDPOINT,
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

  // Initialize
  useEffect(() => {
    const savedSessions = localStorage.getItem('pollinations_sessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    } else {
      createNewSession();
    }
  }, []);

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

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' + transcript : transcript));
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
        } else if (event.error === 'no-speech') {
            // Ignore no-speech errors, just stop listening
        } else {
            alert(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition", e);
      alert("Failed to initialize speech recognition.");
      setIsListening(false);
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
    switch(selectedMode) {
      case 'text': return settings.textModel;
      case 'image': return settings.imageModel;
      case 'video': return settings.videoModel;
      case 'audio': return settings.audioModel;
      default: return '';
    }
  };

  // Get available models based on mode
  const getAvailableModels = () => {
    switch(selectedMode) {
      case 'text': return TEXT_MODELS;
      case 'image': return IMAGE_MODELS;
      case 'video': return VIDEO_MODELS;
      case 'audio': return AUDIO_MODELS;
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

        <ChatArea 
          messages={currentSession?.messages || []}
          isLoading={isLoading}
          onSuggestionClick={(prompt) => {
             setInput(prompt);
             if(textareaRef.current) textareaRef.current.focus();
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
                    className={`p-2 rounded-full transition-colors ${
                      isListening 
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
                      className={`p-2 rounded-full transition-all duration-200 ${
                        isLoading || (!input.trim() && !isListening)
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
                onChange={(e) => setGenParams(p => ({...p, seed: e.target.value ? parseInt(e.target.value) : undefined}))}
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
                    onChange={(e) => setGenParams(p => ({...p, imageUrl: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, negativePrompt: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, quality: e.target.value}))}
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
                        onClick={() => setGenParams(p => ({...p, enhance: !p.enhance}))}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.enhance ? 'bg-[#2a2b2d] border-purple-500/50 text-purple-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                      >
                        <span className="flex items-center gap-2"><Wand2 size={14} /> Enhance Prompt</span>
                        <span className={`w-2 h-2 rounded-full ${genParams.enhance ? 'bg-purple-400' : 'bg-gray-600'}`} />
                      </button>
                      
                      <button 
                        onClick={() => setGenParams(p => ({...p, nologo: !p.nologo}))}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.nologo ? 'bg-[#2a2b2d] border-orange-500/50 text-orange-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                      >
                        <span className="flex items-center gap-2"><CircleOff size={14} /> No Logo</span>
                        <span className={`w-2 h-2 rounded-full ${genParams.nologo ? 'bg-orange-400' : 'bg-gray-600'}`} />
                      </button>

                      <button 
                        onClick={() => setGenParams(p => ({...p, private: !p.private}))}
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
                    onChange={(e) => setGenParams(p => ({...p, imageUrl: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, negativePrompt: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, quality: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, duration: e.target.value ? parseInt(e.target.value) : undefined}))}
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
                    onChange={(e) => setGenParams(p => ({...p, system: e.target.value}))}
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
                    onChange={(e) => setGenParams(p => ({...p, temperature: parseFloat(e.target.value)}))}
                    className="w-full accent-blue-500 h-1 bg-[#444746] rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-[#333537]">
                   <label className="text-xs text-gray-400">Settings</label>
                   <div className="space-y-2">
                      <button 
                        onClick={() => setGenParams(p => ({...p, isJSON: !p.isJSON}))}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs border transition-colors ${genParams.isJSON ? 'bg-[#2a2b2d] border-yellow-500/50 text-yellow-200' : 'border-[#444746] text-gray-400 hover:bg-[#333537]'}`}
                      >
                        <span className="flex items-center gap-2"><Code size={14} /> JSON Mode</span>
                        <span className={`w-2 h-2 rounded-full ${genParams.isJSON ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                      </button>
                      <button 
                        onClick={() => setGenParams(p => ({...p, private: !p.private}))}
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