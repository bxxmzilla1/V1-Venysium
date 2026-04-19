'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Search,
  LogOut,
  Send,
  Users,
  ChevronLeft,
  StickyNote,
  Tag,
  X,
  Plus,
  Loader2,
  Hash,
  User,
  UsersRound,
} from 'lucide-react';

interface Dialog {
  id: string;
  name: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageDate: number;
  isUser: boolean;
  isGroup: boolean;
  isChannel: boolean;
  entityId: string | null;
}

interface Message {
  id: number;
  message: string;
  date: number;
  out: boolean;
  fromId: string | null;
  media: string | null;
}

interface CRMNote {
  id: string;
  text: string;
  createdAt: number;
}

interface CRMData {
  notes: CRMNote[];
  tags: string[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function AvatarCircle({ name, size = 44 }: { name: string; size?: number }) {
  const colors = [
    '#6c63ff', '#e05cff', '#5c8aff', '#ff6b6b',
    '#ffa35c', '#5ce8ff', '#5cffb5', '#ff5c8a',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: '600',
        color: 'white',
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

const TAG_COLORS = [
  '#6c63ff', '#e05cff', '#5c8aff', '#ff6b6b',
  '#ffa35c', '#5cffb5', '#ff5c8a', '#5ce8ff',
];

const DIALOG_POLL_MS = 3000;   // dialog list refreshes every 3 s
const MESSAGE_POLL_MS = 1000;  // active chat refreshes every 1 s

export default function CRMDashboard({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [selected, setSelected] = useState<Dialog | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCrm, setShowCrm] = useState(false);
  const [crmData, setCrmData] = useState<CRMData>({ notes: [], tags: [] });
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tab, setTab] = useState<'chats' | 'contacts'>('chats');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'error'>('connecting');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Dialog | null>(null);
  const lastMessageIdRef = useRef<number>(0);
  const dialogFetchingRef = useRef(false);
  const msgFetchingRef = useRef(false);
  const searchRef = useRef(search);

  // Keep refs in sync
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { searchRef.current = search; }, [search]);

  // ── helpers ──────────────────────────────────────────────────────────────

  function isScrolledToBottom() {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function scrollToBottom(smooth = true) {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }

  function loadCrm(dialogId: string) {
    try {
      const raw = localStorage.getItem(`crm_${dialogId}`);
      if (raw) setCrmData(JSON.parse(raw));
      else setCrmData({ notes: [], tags: [] });
    } catch {
      setCrmData({ notes: [], tags: [] });
    }
  }

  function saveCrm(dialogId: string, data: CRMData) {
    localStorage.setItem(`crm_${dialogId}`, JSON.stringify(data));
    setCrmData(data);
  }

  // ── dialog polling ────────────────────────────────────────────────────────

  async function fetchDialogsSilent() {
    if (dialogFetchingRef.current) return;
    dialogFetchingRef.current = true;
    try {
      const q = searchRef.current;
      const res = await fetch(`/api/dialogs?limit=60&search=${encodeURIComponent(q)}`);
      if (!res.ok) { setLiveStatus('error'); return; }
      const data = await res.json();
      if (data.dialogs) {
        setDialogs(data.dialogs);
        setLiveStatus('live');
      }
    } catch {
      setLiveStatus('error');
    } finally {
      dialogFetchingRef.current = false;
    }
  }

  // Initial load with spinner
  async function fetchDialogsInitial() {
    setLoading(true);
    await fetchDialogsSilent();
    setLoading(false);
  }

  // ── message polling ───────────────────────────────────────────────────────

  async function fetchNewMessages() {
    const dialog = selectedRef.current;
    if (!dialog || msgFetchingRef.current) return;
    msgFetchingRef.current = true;
    try {
      const minId = lastMessageIdRef.current;
      const url = minId > 0
        ? `/api/messages?peerId=${encodeURIComponent(dialog.id)}&limit=20&minId=${minId}`
        : `/api/messages?peerId=${encodeURIComponent(dialog.id)}&limit=50`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      const atBottom = isScrolledToBottom();

      if (minId === 0) {
        // Initial full load
        setMessages(data.messages);
        if (data.messages.length > 0) {
          lastMessageIdRef.current = Math.max(...data.messages.map((m: Message) => m.id));
        }
        setTimeout(() => scrollToBottom(false), 50);
      } else {
        // Append only new messages
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = (data.messages as Message[]).filter((m) => !existingIds.has(m.id));
          if (fresh.length === 0) return prev;
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, ...fresh.map((m) => m.id));
          if (atBottom) setTimeout(() => scrollToBottom(true), 50);
          return [...prev, ...fresh];
        });
      }
    } catch {
      // ignore
    } finally {
      msgFetchingRef.current = false;
    }
  }

  // ── polling intervals ─────────────────────────────────────────────────────

  // Dialog polling: every 3 s
  useEffect(() => {
    fetchDialogsInitial();
    const id = setInterval(fetchDialogsSilent, DIALOG_POLL_MS);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch dialogs when search changes
  useEffect(() => {
    fetchDialogsSilent();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Message polling: every 1 s when a dialog is selected
  useEffect(() => {
    if (!selected) return;
    lastMessageIdRef.current = 0;
    setMessages([]);
    setMsgLoading(true);
    fetchNewMessages().then(() => setMsgLoading(false));
    const id = setInterval(fetchNewMessages, MESSAGE_POLL_MS);
    return () => clearInterval(id);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── actions ───────────────────────────────────────────────────────────────

  async function selectDialog(dialog: Dialog) {
    setSelected(dialog);
    loadCrm(dialog.id);
    setSidebarOpen(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !input.trim() || sending) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const tempId = Date.now();
    const tempMsg: Message = {
      id: tempId,
      message: text,
      date: Math.floor(Date.now() / 1000),
      out: true,
      fromId: null,
      media: null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: selected.id, message: text }),
      });
      const data = await res.json();
      // Replace optimistic message with real one and update lastMessageId
      if (data.message?.id) {
        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, data.message.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: data.message.id } : m))
        );
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function addNote() {
    if (!newNote.trim() || !selected) return;
    const note: CRMNote = {
      id: Date.now().toString(),
      text: newNote.trim(),
      createdAt: Date.now(),
    };
    const updated = { ...crmData, notes: [...crmData.notes, note] };
    saveCrm(selected.id, updated);
    setNewNote('');
  }

  function removeNote(id: string) {
    if (!selected) return;
    const updated = { ...crmData, notes: crmData.notes.filter((n) => n.id !== id) };
    saveCrm(selected.id, updated);
  }

  function addTag() {
    if (!newTag.trim() || !selected) return;
    if (crmData.tags.includes(newTag.trim())) return;
    const updated = { ...crmData, tags: [...crmData.tags, newTag.trim()] };
    saveCrm(selected.id, updated);
    setNewTag('');
  }

  function removeTag(tag: string) {
    if (!selected) return;
    const updated = { ...crmData, tags: crmData.tags.filter((t) => t !== tag) };
    saveCrm(selected.id, updated);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? '320px' : selected ? '0px' : '100%',
          minWidth: sidebarOpen ? '320px' : selected ? '0px' : '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          transition: 'width 0.25s ease, min-width 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 16px 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageCircle size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Venysium
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Hi, {firstName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Live indicator */}
              <div
                title={liveStatus === 'live' ? 'Live' : liveStatus === 'error' ? 'Connection error' : 'Connecting...'}
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: liveStatus === 'live' ? '#5cffb5' : liveStatus === 'error' ? '#ff6b6b' : '#ffa35c',
                    boxShadow: liveStatus === 'live' ? '0 0 6px #5cffb5' : 'none',
                    animation: liveStatus === 'live' ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {liveStatus === 'live' ? 'Live' : liveStatus === 'error' ? 'Error' : '...'}
                </span>
              </div>
              <button onClick={logout} title="Logout" style={iconBtnStyle}>
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {(['chats', 'contacts'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: tab === t ? 'var(--accent-light)' : 'transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'chats' ? <MessageCircle size={14} /> : <Users size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
              }}
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={24} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : dialogs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No conversations found
            </div>
          ) : (
            dialogs.map((dialog) => (
              <div
                key={dialog.id}
                onClick={() => selectDialog(dialog)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selected?.id === dialog.id ? 'var(--accent-light)' : 'transparent',
                  borderLeft: selected?.id === dialog.id ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selected?.id !== dialog.id) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selected?.id !== dialog.id) {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }
                }}
              >
                <div style={{ position: 'relative' }}>
                  <AvatarCircle name={dialog.name} />
                  {/* Type badge */}
                  {!dialog.isUser && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: dialog.isGroup ? '#5c8aff' : '#e05cff',
                        border: '2px solid var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {dialog.isGroup ? <UsersRound size={8} color="white" /> : <Hash size={8} color="white" />}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '160px',
                      }}
                    >
                      {dialog.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {dialog.lastMessageDate ? formatDate(dialog.lastMessageDate) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '190px',
                      }}
                    >
                      {dialog.lastMessage || 'No messages'}
                    </span>
                    {dialog.unreadCount > 0 && (
                      <span
                        style={{
                          background: 'var(--accent)',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          minWidth: '18px',
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {dialog.unreadCount > 99 ? '99+' : dialog.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: selected ? 1 : 0.4,
        }}
      >
        {selected ? (
          <>
            {/* Chat Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setSidebarOpen(true)}
                style={{ ...iconBtnStyle, display: 'flex' }}
              >
                <ChevronLeft size={18} />
              </button>
              <AvatarCircle name={selected.name} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selected.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selected.isUser ? 'Private chat' : selected.isGroup ? 'Group' : 'Channel'}
                </div>
              </div>
              {/* CRM Tags preview */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {crmData.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={tag}
                    style={{
                      background: `${TAG_COLORS[i % TAG_COLORS.length]}22`,
                      color: TAG_COLORS[i % TAG_COLORS.length],
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setShowCrm(!showCrm)}
                title="CRM Notes"
                style={{
                  ...iconBtnStyle,
                  background: showCrm ? 'var(--accent-light)' : undefined,
                  color: showCrm ? 'var(--accent)' : undefined,
                }}
              >
                <StickyNote size={16} />
              </button>
            </div>

            {/* Messages + CRM Panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Messages */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div
                  ref={messagesContainerRef}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {msgLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '60px' }}>
                      <Loader2
                        size={28}
                        style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
                      />
                    </div>
                  ) : messages.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        paddingTop: '60px',
                      }}
                    >
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="animate-fade-in"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: msg.out ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div className={`message-bubble ${msg.out ? 'sent' : 'received'}`}>
                          {msg.message || (msg.media ? `[${msg.media}]` : '')}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            marginTop: '3px',
                            padding: '0 4px',
                          }}
                        >
                          {formatDate(msg.date)}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {selected.isUser || selected.isGroup ? (
                  <form
                    onSubmit={sendMessage}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '14px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Message ${selected.name}...`}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || sending}
                      style={{
                        padding: '12px 18px',
                        borderRadius: '12px',
                        background: input.trim() && !sending ? 'var(--accent)' : 'var(--bg-hover)',
                        border: 'none',
                        color: input.trim() && !sending ? 'white' : 'var(--text-secondary)',
                        cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '600',
                        fontSize: '14px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                    </button>
                  </form>
                ) : (
                  <div
                    style={{
                      padding: '14px 20px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      textAlign: 'center',
                    }}
                  >
                    This is a channel — you can view messages but cannot reply here.
                  </div>
                )}
              </div>

              {/* CRM Panel */}
              {showCrm && (
                <div
                  style={{
                    width: '280px',
                    borderLeft: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                  className="animate-fade-in"
                >
                  <div
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      CRM Panel
                    </div>
                    <button onClick={() => setShowCrm(false)} style={iconBtnStyle}>
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {/* Contact Info */}
                    <div style={{ marginBottom: '20px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <User size={11} /> Contact
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AvatarCircle name={selected.name} size={40} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {selected.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {selected.isUser ? 'Contact' : selected.isGroup ? 'Group' : 'Channel'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={sectionLabelStyle}>
                        <Tag size={11} /> Tags
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {crmData.tags.map((tag, i) => (
                          <span
                            key={tag}
                            style={{
                              background: `${TAG_COLORS[i % TAG_COLORS.length]}22`,
                              color: TAG_COLORS[i % TAG_COLORS.length],
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => removeTag(tag)}
                          >
                            {tag}
                            <X size={10} />
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Add tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          style={miniInputStyle}
                        />
                        <button onClick={addTag} style={miniAddBtnStyle}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <div style={sectionLabelStyle}>
                        <StickyNote size={11} /> Notes
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        {crmData.notes.map((note) => (
                          <div
                            key={note.id}
                            style={{
                              background: 'var(--bg-hover)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              lineHeight: '1.5',
                              position: 'relative',
                            }}
                          >
                            {note.text}
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                marginTop: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                              <button
                                onClick={() => removeNote(note.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  padding: '0',
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {crmData.notes.length === 0 && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                            No notes yet
                          </div>
                        )}
                      </div>
                      <textarea
                        placeholder="Write a note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                        style={{
                          ...miniInputStyle,
                          width: '100%',
                          resize: 'none',
                          marginBottom: '6px',
                          fontFamily: 'inherit',
                        }}
                      />
                      <button
                        onClick={addNote}
                        disabled={!newNote.trim()}
                        style={{
                          width: '100%',
                          padding: '9px',
                          borderRadius: '10px',
                          background: newNote.trim() ? 'var(--accent)' : 'var(--bg-hover)',
                          border: 'none',
                          color: newNote.trim() ? 'white' : 'var(--text-secondary)',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: newNote.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Plus size={14} /> Add Note
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <MessageCircle size={56} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Select a conversation
            </div>
            <div style={{ fontSize: '14px' }}>Choose from your chats on the left to start messaging</div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: '8px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '700',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const miniInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
};

const miniAddBtnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  cursor: 'pointer',
  flexShrink: 0,
};
