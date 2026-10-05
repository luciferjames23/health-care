import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

export default function EmployeeServiceChatbot({ currentUser, currentRole }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'bot',
      text: `Hello ${currentUser?.name || 'Staff Member'}! I am your **Employee Service Agent**. How can I assist you with your shifts, leave balances, or HR policies today?`,
      time: 'Just now',
      quickActions: ['[My Shift Tomorrow]', '[Check Leave Balance]', '[Apply Comp-Off]']
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSlip, setActiveSlip] = useState(null);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Hide Employee Service Agent chatbot for Admin / Hospital Management and Patient roles
  // (Only visible for Doctors, Nurses, and Clinical / Operational Staff)
  const ADMIN_ROLES = [
    'hospital management',
    'admin',
    'system admin',
    'ai administrator',
    'governance officer',
    'it administrator',
    'auditor',
    'patient'
  ];
  const roleLower = String(currentRole || '').trim().toLowerCase();
  const userRoleLower = String(currentUser?.role || '').trim().toLowerCase();

  if (
    ADMIN_ROLES.includes(roleLower) ||
    ADMIN_ROLES.includes(userRoleLower) ||
    currentUser?.username === 'admin'
  ) {
    return null;
  }

  const effectiveUsername = currentUser?.username || currentUser?.name || currentUser?.staff_name || (currentRole === 'Nurse' ? 'nurse.priya' : 'dr.divya');

  const handleSendMessage = async (customMsg = null) => {
    const textToSend = customMsg || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customMsg) setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/employee-agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          username: effectiveUsername,
          history: messages.slice(-6).map(m => ({
            sender: m.sender,
            text: m.text,
            interactive_slip: m.interactiveSlip || null
          }))
        })
      });

      const data = await response.json();
      if (data && data.success) {
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          interactiveSlip: data.interactive_slip || null,
          quickActions: data.quick_actions || []
        };
        setMessages(prev => [...prev, botMsg]);
        if (data.interactive_slip) {
          setActiveSlip(data.interactive_slip);
          if (data.interactive_slip.type === 'leave_slip_confirmed') {
            window.dispatchEvent(new CustomEvent('hc_api_updated'));
          }
        }
      } else {
        throw new Error(data.detail || 'Could not process query');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: "I couldn't reach the HR roster server. Please check your network connection.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySlip = async (slip) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/employee-agent/apply-leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: effectiveUsername,
          leave_type: slip.leave_type || 'Comp-Off',
          from_date: slip.from_date,
          to_date: slip.to_date,
          reason: `${slip.leave_type || 'Leave'} applied via Employee Service Agent for ${slip.date_display}`
        })
      });

      const res = await response.json();
      if (response.ok && res && res.success) {
        const confirmMsg = {
          id: `bot-confirm-${Date.now()}`,
          sender: 'bot',
          text: `Done! Your **${slip.leave_type}** request (${res.request.request_code}) has been **submitted and created** for approval.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          interactiveSlip: {
            type: 'leave_slip_confirmed',
            request_code: res.request.request_code,
            staff_name: slip.staff_name,
            leave_type: slip.leave_type,
            status: 'Submitted · Pending Sign-off',
            date_display: slip.date_display,
            supervisor: res.request.supervisor_name
          },
          quickActions: ['[My Shift Tomorrow]', '[Check Leave Balance]']
        };
        setMessages(prev => [...prev, confirmMsg]);
        setActiveSlip(null);
        window.dispatchEvent(new CustomEvent('hc_api_updated'));
      } else {
        const errorMsg = res?.detail || res?.error || 'Multiple applications for the same date are not allowed.';
        setMessages(prev => [
          ...prev,
          {
            id: `bot-dup-${Date.now()}`,
            sender: 'bot',
            text: `⚠️ **Leave Application Notice**: ${errorMsg}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: false,
            quickActions: ['[My Shift Tomorrow]', '[Check Leave Balance]']
          }
        ]);
        setActiveSlip(null);
      }
    } catch (err) {
      console.error('Error applying slip:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: "Could not file the leave request. Please check your connection or contact HR operations.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionText) => {
    const clean = actionText.replace(/^\[|\]$/g, '');
    if (clean === 'My Shift Tomorrow') {
      handleSendMessage('What is my shift timing tomorrow?');
    } else if (clean === 'Check Leave Balance') {
      handleSendMessage('What is my leave and comp-off balance?');
    } else if (clean === 'Apply Comp-Off') {
      handleSendMessage('I would like to apply for a comp-off');
    } else if (clean.includes('Confirm & Submit') || clean.startsWith('Confirm')) {
      handleSendMessage(clean);
    } else if (clean === 'Cancel') {
      setActiveSlip(null);
      handleSendMessage('Cancel');
    } else if (clean.startsWith('Yes')) {
      handleSendMessage('Yes, please apply for Friday');
    } else {
      handleSendMessage(clean);
    }
  };

  return (
    <>
      {/* ── Floating Chat Bubble Trigger ── */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1020,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px'
      }}>
        <button
          type="button"
          id="btn-employee-service-agent"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Open Employee Service Agent Chatbot"
        >
          {isOpen ? '✕' : '💬'}
        </button>
      </div>

      {/* ── Floating Conversational Widget ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          width: '390px',
          maxWidth: 'calc(100vw - 32px)',
          height: '580px',
          maxHeight: 'calc(100vh - 120px)',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                👩‍⚕️
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', letterSpacing: '-0.01em' }}>
                  Employee Service Agent
                </div>
                <div style={{ fontSize: '11px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80' }} />
                  <span>Online · HR Leave Policy v5.0</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          {/* Quick Action Top Pills */}
          <div style={{
            display: 'flex',
            gap: '6px',
            padding: '8px 12px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {['[My Shift Tomorrow]', '[Check Leave Balance]', '[Apply Comp-Off]'].map((qa, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickAction(qa)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0369a1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                {qa}
              </button>
            ))}
          </div>

          {/* Messages Thread */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#f8fafc'
          }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  gap: '4px'
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.sender === 'user' ? '#0284c7' : '#ffffff',
                  color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                  fontSize: '12.5px',
                  lineHeight: '1.45',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0'
                }}>
                  {/* Text body with simple markdown support */}
                  <div style={{ whiteSpace: 'pre-line' }}>
                    {msg.text.split('**').map((part, idx) =>
                      idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                    )}
                  </div>

                  {/* Interactive Pre-Filled Leave Slip */}
                  {msg.interactiveSlip && (
                    <div style={{
                      marginTop: '10px',
                      padding: '12px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      color: '#166534'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          📄 {msg.interactiveSlip.type === 'leave_slip_confirmed' ? 'Request Confirmed' : 'Pre-Filled Leave Slip (Draft)'}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: msg.interactiveSlip.type === 'leave_slip_confirmed' ? '#dcfce7' : '#fef3c7',
                          color: msg.interactiveSlip.type === 'leave_slip_confirmed' ? '#15803d' : '#b45309'
                        }}>
                          {msg.interactiveSlip.type === 'leave_slip_confirmed' ? 'SUBMITTED' : 'DRAFT'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', lineHeight: '1.5', color: '#1e293b' }}>
                        <div><strong>Employee:</strong> {msg.interactiveSlip.staff_name}</div>
                        <div><strong>Leave Type:</strong> {msg.interactiveSlip.leave_type}</div>
                        <div><strong>Requested Date:</strong> {msg.interactiveSlip.date_display}</div>
                        {msg.interactiveSlip.days_count !== undefined && msg.interactiveSlip.days_count > 1 && (
                          <div><strong>Duration:</strong> {msg.interactiveSlip.days_count} Days</div>
                        )}
                        {msg.interactiveSlip.balance_available !== undefined && (
                          <div><strong>{msg.interactiveSlip.leave_type || 'Leave'} Balance:</strong> {msg.interactiveSlip.balance_available} Days</div>
                        )}
                      </div>

                      {msg.interactiveSlip.can_apply && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleApplySlip(msg.interactiveSlip)}
                            disabled={isLoading}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              background: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)'
                            }}
                          >
                            <span>✓ Confirm & Submit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage('Cancel')}
                            style={{
                              padding: '6px 10px',
                              background: '#ffffff',
                              color: '#64748b',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '11.5px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-action chips below bot message */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                    {msg.quickActions.map((qa, qi) => (
                      <button
                        key={qi}
                        type="button"
                        onClick={() => handleQuickAction(qa)}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#0284c7',
                          cursor: 'pointer'
                        }}
                      >
                        {qa}
                      </button>
                    ))}
                  </div>
                )}

                <span style={{ fontSize: '9.5px', color: '#94a3b8', padding: '0 4px' }}>
                  {msg.time}
                </span>
              </div>
            ))}

            {isLoading && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#0369a1',
                background: '#f0f9ff',
                padding: '6px 12px',
                borderRadius: '16px',
                border: '1px solid #bae6fd',
                fontSize: '11.5px',
                fontWeight: 500,
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.08)',
                width: 'fit-content'
              }}>
                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0284c7' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0284c7' }} />
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0284c7' }} />
                </span>
                <span>✨ Checking your schedule & leave records...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Ask about shift timing, comp-off, leave balance..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              style={{
                padding: '0 14px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                opacity: isLoading || !inputText.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
