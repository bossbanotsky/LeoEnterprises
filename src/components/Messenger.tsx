import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Chat, Message, Employee } from '../types';
import { format, isSameDay } from 'date-fns';
import { MessageSquare, Send, Users, User, Search, Trash2, ChevronLeft, MoreVertical, Loader2, Smile, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'motion/react';

export default function Messenger() {
  const { user, userData } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<{uid: string, fullName: string, role: string, photoURL?: string}[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const lastProcessedTime = useRef<string>(new Date().toISOString());

  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Quick sharp alert sound
    notificationSound.current.volume = 0.5;
  }, []);

  // Play sound when a new message arrives in any chat
  useEffect(() => {
    if (!user || chats.length === 0) return;

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
      const groupChatRef = doc(db, 'chats', 'common-group');
      const docSnap = await getDoc(groupChatRef);
      if (!docSnap.exists()) {
        await setDoc(groupChatRef, {
          participants: [user.uid], // Start with creator
          type: 'group',
          name: 'General Staff Group',
          updatedAt: new Date().toISOString()
        });
      } else {
        // If it exists, make sure current user is in participants
        const data = docSnap.data();
        if (!data.participants.includes(user.uid)) {
          await updateDoc(groupChatRef, {
            participants: [...data.participants, user.uid]
          });
        }
      }
    };
    ensureGroupChat();

    return () => unsubscribeChats();
  }, [user, userData]);

  useEffect(() => {
    if (!activeChat) return;

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
    });

    return () => unsubscribeMessages();
  }, [activeChat]);

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
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), messageData);
      
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: newMessage,
        lastMessageAt: new Date().toISOString(),
        lastSenderId: user.uid,
        updatedAt: new Date().toISOString()
      });

      setNewMessage('');
    } catch (error) {
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
    if (!window.confirm("Are you sure you want to delete this conversation?")) return;
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
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl relative mt-2 mb-2">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className={`w-full md:w-80 flex-col border-r border-slate-100 dark:border-slate-800 ${isMobileView && mobileChatOpen ? 'hidden' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" /> Messenger
              </h2>
              <Button 
                size="sm" 
                variant="ghost" 
                className="rounded-xl h-9 w-9 p-0"
                onClick={() => setShowContacts(true)}
              >
                <Users className="w-5 h-5 text-slate-500" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search chats..." 
                className="pl-9 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chats.map(chat => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat);
                  setMobileChatOpen(true);
                }}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${
                  activeChat?.id === chat.id 
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-800' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  chat.type === 'group' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}>
                  {chat.type === 'group' ? <Users className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{getChatName(chat)}</h3>
                    {chat.lastMessageAt && (
                      <span className="text-[10px] text-slate-400">{format(new Date(chat.lastMessageAt), 'p')}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {chat.lastSenderId === user?.uid ? 'You: ' : ''}{chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 transition-all ${isMobileView && !mobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-10 shrink-0">
                <div className="flex items-center gap-3">
                  {isMobileView && (
                    <Button variant="ghost" size="icon" onClick={() => setMobileChatOpen(false)} className="mr-1">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeChat.type === 'group' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600'
                  }`}>
                    {activeChat.type === 'group' ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white leading-tight">{getChatName(activeChat)}</h2>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Online</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeChat.type === 'direct' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => deleteChat(activeChat.id)}
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
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Welcome to Banotsky Messenger</h3>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
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
    </div>
  );
}
