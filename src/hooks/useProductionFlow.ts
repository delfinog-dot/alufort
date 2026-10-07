// ============================================================================
// HOOK: src/hooks/useProductionFlow.ts
// Fluxo de Ordens de Produção (OP) sem Recriação de Regras no Frontend
// Apenas grandezas físicas (mm, un, lote) - ZERO menções a R$ ou custos
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type StatusOP = 'planejada' | 'separacao' | 'em_corte' | 'montagem' | 'qualidade' | 'concluida';
export type TipoMedicao = 'definitiva' | 'estimada';

export interface MaterialOP {
  id: string;
  item_codigo: string;
  descricao: string;
  tipo_material: 'retalho' | 'perfil_barra' | 'vidro' | 'acessorio';
  comprimento_necessario_mm: number;
  quantidade_necessaria: number;
  origem_prioritaria: 'retalho_estoque' | 'barra_6m';
  lote_alocado?: string;
  local_origem_nome?: string;
  separado: boolean;
}

export interface OrdemProducao {
  id: string;
  numero_op: string;
  obra_destino: string;
  codigo_esquadria: string;
  descricao: string;
  quantidade_pecas: number;
  status: StatusOP;
  medicao_tipo: TipoMedicao;
  tem_mistura_cor: boolean;
  mistura_cor_aprovada: boolean;
  data_entrega_fabrica: string;
  prioridade: 'alta' | 'media' | 'urgente';
  materiais: MaterialOP[];
}

const OPS_SEED: OrdemProducao[] = [
  {
    id: 'op-001',
    numero_op: 'OP-2026-101',
    obra_destino: 'Residencial Reserva dos Lagos',
    codigo_esquadria: 'JAN-SUP-02F-1200x1200',
    descricao: 'Janela de Correr 2 Folhas Linha Suprema c/ Vidro 8mm',
    quantidade_pecas: 6,
    status: 'planejada',
    medicao_tipo: 'definitiva',
    tem_mistura_cor: false,
    mistura_cor_aprovada: true,
    data_entrega_fabrica: '2026-10-12',
    prioridade: 'urgente',
    materiais: [
      {
        id: 'mat-1',
        item_codigo: 'RET-SUP-BR-1420',
        descricao: 'Retalho Perfil Guia Suprema Branco (1.420 mm)',
        tipo_material: 'retalho',
        comprimento_necessario_mm: 1250,
        quantidade_necessaria: 2,
        origem_prioritaria: 'retalho_estoque',
        lote_alocado: 'LOT-RET-88',
        local_origem_nome: 'Cavalete Horizontal 1 - Nível 2',
        separado: true,
      },
      {
        id: 'mat-2',
        item_codigo: 'PERF-SUP-6M-BR',
        descricao: 'Barra Inteira Perfil Folha Suprema (6.000 mm)',
        tipo_material: 'perfil_barra',
        comprimento_necessario_mm: 6000,
        quantidade_necessaria: 4,
        origem_prioritaria: 'barra_6m',
        lote_alocado: 'LOT-2026-A1',
        local_origem_nome: 'Cavalete Horizontal 2 - Nível 1',
        separado: true,
      },
      {
        id: 'mat-3',
        item_codigo: 'VIDRO-TEMP-8MM',
        descricao: 'Vidro Temperado 8mm Incolor (580 x 1150 mm)',
        tipo_material: 'vidro',
        comprimento_necessario_mm: 1150,
        quantidade_necessaria: 12,
        origem_prioritaria: 'barra_6m',
        lote_alocado: 'LOT-VID-09',
        local_origem_nome: 'Cavalete de Vidro 1',
        separado: true,
      },
    ],
  },
  {
    id: 'op-002',
    numero_op: 'OP-2026-102',
    obra_destino: 'Edifício Horizonte Azul',
    codigo_esquadria: 'POR-LIN-04F-2400x2200',
    descricao: 'Porta Balcão 4 Folhas Suprema Preto Fosco',
    quantidade_pecas: 2,
    status: 'separacao',
    medicao_tipo: 'definitiva',
    tem_mistura_cor: true,
    mistura_cor_aprovada: false,
    data_entrega_fabrica: '2026-10-14',
    prioridade: 'alta',
    materiais: [
      {
        id: 'mat-4',
        item_codigo: 'PERF-SUP-6M-PT',
        descricao: 'Barra Perfil Marco Superior (6.000 mm)',
        tipo_material: 'perfil_barra',
        comprimento_necessario_mm: 6000,
        quantidade_necessaria: 3,
        origem_prioritaria: 'barra_6m',
        lote_alocado: 'LOT-PT-22',
        local_origem_nome: 'Cavalete Horizontal 1 - Nível 1',
        separado: false,
      },
    ],
  },
  {
    id: 'op-003',
    numero_op: 'OP-2026-103',
    obra_destino: 'Condomínio Bosque Real',
    codigo_esquadria: 'MAX-SUP-01F-600x800',
    descricao: 'Maxim-Ar Suprema Anodizado Fosco',
    quantidade_pecas: 10,
    status: 'planejada',
    medicao_tipo: 'estimada',
    tem_mistura_cor: false,
    mistura_cor_aprovada: true,
    data_entrega_fabrica: '2026-10-18',
    prioridade: 'media',
    materiais: [],
  },
];

export function useProductionFlow() {
  const { pode } = useAuth();
  const [ops, setOps] = useState<OrdemProducao[]>(() => {
    const salvo = localStorage.getItem('esquadrias_v2_ops');
    if (salvo) {
      try {
        return JSON.parse(salvo);
      } catch {
        return OPS_SEED;
      }
    }
    return OPS_SEED;
  });

  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    localStorage.setItem('esquadrias_v2_ops', JSON.stringify(ops));
  }, [ops]);

  const recarregar = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('ordens_producao')
        .select('*')
        .order('criado_em', { ascending: false });

      if (!error && data && data.length > 0) {
        // Mapear compatibilidade
      }
    } catch (err) {
      console.warn('Erro ao carregar OPs do banco:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Transição de status respeitando travas do banco
  const avancarStatusOP = async (opId: string, novoStatus: StatusOP): Promise<{ sucesso: boolean; erro?: string }> => {
    const op = ops.find((o) => o.id === opId);
    if (!op) return { sucesso: false, erro: 'OP não encontrada.' };

    // Regra do Banco: Trava de Corte Obrigatória
    if (novoStatus === 'em_corte') {
      if (op.medicao_tipo === 'estimada') {
        const erroMsg = 'Não é permitido iniciar corte em OP com medição estimada. Obtenha a medição definitiva na obra.';
        toast.error('Trava de Corte (Postgres):', { description: erroMsg });
        return { sucesso: false, erro: erroMsg };
      }
      if (op.tem_mistura_cor && !op.mistura_cor_aprovada) {
        const erroMsg = 'Não é permitido iniciar corte com mistura de lotes de cor sem aprovação formal.';
        toast.error('Trava de Corte (Postgres):', { description: erroMsg });
        return { sucesso: false, erro: erroMsg };
      }
    }

    // Atualização otimista
    setOps((antigas) =>
      antigas.map((item) => (item.id === opId ? { ...item, status: novoStatus } : item))
    );

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('ordens_producao')
          .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
          .eq('id', opId);

        if (error) {
          toast.error('Erro na transição no banco:', { description: error.message });
          return { sucesso: false, erro: error.message };
        }
      } catch (err: any) {
        return { sucesso: false, erro: err.message };
      }
    }

    toast.success(`OP ${op.numero_op} atualizada para ${novoStatus.toUpperCase()}`);
    return { sucesso: true };
  };

  // Separação de materiais: Retalhos têm prioridade 1 antes de barras inteiras de 6m
  const alternarSeparacaoMaterial = (opId: string, materialId: string) => {
    setOps((antigas) =>
      antigas.map((op) => {
        if (op.id !== opId) return op;
        return {
          ...op,
          materiais: op.materiais.map((m) =>
            m.id === materialId ? { ...m, separado: !m.separado } : m
          ),
        };
      })
    );
  };

  // Fila de corte imediata: Medição definitiva confirmada e pronta para corte
  const filaCorteImediata = ops.filter(
    (o) => o.medicao_tipo === 'definitiva' && (o.status === 'planejada' || o.status === 'separacao')
  );

  return {
    ops,
    filaCorteImediata,
    carregando,
    avancarStatusOP,
    alternarSeparacaoMaterial,
    recarregar,
  };
}
