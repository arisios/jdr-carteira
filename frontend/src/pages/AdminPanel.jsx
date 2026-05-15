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
        <div className="rounded-xl p-2 mb-4 text-xs font-mono break-all" style={{background:'rgba(58,31,20,0.04)',color:'rgba(58,31,20,0.5)'}}>{url}</div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copiado!'); }} className="btn-secondary flex-1 text-sm py-2.5">📋 Copiar link</button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm py-2.5">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ campaign, systems, onSave, onClose }) {
  const [form, setForm] = useState({
    name: campaign.name,
    description: campaign.description || '',
    points: String(campaign.points),
    budget: campaign.budget != null ? String(campaign.budget) : '',
    active: campaign.active === 1,
    system_budget_id: campaign.system_budget_id ? String(campaign.system_budget_id) : '',
    allow_multiple: campaign.allow_multiple === 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/campaigns/${campaign.id}`, {
        name: form.name,
        description: form.description || null,
        points: parseInt(form.points),
        budget: form.budget ? parseInt(form.budget) : null,
        active: form.active,
        system_budget_id: form.system_budget_id ? parseInt(form.system_budget_id) : null,
        allow_multiple: form.allow_multiple,
      });
      toast.success('Campanha atualizada!');
      onSave();
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.55)',backdropFilter:'blur(4px)'}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="card-junina p-6 w-full max-w-sm animate-pop max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-bold mb-4" style={{color:'#4B1E6D'}}>
          ✏️ Editar — {campaign.action_key ? `⚡ ${campaign.action_key}` : '📡 Patrocinador'}
        </h3>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome</label>
            <input className="input-junina" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Descrição</label>
            <input className="input-junina" placeholder="(opcional)" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          </div>
          {systems.length > 0 && (
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Sistema de orçamento</label>
              <select className="input-junina" value={form.system_budget_id} onChange={e=>setForm(f=>({...f,system_budget_id:e.target.value}))}>
                <option value="">Sem sistema</option>
                {systems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.available_budget} disp.)</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Moedas/coleta</label>
              <input type="number" min="1" className="input-junina" value={form.points} onChange={e=>setForm(f=>({...f,points:e.target.value}))} required/>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Limite total (🪙)</label>
              <input type="number" min="1" className="input-junina" placeholder="ilimitado" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))}/>
            </div>
          </div>
          {form.budget && form.points && (
            <p className="text-xs text-center" style={{color:'rgba(58,31,20,0.5)'}}>
              Máximo {Math.floor(parseInt(form.budget||0)/parseInt(form.points||1))} usuários poderão coletar
            </p>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} className="accent-teal-600"/>
              <span className="text-sm font-semibold" style={{color:'#4B1E6D'}}>Ativo</span>
            </label>
            {campaign.action_key && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.allow_multiple} onChange={e=>setForm(f=>({...f,allow_multiple:e.target.checked}))} className="accent-purple-600"/>
                <span className="text-sm font-semibold" style={{color:'#4B1E6D'}}>Múltiplas coletas</span>
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
            <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SponsorCard({ c, systems, onRefresh, onQr }) {
  const [editModal, setEditModal] = useState(false);
  const esgotado = c.budget !== null && c.spent >= c.budget;
  const pct = c.budget ? Math.min(100, Math.round((c.spent / c.budget) * 100)) : 0;
  const status = esgotado ? { label:'🔴 Esgotado', color:'#C21874', bg:'rgba(194,24,116,0.1)' }
    : c.active ? { label:'🟢 Ativo', color:'#007C91', bg:'rgba(0,124,145,0.1)' }
    : { label:'⚫ Encerrado', color:'rgba(58,31,20,0.4)', bg:'rgba(58,31,20,0.06)' };

  const toggle = async () => { await api.patch(`/admin/campaigns/${c.id}`, { active: !c.active }); onRefresh(); };
  const del = async () => { if (!confirm(`Excluir "${c.name}"?`)) return; await api.delete(`/admin/campaigns/${c.id}`); toast.success('Excluído'); onRefresh(); };

  return (
    <>
      <div className="card-junina p-4" style={{border: c.active && !esgotado ? '2px solid rgba(0,124,145,0.2)' : '1px solid rgba(199,154,59,0.2)'}}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:status.bg,color:status.color}}>{status.label}</span>
              {c.system_name && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:'rgba(75,30,109,0.08)',color:'#4B1E6D'}}>{c.system_name}</span>}
            </div>
            <p className="font-bold" style={{color:'#3A1F14'}}>{c.name}</p>
            {c.description && <p className="text-xs mt-0.5" style={{color:'rgba(58,31,20,0.5)'}}>{c.description}</p>}
          </div>
          <div className="flex gap-1 shrink-0 flex-wrap justify-end">
            <button onClick={() => onQr(c)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold" style={{background:'rgba(199,154,59,0.15)',color:'#C79A3B'}}>QR</button>
            <button onClick={() => setEditModal(true)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold" style={{background:'rgba(75,30,109,0.08)',color:'#6F2DA8'}}>✏️</button>
            {!esgotado && (
              <button onClick={toggle} className="text-xs px-2.5 py-1.5 rounded-lg font-bold"
                style={{background:c.active?'rgba(194,24,116,0.08)':'rgba(0,124,145,0.1)',color:c.active?'#C21874':'#007C91'}}>
                {c.active?'Encerrar':'Reativar'}
              </button>
            )}
            <button onClick={del} className="text-xs px-2 py-1.5 rounded-lg" style={{background:'rgba(58,31,20,0.06)',color:'rgba(58,31,20,0.4)'}}>🗑</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="rounded-lg p-2" style={{background:'rgba(199,154,59,0.08)'}}>
            <p className="font-black text-sm" style={{color:'#C79A3B'}}>{c.points}</p>
            <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>moedas/coleta</p>
          </div>
          <div className="rounded-lg p-2" style={{background:'rgba(199,154,59,0.08)'}}>
            <p className="font-black text-sm" style={{color:'#4B1E6D'}}>{c.claim_count||0}</p>
            <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>usuários</p>
          </div>
          <div className="rounded-lg p-2" style={{background:'rgba(199,154,59,0.08)'}}>
            <p className="font-black text-sm" style={{color:'#3A1F14'}}>{c.spent}</p>
            <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>{c.budget?`de ${c.budget}`:'emitidas'}</p>
          </div>
        </div>
        {c.budget && (
          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{background:'rgba(58,31,20,0.08)'}}>
              <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:pct>=100?'#C21874':pct>=75?'#D96C2F':'linear-gradient(90deg,#C79A3B,#D96C2F)'}}/>
            </div>
            <p className="text-xs mt-1 text-right" style={{color:'rgba(58,31,20,0.4)'}}>{pct}% · {c.remaining??c.budget-c.spent} restam</p>
          </div>
        )}
      </div>
      {editModal && <EditModal campaign={c} systems={systems} onSave={onRefresh} onClose={() => setEditModal(false)}/>}
    </>
  );
}

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null);
  const [editAction, setEditAction] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [sysModal, setSysModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({ name:'', description:'', points:'2', budget:'', system_budget_id:'' });
  const [actionForm, setActionForm] = useState({ name:'', action_key:'', points:'1', budget:'', allow_multiple:true, system_budget_id:'' });
  const [sysForm, setSysForm] = useState({ name:'', total_budget:'' });

  const fetchStats = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try { const { data } = await api.get('/admin/stats'); setStats(data); }
    catch { if (!silent) toast.error('Erro ao carregar'); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); const t = setInterval(()=>fetchStats(true), 10000); return ()=>clearInterval(t); }, [fetchStats]);

  const createCampaign = async (body, reset, close) => {
    setSaving(true);
    try { await api.post('/admin/campaigns', body); toast.success('Criado!'); reset(); close(); fetchStats(true); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
    finally { setSaving(false); }
  };

  const deleteSys = async (s) => {
    if (!confirm(`Excluir sistema "${s.name}"?`)) return;
    try { await api.delete(`/admin/systems/${s.id}`); toast.success('Excluído'); fetchStats(true); }
    catch (err) { toast.error(err.response?.data?.error || 'Erro'); }
  };

  const updateSys = async (s, newBudget) => {
    await api.patch(`/admin/systems/${s.id}`, { total_budget: parseInt(newBudget) });
    toast.success('Orçamento atualizado!'); fetchStats(true);
  };

  if (loading) return <div className="min-h-screen bg-junina flex items-center justify-center"><LoadingSpinner size="lg" text="Carregando..."/></div>;

  const sponsors = (stats?.campaigns||[]).filter(c=>!c.action_key);
  const actions  = (stats?.campaigns||[]).filter(c=>c.action_key);
  const systems  = stats?.systems||[];

  return (
    <div className="min-h-screen bg-junina flex flex-col">
      <Bandeirinhas/>
      <header className="px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-bold" style={{color:'#4B1E6D'}}>Admin · Carteira Junina</h1>
            <p className="text-xs" style={{color:'#C79A3B'}}>@{user?.instagram||user?.name} · {user?.role}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setSponsorModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold text-white" style={{background:'linear-gradient(135deg,#C79A3B,#D96C2F)'}}>+ Patrocinador</button>
            <button onClick={()=>setActionModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{background:'rgba(111,45,168,0.12)',color:'#6F2DA8'}}>⚡ Ação</button>
            <button onClick={()=>setSysModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{background:'rgba(75,30,109,0.1)',color:'#4B1E6D'}}>+ Sistema</button>
            <button onClick={logout} className="text-xs font-medium px-2 py-1.5 rounded-lg" style={{color:'rgba(58,31,20,0.4)'}}>Sair</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Stats globais */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {emoji:'👥',label:'Usuários',value:stats?.totalUsers||0},
              {emoji:'🪙',label:'Emitidas',value:stats?.totalEmitted||0},
              {emoji:'📡',label:'Claims',value:stats?.totalClaims||0},
            ].map(s=>(
              <div key={s.label} className="card-junina p-3 text-center">
                <span className="text-xl block mb-0.5">{s.emoji}</span>
                <p className="text-xl font-black" style={{color:'#4B1E6D'}}>{s.value}</p>
                <p className="text-xs" style={{color:'#C79A3B'}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Banco Central */}
          {systems.length > 0 && (
            <div className="card-junina p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold" style={{color:'#4B1E6D'}}>🏦 Banco Central</h2>
                <span className="text-xs font-bold" style={{color:'#C79A3B'}}>{systems.reduce((a,s)=>a+s.total_budget,0)} 🪙 total</span>
              </div>
              <div className="space-y-3">
                {systems.map(s=>{
                  const pct = s.total_budget>0?Math.round((s.used_budget/s.total_budget)*100):0;
                  return(
                    <div key={s.id} className="rounded-xl p-3" style={{background:'rgba(199,154,59,0.06)',border:'1px solid rgba(199,154,59,0.15)'}}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={{color:'#3A1F14'}}>{s.name}</p>
                          <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>{s.used_budget}/{s.total_budget} 🪙 · {s.available_budget} disponíveis</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={()=>{
                            const v=prompt(`Novo orçamento para "${s.name}" (atual: ${s.total_budget}):`,s.total_budget);
                            if(v&&!isNaN(v)) updateSys(s,v);
                          }} className="text-xs px-2 py-1 rounded-lg font-medium" style={{background:'rgba(199,154,59,0.15)',color:'#C79A3B'}}>✏️</button>
                          <button onClick={()=>deleteSys(s)} className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(194,24,116,0.08)',color:'#C21874'}}>🗑</button>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(58,31,20,0.08)'}}>
                        <div className="h-full rounded-full" style={{width:`${pct}%`,background:pct>90?'#C21874':pct>70?'#D96C2F':'linear-gradient(90deg,#C79A3B,#D96C2F)'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Patrocinadores */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg" style={{color:'#4B1E6D'}}>📡 Patrocinadores <span className="text-sm font-normal" style={{color:'#C79A3B'}}>({sponsors.length})</span></h2>
              <button onClick={()=>setSponsorModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold text-white" style={{background:'linear-gradient(135deg,#C79A3B,#D96C2F)'}}>+ Novo</button>
            </div>
            {sponsors.length===0?(
              <div className="card-junina p-8 text-center">
                <span className="text-4xl block mb-2">🏪</span>
                <p style={{color:'rgba(58,31,20,0.4)'}}>Nenhum patrocinador ainda</p>
                <button onClick={()=>setSponsorModal(true)} className="btn-primary mt-4 text-sm">Criar primeiro</button>
              </div>
            ):(
              <div className="space-y-3">
                {sponsors.map(c=><SponsorCard key={c.id} c={c} systems={systems} onRefresh={()=>fetchStats(true)} onQr={setQrModal}/>)}
              </div>
            )}
          </div>

          {/* Ações dos sistemas */}
          <div className="card-junina p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold" style={{color:'#4B1E6D'}}>⚡ Ações dos Sistemas <span className="text-sm font-normal" style={{color:'#C79A3B'}}>({actions.length})</span></h2>
              <button onClick={()=>setActionModal(true)} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{background:'rgba(111,45,168,0.12)',color:'#6F2DA8'}}>+ Ação</button>
            </div>
            {actions.length===0?(
              <p className="text-center text-sm py-4" style={{color:'rgba(58,31,20,0.4)'}}>Nenhuma ação configurada</p>
            ):(
              <div className="space-y-2">
                {actions.map(c=>(
                  <div key={c.id} className="rounded-xl p-3" style={{background:c.active?'rgba(111,45,168,0.05)':'rgba(58,31,20,0.03)',border:'1px solid rgba(111,45,168,0.1)'}}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-bold" style={{color:c.active?'#6F2DA8':'rgba(58,31,20,0.3)'}}>{c.active?'🟣':'⚫'}</span>
                          <span className="font-semibold text-sm" style={{color:'#3A1F14'}}>{c.name}</span>
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{background:'rgba(111,45,168,0.08)',color:'#6F2DA8'}}>{c.action_key}</span>
                        </div>
                        <p className="text-xs" style={{color:'rgba(58,31,20,0.4)'}}>
                          +{c.points}🪙 · {c.budget?`${c.spent}/${c.budget}`:c.spent+' emitidos'} · {c.allow_multiple?'múltiplas':'1x/usuário'}
                          {c.system_name && ` · ${c.system_name}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={()=>setEditAction(c)} className="text-xs px-2 py-1 rounded-lg font-bold" style={{background:'rgba(75,30,109,0.08)',color:'#6F2DA8'}}>✏️</button>
                        <button onClick={async()=>{await api.patch(`/admin/campaigns/${c.id}`,{active:!c.active});fetchStats(true);}}
                          className="text-xs px-2 py-1 rounded-lg" style={{background:c.active?'rgba(58,31,20,0.06)':'rgba(111,45,168,0.1)',color:c.active?'rgba(58,31,20,0.4)':'#6F2DA8'}}>
                          {c.active?'Pausar':'Ativar'}
                        </button>
                        <button onClick={async()=>{if(!confirm(`Excluir "${c.name}"?`))return;await api.delete(`/admin/campaigns/${c.id}`);toast.success('Excluído');fetchStats(true);}}
                          className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(194,24,116,0.08)',color:'#C21874'}}>🗑</button>
                      </div>
                    </div>
                    {c.budget && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(58,31,20,0.08)'}}>
                          <div className="h-full rounded-full" style={{width:`${Math.min(100,Math.round(c.spent/c.budget*100))}%`,background:'#6F2DA8'}}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top carteiras */}
          {stats?.topUsers?.length>0&&(
            <div className="card-junina p-4">
              <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>🏆 Top Carteiras</h2>
              <div className="space-y-1.5">
                {stats.topUsers.map((u,i)=>(
                  <div key={u.user_id} className="flex items-center justify-between py-1.5 px-3 rounded-xl" style={{background:'rgba(199,154,59,0.06)'}}>
                    <span className="text-sm" style={{color:'#3A1F14'}}>#{i+1} · usuário #{u.user_id}</span>
                    <span className="font-black text-sm" style={{color:'#C79A3B'}}>{u.balance} 🪙</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Últimas coletas */}
          {stats?.recentClaims?.length>0&&(
            <div className="card-junina p-4">
              <h2 className="font-display font-bold mb-3" style={{color:'#4B1E6D'}}>Últimas coletas</h2>
              <div className="space-y-1.5">
                {stats.recentClaims.map(cl=>(
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

      {/* Modais */}
      {qrModal&&<QrModal campaign={qrModal} onClose={()=>setQrModal(null)}/>}
      {editAction&&<EditModal campaign={editAction} systems={systems} onSave={()=>fetchStats(true)} onClose={()=>setEditAction(null)}/>}

      {/* Modal patrocinador */}
      {sponsorModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.5)',backdropFilter:'blur(4px)'}}
          onClick={e=>e.target===e.currentTarget&&setSponsorModal(false)}>
          <div className="card-junina p-6 w-full max-w-sm animate-pop">
            <h3 className="font-display text-lg font-bold mb-1" style={{color:'#4B1E6D'}}>Novo Patrocinador</h3>
            <p className="text-xs mb-4" style={{color:'rgba(58,31,20,0.4)'}}>Gera link + QR para o operador disponibilizar no NFC</p>
            <form onSubmit={e=>{e.preventDefault();createCampaign({name:sponsorForm.name,description:sponsorForm.description,points:parseInt(sponsorForm.points),budget:sponsorForm.budget?parseInt(sponsorForm.budget):null,system_budget_id:sponsorForm.system_budget_id?parseInt(sponsorForm.system_budget_id):null,action_key:null,allow_multiple:false},()=>setSponsorForm({name:'',description:'',points:'2',budget:'',system_budget_id:''}),()=>setSponsorModal(false));}} className="space-y-3">
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome</label>
                <input className="input-junina" placeholder="Ex: Barraca do Milho" value={sponsorForm.name} onChange={e=>setSponsorForm(f=>({...f,name:e.target.value}))} required autoFocus/></div>
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Descrição (opcional)</label>
                <input className="input-junina" placeholder="Ex: Compre e ganhe moedas" value={sponsorForm.description} onChange={e=>setSponsorForm(f=>({...f,description:e.target.value}))}/></div>
              {systems.length>0&&(<div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Sistema</label>
                <select className="input-junina" value={sponsorForm.system_budget_id} onChange={e=>setSponsorForm(f=>({...f,system_budget_id:e.target.value}))}>
                  <option value="">Sem sistema</option>
                  {systems.map(s=><option key={s.id} value={s.id}>{s.name} ({s.available_budget} disp.)</option>)}
                </select></div>)}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Moedas/coleta</label>
                  <input type="number" min="1" className="input-junina" value={sponsorForm.points} onChange={e=>setSponsorForm(f=>({...f,points:e.target.value}))} required/></div>
                <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Limite (🪙)</label>
                  <input type="number" min="1" className="input-junina" placeholder="ilimitado" value={sponsorForm.budget} onChange={e=>setSponsorForm(f=>({...f,budget:e.target.value}))}/></div>
              </div>
              {sponsorForm.budget&&sponsorForm.points&&(<p className="text-xs text-center" style={{color:'rgba(58,31,20,0.5)'}}>Máximo {Math.floor(parseInt(sponsorForm.budget||0)/parseInt(sponsorForm.points||1))} usuários</p>)}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>setSponsorModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ação */}
      {actionModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.5)',backdropFilter:'blur(4px)'}}
          onClick={e=>e.target===e.currentTarget&&setActionModal(false)}>
          <div className="card-junina p-6 w-full max-w-sm animate-pop">
            <h3 className="font-display text-lg font-bold mb-1" style={{color:'#4B1E6D'}}>⚡ Nova Ação</h3>
            <p className="text-xs mb-4" style={{color:'rgba(58,31,20,0.4)'}}>Emissão automática quando o sistema detecta a ação</p>
            <form onSubmit={e=>{e.preventDefault();createCampaign({name:actionForm.name,points:parseInt(actionForm.points),budget:actionForm.budget?parseInt(actionForm.budget):null,system_budget_id:actionForm.system_budget_id?parseInt(actionForm.system_budget_id):null,action_key:actionForm.action_key.trim(),allow_multiple:actionForm.allow_multiple},()=>setActionForm({name:'',action_key:'',points:'1',budget:'',allow_multiple:true,system_budget_id:''}),()=>setActionModal(false));}} className="space-y-3">
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome</label>
                <input className="input-junina" placeholder="Ex: Certidão Gerada" value={actionForm.name} onChange={e=>setActionForm(f=>({...f,name:e.target.value}))} required autoFocus/></div>
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#6F2DA8'}}>Action Key</label>
                <input className="input-junina font-mono" placeholder="certidao / missao / match..." value={actionForm.action_key} onChange={e=>setActionForm(f=>({...f,action_key:e.target.value}))} required/></div>
              {systems.length>0&&(<div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Sistema</label>
                <select className="input-junina" value={actionForm.system_budget_id} onChange={e=>setActionForm(f=>({...f,system_budget_id:e.target.value}))}>
                  <option value="">Sem sistema</option>
                  {systems.map(s=><option key={s.id} value={s.id}>{s.name} ({s.available_budget} disp.)</option>)}
                </select></div>)}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Moedas</label>
                  <input type="number" min="1" className="input-junina" value={actionForm.points} onChange={e=>setActionForm(f=>({...f,points:e.target.value}))} required/></div>
                <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Limite (🪙)</label>
                  <input type="number" min="1" className="input-junina" placeholder="ilimitado" value={actionForm.budget} onChange={e=>setActionForm(f=>({...f,budget:e.target.value}))}/></div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={actionForm.allow_multiple} onChange={e=>setActionForm(f=>({...f,allow_multiple:e.target.checked}))} className="accent-purple-600"/>
                <span className="text-sm font-semibold" style={{color:'#4B1E6D'}}>Múltiplas coletas por usuário</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>setActionModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal sistema */}
      {sysModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(75,30,109,0.5)',backdropFilter:'blur(4px)'}}
          onClick={e=>e.target===e.currentTarget&&setSysModal(false)}>
          <div className="card-junina p-6 w-full max-w-sm animate-pop">
            <h3 className="font-display text-lg font-bold mb-4" style={{color:'#4B1E6D'}}>🏦 Novo Sistema de Orçamento</h3>
            <form onSubmit={e=>{e.preventDefault();setSaving(true);api.post('/admin/systems',{name:sysForm.name,total_budget:parseInt(sysForm.total_budget)}).then(()=>{toast.success('Criado!');setSysModal(false);setSysForm({name:'',total_budget:''});fetchStats(true);}).catch(err=>toast.error(err.response?.data?.error||'Erro')).finally(()=>setSaving(false));}} className="space-y-3">
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#4B1E6D'}}>Nome</label>
                <input className="input-junina" placeholder="Ex: Bingo, Barracas, Patrocinadores" value={sysForm.name} onChange={e=>setSysForm(f=>({...f,name:e.target.value}))} required autoFocus/></div>
              <div><label className="block text-xs font-bold mb-1 uppercase tracking-wider" style={{color:'#C79A3B'}}>🪙 Orçamento total</label>
                <input type="number" min="1" className="input-junina" placeholder="Ex: 1000" value={sysForm.total_budget} onChange={e=>setSysForm(f=>({...f,total_budget:e.target.value}))} required/></div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>setSysModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 text-sm py-2.5" disabled={saving}>{saving?<LoadingSpinner size="sm"/>:'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Bandeirinhas/>
    </div>
  );
}
