// ============================================================================
// COMPONENT: src/components/seletores.tsx
// Componentes de seleção e badges com foco no nome_exibicao humano
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { LocalEstoque, AreaLogica, TipoMaterial } from '../types/estoque';
import { ChevronDown, Search, MapPin, Check, Layers, AlertCircle } from 'lucide-react';

export const AREA_LOGICA_LABELS: Record<AreaLogica, { label: string; color: string }> = {
  materia_prima: { label: 'Matéria-Prima', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  almoxarifado: { label: 'Almoxarifado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  corte: { label: 'Corte', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  usinagem: { label: 'Usinagem', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  montagem: { label: 'Montagem', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  vidros: { label: 'Vidros', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  acessorios: { label: 'Acessórios', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  quarentena: { label: 'Quarentena', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  expedicao: { label: 'Expedição', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  doca: { label: 'Doca de Carga', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

interface SeletorLocalProps {
  locais: LocalEstoque[];
  valorSelecionado?: string; // id ou codigo do local
  aoSelecionar: (local: LocalEstoque) => void;
  filtroTipo?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Seletor de Local Físico:
 * Prioriza visualmente o `nome_exibicao` em tipografia forte e legível,
 * mantendo o `codigo` técnico como metadado secundário (ex.: GAV-01-02).
 */
export const SeletorLocal: React.FC<SeletorLocalProps> = ({
  locais,
  valorSelecionado,
  aoSelecionar,
  placeholder = 'Selecione o local físico...',
  disabled = false,
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const localAtivo = locais.find(
    (l) => l.id === valorSelecionado || l.codigo === valorSelecionado
  );

  const locaisFiltrados = locais.filter((l) => {
    const termo = busca.toLowerCase();
    return (
      l.nome_exibicao.toLowerCase().includes(termo) ||
      l.codigo.toLowerCase().includes(termo) ||
      (l.obra_destino && l.obra_destino.toLowerCase().includes(termo))
    );
  });

  useEffect(() => {
    const fecharAoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', fecharAoClicarFora);
    return () => document.removeEventListener('mousedown', fecharAoClicarFora);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto(!aberto)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-lg shadow-xs text-left transition-all ${
          disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'hover:border-slate-400 focus:ring-2 focus:ring-[#00B2D6] focus:border-transparent'
        } ${aberto ? 'border-[#00B2D6] ring-2 ring-[#00B2D6]/20' : 'border-slate-300'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
          {localAtivo ? (
            <div className="flex flex-col min-w-0">
              {/* DESTAQUE PRINCIPAL: Nome de Exibição Humano */}
              <span className="text-sm font-bold text-slate-900 truncate">
                {localAtivo.nome_exibicao}
              </span>
              {/* SECUNDÁRIO: Código Técnico */}
              <span className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                <span className="bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                  {localAtivo.codigo}
                </span>
                <span>• {AREA_LOGICA_LABELS[localAtivo.area_logica]?.label || localAtivo.area_logica}</span>
              </span>
            </div>
          ) : (
            <span className="text-sm text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome operacional ou código..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#00B2D6] text-slate-800"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {locaisFiltrados.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                <AlertCircle className="w-5 h-5 text-slate-300" />
                <span>Nenhum local físico encontrado</span>
              </div>
            ) : (
              locaisFiltrados.map((loc) => {
                const selecionado = localAtivo?.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      aoSelecionar(loc);
                      setAberto(false);
                      setBusca('');
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                      selecionado ? 'bg-cyan-50/70 text-[#00B2D6]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      {/* Destaque primário do nome operacional */}
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                        {loc.nome_exibicao}
                      </span>
                      {/* Metadados secundários com o código técnico */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          {loc.codigo}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {AREA_LOGICA_LABELS[loc.area_logica]?.label}
                        </span>
                      </div>
                    </div>
                    {selecionado && <Check className="w-4 h-4 text-[#00B2D6] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Badge elegante para exibição do Local em cartões, listas e tabelas operacionais.
 */
export const BadgeLocal: React.FC<{
  local: LocalEstoque;
  tamanho?: 'sm' | 'md' | 'lg';
  mostrarArea?: boolean;
}> = ({ local, tamanho = 'md', mostrarArea = true }) => {
  const areaInfo = AREA_LOGICA_LABELS[local.area_logica];

  return (
    <div className="inline-flex flex-col items-start">
      <div className="flex items-center gap-1.5">
        <span
          className={`font-bold tracking-tight text-slate-900 ${
            tamanho === 'sm' ? 'text-xs' : tamanho === 'lg' ? 'text-base font-extrabold' : 'text-sm'
          }`}
        >
          {local.nome_exibicao}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
          {local.codigo}
        </span>
        {mostrarArea && areaInfo && (
          <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${areaInfo.color}`}>
            {areaInfo.label}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Seletor de Tipo de Material (para testes de alocação rígida item x local)
 */
export const SeletorTipoMaterial: React.FC<{
  valor: TipoMaterial;
  aoMudar: (tipo: TipoMaterial) => void;
}> = ({ valor, aoMudar }) => {
  const opcoes: { id: TipoMaterial; label: string; desc: string }[] = [
    { id: 'perfil_barra', label: 'Barra de Perfil (6m)', desc: 'Perfil estrutural inteiro (6000 mm)' },
    { id: 'retalho', label: 'Retalho (≥ 300mm)', desc: 'Sobra de perfil reaproveitável' },
    { id: 'vidro', label: 'Chapa de Vidro', desc: 'Vidro temperado/laminado plano' },
    { id: 'acessorio', label: 'Acessório / Ferragem', desc: 'Roldana, fecho, guarnição' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map((op) => (
        <button
          key={op.id}
          type="button"
          onClick={() => aoMudar(op.id)}
          className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
            valor === op.id
              ? 'border-[#00B2D6] bg-cyan-50/50 text-slate-900 font-semibold ring-1 ring-[#00B2D6]'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="font-semibold">{op.label}</div>
          <div className="text-[11px] text-slate-500 font-normal mt-0.5">{op.desc}</div>
        </button>
      ))}
    </div>
  );
};
