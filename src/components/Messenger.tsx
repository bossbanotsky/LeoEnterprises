import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Chat, Message, Employee } from '../types';
import { format, isSameDay } from 'date-fns';
import { MessageSquare, Send, Users, User, Search, Trash2, ChevronLeft, MoreVertical, Loader2, Smile, ChevronRight, Volume2, VolumeX, Settings2, Upload, ImagePlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Skeleton } from './ui/Skeleton';
import { motion, AnimatePresence } from 'motion/react';

export default function Messenger() {
  const { user, userData } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<{uid: string, fullName: string, role: string, photoURL?: string}[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('messenger_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupLogo, setNewGroupLogo] = useState('');
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const lastProcessedTime = useRef<string>(new Date().toISOString());

  useEffect(() => {
    localStorage.setItem('messenger_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Quick sharp alert sound
    notificationSound.current.volume = 0.5;
  }, []);

  // Play sound when a new message arrives in any chat
  useEffect(() => {
    if (!user || chats.length === 0 || !soundEnabled) return;

    const mostRecentChat = chats.reduce((prev, current) => {
      const prevTime = prev.lastMessageAt || '0';
      const currTime = current.lastMessageAt || '0';
      return currTime > prevTime ? current : prev;
    }, chats[0]);

    if (
      mostRecentChat.lastMessageAt && 
      mostRecentChat.lastMessageAt > lastProcessedTime.current &&
      mostRecentChat.lastSenderId !== user.uid
    ) {
      notificationSound.current?.play().catch(e => console.log("Audio play deferred until user interaction"));
      lastProcessedTime.current = mostRecentChat.lastMessageAt;
    } else if (mostRecentChat.lastMessageAt && mostRecentChat.lastMessageAt > lastProcessedTime.current) {
      // Just update reference if it was our own message
      lastProcessedTime.current = mostRecentChat.lastMessageAt;
    }
  }, [chats, user]);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Load active chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach(doc => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatList);
      setLoading(false);
    });

    // Load available contacts (employees + admin)
    const loadContacts = async () => {
      try {
        const empSnapshot = await getDocs(collection(db, 'employees'));
        const empList = empSnapshot.docs.map(doc => ({
          uid: doc.data().uid,
          fullName: doc.data().fullName,
          role: 'employee',
          photoURL: doc.data().photoURL
        })).filter(e => e.uid !== user.uid);

        // Also add admin if current user is not admin
        if (userData?.role !== 'admin') {
          empList.push({
            uid: 'admin_placeholder_uid', // This will be updated if we had a list of admins
            fullName: 'Administrator',
            role: 'admin'
          } as any);
        }
        
        // Better way: get all users from users collection
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          fullName: doc.data().fullName || (doc.data().role === 'admin' ? 'Admin' : 'Employee'),
          role: doc.data().role,
          photoURL: doc.data().photoURL
        })).filter(u => u.uid !== user.uid);

        setContacts(usersList);
      } catch (e) {
        console.error("Error loading contacts", e);
      }
    };
    loadContacts();

    // Ensure common group chat exists
    const ensureGroupChat = async () => {
      if (!user) return;
      try {
        const groupChatRef = doc(db, 'chats', 'common-group');
        const docSnap = await getDoc(groupChatRef);
        if (!docSnap.exists()) {
          console.log("Creating common group chat...");
          await setDoc(groupChatRef, {
            participants: [user.uid],
            type: 'group',
            name: 'General Staff Group',
            updatedAt: new Date().toISOString(),
            unreadCounts: { [user.uid]: 0 }
          });
        } else {
          const data = docSnap.data();
          if (!data.participants || !data.participants.includes(user.uid)) {
            console.log("Joining common group chat for user:", user.uid);
            await updateDoc(groupChatRef, {
              participants: arrayUnion(user.uid),
              updatedAt: new Date().toISOString(),
              [`unreadCounts.${user.uid}`]: 0
            });
          } else {
            console.log("User already in group chat");
          }
        }
      } catch (e) {
        console.error("Error ensuring group chat:", e);
      }
    };
    ensureGroupChat();

    return () => unsubscribeChats();
  }, [user, userData]);

  useEffect(() => {
    if (!activeChat || !user) return;

    // Mark as read when opening chat
    const markAsRead = async () => {
      try {
        const chatRef = doc(db, 'chats', activeChat.id);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const data = chatSnap.data() as Chat;
          const unreadCounts = data.unreadCounts || {};
          if (unreadCounts[user.uid] > 0) {
            await updateDoc(chatRef, {
              [`unreadCounts.${user.uid}`]: 0
            });
          }
        }
      } catch (e) {
        console.error("Error marking as read", e);
      }
    };
    markAsRead();

    const messagesQuery = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach(doc => {
        messageList.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messageList);
      scrollToBottom();
      
      // Also mark as read when new messages arrive while chat is open
      if (document.visibilityState === 'visible') {
        const chatRef = doc(db, 'chats', activeChat.id);
        updateDoc(chatRef, { [`unreadCounts.${user.uid}`]: 0 }).catch(() => {});
      }
    });

    return () => unsubscribeMessages();
  }, [activeChat, user]);

  const markMessagesAsRead = async () => {
    if (!activeChat || !user || messages.length === 0) return;

    const unreadMessagesForMe = messages.filter(msg => 
      msg.senderId !== user.uid && 
      (!msg.readBy || !msg.readBy[user.uid])
    );

    if (unreadMessagesForMe.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadMessagesForMe.forEach(msg => {
        const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
        batch.update(msgRef, {
          [`readBy.${user.uid}`]: new Date().toISOString()
        });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error marking messages as read", e);
    }
  };

  useEffect(() => {
    markMessagesAsRead();
  }, [messages, activeChat, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    setIsSending(true);
    try {
      const messageData = {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: userData?.fullName || user.email?.split('@')[0] || 'Unknown',
        text: newMessage,
        type: 'text',
        chatType: activeChat.type,
        participants: activeChat.participants || [],
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), messageData);
      
      const unreadUpdates: any = {
        lastMessage: newMessage,
        lastMessageAt: new Date().toISOString(),
        lastSenderId: user.uid,
        updatedAt: new Date().toISOString()
      };

      // Increment unread counts for all other participants
      activeChat.participants.forEach(pUid => {
        if (pUid !== user.uid) {
          unreadUpdates[`unreadCounts.${pUid}`] = (activeChat.unreadCounts?.[pUid] || 0) + 1;
        }
      });

      await updateDoc(doc(db, 'chats', activeChat.id), unreadUpdates);

      setNewMessage('');
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please check your internet connection or try logging out and back in.");
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}/messages`);
    } finally {
      setIsSending(false);
    }
  };

  const startDirectMessage = async (contact: any) => {
    // Check if DM already exists
    const existingChat = chats.find(c => 
      c.type === 'direct' && c.participants.includes(contact.uid)
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setMobileChatOpen(true);
      setShowContacts(false);
      return;
    }

    // Create new DM
    try {
      const chatId = [user!.uid, contact.uid].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: [user!.uid, contact.uid],
          type: 'direct',
          updatedAt: new Date().toISOString()
        });
      }
      
      setActiveChat({ id: chatId, participants: [user!.uid, contact.uid], type: 'direct', updatedAt: new Date().toISOString() });
      setMobileChatOpen(true);
      setShowContacts(false);
    } catch (e) {
      console.error("Error starting DM", e);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMobileChatOpen(false);
      }
    } catch (e) {
      console.error("Error deleting chat", e);
    }
  };

  const updateGroupName = async () => {
    if (!activeChat || (!newGroupName.trim() && !newGroupLogo.trim()) || activeChat.type !== 'group') return;
    try {
      await updateDoc(doc(db, 'chats', activeChat.id), {
        name: newGroupName,
        photoURL: newGroupLogo,
        updatedAt: new Date().toISOString()
      });
      setIsAdminSettingsOpen(false);
      setStatusMessage({ type: 'success', text: 'Group settings updated successfully!' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error("Error updating group settings", e);
      setStatusMessage({ type: 'error', text: 'Failed to update group settings.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Max dimensions for logo
        const MAX_SIZE = 400;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with quality 0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setNewGroupLogo(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const clearChatHistory = async () => {
    if (!activeChat) return;

    setIsDeletingHistory(true);
    setStatusMessage(null);
    console.log("Starting chat history clear for:", activeChat.id);
    try {
      const messagesRef = collection(db, 'chats', activeChat.id, 'messages');
      const snapshot = await getDocs(messagesRef);
      console.log(`Found ${snapshot.docs.length} messages to delete`);
      
      const chunks = [];
      const batchSize = 500;
      const docs = snapshot.docs;
      
      for (let i = 0; i < docs.length; i += batchSize) {
        chunks.push(docs.slice(i, i + batchSize));
      }

      for (const [idx, chunk] of chunks.entries()) {
        console.log(`Processing batch ${idx + 1}/${chunks.length}`);
        const batch = writeBatch(db);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }

      console.log("Messages deleted, updating chat document...");

      // Also reset last message
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: '',
        lastMessageAt: null,
        lastSenderId: null,
        updatedAt: new Date().toISOString()
      });

      console.log("Chat history cleared successfully");
      setStatusMessage({ type: 'success', text: 'Chat history cleared successfully!' });
      setShowDeleteConfirm(false);
      setTimeout(() => {
        setIsAdminSettingsOpen(false);
        setStatusMessage(null);
      }, 2000);
    } catch (e) {
      console.error("Error clearing history", e);
      handleFirestoreError(e, OperationType.WRITE, `chats/${activeChat.id}/messages`);
      setStatusMessage({ type: 'error', text: 'Failed to clear chat history.' });
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'group') return chat.name || 'Group Chat';
    const otherId = chat.participants.find(p => p !== user?.uid);
    const contact = contacts.find(c => c.uid === otherId);
    return contact?.fullName || 'Private Chat';
  };

  const filteredContacts = contacts.filter(c => 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col bg-slate-950/40 backdrop-blur-xl rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative mt-2 mb-2">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className={`w-full md:w-80 flex-col border-r border-white/5 ${isMobileView && mobileChatOpen ? 'hidden' : 'flex'} bg-black/20`}>
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-white tracking-tighter flex items-center gap-2 uppercase italic">
                <MessageSquare className="w-5 h-5 text-blue-500" /> Ops-Chat
              </h2>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className={`rounded-xl h-10 w-10 p-0 transition-all ${soundEnabled ? 'text-blue-400 bg-blue-500/10' : 'text-white/20'}`}
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="rounded-xl h-10 w-10 p-0 text-white/20 hover:text-white"
                  onClick={() => setShowContacts(true)}
                >
                  <Users className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input 
                placeholder="Secure frequency..." 
                className="pl-11 h-12 rounded-[20px] bg-slate-950/60 border-white/5 text-sm font-bold text-white placeholder:text-white/20 focus:ring-blue-500/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
            {loading ? (
              <div className="space-y-3 p-2">
                <Skeleton count={6} className="h-20 w-full rounded-[24px] bg-white/5" />
              </div>
            ) : chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat);
                  setMobileChatOpen(true);
                }}
                className={`w-full p-4 rounded-[28px] flex items-center gap-4 transition-all group relative overflow-hidden ${
                  activeChat?.id === chat.id 
                    ? 'bg-blue-600/20 border border-blue-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg overflow-hidden border border-white/10 bg-slate-900 group-hover:scale-105 transition-transform`}>
                  {chat.photoURL ? (
                    <img src={chat.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${chat.type === 'group' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-white/20'}`}>
                      {chat.type === 'group' ? <Users className="w-7 h-7" /> : <User className="w-7 h-7" />}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-black text-sm text-white truncate uppercase italic tracking-tight">{getChatName(chat)}</h3>
                    {chat.lastMessageAt && (
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{format(new Date(chat.lastMessageAt), 'p')}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={`text-[11px] truncate flex-1 leading-none ${chat.unreadCounts?.[user?.uid || ''] ? 'font-black text-white' : 'text-white/40 font-medium'}`}>
                      {chat.lastSenderId === user?.uid ? 'YOU: ' : ''}{chat.lastMessage || 'Channel established...'}
                    </p>
                    {chat.unreadCounts?.[user?.uid || ''] ? (
                      <div className="ml-3 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                        {chat.unreadCounts[user?.uid || '']}
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col transition-all ${isMobileView && !mobileChatOpen ? 'hidden md:flex' : 'flex'} bg-black/40`}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="h-20 flex items-center justify-between px-8 bg-slate-950/60 backdrop-blur-md border-b border-white/5 z-10 shrink-0">
                <div className="flex items-center gap-4 text-left">
                  {isMobileView && (
                    <Button variant="ghost" size="icon" onClick={() => setMobileChatOpen(false)} className="mr-1 text-white/40">
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 bg-slate-900`}>
                    {activeChat.photoURL ? (
                      <img src={activeChat.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${activeChat.type === 'group' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-white/20'}`}>
                        {activeChat.type === 'group' ? <Users className="w-6 h-6" /> : <User className="w-6 h-6" />}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-black text-lg text-white uppercase italic tracking-tight leading-none">{getChatName(activeChat)}</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                      <span className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] italic">Established</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userData?.role === 'admin' && activeChat.type === 'group' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="hidden sm:flex items-center gap-2 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 rounded-xl px-4"
                      onClick={() => {
                        setNewGroupName(activeChat.name || '');
                        setNewGroupLogo(activeChat.photoURL || '');
                        setIsAdminSettingsOpen(true);
                      }}
                    >
                      <Settings2 className="w-4 h-4" />
                      <span className="text-xs font-bold">Group Admin</span>
                    </Button>
                  )}
                  {userData?.role === 'admin' && activeChat.type === 'group' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="flex sm:hidden text-blue-500"
                      onClick={() => {
                        setNewGroupName(activeChat.name || '');
                        setNewGroupLogo(activeChat.photoURL || '');
                        setIsAdminSettingsOpen(true);
                      }}
                    >
                      <Settings2 className="w-5 h-5" />
                    </Button>
                  )}
                  {activeChat.type === 'direct' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm("Delete this conversation?")) deleteChat(activeChat.id);
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-slate-400">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <MessageSquare className="w-12 h-12 mb-2" />
                    <p className="text-sm">Start a conversation...</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.senderId === user?.uid;
                    const showName = i === 0 || messages[i-1].senderId !== msg.senderId;
                    const showDate = i === 0 || !isSameDay(new Date(msg.createdAt), new Date(messages[i-1].createdAt));

                    return (
                      <div key={msg.id} className="space-y-4">
                        {showDate && (
                          <div className="flex justify-center flex-row">
                            <span className="px-3 py-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {format(new Date(msg.createdAt), 'MMMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && showName && (
                              <span className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-wider">{msg.senderName}</span>
                            )}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group ${
                              isMe 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700/50'
                            }`}>
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                              <div className={`absolute bottom-[-18px] opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-medium whitespace-nowrap px-1 ${
                                isMe ? 'right-0 text-blue-400' : 'left-0 text-slate-400'
                              }`}>
                                {format(new Date(msg.createdAt), 'p')}
                              </div>
                            </div>

                            {/* Seen Indicators */}
                            {isMe && msg.readBy && Object.keys(msg.readBy).filter(uid => uid !== user?.uid).length > 0 && (
                              <div className="flex justify-end mt-1 px-1">
                                {activeChat.type === 'direct' ? (
                                  Object.entries(msg.readBy)
                                    .filter(([uid]) => uid !== user?.uid)
                                    .map(([uid, time]) => (
                                      <span key={uid} className="text-[9px] text-slate-400 font-medium">
                                        Seen {format(new Date(time), 'p')}
                                      </span>
                                    ))
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    Seen by {Object.keys(msg.readBy)
                                      .filter(uid => uid !== user?.uid)
                                      .map(uid => contacts.find(c => c.uid === uid)?.fullName || 'Someone')
                                      .join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-slate-400 hover:text-blue-500">
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Input 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus-visible:ring-1 ring-blue-500"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!newMessage.trim() || isSending}
                    className="shrink-0 w-11 h-11 bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/20"
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
                <MessageSquare className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Welcome to Leo Enterprises Messenger</h3>
              <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                Choose a conversation from the sidebar or start a new chat with your team members.
              </p>
              <Button 
                className="mt-6 rounded-2xl bg-blue-600 hover:bg-blue-700 px-8 py-6 font-bold flex items-center gap-2"
                onClick={() => setShowContacts(true)}
              >
                <Users className="w-5 h-5" /> View Personnel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Contacts Modal Placeholder */}
      <AnimatePresence>
        {showContacts && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-black tracking-tight">Active Personnel</h3>
                <Button variant="ghost" onClick={() => setShowContacts(false)} className="rounded-xl">Close</Button>
              </div>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search people..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-xl border-slate-200"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No personnel found.</div>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.uid}
                      onClick={() => startDirectMessage(contact)}
                      className="w-full p-3 rounded-2xl flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center font-bold text-slate-500">
                        {contact.photoURL ? (
                          <img src={contact.photoURL} alt={contact.fullName} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                        ) : (
                          contact.fullName[0]
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white capitalize">{contact.fullName}</h4>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-bold uppercase tracking-wider">{contact.role}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Dialog open={isAdminSettingsOpen} onOpenChange={setIsAdminSettingsOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Group Settings</DialogTitle>
            <DialogDescription>
              Manage parameters for the group chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {statusMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold ${statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {statusMessage.text}
              </div>
            )}
            
            {!showDeleteConfirm ? (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                      id="group-name" 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Enter group name"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="group-logo">Group Logo</Label>
                    <div className="flex flex-col items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center relative group">
                        {newGroupLogo ? (
                          <>
                            <img src={newGroupLogo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button 
                              onClick={() => setNewGroupLogo('')}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <div className="text-slate-300">
                            <ImagePlus className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 w-full">
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          className="hidden"
                          accept="image/*"
                        />
                        <Button 
                          type="button"
                          variant="outline" 
                          className="w-full rounded-xl border-slate-200 hover:bg-white"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </Button>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-100 dark:border-slate-800"></span>
                          </div>
                          <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                            <span className="bg-white dark:bg-slate-900 px-2">OR</span>
                          </div>
                        </div>
                        <Input 
                          id="group-logo" 
                          value={newGroupLogo} 
                          onChange={(e) => setNewGroupLogo(e.target.value)}
                          placeholder="Paste image URL here"
                          className="rounded-xl text-[10px] h-8"
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={updateGroupName} className="w-full bg-blue-600 rounded-xl py-6 font-bold">Update Settings</Button>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Label className="text-red-500 font-bold mb-2 block text-xs uppercase tracking-wider">Danger Zone</Label>
                  <Button 
                    variant="destructive" 
                    className="w-full rounded-xl flex items-center gap-2 py-6 font-bold"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeletingHistory}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear History
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h4 className="font-bold text-red-900 dark:text-red-400 mb-2">Delete Chat History?</h4>
                <p className="text-sm text-red-700 dark:text-red-500/70 mb-6">
                  This will permanently delete all messages in this group for everyone. This action cannot be undone.
                </p>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="destructive" 
                    className="w-full rounded-xl font-bold py-6"
                    onClick={clearChatHistory}
                    disabled={isDeletingHistory}
                  >
                    {isDeletingHistory && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Confirm Delete All
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full rounded-xl"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeletingHistory}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAdminSettingsOpen(false)} className="rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
