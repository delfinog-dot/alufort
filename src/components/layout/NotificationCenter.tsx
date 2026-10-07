// ============================================================================
// COMPONENT: src/components/layout/NotificationCenter.tsx
// Central de Notificações com Indicador Pulsante e Gestão de Triagens
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useTriagemAlerts, Notificacao, SeveridadeNotificacao } from '../../hooks/useTriagemAlerts';
import {
  Bell,
  Check,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  ExternalLink,
  X,
  Sparkles,
  Layers,
  Flame,
} from 'lucide-react';

interface NotificationCenterProps {
  onNavegar?: (link: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavegar }) => {
  const {
    notificacoes,
    naoLidas,
    totalNaoLidas,
    temCriticaNaoLida,
    marcarComoLida,
    marcarTodasComoLidas,
    simularAlertaQuarentena,
    simularAlertaMisturaCor,
  } = useTriagemAlerts();

  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'criticas'>('todas');
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    const handleFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handleFora);
    return () => document.removeEventListener('mousedown', handleFora);
  }, []);

  const formatarDataHora = (iso: string) => {
    try {
      const data = new Date(iso);
      const agora = new Date();
      const difMin = Math.floor((agora.getTime() - data.getTime()) / (1000 * 60));

      if (difMin < 1) return 'Agora mesmo';
      if (difMin < 60) return `Há ${difMin} min`;
      const difHoras = Math.floor(difMin / 60);
      if (difHoras < 24) return `Há ${difHoras}h`;
      return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getIconeSeveridade = (sev: SeveridadeNotificacao) => {
    switch (sev) {
      case 'critica':
        return <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'aviso':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-cyan-500 shrink-0" />;
    }
  };

  const getBadgeSeveridade = (sev: SeveridadeNotificacao) => {
    switch (sev) {
      case 'critica':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
            Crítica
          </span>
        );
      case 'aviso':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
            Aviso
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800">
            Info
          </span>
        );
    }
  };

  const notificacoesFiltradas = notificacoes.filter((n) => {
    if (filtro === 'nao_lidas') return !n.lida_em;
    if (filtro === 'criticas') return n.severidade === 'critica';
    return true;
  });

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão de Sino com Indicador Numérico e Animação Pulsante */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#14283F] transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#00B2D6]"
        aria-label="Notificações e Triagens"
      >
        <Bell className="w-5 h-5" />

        {/* Badge Numérico com Pulsante para Alertas Críticos */}
        {totalNaoLidas > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-black leading-none text-white shadow-md ${
              temCriticaNaoLida
                ? 'bg-rose-600 ring-2 ring-rose-400/60 animate-pulse'
                : 'bg-[#00B2D6] text-slate-950'
            }`}
          >
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>

      {/* Modal / Diálogo da Central de Alertas */}
      {aberto && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[440px] bg-[#12264A] border border-[#2A3F5C] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in-50 duration-150 text-white font-sans">
          {/* Header da Central */}
          <div className="p-4 border-b border-[#2A3F5C] bg-[#0A1A33]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00B2D6]/20 border border-[#00B2D6]/40 flex items-center justify-center">
                <Bell className="w-4 h-4 text-[#00B2D6]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white leading-tight">
                  Central de Notificações & Triagens
                </h3>
                <p className="text-[11px] text-slate-400">
                  {totalNaoLidas}{' '}
                  {totalNaoLidas === 1 ? 'alerta pendente' : 'alertas pendentes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {totalNaoLidas > 0 && (
                <button
                  type="button"
                  onClick={() => marcarTodasComoLidas()}
                  className="p-1.5 text-xs text-slate-400 hover:text-cyan-300 rounded hover:bg-[#14283F] flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#14283F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Abas de Filtragem Rápida */}
          <div className="flex items-center px-4 py-2 border-b border-[#2A3F5C] bg-[#0E1F3D] gap-2 text-xs">
            <button
              onClick={() => setFiltro('todas')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtro === 'todas'
                  ? 'bg-[#00B2D6] text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({notificacoes.length})
            </button>
            <button
              onClick={() => setFiltro('nao_lidas')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtro === 'nao_lidas'
                  ? 'bg-[#00B2D6] text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Não Lidas ({totalNaoLidas})
            </button>
            <button
              onClick={() => setFiltro('criticas')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                filtro === 'criticas'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <Flame className="w-3 h-3" />
              Críticas ({notificacoes.filter((n) => n.severidade === 'critica').length})
            </button>
          </div>

          {/* Lista de Notificações com Rolagem */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#2A3F5C]/60 bg-[#12264A]">
            {notificacoesFiltradas.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400 mb-2 opacity-80" />
                <span className="font-bold text-white">Tudo em dia!</span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Nenhum alerta pendente para a seleção atual.
                </span>
              </div>
            ) : (
              notificacoesFiltradas.map((notif) => {
                const lida = Boolean(notif.lida_em);
                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 transition-colors relative flex items-start gap-3 ${
                      !lida
                        ? notif.severidade === 'critica'
                          ? 'bg-rose-950/30 hover:bg-rose-950/40'
                          : 'bg-[#14283F] hover:bg-[#18304c]'
                        : 'bg-transparent hover:bg-[#14283F]/50 opacity-75'
                    }`}
                  >
                    {/* Ícone de Severidade */}
                    <div className="pt-0.5">{getIconeSeveridade(notif.severidade)}</div>

                    {/* Conteúdo da Notificação */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getBadgeSeveridade(notif.severidade)}
                          <span className="text-xs font-bold text-white truncate">
                            {notif.titulo}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatarDataHora(notif.criada_em)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {notif.mensagem}
                      </p>

                      {/* Ações da Notificação: Link e Marcar como Lida */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[#2A3F5C]/40">
                        {notif.link ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavegar) onNavegar(notif.link!);
                              setAberto(false);
                            }}
                            className="text-[11px] font-bold text-[#00B2D6] hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Resolver Pendência</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span />
                        )}

                        {!lida ? (
                          <button
                            type="button"
                            onClick={() => marcarComoLida(notif.id)}
                            className="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Marcar como lida</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Lida
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé com Atalhos de Homologação dos Gatilhos */}
          <div className="p-3 border-t border-[#2A3F5C] bg-[#0A1A33] flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-bold">
                <Sparkles className="w-3 h-3 text-[#00B2D6]" />
                Testar Gatilhos das Triagens
              </span>
              <span className="text-[9px] font-mono text-cyan-400">REALTIME</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  simularAlertaQuarentena(
                    `NF-${Math.floor(10000 + Math.random() * 90000)}`,
                    'PERF-SUP-6M',
                    'Divergência dimensional na conferência cega: barras oxidadas'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
              >
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                <span>Simular Triagem 1 (Quarentena)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  simularAlertaMisturaCor(
                    `OP-2026-${Math.floor(100 + Math.random() * 900)}`,
                    'Cliente autorizou variação tonal discreta no lote de perfis'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Simular Triagem 2 (Mistura Cor)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
