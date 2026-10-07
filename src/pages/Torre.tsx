// ============================================================================
// PAGE: src/pages/Torre.tsx
// Torre de Controle Estratégica (Dono / Diretoria)
// Painel dos 6 Indicadores Críticos, Decisão de Exceções, Segregação de Funções & Auditoria
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SemAcesso } from '../components/SemAcesso';
import { useTorreData, AjusteEstoquePendente, ItemQuarentenaDecisao } from '../hooks/useTorreData';
import {
  Crown,
  Clock,
  Activity,
  Scissors,
  ClipboardCheck,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardHat,
  MapPin,
  Lock,
  ArrowRight,
  TrendingUp,
  FileText,
  Truck,
  RotateCcw,
  Sparkles,
  Search,
  Eye,
  Sliders,
  AlertOctagon,
  Layers,
  ChevronRight,
  UserX,
  History,
} from 'lucide-react';

interface TorreProps {
  aoNavegarParaTerminal?: () => void;
  aoNavegarParaLocais?: () => void;
}

export const Torre: React.FC<TorreProps> = ({
  aoNavegarParaTerminal,
  aoNavegarParaLocais,
}) => {
  const { ehDono, perfil } = useAuth();
  const {
    indicadores,
    pedidosParados,
    reservasFisicas,
    ajustesPendentes,
    itensQuarentena,
    historicoAuditoria,
    atualizando,
    recarregarDados,
    decidirAjuste,
    decidirQuarentena,
  } = useTorreData();

  // Estados dos modais de decisão de alçada
  const [ajusteSelecionado, setAjusteSelecionado] = useState<AjusteEstoquePendente | null>(null);
  const [tipoDecisaoAjuste, setTipoDecisaoAjuste] = useState<'aprovado' | 'rejeitado'>('aprovado');
  const [justificativaAjuste, setJustificativaAjuste] = useState('');
  const [processandoAjuste, setProcessandoAjuste] = useState(false);

  const [quarentenaSelecionada, setQuarentenaSelecionada] = useState<ItemQuarentenaDecisao | null>(null);
  const [decisaoQuarentenaTipo, setDecisaoQuarentenaTipo] = useState<'devolver_fornecedor' | 'liberado' | 'refugo'>('devolver_fornecedor');
  const [motivoQuarentenaDecisao, setMotivoQuarentenaDecisao] = useState('');
  const [processandoQuarentena, setProcessandoQuarentena] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState<'visao_geral' | 'alçadas' | 'reservas' | 'auditoria'>('visao_geral');
  const [filtroAuditoria, setFiltroAuditoria] = useState('');

  // 1. GUARDA ESTRITA: Exige permissão 'sistema.dono'
  if (!ehDono) {
    return <SemAcesso aoVoltar={aoNavegarParaTerminal} permissaoNecessaria="sistema.dono" />;
  }

  // Submissão da deliberação de ajuste
  const handleConfirmarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteSelecionado) return;
    setProcessandoAjuste(true);

    const resultado = await decidirAjuste(
      ajusteSelecionado.id,
      tipoDecisaoAjuste,
      justificativaAjuste
    );

    setProcessandoAjuste(false);
    if (resultado.sucesso) {
      setAjusteSelecionado(null);
      setJustificativaAjuste('');
    }
  };

  // Submissão da deliberação de quarentena
  const handleConfirmarQuarentena = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarentenaSelecionada) return;
    setProcessandoQuarentena(true);

    const resultado = await decidirQuarentena(
      quarentenaSelecionada.id,
      decisaoQuarentenaTipo,
      motivoQuarentenaDecisao
    );

    setProcessandoQuarentena(false);
    if (resultado.sucesso) {
      setQuarentenaSelecionada(null);
      setMotivoQuarentenaDecisao('');
    }
  };

  // Verifica se o Dono é o próprio solicitante (Regra de Segregação de Funções)
  const isProprioSolicitante = (ajuste: AjusteEstoquePendente) => {
    return (
      ajuste.solicitadoPorId === perfil?.id ||
      (perfil?.email.includes('dono') && (ajuste.solicitadoPorId === '00000000-0000-0000-0000-000000000001' || ajuste.solicitadoPorId === 'dono-01'))
    );
  };

  // Formatação em Reais
  const formatarBRL = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Top Banner da Diretoria */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-xs">
              <Crown className="w-3 h-3 fill-slate-950" />
              Diretoria
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Sigilo Financeiro Ativo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Torre de Controle
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Monitoramento dos 6 indicadores de fábrica, alçadas de decisão com segregação de funções e rastreabilidade total.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <button
            onClick={() => recarregarDados()}
            disabled={atualizando}
            className="px-3 py-2 rounded-xl bg-[#14283F] hover:bg-[#1a3461] border border-[#2A3F5C] text-xs font-bold text-slate-200 flex items-center gap-2 transition-all cursor-pointer"
            title="Recarregar Indicadores das Views do Banco"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00B2D6] ${atualizando ? 'animate-spin' : ''}`} />
            <span>Atualizado: {indicadores.atualizadoEm}</span>
          </button>

          {aoNavegarParaTerminal && (
            <button
              onClick={aoNavegarParaTerminal}
              className="px-3.5 py-2 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Chão de Fábrica</span>
            </button>
          )}
        </div>
      </div>

      {/* Navegação de Abas Estratégicas */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-2xs gap-2 overflow-x-auto">
        <button
          onClick={() => setAbaAtiva('visao_geral')}
          className={`py-3.5 px-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === 'visao_geral'
              ? 'border-[#00B2D6] text-slate-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-[#00B2D6]" />
          <span>6 Indicadores Críticos</span>
        </button>

        <button
          onClick={() => setAbaAtiva('alçadas')}
          className={`py-3.5 px-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === 'alçadas'
              ? 'border-[#00B2D6] text-slate-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-500" />
          <span>Fila de Decisões & Alçadas ({ajustesPendentes.filter((a) => a.status === 'pendente').length + itensQuarentena.filter((q) => q.status === 'retido').length})</span>
        </button>

        <button
          onClick={() => setAbaAtiva('reservas')}
          className={`py-3.5 px-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === 'reservas'
              ? 'border-[#00B2D6] text-slate-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Capital em Reservas Físicas</span>
        </button>

        <button
          onClick={() => setAbaAtiva('auditoria')}
          className={`py-3.5 px-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === 'auditoria'
              ? 'border-[#00B2D6] text-slate-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4 text-indigo-600" />
          <span>Auditoria</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ABA 1: OS 6 INDICADORES CRÍTICOS EM TEMPO REAL                        */}
      {/* ==================================================================== */}
      {abaAtiva === 'visao_geral' && (
        <div className="space-y-6">
          {/* Grid dos 6 Indicadores Oficiais da Arquitetura v2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Dias na Doca */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-cyan-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span className="font-mono text-cyan-800 font-bold">1. DIAS NA DOCA</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {indicadores.diasEsquadriaDoca} <span className="text-lg font-bold text-slate-500">dias</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Meta atingida (&lt; {indicadores.metaDiasDoca} dias)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tempo médio de esquadria pronta embalada na doca aguardando expedição.
                </p>
              </div>
            </div>

            {/* 2. Acurácia de Estoque Físico */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span className="font-mono text-emerald-800 font-bold">2. ACURÁCIA DE ESTOQUE</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {indicadores.acuraciaInventarioPct}%
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Acima da meta mínima ({indicadores.metaAcuraciaPct}%)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Conferência cega e ledger auditado sem divergências de contagem física.
                </p>
              </div>
            </div>

            {/* 3. Aproveitamento de Alumínio */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span className="font-mono text-blue-800 font-bold">3. APROVEITAMENTO ALUMÍNIO</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Scissors className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {indicadores.aproveitamentoAluminioPct}%
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Meta fabril: {indicadores.metaAproveitamentoPct}% (+2,85%)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cálculo de Eficiência: mm úteis ÷ mm barras e retalhos consumidos.
                </p>
              </div>
            </div>

            {/* 4. Aprovação na 1ª Inspeção */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-indigo-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span className="font-mono text-indigo-800 font-bold">4. 1ª INSPEÇÃO (QUALIDADE)</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {indicadores.aprovacaoPrimeiraInspecaoPct}%
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-indigo-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Retrabalho sob controle (3,5%)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Esquadrias aprovadas direto no checklist sem gerar nova OP de retrabalho.
                </p>
              </div>
            </div>

            {/* 5. Pedidos Parados com Prazo Excedido */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span className="font-mono text-amber-800 font-bold">5. OPS COM PRAZO EXCEDIDO</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
                  <span>{indicadores.pedidosParadosSla}</span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Atenção Imediata
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-amber-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{indicadores.pedidosParadosSla} ordem(ns) parada(s) além da meta de 3 dias</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Monitoramento de Gargalos: tempo em fila nas etapas de separação, corte e doca.
                </p>
              </div>
            </div>

            {/* 6. Capital Imobilizado em Reservas Físicas (R$) */}
            <div className="bg-white p-5 rounded-2xl border-2 border-emerald-400 bg-emerald-50/30 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                <span className="font-mono text-emerald-900 font-extrabold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  6. CAPITAL EM RESERVA (R$)
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-emerald-800 tracking-tight">
                  {formatarBRL(indicadores.capitalReservaReais)}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Dado Confidencial • Exclusivo Diretoria</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Inventário Bloqueado: perfis e vidros alocados em obras ativas.
                </p>
              </div>
            </div>
          </div>

          {/* Seção de Pedidos e Ordens de Produção em Atraso */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-amber-500" />
                  Gargalos & Ordens de Produção em Atraso
                </h3>
                <p className="text-xs text-slate-500">
                  Ordens de produção paradas além do prazo limite estipulado no fluxo fabril
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                {pedidosParados.length} ocorrências ativas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pedidosParados.map((ped) => (
                <div
                  key={ped.numeroOp}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[#12264A] text-white">
                        {ped.numeroOp}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{ped.codigoEsquadria}</span>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        ped.nivelCriticidade === 'urgente'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {ped.nivelCriticidade}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    <strong>Obra:</strong> {ped.obraDestino}
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">{ped.motivoGargalo}</div>
                      <div className="text-[11px] text-amber-700 mt-0.5 font-mono">
                        Parado há {ped.diasParado} dias (Prazo Limite: {ped.slaDiasMaximo} dias) • Estágio Atual: {ped.estadoAtual}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: FILA DE DECISÕES, ALÇADAS E SEGREGAÇÃO DE FUNÇÕES             */}
      {/* ==================================================================== */}
      {abaAtiva === 'alçadas' && (
        <div className="space-y-6">
          {/* Alerta de Segregação de Funções */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-sm text-blue-950">
                Regra de Governança Fabril: Segregação Estrita de Funções
              </div>
              <p className="mt-1 leading-relaxed">
                Por compliance e integridade contábil, o Dono/Diretor <strong>não pode aprovar ajustes de estoque solicitados por ele próprio</strong>. Ajustes de alto valor solicitados pela diretoria exigem aprovação cruzada (segundo administrador ou conselho).
              </p>
            </div>
          </div>

          {/* Fila de Ajustes de Estoque Pendentes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-500" />
                  Ajustes Manuais Acima da Alçada (&gt; R$ 500,00)
                </h3>
                <p className="text-xs text-slate-500">
                  Deliberação obrigatória com registro em auditoria imutável
                </p>
              </div>
              <span className="text-xs font-mono bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md font-bold">
                {ajustesPendentes.filter((a) => a.status === 'pendente').length} pendentes
              </span>
            </div>

            <div className="space-y-3">
              {ajustesPendentes.map((ajuste) => {
                const ehProprio = isProprioSolicitante(ajuste);
                const deliberado = ajuste.status !== 'pendente';

                return (
                  <div
                    key={ajuste.id}
                    className={`p-4 rounded-xl border transition-all ${
                      deliberado
                        ? ajuste.status === 'aprovado'
                          ? 'border-emerald-200 bg-emerald-50/30 opacity-75'
                          : 'border-rose-200 bg-rose-50/30 opacity-75'
                        : 'border-slate-200 bg-white hover:border-cyan-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {ajuste.itemCodigo}
                        </span>
                        <span className="text-xs font-bold text-slate-700">{ajuste.descricao}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {ajuste.tipoAjuste}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                          {formatarBRL(ajuste.valorTotalEstimado)}
                        </span>
                        {deliberado ? (
                          <span
                            className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                              ajuste.status === 'aprovado'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {ajuste.status}
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Aguardando Decisão
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="py-2.5 text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Motivo Operacional:</strong> {ajuste.motivo}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-mono mt-1">
                        <span>Quantidade: {ajuste.quantidade} {ajuste.unidade}</span>
                        <span>Custo Unitário: {formatarBRL(ajuste.custoUnitarioEstimado)}</span>
                        <span>Solicitante: {ajuste.solicitadoPorNome} ({ajuste.solicitadoEm})</span>
                      </div>
                    </div>

                    {/* Ações e Alerta de Segregação */}
                    {!deliberado && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        {ehProprio ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                            <UserX className="w-4 h-4 shrink-0" />
                            <span>
                              Bloqueio de Segregação: Você é o solicitante deste ajuste. Não é permitido auto-aprovar.
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            A deliberação atualizará o saldo físico no ledger e notificará a fábrica.
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            disabled={ehProprio}
                            onClick={() => {
                              setAjusteSelecionado(ajuste);
                              setTipoDecisaoAjuste('rejeitado');
                              setJustificativaAjuste('Ajuste não justificado; recontagem física exigida.');
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                              ehProprio
                                ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                                : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejeitar</span>
                          </button>

                          <button
                            disabled={ehProprio}
                            onClick={() => {
                              setAjusteSelecionado(ajuste);
                              setTipoDecisaoAjuste('aprovado');
                              setJustificativaAjuste('Ajuste auditado e conferido conforme evidências operacionais.');
                            }}
                            className={`px-4 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer ${
                              ehProprio
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aprovar Ajuste</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fila de Decisões de Quarentena (Devolução ao Fornecedor) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  Devoluções e Resoluções de Quarentena
                </h3>
                <p className="text-xs text-slate-500">
                  Deliberação formal e destinação de materiais retidos na Gaiola de Quarentena
                </p>
              </div>
              <span className="text-xs font-mono bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-md font-bold">
                {itensQuarentena.filter((q) => q.status === 'retido').length} retidos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {itensQuarentena.map((quar) => {
                const deliberado = quar.status !== 'retido';

                return (
                  <div
                    key={quar.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      deliberado
                        ? 'border-slate-200 bg-slate-50 opacity-75'
                        : 'border-slate-200 bg-white hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-100">
                          {quar.numeroNf}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{quar.sku}</span>
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          quar.status === 'retido'
                            ? 'bg-amber-100 text-amber-800'
                            : quar.status === 'devolver_fornecedor'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {quar.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Fornecedor:</strong> {quar.fornecedor} • <strong>Quantidade:</strong> {quar.quantidade}
                      </p>
                      <p className="text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <strong>Motivo da Retenção:</strong> {quar.motivoDivergencia}
                      </p>
                    </div>

                    {!deliberado && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setQuarentenaSelecionada(quar);
                            setDecisaoQuarentenaTipo('devolver_fornecedor');
                            setMotivoQuarentenaDecisao('Lote fora das especificações técnicas. Emitir nota de devolução e solicitar reposição urgente.');
                          }}
                          className="px-3 py-1.5 text-xs font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Aprovar Devolução ao Fornecedor</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: CAPITAL IMOBILIZADO EM RESERVAS FÍSICAS                       */}
      {/* ==================================================================== */}
      {abaAtiva === 'reservas' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Valoração de Reservas Físicas Antigas
                </h3>
                <p className="text-xs text-slate-500">
                  Perfis e insumos bloqueados para obras paradas — capital imobilizado que pode ser liberado para outras OPs
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 px-4 py-2 rounded-xl text-right">
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                  Total Imobilizado
                </span>
                <span className="text-lg font-black text-emerald-900">
                  {formatarBRL(
                    reservasFisicas.reduce((acc, curr) => acc + curr.valorTotalReais, 0)
                  )}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                    <th className="py-3 px-3">Obra Destino</th>
                    <th className="py-3 px-3">Item / Perfil</th>
                    <th className="py-3 px-3">Endereço Físico Humano</th>
                    <th className="py-3 px-3 text-right">Quantidade</th>
                    <th className="py-3 px-3 text-right">Unitário (R$)</th>
                    <th className="py-3 px-3 text-right font-black text-slate-900">Total (R$)</th>
                    <th className="py-3 px-3 text-center">Dias Parado</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservasFisicas.map((res, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{res.obra}</td>
                      <td className="py-3 px-3 font-mono text-cyan-800 font-semibold">{res.itemCodigo}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                          {res.localNome}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {res.quantidadeReservada} {res.unidade}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {formatarBRL(res.valorUnitarioReais)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                        {formatarBRL(res.valorTotalReais)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {res.diasEmReserva} dias
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            res.statusReserva === 'critica'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {res.statusReserva}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4: AUDITORIA DO LEDGER IMUTÁVEL (APPEND-ONLY)                     */}
      {/* ==================================================================== */}
      {abaAtiva === 'auditoria' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Histórico de Auditoria
                </h3>
                <p className="text-xs text-slate-500">
                  Registro append-only inviolável de todas as movimentações, deliberações e estornos com identificação do usuário
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar por evento ou usuário..."
                  value={filtroAuditoria}
                  onChange={(e) => setFiltroAuditoria(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {historicoAuditoria
                .filter(
                  (a) =>
                    a.evento.toLowerCase().includes(filtroAuditoria.toLowerCase()) ||
                    a.operadorNome.toLowerCase().includes(filtroAuditoria.toLowerCase()) ||
                    a.descricao.toLowerCase().includes(filtroAuditoria.toLowerCase())
                )
                .map((aud) => (
                  <div
                    key={aud.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                          {aud.dataHora}
                        </span>
                        <span className="font-mono text-xs font-black text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                          {aud.evento}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          Operador: {aud.operadorNome} ({aud.operadorPapel})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{aud.descricao}</p>
                    </div>

                    {aud.valorEstimado && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Impacto</span>
                        <span className="text-xs font-black text-emerald-700 font-mono">
                          {formatarBRL(aud.valorEstimado)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELIBERAÇÃO DE AJUSTE DE ESTOQUE                              */}
      {/* ==================================================================== */}
      {ajusteSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#12264A] text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#00B2D6] tracking-wider font-mono">
                  Deliberação de Alçada
                </span>
                <h3 className="text-base font-extrabold text-white">
                  {tipoDecisaoAjuste === 'aprovado' ? 'Aprovar Ajuste de Estoque' : 'Rejeitar Ajuste de Estoque'}
                </h3>
              </div>
              <button
                onClick={() => setAjusteSelecionado(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarAjuste} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{ajusteSelecionado.itemCodigo}</span>
                  <span className="text-emerald-700 font-black">
                    {formatarBRL(ajusteSelecionado.valorTotalEstimado)}
                  </span>
                </div>
                <p className="text-slate-600">{ajusteSelecionado.descricao}</p>
                <p className="text-[11px] text-slate-500 font-mono pt-1">
                  Motivo Operacional: {ajusteSelecionado.motivo}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Justificativa Obrigatória da Diretoria (Mínimo 5 caracteres):
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={justificativaAjuste}
                  onChange={(e) => setJustificativaAjuste(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                  placeholder="Descreva a fundamentação técnica e contábil da sua decisão..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAjusteSelecionado(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAjuste}
                  className={`px-5 py-2 text-xs font-black text-white rounded-xl shadow-md flex items-center gap-2 cursor-pointer ${
                    tipoDecisaoAjuste === 'aprovado'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {processandoAjuste ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Confirmar {tipoDecisaoAjuste === 'aprovado' ? 'Aprovação' : 'Rejeição'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELIBERAÇÃO DE RESOLUÇÃO DE QUARENTENA                        */}
      {/* ==================================================================== */}
      {quarentenaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#12264A] text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#00B2D6] tracking-wider font-mono">
                  Deliberação de Quarentena
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Devolução ou Destino do Lote
                </h3>
              </div>
              <button
                onClick={() => setQuarentenaSelecionada(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarQuarentena} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="font-bold text-slate-900">
                  NF {quarentenaSelecionada.numeroNf} • SKU {quarentenaSelecionada.sku}
                </div>
                <p className="text-slate-600">Fornecedor: {quarentenaSelecionada.fornecedor}</p>
                <p className="text-rose-700 font-medium">Motivo: {quarentenaSelecionada.motivoDivergencia}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Decisão a ser Aplicada:
                </label>
                <select
                  value={decisaoQuarentenaTipo}
                  onChange={(e) => setDecisaoQuarentenaTipo(e.target.value as any)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white font-bold"
                >
                  <option value="devolver_fornecedor">Devolver ao Fornecedor (Emitir NF Devolução)</option>
                  <option value="liberado">Liberar com Ressalva (Uso em Obra Específica)</option>
                  <option value="refugo">Descartar para Refugo / Sucata</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Parecer / Motivo da Decisão (Mínimo 5 caracteres):
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={motivoQuarentenaDecisao}
                  onChange={(e) => setMotivoQuarentenaDecisao(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuarentenaSelecionada(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoQuarentena}
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {processandoQuarentena ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Registrar Deliberação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
