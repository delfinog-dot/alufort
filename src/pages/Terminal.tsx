// ============================================================================
// PAGE: src/pages/Terminal.tsx
// Terminal Operacional para Chão de Fábrica e Encarregado
// Alvos de toque min-h-[56px] • ZERO Menções a R$ ou Valores Financeiros
// ============================================================================

import React, { useState } from 'react';
import { useProductionFlow, OrdemProducao } from '../hooks/useProductionFlow';
import { useStockLedger, ItemSaldoFisico } from '../hooks/useStockLedger';
import { useTriagemAlerts } from '../hooks/useTriagemAlerts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { EtiquetaTermica } from '../components/Etiqueta';
import { useObras } from '../hooks/useObras';
import { CadastroMaterialIA } from '../components/materiais/CadastroMaterialIA';
import {
  Package,
  Scissors,
  ClipboardCheck,
  Truck,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wrench,
  Search,
  Printer,
  X,
  Layers,
  Sparkles,
  MapPin,
  Tag,
  Check,
  RefreshCw,
  Trash2,
  Box,
  Building2,
  Camera,
  Scan,
  Plus,
  Calendar,
  Eye,
  HardHat,
} from 'lucide-react';

interface TerminalProps {
  aoNavegarParaLocais?: () => void;
  aoNavegarParaQualidade?: () => void;
  aoNavegarParaExpedicao?: () => void;
  aoNavegarParaFerramentas?: () => void;
  aoNavegarParaQuarentena?: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  aoNavegarParaLocais,
  aoNavegarParaQualidade,
  aoNavegarParaExpedicao,
  aoNavegarParaFerramentas,
  aoNavegarParaQuarentena,
}) => {
  const { ops, filaCorteImediata, avancarStatusOP, alternarSeparacaoMaterial } = useProductionFlow();
  const { saldos, registrarApontamentoCorte } = useStockLedger();
  const { simularAlertaQuarentena } = useTriagemAlerts();
  const { obras, cadastrarObra } = useObras();

  // Estados dos Modais de IA e Obras
  const [modalIaAberto, setModalIaAberto] = useState(false);
  const [modalNovaObraAberto, setModalNovaObraAberto] = useState(false);
  const [novaObraNome, setNovaObraNome] = useState('');
  const [novaObraCliente, setNovaObraCliente] = useState('');
  const [novaObraEndereco, setNovaObraEndereco] = useState('');
  const [abaTerminal, setAbaTerminal] = useState<'oficina' | 'obras'>('oficina');

  // Estados dos modais táteis de oficina (min-h-[56px])
  const [modalCorteAberto, setModalCorteAberto] = useState(false);
  const [opSelecionadaCorte, setOpSelecionadaCorte] = useState<OrdemProducao | null>(null);
  const [itemSelecionadoCorte, setItemSelecionadoCorte] = useState<ItemSaldoFisico | null>(null);
  const [comprimentoConsumido, setComprimentoConsumido] = useState<number>(2450);
  const [comprimentoSobra, setComprimentoSobra] = useState<number>(3550); // 6000 - 2450

  const [modalSeparacaoAberto, setModalSeparacaoAberto] = useState(false);
  const [opSelecionadaSeparacao, setOpSelecionadaSeparacao] = useState<OrdemProducao | null>(null);

  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [nfEntrada, setNfEntrada] = useState('NF-99820');
  const [skuEntrada, setSkuEntrada] = useState('PERF-SUP-6M-BRANCO');
  const [qtdEsperada, setQtdEsperada] = useState(40);
  const [qtdContada, setQtdContada] = useState(38); // divergência intencional
  const [motivoQuarentena, setMotivoQuarentena] = useState('Falta física de 2 barras e oxidação na ponta');

  // Itens em Quarentena no Galpão
  const itensQuarentena = [
    {
      id: 'quar-1',
      nf: 'NF-98124',
      sku: 'PERF-SUP-BRANCO-6M',
      quantidade: '24 barras',
      motivo: 'Oxidação superficial no lote',
      local: 'Gaiola de Quarentena',
      hora: 'Há 25 min',
    },
    {
      id: 'quar-2',
      nf: 'NF-98011',
      sku: 'VIDRO-TEMP-8MM',
      quantidade: '4 chapas',
      motivo: 'Lascamento na borda lapidada',
      local: 'Gaiola de Quarentena',
      hora: 'Há 2h',
    },
  ];

  // Ferramentas com devolução pendente
  const ferramentasPendentes = [
    { nome: 'Gabarito de Furação Linha Suprema', operador: 'João Corte', tempo: '1h 40m' },
    { nome: 'Pistola de Silicone Pneumática #2', operador: 'Lucas Montagem', tempo: '45m' },
  ];

  // Cálculo da regra de corte em tempo real
  const ehRetalhoReaproveitavel = comprimentoSobra >= 300;

  const handleSubmeterCorte = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opSelecionadaCorte || !itemSelecionadoCorte) return;

    registrarApontamentoCorte({
      op: opSelecionadaCorte.numero_op,
      itemOrigem: itemSelecionadoCorte,
      comprimentoConsumidoMm: comprimentoConsumido,
      comprimentoSobraMm: comprimentoSobra,
      localDestinoRetalho: {
        codigo: 'CAV-H-01-01',
        nome: 'Cavalete Horizontal 1 - Nível 1',
      },
    });

    setModalCorteAberto(false);
  };

  const handleSubmeterEntradaCega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qtdContada !== qtdEsperada) {
      const motivoTexto = `Divergência na conferência cega: ${qtdContada} recebidas vs ${qtdEsperada} na NF. ${motivoQuarentena}`;
      
      // Simula alerta / toast com botão Ver Pendência
      simularAlertaQuarentena(
        nfEntrada,
        skuEntrada,
        motivoTexto
      );

      // Persiste no Supabase se conectado
      if (isSupabaseConfigured) {
        try {
          const novoId = crypto.randomUUID();
          await supabase.from('quarentena').insert({
            id: novoId,
            sku: skuEntrada,
            descricao: `Material da NF ${nfEntrada} (${skuEntrada})`,
            numero_nf: nfEntrada,
            fornecedor: 'Fornecedor da NF',
            quantidade: Math.abs(qtdEsperada - qtdContada) || 1,
            motivo_divergencia: motivoTexto,
            status: 'retido',
          });

          await supabase.from('triagens').insert({
            tipo_triagem: 'triagem_1_recebimento',
            numero_nf: nfEntrada,
            sku: skuEntrada,
            status: 'quarentena',
            motivo_divergencia: motivoTexto,
          });
        } catch (err) {
          console.warn('Erro ao inserir quarentena no Supabase:', err);
        }
      }
    }
    setModalEntradaAberto(false);
  };

  return (
    <div className="space-y-6 select-none font-sans antialiased pb-12 animate-in fade-in-50 duration-150">
      {/* Top Banner Operacional AluFort */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-[#00B2D6] border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-500 text-white font-mono flex items-center gap-1.5 shadow-xs">
                <HardHat className="w-3.5 h-3.5" />
                Terminal Operacional Fabril
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#00B2D6] text-slate-950 font-mono">
                IA & Visão Computacional
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Sincronizado em Tempo Real
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Controle de Produção & Apontamentos Físicos
            </h1>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
              Tire fotos da Nota Fiscal ou pacotes. A IA identifica os materiais e você autoriza o lançamento com vínculo à obra.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setModalIaAberto(true)}
            className="px-4 py-2.5 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Cadastrar via Foto / NF (IA)</span>
          </button>

          <button
            type="button"
            onClick={() => setModalNovaObraAberto(true)}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Nova Obra</span>
          </button>
        </div>
      </div>

      {/* Seletor de Visualização do Painel do Encarregado */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaTerminal('oficina')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              abaTerminal === 'oficina'
                ? 'bg-[#12264A] text-[#00B2D6] shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>Linha de Produção & Apontamentos</span>
          </button>

          <button
            onClick={() => setAbaTerminal('obras')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              abaTerminal === 'obras'
                ? 'bg-[#12264A] text-[#00B2D6] shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Gestão de Obras & Vínculos ({obras.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400 hidden sm:block">
          Modo: <strong>Encarregado de Fábrica</strong>
        </span>
      </div>

      {/* ============================================================ */}
      {/* ABA 2: GESTÃO DE OBRAS & MATERIAIS VINCULADOS                 */}
      {/* ============================================================ */}
      {abaTerminal === 'obras' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {obras.map((obra) => (
              <div
                key={obra.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-[#00B2D6] transition-all space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                      {obra.status === 'em_producao'
                        ? 'Em Produção'
                        : obra.status === 'aguardando_materiais'
                        ? 'Aguardando Materiais'
                        : 'Planejada'}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 mt-1.5 leading-snug">
                      {obra.nome}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {obra.cliente}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Entrega Prometida:</span>
                    <strong className="text-slate-800">{obra.dataPrometida}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Esquadrias Programadas:</span>
                    <strong className="text-slate-800">{obra.totalEsquadrias} unidades</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Materiais Alocados:</span>
                    <strong className="text-cyan-700">{obra.totalMateriaisAlocados} lotes/barras</strong>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Progresso de Montagem</span>
                    <span>{obra.progressoPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00B2D6] rounded-full transition-all"
                      style={{ width: `${obra.progressoPct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalIaAberto(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-[#12264A] text-slate-800 hover:text-[#00B2D6] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Vincular Materiais via Foto</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 1: 4 AÇÕES RÁPIDAS NO TOPO (Botões de Toque min-h-[56px]) */}
      {/* ============================================================ */}
      {abaTerminal === 'oficina' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Ação 1: Conferência de Entrada (NF-e Cega) */}
        <button
          type="button"
          onClick={() => setModalEntradaAberto(true)}
          className="min-h-[56px] h-20 p-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-teal-500 shadow-2xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 group-hover:text-teal-700">
                1. Conferência de Entrada
              </div>
              <div className="text-[11px] text-slate-500">
                NF-e Cega & Quarentena
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 shrink-0" />
        </button>

        {/* Ação 2: Liberação e Separação de OP */}
        <button
          type="button"
          onClick={() => {
            if (ops.length > 0) {
              setOpSelecionadaSeparacao(ops[0]);
              setModalSeparacaoAberto(true);
            }
          }}
          className="min-h-[56px] h-20 p-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-blue-500 shadow-2xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 group-hover:text-blue-700">
                2. Separação de OP
              </div>
              <div className="text-[11px] text-slate-500">
                Retalhos 1º & Barras 6m
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 shrink-0" />
        </button>

        {/* Ação 3: Apontamento de Corte */}
        <button
          type="button"
          onClick={() => {
            if (filaCorteImediata.length > 0 && saldos.length > 0) {
              setOpSelecionadaCorte(filaCorteImediata[0]);
              setItemSelecionadoCorte(saldos[0]);
              setModalCorteAberto(true);
            }
          }}
          className="min-h-[56px] h-20 p-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-amber-500 shadow-2xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 group-hover:text-amber-700">
                3. Apontamento de Corte
              </div>
              <div className="text-[11px] text-slate-500">
                Sobra ≥ 300mm = Retalho
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 shrink-0" />
        </button>

        {/* Ação 4: Qualidade e Doca */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (aoNavegarParaQualidade) aoNavegarParaQualidade();
            }}
            className="min-h-[48px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-indigo-500 shadow-2xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700">
                  4. Qualidade & Checklist
                </div>
                <div className="text-[10px] text-slate-500">
                  Triagem 3 • Retrabalhos
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (aoNavegarParaExpedicao) aoNavegarParaExpedicao();
            }}
            className="min-h-[48px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-cyan-500 shadow-2xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-200 flex items-center justify-center shrink-0 group-hover:bg-[#00B2D6] group-hover:text-slate-950 transition-colors">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700">
                  Carregamento na Doca
                </div>
                <div className="text-[10px] text-slate-500">
                  Triagem 4 • Bipagem Serial
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-600 shrink-0" />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MINHA FILA DE HOJE / AÇÕES IMEDIATAS                         */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: OPs Prontas para Corte (Medição Definitiva Confirmada) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Fila de Corte Imediato (Medição Definitiva Confirmada)
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
              {filaCorteImediata.length} OPs na fila
            </span>
          </div>

          <div className="space-y-3">
            {filaCorteImediata.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                Nenhuma OP pendente para corte imediato.
              </div>
            ) : (
              filaCorteImediata.map((op) => (
                <div
                  key={op.id}
                  className="bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 p-4 shadow-2xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                        {op.numero_op}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {op.obra_destino}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Medição Definitiva OK
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                        {op.prioridade}
                      </span>
                    </div>
                  </div>

                  <div className="py-2.5">
                    <div className="text-sm font-extrabold text-slate-900">
                      {op.descricao}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 font-mono">
                      <span>Qtd: {op.quantidade_pecas} esquadrias</span>
                      <span>Prazo Fábrica: {op.data_entrega_fabrica}</span>
                    </div>
                  </div>

                  {/* Ações Rápidas de Chão de Fábrica (min-h-[56px]) */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpSelecionadaSeparacao(op);
                        setModalSeparacaoAberto(true);
                      }}
                      className="min-h-[56px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Layers className="w-4 h-4 text-slate-600" />
                      <span>Conferir Separação ({op.materiais.length} materiais)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpSelecionadaCorte(op);
                        if (saldos.length > 0) setItemSelecionadoCorte(saldos[0]);
                        setModalCorteAberto(true);
                      }}
                      className="min-h-[56px] px-5 py-2 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm transition-transform active:scale-98"
                    >
                      <Scissors className="w-4 h-4" />
                      <span>Apontar Corte desta OP</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coluna 3: Alertas Físicos, Gaiola de Quarentena & Ferramentas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Retidos na Quarentena
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">
                {itensQuarentena.length} lotes
              </span>
              {aoNavegarParaQuarentena && (
                <button
                  onClick={aoNavegarParaQuarentena}
                  className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 underline cursor-pointer"
                >
                  Abrir Gaiola →
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {itensQuarentena.map((q) => (
              <div
                key={q.id}
                className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs relative"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-900">{q.nf}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{q.hora}</span>
                </div>
                <div className="text-xs font-extrabold text-rose-950 mt-1">
                  {q.sku} ({q.quantidade})
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Motivo: {q.motivo}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-rose-700 font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    {q.local}
                  </span>
                  <span className="text-[10px] font-mono bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                    Aguardando Inspeção
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Ferramentas e Gabaritos com Devolução Pendente */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                Gabaritos & Ferramentas
              </h3>
              {aoNavegarParaFerramentas && (
                <button
                  type="button"
                  onClick={aoNavegarParaFerramentas}
                  className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 hover:underline cursor-pointer"
                >
                  Ver Painel Completo →
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
              {ferramentasPendentes.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100 last:border-none last:pb-0"
                >
                  <div>
                    <span className="font-bold text-slate-800 block">{f.nome}</span>
                    <span className="text-[11px] text-slate-500">Com: {f.operador}</span>
                  </div>
                  <span className="font-mono text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                    {f.tempo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PAINEL DE CONSULTA RÁPIDA DE ENDEREÇOS FÍSICOS (NOMES HUMANOS) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#00B2D6]" />
              Consulta Rápida de Endereçamento Físico (Nomes Formato Humano)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Locais fabris com identificação clara para operadores de corte, separação e montagem.
            </p>
          </div>

          <button
            type="button"
            onClick={aoNavegarParaLocais}
            className="text-xs font-bold text-[#0089a8] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Ver Todos os Locais & Imprimir</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {saldos.map((s) => (
            <div
              key={s.id}
              className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-[#00B2D6] transition-colors"
            >
              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                {s.local_codigo}
              </span>
              <div className="text-xs font-black text-slate-900 mt-1 truncate">
                {s.local_nome_exibicao}
              </div>
              <div className="text-[11px] text-slate-600 truncate mt-1">
                {s.descricao}
              </div>
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-800 mt-2 pt-1 border-t border-slate-200">
                <span>{s.comprimento_mm} mm</span>
                <span className="text-blue-700">{s.quantidade_saldo} {s.unidade}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: APONTAMENTO DE CORTE COM REGRA VISUAL DE SOBRAS     */}
      {/* Sobra >= 300 mm = Retalho Etiquetado | < 300 mm = Sucata     */}
      {/* ============================================================ */}
      {modalCorteAberto && opSelecionadaCorte && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300 animate-in fade-in-50 duration-150">
            <div className="p-4 bg-[#0A1A33] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-[#00B2D6]" />
                  Apontamento de Corte: {opSelecionadaCorte.numero_op}
                </h3>
                <p className="text-xs text-slate-400">
                  Consumo real com classificação automática de retalho vs. sucata
                </p>
              </div>
              <button
                onClick={() => setModalCorteAberto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmeterCorte} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Perfil / Barra Utilizada:
                </label>
                <select
                  value={itemSelecionadoCorte?.id}
                  onChange={(e) => {
                    const sel = saldos.find((s) => s.id === e.target.value);
                    if (sel) {
                      setItemSelecionadoCorte(sel);
                      setComprimentoConsumido(2400);
                      setComprimentoSobra(sel.comprimento_mm - 2400);
                    }
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg min-h-[48px]"
                >
                  {saldos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.descricao} [{s.comprimento_mm} mm] - Saldo: {s.quantidade_saldo} {s.unidade} em {s.local_nome_exibicao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Comprimento Consumido (mm):
                  </label>
                  <input
                    type="number"
                    min="100"
                    max={itemSelecionadoCorte?.comprimento_mm || 6000}
                    value={comprimentoConsumido}
                    onChange={(e) => {
                      const c = parseInt(e.target.value) || 0;
                      setComprimentoConsumido(c);
                      const total = itemSelecionadoCorte?.comprimento_mm || 6000;
                      setComprimentoSobra(Math.max(0, total - c));
                    }}
                    className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-300 rounded-lg min-h-[48px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Sobra Medida (mm):
                  </label>
                  <input
                    type="number"
                    value={comprimentoSobra}
                    onChange={(e) => setComprimentoSobra(parseInt(e.target.value) || 0)}
                    className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-300 rounded-lg min-h-[48px]"
                  />
                </div>
              </div>

              {/* REGRA VISUAL DE SOBRAS CRÍTICA */}
              <div
                className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-all ${
                  ehRetalhoReaproveitavel
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                    : 'bg-slate-100 border-slate-400 text-slate-800'
                }`}
              >
                {ehRetalhoReaproveitavel ? (
                  <Tag className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Trash2 className="w-6 h-6 text-slate-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    {ehRetalhoReaproveitavel
                      ? 'REGRA ATENDIDA: RETALHO REAPROVEITÁVEL (≥ 300 mm)'
                      : 'REGRA ATENDIDA: SUCATA METÁLICA (< 300 mm)'}
                  </div>
                  <div className="text-xs mt-1 leading-relaxed">
                    {ehRetalhoReaproveitavel ? (
                      <span>
                        A sobra de <strong>{comprimentoSobra} mm</strong> será automaticamente cadastrada no ledger como retalho,
                        gerando etiqueta para armazenamento em <strong>Cavalete Horizontal</strong>.
                      </span>
                    ) : (
                      <span>
                        A sobra de <strong>{comprimentoSobra} mm</strong> é inferior ao limite técnico de 300 mm.
                        Deve ser depositada diretamente na <strong>Caçamba de Sucata de Alumínio</strong>.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões Táteis min-h-[56px] */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalCorteAberto(false)}
                  className="min-h-[56px] px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[56px] px-6 py-3 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Confirmar Apontamento de Corte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: CONFERÊNCIA CEGA DE ENTRADA (TRIAGEM 1)             */}
      {/* ============================================================ */}
      {modalEntradaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 animate-in fade-in-50 duration-150">
            <div className="p-4 bg-[#0A1A33] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#00B2D6]" />
                  Conferência Cega de Recebimento
                </h3>
                <p className="text-xs text-slate-400">
                  Divergências enviam material automaticamente para Quarentena
                </p>
              </div>
              <button
                onClick={() => setModalEntradaAberto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmeterEntradaCega} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número da NF-e:
                  </label>
                  <input
                    type="text"
                    value={nfEntrada}
                    onChange={(e) => setNfEntrada(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-300 rounded-lg min-h-[48px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU do Perfil:
                  </label>
                  <input
                    type="text"
                    value={skuEntrada}
                    onChange={(e) => setSkuEntrada(e.target.value)}
                    className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-300 rounded-lg min-h-[48px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Qtd na NF (Barras):
                  </label>
                  <input
                    type="number"
                    value={qtdEsperada}
                    onChange={(e) => setQtdEsperada(parseInt(e.target.value) || 0)}
                    className="w-full text-sm font-mono font-bold p-2.5 bg-slate-100 border border-slate-300 rounded-lg min-h-[48px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Qtd Contada Fisicamente:
                  </label>
                  <input
                    type="number"
                    value={qtdContada}
                    onChange={(e) => setQtdContada(parseInt(e.target.value) || 0)}
                    className={`w-full text-sm font-mono font-bold p-2.5 rounded-lg min-h-[48px] border ${
                      qtdContada !== qtdEsperada
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-200'
                        : 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    }`}
                  />
                </div>
              </div>

              {qtdContada !== qtdEsperada && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950">
                  <span className="font-bold block mb-1 flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    Divergência Detectada! Material irá para Quarentena
                  </span>
                  <input
                    type="text"
                    value={motivoQuarentena}
                    onChange={(e) => setMotivoQuarentena(e.target.value)}
                    placeholder="Descreva o motivo da retenção..."
                    className="w-full text-xs p-2 bg-white border border-rose-300 rounded-lg mt-1"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalEntradaAberto(false)}
                  className="min-h-[56px] px-5 py-3 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[56px] px-6 py-3 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Finalizar Conferência Cega</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: SEPARAÇÃO DE OP (PRIORIZA RETALHOS ANTES DE BARRAS) */}
      {/* ============================================================ */}
      {modalSeparacaoAberto && opSelecionadaSeparacao && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300 animate-in fade-in-50 duration-150">
            <div className="p-4 bg-[#0A1A33] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#00B2D6]" />
                  Separação de Materiais: {opSelecionadaSeparacao.numero_op}
                </h3>
                <p className="text-xs text-slate-400">
                  Regra de Corte: Retalhos têm prioridade 1 antes de consumir barras de 6 m
                </p>
              </div>
              <button
                onClick={() => setModalSeparacaoAberto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="text-xs text-slate-600">
                Marque os itens separados fisicamente no galpão para liberar o corte:
              </div>

              <div className="space-y-2">
                {opSelecionadaSeparacao.materiais.map((mat) => (
                  <div
                    key={mat.id}
                    onClick={() => alternarSeparacaoMaterial(opSelecionadaSeparacao.id, mat.id)}
                    className={`min-h-[56px] p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      mat.separado
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                          mat.separado
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {mat.separado && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-black flex items-center gap-2">
                          {mat.descricao}
                          {mat.origem_prioritaria === 'retalho_estoque' && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300">
                              Prioridade: Retalho
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Local: {mat.local_origem_nome || 'Estoque Central'} • Comp: {mat.comprimento_necessario_mm} mm
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-slate-700">
                      {mat.quantidade_necessaria} un
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalSeparacaoAberto(false)}
                  className="min-h-[56px] px-6 py-3 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Concluir Separação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL IA: CADASTRO INTELIGENTE DE MATERIAIS COM FOTO / NF    */}
      {/* ============================================================ */}
      {modalIaAberto && (
        <CadastroMaterialIA
          aoFechar={() => setModalIaAberto(false)}
          aoSucesso={() => {
            setModalIaAberto(false);
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL: CADASTRO DE NOVA OBRA                                 */}
      {/* ============================================================ */}
      {modalNovaObraAberto && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00B2D6]" />
                Cadastrar Nova Obra Fabril
              </h3>
              <button
                onClick={() => setModalNovaObraAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await cadastrarObra({
                  nome: novaObraNome,
                  cliente: novaObraCliente,
                  endereco: novaObraEndereco,
                  dataPrometida: '30 dias',
                });
                setModalNovaObraAberto(false);
                setNovaObraNome('');
                setNovaObraCliente('');
                setNovaObraEndereco('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nome da Obra / Edifício *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Edifício Horizonte Azul"
                  value={novaObraNome}
                  onChange={(e) => setNovaObraNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cliente / Construtora
                </label>
                <input
                  type="text"
                  placeholder="Ex: Construtora Metropolitana"
                  value={novaObraCliente}
                  onChange={(e) => setNovaObraCliente(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Endereço / Local da Obra
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Brasil, 500"
                  value={novaObraEndereco}
                  onChange={(e) => setNovaObraEndereco(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalNovaObraAberto(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs rounded-lg shadow-sm"
                >
                  Cadastrar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
