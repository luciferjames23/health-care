import React, { useState, useEffect, useRef } from 'react';
import { ragApi } from '../services/ragApi';

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', lang: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi-IN', lang: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta-IN', lang: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', lang: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn-IN', lang: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml-IN', lang: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'es-ES', lang: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', lang: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', lang: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'ur-PK', lang: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰' }
];

export const MULTILINGUAL_PROMPTS = {
  hi: {
    patient360: [
      'मरीज अभी तक क्यों भर्ती है?',
      'असामान्य महत्वपूर्ण संकेत दिखाएं',
      'मरीज को कौन सी दवाइयां दी जा रही हैं?',
      'डिस्चार्ज से पहले क्या बाकी है?',
      'मरीज की वर्तमान स्थिति का सारांश दें'
    ],
    doctor_workspace: [
      'लंबित एक्स-रे वाले मेरे मरीज दिखाएं',
      'असामान्य लैब परिणाम वाले मरीज कौन से हैं?',
      'कौन से मरीज डिस्चार्ज से रोके गए हैं?',
      'आज के लंबित नैदानिक कार्यों का सारांश दें'
    ],
    radiology: [
      'इस एक्स-रे के लिए रेडियोलॉजिस्ट का क्या निष्कर्ष था?',
      'यह एक्स-रे उच्च प्राथमिकता क्यों है?',
      'नैदानिक संकेत और अंतिम रिपोर्ट दिखाएं',
      'क्या यह अध्ययन समीक्षाधीन है या सत्यापित?'
    ],
    discharge: [
      'सत्यापित रिकॉर्ड से डिस्चार्ज सारांश का प्रारूप बनाएं',
      'कौन से डिस्चार्ज आइटम अभी बाकी हैं?',
      'उपचार की समयरेखा का सारांश दें',
      'डिस्चार्ज मंजूरी क्यों अवरुद्ध है?'
    ]
  },
  ta: {
    patient360: [
      'நோயாளி இன்னும் ஏன் அனுமதிக்கப்பட்டுள்ளார்?',
      'சமீபத்திய அசாதாரண முக்கிய அறிகுறிகள் என்ன?',
      'நோயாளிக்கு என்ன மருந்துகள் வழங்கப்படுகின்றன?',
      'டிஸ்சார்ஜ் செய்வதற்கு முன் என்ன நிலுவையில் உள்ளது?',
      'நோயாளியின் தற்போதைய நிலையைச் சுருக்கமாகக் கூறுக'
    ],
    doctor_workspace: [
      'எக்ஸ்ரே நிலுவையில் உள்ள நோயாளிகளைக் காட்டு',
      'அசாதாரண ஆய்வக முடிவுகளைக் கொண்ட நோயாளிகள் யார்?',
      'டிஸ்சார்ஜ் செய்ய தடையுள்ள நோயாளிகள் யார்?',
      'இன்றைய நிலுவையில் உள்ள மருத்துவ பணிகளைச் சுருக்கவும்'
    ],
    radiology: [
      'இந்த எக்ஸ்ரேக்கு ரேடியாலஜிஸ்ட் என்ன முடிவு கூறினார்?',
      'இந்த எக்ஸ்ரே ஏன் அதிக முன்னுரிமை?',
      'மருத்துவ அறிகுறி மற்றும் இறுதி அறிக்கையைக் காட்டு',
      'இந்த ஆய்வு பரிசீலனையில் உள்ளதா அல்லது சரிபார்க்கப்பட்டதா?'
    ],
    discharge: [
      'சரிபார்க்கப்பட்ட பதிவுகளிலிருந்து டிஸ்சார்ஜ் சுருக்கத்தை உருவாக்கவும்',
      'எந்த டிஸ்சார்ஜ் விவரங்கள் இன்னும் நிலுவையில் உள்ளன?',
      'சிகிச்சை காலவரிசையை சுருக்கவும்',
      'டிஸ்சார்ஜ் அனுமதி ஏன் தடுக்கப்பட்டுள்ளது?'
    ]
  },
  te: {
    patient360: [
      'రోగి ఇంకా ఎందుకు అడ్మిట్ అయి ఉన్నారు?',
      'తాజా అసాధారణ ప్రాణాధార సంకేతాలు ఏమిటి?',
      'రోగి ఏ మందులు తీసుకుంటున్నారు?',
      'డిశ్చార్జ్ చేయడానికి ముందు ఏమి పెండింగ్‌లో ఉంది?',
      'రోగి ప్రస్తుత పరిస్థితిని క్లుప్తంగా చెప్పండి'
    ],
    doctor_workspace: [
      'ఎక్స్-రే పెండింగ్‌లో ఉన్న నా రోగులను చూపించండి',
      'అసాధారణ ల్యాబ్ ఫలితాలు ఉన్న రోగులు ఎవరు?',
      'డిశ్చార్జ్ ఆగిపోయిన రోగులు ఎవరు?',
      'నేటి పెండింగ్ క్లినికల్ పనులను సంగ్రహించండి'
    ]
  },
  es: {
    patient360: [
      '¿Por qué este paciente sigue ingresado?',
      '¿Cuáles son los últimos signos vitales anormales?',
      '¿Qué medicamentos está recibiendo el paciente?',
      '¿Qué está pendiente antes del alta médica?',
      'Resuma el estado actual de este paciente'
    ],
    doctor_workspace: [
      'Mostrar mis pacientes con radiografías pendientes',
      '¿Cuáles pacientes tienen resultados de laboratorio anormales?',
      '¿Qué pacientes están bloqueados para el alta?',
      'Resuma las tareas clínicas pendientes de hoy'
    ]
  }
};

export default function RagAssistantPanel({
  area = 'patient360',
  title = 'Ask Clinical Record',
  subtitle = 'Context-grounded Hybrid RAG Assistant',
  patientId = null,
  admissionId = null,
  orderId = null,
  accessionNumber = null,
  patientName = null,
  studyLabel = null,
  initialPrompts = [],
  embedded = true
}) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [activeSourceId, setActiveSourceId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Multilingual & Speech State
  const [selectedLang, setSelectedLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Reset conversation when active patient or study changes
  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  }, [patientId, orderId]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Initialize Speech-to-Text (STT) Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLang.code;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const combined = finalTranscript || interimTranscript;
        if (combined) {
          setInputQuery(combined);
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in your browser address bar.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Could not initialize SpeechRecognition:', err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [selectedLang]);

  // Toggle Speech-to-Text Voice Recording
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
    } else {
      setSpeechError(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.lang = selectedLang.code;
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Error starting recognition:', e);
          setIsListening(false);
        }
      }
    }
  };

  // Convert markdown and clinical codes into natural spoken audio text
  const cleanMarkdownForSpeech = (rawText) => {
    if (!rawText) return '';
    let text = String(rawText);
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/\[Record\s*#?(\d+)\]/gi, 'Record $1');
    text = text.replace(/\[✓.*?\]/g, '');
    text = text.replace(/\[ℹ.*?\]/g, '');
    text = text.replace(/\|/g, ', ');
    text = text.replace(/[-]{3,}/g, '');
    text = text.replace(/#{1,6}\s+/g, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/\*(.*?)\*/g, '$1');
    text = text.replace(/[•\-\*]\s+/g, '. ');
    text = text.replace(/\n+/g, '. ');
    text = text.replace(/\s{2,}/g, ' ');
    return text.trim();
  };

  // Text-to-Speech (TTS) handler for reading assistant responses
  const handleSpeak = (msgId, rawContent, msgLanguage) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech audio is not supported in your browser.');
      return;
    }

    // Toggle stop if already speaking this message
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const spokenText = cleanMarkdownForSpeech(rawContent);
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const targetCode = msgLanguage ? (SUPPORTED_LANGUAGES.find(l => l.lang === msgLanguage)?.code || selectedLang.code) : selectedLang.code;
    utterance.lang = targetCode;

    // Pick best available voice for language
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = targetCode.split('-')[0].toLowerCase();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) ||
                          voices.find(v => v.lang.toLowerCase().includes(targetCode.toLowerCase()));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      setSpeakingMsgId(msgId);
    };

    utterance.onend = () => {
      setSpeakingMsgId(null);
    };

    utterance.onerror = () => {
      setSpeakingMsgId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const defaultPrompts = {
    patient360: [
      'Summarize this patient’s current condition.',
      'Why is this patient still admitted?',
      'What are the latest abnormal vital signs?',
      'What medicines is this patient receiving?',
      'What are the latest lab results?',
      'What did the latest chest X-ray show?',
      'What is pending before discharge?',
      'What is the billing clearance status for this admission?'
    ],
    doctor_workspace: [
      'How many IP, OP, and discharged patients do I have right now?',
      'List all my admitted IP patients with their bed numbers and wards.',
      'Which of my patients have pending high-priority or urgent X-rays?',
      'Which patients under my care have abnormal or critical lab values today?',
      'Which of my patients are currently blocked from discharge and why?',
      'Summarize all pending clinical orders and doctor tasks for today’s ward rounds.'
    ],
    radiology: [
      'What did the radiologist conclude for this X-ray?',
      'Why is this X-ray high priority?',
      'Show the clinical indication and final report.',
      'Is this study pending review or confirmed?'
    ],
    discharge: [
      'Draft a discharge summary from verified records.',
      'What discharge items are still pending?',
      'Summarize the treatment timeline.',
      'Why is discharge clearance blocked?'
    ]
  };

  // Select prompts according to active language and workspace area
  const localizedPromptGroup = MULTILINGUAL_PROMPTS[selectedLang.lang]?.[area];
  const prompts = initialPrompts.length > 0
    ? initialPrompts
    : (localizedPromptGroup || defaultPrompts[area] || []);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend || !textToSend.trim() || loading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    setError(null);
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await ragApi.query({
        question: userMsg.content,
        area,
        conversation_id: conversationId,
        patient_id: patientId ? Number(patientId) : undefined,
        admission_id: admissionId ? Number(admissionId) : undefined,
        order_id: orderId || undefined,
        accession_number: accessionNumber || undefined,
        limit: 8,
        language: selectedLang.lang,
        language_name: selectedLang.name
      });

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.answer,
        confidence: res.confidence,
        disclaimer: res.disclaimer,
        sources: res.sources || [],
        strategy: res.strategy,
        usedLlm: res.used_llm,
        language: res.language || selectedLang.lang,
        languageName: res.language_name || selectedLang.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('RAG query error:', err);
      let errMsg = err.message || 'Service temporarily unavailable.';
      if (err.status === 403) {
        errMsg = `Access Denied: ${err.message || 'You do not have permission to access records in this context.'}`;
      }
      setError(errMsg);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          isError: true,
          content: errMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
      marginTop: '16px',
      marginBottom: '16px'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px'
          }}>
            ✦
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.2px' }}>
              {title}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 500 }}>
              {subtitle}
            </div>
          </div>
        </div>

        {/* Active Context Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {patientName && (
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.25)',
              fontWeight: 600
            }}>
              👤 {patientName} {patientId ? `(#${patientId})` : ''}
            </span>
          )}
          {accessionNumber && (
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.25)',
              fontWeight: 600
            }}>
              🔬 Acc #{accessionNumber}
            </span>
          )}
          {/* Multilingual Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px' }}>🌐</span>
            <select
              value={selectedLang.code}
              onChange={(e) => {
                const found = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                if (found) setSelectedLang(found);
              }}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600,
                outline: 'none'
              }}
              title="Select language for texting and voice speaking"
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ color: '#0f172a', background: '#ffffff' }}>
                  {l.flag} {l.native} ({l.name})
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleReset}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'transparent',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Start new isolated conversation"
            >
              Clear Chat
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              fontSize: '13px',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: '#f8fafc'
          }}>
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                margin: 'auto',
                maxWidth: '480px',
                padding: '24px 16px'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏥</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                  Ask questions grounded in authorized clinical records
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  Uses PostgreSQL Hybrid Full-Text & Semantic Vector Search with strict patient isolation.
                </div>

                {/* Initial Prompt Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {prompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(p)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '11.5px',
                        color: '#0369a1',
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#38bdf8';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: msg.role === 'user' ? '75%' : '88%'
                  }}
                >
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#0284c7' : msg.isError ? '#fef2f2' : '#ffffff',
                    color: msg.role === 'user' ? '#ffffff' : msg.isError ? '#b91c1c' : '#1e293b',
                    border: msg.role === 'user' ? 'none' : msg.isError ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    {/* Assistant Message Header with Voice Readout */}
                    {msg.role === 'assistant' && !msg.isError && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        paddingBottom: '5px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '11px', color: '#0284c7' }}>✦</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Clinical RAG Assistant
                          </span>
                          {msg.languageName && (
                            <span style={{
                              fontSize: '9.5px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: 600
                            }}>
                              {msg.languageName}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSpeak(msg.id, msg.content, msg.language)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: speakingMsgId === msg.id ? '#fee2e2' : '#f0f9ff',
                            border: speakingMsgId === msg.id ? '1px solid #fca5a5' : '1px solid #bae6fd',
                            color: speakingMsgId === msg.id ? '#dc2626' : '#0369a1',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10.5px',
                            fontWeight: 650,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={speakingMsgId === msg.id ? "Stop voice reading" : `Read aloud (${selectedLang.native})`}
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <span style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#dc2626',
                                animation: 'audioPulse 0.8s infinite'
                              }} />
                              <span>⏹ Stop</span>
                            </>
                          ) : (
                            <>
                              <span>🔊</span>
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Render content formatted */}
                    <ClinicalMessageRenderer content={msg.content} role={msg.role} />

                    {/* Disclaimer Banner for Assistant Messages */}
                    {msg.disclaimer && (
                      <div style={{
                        marginTop: '10px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        borderLeft: '3px solid #0284c7',
                        fontSize: '11px',
                        color: '#475569',
                        fontWeight: 500
                      }}>
                        ℹ {msg.disclaimer}
                      </div>
                    )}

                    {/* Sources Accordion */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>Supporting Source Records ({msg.sources.length})</span>
                          <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: 600 }}>
                            Confidence: {Math.round((msg.confidence || 0.8) * 100)}%
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {msg.sources.map((s, sIdx) => {
                            const isOpen = activeSourceId === `${msg.id}_${s.id}`;
                            const isVerified = s.is_verified;
                            const isAi = s.document_type === 'radiology_ai_result';

                            return (
                              <div
                                key={sIdx}
                                style={{
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                  overflow: 'hidden',
                                  fontSize: '11.5px'
                                }}
                              >
                                <div
                                  onClick={() => setActiveSourceId(isOpen ? null : `${msg.id}_${s.id}`)}
                                  style={{
                                    padding: '6px 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    background: isOpen ? '#f1f5f9' : '#f8fafc'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                      fontSize: '9.5px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: isVerified ? '#dcfce7' : isAi ? '#fef3c7' : '#e0f2fe',
                                      color: isVerified ? '#15803d' : isAi ? '#b45309' : '#0369a1',
                                      fontWeight: 700
                                    }}>
                                      {isVerified ? '✓ Verified' : isAi ? 'AI Screening' : s.document_type.replace(/_/g, ' ')}
                                    </span>
                                    <span style={{ fontWeight: 600, color: '#334155' }}>
                                      {s.title}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                      Match: {Math.round((s.relevance_score || 0.8) * 100)}%
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                                      {isOpen ? '▲' : '▼'}
                                    </span>
                                  </div>
                                </div>

                                {isOpen && (
                                  <div style={{
                                    padding: '8px 10px',
                                    background: '#ffffff',
                                    borderTop: '1px solid #e2e8f0',
                                    color: '#475569',
                                    fontSize: '11px',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '140px',
                                    overflowY: 'auto'
                                  }}>
                                    {s.content}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    marginTop: '2px',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    {msg.timestamp}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                width: 'fit-content',
                fontSize: '12px',
                color: '#64748b'
              }}>
                <span className="rag-spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid #cbd5e1',
                  borderTopColor: '#0284c7',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>Retrieving authorized clinical records & synthesizing answer...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Prompt Suggestions Bar (if messages exist) */}
          {messages.length > 0 && prompts.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '6px 12px',
              background: '#f1f5f9',
              borderTop: '1px solid #e2e8f0',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              {prompts.slice(0, 3).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '11px',
                    color: '#0369a1',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0'
          }}>
            <input
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isListening
                ? `🎙️ Listening in ${selectedLang.native}... Speak now`
                : `Ask in ${selectedLang.native} about ${patientName ? patientName : 'this record'}... (e.g. vitals, pending orders, diagnosis)`}
              disabled={loading}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '8px',
                border: isListening ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                background: isListening ? '#fef2f2' : '#ffffff',
                fontSize: '12.5px',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              onFocus={e => { if (!isListening) e.target.style.borderColor = '#0284c7'; }}
              onBlur={e => { if (!isListening) e.target.style.borderColor = '#cbd5e1'; }}
            />

            {/* Microphone (Speech-to-Text) Button */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: isListening ? '2px solid #ef4444' : '1px solid #cbd5e1',
                background: isListening ? '#ef4444' : '#f8fafc',
                color: isListening ? '#ffffff' : '#0369a1',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
                position: 'relative',
                animation: isListening ? 'micPulse 1.2s infinite' : 'none',
                flexShrink: 0
              }}
              title={isListening ? `Listening in ${selectedLang.name}... Click to stop` : `Click to speak in ${selectedLang.native} (${selectedLang.name})`}
            >
              {isListening ? '🛑' : '🎙️'}
            </button>

            {/* Ask Button */}
            <button
              onClick={() => handleSend()}
              disabled={!inputQuery.trim() || loading}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: !inputQuery.trim() || loading ? '#94a3b8' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                cursor: !inputQuery.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.15s',
                flexShrink: 0
              }}
            >
              <span>Ask</span>
              <span>→</span>
            </button>
          </div>

          {/* Speech Recognition Error / Notice Banner */}
          {speechError && (
            <div style={{
              padding: '6px 14px',
              background: '#fff1f2',
              color: '#be123c',
              fontSize: '11px',
              borderTop: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>⚠️ {speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                style={{ background: 'none', border: 'none', color: '#be123c', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Global CSS spinner and voice audio keyframes */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes micPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes audioPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ClinicalMessageRenderer({ content, role }) {
  if (role === 'user' || !content) {
    return <div>{content}</div>;
  }

  // Pre-process lines: merge orphan bullets/emojis with next line
  const rawLines = String(content).split('\n');
  const mergedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if ((trimmed === '•' || trimmed === '-' || trimmed === '*' || trimmed === '📋') && i + 1 < rawLines.length) {
      const nextTrimmed = rawLines[i + 1].trim();
      if (nextTrimmed) {
        mergedLines.push(`${trimmed} ${nextTrimmed}`);
        i++;
        continue;
      }
    }
    mergedLines.push(rawLines[i]);
  }

  const elements = [];
  let i = 0;

  while (i < mergedLines.length) {
    const line = mergedLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`blank-${i}`} style={{ height: '4px' }} />);
      i++;
      continue;
    }

    // ── 1. MARKDOWN TABLE PARSING ─────────────────────────────────────────────
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const tableLines = [];
      while (i < mergedLines.length && mergedLines[i].trim().startsWith('|')) {
        tableLines.push(mergedLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse rows
        const parsedRows = [];
        tableLines.forEach((tLine) => {
          const raw = tLine.startsWith('|') ? tLine.slice(1) : tLine;
          const rawEnd = raw.endsWith('|') ? raw.slice(0, -1) : raw;
          // Check if it's separator line (e.g. |---|---|)
          if (rawEnd.replace(/[\-:\s\|]/g, '') === '') {
            return;
          }
          const cells = rawEnd.split('|').map(c => c.trim());
          if (cells.length > 0) {
            parsedRows.push(cells);
          }
        });

        if (parsedRows.length > 0) {
          const headerRow = parsedRows[0];
          const dataRows = parsedRows.slice(1);

          elements.push(
            <div key={`table-${i}`} style={{
              margin: '10px 0',
              overflowX: 'auto',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              background: '#fff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                    {headerRow.map((h, hIdx) => (
                      <th key={hIdx} style={{
                        padding: '8px 10px',
                        color: '#334155',
                        fontWeight: 700,
                        fontSize: '11px',
                        letterSpacing: '0.2px',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatInlineText(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{
                      borderBottom: rIdx === dataRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                      background: rIdx % 2 === 0 ? '#fff' : '#f8fafc'
                    }}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{
                          padding: '7px 10px',
                          color: '#1e293b',
                          fontSize: '11.5px',
                          verticalAlign: 'top',
                          lineHeight: 1.45
                        }}>
                          {renderTableCellBadge(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }
    }

    // ── 2. DIVIDER LINES (– or --- or —) ──────────────────────────────────────
    if (/^[–—\-]{1,3}$/.test(trimmed)) {
      elements.push(
        <div key={`div-${i}`} style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />
      );
      i++;
      continue;
    }

    // ── 3. MAJOR SECTION HEADERS (### Title or 📋 1. ... or **1. ...**) ───────
    if (trimmed.startsWith('### ') || trimmed.startsWith('📋') || /^\*\*\d+\..*\*\*$/.test(trimmed) || /^\d+\.\s+[A-Z]/.test(trimmed)) {
      const cleanTitle = trimmed.replace(/^###\s*/, '').replace(/^📋\s*/, '').replace(/^\*\*|\*\*$/g, '');
      elements.push(
        <div key={`sec-${i}`} style={{
          fontSize: '13.5px',
          fontWeight: 750,
          color: '#0f172a',
          margin: '10px 0 6px 0',
          borderBottom: '1.5px solid #e2e8f0',
          paddingBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          letterSpacing: '-0.1px'
        }}>
          <span style={{ fontSize: '13px' }}>📋</span> {formatInlineText(cleanTitle)}
        </div>
      );
      i++;
      continue;
    }

    // ── 4. SUB-HEADERS (#### Title) ──────────────────────────────────────────
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <div key={`sub-${i}`} style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#0369a1',
          margin: '8px 0 4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#f0f9ff',
          padding: '4px 8px',
          borderRadius: '5px',
          borderLeft: '3px solid #0284c7'
        }}>
          {trimmed.replace(/^####\s*/, '')}
        </div>
      );
      i++;
      continue;
    }

    // ── 5. ACTION ITEMS HEADER ────────────────────────────────────────────────
    if (/^Action Items:?$/i.test(trimmed)) {
      elements.push(
        <div key={`act-${i}`} style={{
          fontSize: '12px',
          fontWeight: 750,
          color: '#0f766e',
          margin: '8px 0 4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <span>⚡</span> Action Items
        </div>
      );
      i++;
      continue;
    }

    // ── 6. IMPORTANT NOTES / RADIOLOGY RULE CALLOUTS ─────────────────────────
    if (trimmed.startsWith('Important Note') || trimmed.startsWith('Note:') || trimmed.startsWith('>')) {
      const cleanCallout = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div key={`alert-${i}`} style={{
          margin: '8px 0',
          padding: '8px 12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '6px',
          fontSize: '11.5px',
          color: '#92400e',
          lineHeight: 1.5,
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>{formatInlineText(cleanCallout)}</div>
        </div>
      );
      i++;
      continue;
    }

    // ── 7. CHECKLIST ITEMS ([ ] ... or [x] ... or • [ ] ...) ─────────────────
    if (/^[•\-\*]?\s*\[\s*\]/.test(trimmed)) {
      const taskText = trimmed.replace(/^[•\-\*]?\s*\[\s*\]\s*/, '');
      elements.push(
        <div key={`chk-${i}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          margin: '3px 0 3px 6px',
          fontSize: '12px',
          color: '#1e293b',
          lineHeight: 1.5
        }}>
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            border: '1.5px solid #94a3b8',
            background: '#f8fafc',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px'
          }} />
          <div style={{ flex: 1 }}>{formatInlineText(taskText)}</div>
        </div>
      );
      i++;
      continue;
    }

    if (/^[•\-\*]?\s*\[[xX✓]\]/.test(trimmed)) {
      const taskText = trimmed.replace(/^[•\-\*]?\s*\[[xX✓]\]\s*/, '');
      elements.push(
        <div key={`chk-${i}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          margin: '3px 0 3px 6px',
          fontSize: '12px',
          color: '#15803d',
          lineHeight: 1.5
        }}>
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: '#16a34a',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9.5px',
            fontWeight: 800,
            flexShrink: 0,
            marginTop: '2px'
          }}>✓</span>
          <div style={{ flex: 1, textDecoration: 'line-through', color: '#64748b' }}>{formatInlineText(taskText)}</div>
        </div>
      );
      i++;
      continue;
    }

    // ── 8. BULLET ITEMS (• or - or * ) ───────────────────────────────────────
    if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const cleanLine = trimmed.replace(/^[•\-\*]\s*/, '');
      elements.push(
        <div key={`bullet-${i}`} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          margin: '3px 0 3px 4px',
          fontSize: '12px',
          lineHeight: 1.55
        }}>
          <span style={{ color: '#0284c7', fontSize: '13px', lineHeight: '1.3' }}>•</span>
          <div style={{ flex: 1 }}>
            {formatInlineText(cleanLine)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // ── 9. NUMBERED LIST ITEMS ────────────────────────────────────────────────
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <div key={`num-${i}`} style={{
          margin: '4px 0 2px 4px',
          fontSize: '12px',
          fontWeight: 500,
          color: '#1e293b',
          lineHeight: 1.5
        }}>
          {formatInlineText(trimmed)}
        </div>
      );
      i++;
      continue;
    }

    // ── 10. STANDARD TEXT LINE ────────────────────────────────────────────────
    elements.push(
      <div key={`text-${i}`} style={{ margin: '2px 0', fontSize: '12px', lineHeight: 1.55 }}>
        {formatInlineText(trimmed)}
      </div>
    );
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
}

function renderTableCellBadge(cell) {
  const trimmed = String(cell || '').trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'high' || lower === 'urgent') {
    return (
      <span style={{
        background: '#fef2f2',
        color: '#dc2626',
        border: '1px solid #fecaca',
        padding: '2px 7px',
        borderRadius: '4px',
        fontWeight: 750,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        letterSpacing: '0.2px'
      }}>
        ⚡ {trimmed}
      </span>
    );
  }

  if (lower === 'routine') {
    return (
      <span style={{
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0',
        padding: '2px 7px',
        borderRadius: '4px',
        fontWeight: 600,
        fontSize: '10.5px'
      }}>
        {trimmed}
      </span>
    );
  }

  if (lower.includes('pending review') || lower.includes('pending payment')) {
    return (
      <span style={{
        background: '#fffbeb',
        color: '#b45309',
        border: '1px solid #fde68a',
        padding: '2px 7px',
        borderRadius: '4px',
        fontWeight: 650,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
        ⏱ {trimmed}
      </span>
    );
  }

  if (lower.includes('reviewed') || lower.includes('verified') || lower.includes('confirmed') || lower.includes('cleared')) {
    return (
      <span style={{
        background: '#f0fdf4',
        color: '#15803d',
        border: '1px solid #bbf7d0',
        padding: '2px 7px',
        borderRadius: '4px',
        fontWeight: 650,
        fontSize: '10.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
        ✓ {trimmed}
      </span>
    );
  }

  return formatInlineText(trimmed);
}

function formatInlineText(text) {
  if (typeof text !== 'string') return text;
  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|\[Record\s*#?\d+\]|\[✓ Verified.*?\]|\[✓ Radiologist Verified\]|\[ℹ Provisional.*?\]|\[ℹ AI Screening.*?\]|\[Active Prescription\]|\[Prescribed\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} style={{ color: '#0f172a', fontWeight: 650 }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*') && !token.startsWith('**')) {
      parts.push(<em key={match.index} style={{ color: '#334155', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[Record') && token.endsWith(']')) {
      parts.push(
        <span key={match.index} style={{
          display: 'inline-block',
          padding: '1px 6px',
          margin: '0 2px',
          borderRadius: '4px',
          background: '#e0f2fe',
          color: '#0369a1',
          fontSize: '10.5px',
          fontWeight: 700,
          border: '1px solid #bae6fd'
        }}>
          {token.replace(/[\[\]]/g, '')}
        </span>
      );
    } else if (token.includes('✓ Verified') || token.includes('Radiologist Verified') || token.includes('Prescribed') || token.includes('Active Prescription')) {
      parts.push(
        <span key={match.index} style={{
          display: 'inline-block',
          padding: '1px 6px',
          margin: '0 4px',
          borderRadius: '4px',
          background: '#dcfce7',
          color: '#15803d',
          fontSize: '10.5px',
          fontWeight: 700
        }}>
          {token.replace(/[\[\]]/g, '')}
        </span>
      );
    } else if (token.includes('ℹ Provisional') || token.includes('AI Screening')) {
      parts.push(
        <span key={match.index} style={{
          display: 'inline-block',
          padding: '1px 6px',
          margin: '0 4px',
          borderRadius: '4px',
          background: '#fef3c7',
          color: '#b45309',
          fontSize: '10.5px',
          fontWeight: 700
        }}>
          {token.replace(/[\[\]]/g, '')}
        </span>
      );
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
