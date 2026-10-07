// ============================================================================
// HOOK: src/hooks/useObras.ts
// Gerenciamento de Obras Fabris, Vínculo de Materiais e Prazos de Entrega
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';

export interface ObraItem {
  id: string;
  nome: string;
  cliente: string;
  endereco: string;
  status: 'planejada' | 'em_producao' | 'aguardando_materiais' | 'concluida';
  dataPrometida: string;
  totalEsquadrias: number;
  totalMateriaisAlocados: number;
  progressoPct: number;
  criadaEm: string;
}

const OBRAS_INICIAIS: ObraItem[] = [
  {
    id: 'obra-1',
    nome: 'Edifício Alpha Tower',
    cliente: 'Construtora Metropolitana S/A',
    endereco: 'Av. Paulista, 1842 - São Paulo/SP',
    status: 'em_producao',
    dataPrometida: '15/11/2026',
    totalEsquadrias: 48,
    totalMateriaisAlocados: 142,
    progressoPct: 65,
    criadaEm: '01/09/2026',
  },
  {
    id: 'obra-2',
    nome: 'Residencial Reserva dos Lagos',
    cliente: 'Lagos Empreendimentos Imobiliários',
    endereco: 'Al. dos Eucaliptos, 450 - Campinas/SP',
    status: 'aguardando_materiais',
    dataPrometida: '30/11/2026',
    totalEsquadrias: 32,
    totalMateriaisAlocados: 85,
    progressoPct: 30,
    criadaEm: '15/09/2026',
  },
  {
    id: 'obra-3',
    nome: 'Hospital Unimed Sul',
    cliente: 'Unimed Cooperativa Médica',
    endereco: 'Rua das Palmeiras, 800 - Santos/SP',
    status: 'planejada',
    dataPrometida: '20/12/2026',
    totalEsquadrias: 60,
    totalMateriaisAlocados: 12,
    progressoPct: 10,
    criadaEm: '01/10/2026',
  },
];

export function useObras() {
  const [obras, setObras] = useState<ObraItem[]>(() => {
    const salvo = localStorage.getItem('alufort_obras_lista');
    return salvo ? JSON.parse(salvo) : OBRAS_INICIAIS;
  });
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    localStorage.setItem('alufort_obras_lista', JSON.stringify(obras));
  }, [obras]);

  const cadastrarObra = async (dados: {
    nome: string;
    cliente: string;
    endereco: string;
    dataPrometida: string;
  }): Promise<{ sucesso: boolean; obra?: ObraItem }> => {
    if (!dados.nome.trim()) {
      toast.error('Informe o nome da obra.');
      return { sucesso: false };
    }

    const novaObra: ObraItem = {
      id: `obra-${Date.now()}`,
      nome: dados.nome.trim(),
      cliente: dados.cliente.trim() || 'Cliente Fabril',
      endereco: dados.endereco.trim() || 'Endereço da Obra',
      status: 'planejada',
      dataPrometida: dados.dataPrometida || '30 dias',
      totalEsquadrias: 0,
      totalMateriaisAlocados: 0,
      progressoPct: 0,
      criadaEm: new Date().toLocaleDateString('pt-BR'),
    };

    setObras((prev) => [novaObra, ...prev]);

    // Opcional: registrar como pedido no Supabase
    if (isSupabaseConfigured) {
      try {
        await supabase.from('pedidos').insert({
          numero_pedido: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
          obra_destino: novaObra.nome,
          cliente_nome: novaObra.cliente,
          status: 'planejado',
        });
      } catch (e) {
        console.warn('Erro ao sincronizar pedido no Supabase:', e);
      }
    }

    toast.success(`Obra "${novaObra.nome}" cadastrada com sucesso!`);
    return { sucesso: true, obra: novaObra };
  };

  return {
    obras,
    carregando,
    cadastrarObra,
  };
}

