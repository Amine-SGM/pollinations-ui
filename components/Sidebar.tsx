import React from 'react';
import { Plus, MessageSquare, Settings, Menu, X, Trash2 } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-72 bg-[#1e1f20] transform transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}
      >
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-[#333537] rounded-full text-gray-300 md:hidden"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-6">
          <button
            onClick={onNewChat}
            className="flex items-center gap-3 bg-[#1a1a1c] hover:bg-[#333537] text-gray-200 px-4 py-3 rounded-full w-full transition-colors border border-[#444746] shadow-sm"
          >
            <Plus size={20} className="text-gray-400" />
            <span className="text-sm font-medium">New chat</span>
          </button>
        </div>

        {/* Recent Chats */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="text-sm font-medium text-gray-400 px-4 mb-2">Recent</div>
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`
                  group flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer text-sm truncate
                  ${currentSessionId === session.id ? 'bg-[#004a77] text-blue-100' : 'text-gray-300 hover:bg-[#333537]'}
                `}
              >
                <MessageSquare size={16} className={currentSessionId === session.id ? 'text-blue-200' : 'text-gray-400'} />
                <span className="truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => onDeleteSession(e, session.id)}
                  className={`opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-full ${currentSessionId === session.id ? 'text-blue-200' : 'text-gray-400'}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Menu */}
        <div className="p-4 border-t border-[#444746]">
          <button 
            onClick={onOpenSettings}
            className="flex items-center gap-3 text-sm text-gray-300 hover:bg-[#333537] w-full p-3 rounded-lg transition-colors"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          
          <div className="mt-2 text-xs text-gray-500 px-3">
             <span className="block mb-1">PollenUI</span>
          </div>
        </div>
      </aside>
    </>
  );
};