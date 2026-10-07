// ============================================================================
// PAGE: src/pages/Qualidade.tsx
// Triagem 3: Inspeção Técnica de Qualidade, Checklist e Gestão de Retrabalhos
// Alerta Crítico ao Dono na 2ª Reprovação Consecutiva • Transição Rígida para Doca
// ============================================================================

import React, { useState } from 'react';
import { useFase3Data, EsquadriaItem, ChecklistQualidade } from '../hooks/useFase3Data';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Search,
  Sparkles,
  ArrowRight,
  Truck,
  Check,
  Layers,
  FileText,
} from 'lucide-react';

interface QualidadeProps {
  aoNavegarParaExpedicao?: () => void;
}

export const Qualidade: React.FC<QualidadeProps> = ({ aoNavegarParaExpedicao }) => {
  const { esquadrias, registrarInspecao } = useFase3Data();
  const [esquadriaSelecionada, setEsquadriaSelecionada] = useState<EsquadriaItem | null>(null);
  const [modalReprovacaoAberto, setModalReprovacaoAberto] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'retrabalho' | 'aprovadas'>('pendentes');

  // Estado do checklist técnico da peça selecionada
  const [checklist, setChecklist] = useState<ChecklistQualidade>({
    esquadro: true,
    vedacao_epdm: true,
    roldanas: true,
    pelicula_protetora: true,
  });

  const selecionarPecaParaInspecao = (item: EsquadriaItem) => {
    setEsquadriaSelecionada(item);
    setChecklist({
      esquadro: true,
      vedacao_epdm: true,
      roldanas: true,
      pelicula_protetora: true,
    });
  };

  const handleAprovar = async () => {
    if (!esquadriaSelecionada) return;
    await registrarInspecao(esquadriaSelecionada.id, checklist, 'aprovado');
    setEsquadriaSelecionada(null);
  };

  const handleAbrirReprovacao = () => {
    if (!esquadriaSelecionada) return;
    setMotivoReprovacao(
      !checklist.esquadro
        ? 'Fora de esquadro na medição diagonal com trena laser.'
        : !checklist.vedacao_epdm
        ? 'Borracha de vedação EPDM desencaixada ou mordida no canto.'
        : !checklist.roldanas
        ? 'Roldana emperrada ou sem rolamento suave no trilho.'
        : 'Película protetora ausente ou perfil riscado.'
    );
    setModalReprovacaoAberto(true);
  };

  const handleConfirmarReprovacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esquadriaSelecionada) return;
    await registrarInspecao(esquadriaSelecionada.id, checklist, 'reprovado', motivoReprovacao);
    setModalReprovacaoAberto(false);
    setEsquadriaSelecionada(null);
    setMotivoReprovacao('');
  };

  const pecasFiltradas = esquadrias.filter((e) => {
    if (filtro === 'pendentes') return e.status === 'em_inspecao';
    if (filtro === 'retrabalho') return e.status === 'retrabalho';
    if (filtro === 'aprovadas') return ['aprovado', 'na_doca', 'carregado', 'entregue'].includes(e.status);
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Top Banner Operacional */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500 text-white font-mono flex items-center gap-1.5 shadow-xs">
              <ClipboardCheck className="w-3.5 h-3.5" />
              Triagem 3 (Qualidade)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Controle Dimensional & Checklist Técnico
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Inspeção Técnica de Esquadrias
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mt-0.5">
            Liberação rigorosa de peças para a doca de expedição. A aprovação exige 100% dos quesitos de qualidade. A 2ª reprovação consecutiva aciona a Diretoria.
          </p>
        </div>

        {aoNavegarParaExpedicao && (
          <button
            onClick={aoNavegarParaExpedicao}
            className="px-4 py-2.5 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all self-start md:self-center"
          >
            <Truck className="w-4 h-4" />
            <span>Ir para Carregamento na Doca</span>
          </button>
        )}
      </div>

      {/* Grid de Trabalho: Seleção de Peças e Painel de Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Fila de Esquadrias (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 font-mono">
                Fila de Peças da Fábrica
              </h3>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {pecasFiltradas.length} peças
              </span>
            </div>

            {/* Filtros */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(['pendentes', 'retrabalho', 'aprovadas', 'todas'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filtro === f
                      ? 'bg-[#12264A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'pendentes'
                    ? 'Aguardando'
                    : f === 'retrabalho'
                    ? 'Retrabalho'
                    : f === 'aprovadas'
                    ? 'Aprovadas'
                    : 'Todas'}
                </button>
              ))}
            </div>

            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {pecasFiltradas.map((peca) => {
                const selecionada = esquadriaSelecionada?.id === peca.id;
                const alertaCritico = peca.reprovacoesConsecutivas >= 1;

                return (
                  <div
                    key={peca.id}
                    onClick={() => selecionarPecaParaInspecao(peca)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selecionada
                        ? 'border-[#00B2D6] bg-cyan-50/50 shadow-md ring-2 ring-[#00B2D6]/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[#12264A] text-white">
                          {peca.serial}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {peca.codigoTipologia}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          peca.status === 'em_inspecao'
                            ? 'bg-amber-100 text-amber-800'
                            : peca.status === 'retrabalho'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {peca.status === 'em_inspecao'
                          ? 'Aguardando'
                          : peca.status === 'retrabalho'
                          ? 'Retrabalho'
                          : 'Aprovada'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-1.5">
                      <div className="font-medium text-slate-800">{peca.descricao}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Obra: {peca.obraDestino} ({peca.pedidoNumero})
                      </div>
                    </div>

                    {alertaCritico && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          {peca.reprovacoesConsecutivas === 1
                            ? '1ª Reprovação registrada — nova falha acionará o Dono!'
                            : `${peca.reprovacoesConsecutivas}ª Reprovação consecutiva — Diretoria Notificada!`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Checklist Técnico e Decisão (7 colunas) */}
        <div className="lg:col-span-7">
          {esquadriaSelecionada ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      Inspecionando Peça
                    </span>
                    <h2 className="text-xl font-black text-slate-900 mt-1">
                      {esquadriaSelecionada.serial} — {esquadriaSelecionada.codigoTipologia}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      {esquadriaSelecionada.descricao} • Obra: {esquadriaSelecionada.obraDestino}
                    </p>
                  </div>

                  {esquadriaSelecionada.reprovacoesConsecutivas >= 1 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-right">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                        Histórico Crítico
                      </div>
                      <div className="text-xs font-bold mt-0.5">
                        {esquadriaSelecionada.reprovacoesConsecutivas} falha(s) anterior(es)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist com Switches / Checkboxes Táteis de 56px */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                  Checklist Técnico Obrigatório (NBR 10821 / 14698)
                </h3>

                {/* Item 1: Esquadro e Diagonais */}
                <div
                  onClick={() => setChecklist((prev) => ({ ...prev, esquadro: !prev.esquadro }))}
                  className={`min-h-[56px] p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    checklist.esquadro
                      ? 'border-emerald-300 bg-emerald-50/40 text-slate-900'
                      : 'border-rose-300 bg-rose-50/50 text-rose-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black flex items-center gap-2">
                      <span>1. Esquadro e Diagonais</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        (Diferença entre diagonais &le; 1,5 mm)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Conferido com trena milimétrica nos cantos soldados/crimpadora.
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      checklist.esquadro ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {checklist.esquadro ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                </div>

                {/* Item 2: Vedação EPDM */}
                <div
                  onClick={() => setChecklist((prev) => ({ ...prev, vedacao_epdm: !prev.vedacao_epdm }))}
                  className={`min-h-[56px] p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    checklist.vedacao_epdm
                      ? 'border-emerald-300 bg-emerald-50/40 text-slate-900'
                      : 'border-rose-300 bg-rose-50/50 text-rose-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black flex items-center gap-2">
                      <span>2. Vedação EPDM e Guarnições</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        (Vedação perimétrica estanque)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Borrachas assentadas nos canais sem estiramento ou dobras.
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      checklist.vedacao_epdm ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {checklist.vedacao_epdm ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                </div>

                {/* Item 3: Roldanas e Deslizamento */}
                <div
                  onClick={() => setChecklist((prev) => ({ ...prev, roldanas: !prev.roldanas }))}
                  className={`min-h-[56px] p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    checklist.roldanas
                      ? 'border-emerald-300 bg-emerald-50/40 text-slate-900'
                      : 'border-rose-300 bg-rose-50/50 text-rose-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black flex items-center gap-2">
                      <span>3. Roldanas e Articulações</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        (Regulagem e rolamento com esferas)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Deslizamento suave sem arrasto ou rangido na guia inferior.
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      checklist.roldanas ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {checklist.roldanas ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                </div>

                {/* Item 4: Película Protetora e Acabamento */}
                <div
                  onClick={() => setChecklist((prev) => ({ ...prev, pelicula_protetora: !prev.pelicula_protetora }))}
                  className={`min-h-[56px] p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    checklist.pelicula_protetora
                      ? 'border-emerald-300 bg-emerald-50/40 text-slate-900'
                      : 'border-rose-300 bg-rose-50/50 text-rose-900'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black flex items-center gap-2">
                      <span>4. Película Protetora e Pintura</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">
                        (Zero riscos ou manchas na pintura eletrostática)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Filme protetor de PVC aplicado para resguardo no transporte.
                    </div>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      checklist.pelicula_protetora ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {checklist.pelicula_protetora ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Botões de Ação Táteis (min-h-[56px]) */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleAbrirReprovacao}
                  className="min-h-[56px] flex-1 px-4 py-3 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Reprovar e Gerar OP de Retrabalho</span>
                </button>

                <button
                  type="button"
                  onClick={handleAprovar}
                  className="min-h-[56px] flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-98"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Aprovar Peça para Doca</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[350px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <ClipboardCheck className="w-12 h-12 text-slate-400 mb-3" />
              <h3 className="font-bold text-slate-700 text-base">Nenhuma Peça Selecionada</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Selecione uma esquadria na fila à esquerda para executar o checklist técnico e registrar a liberação.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reprovação com Justificativa Obrigatória */}
      {modalReprovacaoAberto && esquadriaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-rose-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider font-mono">
                  Não Conformidade Técnica
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Reprovação de Esquadria
                </h3>
              </div>
              <button
                onClick={() => setModalReprovacaoAberto(false)}
                className="text-rose-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarReprovacao} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <div className="font-bold">
                  Serial: {esquadriaSelecionada.serial} ({esquadriaSelecionada.codigoTipologia})
                </div>
                <p>Esta ação transicionará a peça para o setor de retrabalho e gerará uma nova OP de correção.</p>
                {esquadriaSelecionada.reprovacoesConsecutivas >= 1 && (
                  <div className="font-black text-rose-700 pt-1 border-t border-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>ATENÇÃO: 2ª reprovação consecutiva! Uma notificação crítica será emitida para o Dono.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo da Reprovação (Mínimo 5 caracteres):
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={motivoReprovacao}
                  onChange={(e) => setMotivoReprovacao(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-rose-500 bg-white"
                  placeholder="Descreva a não conformidade para orientar o operador de retrabalho..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalReprovacaoAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirmar Reprovação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
