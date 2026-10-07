// ============================================================================
// PAGE: src/pages/Quarentena.tsx
// Gestão Dedicada da Gaiola de Quarentena • Triagem 1 (Recebimento & Divergências)
// Paleta Industrial: Fundo #0A1A33, Cartões #12264A, Borda #2A3F5C, Ação #00B2D6
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  Search,
  Filter,
  Check,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Inbox,
  AlertOctagon,
  HelpCircle,
  Layers,
} from 'lucide-react';

export interface ItemQuarentenaCompleto {
  id: string;
  sku: string;
  descricao: string;
  numeroNf: string;
  fornecedor: string;
  quantidade: number;
  motivoDivergencia: string;
  status: 'retido' | 'liberado' | 'refugo' | 'devolver_fornecedor';
  localNome: string;
  criadoEm: string;
  decididoPor?: string;
  decididoEm?: string;
  motivoDecisao?: string;
}

const QUARENTENA_INICIAL_MOCK: ItemQuarentenaCompleto[] = [
  {
    id: '10111111-0000-0000-0000-000000000101',
    sku: 'PERF-SUP-BRANCO-6M',
    descricao: 'Perfil Folha Suprema Branco RAL 9003 (6.000 mm)',
    numeroNf: 'NF-98124',
    fornecedor: 'Alumínio Brasil S/A',
    quantidade: 24,
    motivoDivergencia: 'Lote recebido com oxidação superficial perceptível na ponta das barras',
    status: 'retido',
    localNome: 'Gaiola de Quarentena',
    criadoEm: 'Há 25 min',
  },
  {
    id: '10222222-0000-0000-0000-000000000102',
    sku: 'VIDRO-TEMP-8MM',
    descricao: 'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm',
    numeroNf: 'NF-98011',
    fornecedor: 'Temperados Nacional Ltda',
    quantidade: 4,
    motivoDivergencia: 'Lascamento acentuado na lapidação lateral (fora da tolerância NBR 14698)',
    status: 'retido',
    localNome: 'Gaiola de Quarentena',
    criadoEm: 'Há 2h',
  },
  {
    id: '10333333-0000-0000-0000-000000000103',
    sku: 'PERF-SUP-6M-PRETO',
    descricao: 'Perfil Barra 6m Suprema Preto Fosco',
    numeroNf: 'NF-99820',
    fornecedor: 'Metálica Distribuidora',
    quantidade: 8,
    motivoDivergencia: 'Divergência na contagem cega: 38 recebidas vs 40 na NF com avaria.',
    status: 'retido',
    localNome: 'Gaiola de Quarentena',
    criadoEm: 'Hoje às 11:30',
  },
];

export const Quarentena: React.FC = () => {
  const { perfil, pode, ehDono } = useAuth();
  const [itens, setItens] = useState<ItemQuarentenaCompleto[]>(() => {
    const local = localStorage.getItem('alufort_quarentena_itens');
    return local ? JSON.parse(local) : QUARENTENA_INICIAL_MOCK;
  });

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('retido');
  const [itemSelecionado, setItemSelecionado] = useState<ItemQuarentenaCompleto | null>(null);
  const [decisaoTipo, setDecisaoTipo] = useState<'devolver_fornecedor' | 'liberado' | 'refugo'>('devolver_fornecedor');
  const [motivoDecisao, setMotivoDecisao] = useState('');
  const [processando, setProcessando] = useState(false);

  // Permissão para deliberar
  const podeDecidir = ehDono || pode('quarentena.decidir') || pode('sistema.dono');

  // Carregar dados reais do Supabase se disponível
  useEffect(() => {
    const carregarDoBanco = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('quarentena')
          .select('*')
          .order('criado_em', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapeados: ItemQuarentenaCompleto[] = data.map((q: any) => ({
            id: q.id,
            sku: q.sku,
            descricao: q.descricao || q.sku,
            numeroNf: q.numero_nf,
            fornecedor: q.fornecedor || 'Fornecedor Cadastrado',
            quantidade: Number(q.quantidade) || 1,
            motivoDivergencia: q.motivo_divergencia,
            status: q.status || 'retido',
            localNome: 'Gaiola de Quarentena',
            criadoEm: new Date(q.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            decididoPor: q.decidido_por,
            decididoEm: q.decidido_em ? new Date(q.decidido_em).toLocaleTimeString('pt-BR') : undefined,
            motivoDecisao: q.motivo_decisao,
          }));
          setItens(mapeados);
        }
      } catch (err) {
        console.warn('Fallback quarentena local:', err);
      }
    };

    carregarDoBanco();

    // Inscrição em tempo real para novos itens retidos
    if (isSupabaseConfigured) {
      const canal = supabase
        .channel('quarentena_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quarentena' },
          () => {
            carregarDoBanco();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(canal);
      };
    }
  }, []);

  // Persistência local reativa
  useEffect(() => {
    localStorage.setItem('alufort_quarentena_itens', JSON.stringify(itens));
  }, [itens]);

  // Contadores para os Cards de Métricas
  const contadores = useMemo(() => {
    return {
      retidos: itens.filter((i) => i.status === 'retido').length,
      devolver: itens.filter((i) => i.status === 'devolver_fornecedor').length,
      liberados: itens.filter((i) => i.status === 'liberado').length,
      refugo: itens.filter((i) => i.status === 'refugo').length,
      total: itens.length,
    };
  }, [itens]);

  // Itens filtrados
  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      const matchStatus = filtroStatus === 'todos' ? true : item.status === filtroStatus;
      const q = busca.toLowerCase();
      const matchBusca =
        !busca ||
        item.sku.toLowerCase().includes(q) ||
        item.numeroNf.toLowerCase().includes(q) ||
        item.fornecedor.toLowerCase().includes(q) ||
        item.descricao.toLowerCase().includes(q) ||
        item.motivoDivergencia.toLowerCase().includes(q);
      return matchStatus && matchBusca;
    });
  }, [itens, filtroStatus, busca]);

  // Abertura do modal de deliberação
  const abrirModalDecisao = (item: ItemQuarentenaCompleto) => {
    setItemSelecionado(item);
    setDecisaoTipo('devolver_fornecedor');
    setMotivoDecisao('Lote com inconformidade técnica. Emitir nota de devolução e solicitar reposição imediata.');
  };

  // Submissão da deliberação
  const handleConfirmarDecisao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    if (!motivoDecisao || motivoDecisao.trim().length < 5) {
      toast.error('Informe uma justificativa técnica válida (mínimo de 5 caracteres).');
      return;
    }

    setProcessando(true);

    try {
      if (isSupabaseConfigured) {
        // Garantir que o registro existe na tabela antes de chamar a RPC
        const { data: existe } = await supabase
          .from('quarentena')
          .select('id')
          .eq('id', itemSelecionado.id)
          .maybeSingle();

        if (!existe) {
          await supabase.from('quarentena').insert({
            id: itemSelecionado.id,
            sku: itemSelecionado.sku,
            descricao: itemSelecionado.descricao,
            numero_nf: itemSelecionado.numeroNf,
            fornecedor: itemSelecionado.fornecedor,
            quantidade: itemSelecionado.quantidade,
            motivo_divergencia: itemSelecionado.motivoDivergencia,
            status: 'retido',
          });
        }

        const { error } = await supabase.rpc('decidir_quarentena', {
          p_quarentena_id: itemSelecionado.id,
          p_decisao: decisaoTipo,
          p_motivo: motivoDecisao,
        });

        if (error) {
          toast.error(`Falha no banco: ${error.message}`);
          setProcessando(false);
          return;
        }
      }

      // Atualiza estado local
      setItens((prev) =>
        prev.map((i) =>
          i.id === itemSelecionado.id
            ? {
                ...i,
                status: decisaoTipo,
                motivoDecisao: motivoDecisao,
                decididoEm: new Date().toLocaleTimeString('pt-BR'),
                decididoPor: perfil?.nome || 'Gestor de Qualidade',
              }
            : i
        )
      );

      const rotulo =
        decisaoTipo === 'devolver_fornecedor'
          ? 'Devolução ao fornecedor autorizada'
          : decisaoTipo === 'liberado'
          ? 'Material liberado para produção'
          : 'Enviado para refugo/sucata';

      toast.success(`${rotulo} com sucesso!`);
      setItemSelecionado(null);
      setMotivoDecisao('');
    } catch (err: any) {
      toast.error(`Erro ao deliberar: ${err.message}`);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Top Banner Institucional */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Gaiola de Quarentena Fabril
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Triagem 1 • Retenção Física
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Materiais retidos por divergência na conferência cega de NF-e ou não conformidade técnica.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-[#0A1A33] border border-[#2A3F5C] flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-mono font-medium text-slate-200">
              {contadores.retidos} {contadores.retidos === 1 ? 'lote retido' : 'lotes retidos'}
            </span>
          </div>
        </div>
      </div>

      {/* Cards de Indicadores de Quarentena */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setFiltroStatus('retido')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'retido'
              ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Retidos (Aguardando)
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{contadores.retidos}</div>
          <p className="text-[11px] text-slate-500 mt-1">Exigem deliberação do gestor</p>
        </button>

        <button
          onClick={() => setFiltroStatus('devolver_fornecedor')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'devolver_fornecedor'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Devolução ao Fornecedor
            </span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{contadores.devolver}</div>
          <p className="text-[11px] text-slate-500 mt-1">Aguardando emissão de NF de devolução</p>
        </button>

        <button
          onClick={() => setFiltroStatus('liberado')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'liberado'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Liberados p/ Uso
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{contadores.liberados}</div>
          <p className="text-[11px] text-slate-500 mt-1">Aprovados com ressalva</p>
        </button>

        <button
          onClick={() => setFiltroStatus('refugo')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            filtroStatus === 'refugo'
              ? 'bg-slate-900 border-slate-700 ring-2 ring-slate-500/20 text-white'
              : 'bg-white border-slate-200 hover:border-slate-400 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Refugo / Sucata
            </span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{contadores.refugo}</div>
          <p className="text-[11px] text-slate-500 mt-1">Descarte definitivo registrado</p>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por NF, SKU, fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00B2D6] focus:ring-1 focus:ring-[#00B2D6]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'retido', label: 'Retidos' },
            { id: 'devolver_fornecedor', label: 'Devolver ao Fornecedor' },
            { id: 'liberado', label: 'Liberados' },
            { id: 'refugo', label: 'Refugos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                filtroStatus === tab.id
                  ? 'bg-[#12264A] text-[#00B2D6] border border-[#2A3F5C]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Fila de Itens de Quarentena */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Lotes em Registro de Quarentena ({itensFiltrados.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Local físico padrão: <strong>Gaiola de Quarentena</strong>
          </span>
        </div>

        {itensFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              Nenhum material encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não há registros para os filtros selecionados. Novos materiais retidos na conferência cega aparecerão automaticamente aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {itensFiltrados.map((item) => (
              <div
                key={item.id}
                className="p-5 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs">
                      {item.numeroNf}
                    </span>
                    <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      {item.sku}
                    </span>
                    {item.status === 'retido' && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Retido
                      </span>
                    )}
                    {item.status === 'devolver_fornecedor' && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Devolução Autorizada
                      </span>
                    )}
                    {item.status === 'liberado' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Liberado
                      </span>
                    )}
                    {item.status === 'refugo' && (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Refugo / Descarte
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Registrado: {item.criadoEm}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {item.descricao}
                  </h3>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Fornecedor: <strong>{item.fornecedor}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      Qtd Retida: <strong>{item.quantidade} un/barras</strong>
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-rose-700">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                      Motivo da Não Conformidade:
                    </div>
                    <p className="leading-relaxed">{item.motivoDivergencia}</p>
                  </div>

                  {item.motivoDecisao && (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-0.5">
                      <div className="font-bold text-slate-900 text-[11px]">
                        Deliberação do Gestor ({item.decididoEm || 'Registrada'}):
                      </div>
                      <p className="italic text-slate-600">{item.motivoDecisao}</p>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-end justify-between gap-3 shrink-0">
                  {item.status === 'retido' ? (
                    <button
                      onClick={() => abrirModalDecisao(item)}
                      className="px-4 py-2.5 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Deliberar Quarentena</span>
                    </button>
                  ) : (
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-400 block uppercase">
                        Decisão Finalizada
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-600">
                        {item.decididoEm || 'Concluído'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE DELIBERAÇÃO DE QUARENTENA */}
      {itemSelecionado && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100">
            <div className="bg-[#0A1A33] text-white p-5 border-b border-[#2A3F5C] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm">Deliberação Técnica de Quarentena</h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    NF {itemSelecionado.numeroNf} • SKU {itemSelecionado.sku}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemSelecionado(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-[#14283F] flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarDecisao} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="text-slate-500">Material: <strong>{itemSelecionado.descricao}</strong></div>
                <div className="text-slate-500">Fornecedor: <strong>{itemSelecionado.fornecedor}</strong></div>
                <div className="text-rose-700 font-medium pt-1 border-t border-slate-200 mt-1">
                  Motivo: {itemSelecionado.motivoDivergencia}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Ação / Decisão Resolutiva *
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'devolver_fornecedor',
                      titulo: '1. Devolver ao Fornecedor',
                      desc: 'Material não aprovado. Rejeição com nota fiscal de devolução.',
                      badge: 'Recomendado',
                      cor: 'border-amber-400 bg-amber-50/60',
                    },
                    {
                      id: 'liberado',
                      titulo: '2. Liberar p/ Uso Fabril',
                      desc: 'Aprovar exceção técnica com liberação para montagem.',
                      badge: 'Com Ressalva',
                      cor: 'border-emerald-400 bg-emerald-50/60',
                    },
                    {
                      id: 'refugo',
                      titulo: '3. Refugo / Sucata',
                      desc: 'Material irrecuperável sem possibilidade de devolução.',
                      badge: 'Perda Total',
                      cor: 'border-rose-400 bg-rose-50/60',
                    },
                  ].map((opcao) => (
                    <label
                      key={opcao.id}
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                        decisaoTipo === opcao.id
                          ? `${opcao.cor} ring-2 ring-slate-800`
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="decisao_quarentena"
                        value={opcao.id}
                        checked={decisaoTipo === opcao.id}
                        onChange={(e) => setDecisaoTipo(e.target.value as any)}
                        className="mt-1 accent-[#00B2D6]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{opcao.titulo}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {opcao.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opcao.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Justificativa Técnica da Decisão *
                </label>
                <textarea
                  rows={3}
                  value={motivoDecisao}
                  onChange={(e) => setMotivoDecisao(e.target.value)}
                  placeholder="Ex: Material fora das tolerâncias da NBR. Solicitar emissão de NF de devolução e reposição em até 48h."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00B2D6] focus:ring-1 focus:ring-[#00B2D6]"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  A decisão será registrada na auditoria imutável do sistema com a assinatura digital do operador.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setItemSelecionado(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processando}
                  className="px-5 py-2.5 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {processando ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Registrando no Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Deliberação</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

