// ============================================================================
// HOOK: src/hooks/useTriagemAlerts.ts
// Inscrição Supabase Realtime, Toasts Automáticos (sonner) e Gestão de Notificações
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type SeveridadeNotificacao = 'info' | 'aviso' | 'critica';

export interface Notificacao {
  id: string;
  tipo: string;
  severidade: SeveridadeNotificacao;
  titulo: string;
  mensagem: string;
  link?: string;
  destinatario_permissao?: string;
  destinatario_usuario?: string;
  origem_tipo?: string;
  origem_id?: string;
  lida_em?: string | null;
  lida_por?: string | null;
  criada_em: string;
}

// Notificações iniciais de homologação (ex.: triagens ativas no galpão)
const NOTIFICACOES_INICIAIS: Notificacao[] = [
  {
    id: 'notif-seed-01',
    tipo: 'triagem_quarentena',
    severidade: 'critica',
    titulo: 'Material Retido em Quarentena',
    mensagem: 'NF 98124: SKU PERF-SUP-BRANCO-6M retido na Gaiola de Quarentena. Motivo: Lote com oxidação superficial visível na ponta das barras',
    link: '/quarentena',
    destinatario_permissao: 'quarentena.decidir',
    origem_tipo: 'quarentena',
    origem_id: 'quar-01',
    lida_em: null,
    criada_em: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 minutos atrás
  },
  {
    id: 'notif-seed-02',
    tipo: 'triagem_corte',
    severidade: 'aviso',
    titulo: 'Mistura de Cor Aprovada em OP',
    mensagem: 'OP-2026-089: Mistura de lotes autorizada. Motivo: Variação autorizada pelo cliente para perfis pretos foscos',
    link: '/terminal',
    destinatario_permissao: 'op.executar',
    origem_tipo: 'ordens_producao',
    origem_id: 'op-089',
    lida_em: null,
    criada_em: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutos atrás
  },
  {
    id: 'notif-seed-03',
    tipo: 'sistema',
    severidade: 'info',
    titulo: 'Endereçamento Físico Atualizado',
    mensagem: 'Novos cavaletes horizontais foram cadastrados na área de Matéria-Prima com validação de 6m.',
    link: '/locais',
    lida_em: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    criada_em: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
];

export function useTriagemAlerts() {
  const { perfil, pode, ehDono } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(() => {
    const salvo = localStorage.getItem('esquadrias_v2_notificacoes');
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        return NOTIFICACOES_INICIAIS;
      }
    }
    return NOTIFICACOES_INICIAIS;
  });
  const [carregando, setCarregando] = useState(false);

  // Sincroniza persistência local para garantir reatividade
  useEffect(() => {
    localStorage.setItem('esquadrias_v2_notificacoes', JSON.stringify(notificacoes));
  }, [notificacoes]);

  // Disparo de toast padronizado conforme a severidade exigida
  const dispararToast = useCallback((notif: Notificacao) => {
    const opts = {
      description: notif.mensagem,
      duration: notif.severidade === 'critica' ? 8000 : 5000,
      action: notif.link
        ? {
            label: 'Ver Pendência',
            onClick: () => {
              if (notif.link) {
                window.dispatchEvent(new CustomEvent('alufort_navegar', { detail: notif.link }));
                window.location.hash = notif.link;
              }
            },
          }
        : undefined,
    };

    if (notif.severidade === 'critica') {
      toast.error(`[ALERTA CRÍTICO] ${notif.titulo}`, opts);
    } else if (notif.severidade === 'aviso') {
      toast.warning(`[AVISO OPERACIONAL] ${notif.titulo}`, opts);
    } else {
      toast.info(notif.titulo, opts);
    }
  }, []);

  // Referências mutáveis para evitar recriação desnecessária do canal Realtime
  const ehDonoRef = useRef(ehDono);
  ehDonoRef.current = ehDono;

  const podeRef = useRef(pode);
  podeRef.current = pode;

  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;

  const dispararToastRef = useRef(dispararToast);
  dispararToastRef.current = dispararToast;

  // Busca inicial das notificações do Supabase
  const recarregar = useCallback(async () => {
    if (!isSupabaseConfigured || !perfil) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('criada_em', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotificacoes(data as Notificacao[]);
      }
    } catch (err) {
      console.warn('Erro ao carregar notificações do Supabase:', err);
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  // Inscrição Realtime no canal postgres_changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    recarregar();

    // Nome único por ciclo para prevenir colisões do Supabase Realtime ("cannot add postgres_changes after subscribe")
    const canalNome = `notificacoes-rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const canal = supabase
      .channel(canalNome)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
        },
        (payload) => {
          const nova = payload.new as Notificacao;

          // Validação RLS client-side adicional de destinatário
          const destinatarioValido =
            ehDonoRef.current ||
            !nova.destinatario_permissao ||
            podeRef.current(nova.destinatario_permissao) ||
            nova.destinatario_usuario === perfilRef.current?.id;

          if (destinatarioValido) {
            setNotificacoes((prev) => [nova, ...prev]);
            dispararToastRef.current(nova);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificacoes',
        },
        (payload) => {
          const atualizada = payload.new as Notificacao;
          setNotificacoes((prev) =>
            prev.map((n) => (n.id === atualizada.id ? atualizada : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [recarregar]);

  // Filtra as notificações visíveis para o usuário autenticado de acordo com suas permissões
  const notificacoesVisiveis = useMemo(() => {
    return notificacoes.filter((n) => {
      if (ehDono) return true;
      if (n.destinatario_usuario && n.destinatario_usuario === perfil?.id) return true;
      if (n.destinatario_permissao && pode(n.destinatario_permissao)) return true;
      if (!n.destinatario_permissao && !n.destinatario_usuario) return true;
      return false;
    });
  }, [notificacoes, ehDono, perfil?.id, pode]);

  // Lista de não lidas e verificação de alertas críticos pendentes
  const naoLidas = useMemo(() => {
    return notificacoesVisiveis.filter((n) => !n.lida_em);
  }, [notificacoesVisiveis]);

  const temCriticaNaoLida = useMemo(() => {
    return naoLidas.some((n) => n.severidade === 'critica');
  }, [naoLidas]);

  // Ação: Marcar como lida
  const marcarComoLida = async (id: string) => {
    const timestamp = new Date().toISOString();

    // Atualização otimista local
    setNotificacoes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, lida_em: timestamp, lida_por: perfil?.id } : n
      )
    );

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('notificacoes')
          .update({
            lida_em: timestamp,
            lida_por: perfil?.id,
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao marcar notificação como lida no banco:', err);
      }
    }
  };

  // Ação: Marcar todas como lidas
  const marcarTodasComoLidas = async () => {
    const timestamp = new Date().toISOString();

    setNotificacoes((prev) =>
      prev.map((n) => ({ ...n, lida_em: timestamp, lida_por: perfil?.id }))
    );

    if (isSupabaseConfigured && naoLidas.length > 0) {
      try {
        const ids = naoLidas.map((n) => n.id);
        await supabase
          .from('notificacoes')
          .update({
            lida_em: timestamp,
            lida_por: perfil?.id,
          })
          .in('id', ids);
      } catch (err) {
        console.warn('Erro ao marcar todas como lidas no banco:', err);
      }
    }
  };

  // Helper de homologação: Simulação interativa do Gatilho da Triagem 1 (Quarentena)
  const simularAlertaQuarentena = (
    nf = 'NF-99432',
    sku = 'PERF-ALUM-6M-SUP',
    motivo = 'Divergência dimensional na conferência cega: barras com 5.800 mm em vez de 6.000 mm'
  ) => {
    const nova: Notificacao = {
      id: `notif-quar-${Date.now()}`,
      tipo: 'triagem_quarentena',
      severidade: 'critica',
      titulo: 'Material Retido em Quarentena',
      mensagem: `${nf}: SKU ${sku} retido na Gaiola de Quarentena. Motivo: ${motivo}`,
      link: '/quarentena',
      destinatario_permissao: 'quarentena.decidir',
      origem_tipo: 'quarentena',
      origem_id: `quar-${Date.now()}`,
      lida_em: null,
      criada_em: new Date().toISOString(),
    };

    setNotificacoes((prev) => [nova, ...prev]);
    dispararToast(nova);
  };

  // Helper de homologação: Simulação interativa do Gatilho da Triagem 2 (Mistura de Cor)
  const simularAlertaMisturaCor = (
    op = 'OP-2026-104',
    motivo = 'Aprovação expressa do encarregado para uso conjunto dos lotes LOTE-COR-A e LOTE-COR-B'
  ) => {
    const nova: Notificacao = {
      id: `notif-op-${Date.now()}`,
      tipo: 'triagem_corte',
      severidade: 'aviso',
      titulo: 'Mistura de Cor Aprovada em OP',
      mensagem: `${op}: Mistura de lotes autorizada. Motivo: ${motivo}`,
      link: '/terminal',
      destinatario_permissao: 'op.executar',
      origem_tipo: 'ordens_producao',
      origem_id: op,
      lida_em: null,
      criada_em: new Date().toISOString(),
    };

    setNotificacoes((prev) => [nova, ...prev]);
    dispararToast(nova);
  };

  // Alerta e Encaminhamento Automático: Triagem de Verificação de Integridade
  const enviarParaTriagemIntegridade = (params: {
    sku: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    localNome?: string;
    obraNome?: string;
    origem?: 'manual' | 'ia';
    nf?: string;
  }) => {
    const nova: Notificacao = {
      id: `notif-int-${Date.now()}`,
      tipo: 'triagem_integridade',
      severidade: 'aviso',
      titulo: 'Triagem de Integridade: Novo Material Inserido',
      mensagem: `${params.sku} (${params.quantidade} ${params.unidade}): ${params.descricao} [${params.origem === 'ia' ? 'IA' : 'MANUAL'}] alocado em ${params.localNome || 'Almoxarifado'}${params.obraNome ? ` • Obra: ${params.obraNome}` : ''}. Encaminhado para verificação física e conferência de integridade.`,
      link: '/terminal',
      destinatario_permissao: 'triagem.executar',
      origem_tipo: 'triagem_1_recebimento',
      origem_id: `triagem-${Date.now()}`,
      lida_em: null,
      criada_em: new Date().toISOString(),
    };

    setNotificacoes((prev) => [nova, ...prev]);
    dispararToast(nova);

    if (isSupabaseConfigured) {
      supabase.from('notificacoes').insert({
        id: nova.id,
        tipo: nova.tipo,
        severidade: nova.severidade,
        titulo: nova.titulo,
        mensagem: nova.mensagem,
        link: nova.link,
        destinatario_permissao: nova.destinatario_permissao,
        origem_tipo: nova.origem_tipo,
        origem_id: nova.origem_id,
        criada_em: nova.criada_em,
      }).then();
    }
  };

  return {
    notificacoes: notificacoesVisiveis,
    naoLidas,
    totalNaoLidas: naoLidas.length,
    temCriticaNaoLida,
    carregando,
    marcarComoLida,
    marcarTodasComoLidas,
    recarregar,
    simularAlertaQuarentena,
    simularAlertaMisturaCor,
    enviarParaTriagemIntegridade,
  };
}
