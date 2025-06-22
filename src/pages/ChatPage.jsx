import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const ChatPage = () => {
  const { id: receiverId } = useParams();
  const sender = JSON.parse(localStorage.getItem('alumniUser'));
  const senderId = sender?.id;

  const [receiverName, setReceiverName] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const bottomRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch receiver info
  useEffect(() => {
    supabase
      .from('users')
      .select('full_name, username')
      .eq('id', receiverId)
      .single()
      .then(({ data }) => {
        if (data) setReceiverName(`${data.full_name} (@${data.username})`);
      });
  }, [receiverId]);

  // Load messages and listen for new ones
  useEffect(() => {
    if (!senderId || !receiverId) return;

    // Fetch initial messages
    supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
      )
      .order('timestamp', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        scrollToBottom('auto');
      });

    // Listen for new messages
    const channel = supabase
      .channel(`chat-${senderId}-${receiverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          const relevant =
            (newMsg.sender_id === senderId && newMsg.receiver_id === receiverId) ||
            (newMsg.sender_id === receiverId && newMsg.receiver_id === senderId);
          if (relevant) {
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom('smooth');

            if (newMsg.sender_id !== senderId) {
              toast.info(`New message from ${receiverName.split(' ')[0]}`, {
                position: 'top-right',
                autoClose: 3000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiverId, senderId, receiverName]);

  // Scroll helper function
  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      await supabase.from('messages').insert([
        { sender_id: senderId, receiver_id: receiverId, content: message.trim() },
      ]);
      setMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error.message);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-3xl w-full mx-auto mt-10 flex flex-col bg-white rounded-2xl shadow-xl flex-grow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-200 flex-shrink-0">
          <h2 className="text-2xl font-bold text-purple-800">{receiverName || 'Loading...'}</h2>
        </div>

        {/* Messages container - flex-grow and overflow-y-auto */}
        <div
          className="flex-grow overflow-y-auto p-6 space-y-4 bg-purple-100"
          style={{ minHeight: 0, maxHeight: 'calc(100vh - 280px)' }} // limit max height for scroll
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === senderId ? 'justify-end' : 'justify-start'}`}
            >
              <span
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.sender_id === senderId
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none shadow'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-6 py-4 border-t border-purple-200 flex gap-3 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message…"
            className="flex-grow px-4 py-3 rounded-full border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-purple-700 text-white rounded-full hover:bg-purple-800 transition"
          >
            Send
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ChatPage;
