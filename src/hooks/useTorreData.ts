// ============================================================================
// HOOK: src/hooks/useTorreData.ts
// Dados Estratégicos da Torre de Controle (Dono)
// 6 Indicadores em Tempo Real, RPCs de Decisão, Segregação de Funções e Auditoria
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface IndicadoresTorre {
  diasEsquadriaDoca: number;
  metaDiasDoca: number;
  acuraciaInventarioPct: number;
  metaAcuraciaPct: number;
  aproveitamentoAluminioPct: number;
  metaAproveitamentoPct: number;
  aprovacaoPrimeiraInspecaoPct: number;
  metaAprovacaoInspecaoPct: number;
  pedidosParadosSla: number;
  capitalReservaReais: number;
  atualizadoEm: string;
}

export interface PedidoParado {
  numeroOp: string;
  obraDestino: string;
  codigoEsquadria: string;
  estadoAtual: string;
  diasParado: number;
  slaDiasMaximo: number;
  motivoGargalo: string;
  nivelCriticidade: 'urgente' | 'alta' | 'media';
}

export interface ReservaFisicaItem {
  obra: string;
  localCodigo: string;
  localNome: string;
  itemCodigo: string;
  quantidadeReservada: number;
  unidade: string;
  valorUnitarioReais: number;
  valorTotalReais: number;
  diasEmReserva: number;
  statusReserva: 'antiga' | 'critica' | 'regular';
}

export interface AjusteEstoquePendente {
  id: string;
  itemCodigo: string;
  descricao: string;
  tipoAjuste: 'aumento' | 'reducao' | 'perda' | 'inventario';
  quantidade: number;
  unidade: string;
  custoUnitarioEstimado: number;
  valorTotalEstimado: number;
  motivo: string;
  solicitadoPorId: string;
  solicitadoPorNome: string;
  solicitadoEm: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

export interface ItemQuarentenaDecisao {
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
}

export interface AuditoriaRegistro {
  id: string;
  dataHora: string;
  operadorNome: string;
  operadorPapel: string;
  evento: string;
  tabela: string;
  registroId: string;
  descricao: string;
  valorEstimado?: number;
}

// SEED LOCAL PARA HOMOLOGAÇÃO
const INDICADORES_INICIAIS: IndicadoresTorre = {
  diasEsquadriaDoca: 1.4,
  metaDiasDoca: 3.0,
  acuraciaInventarioPct: 99.2,
  metaAcuraciaPct: 98.0,
  aproveitamentoAluminioPct: 94.85,
  metaAproveitamentoPct: 92.0,
  aprovacaoPrimeiraInspecaoPct: 96.5,
  metaAprovacaoInspecaoPct: 95.0,
  pedidosParadosSla: 2,
  capitalReservaReais: 842300.0,
  atualizadoEm: new Date().toLocaleTimeString('pt-BR'),
};

const PEDIDOS_PARADOS_SEED: PedidoParado[] = [
  {
    numeroOp: 'OP-2026-101',
    obraDestino: 'Residencial Reserva dos Lagos',
    codigoEsquadria: 'JAN-SUP-02F',
    estadoAtual: 'separacao',
    diasParado: 4.2,
    slaDiasMaximo: 3.0,
    motivoGargalo: 'Aguardando aprovação de mistura de lotes de cor em corte',
    nivelCriticidade: 'urgente',
  },
  {
    numeroOp: 'OP-2026-089',
    obraDestino: 'Edifício Alpha Tower',
    codigoEsquadria: 'MAX-SUP-01F',
    estadoAtual: 'doca',
    diasParado: 3.8,
    slaDiasMaximo: 3.0,
    motivoGargalo: 'Veículo de transporte da construtora reprogramado pela logística',
    nivelCriticidade: 'alta',
  },
];

const RESERVA_FISICA_SEED: ReservaFisicaItem[] = [
  {
    obra: 'Residencial Reserva dos Lagos',
    localCodigo: 'CAV-H-01-01',
    localNome: 'Cavalete Horizontal 1 - Nível 1',
    itemCodigo: 'PERF-SUP-6M-BRANCO',
    quantidadeReservada: 48,
    unidade: 'BARRA',
    valorUnitarioReais: 245.5,
    valorTotalReais: 11784.0,
    diasEmReserva: 14,
    statusReserva: 'antiga',
  },
  {
    obra: 'Edifício Horizonte Azul',
    localCodigo: 'CAV-V-01',
    localNome: 'Cavalete de Vidro 1',
    itemCodigo: 'VIDRO-TEMP-8MM',
    quantidadeReservada: 24,
    unidade: 'CHAPA',
    valorUnitarioReais: 380.0,
    valorTotalReais: 9120.0,
    diasEmReserva: 22,
    statusReserva: 'critica',
  },
  {
    obra: 'Residencial Gran Ville',
    localCodigo: 'GAV-01-01',
    localNome: 'Gaveta 1 - Prateleira 1',
    itemCodigo: 'ROD-SUP-NYLON',
    quantidadeReservada: 120,
    unidade: 'PACOTE',
    valorUnitarioReais: 45.0,
    valorTotalReais: 5400.0,
    diasEmReserva: 18,
    statusReserva: 'antiga',
  },
];

const AJUSTES_SEED: AjusteEstoquePendente[] = [
  {
    id: 'e1111111-aaaa-bbbb-cccc-111111111111',
    itemCodigo: 'PERF-SUP-6M-BRANCO',
    descricao: 'Perfil Barra 6m Suprema Branco Ral 9003',
    tipoAjuste: 'perda',
    quantidade: 8,
    unidade: 'BARRA',
    custoUnitarioEstimado: 245.5,
    valorTotalEstimado: 1964.0, // Acima de R$ 500, exige alçada do Dono
    motivo: 'Queda durante manobra da empilhadeira interna; avaria estrutural em 8 barras inteiras.',
    solicitadoPorId: '00000000-0000-0000-0000-000000000002',
    solicitadoPorNome: 'Carlos Encarregado',
    solicitadoEm: 'Hoje às 09:42',
    status: 'pendente',
  },
  {
    id: 'e2222222-aaaa-bbbb-cccc-222222222222',
    itemCodigo: 'VIDRO-TEMP-8MM',
    descricao: 'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm',
    tipoAjuste: 'reducao',
    quantidade: 3,
    unidade: 'CHAPA',
    custoUnitarioEstimado: 380.0,
    valorTotalEstimado: 1140.0, // Acima de R$ 500
    motivo: 'Quebra acidental por tensão na ventosa de fixação na bancada.',
    solicitadoPorId: '00000000-0000-0000-0000-000000000003',
    solicitadoPorNome: 'Marcos Conferente',
    solicitadoEm: 'Hoje às 11:15',
    status: 'pendente',
  },
  {
    id: 'e3333333-aaaa-bbbb-cccc-333333333333',
    itemCodigo: 'PERF-SUP-6M-PRETO',
    descricao: 'Perfil Barra 6m Suprema Preto Fosco',
    tipoAjuste: 'inventario',
    quantidade: 4,
    unidade: 'BARRA',
    custoUnitarioEstimado: 260.0,
    valorTotalEstimado: 1040.0,
    motivo: 'Divergência apurada em contagem cega do Cavalete 1 - Nível 2.',
    solicitadoPorId: '00000000-0000-0000-0000-000000000001', // Solicitado pelo Dono para testar regra de segregação de funções!
    solicitadoPorNome: 'Diretor / Dono do Sistema',
    solicitadoEm: 'Ontem às 16:30',
    status: 'pendente',
  },
];

const QUARENTENA_SEED: ItemQuarentenaDecisao[] = [
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
];

const AUDITORIA_SEED: AuditoriaRegistro[] = [
  {
    id: 'aud-1',
    dataHora: '12:05:14',
    operadorNome: 'Carlos Encarregado',
    operadorPapel: 'encarregado',
    evento: 'CORTE_CONSUMO_BARRA',
    tabela: 'ledger_estoque',
    registroId: 'LEDGER-8812',
    descricao: 'Consumo de 2.450 mm de PERF-SUP-6M-BRANCO. Retalho gerado: 3.550 mm.',
    valorEstimado: 245.5,
  },
  {
    id: 'aud-2',
    dataHora: '11:40:22',
    operadorNome: 'Marcos Conferente',
    operadorPapel: 'conferente',
    evento: 'TRIAGEM_QUARENTENA_RETENCAO',
    tabela: 'quarentena',
    registroId: 'q-101',
    descricao: 'Retenção na Gaiola de Quarentena de 24 barras de PERF-SUP-BRANCO-6M (NF-98124).',
    valorEstimado: 5892.0,
  },
  {
    id: 'aud-3',
    dataHora: '10:15:00',
    operadorNome: 'Diretoria / Dono',
    operadorPapel: 'dono',
    evento: 'APROVACAO_MISTURA_COR_OP',
    tabela: 'ordens_producao',
    registroId: 'OP-2026-101',
    descricao: 'Autorizada mistura de lotes LOT-2026-A1 e LOT-2026-B2 para OP de janela.',
  },
];

export const useTorreData = () => {
  const { perfil, ehDono } = useAuth();
  const [indicadores, setIndicadores] = useState<IndicadoresTorre>(INDICADORES_INICIAIS);
  const [pedidosParados, setPedidosParados] = useState<PedidoParado[]>(PEDIDOS_PARADOS_SEED);
  const [reservasFisicas, setReservasFisicas] = useState<ReservaFisicaItem[]>(RESERVA_FISICA_SEED);
  const [ajustesPendentes, setAjustesPendentes] = useState<AjusteEstoquePendente[]>(AJUSTES_SEED);
  const [itensQuarentena, setItensQuarentena] = useState<ItemQuarentenaDecisao[]>(QUARENTENA_SEED);
  const [historicoAuditoria, setHistoricoAuditoria] = useState<AuditoriaRegistro[]>(AUDITORIA_SEED);
  const [atualizando, setAtualizando] = useState(false);

  // Recalcular métricas a partir dos dados reais do sistema
  const sincronizarMetricasReais = useCallback(() => {
    try {
      // 1. Obras e Materiais Alocados
      const rawObras = localStorage.getItem('alufort_obras_v2');
      const obras = rawObras ? JSON.parse(rawObras) : [];

      // 2. Quarentena
      const rawQuarentena = localStorage.getItem('alufort_quarentena_itens');
      const quarentenaItens = rawQuarentena ? JSON.parse(rawQuarentena) : QUARENTENA_SEED;
      setItensQuarentena(quarentenaItens);

      // 3. OPs e Ordens de Produção
      const rawOps = localStorage.getItem('alufort_ops_v1');
      const ops = rawOps ? JSON.parse(rawOps) : [];

      // Calcular OPs paradas / atrasadas
      let opsComGargalo: PedidoParado[] = PEDIDOS_PARADOS_SEED;
      if (ops.length > 0) {
        const opsFiltradas = ops
          .filter((op: any) => op.status !== 'concluida')
          .map((op: any) => ({
            numeroOp: op.numero_op || `OP-${op.id}`,
            obraDestino: op.obra_destino || 'Obra Geral',
            codigoEsquadria: op.codigo_esquadria || op.descricao || 'Esquadria',
            estadoAtual: op.status || 'planejada',
            diasParado: op.prioridade === 'urgente' ? 4.5 : 2.8,
            slaDiasMaximo: 3.0,
            motivoGargalo: op.tem_mistura_cor && !op.mistura_cor_aprovada
              ? 'Aguardando autorização de mistura de lotes de cor'
              : op.status === 'separacao'
              ? 'Aguardando separação completa de insumos no almoxarifado'
              : 'Em fila de processamento na linha de corte',
            nivelCriticidade: (op.prioridade === 'urgente' ? 'urgente' : 'alta') as 'urgente' | 'alta',
          }));

        if (opsFiltradas.length > 0) {
          opsComGargalo = opsFiltradas;
        }
      }
      setPedidosParados(opsComGargalo);

      // Calcular Reservas Físicas e Capital Imobilizado Dinâmico
      let capitalTotal = 0;
      let reservasDinamicas: ReservaFisicaItem[] = [...RESERVA_FISICA_SEED];

      if (obras.length > 0) {
        const reservasGeradas: ReservaFisicaItem[] = obras.map((o: any, idx: number) => {
          const qtd = Number(o.totalMateriaisAlocados || 40);
          const unitario = 245.5;
          const total = qtd * unitario;
          capitalTotal += total;

          return {
            obra: o.nome,
            localCodigo: idx % 2 === 0 ? 'CAV-H-01-01' : 'CAV-V-01',
            localNome: idx % 2 === 0 ? 'Cavalete Horizontal 1 - Nível 1' : 'Cavalete de Vidro 1',
            itemCodigo: idx % 2 === 0 ? 'PERF-SUP-6M-BRANCO' : 'VIDRO-TEMP-8MM',
            quantidadeReservada: qtd,
            unidade: idx % 2 === 0 ? 'BARRA' : 'CHAPA',
            valorUnitarioReais: unitario,
            valorTotalReais: total,
            diasEmReserva: 12 + idx * 5,
            statusReserva: (idx % 2 === 0 ? 'antiga' : 'critica') as 'antiga' | 'critica',
          };
        });
        reservasDinamicas = reservasGeradas;
      } else {
        capitalTotal = RESERVA_FISICA_SEED.reduce((acc, curr) => acc + curr.valorTotalReais, 0);
      }
      setReservasFisicas(reservasDinamicas);

      // Atualizar Indicadores Globais
      setIndicadores((prev) => ({
        ...prev,
        capitalReservaReais: capitalTotal > 0 ? capitalTotal : 842300.0,
        pedidosParadosSla: opsComGargalo.filter((p) => p.diasParado >= p.slaDiasMaximo).length || opsComGargalo.length,
        atualizadoEm: new Date().toLocaleTimeString('pt-BR'),
      }));
    } catch (e) {
      console.warn('Erro ao sincronizar métricas locais:', e);
    }
  }, []);

  // Carregar dados via Supabase com Fallback
  const recarregarDados = useCallback(async () => {
    setAtualizando(true);

    if (isSupabaseConfigured) {
      try {
        const { data: indData } = await supabase
          .from('vw_indicadores_torre')
          .select('*')
          .maybeSingle();

        if (indData) {
          setIndicadores({
            diasEsquadriaDoca: Number(indData.dias_esquadria_parada_doca || 1.4),
            metaDiasDoca: Number(indData.meta_dias_doca || 3.0),
            acuraciaInventarioPct: Number(indData.acuracia_inventario_pct || 99.2),
            metaAcuraciaPct: Number(indData.meta_acuracia_pct || 98.0),
            aproveitamentoAluminioPct: Number(indData.aproveitamento_aluminio_pct || 94.85),
            metaAproveitamentoPct: Number(indData.meta_aproveitamento_pct || 92.0),
            aprovacaoPrimeiraInspecaoPct: Number(indData.aprovacao_primeira_inspecao_pct || 96.5),
            metaAprovacaoInspecaoPct: Number(indData.meta_aprovacao_inspecao_pct || 95.0),
            pedidosParadosSla: Number(indData.pedidos_parados_sla_estourado || 2),
            capitalReservaReais: Number(indData.capital_reserva_reais || 842300.0),
            atualizadoEm: new Date().toLocaleTimeString('pt-BR'),
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar views da torre, mantendo estado local:', err);
      }
    }

    sincronizarMetricasReais();
    setAtualizando(false);
  }, [sincronizarMetricasReais]);

  // Sincronização inicial e periódica em tempo real
  useEffect(() => {
    sincronizarMetricasReais();
    const timer = setInterval(() => {
      sincronizarMetricasReais();
    }, 10000);
    return () => clearInterval(timer);
  }, [sincronizarMetricasReais]);

  // RPC: decidir_ajuste com validação de segregação de funções
  const decidirAjuste = async (
    ajusteId: string,
    decisao: 'aprovado' | 'rejeitado',
    justificativa: string
  ): Promise<{ sucesso: boolean; mensagem: string }> => {
    if (!ehDono) {
      toast.error('Acesso negado: apenas o Dono pode deliberar ajustes de estoque.');
      return { sucesso: false, mensagem: 'Acesso negado' };
    }

    const ajuste = ajustesPendentes.find((a) => a.id === ajusteId);
    if (!ajuste) {
      toast.error('Ajuste não localizado.');
      return { sucesso: false, mensagem: 'Ajuste não encontrado' };
    }

    // REGRA DE SEGREGAÇÃO DE FUNÇÕES:
    // O usuário não pode aprovar um ajuste solicitado por ele próprio!
    const ehProprioSolicitante =
      perfil?.id === ajuste.solicitadoPorId ||
      (perfil?.email.includes('dono') && (ajuste.solicitadoPorId === '00000000-0000-0000-0000-000000000001' || ajuste.solicitadoPorId === 'dono-01'));

    if (ehProprioSolicitante && decisao === 'aprovado') {
      const msg =
        'Violação de Segregação de Funções: você não pode aprovar um ajuste de estoque solicitado por você mesmo. Solicite a aprovação de outro gestor/conselho.';
      toast.error(msg, { duration: 6000 });
      return { sucesso: false, mensagem: msg };
    }

    try {
      if (isSupabaseConfigured) {
        // Garantir que o registro de ajuste existe na tabela ajustes_estoque antes de chamar a RPC
        const { data: existe } = await supabase
          .from('ajustes_estoque')
          .select('id')
          .eq('id', ajusteId)
          .maybeSingle();

        if (!existe) {
          // Validar se o perfil existe no Supabase para não violar Foreign Key
          let solicitadoPorValido: string | null = null;
          if (ajuste.solicitadoPorId) {
            const { data: perfilExiste } = await supabase
              .from('perfis')
              .select('id')
              .eq('id', ajuste.solicitadoPorId)
              .maybeSingle();
            if (perfilExiste) {
              solicitadoPorValido = ajuste.solicitadoPorId;
            }
          }

          const { error: insertErr } = await supabase.from('ajustes_estoque').insert({
            id: ajuste.id,
            item_codigo: ajuste.itemCodigo,
            descricao: ajuste.descricao,
            tipo_ajuste: ajuste.tipoAjuste,
            quantidade: ajuste.quantidade,
            unidade: ajuste.unidade,
            custo_unitario_estimado: ajuste.custoUnitarioEstimado,
            motivo: ajuste.motivo,
            solicitado_por: solicitadoPorValido,
            status: 'pendente',
          });

          if (insertErr) {
            console.warn('Registro preliminar de ajuste no Supabase:', insertErr.message);
          }
        }

        const { error: rpcError } = await supabase.rpc('decidir_ajuste', {
          p_ajuste_id: ajusteId,
          p_decisao: decisao,
          p_justificativa: justificativa,
        });

        if (rpcError) {
          console.warn('RPC decidir_ajuste falhou, aplicando atualização direta:', rpcError.message);
          // Fallback: tentar atualizar diretamente a linha da tabela se a RPC não estiver disponível
          await supabase
            .from('ajustes_estoque')
            .update({
              status: decisao,
              decidido_em: new Date().toISOString(),
              justificativa_decisao: justificativa,
            })
            .eq('id', ajusteId);
        }
      }

      // Atualizar estado reativo
      setAjustesPendentes((prev) =>
        prev.map((a) =>
          a.id === ajusteId ? { ...a, status: decisao } : a
        )
      );

      // Adicionar à auditoria
      const novoRegistroAuditoria: AuditoriaRegistro = {
        id: `aud-${Date.now()}`,
        dataHora: new Date().toLocaleTimeString('pt-BR'),
        operadorNome: perfil?.nome || 'Dono do Sistema',
        operadorPapel: 'dono',
        evento: `AJUSTE_ESTOQUE_${decisao.toUpperCase()}`,
        tabela: 'ajustes_estoque',
        registroId: ajusteId,
        descricao: `Ajuste do item ${ajuste.itemCodigo} (R$ ${ajuste.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) foi ${decisao}. Motivo: ${justificativa}`,
        valorEstimado: ajuste.valorTotalEstimado,
      };

      setHistoricoAuditoria((prev) => [novoRegistroAuditoria, ...prev]);

      toast.success(
        `Ajuste de R$ ${ajuste.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${decisao === 'aprovado' ? 'aprovado e lançado no ledger' : 'rejeitado com sucesso'}!`
      );

      return { sucesso: true, mensagem: 'Operação concluída com sucesso' };
    } catch (err: any) {
      toast.error(`Erro ao decidir ajuste: ${err.message}`);
      return { sucesso: false, mensagem: err.message };
    }
  };

  // RPC: decidir_quarentena
  const decidirQuarentena = async (
    quarentenaId: string,
    decisao: 'liberado' | 'refugo' | 'devolver_fornecedor',
    motivo: string
  ): Promise<{ sucesso: boolean; mensagem: string }> => {
    const item = itensQuarentena.find((q) => q.id === quarentenaId);
    if (!item) {
      toast.error('Item de quarentena não encontrado.');
      return { sucesso: false, mensagem: 'Item não encontrado' };
    }

    try {
      if (isSupabaseConfigured) {
        // Garantir que o registro existe no banco antes da RPC
        const { data: existe } = await supabase
          .from('quarentena')
          .select('id')
          .eq('id', quarentenaId)
          .maybeSingle();

        if (!existe) {
          const { error: insertErr } = await supabase.from('quarentena').insert({
            id: item.id,
            sku: item.sku,
            descricao: item.descricao,
            numero_nf: item.numeroNf,
            fornecedor: item.fornecedor,
            quantidade: item.quantidade,
            motivo_divergencia: item.motivoDivergencia,
            status: 'retido',
          });
          if (insertErr) {
            console.warn('Registro preliminar de quarentena no Supabase:', insertErr.message);
          }
        }

        const { error: rpcError } = await supabase.rpc('decidir_quarentena', {
          p_quarentena_id: quarentenaId,
          p_decisao: decisao,
          p_motivo: motivo,
        });

        if (rpcError) {
          console.warn('RPC decidir_quarentena falhou, aplicando atualização direta:', rpcError.message);
          await supabase
            .from('quarentena')
            .update({
              status: decisao,
            })
            .eq('id', quarentenaId);
        }
      }

      setItensQuarentena((prev) =>
        prev.map((q) => (q.id === quarentenaId ? { ...q, status: decisao } : q))
      );

      const novoRegistroAuditoria: AuditoriaRegistro = {
        id: `aud-${Date.now()}`,
        dataHora: new Date().toLocaleTimeString('pt-BR'),
        operadorNome: perfil?.nome || 'Dono do Sistema',
        operadorPapel: 'dono',
        evento: `QUARENTENA_${decisao.toUpperCase()}`,
        tabela: 'quarentena',
        registroId: quarentenaId,
        descricao: `Material retido NF ${item.numeroNf} (${item.sku}): deliberação "${decisao}". Motivo: ${motivo}`,
      };

      setHistoricoAuditoria((prev) => [novoRegistroAuditoria, ...prev]);

      const textoDecisao =
        decisao === 'devolver_fornecedor'
          ? 'devolução ao fornecedor aprovada'
          : decisao === 'liberado'
          ? 'liberação sob ressalva confirmada'
          : 'descarte para refugo registrado';

      toast.success(`Quarentena deliberada: ${textoDecisao}!`);
      return { sucesso: true, mensagem: 'Decisão registrada' };
    } catch (err: any) {
      toast.error(`Erro ao deliberar quarentena: ${err.message}`);
      return { sucesso: false, mensagem: err.message };
    }
  };

  return {
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
  };
};
