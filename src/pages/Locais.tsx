// ============================================================================
// PAGE: src/pages/Locais.tsx
// Gestão de Endereçamento Físico, Visualizador Kanban de Gavetas & Inserção de Materiais
// ============================================================================

import React, { useState } from 'react';
import {
  LocalEstoque,
  AreaLogica,
  TipoLocal,
  TipoMaterial,
  CriarLocaisLoteDTO,
} from '../types/estoque';
import { SeletorLocal, AREA_LOGICA_LABELS, SeletorTipoMaterial } from '../components/seletores';
import { EtiquetaTermica, ModalImpressaoEtiquetas } from '../components/Etiqueta';
import { CadastroMaterialIA } from '../components/materiais/CadastroMaterialIA';
import { useStockLedger, ItemSaldoFisico } from '../hooks/useStockLedger';
import {
  Warehouse,
  Plus,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  Layers,
  Box,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  QrCode,
  Tag,
  ArrowRight,
  Eye,
  LayoutGrid,
  Columns3,
  Package,
  Check,
  Building,
  Info,
} from 'lucide-react';

// Dados iniciais representativos do ambiente fabril
const LOCAIS_INICIAIS: LocalEstoque[] = [
  {
    id: 'loc-1',
    codigo: 'GAV-01-01',
    nome_exibicao: 'Gaveta 1 - Prateleira 1',
    tipo: 'gaveta',
    area_logica: 'almoxarifado',
    numero: 1,
    subnivel: 1,
    capacidade_max_kg: 80,
    comprimento_max_mm: 1000,
    ativo: true,
    total_itens: 3,
  },
  {
    id: 'loc-2',
    codigo: 'GAV-01-02',
    nome_exibicao: 'Gaveta 1 - Prateleira 2',
    tipo: 'gaveta',
    area_logica: 'almoxarifado',
    numero: 1,
    subnivel: 2,
    capacidade_max_kg: 80,
    comprimento_max_mm: 1000,
    ativo: true,
    total_itens: 2,
  },
  {
    id: 'loc-3',
    codigo: 'CAV-H-01-01',
    nome_exibicao: 'Cavalete Horizontal 1 - Nível 1',
    tipo: 'cavalete_horizontal',
    area_logica: 'materia_prima',
    numero: 1,
    subnivel: 1,
    capacidade_max_kg: 2500,
    comprimento_max_mm: 6500,
    ativo: true,
    total_itens: 2,
  },
  {
    id: 'loc-4',
    codigo: 'CAV-H-01-02',
    nome_exibicao: 'Cavalete Horizontal 1 - Nível 2',
    tipo: 'cavalete_horizontal',
    area_logica: 'materia_prima',
    numero: 1,
    subnivel: 2,
    capacidade_max_kg: 2500,
    comprimento_max_mm: 6500,
    ativo: true,
    total_itens: 1,
  },
  {
    id: 'loc-5',
    codigo: 'CAV-V-01',
    nome_exibicao: 'Cavalete de Vidro 1',
    tipo: 'cavalete_vidro',
    area_logica: 'vidros',
    numero: 1,
    capacidade_max_kg: 1800,
    comprimento_max_mm: 3210,
    ativo: true,
    total_itens: 1,
  },
  {
    id: 'loc-6',
    codigo: 'CAV-V-02',
    nome_exibicao: 'Cavalete de Vidro 2',
    tipo: 'cavalete_vidro',
    area_logica: 'vidros',
    numero: 2,
    capacidade_max_kg: 1800,
    comprimento_max_mm: 3210,
    ativo: true,
    total_itens: 1,
  },
  {
    id: 'loc-7',
    codigo: 'DOCA-RESERVA-LAGOS',
    nome_exibicao: 'Doca de Expedição - Obra Reserva dos Lagos',
    tipo: 'doca',
    area_logica: 'doca',
    obra_destino: 'Reserva dos Lagos',
    capacidade_max_kg: 5000,
    comprimento_max_mm: 7000,
    ativo: true,
    total_itens: 1,
  },
  {
    id: 'loc-8',
    codigo: 'QUA-01',
    nome_exibicao: 'Gaiola de Quarentena',
    tipo: 'quarentena',
    area_logica: 'quarentena',
    capacidade_max_kg: 1200,
    comprimento_max_mm: 6500,
    ativo: true,
    total_itens: 1,
  },
];

export const LocaisPage: React.FC = () => {
  const [locais, setLocais] = useState<LocalEstoque[]>(LOCAIS_INICIAIS);
  const { saldos } = useStockLedger();
  const [busca, setBusca] = useState('');
  const [filtroArea, setFiltroArea] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [visao, setVisao] = useState<'kanban' | 'grade'>('kanban');

  // Modais
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [modalCadastroMaterialAberto, setModalCadastroMaterialAberto] = useState(false);
  const [localPreSelecionadoParaCadastro, setLocalPreSelecionadoParaCadastro] = useState<string | undefined>(undefined);
  const [locaisParaImprimir, setLocaisParaImprimir] = useState<LocalEstoque[]>([]);
  const [modalImpressaoAberto, setModalImpressaoAberto] = useState(false);

  // Modal de Inspeção de Gaveta / Local
  const [localInspecionado, setLocalInspecionado] = useState<LocalEstoque | null>(null);

  // Formulário de Criação em Lote (espelha criar_locais_em_lote)
  const [formLote, setFormLote] = useState<CriarLocaisLoteDTO>({
    tipo: 'cavalete_horizontal',
    quantidade: 2,
    subniveis: 3,
    area_logica: 'materia_prima',
    prefixo: 'CAV-H',
    obra: '',
    capacidade_kg: 2500,
    comprimento_mm: 6500,
  });

  // Função auxiliar de geração pura do nome humano
  const gerarNomeHumanoClient = (
    tipo: TipoLocal,
    num?: number,
    sub?: number,
    obra?: string,
    codigo?: string
  ): string => {
    if (tipo === 'gaveta') return `Gaveta ${num || 1} - Prateleira ${sub || 1}`;
    if (tipo === 'cavalete_horizontal') return `Cavalete Horizontal ${num || 1} - Nível ${sub || 1}`;
    if (tipo === 'cavalete_vidro') return `Cavalete de Vidro ${num || 1}`;
    if (tipo === 'doca') return `Doca de Expedição - Obra ${obra || codigo || 'Geral'}`;
    if (tipo === 'quarentena') return 'Gaiola de Quarentena';
    return `${tipo} ${num || ''}`;
  };

  // Submissão do lote
  const handleCriarLote = (e: React.FormEvent) => {
    e.preventDefault();
    const novos: LocalEstoque[] = [];
    const prefixo = formLote.prefixo || (formLote.tipo === 'gaveta' ? 'GAV' : 'CAV-H');

    for (let i = 1; i <= formLote.quantidade; i++) {
      for (let j = 1; j <= formLote.subniveis; j++) {
        const cod =
          formLote.tipo === 'doca'
            ? `DOCA-${(formLote.obra || 'GERAL').toUpperCase().replace(/\s+/g, '-')}`
            : formLote.tipo === 'cavalete_vidro'
            ? `CAV-V-${String(i).padStart(2, '0')}`
            : `${prefixo}-${String(i).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

        const nome = gerarNomeHumanoClient(formLote.tipo, i, j, formLote.obra, cod);

        novos.push({
          id: `loc-gerado-${Date.now()}-${i}-${j}`,
          codigo: cod,
          nome_exibicao: nome,
          tipo: formLote.tipo,
          area_logica: formLote.area_logica,
          numero: i,
          subnivel: j,
          obra_destino: formLote.obra || undefined,
          capacidade_max_kg: formLote.capacidade_kg || 1000,
          comprimento_max_mm: formLote.comprimento_mm || 6500,
          ativo: true,
          total_itens: 0,
        });
      }
    }

    setLocais((antigos) => [...antigos, ...novos]);
    setModalLoteAberto(false);
  };

  // Obter itens armazenados em um local específico
  const obterMateriaisDoLocal = (local: LocalEstoque): ItemSaldoFisico[] => {
    return saldos.filter(
      (s) =>
        s.local_id === local.id ||
        s.local_codigo === local.codigo ||
        (local.codigo.startsWith('GAV') && s.local_codigo === local.codigo)
    );
  };

  // Filtragem dos locais
  const locaisFiltrados = locais.filter((l) => {
    const matchBusca =
      l.nome_exibicao.toLowerCase().includes(busca.toLowerCase()) ||
      l.codigo.toLowerCase().includes(busca.toLowerCase()) ||
      (l.obra_destino && l.obra_destino.toLowerCase().includes(busca.toLowerCase()));
    const matchArea = filtroArea === 'todos' || l.area_logica === filtroArea;
    const matchTipo = filtroTipo === 'todos' || l.tipo === filtroTipo;
    return matchBusca && matchArea && matchTipo;
  });

  // Categorias para a visão Kanban
  const colunasKanban = [
    {
      tipo: 'gaveta' as TipoLocal,
      titulo: 'Gavetas do Almoxarifado',
      subtitulo: 'Acessórios, Roldanas, Fechos e Fixadores',
      icone: Box,
      corFundo: 'bg-emerald-50/60',
      corBorda: 'border-emerald-200',
      corBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      corIcone: 'text-emerald-700 bg-emerald-100',
      locais: locaisFiltrados.filter((l) => l.tipo === 'gaveta'),
    },
    {
      tipo: 'cavalete_horizontal' as TipoLocal,
      titulo: 'Cavaletes de Perfis 6m',
      subtitulo: 'Barras inteiras de alumínio e retalhos ≥ 300mm',
      icone: Layers,
      corFundo: 'bg-blue-50/60',
      corBorda: 'border-blue-200',
      corBadge: 'bg-blue-100 text-blue-800 border-blue-300',
      corIcone: 'text-blue-700 bg-blue-100',
      locais: locaisFiltrados.filter((l) => l.tipo === 'cavalete_horizontal'),
    },
    {
      tipo: 'cavalete_vidro' as TipoLocal,
      titulo: 'Cavaletes de Vidro',
      subtitulo: 'Chapas temperadas e laminadas com apoio emborrachado',
      icone: Sparkles,
      corFundo: 'bg-cyan-50/60',
      corBorda: 'border-cyan-200',
      corBadge: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      corIcone: 'text-cyan-700 bg-cyan-100',
      locais: locaisFiltrados.filter((l) => l.tipo === 'cavalete_vidro'),
    },
    {
      tipo: 'doca' as TipoLocal,
      titulo: 'Docas de Expedição',
      subtitulo: 'Esquadrias montadas e embaladas por Obra',
      icone: Truck,
      corFundo: 'bg-teal-50/60',
      corBorda: 'border-teal-200',
      corBadge: 'bg-teal-100 text-teal-800 border-teal-300',
      corIcone: 'text-teal-700 bg-teal-100',
      locais: locaisFiltrados.filter((l) => l.tipo === 'doca'),
    },
    {
      tipo: 'quarentena' as TipoLocal,
      titulo: 'Gaiola de Quarentena',
      subtitulo: 'Materiais com divergência ou laudo pendente',
      icone: ShieldAlert,
      corFundo: 'bg-rose-50/60',
      corBorda: 'border-rose-200',
      corBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      corIcone: 'text-rose-700 bg-rose-100',
      locais: locaisFiltrados.filter((l) => l.tipo === 'quarentena'),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-150">
      {/* Top Banner Institucional */}
      <div className="bg-[#12264A] text-white p-6 rounded-2xl border border-[#2A3F5C] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 font-mono flex items-center gap-1.5 shadow-xs">
              <Warehouse className="w-3.5 h-3.5" />
              Gestão de Almoxarifado & Locais
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Arquitetura Fabril • Nomenclatura Operacional & Gavetas
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Endereçamento Físico e Nomenclatura
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed mt-0.5">
            Visualização em Kanban de gavetas e compartimentos com conferência em tempo real de materiais estocados e controle dimensional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
          <button
            onClick={() => {
              setLocalPreSelecionadoParaCadastro(undefined);
              setModalCadastroMaterialAberto(true);
            }}
            className="px-4 py-2.5 text-xs font-black text-slate-950 bg-[#00B2D6] hover:bg-[#009bbd] rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Inserir / Cadastrar Material</span>
          </button>

          <button
            onClick={() => setModalLoteAberto(true)}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Locais em Lote</span>
          </button>

          <button
            onClick={() => {
              setLocaisParaImprimir(locaisFiltrados);
              setModalImpressaoAberto(true);
            }}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Etiquetas ({locaisFiltrados.length})</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo Operacional */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total de Locais</div>
          <div className="text-xl font-black text-slate-900 mt-1">{locais.length}</div>
          <div className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 100% Identificados
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Gavetas Almoxarifado</div>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {locais.filter((l) => l.tipo === 'gaveta').length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Acessórios e ferragens</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Cavaletes de Perfis</div>
          <div className="text-xl font-black text-blue-700 mt-1">
            {locais.filter((l) => l.tipo === 'cavalete_horizontal').length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Barras inteiras de 6m</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Cavaletes de Vidro</div>
          <div className="text-xl font-black text-cyan-700 mt-1">
            {locais.filter((l) => l.tipo === 'cavalete_vidro').length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Exclusivo chapas</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Docas de Carga</div>
          <div className="text-xl font-black text-teal-700 mt-1">
            {locais.filter((l) => l.tipo === 'doca').length}
          </div>
          <div className="text-[10px] text-teal-700 mt-1 font-semibold">Organização por Obra</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Quarentena</div>
          <div className="text-xl font-black text-rose-700 mt-1">
            {locais.filter((l) => l.tipo === 'quarentena').length}
          </div>
          <div className="text-[10px] text-rose-600 mt-1 font-semibold">Gaiola isolada</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SIMULADOR DE VALIDAÇÃO DE BANCO (Trigger: validar_alocacao_item_local)    */}
      {/* COMENTADO CONFORME SOLICITAÇÃO DO USUÁRIO                                */}
      {/* ========================================================================= */}
      {/*
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl p-5 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00B2D6]/20 border border-[#00B2D6]/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#00B2D6]" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Simulador de Validação de Banco (Trigger: validar_alocacao_item_local)
              </h2>
              <p className="text-xs text-slate-400">
                Experimente alocar materiais incompatíveis para verificar as exceções levantadas pelo Postgres em português.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-slate-800 px-2.5 py-1 rounded text-cyan-300 border border-slate-700">
            Regra no Banco de Dados
          </span>
        </div>
      </div>
      */}

      {/* Barra de Filtros, Busca e Alternância de Visualização */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar gaveta, cavalete ou código..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#00B2D6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Seletor de Visão: Kanban vs Grade */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setVisao('kanban')}
              className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                visao === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5 text-[#0089a8]" />
              <span>Visão Kanban de Gavetas</span>
            </button>
            <button
              onClick={() => setVisao('grade')}
              className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                visao === 'grade'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#0089a8]" />
              <span>Grade Geral</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Área:</span>
          </div>

          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="todos">Todas as Áreas</option>
            {Object.entries(AREA_LOGICA_LABELS).map(([chave, item]) => (
              <option key={chave} value={chave}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="gaveta">Gavetas (Almoxarifado)</option>
            <option value="cavalete_horizontal">Cavaletes Horizontais</option>
            <option value="cavalete_vidro">Cavaletes de Vidro</option>
            <option value="doca">Docas de Expedição</option>
            <option value="quarentena">Gaiola de Quarentena</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISÃO KANBAN POR GAVETAS / COMPARTIMENTOS                              */}
      {/* ========================================================================= */}
      {visao === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 items-start">
          {colunasKanban.map((coluna) => {
            const IconeColuna = coluna.icone;

            return (
              <div
                key={coluna.tipo}
                className={`rounded-2xl border ${coluna.corBorda} ${coluna.corFundo} p-4 flex flex-col gap-3 shadow-xs`}
              >
                {/* Header da Coluna Kanban */}
                <div className="flex items-center justify-between border-b pb-3 border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${coluna.corIcone}`}>
                      <IconeColuna className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900 leading-tight">
                        {coluna.titulo}
                      </h3>
                      <p className="text-[10px] text-slate-500 line-clamp-1">
                        {coluna.subtitulo}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full font-mono border ${coluna.corBadge}`}>
                    {coluna.locais.length}
                  </span>
                </div>

                {/* Cards das Gavetas nesta Coluna */}
                <div className="space-y-3 min-h-[140px]">
                  {coluna.locais.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                      Nenhum local filtrado
                    </div>
                  ) : (
                    coluna.locais.map((local) => {
                      const materiais = obterMateriaisDoLocal(local);
                      const totalUnidades = materiais.reduce((acc, m) => acc + m.quantidade_saldo, 0);

                      return (
                        <div
                          key={local.id}
                          onClick={() => setLocalInspecionado(local)}
                          className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md hover:border-[#00B2D6] transition-all cursor-pointer group flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {local.codigo}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                {materiais.length} {materiais.length === 1 ? 'material' : 'materiais'}
                              </span>
                            </div>

                            <h4 className="font-black text-xs text-slate-900 group-hover:text-[#0089a8] transition-colors leading-snug">
                              {local.nome_exibicao}
                            </h4>

                            {local.obra_destino && (
                              <div className="mt-1 text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 inline-block truncate max-w-full">
                                Obra: {local.obra_destino}
                              </div>
                            )}

                            {/* Mini lista de materiais estocados na gaveta */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                              {materiais.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">
                                  Gaveta vazia • Disponível para alocação
                                </p>
                              ) : (
                                materiais.slice(0, 2).map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center justify-between text-[11px] text-slate-600 gap-2"
                                  >
                                    <span className="truncate font-medium text-slate-800">
                                      {m.descricao.split('(')[0].trim()}
                                    </span>
                                    <span className="font-mono font-bold text-slate-900 shrink-0">
                                      {m.quantidade_saldo} {m.unidade}
                                    </span>
                                  </div>
                                ))
                              )}
                              {materiais.length > 2 && (
                                <p className="text-[10px] text-[#0089a8] font-bold mt-1">
                                  + {materiais.length - 2} outros materiais nesta gaveta...
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Footer do Card com CTA de Abertura */}
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="text-[10px]">
                              Cap.: <strong>{local.capacidade_max_kg}kg</strong>
                            </span>
                            <span className="font-bold text-[#0089a8] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Abrir Gaveta</span>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VISÃO EM GRADE GERAL                                                   */}
      {/* ========================================================================= */}
      {visao === 'grade' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locaisFiltrados.map((local) => {
            const areaInfo = AREA_LOGICA_LABELS[local.area_logica];
            const materiais = obterMateriaisDoLocal(local);
            const totalQtd = materiais.reduce((acc, m) => acc + m.quantidade_saldo, 0);

            return (
              <div
                key={local.id}
                onClick={() => setLocalInspecionado(local)}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-[#00B2D6] transition-all p-4 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${areaInfo?.color}`}>
                      {areaInfo?.label || local.area_logica}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      {materiais.length} {materiais.length === 1 ? 'material' : 'materiais'} estocados
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#0089a8] tracking-tight leading-snug">
                    {local.nome_exibicao}
                  </h3>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {local.codigo}
                    </span>
                    {local.obra_destino && (
                      <span className="text-xs font-medium text-slate-700 bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded">
                        Obra: {local.obra_destino}
                      </span>
                    )}
                  </div>

                  {/* Dimensões */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-slate-600 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Capacidade:</span>
                      <span className="font-semibold text-slate-800">{local.capacidade_max_kg} kg</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Compr. Máx:</span>
                      <span className="font-semibold text-slate-800">
                        {local.comprimento_max_mm >= 6000 ? '6.000+ mm (Barra)' : `${local.comprimento_max_mm} mm`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0089a8] flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    Ver Materiais na Gaveta
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocaisParaImprimir([local]);
                      setModalImpressaoAberto(true);
                    }}
                    className="text-xs font-bold text-slate-700 hover:text-black bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    Etiqueta
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE INSPEÇÃO DA GAVETA / LOCAL (KANBAN DETAIL)                       */}
      {/* ========================================================================= */}
      {localInspecionado && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-100">
            {/* Header do Modal */}
            <div className="bg-[#0A1A33] text-white p-5 border-b border-[#2A3F5C] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-[#00B2D6] border border-cyan-500/30">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white tracking-tight">
                      {localInspecionado.nome_exibicao}
                    </h3>
                    <span className="font-mono text-xs font-bold bg-[#00B2D6] text-slate-950 px-2 py-0.5 rounded">
                      {localInspecionado.codigo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Área: <strong>{AREA_LOGICA_LABELS[localInspecionado.area_logica]?.label || localInspecionado.area_logica}</strong> • Capacidade: <strong>{localInspecionado.capacidade_max_kg} kg</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setLocalInspecionado(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-[#14283F] flex items-center justify-center text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo: Materiais Estocados */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Materiais Armazenados neste Compartimento
                  </h4>
                  <p className="text-xs text-slate-500">
                    Saldos físicos reais e lotes vinculados à posição
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLocalPreSelecionadoParaCadastro(localInspecionado.id);
                    setModalInspecaoFechadaEAbriCadastro();
                  }}
                  className="px-3 py-1.5 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 text-xs font-black rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Inserir Material Aqui</span>
                </button>
              </div>

              {/* Lista dos Materiais */}
              {obterMateriaisDoLocal(localInspecionado).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                    <Box className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">Esta gaveta está vazia no momento</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nenhum material físico foi alocado para este código de endereçamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPreSelecionadoParaCadastro(localInspecionado.id);
                      setModalInspecaoFechadaEAbriCadastro();
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    + Alocar Primeiro Material
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100">
                  <div className="p-3 bg-slate-100 text-xs font-bold text-slate-700 grid grid-cols-12 gap-2">
                    <div className="col-span-5">Material / SKU</div>
                    <div className="col-span-3">Lote / Dimensões</div>
                    <div className="col-span-2 text-right">Saldo Físico</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>

                  {obterMateriaisDoLocal(localInspecionado).map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white hover:bg-slate-50 transition-colors grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-5 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[11px] bg-slate-900 text-white px-1.5 py-0.2 rounded">
                            {item.codigo}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800">
                            {item.tipo_material}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 leading-snug">
                          {item.descricao}
                        </p>
                      </div>

                      <div className="col-span-3 text-slate-600 space-y-0.5">
                        <div className="font-mono text-[11px] font-semibold text-slate-700">
                          {item.lote}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.comprimento_mm > 0 ? `${item.comprimento_mm} mm` : 'Padrão'}
                        </div>
                      </div>

                      <div className="col-span-2 text-right">
                        <span className="text-sm font-black text-slate-900 block font-mono">
                          {item.quantidade_saldo.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          {item.unidade}
                        </span>
                      </div>

                      <div className="col-span-2 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Disponível
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLocaisParaImprimir([localInspecionado]);
                  setModalImpressaoAberto(true);
                }}
                className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Imprimir Etiqueta da Gaveta</span>
              </button>

              <button
                type="button"
                onClick={() => setLocalInspecionado(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CRIAÇÃO EM LOTE                                                  */}
      {/* ========================================================================= */}
      {modalLoteAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in-50 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Criar Locais em Lote
                </h3>
                <p className="text-xs text-slate-500">
                  Gera sequências com preenchimento automático do nome de exibição legível
                </p>
              </div>
              <button
                onClick={() => setModalLoteAberto(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarLote} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Local:
                </label>
                <select
                  value={formLote.tipo}
                  onChange={(e) => {
                    const t = e.target.value as TipoLocal;
                    setFormLote({
                      ...formLote,
                      tipo: t,
                      prefixo:
                        t === 'gaveta'
                          ? 'GAV'
                          : t === 'cavalete_horizontal'
                          ? 'CAV-H'
                          : t === 'cavalete_vidro'
                          ? 'CAV-V'
                          : t === 'doca'
                          ? 'DOCA'
                          : 'QUA',
                      area_logica:
                        t === 'gaveta'
                          ? 'almoxarifado'
                          : t === 'cavalete_vidro'
                          ? 'vidros'
                          : t === 'doca'
                          ? 'doca'
                          : t === 'quarentena'
                          ? 'quarentena'
                          : 'materia_prima',
                    });
                  }}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#00B2D6]"
                >
                  <option value="cavalete_horizontal">Cavalete Horizontal (Barras 6m)</option>
                  <option value="gaveta">Gaveta (Acessórios/Ferragens)</option>
                  <option value="cavalete_vidro">Cavalete de Vidro</option>
                  <option value="doca">Doca de Expedição</option>
                  <option value="quarentena">Gaiola de Quarentena</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantidade de Unidades:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formLote.quantidade}
                    onChange={(e) =>
                      setFormLote({ ...formLote, quantidade: parseInt(e.target.value) || 1 })
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Níveis / Prateleiras:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formLote.subniveis}
                    disabled={formLote.tipo === 'cavalete_vidro' || formLote.tipo === 'doca' || formLote.tipo === 'quarentena'}
                    onChange={(e) =>
                      setFormLote({ ...formLote, subniveis: parseInt(e.target.value) || 1 })
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg disabled:opacity-50"
                  />
                </div>
              </div>

              {formLote.tipo === 'doca' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Obra de Destino:
                  </label>
                  <input
                    type="text"
                    value={formLote.obra}
                    onChange={(e) => setFormLote({ ...formLote, obra: e.target.value })}
                    placeholder="Ex: Edifício Horizonte, Residencial Alpha"
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-lg text-xs text-slate-700">
                <span className="font-bold block text-cyan-950 mb-0.5">
                  Pré-visualização do Padrão Humano:
                </span>
                <span className="font-medium">
                  {gerarNomeHumanoClient(
                    formLote.tipo,
                    1,
                    1,
                    formLote.obra,
                    formLote.prefixo
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalLoteAberto(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#00B2D6] hover:bg-[#009bbd] rounded-lg shadow-sm"
                >
                  Gerar {formLote.quantidade * (formLote.subniveis || 1)} Locais
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CADASTRO / INSERÇÃO DE MATERIAIS (IA + MANUAL)                   */}
      {/* ========================================================================= */}
      {modalCadastroMaterialAberto && (
        <CadastroMaterialIA
          localPreSelecionadoId={localPreSelecionadoParaCadastro}
          aoFechar={() => setModalCadastroMaterialAberto(false)}
          aoSucesso={() => {
            setModalCadastroMaterialAberto(false);
          }}
        />
      )}

      {/* Modal de Impressão de Etiquetas Térmicas */}
      <ModalImpressaoEtiquetas
        locais={locaisParaImprimir}
        aberto={modalImpressaoAberto}
        aoFechar={() => setModalImpressaoAberto(false)}
      />
    </div>
  );

  function setModalInspecaoFechadaEAbriCadastro() {
    setLocalInspecionado(null);
    setModalCadastroMaterialAberto(true);
  }
};
