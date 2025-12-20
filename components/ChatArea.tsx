import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Sparkles, Film, Music, Image as ImageIcon } from 'lucide-react';
import { Message } from '../types';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (prompt: string) => void;
  suggestions: { label: string; prompt: string }[];
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading, onSuggestionClick, suggestions }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const renderMedia = (msg: Message) => {
    if (!msg.mediaUrl) return null;

    switch (msg.mediaType) {
      case 'image':
        return (
          <div className="relative rounded-xl overflow-hidden my-2 border border-[#444746] bg-black/20">
             <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs text-white flex items-center gap-1 z-10">
                <ImageIcon size={12} />
                <span>Generated Image</span>
             </div>
            <img 
              src={msg.mediaUrl} 
              alt={msg.content} 
              className="w-full h-auto max-h-[512px] object-contain"
              loading="lazy"
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative rounded-xl overflow-hidden my-2 border border-[#444746] bg-black/20">
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs text-white flex items-center gap-1 z-10">
                <Film size={12} />
                <span>Generated Video</span>
             </div>
            <video 
              src={msg.mediaUrl} 
              controls 
              className="w-full max-h-[512px]" 
              loop
              autoPlay
              muted
            />
          </div>
        );
      case 'audio':
        return (
          <div className="relative rounded-xl overflow-hidden my-2 border border-[#444746] bg-[#2a2b2d] p-4">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
               <Music size={12} />
               <span>Generated Audio</span>
            </div>
            <audio 
              src={msg.mediaUrl} 
              controls 
              className="w-full" 
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        {/* Empty state content removed as requested */}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-4 animate-[fadeIn_0.3s_ease-out]">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-[#c4c7c5] text-black order-last ml-auto' : 'bg-gradient-to-tr from-blue-500 to-purple-500'}`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} className="text-white" />}
            </div>
            
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
               {msg.mediaUrl ? (
                 <div className="flex flex-col">
                    {msg.content && <p className="mb-2 text-gray-300 whitespace-pre-wrap">{msg.content}</p>}
                    {renderMedia(msg)}
                 </div>
               ) : (
                 <div className="prose prose-invert max-w-none prose-p:leading-7 prose-pre:bg-[#1e1f20] prose-pre:border prose-pre:border-[#444746]">
                   {msg.role === 'user' ? (
                     <p className="whitespace-pre-wrap">{msg.content}</p>
                   ) : (
                     <ReactMarkdown
                       components={{
                          img: ({node, ...props}) => (
                              <div className="relative rounded-xl overflow-hidden my-4 border border-[#444746]">
                                  <img {...props} className="w-full h-auto max-h-[512px] object-contain bg-black/20" alt={props.alt || 'Generated content'} />
                              </div>
                          ),
                          a: ({node, ...props}) => (
                              <a {...props} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" />
                          )
                       }}
                     >
                       {msg.content}
                     </ReactMarkdown>
                   )}
                 </div>
               )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex items-center gap-1 h-8">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};