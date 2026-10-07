// ============================================================================
// COMPONENT: src/components/Etiqueta.tsx
// Etiqueta Térmica e QR Code para Identificação Física de Locais Fabris
// Formato otimizado para impressoras térmicas (100mm x 50mm)
// ============================================================================

import React, { useRef } from 'react';
import { LocalEstoque } from '../types/estoque';
import { Printer, QrCode, X, Check, Copy } from 'lucide-react';

interface EtiquetaTermicaProps {
  local: LocalEstoque;
  compacta?: boolean;
}

/**
 * Componente de Código de Barras Vetorial simulado (Padrão Code 128)
 */
const BarcodeSimulado: React.FC<{ valor: string; altura?: number }> = ({ valor, altura = 40 }) => {
  // Gera padrão pseudo-aleatório determinístico baseado na string para visual fiel de código de barras
  const gerarBarras = (texto: string) => {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = (hash << 5) - hash + texto.charCodeAt(i);
      hash |= 0;
    }
    const barras: number[] = [];
    for (let i = 0; i < 48; i++) {
      barras.push(Math.abs((hash ^ (i * 1337)) % 3) + 1);
    }
    return barras;
  };

  const barras = gerarBarras(valor);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end justify-center bg-white px-2 py-1 gap-px" style={{ height: altura }}>
        {barras.map((largura, idx) => (
          <div
            key={idx}
            className={`${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
            style={{ width: `${largura * 1.5}px`, height: '100%' }}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] font-bold tracking-widest text-black mt-0.5">
        *{valor}*
      </span>
    </div>
  );
};

/**
 * Etiqueta Térmica Operacional:
 * Exibe `nome_exibicao` em fonte grande de altíssima legibilidade
 * e o `codigo` técnico para leitura por scanner de código de barras / QR.
 */
export const EtiquetaTermica: React.FC<EtiquetaTermicaProps> = ({ local, compacta = false }) => {
  return (
    <div
      className={`etiqueta-termica bg-white text-black border-2 border-black rounded-sm p-4 flex flex-col justify-between select-none shadow-md ${
        compacta ? 'w-80 h-44 text-xs' : 'w-[420px] h-[220px]'
      }`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Cabeçalho da Etiqueta */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="bg-black text-white text-[10px] font-extrabold px-1.5 py-0.5 tracking-wider uppercase">
            ESQUADRIAS V2
          </span>
          <span className="text-[11px] font-bold uppercase tracking-tight text-neutral-800">
            {local.area_logica.replace('_', ' ')}
          </span>
        </div>
        <span className="font-mono text-[10px] text-neutral-700 font-bold uppercase">
          TIPO: {local.tipo.replace('_', ' ')}
        </span>
      </div>

      {/* ÁREA CENTRAL PRINCIPAL: NOME DE EXIBIÇÃO HUMANO EM DESTAQUE MÁXIMO */}
      <div className="my-auto py-1">
        <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-0.5">
          LOCAL FÍSICO / IDENTIFICAÇÃO
        </div>
        <h2 className="text-2xl font-black text-black leading-tight tracking-tight uppercase">
          {local.nome_exibicao}
        </h2>
        {local.obra_destino && (
          <div className="text-xs font-bold text-neutral-800 mt-1">
            DESTINO: <span className="bg-neutral-200 px-1 py-0.2">{local.obra_destino}</span>
          </div>
        )}
      </div>

      {/* RODAPÉ TÉCNICO: CÓDIGO DE BARRAS / QR E DADOS SECUNDÁRIOS */}
      <div className="border-t-2 border-black pt-2 flex items-center justify-between">
        {/* Código de barras para pistola laser */}
        <div className="flex flex-col items-start">
          <BarcodeSimulado valor={local.codigo} altura={compacta ? 28 : 36} />
        </div>

        {/* Informações adicionais de engenharia */}
        <div className="flex flex-col items-end text-right font-mono text-[9px] text-neutral-800 leading-tight">
          <span className="font-bold">CAP. MÁX: {local.capacidade_max_kg} KG</span>
          <span>COMPR: {local.comprimento_max_mm} MM</span>
          <span className="text-[8px] text-neutral-500 mt-0.5">ETIQUETA TÉRMICA PADRÃO</span>
        </div>
      </div>
    </div>
  );
};

interface ModalImpressaoProps {
  locais: LocalEstoque[];
  aberto: boolean;
  aoFechar: () => void;
}

export const ModalImpressaoEtiquetas: React.FC<ModalImpressaoProps> = ({
  locais,
  aberto,
  aoFechar,
}) => {
  const [copiado, setCopiado] = React.useState(false);

  if (!aberto || locais.length === 0) return null;

  const acionarImpressao = () => {
    window.print();
  };

  const copiarCodigos = () => {
    const lista = locais.map((l) => `${l.nome_exibicao} \t [${l.codigo}]`).join('\n');
    navigator.clipboard.writeText(lista);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#00B2D6]" />
              Impressão de Etiquetas Térmicas ({locais.length}{' '}
              {locais.length === 1 ? 'local' : 'locais'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Etiquetas padronizadas com nome legível em tamanho ampliado e código técnico para bipagem
            </p>
          </div>
          <button
            onClick={aoFechar}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-wrap gap-6 justify-center items-center">
          {locais.map((local) => (
            <div key={local.id} className="relative group">
              <EtiquetaTermica local={local} />
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={copiarCodigos}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 flex items-center gap-1.5"
            >
              {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? 'Copiado!' : 'Copiar Relação'}
            </button>
            <span className="text-xs text-slate-500">
              Formato compatível com rolos Zebra 100mm x 50mm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={aoFechar}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Fechar
            </button>
            <button
              onClick={acionarImpressao}
              className="px-5 py-2 text-xs font-bold text-white bg-[#00B2D6] hover:bg-[#009bbd] rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Etiquetas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
