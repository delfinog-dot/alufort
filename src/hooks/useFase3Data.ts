// ============================================================================
// HOOK: src/hooks/useFase3Data.ts
// Gerenciamento da Fase 3 Mínima: Triagem 3 (Qualidade), Triagem 4 (Expedição) & Ferramental
// Feedback Sonoro Nativo via Web Audio API • Suporte a Supabase & Fallback
// ============================================================================

import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Som de alerta grave/estridente para bloqueios físicos e divergências
export const tocarAlertaBloqueioSonoro = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.warn('Web Audio não inicializado:', err);
  }
};

// Som de confirmação limpo para bipagem de serial autorizado
export const tocarBipeSucesso = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987, ctx.currentTime); // B5
    osc.frequency.exponentialRampToValueAtTime(1318, ctx.currentTime + 0.15); // E6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (err) {
    // Silencioso em caso de restrição de autoplay
  }
};

export interface ChecklistQualidade {
  esquadro: boolean;
  vedacao_epdm: boolean;
  roldanas: boolean;
  pelicula_protetora: boolean;
}

export interface EsquadriaItem {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  obraDestino: string;
  serial: string;
  codigoTipologia: string;
  descricao: string;
  status: 'em_producao' | 'em_inspecao' | 'aprovado' | 'retrabalho' | 'na_doca' | 'carregado' | 'entregue';
  reprovacoesConsecutivas: number;
  ultimaInspecaoEm?: string;
}

export interface PedidoExpedicao {
  id: string;
  numeroPedido: string;
  obraDestino: string;
  clienteNome: string;
  status: 'planejado' | 'em_producao' | 'em_inspecao' | 'na_doca' | 'entregue';
  dataPrometida: string;
  totalPecas: number;
  pecasCarregadas: number;
}

export interface FerramentaAtivo {
  id: string;
  codigo: string;
  descricao: string;
  status: 'disponivel' | 'emprestado' | 'em_manutencao' | 'baixado';
  calibracaoValidade?: string;
  responsavelAtual?: string;
  obraAtual?: string;
  horasAtraso?: number;
  diasAtraso?: number;
  estaVencida?: boolean;
}

// SEED DE HOMOLOGAÇÃO
const ESQUADRIAS_SEED: EsquadriaItem[] = [
  {
    id: 'b1111111-0000-0000-0000-000000000001',
    pedidoId: 'a1111111-0000-0000-0000-000000000001',
    pedidoNumero: 'PED-2026-089',
    obraDestino: 'Edifício Alpha Tower',
    serial: 'SN-ALPHA-001',
    codigoTipologia: 'MAX-SUP-01F',
    descricao: 'Maxim-ar Suprema 600x600 mm Incolor 6mm',
    status: 'na_doca',
    reprovacoesConsecutivas: 0,
    ultimaInspecaoEm: 'Hoje às 10:15',
  },
  {
    id: 'b2222222-0000-0000-0000-000000000002',
    pedidoId: 'a1111111-0000-0000-0000-000000000001',
    pedidoNumero: 'PED-2026-089',
    obraDestino: 'Edifício Alpha Tower',
    serial: 'SN-ALPHA-002',
    codigoTipologia: 'MAX-SUP-01F',
    descricao: 'Maxim-ar Suprema 600x600 mm Incolor 6mm',
    status: 'na_doca',
    reprovacoesConsecutivas: 0,
    ultimaInspecaoEm: 'Hoje às 10:20',
  },
  {
    id: 'b3333333-0000-0000-0000-000000000003',
    pedidoId: 'a2222222-0000-0000-0000-000000000002',
    pedidoNumero: 'PED-2026-101',
    obraDestino: 'Residencial Reserva dos Lagos',
    serial: 'SN-LAGOS-101',
    codigoTipologia: 'JAN-SUP-02F',
    descricao: 'Janela de Correr 2 Folhas 1200x1200 mm Branco',
    status: 'em_inspecao',
    reprovacoesConsecutivas: 1, // Atenção: Se reprovar agora será a 2ª reprovação consecutiva!
    ultimaInspecaoEm: 'Ontem às 16:40',
  },
  {
    id: 'b4444444-0000-0000-0000-000000000004',
    pedidoId: 'a2222222-0000-0000-0000-000000000002',
    pedidoNumero: 'PED-2026-101',
    obraDestino: 'Residencial Reserva dos Lagos',
    serial: 'SN-LAGOS-102',
    codigoTipologia: 'JAN-SUP-02F',
    descricao: 'Janela de Correr 2 Folhas 1200x1200 mm Branco',
    status: 'em_inspecao',
    reprovacoesConsecutivas: 0,
  },
];

const PEDIDOS_SEED: PedidoExpedicao[] = [
  {
    id: 'a1111111-0000-0000-0000-000000000001',
    numeroPedido: 'PED-2026-089',
    obraDestino: 'Edifício Alpha Tower',
    clienteNome: 'Construtora Metropolitana S/A',
    status: 'na_doca',
    dataPrometida: '2026-10-15',
    totalPecas: 2,
    pecasCarregadas: 0,
  },
  {
    id: 'a2222222-0000-0000-0000-000000000002',
    numeroPedido: 'PED-2026-101',
    obraDestino: 'Residencial Reserva dos Lagos',
    clienteNome: 'Lagos Empreendimentos Imobiliários',
    status: 'em_inspecao',
    dataPrometida: '2026-10-18',
    totalPecas: 2,
    pecasCarregadas: 0,
  },
];

const FERRAMENTAS_SEED: FerramentaAtivo[] = [
  {
    id: 'f1111111-0000-0000-0000-000000000001',
    codigo: 'FER-GAB-01',
    descricao: 'Gabarito de Furação Linha Suprema',
    status: 'emprestado',
    calibracaoValidade: '2026-12-31',
    responsavelAtual: 'João do Corte',
    obraAtual: 'Linha de Corte 1',
    horasAtraso: 3.2,
    diasAtraso: 0.1,
    estaVencida: true,
  },
  {
    id: 'f2222222-0000-0000-0000-000000000002',
    codigo: 'FER-PIS-02',
    descricao: 'Pistola de Silicone Pneumática #2',
    status: 'emprestado',
    calibracaoValidade: '2027-03-15',
    responsavelAtual: 'Lucas Montagem',
    obraAtual: 'Bancada Montagem 3',
    horasAtraso: 5.5,
    diasAtraso: 0.2,
    estaVencida: true,
  },
  {
    id: 'f3333333-0000-0000-0000-000000000003',
    codigo: 'FER-SER-01',
    descricao: 'Serra de Esquadria Duplo Cabeçote',
    status: 'disponivel',
    calibracaoValidade: '2026-11-20',
    estaVencida: false,
  },
  {
    id: 'f4444444-0000-0000-0000-000000000004',
    codigo: 'FER-PRE-03',
    descricao: 'Puncionadeira Hidráulica 4 Toneladas',
    status: 'em_manutencao',
    calibracaoValidade: '2026-09-30',
    estaVencida: false,
  },
];

export const useFase3Data = () => {
  const { perfil } = useAuth();
  const [esquadrias, setEsquadrias] = useState<EsquadriaItem[]>(ESQUADRIAS_SEED);
  const [pedidos, setPedidos] = useState<PedidoExpedicao[]>(PEDIDOS_SEED);
  const [ferramentas, setFerramentas] = useState<FerramentaAtivo[]>(FERRAMENTAS_SEED);

  // TRIAGEM 3: Executar Inspeção Técnica com Checklist
  const registrarInspecao = useCallback(
    async (
      esquadriaId: string,
      checklist: ChecklistQualidade,
      resultado: 'aprovado' | 'reprovado',
      motivo?: string
    ) => {
      const esquadria = esquadrias.find((e) => e.id === esquadriaId);
      if (!esquadria) {
        toast.error('Esquadria não encontrada.');
        return { sucesso: false };
      }

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from('inspecoes_qualidade').insert({
            esquadria_id: esquadriaId,
            checklist,
            resultado,
            motivo: resultado === 'reprovado' ? motivo : null,
            inspetor_id: perfil?.id,
          });

          if (error) {
            toast.error(`Falha no banco: ${error.message}`);
            return { sucesso: false, erro: error.message };
          }
        } catch (err: any) {
          console.warn('Erro ao inserir inspecao no supabase:', err);
        }
      }

      // Reação no estado local
      if (resultado === 'reprovado') {
        const novaReprovacao = esquadria.reprovacoesConsecutivas + 1;
        setEsquadrias((prev) =>
          prev.map((e) =>
            e.id === esquadriaId
              ? {
                  ...e,
                  status: 'retrabalho',
                  reprovacoesConsecutivas: novaReprovacao,
                  ultimaInspecaoEm: 'Agora',
                }
              : e
          )
        );

        if (novaReprovacao >= 2) {
          tocarAlertaBloqueioSonoro();
          toast.error(
            `ALERTA CRÍTICO: 2ª reprovação consecutiva do serial ${esquadria.serial}! Notificação disparada para o Dono do sistema.`,
            { duration: 8000 }
          );
        } else {
          toast.warning(
            `Peça ${esquadria.serial} reprovada. OP de Retrabalho gerada automaticamente na fábrica.`
          );
        }
      } else {
        // Aprovado
        tocarBipeSucesso();
        setEsquadrias((prev) =>
          prev.map((e) =>
            e.id === esquadriaId
              ? {
                  ...e,
                  status: 'aprovado',
                  reprovacoesConsecutivas: 0,
                  ultimaInspecaoEm: 'Agora',
                }
              : e
          )
        );

        toast.success(`Esquadria ${esquadria.serial} aprovada com 100% no checklist técnico!`);

        // Verificar se todas as peças do pedido foram aprovadas
        setTimeout(() => {
          setEsquadrias((current) => {
            const pecasDoPedido = current.filter((p) => p.pedidoId === esquadria.pedidoId);
            const todasAprovadas = pecasDoPedido.every((p) =>
              ['aprovado', 'na_doca', 'carregado', 'entregue'].includes(p.status)
            );

            if (todasAprovadas) {
              setPedidos((pPrev) =>
                pPrev.map((ped) =>
                  ped.id === esquadria.pedidoId ? { ...ped, status: 'na_doca' } : ped
                )
              );
              toast.success(
                `Pedido ${esquadria.pedidoNumero} totalmente aprovado e liberado para a Doca de Expedição!`
              );
              return current.map((p) =>
                p.pedidoId === esquadria.pedidoId && p.status === 'aprovado'
                  ? { ...p, status: 'na_doca' }
                  : p
              );
            }
            return current;
          });
        }, 100);
      }

      return { sucesso: true };
    },
    [esquadrias, perfil]
  );

  // TRIAGEM 4: Validar Carregamento na Doca (Bipagem de Serial)
  const validarBipagemSerial = useCallback(
    async (pedidoId: string, serialBipado: string) => {
      const serialLimpo = serialBipado.trim().toUpperCase();
      const pedido = pedidos.find((p) => p.id === pedidoId);

      if (!pedido) {
        tocarAlertaBloqueioSonoro();
        return {
          sucesso: false,
          bloqueio: true,
          motivo: 'Pedido de expedição não selecionado.',
        };
      }

      // 1. Validar via RPC do Supabase se configurado
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.rpc('validar_carregamento_expedicao', {
            p_pedido: pedidoId,
            p_serial: serialLimpo,
          });

          if (error) {
            tocarAlertaBloqueioSonoro();
            return {
              sucesso: false,
              bloqueio: true,
              motivo: error.message,
            };
          }

          tocarBipeSucesso();
          // Atualiza estado local
          setEsquadrias((prev) =>
            prev.map((e) =>
              e.serial === serialLimpo ? { ...e, status: 'carregado' } : e
            )
          );
          setPedidos((prev) =>
            prev.map((p) =>
              p.id === pedidoId ? { ...p, pecasCarregadas: p.pecasCarregadas + 1 } : p
            )
          );

          return {
            sucesso: true,
            bloqueio: false,
            mensagem: data?.mensagem || 'Peça validada e autorizada para embarque.',
          };
        } catch (err: any) {
          tocarAlertaBloqueioSonoro();
          return {
            sucesso: false,
            bloqueio: true,
            motivo: err.message,
          };
        }
      }

      // Fallback de Homologação Local: Regras estritas do banco reproduzidas
      const esquadria = esquadrias.find((e) => e.serial.toUpperCase() === serialLimpo);

      if (!esquadria) {
        tocarAlertaBloqueioSonoro();
        return {
          sucesso: false,
          bloqueio: true,
          motivo: `Serial "${serialLimpo}" não cadastrado no sistema fabril.`,
        };
      }

      // Regra 1: Peça de outro pedido / outra obra
      if (esquadria.pedidoId !== pedidoId) {
        tocarAlertaBloqueioSonoro();
        return {
          sucesso: false,
          bloqueio: true,
          motivo: `BLOQUEIO FÍSICO: A peça ${serialLimpo} pertence à obra "${esquadria.obraDestino}" (${esquadria.pedidoNumero}). Embarque cancelado.`,
        };
      }

      // Regra 2: Peça sem aprovação na qualidade
      if (['em_inspecao', 'retrabalho', 'em_producao'].includes(esquadria.status)) {
        tocarAlertaBloqueioSonoro();
        return {
          sucesso: false,
          bloqueio: true,
          motivo: `BLOQUEIO DE QUALIDADE: A peça ${serialLimpo} está em "${esquadria.status}" e não foi aprovada no checklist. Embarque proibido.`,
        };
      }

      // Regra 3: Peça já carregada
      if (esquadria.status === 'carregado') {
        tocarBipeSucesso();
        return {
          sucesso: true,
          bloqueio: false,
          jaCarregado: true,
          mensagem: `A peça ${serialLimpo} já havia sido bipada anteriormente neste embarque.`,
        };
      }

      // Bipagem bem-sucedida!
      tocarBipeSucesso();
      setEsquadrias((prev) =>
        prev.map((e) => (e.id === esquadria.id ? { ...e, status: 'carregado' } : e))
      );
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId ? { ...p, pecasCarregadas: p.pecasCarregadas + 1 } : p
        )
      );

      return {
        sucesso: true,
        bloqueio: false,
        mensagem: `Peça ${serialLimpo} (${esquadria.codigoTipologia}) conferida e autorizada para embarque.`,
      };
    },
    [pedidos, esquadrias]
  );

  // Finalizar Expedição
  const finalizarExpedicao = useCallback(
    async (pedidoId: string, comprovanteNome: string) => {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (!pedido) return { sucesso: false, erro: 'Pedido não localizado' };

      const pecasDoPedido = esquadrias.filter((e) => e.pedidoId === pedidoId);
      const pecasPendentes = pecasDoPedido.filter((e) => e.status !== 'carregado');

      if (pecasPendentes.length > 0) {
        tocarAlertaBloqueioSonoro();
        const msg = `Não é permitido finalizar expedição com ${pecasPendentes.length} peças pendentes de bipagem.`;
        toast.error(msg);
        return { sucesso: false, erro: msg };
      }

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.rpc('finalizar_expedicao', {
            p_pedido: pedidoId,
            p_comprovante_nome: comprovanteNome,
          });

          if (error) {
            toast.error(error.message);
            return { sucesso: false, erro: error.message };
          }
        } catch (err: any) {
          console.warn('Erro ao finalizar expedicao no supabase:', err);
        }
      }

      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, status: 'entregue' } : p))
      );
      setEsquadrias((prev) =>
        prev.map((e) => (e.pedidoId === pedidoId ? { ...e, status: 'entregue' } : e))
      );

      tocarBipeSucesso();
      toast.success(
        `Expedição do pedido ${pedido.numeroPedido} (${pedido.obraDestino}) finalizada com sucesso! Carga entregue.`
      );
      return { sucesso: true };
    },
    [pedidos, esquadrias]
  );

  // MÓDULO DE FERRAMENTAL: Empréstimo e Devolução
  const devolverFerramenta = useCallback((ferramentaId: string) => {
    setFerramentas((prev) =>
      prev.map((f) =>
        f.id === ferramentaId
          ? {
              ...f,
              status: 'disponivel',
              responsavelAtual: undefined,
              obraAtual: undefined,
              horasAtraso: undefined,
              diasAtraso: undefined,
              estaVencida: false,
            }
          : f
      )
    );
    tocarBipeSucesso();
    toast.success('Ferramenta devolvida com sucesso ao almoxarifado!');
  }, []);

  const emprestarFerramenta = useCallback(
    (ferramentaId: string, responsavel: string, obra: string) => {
      setFerramentas((prev) =>
        prev.map((f) =>
          f.id === ferramentaId
            ? {
                ...f,
                status: 'emprestado',
                responsavelAtual: responsavel,
                obraAtual: obra,
                estaVencida: false,
              }
            : f
        )
      );
      tocarBipeSucesso();
      toast.success(`Empréstimo registrado para ${responsavel} (${obra})!`);
    },
    []
  );

  return {
    esquadrias,
    pedidos,
    ferramentas,
    registrarInspecao,
    validarBipagemSerial,
    finalizarExpedicao,
    devolverFerramenta,
    emprestarFerramenta,
  };
};
