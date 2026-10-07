// ============================================================================
// HOOK: src/hooks/useStockLedger.ts
// Ledger Imutável de Estoque Fabril (Append-Only) com Estornos via RPC
// Manipula estritamente grandezas físicas (mm, kg, un) - ZERO Menção a Finanças
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type TipoMovimentacaoLedger =
  | 'entrada_nf'
  | 'saida_corte'
  | 'geracao_retalho'
  | 'descarte_sucata'
  | 'transferencia'
  | 'estorno';

export interface RegistroLedger {
  id: string;
  transacao_id: string;
  data_hora: string;
  tipo: TipoMovimentacaoLedger;
  item_codigo: string;
  descricao: string;
  tipo_material: 'perfil_barra' | 'retalho' | 'vidro' | 'acessorio';
  comprimento_mm: number;
  quantidade: number;
  unidade: string;
  local_origem_codigo?: string;
  local_origem_nome?: string;
  local_destino_codigo?: string;
  local_destino_nome?: string;
  lote: string;
  op_origem?: string;
  motivo: string;
  estornado: boolean;
}

export interface ItemSaldoFisico {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: 'perfil_barra' | 'retalho' | 'vidro' | 'acessorio';
  comprimento_mm: number;
  quantidade_saldo: number;
  unidade: string;
  lote: string;
  local_id: string;
  local_codigo: string;
  local_nome_exibicao: string; // "Cavalete Horizontal 1 - Nível 1"
}

const SALDOS_SEED: ItemSaldoFisico[] = [
  {
    id: 'saldo-1',
    codigo: 'PERF-SUP-6M-BRANCO',
    descricao: 'Perfil Barra 6m Suprema Branco Ral 9003',
    tipo_material: 'perfil_barra',
    comprimento_mm: 6000,
    quantidade_saldo: 48,
    unidade: 'BARRA',
    lote: 'LOTE-2026-A1',
    local_id: 'loc-3',
    local_codigo: 'CAV-H-01-01',
    local_nome_exibicao: 'Cavalete Horizontal 1 - Nível 1',
  },
  {
    id: 'saldo-2',
    codigo: 'PERF-SUP-6M-PRETO',
    descricao: 'Perfil Barra 6m Suprema Preto Fosco',
    tipo_material: 'perfil_barra',
    comprimento_mm: 6000,
    quantidade_saldo: 32,
    unidade: 'BARRA',
    lote: 'LOTE-2026-B2',
    local_id: 'loc-4',
    local_codigo: 'CAV-H-01-02',
    local_nome_exibicao: 'Cavalete Horizontal 1 - Nível 2',
  },
  {
    id: 'saldo-3',
    codigo: 'RET-SUP-1450-BRANCO',
    descricao: 'Retalho Perfil Guia Suprema Branco (1.450 mm)',
    tipo_material: 'retalho',
    comprimento_mm: 1450,
    quantidade_saldo: 5,
    unidade: 'PECA',
    lote: 'RET-OP101',
    local_id: 'loc-3',
    local_codigo: 'CAV-H-01-01',
    local_nome_exibicao: 'Cavalete Horizontal 1 - Nível 1',
  },
  {
    id: 'saldo-4',
    codigo: 'VIDRO-TEMP-8MM',
    descricao: 'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm',
    tipo_material: 'vidro',
    comprimento_mm: 2100,
    quantidade_saldo: 14,
    unidade: 'CHAPA',
    lote: 'LOTE-VID-88',
    local_id: 'loc-5',
    local_codigo: 'CAV-V-01',
    local_nome_exibicao: 'Cavalete de Vidro 1',
  },
  {
    id: 'saldo-5',
    codigo: 'ROLD-SUPREMA-DUPLA',
    descricao: 'Roldana Dupla com Rolamento Linha Suprema',
    tipo_material: 'acessorio',
    comprimento_mm: 50,
    quantidade_saldo: 240,
    unidade: 'UN',
    lote: 'LOTE-FERR-10',
    local_id: 'loc-1',
    local_codigo: 'GAV-01-01',
    local_nome_exibicao: 'Gaveta 1 - Prateleira 1',
  },
  {
    id: 'saldo-6',
    codigo: 'PAR-INOX-4238',
    descricao: 'Parafuso Autoatarraxante Inox 4.2 x 38mm (Cabeça Panela)',
    tipo_material: 'acessorio',
    comprimento_mm: 38,
    quantidade_saldo: 1500,
    unidade: 'UN',
    lote: 'LOTE-PAR-04',
    local_id: 'loc-1',
    local_codigo: 'GAV-01-01',
    local_nome_exibicao: 'Gaveta 1 - Prateleira 1',
  },
  {
    id: 'saldo-7',
    codigo: 'ESC-VED-7X6',
    descricao: 'Escova de Vedação com Fita Adesiva 7x6mm Cinza',
    tipo_material: 'acessorio',
    comprimento_mm: 100,
    quantidade_saldo: 12,
    unidade: 'ROLO',
    lote: 'LOTE-ESC-99',
    local_id: 'loc-1',
    local_codigo: 'GAV-01-01',
    local_nome_exibicao: 'Gaveta 1 - Prateleira 1',
  },
  {
    id: 'saldo-8',
    codigo: 'BRAC-MAX-AR-300',
    descricao: 'Braço Articulador em Alumínio 300mm para Maxim-Ar',
    tipo_material: 'acessorio',
    comprimento_mm: 300,
    quantidade_saldo: 45,
    unidade: 'PAR',
    lote: 'LOTE-BRAC-22',
    local_id: 'loc-2',
    local_codigo: 'GAV-01-02',
    local_nome_exibicao: 'Gaveta 1 - Prateleira 2',
  },
  {
    id: 'saldo-9',
    codigo: 'FECH-CONCHA-SUP',
    descricao: 'Fecho Concha Automático com Chave Linha Suprema Preto',
    tipo_material: 'acessorio',
    comprimento_mm: 160,
    quantidade_saldo: 60,
    unidade: 'UN',
    lote: 'LOTE-FECH-07',
    local_id: 'loc-2',
    local_codigo: 'GAV-01-02',
    local_nome_exibicao: 'Gaveta 1 - Prateleira 2',
  },
  {
    id: 'saldo-10',
    codigo: 'VIDRO-LAM-44-VERDE',
    descricao: 'Chapa Vidro Laminado 4+4mm Verde 2200x1605 mm',
    tipo_material: 'vidro',
    comprimento_mm: 2200,
    quantidade_saldo: 8,
    unidade: 'CHAPA',
    lote: 'LOTE-VID-89',
    local_id: 'loc-6',
    local_codigo: 'CAV-V-02',
    local_nome_exibicao: 'Cavalete de Vidro 2',
  },
  {
    id: 'saldo-11',
    codigo: 'ESQ-JAN-2F-1200',
    descricao: 'Janela 2 Folhas Correr Linha Suprema 1200x1200 Branco c/ Vidro Incolor',
    tipo_material: 'esquadria' as any,
    comprimento_mm: 1200,
    quantidade_saldo: 8,
    unidade: 'UN',
    lote: 'OP-2026-089',
    local_id: 'loc-7',
    local_codigo: 'DOCA-RESERVA-LAGOS',
    local_nome_exibicao: 'Doca de Expedição - Obra Reserva dos Lagos',
  },
  {
    id: 'saldo-12',
    codigo: 'PERF-SUP-BRANCO-6M-QUAR',
    descricao: 'Perfil Folha Suprema Branco RAL 9003 (Lote Retido c/ Oxidação)',
    tipo_material: 'perfil_barra',
    comprimento_mm: 6000,
    quantidade_saldo: 24,
    unidade: 'BARRA',
    lote: 'LOTE-QUAR-98124',
    local_id: 'loc-8',
    local_codigo: 'QUA-01',
    local_nome_exibicao: 'Gaiola de Quarentena',
  },
];

const MOVIMENTACOES_SEED: RegistroLedger[] = [
  {
    id: 'mov-1',
    transacao_id: 'TXN-9081',
    data_hora: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    tipo: 'entrada_nf',
    item_codigo: 'PERF-SUP-6M-BRANCO',
    descricao: 'Perfil Barra 6m Suprema Branco Ral 9003',
    tipo_material: 'perfil_barra',
    comprimento_mm: 6000,
    quantidade: 50,
    unidade: 'BARRA',
    local_destino_codigo: 'CAV-H-01-01',
    local_destino_nome: 'Cavalete Horizontal 1 - Nível 1',
    lote: 'LOTE-2026-A1',
    motivo: 'Entrada cega NF-98104 conferida',
    estornado: false,
  },
  {
    id: 'mov-2',
    transacao_id: 'TXN-9082',
    data_hora: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    tipo: 'saida_corte',
    item_codigo: 'PERF-SUP-6M-BRANCO',
    descricao: 'Perfil Barra 6m Suprema Branco Ral 9003',
    tipo_material: 'perfil_barra',
    comprimento_mm: 6000,
    quantidade: 2,
    unidade: 'BARRA',
    local_origem_codigo: 'CAV-H-01-01',
    local_origem_nome: 'Cavalete Horizontal 1 - Nível 1',
    lote: 'LOTE-2026-A1',
    op_origem: 'OP-2026-101',
    motivo: 'Consumo para corte de marcos e travessas',
    estornado: false,
  },
];

export function useStockLedger() {
  const { perfil, pode } = useAuth();
  const [saldos, setSaldos] = useState<ItemSaldoFisico[]>(() => {
    const salvo = localStorage.getItem('esquadrias_v2_saldos');
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        return SALDOS_SEED;
      }
    }
    return SALDOS_SEED;
  });

  const [movimentacoes, setMovimentacoes] = useState<RegistroLedger[]>(() => {
    const salvo = localStorage.getItem('esquadrias_v2_ledger');
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        return MOVIMENTACOES_SEED;
      }
    }
    return MOVIMENTACOES_SEED;
  });

  useEffect(() => {
    localStorage.setItem('esquadrias_v2_saldos', JSON.stringify(saldos));
  }, [saldos]);

  useEffect(() => {
    localStorage.setItem('esquadrias_v2_ledger', JSON.stringify(movimentacoes));
  }, [movimentacoes]);

  // Apontamento de Corte com a Regra Crítica de Sobras:
  // Sobra >= 300 mm -> Retalho etiquetado e alocado no cavalete
  // Sobra < 300 mm -> Sucata de alumínio encaminhada para caçamba
  const registrarApontamentoCorte = (params: {
    op: string;
    itemOrigem: ItemSaldoFisico;
    comprimentoConsumidoMm: number;
    comprimentoSobraMm: number;
    localDestinoRetalho?: { codigo: string; nome: string };
  }) => {
    const { op, itemOrigem, comprimentoConsumidoMm, comprimentoSobraMm, localDestinoRetalho } = params;

    // 1. Saída da Barra Original no Ledger
    const saidaId = `mov-${Date.now()}-1`;
    const movSaida: RegistroLedger = {
      id: saidaId,
      transacao_id: `TXN-CORTE-${Date.now()}`,
      data_hora: new Date().toISOString(),
      tipo: 'saida_corte',
      item_codigo: itemOrigem.codigo,
      descricao: itemOrigem.descricao,
      tipo_material: itemOrigem.tipo_material,
      comprimento_mm: itemOrigem.comprimento_mm,
      quantidade: 1,
      unidade: itemOrigem.unidade,
      local_origem_codigo: itemOrigem.local_codigo,
      local_origem_nome: itemOrigem.local_nome_exibicao,
      lote: itemOrigem.lote,
      op_origem: op,
      motivo: `Apontamento de corte para ${op} (Consumo: ${comprimentoConsumidoMm} mm)`,
      estornado: false,
    };

    // 2. Destino da Sobra
    const ehRetalhoReaproveitavel = comprimentoSobraMm >= 300;
    let movSobra: RegistroLedger | null = null;

    if (ehRetalhoReaproveitavel) {
      // Sobra >= 300 mm vira retalho reaproveitável
      const codRetalho = `RET-${itemOrigem.codigo.replace('PERF-', '')}-${comprimentoSobraMm}`;
      movSobra = {
        id: `mov-${Date.now()}-2`,
        transacao_id: `TXN-RET-${Date.now()}`,
        data_hora: new Date().toISOString(),
        tipo: 'geracao_retalho',
        item_codigo: codRetalho,
        descricao: `Retalho ${itemOrigem.descricao.split('(')[0].trim()} (${comprimentoSobraMm} mm)`,
        tipo_material: 'retalho',
        comprimento_mm: comprimentoSobraMm,
        quantidade: 1,
        unidade: 'PECA',
        local_destino_codigo: localDestinoRetalho?.codigo || itemOrigem.local_codigo,
        local_destino_nome: localDestinoRetalho?.nome || itemOrigem.local_nome_exibicao,
        lote: `RET-${op}`,
        op_origem: op,
        motivo: `Retalho reaproveitável gerado (Sobra ≥ 300 mm: ${comprimentoSobraMm} mm)`,
        estornado: false,
      };

      // Adiciona retalho aos saldos físicos
      setSaldos((prev) => [
        ...prev,
        {
          id: `saldo-ret-${Date.now()}`,
          codigo: codRetalho,
          descricao: `Retalho ${itemOrigem.descricao.split('(')[0].trim()} (${comprimentoSobraMm} mm)`,
          tipo_material: 'retalho',
          comprimento_mm: comprimentoSobraMm,
          quantidade_saldo: 1,
          unidade: 'PECA',
          lote: `RET-${op}`,
          local_id: 'loc-3',
          local_codigo: localDestinoRetalho?.codigo || itemOrigem.local_codigo,
          local_nome_exibicao: localDestinoRetalho?.nome || itemOrigem.local_nome_exibicao,
        },
      ]);
    } else if (comprimentoSobraMm > 0) {
      // Sobra < 300 mm segue para caçamba de sucata
      movSobra = {
        id: `mov-${Date.now()}-2`,
        transacao_id: `TXN-SUC-${Date.now()}`,
        data_hora: new Date().toISOString(),
        tipo: 'descarte_sucata',
        item_codigo: 'SUCATA-ALUMINIO',
        descricao: `Sucata Metálica Perfil (${comprimentoSobraMm} mm descartados)`,
        tipo_material: 'retalho',
        comprimento_mm: comprimentoSobraMm,
        quantidade: 1,
        unidade: 'PECA',
        local_destino_codigo: 'CACAMBA-SUCATA',
        local_destino_nome: 'Caçamba de Sucata de Alumínio',
        lote: 'SUCATA',
        op_origem: op,
        motivo: `Descarte obrigatório (Sobra < 300 mm: ${comprimentoSobraMm} mm)`,
        estornado: false,
      };
    }

    // Deduz 1 barra do saldo original
    setSaldos((prev) =>
      prev.map((s) =>
        s.id === itemOrigem.id
          ? { ...s, quantidade_saldo: Math.max(0, s.quantidade_saldo - 1) }
          : s
      )
    );

    // Registra no ledger append-only
    const novosMovs = movSobra ? [movSaida, movSobra] : [movSaida];
    setMovimentacoes((prev) => [...novosMovs, ...prev]);

    toast.success(`Corte da OP ${op} apontado com sucesso!`, {
      description: ehRetalhoReaproveitavel
        ? `Sobra de ${comprimentoSobraMm} mm gerou retalho reaproveitável etiquetado.`
        : `Sobra de ${comprimentoSobraMm} mm (< 300 mm) destinada à caçamba de sucata.`,
    });
  };

  // Estorno Seguro de Movimentação no Ledger (Append-Only)
  const estornarMovimentacao = (movId: string, motivoEstorno: string) => {
    const original = movimentacoes.find((m) => m.id === movId);
    if (!original) return;

    if (original.estornado) {
      toast.warning('Esta movimentação já foi estornada anteriormente.');
      return;
    }

    // Registra linha de estorno (contra-partida)
    const movEstorno: RegistroLedger = {
      id: `mov-estorno-${Date.now()}`,
      transacao_id: `ESTORNO-${original.transacao_id}`,
      data_hora: new Date().toISOString(),
      tipo: 'estorno',
      item_codigo: original.item_codigo,
      descricao: `[ESTORNO] ${original.descricao}`,
      tipo_material: original.tipo_material,
      comprimento_mm: original.comprimento_mm,
      quantidade: original.quantidade,
      unidade: original.unidade,
      local_origem_codigo: original.local_destino_codigo,
      local_origem_nome: original.local_destino_nome,
      local_destino_codigo: original.local_origem_codigo,
      local_destino_nome: original.local_origem_nome,
      lote: original.lote,
      op_origem: original.op_origem,
      motivo: `Estorno da transação ${original.transacao_id}. Justificativa: ${motivoEstorno}`,
      estornado: false,
    };

    // Marca original como estornado
    setMovimentacoes((prev) => [
      movEstorno,
      ...prev.map((m) => (m.id === movId ? { ...m, estornado: true } : m)),
    ]);

    toast.success(`Transação ${original.transacao_id} estornada no ledger append-only.`);
  };

  // Cadastro e Inserção de Novo Material no Estoque
  const adicionarMaterialAoEstoque = (params: {
    codigo: string;
    descricao: string;
    tipo_material: 'perfil_barra' | 'retalho' | 'vidro' | 'acessorio';
    comprimento_mm?: number;
    quantidade: number;
    unidade: string;
    lote?: string;
    local_id?: string;
    local_codigo?: string;
    local_nome_exibicao?: string;
    obra_destino?: string;
    nf?: string;
    observacao?: string;
  }) => {
    const movEntrada: RegistroLedger = {
      id: `mov-${Date.now()}`,
      transacao_id: `TXN-ENTRADA-${Date.now()}`,
      data_hora: new Date().toISOString(),
      tipo: 'entrada_nf',
      item_codigo: params.codigo,
      descricao: params.descricao,
      tipo_material: params.tipo_material,
      comprimento_mm: params.comprimento_mm || 0,
      quantidade: params.quantidade,
      unidade: params.unidade,
      local_destino_codigo: params.local_codigo || 'GAV-01-01',
      local_destino_nome: params.local_nome_exibicao || 'Gaveta 1 - Prateleira 1',
      lote: params.lote || `LOTE-${new Date().getFullYear()}-MANUAL`,
      motivo: `Entrada de material (${params.obra_destino ? `Obra: ${params.obra_destino}` : 'Estoque Geral'}). ${params.observacao || ''}`,
      estornado: false,
    };

    setSaldos((prev) => {
      const idx = prev.findIndex(
        (s) => s.codigo === params.codigo && s.local_codigo === (params.local_codigo || 'GAV-01-01')
      );
      if (idx >= 0) {
        const atualizado = [...prev];
        atualizado[idx] = {
          ...atualizado[idx],
          quantidade_saldo: atualizado[idx].quantidade_saldo + params.quantidade,
        };
        return atualizado;
      }
      return [
        ...prev,
        {
          id: `saldo-${Date.now()}`,
          codigo: params.codigo,
          descricao: params.descricao,
          tipo_material: params.tipo_material,
          comprimento_mm: params.comprimento_mm || 0,
          quantidade_saldo: params.quantidade,
          unidade: params.unidade,
          lote: params.lote || `LOTE-${new Date().getFullYear()}-MANUAL`,
          local_id: params.local_id || 'loc-1',
          local_codigo: params.local_codigo || 'GAV-01-01',
          local_nome_exibicao: params.local_nome_exibicao || 'Gaveta 1 - Prateleira 1',
        },
      ];
    });

    setMovimentacoes((prev) => [movEntrada, ...prev]);
  };

  return {
    saldos,
    movimentacoes,
    registrarApontamentoCorte,
    estornarMovimentacao,
    adicionarMaterialAoEstoque,
  };
}

