import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import Bandeirinhas from '../components/Bandeirinhas';
import LoadingSpinner from '../components/LoadingSpinner';

const CLAIM_BASE = 'https://carteira.festasjuninasdorio.com/coletar';
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

function QrModal({ campaign, onClose }) {
  const url = `${CLAIM_BASE}/${campaign.nfc_token}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.6)',backdropFilter:'blur(4px)'}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="card-junina p-6 w-full max-w-xs animate-pop text-center">
        <h3 className="font-display text-lg font-bold mb-1" style={{color:'#4B1E6D'}}>{campaign.name}</h3>
        <p className="text-xs mb-4" style={{color:'#C79A3B'}}>+{campaign.points} 🪙 por coleta</p>
        <img src={qrSrc} alt="QR Code" className="w-56 h-56 mx-auto rounded-xl mb-4" style={{border:'2px solid rgba(199,154,59,0.3)'}}/>
        <div className="rounded-xl p-2 mb-4 text-xs font-mono break-all" style={{background:'rgba(58,31,20,0.04)',color:'rgba(58,31,20,0.5)'}}>
          {url}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copiado!'); }}
            className="btn-secondary flex-1 text-sm py-2.5">📋 Copiar link</button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm py-2.5">Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campModal, setCampModal] = useState(false);
  const [sysModal, setSysModal] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [campForm, setCampForm] = useState({ name:'', description:'', points:'1', budget:'', system_budget_id:'', action_key:'', allow_multiple:false });
  const [sysForm, setSysForm] = useState({ name:'', total_budget:'' });

  const isMaster = ['admin','master'].includes(user?.role);

  const fetchStats = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try { const { data } = await api.get('/admin/stats'); setStats(data); }
    catch { if (!silent) toast.error('Erro ao carregar'); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(() => fetchStats(true), 10000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const handleCreateCamp = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/admin/campaigns', {
        name: campForm.name, description: campForm.description,
        points: parseInt(campForm.points),
        budget: campForm.budget ? parseInt(campForm.budget) : null,
        system_budget_id: campForm.system_budget_id ? parseInt(campForm.system_budget_id) : null,
        action_key: campForm.action_key?.trim() || null,
        allow_multiple: campForm.allow_multiple,
      });
      toast.success('Campanha criada!');
      setCampModal(false); setCampForm({ name:'', description:'', points:'1', budget:'', system_budget_id:'', action_key:'', allow_multiple:false });
      fetchStats(true);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
    finally { setSaving(false); }
  };

  const handleCreateSys = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/admin/systems', { name: sysForm.name, total_budget: parseInt(sysForm.total_budget) });
      toast.success('Sistema criado!');
      setSysModal(false); setSysForm({ name:'', total_budget:'' });
      fetchStats(true);
    } catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c) => { await api.patch(`/admin/campaigns/${c.id}`, { active: !c.active }); fetchStats(true); };
  const deleteCamp = async (c) => { if (!confirm(`Excluir "${c.name}"?`)) return; await api.delete(`/admin/campaigns/${c.id}`); toast.success('Excluído'); fetchStats(true); };
  const deleteSys = async (s) => { if (!confirm(`Excluir sistema "${s.name}"?`)) return; try { await api.delete(`/admin/systems/${s.id}`); toast.success('Sistema excluído'); fetchStats(true); } catch (err) { toast.error(err.response?.data?.error || 'Erro'); } };

  if (loading) return <div className="min-h-screen bg-junina flex items-center justify-center"><LoadingSpinner size="lg" text="Carregando..."/></div>;

  const systems = stats?.systems || [];

  return (
    <div className="min-h-screen bg-junina flex flex-col">
      <Bandeirinhas />
      <header className="px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold" style={{color:'#4B1E6D'}}>Admin · Carteira</h1>
            <p className="text-xs" style={{color:'#C79A3B'}}>@{user?.instagram || user?.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCampModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold text-white" style={{background:'linear-gradient(135deg,#C79A3B,#D96C2F)'}}>+ Campanha</button>
            {isMaster && <button onClick={() => setSysModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{background:'rgba(75,30,109,0.1)',color:'#4B1E6D'}}>+ Sistema</button>}
            <button onClick={logout} className="text-xs font-medium px-2 py-1.5 rounded-lg" style={{color:'#6F2DA8'}}>Sair</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {emoji:'👥', label:'Usuários', value: stats?.totalUsers || 0},
              {emoji:'🪙', label:'Emitidas', value: stats?.totalEmitted || 0},
              {emoji:'📡', label:'Claims', value: stats?.totalClaims || 0},
            ].map(s => (
              <div key={s.label} className="card-junina p-4 text-center">
                <span className="text-2xl block mb-1">{s.emoji}</span>
                <p className="text-2xl font-black" style={{color:'#4B1E6D'}}>{s.value}</p>
                <p className="text-xs" style={{color:'#C79A3B'}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Sistemas de orçamento */}
          {systems.length > 0 && (
            <div className="card-junina p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold" style={{color:'#4B1E6D'}}>Banco Central</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:'rgba(75,30,109,0.1)',color:'#4B1E6D'}}>
                  Total: {systems.reduce((a,s) => a + s.total_budget, 0)} 🪙
                </span>
              </div>
              <div className="space-y-3">
                {systems.map(s => {
                  const pct = s.total_budget > 0 ? Math.round((s.used_budget / s.total_budget) * 100) : 0;
                  return (
                    <div key={s.id} className="rounded-xl p-3" style={{background:'rgba(199,154,59,0.06)',border:'1px solid rgba(199,154,59,0.15)'}}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-sm" style={{color:'#3A1F14'}}>{s.name}</p>
                          <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>
                            {s.used_budget}/{s.total_budget} 🪙 usados · {s.available_budget} disponíveis · {s.campaign_count} campanhas
                          </p>
                        </div>
                        {isMaster && (
                          <button onClick={() => deleteSys(s)} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(194,24,116,0.08)',color:'#C21874'}}>🗑</button>
                        )}
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(58,31,20,0.08)'}}>
                        <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:pct>90?'#C21874':pct>70?'#D96C2F':'linear-gradient(90deg,#C79A3B,#D96C2F)'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campanhas */}
          <div className="card-junina p-4">
            <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>Campanhas ({stats?.campaigns?.length || 0})</h2>
            {!stats?.campaigns?.length ? (
              <div className="text-center py-8"><span className="text-4xl block mb-2">📡</span><p style={{color:'rgba(58,31,20,0.4)'}}>Nenhuma campanha</p></div>
            ) : (
              <div className="space-y-3">
                {stats.campaigns.map(c => (
                  <div key={c.id} className="rounded-xl p-4" style={{background: c.active?'rgba(0,124,145,0.06)':'rgba(58,31,20,0.04)', border:`1.5px solid ${c.active?'rgba(0,124,145,0.2)':'rgba(58,31,20,0.1)'}`}}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:c.active?'rgba(0,124,145,0.15)':'rgba(58,31,20,0.08)',color:c.active?'#007C91':'rgba(58,31,20,0.4)'}}>
                            {c.active?'🟢 Ativa':'⚫ Inativa'}
                          </span>
                          <span className="font-black text-sm" style={{color:'#C79A3B'}}>+{c.points} 🪙</span>
                          {c.system_name && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:'rgba(75,30,109,0.08)',color:'#4B1E6D'}}>{c.system_name}</span>}
                        </div>
                        <p className="font-bold text-sm truncate" style={{color:'#3A1F14'}}>{c.name}</p>
                        {c.description && <p className="text-xs truncate" style={{color:'rgba(58,31,20,0.5)'}}>{c.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setQrModal(c)} className="text-xs px-2 py-1 rounded-lg font-bold" style={{background:'rgba(199,154,59,0.15)',color:'#C79A3B'}}>QR</button>
                        <button onClick={() => toggleActive(c)} className="text-xs px-2 py-1 rounded-lg" style={{background:c.active?'rgba(58,31,20,0.06)':'rgba(0,124,145,0.1)',color:c.active?'rgba(58,31,20,0.4)':'#007C91'}}>
                          {c.active?'Pausar':'Ativar'}
                        </button>
                        <button onClick={() => deleteCamp(c)} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(194,24,116,0.08)',color:'#C21874'}}>🗑</button>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs" style={{color:'rgba(58,31,20,0.4)'}}>
                      <span>📡 {c.spent} coletados</span>
                      {c.budget && <span>💰 {c.budget} total · {c.remaining ?? '?'} restam</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top usuários */}
          {stats?.topUsers?.length > 0 && (
            <div className="card-junina p-4">
              <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>Top Carteiras 🏆</h2>
              <div className="space-y-1.5">
                {stats.topUsers.map((u, i) => (
                  <div key={u.user_id} className="flex items-center justify-between py-1.5 px-3 rounded-xl" style={{background:'rgba(199,154,59,0.06)'}}>
                    <span className="text-sm" style={{color:'#3A1F14'}}>#{i+1} · user #{u.user_id}</span>
                    <span className="font-black text-sm" style={{color:'#C79A3B'}}>{u.balance} 🪙</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Últimas coletas */}
          {stats?.recentClaims?.length > 0 && (
            <div className="card-junina p-4">
              <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>Últimas coletas</h2>
              <div className="space-y-1.5">
                {stats.recentClaims.map(cl => (
                  <div key={cl.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl" style={{background:'rgba(58,31,20,0.03)'}}>
                    <div>
                      <p className="text-xs font-semibold" style={{color:'#3A1F14'}}>Usuário #{cl.user_id} · {cl.campaign_name}</p>
                      <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>{fmtDate(cl.created_at)}</p>
                    </div>
                    <span className="font-bold text-xs" style={{color:'#C79A3B'}}>+{cl.points} 🪙</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal QR */}
      {qrModal && <QrModal campaign={qrModal} onClose={() => setQrModal(null)}/>}

      {/* Modal criar campanha */}
      {campModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.5)',backdropFilter:'blur(4px)'}}
          onClick={e => e.target===e.currentTarget && setCampModal(false)}>
          <div className="card-junina p-6 w-full max-w-sm animate-pop">
            <h3 className="font-display text-lg font-bold mb-4" style={{color:'#4B1E6D'}}>Nova Campanha</h3>
            <form onSubmit={handleCreateCamp} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome</label>
                <input className="input-junina" placeholder="Ex: Barraca do Milho" value={campForm.name} onChange={e=>setCampForm(f=>({...f,name:e.target.value}))} required autoFocus/>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Descrição (opcional)</label>
                <input className="input-junina" placeholder="Ex: Visite a barraca" value={campForm.description} onChange={e=>setCampForm(f=>({...f,description:e.target.value}))}/>
              </div>
              {systems.length > 0 && (
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Sistema</label>
                  <select className="input-junina" value={campForm.system_budget_id} onChange={e=>setCampForm(f=>({...f,system_budget_id:e.target.value}))}>
                    <option value="">Sem sistema (livre)</option>
                    {systems.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.available_budget} disponíveis)</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Pontos/claim</label>
                  <input type="number" min="1" className="input-junina" value={campForm.points} onChange={e=>setCampForm(f=>({...f,points:e.target.value}))} required/>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Total (opcional)</label>
                  <input type="number" min="1" className="input-junina" placeholder="ilimitado" value={campForm.budget} onChange={e=>setCampForm(f=>({...f,budget:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#6F2DA8'}}>⚡ Action Key (sistemas)</label>
                <input className="input-junina font-mono text-sm" placeholder="Ex: certidao, missao, match, mensagem..." value={campForm.action_key} onChange={e=>setCampForm(f=>({...f,action_key:e.target.value}))}/>
                <p className="text-xs mt-1" style={{color:'rgba(58,31,20,0.4)'}}>Chave usada pelos sistemas para emitir moedas automaticamente</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={campForm.allow_multiple} onChange={e=>setCampForm(f=>({...f,allow_multiple:e.target.checked}))} className="accent-purple-600"/>
                <span className="text-sm font-semibold" style={{color:'#4B1E6D'}}>Permitir múltiplas coletas por usuário</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setCampModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal criar sistema */}
      {sysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.5)',backdropFilter:'blur(4px)'}}
          onClick={e => e.target===e.currentTarget && setSysModal(false)}>
          <div className="card-junina p-6 w-full max-w-sm animate-pop">
            <h3 className="font-display text-lg font-bold mb-4" style={{color:'#4B1E6D'}}>Novo Sistema</h3>
            <p className="text-xs mb-4" style={{color:'rgba(58,31,20,0.5)'}}>Define um orçamento de moedas para um sistema do evento</p>
            <form onSubmit={handleCreateSys} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome do sistema</label>
                <input className="input-junina" placeholder="Ex: Bingo, Barracas, Slot Machine" value={sysForm.name} onChange={e=>setSysForm(f=>({...f,name:e.target.value}))} required autoFocus/>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Orçamento total</label>
                <input type="number" min="1" className="input-junina" placeholder="Ex: 1000" value={sysForm.total_budget} onChange={e=>setSysForm(f=>({...f,total_budget:e.target.value}))} required/>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setSysModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Criar Sistema'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Bandeirinhas />
    </div>
  );
}
