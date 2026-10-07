// ============================================================================
// PAGE: src/pages/Ferramentas.tsx
// Módulo de Ferramental Fabril, Ativos e Controle de Empréstimos
// Destaque Visual para Itens Vencidos • Ações Táteis
// ============================================================================

import React, { useState } from 'react';
import { useFase3Data, FerramentaAtivo } from '../hooks/useFase3Data';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RotateCcw,
  Plus,
  Search,
  Building,
  User,
  ShieldCheck,
  Calendar,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';

export const Ferramentas: React.FC = () => {
  const { ferramentas, devolverFerramenta, emprestarFerramenta } = useFase3Data();
  const [filtro, setFiltro] = useState<'todas' | 'vencidas' | 'emprestadas' | 'disponiveis'>('todas');
  const [busca, setBusca] = useState('');

  // Estado do Modal de Novo Empréstimo
  const [modalEmprestimoAberto, setModalEmprestimoAberto] = useState(false);
  const [ferramentaSelecionadaId, setFerramentaSelecionadaId] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [obraNome, setObraNome] = useState('Bancada Montagem 1');

  const ferramentasFiltradas = ferramentas.filter((f) => {
    const combinaBusca =
      f.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      f.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      (f.responsavelAtual && f.responsavelAtual.toLowerCase().includes(busca.toLowerCase()));

    if (!combinaBusca) return false;
    if (filtro === 'vencidas') return f.estaVencida;
    if (filtro === 'emprestadas') return f.status === 'emprestado';
    if (filtro === 'disponiveis') return f.status === 'disponivel';
    return true;
  });

  const ferramentasVencidas = ferramentas.filter((f) => f.estaVencida);
  const ferramentasDisponiveis = ferramentas.filter((f) => f.status === 'disponivel');

  const handleSubmeterEmprestimo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ferramentaSelecionadaId || !responsavelNome.trim()) return;

    emprestarFerramenta(ferramentaSelecionadaId, responsavelNome.trim(), obraNome);
    setModalEmprestimoAberto(false);
    setResponsavelNome('');
    setFerramentaSelecionadaId('');
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Top Banner do Módulo */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 font-mono flex items-center gap-1.5 shadow-xs">
              <Wrench className="w-3.5 h-3.5" />
              Módulo de Ferramental
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Gabaritos, Ferramentas Pneumáticas e Calibração
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Controle de Ferramentas e Ativos
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mt-0.5">
            Rastreabilidade de ferramentas especiais em uso no chão de fábrica e obras. Alerta imediato para itens com prazo de devolução vencido.
          </p>
        </div>

        <button
          onClick={() => {
            setFerramentaSelecionadaId(ferramentasDisponiveis[0]?.id || '');
            setModalEmprestimoAberto(true);
          }}
          disabled={ferramentasDisponiveis.length === 0}
          className={`min-h-[48px] px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all self-start md:self-center ${
            ferramentasDisponiveis.length > 0
              ? 'bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 active:scale-98'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Empréstimo</span>
        </button>
      </div>

      {/* Destaque Alerta: Ferramentas Vencidas */}
      {ferramentasVencidas.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-900 font-mono">
                Alerta de Ferramentas com Devolução Atrasada
              </div>
              <p className="text-xs text-amber-900 mt-0.5 font-medium">
                Existem <strong>{ferramentasVencidas.length} ferramentas</strong> retidas além do prazo previsto na fábrica. Solicite devolução imediata para não paralisar outras linhas de montagem.
              </p>
            </div>
          </div>

          <button
            onClick={() => setFiltro('vencidas')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0 cursor-pointer transition-colors"
          >
            Filtrar Apenas Atrasadas
          </button>
        </div>
      )}

      {/* Filtros e Barra de Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['todas', 'vencidas', 'emprestadas', 'disponiveis'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filtro === f
                  ? 'bg-[#12264A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'todas'
                ? 'Todos os Ativos'
                : f === 'vencidas'
                ? `Vencidas (${ferramentasVencidas.length})`
                : f === 'emprestadas'
                ? 'Em Uso'
                : 'Disponíveis'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por código, ferramenta ou operador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
          />
        </div>
      </div>

      {/* Cards de Ferramentas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ferramentasFiltradas.map((ferr) => {
          const ehVencida = ferr.estaVencida;
          const ehEmprestada = ferr.status === 'emprestado';

          return (
            <div
              key={ferr.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                ehVencida
                  ? 'border-amber-400 bg-amber-50/40 shadow-sm ring-1 ring-amber-300'
                  : ehEmprestada
                  ? 'border-blue-200 bg-blue-50/20 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-cyan-300 shadow-2xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded bg-[#12264A] text-white">
                    {ferr.codigo}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      ehVencida
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : ferr.status === 'disponivel'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ferr.status === 'emprestado'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ehVencida
                      ? 'Prazo Expirado'
                      : ferr.status === 'disponivel'
                      ? 'Disponível'
                      : ferr.status === 'emprestado'
                      ? 'Em Uso'
                      : 'Manutenção'}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                    {ferr.descricao}
                  </h3>
                  {ferr.calibracaoValidade && (
                    <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Calibração válida até: {ferr.calibracaoValidade}</span>
                    </div>
                  )}
                </div>

                {ehEmprestada && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      ehVencida
                        ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                      <span>Responsável: {ferr.responsavelAtual}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Building className="w-3 h-3 text-slate-400" />
                      <span>Local/Obra: {ferr.obraAtual}</span>
                    </div>

                    {ehVencida && (
                      <div className="font-black text-rose-700 text-[11px] pt-1 border-t border-amber-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-rose-600" />
                        <span>Atraso: {ferr.horasAtraso} horas além da previsão!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botão de Devolução Rápida (min-h-[48px]) */}
              <div className="pt-4 mt-3 border-t border-slate-100">
                {ehEmprestada ? (
                  <button
                    type="button"
                    onClick={() => devolverFerramenta(ferr.id)}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#12264A] hover:bg-[#1a3461] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <RotateCcw className="w-4 h-4 text-[#00B2D6]" />
                    <span>Registrar Devolução ao Almoxarifado</span>
                  </button>
                ) : (
                  <div className="min-h-[48px] flex items-center justify-center text-xs font-semibold text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
                    <span>Disponível no Almoxarifado</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Registro de Novo Empréstimo */}
      {modalEmprestimoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#12264A] text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#00B2D6] tracking-wider font-mono">
                  Saída de Almoxarifado
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Registrar Saída de Ferramenta
                </h3>
              </div>
              <button
                onClick={() => setModalEmprestimoAberto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmeterEmprestimo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selecione o Ativo Disponível:
                </label>
                <select
                  value={ferramentaSelecionadaId}
                  onChange={(e) => setFerramentaSelecionadaId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                >
                  {ferramentasDisponiveis.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo} — {f.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operador Responsável:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do operador (ex: Carlos Encarregado)"
                  value={responsavelNome}
                  onChange={(e) => setResponsavelNome(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Local / Linha / Obra de Destino:
                </label>
                <input
                  type="text"
                  required
                  value={obraNome}
                  onChange={(e) => setObraNome(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-cyan-500 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalEmprestimoAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Empréstimo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
