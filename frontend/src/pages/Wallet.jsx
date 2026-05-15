import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import Bandeirinhas from '../components/Bandeirinhas';
import LoadingSpinner from '../components/LoadingSpinner';

const CLAIM_BASE = 'https://carteira.festasjuninasdorio.com/coletar';
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

const ACTION_LABELS = {
  certidao:               { label: 'Gerar certidão no Cartório Junino', emoji: '💍' },
  mensagem:               { label: 'Enviar mensagem no Correio do Amor', emoji: '💌' },
  match:                  { label: 'Dar match no Par Ideal', emoji: '💘' },
  parideal_perfil:        { label: 'Criar perfil no Par Ideal', emoji: '💑' },
  missao:                 { label: 'Completar missão no álbum', emoji: '📸' },
  album_completo:         { label: 'Completar o álbum inteiro', emoji: '🌽' },
  bingo_participar:       { label: 'Participar de uma rodada de Bingo', emoji: '🎲' },
  bingo_vencer:           { label: 'Vencer uma rodada de Bingo', emoji: '🏆' },
  vocenasjuninas_upload:  { label: 'Enviar foto/vídeo em Você nas Juninas', emoji: '🎤' },
  vocenasjuninas_voto:    { label: 'Votar em Você nas Juninas', emoji: '⭐' },
};

export default function Wallet() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [available, setAvailable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('disponivel');

  const fetchAll = async () => {
    try {
      const [wallet, avail] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/available'),
      ]);
      setData(wallet.data);
      setAvailable(avail.data);
    } catch {
      toast.error('Erro ao carregar carteira');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [user]);

  if (loading) return <div className="min-h-screen bg-junina flex items-center justify-center"><LoadingSpinner size="lg" text="Carregando carteira..."/></div>;

  const { balance = 0, transactions = [] } = data || {};
  const sponsors = available?.sponsors || [];
  const actions  = available?.actions  || [];
  const totalAvailable = sponsors.length + actions.length;

  return (
    <div className="min-h-screen bg-junina flex flex-col">
      <Bandeirinhas />

      <header className="px-4 py-3">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold" style={{color:'#4B1E6D'}}>Carteira Junina</h1>
            <p className="text-xs" style={{color:'#C79A3B'}}>{user?.name || user?.instagram}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ranking')} className="text-xs font-medium px-2 py-1.5 rounded-lg" style={{color:'#C79A3B'}}>🏆</button>
            <button onClick={logout} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{color:'#6F2DA8'}}>Sair</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-sm mx-auto space-y-4">

          {/* Saldo */}
          <div className="card-junina p-6 text-center animate-pop" style={{border:'2px solid rgba(199,154,59,0.3)'}}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'rgba(58,31,20,0.4)'}}>Seu saldo</p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-5xl" style={{filter:'drop-shadow(0 4px 8px rgba(199,154,59,0.4))'}}>🪙</div>
              <div>
                <p className="text-6xl font-black" style={{color:'#C79A3B',lineHeight:1}}>{balance}</p>
                <p className="text-sm font-semibold" style={{color:'rgba(58,31,20,0.4)'}}>moedas juninas</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl p-1" style={{background:'rgba(199,154,59,0.12)'}}>
            {[
              { id:'disponivel', label:`🎯 Disponível${totalAvailable > 0 ? ` (${totalAvailable})` : ''}` },
              { id:'historico',  label:`📋 Histórico${transactions.length > 0 ? ` (${transactions.length})` : ''}` },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={tab===t.id ? {background:'#fff',color:'#4B1E6D',boxShadow:'0 2px 8px rgba(75,30,109,0.1)'} : {color:'#6F2DA8'}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Disponível */}
          {tab === 'disponivel' && (
            <div className="space-y-3 animate-slide-up">

              {/* Pontos NFC / Patrocinadores */}
              {sponsors.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{color:'#C79A3B'}}>
                    📡 Pontos NFC disponíveis
                  </p>
                  <div className="space-y-2">
                    {sponsors.map(s => (
                      <a key={s.id} href={`${CLAIM_BASE}/${s.nfc_token}`}
                        className="flex items-center gap-3 p-3 rounded-xl transition-all"
                        style={{background:'rgba(0,124,145,0.06)',border:'1.5px solid rgba(0,124,145,0.2)'}}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0" style={{background:'rgba(0,124,145,0.12)'}}>📡</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{color:'#3A1F14'}}>{s.name}</p>
                          {s.description && <p className="text-xs" style={{color:'rgba(58,31,20,0.5)'}}>{s.description}</p>}
                          {s.remaining !== null && <p className="text-xs mt-0.5" style={{color:'rgba(58,31,20,0.4)'}}>{s.remaining} moedas restantes</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-black text-lg" style={{color:'#007C91'}}>+{s.points}</p>
                          <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>🪙</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações dos sistemas */}
              {actions.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{color:'#C79A3B'}}>
                    ⚡ Ganhe fazendo
                  </p>
                  <div className="space-y-2">
                    {actions.map(a => {
                      const info = ACTION_LABELS[a.action_key] || { label: a.name, emoji: '⚡' };
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl"
                          style={{background:'rgba(111,45,168,0.05)',border:'1.5px solid rgba(111,45,168,0.1)'}}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0" style={{background:'rgba(111,45,168,0.08)'}}>{info.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{color:'#3A1F14'}}>{info.label}</p>
                            {a.allow_multiple && <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>Pode ganhar várias vezes</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-black text-lg" style={{color:'#6F2DA8'}}>+{a.points}</p>
                            <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>🪙</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {totalAvailable === 0 && (
                <div className="card-junina p-8 text-center">
                  <span className="text-5xl block mb-3">🌽</span>
                  <p className="font-display text-lg" style={{color:'#4B1E6D'}}>Nenhuma oportunidade disponível agora</p>
                  <p className="text-sm mt-2" style={{color:'rgba(58,31,20,0.4)'}}>Fique atento — o admin pode liberar moedas a qualquer momento!</p>
                </div>
              )}
            </div>
          )}

          {/* Tab Histórico */}
          {tab === 'historico' && (
            <div className="card-junina p-4 animate-slide-up">
              <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>Histórico</h2>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl block mb-2">🌽</span>
                  <p className="text-sm" style={{color:'rgba(58,31,20,0.4)'}}>Nenhuma transação ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{background:'rgba(199,154,59,0.06)'}}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.amount > 0 ? '🪙' : '💸'}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{color:'#3A1F14'}}>{t.description}</p>
                          <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>{fmtDate(t.created_at)}</p>
                        </div>
                      </div>
                      <span className="font-black text-sm" style={{color: t.amount > 0 ? '#C79A3B' : '#C21874'}}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Bandeirinhas />
    </div>
  );
}
