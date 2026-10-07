// ============================================================================
// PAGE: src/pages/Expedicao.tsx
// Triagem 4: Carregamento na Doca, Bipagem de Serial e Bloqueio com Alerta em Tela Cheia
// Alerta Sonoro Nativo Web Audio API • Bloqueio Visual Vermelho de Embarque Divergente
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useFase3Data, PedidoExpedicao } from '../hooks/useFase3Data';
import {
  Truck,
  Barcode,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  Package,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  FileCheck,
  Lock,
} from 'lucide-react';

interface ExpedicaoProps {
  aoNavegarParaQualidade?: () => void;
}

export const Expedicao: React.FC<ExpedicaoProps> = ({ aoNavegarParaQualidade }) => {
  const { pedidos, esquadrias, validarBipagemSerial, finalizarExpedicao } = useFase3Data();
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<string>(
    pedidos.find((p) => p.status === 'na_doca')?.id || pedidos[0]?.id || ''
  );

  const [serialDigitado, setSerialDigitado] = useState('');
  const [bloqueioTelaCheia, setBloqueioTelaCheia] = useState<{
    ativo: boolean;
    motivo: string;
    serial: string;
  } | null>(null);

  const [historicoBipagens, setHistoricoBipagens] = useState<
    { serial: string; sucesso: boolean; mensagem: string; hora: string }[]
  >([]);

  const inputSerialRef = useRef<HTMLInputElement>(null);

  // Manter foco automático no campo de bipagem para pistolas óticas / leitores laser
  useEffect(() => {
    if (!bloqueioTelaCheia?.ativo) {
      inputSerialRef.current?.focus();
    }
  }, [bloqueioTelaCheia, pedidoSelecionadoId]);

  const pedidoAtual = pedidos.find((p) => p.id === pedidoSelecionadoId);
  const pecasDoPedido = esquadrias.filter((e) => e.pedidoId === pedidoSelecionadoId);
  const pecasCarregadasCount = pecasDoPedido.filter((e) => e.status === 'carregado').length;
  const totalPecasCount = pecasDoPedido.length;
  const podeFinalizar = totalPecasCount > 0 && pecasCarregadasCount === totalPecasCount;

  const handleBiparSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialDigitado.trim() || !pedidoSelecionadoId) return;

    const serial = serialDigitado.trim().toUpperCase();
    setSerialDigitado('');

    const resultado = await validarBipagemSerial(pedidoSelecionadoId, serial);

    const novoHistorico = {
      serial,
      sucesso: resultado.sucesso,
      mensagem: resultado.sucesso
        ? resultado.mensagem || 'Peça autorizada para carregamento.'
        : resultado.motivo || 'Embarque bloqueado.',
      hora: new Date().toLocaleTimeString('pt-BR'),
    };

    setHistoricoBipagens((prev) => [novoHistorico, ...prev.slice(0, 19)]);

    if (!resultado.sucesso && resultado.bloqueio) {
      // ATIVAR ALERTA VISUAL EM TELA CHEIA VERMELHA
      setBloqueioTelaCheia({
        ativo: true,
        motivo: resultado.motivo || 'Bloqueio de Carregamento por Divergência Operacional.',
        serial,
      });
    }
  };

  const handleDispensarBloqueio = () => {
    setBloqueioTelaCheia(null);
    setTimeout(() => {
      inputSerialRef.current?.focus();
    }, 100);
  };

  const handleFinalizarCarga = async () => {
    if (!pedidoSelecionadoId) return;
    await finalizarExpedicao(pedidoSelecionadoId, 'Canhoto_Assinado_Expedicao.pdf');
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* ==================================================================== */}
      {/* ALERTA EM TELA CHEIA VERMELHA DE BLOQUEIO FÍSICO / DIVERGÊNCIA       */}
      {/* ==================================================================== */}
      {bloqueioTelaCheia?.ativo && (
        <div className="fixed inset-0 z-50 bg-rose-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-100">
          <div className="w-24 h-24 rounded-3xl bg-rose-600/40 border-4 border-rose-500 text-rose-200 flex items-center justify-center mb-6 shadow-2xl animate-pulse">
            <AlertOctagon className="w-14 h-14" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-900 border border-rose-500 text-rose-200 text-xs font-mono font-black mb-4 tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            BLOQUEIO DE EMBARQUE NA DOCA
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl leading-tight">
            EMBARQUE DIVERGENTE RECUSADO
          </h1>

          <div className="mt-4 p-4 rounded-2xl bg-rose-900/60 border border-rose-700 text-rose-100 max-w-xl text-base sm:text-lg font-medium">
            <div className="font-mono font-black text-rose-300 text-xl sm:text-2xl mb-1">
              SERIAL: {bloqueioTelaCheia.serial}
            </div>
            <p className="mt-2 text-rose-100 font-semibold">{bloqueioTelaCheia.motivo}</p>
          </div>

          <p className="text-sm text-rose-300 mt-4 max-w-md">
            O leitor detectou peça não autorizada para este veículo. Não embarque este volume!
          </p>

          <button
            onClick={handleDispensarBloqueio}
            className="mt-8 min-h-[64px] px-8 py-4 rounded-2xl bg-white hover:bg-rose-100 text-rose-950 font-black text-sm sm:text-base flex items-center gap-3 shadow-2xl cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw className="w-6 h-6 text-rose-600" />
            <span>REMOVER PEÇA DIVERGENTE DO VEÍCULO / RETOMAR BIPAGEM</span>
          </button>
        </div>
      )}

      {/* Top Banner Operacional */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 font-mono flex items-center gap-1.5 shadow-xs">
              <Truck className="w-3.5 h-3.5" />
              Triagem 4 (Expedição)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Bipagem de Serial em Tempo Real • Doca Blindada
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Carregamento e Liberação na Doca
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mt-0.5">
            Conferência física com leitor óptico. Peças de outras obras ou reprovadas na inspeção disparam alerta sonoro e bloqueio em tela cheia.
          </p>
        </div>

        {aoNavegarParaQualidade && (
          <button
            onClick={aoNavegarParaQualidade}
            className="px-4 py-2.5 rounded-xl bg-[#14283F] hover:bg-[#1a3461] border border-[#2A3F5C] text-slate-200 font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all self-start md:self-center"
          >
            <span>Ver Fila da Qualidade</span>
            <ArrowRight className="w-4 h-4 text-[#00B2D6]" />
          </button>
        )}
      </div>

      {/* Grid de Operação na Doca */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Central de Bipagem (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Seleção do Pedido em Carregamento */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 font-mono">
                  1. Pedido em Carregamento no Veículo
                </label>
                <select
                  value={pedidoSelecionadoId}
                  onChange={(e) => setPedidoSelecionadoId(e.target.value)}
                  className="mt-1 w-full sm:w-auto min-h-[48px] px-3.5 py-2 text-xs font-black rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                >
                  {pedidos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numeroPedido} — {p.obraDestino} ({p.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {pedidoAtual && (
                <div className="bg-cyan-50 border border-cyan-200 px-4 py-2 rounded-xl text-right">
                  <span className="text-[10px] font-black uppercase text-cyan-800 tracking-wider block">
                    Progresso do Embarque
                  </span>
                  <span className="text-lg font-black text-cyan-950 font-mono">
                    {pecasCarregadasCount} / {totalPecasCount} peças
                  </span>
                </div>
              )}
            </div>

            {/* Caixa de Entrada de Bipagem Sequencial (min-h-[56px]) */}
            <form onSubmit={handleBiparSerial} className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                2. Bipagem Sequencial de Serial (Pistola Laser ou Teclado):
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    ref={inputSerialRef}
                    type="text"
                    required
                    placeholder="Bipe ou digite o serial (ex: SN-ALPHA-001) e pressione Enter..."
                    value={serialDigitado}
                    onChange={(e) => setSerialDigitado(e.target.value)}
                    className="w-full min-h-[56px] pl-11 pr-4 text-sm font-mono font-bold rounded-xl border-2 border-slate-300 focus:border-[#00B2D6] focus:outline-none bg-slate-50 focus:bg-white transition-all uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[56px] px-6 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>Validar Peça</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Pressione Enter após bipar. O leitor laser envia o caractere de retorno automaticamente.
              </p>
            </form>
          </div>

          {/* Histórico Recente de Bipagens no Turno */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 font-mono">
              Feed de Bipagens Recentes na Doca
            </h3>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {historicoBipagens.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  Aguardando primeira leitura de serial...
                </div>
              ) : (
                historicoBipagens.map((h, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      h.sucesso
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-950'
                        : 'border-rose-300 bg-rose-50/60 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {h.sucesso ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-black">{h.serial}</span>: {h.mensagem}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">{h.hora}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Painel Lateral: Checklist das Peças do Pedido & Finalização (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 font-mono">
                  Peças do Pedido
                </h3>
                <div className="font-extrabold text-sm text-slate-900 mt-0.5">
                  {pedidoAtual?.obraDestino}
                </div>
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  podeFinalizar
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {podeFinalizar ? 'Pronto p/ Saída' : 'Carregando'}
              </span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {pecasDoPedido.map((peca) => {
                const carregada = peca.status === 'carregado';
                return (
                  <div
                    key={peca.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      carregada
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-1.5 py-0.2 rounded bg-[#12264A] text-white">
                          {peca.serial}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {peca.codigoTipologia}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{peca.descricao}</div>
                    </div>

                    <div className="shrink-0">
                      {carregada ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Carregado
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ação de Finalizar Expedição */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                disabled={!podeFinalizar}
                onClick={handleFinalizarCarga}
                className={`w-full min-h-[56px] px-4 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all ${
                  podeFinalizar
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <FileCheck className="w-5 h-5" />
                <span>
                  {podeFinalizar
                    ? 'Finalizar Expedição e Liberar Veículo'
                    : `Bipe todas as ${totalPecasCount} peças para finalizar`}
                </span>
              </button>

              <p className="text-[11px] text-center text-slate-500 font-mono">
                A finalização baixa o saldo da doca no ledger imutável e transiciona o pedido para "Entregue".
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
