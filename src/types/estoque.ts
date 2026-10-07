// ============================================================================
// TYPES: src/types/estoque.ts
// Tipagens centrais para endereçamento, locais e itens fabris v2
// ============================================================================

export type AreaLogica =
  | 'materia_prima'
  | 'almoxarifado'
  | 'corte'
  | 'usinagem'
  | 'montagem'
  | 'vidros'
  | 'acessorios'
  | 'quarentena'
  | 'expedicao'
  | 'doca';

export type TipoLocal =
  | 'gaveta'
  | 'cavalete_horizontal'
  | 'cavalete_vidro'
  | 'doca'
  | 'quarentena'
  | 'prateleira'
  | 'palete';

export type TipoMaterial =
  | 'perfil_barra'
  | 'retalho'
  | 'vidro'
  | 'acessorio'
  | 'esquadria';

export interface LocalEstoque {
  id: string;
  codigo: string;              // Ex: "GAV-01-02", "CAV-H-01-03", "DOCA-OBRA-102"
  nome_exibicao: string;       // Ex: "Gaveta 1 - Prateleira 2", "Cavalete Horizontal 1 - Nível 3"
  tipo: TipoLocal;
  area_logica: AreaLogica;
  numero?: number;
  subnivel?: number;
  obra_destino?: string;
  capacidade_max_kg: number;
  comprimento_max_mm: number;
  ocupacao_atual_kg?: number;
  ativo: boolean;
  total_itens?: number;
}

export interface ItemMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: TipoMaterial;
  comprimento_mm?: number;
  largura_mm?: number;
  espessura_mm?: number;
  peso_kg?: number;
  unidade_medida: string;
}

export interface EstoqueItemAlocado {
  id: string;
  item_id: string;
  local_id: string;
  item: ItemMaterial;
  local: LocalEstoque;
  quantidade: number;
  lote: string;
  created_at: string;
}

export interface CriarLocaisLoteDTO {
  tipo: TipoLocal;
  quantidade: number;
  subniveis: number;
  area_logica: AreaLogica;
  prefixo?: string;
  obra?: string;
  capacidade_kg?: number;
  comprimento_mm?: number;
}
