// ============================================================================
// COMPONENT: src/components/materiais/CadastroMaterialIA.tsx
// Scanner Inteligente com IA & Cadastro Manual de Materiais
// Integração com Estoque, Vínculo à Obra e Encaminhamento para Triagem de Integridade
// ============================================================================

import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useObras } from '../../hooks/useObras';
import { useStockLedger } from '../../hooks/useStockLedger';
import { useTriagemAlerts } from '../../hooks/useTriagemAlerts';
import { analisarImagemMateriais, ItemDetectadoIA, ResultadoAnaliseIA } from '../../services/aiMaterialScanner';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  Camera,
  Upload,
  Sparkles,
  Building2,
  Package,
  CheckCircle2,
  Trash2,
  Check,
  Scan,
  ShieldCheck,
  Plus,
  Edit3,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  Box,
} from 'lucide-react';

interface CadastroMaterialIAProps {
  aoFechar: () => void;
  aoSucesso?: () => void;
  localPreSelecionadoId?: string;
}

const LOCAIS_DISPONIVEIS = [
  { id: 'loc-1', codigo: 'GAV-01-01', nome: 'Gaveta 1 - Prateleira 1 (Acessórios)', tipo: 'gaveta' },
  { id: 'loc-2', codigo: 'GAV-01-02', nome: 'Gaveta 1 - Prateleira 2 (Acessórios)', tipo: 'gaveta' },
  { id: 'loc-3', codigo: 'CAV-H-01-01', nome: 'Cavalete Horizontal 1 - Nível 1 (Barras 6m)', tipo: 'cavalete_horizontal' },
  { id: 'loc-4', codigo: 'CAV-H-01-02', nome: 'Cavalete Horizontal 1 - Nível 2 (Barras 6m)', tipo: 'cavalete_horizontal' },
  { id: 'loc-5', codigo: 'CAV-V-01', nome: 'Cavalete de Vidro 1 (Chapas)', tipo: 'cavalete_vidro' },
  { id: 'loc-6', codigo: 'CAV-V-02', nome: 'Cavalete de Vidro 2 (Chapas)', tipo: 'cavalete_vidro' },
  { id: 'loc-7', codigo: 'DOCA-RESERVA-LAGOS', nome: 'Doca de Expedição - Obra Reserva dos Lagos', tipo: 'doca' },
  { id: 'loc-8', codigo: 'QUA-01', nome: 'Gaiola de Quarentena', tipo: 'quarentena' },
];

export const CadastroMaterialIA: React.FC<CadastroMaterialIAProps> = ({
  aoFechar,
  aoSucesso,
  localPreSelecionadoId,
}) => {
  const { perfil } = useAuth();
  const { obras, cadastrarObra } = useObras();
  const { adicionarMaterialAoEstoque } = useStockLedger();
  const { enviarParaTriagemIntegridade } = useTriagemAlerts();

  // Aba ativa: IA vs Manual
  const [abaAtiva, setAbaAtiva] = useState<'ia' | 'manual'>('ia');

  // Estados IA
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<ResultadoAnaliseIA | null>(null);
  const [itensParaRevisao, setItensParaRevisao] = useState<ItemDetectadoIA[]>([]);

  // Estados do Cadastro Manual
  const [manualSku, setManualSku] = useState('');
  const [manualDescricao, setManualDescricao] = useState('');
  const [manualTipo, setManualTipo] = useState<'perfil_barra' | 'retalho' | 'vidro' | 'acessorio'>('acessorio');
  const [manualQuantidade, setManualQuantidade] = useState<number>(10);
  const [manualUnidade, setManualUnidade] = useState('UN');
  const [manualComprimentoMm, setManualComprimentoMm] = useState<number>(0);
  const [manualLocalId, setManualLocalId] = useState<string>(localPreSelecionadoId || 'loc-1');
  const [manualNf, setManualNf] = useState('');
  const [manualLote, setManualLote] = useState('');
  const [manualFornecedor, setManualFornecedor] = useState('');
  const [manualObservacao, setManualObservacao] = useState('');

  // Vínculo de Obra
  const [obraSelecionadaId, setObraSelecionadaId] = useState<string>(obras[0]?.id || '');
  const [modalNovaObra, setModalNovaObra] = useState(false);
  const [novaObraNome, setNovaObraNome] = useState('');
  const [novaObraCliente, setNovaObraCliente] = useState('');
  const [novaObraEndereco, setNovaObraEndereco] = useState('');

  const [gravandoNoEstoque, setGravandoNoEstoque] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const obraAtual = obras.find((o) => o.id === obraSelecionadaId) || obras[0];

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivoSelecionado(file);
      const url = URL.createObjectURL(file);
      setImagemPreview(url);
      setResultadoIA(null);
      setItensParaRevisao([]);
    }
  };

  const handleProcessarIA = async () => {
    if (!arquivoSelecionado && !imagemPreview) {
      toast.error('Selecione ou tire uma foto da NF ou dos materiais primeiro.');
      return;
    }

    setAnalisando(true);
    try {
      const res = await analisarImagemMateriais(arquivoSelecionado!, obraAtual?.nome);
      setResultadoIA(res);
      setItensParaRevisao(res.itens);
      toast.success('Análise de IA concluída! Revise os materiais detectados abaixo.');
    } catch (err: any) {
      toast.error(`Erro na análise de visão computacional: ${err.message}`);
    } finally {
      setAnalisando(false);
    }
  };

  const alternarItem = (id: string) => {
    setItensParaRevisao((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selecionado: !it.selecionado } : it))
    );
  };

  const atualizarQuantidadeItem = (id: string, novaQtd: number) => {
    if (novaQtd < 1) return;
    setItensParaRevisao((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantidade: novaQtd } : it))
    );
  };

  const removerItem = (id: string) => {
    setItensParaRevisao((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSalvarNovaObra = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await cadastrarObra({
      nome: novaObraNome,
      cliente: novaObraCliente,
      endereco: novaObraEndereco,
      dataPrometida: '30 dias',
    });
    if (res.sucesso && res.obra) {
      setObraSelecionadaId(res.obra.id);
      setModalNovaObra(false);
      setNovaObraNome('');
      setNovaObraCliente('');
      setNovaObraEndereco('');
    }
  };

  // 1. Gravação do Cadastro Manual -> Estoque + Triagem de Integridade
  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSku.trim() || !manualDescricao.trim() || manualQuantidade <= 0) {
      toast.error('Preencha os campos obrigatórios (Código SKU, Descrição e Quantidade).');
      return;
    }

    setGravandoNoEstoque(true);
    try {
      const localObj = LOCAIS_DISPONIVEIS.find((l) => l.id === manualLocalId) || LOCAIS_DISPONIVEIS[0];
      const loteGerado = manualLote.trim() || `LOTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Adiciona ao ledger e saldos físicos
      adicionarMaterialAoEstoque({
        codigo: manualSku.toUpperCase().trim(),
        descricao: manualDescricao.trim(),
        tipo_material: manualTipo,
        comprimento_mm: manualComprimentoMm,
        quantidade: manualQuantidade,
        unidade: manualUnidade,
        lote: loteGerado,
        local_id: localObj.id,
        local_codigo: localObj.codigo,
        local_nome_exibicao: localObj.nome,
        obra_destino: obraAtual?.nome,
        nf: manualNf,
        observacao: manualObservacao,
      });

      // 2. Envia alerta de triagem de integridade
      enviarParaTriagemIntegridade({
        sku: manualSku.toUpperCase().trim(),
        descricao: manualDescricao.trim(),
        quantidade: manualQuantidade,
        unidade: manualUnidade,
        localNome: localObj.nome,
        obraNome: obraAtual?.nome,
        origem: 'manual',
        nf: manualNf,
      });

      // 3. Salva no banco de dados se conectado
      if (isSupabaseConfigured) {
        await supabase.from('triagens').insert({
          tipo_triagem: 'triagem_1_recebimento',
          numero_nf: manualNf || 'CADASTRO-MANUAL',
          sku: manualSku.toUpperCase().trim(),
          descricao: `${manualDescricao.trim()} (Obra: ${obraAtual?.nome || 'Geral'})`,
          quantidade: manualQuantidade,
          status: 'pendente_verificacao',
          operador_id: perfil?.id,
          dados_adicionais: {
            obra_destino: obraAtual?.nome,
            cliente: obraAtual?.cliente,
            local_alocado: localObj.nome,
            lote: loteGerado,
            fornecedor: manualFornecedor,
            origem_cadastro: 'manual',
            cadastrado_por: perfil?.nome || 'Operador',
          },
        });
      }

      toast.success(
        `Material "${manualSku.toUpperCase()}" cadastrado com sucesso e encaminhado para a Triagem de Verificação de Integridade!`,
        { duration: 6000 }
      );

      if (aoSucesso) aoSucesso();
      aoFechar();
    } catch (err: any) {
      toast.error(`Erro ao cadastrar material manual: ${err.message}`);
    } finally {
      setGravandoNoEstoque(false);
    }
  };

  // 2. Autorização Formal dos Materiais da IA -> Estoque + Triagem de Integridade
  const handleAutorizarEInserirEstoque = async () => {
    const itensSelecionados = itensParaRevisao.filter((i) => i.selecionado);
    if (itensSelecionados.length === 0) {
      toast.error('Selecione pelo menos um material para autorizar.');
      return;
    }

    setGravandoNoEstoque(true);

    try {
      for (const item of itensSelecionados) {
        const localObj =
          LOCAIS_DISPONIVEIS.find((l) => l.nome.includes(item.localSugerido) || l.codigo.includes(item.localSugerido)) ||
          LOCAIS_DISPONIVEIS[0];

        // 1. Adiciona ao estoque local
        const tipoEstoque =
          item.tipoMaterial === 'perfil_aluminio'
            ? 'perfil_barra'
            : item.tipoMaterial === 'vidro'
            ? 'vidro'
            : 'acessorio';

        adicionarMaterialAoEstoque({
          codigo: item.sku,
          descricao: item.descricao,
          tipo_material: tipoEstoque,
          quantidade: item.quantidade,
          unidade: item.unidade,
          local_id: localObj.id,
          local_codigo: localObj.codigo,
          local_nome_exibicao: item.localSugerido || localObj.nome,
          obra_destino: obraAtual?.nome,
          nf: item.numeroNf || resultadoIA?.numeroNfDetectado,
        });

        // 2. Envia para triagem de integridade
        enviarParaTriagemIntegridade({
          sku: item.sku,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          localNome: item.localSugerido || localObj.nome,
          obraNome: obraAtual?.nome,
          origem: 'ia',
          nf: item.numeroNf || resultadoIA?.numeroNfDetectado,
        });

        // 3. Salva no Supabase se conectado
        if (isSupabaseConfigured) {
          try {
            await supabase.from('triagens').insert({
              tipo_triagem: 'triagem_1_recebimento',
              numero_nf: item.numeroNf || resultadoIA?.numeroNfDetectado || 'NF-IA',
              sku: item.sku,
              descricao: `${item.descricao} (Vinculado a: ${obraAtual?.nome || 'Estoque Geral'})`,
              quantidade: item.quantidade,
              status: 'aprovado',
              operador_id: perfil?.id,
              dados_adicionais: {
                obra_destino: obraAtual?.nome,
                cliente: obraAtual?.cliente,
                local_alocado: item.localSugerido,
                confianca_ia: item.confiancaPct,
                autorizado_por: perfil?.nome || 'Carlos Encarregado',
              },
            });
          } catch (e) {
            console.warn('Erro ao registrar triagem no Supabase:', e);
          }
        }
      }

      toast.success(
        `${itensSelecionados.length} materiais autorizados e encaminhados para a Triagem de Integridade da obra "${obraAtual?.nome}"!`,
        { duration: 5000 }
      );

      if (aoSucesso) aoSucesso();
      aoFechar();
    } catch (err: any) {
      toast.error(`Erro ao gravar materiais: ${err.message}`);
    } finally {
      setGravandoNoEstoque(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-300 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Superior */}
        <div className="bg-[#0A1A33] text-white p-5 border-b border-[#2A3F5C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-cyan-500/20 text-[#00B2D6] border border-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base text-white tracking-tight">
                  Cadastro & Inserção de Materiais
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#00B2D6] text-slate-950 font-mono">
                  Entrada & Triagem de Integridade
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Cadastre materiais com visão computacional via IA ou manualmente com roteamento para conferência física.
              </p>
            </div>
          </div>
          <button
            onClick={aoFechar}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-[#14283F] flex items-center justify-center text-base cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Barra de Abas: IA vs Manual */}
        <div className="bg-slate-100 px-6 pt-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAbaAtiva('ia')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'ia'
                ? 'bg-white border-slate-200 text-[#0089a8] shadow-2xs -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#00B2D6]" />
            <span>Cadastro com IA (Foto da NF / Lote)</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('manual')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'manual'
                ? 'bg-white border-slate-200 text-[#0089a8] shadow-2xs -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-4 h-4 text-emerald-600" />
            <span>Cadastro Manual de Materiais</span>
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Seção Fixa: Obra de Destino */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#00B2D6]" />
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Obra de Destino do Material *
                </label>
                <p className="text-[11px] text-slate-500">
                  Vincula automaticamente os itens a esta obra para reserva e controle de lote.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={obraSelecionadaId}
                onChange={(e) => setObraSelecionadaId(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00B2D6]"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.cliente})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setModalNovaObra(true)}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Cadastrar nova obra"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Obra</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* ABA 1: CADASTRO COM IA (FOTO / NF)                           */}
          {/* ============================================================ */}
          {abaAtiva === 'ia' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {!resultadoIA && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      imagemPreview
                        ? 'border-[#00B2D6] bg-cyan-50/20'
                        : 'border-slate-300 hover:border-[#00B2D6] bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleSelecionarArquivo}
                      className="hidden"
                    />

                    {imagemPreview ? (
                      <div className="space-y-4">
                        <img
                          src={imagemPreview}
                          alt="Preview da Nota Fiscal / Foto"
                          className="max-h-56 mx-auto rounded-xl shadow-md object-contain border border-slate-200"
                        />
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs font-bold text-slate-700">
                            {arquivoSelecionado?.name || 'Foto Capturada'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="text-xs text-cyan-700 font-bold hover:underline"
                          >
                            Trocar Foto
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center mx-auto shadow-xs">
                          <Camera className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Clique para tirar foto ou carregar imagem da NF / Lote
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Suporta fotos de celular, notas fiscais impressas (DANFE), romaneios de fornecedores ou fotos das etiquetas nas barras de alumínio.
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs">
                          <Upload className="w-3.5 h-3.5 text-slate-400" />
                          <span>Selecionar Arquivo / Câmera</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {imagemPreview && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleProcessarIA}
                        disabled={analisando}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {analisando ? (
                          <>
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Analisando Imagem com Inteligência Artificial...</span>
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4" />
                            <span>Analisar e Extrair Materiais da Imagem</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Materiais Detectados pela IA */}
              {resultadoIA && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-cyan-950">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-cyan-700 shrink-0" />
                      <div>
                        <div className="font-bold text-cyan-900">
                          {resultadoIA.mensagemIA}
                        </div>
                        <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                          NF: <strong>{resultadoIA.numeroNfDetectado}</strong> • Fornecedor: <strong>{resultadoIA.fornecedorDetectado}</strong> • Processado em {resultadoIA.tempoProcessamentoMs}ms
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResultadoIA(null);
                        setItensParaRevisao([]);
                      }}
                      className="text-xs text-cyan-800 font-bold hover:underline self-start sm:self-auto cursor-pointer"
                    >
                      Escanear Outra Imagem
                    </button>
                  </div>

                  {/* Tabela de Conferência e Edição */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Conferência de Materiais Detectados ({itensParaRevisao.length})</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Desmarque os itens que não deseja incluir ou ajuste as quantidades
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {itensParaRevisao.map((item) => (
                        <div
                          key={item.id}
                          className={`p-4 transition-colors flex items-center justify-between gap-3 ${
                            item.selecionado ? 'bg-white' : 'bg-slate-50 opacity-50'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selecionado}
                              onChange={() => alternarItem(item.id)}
                              className="mt-1 w-4 h-4 rounded accent-[#00B2D6] cursor-pointer"
                            />
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                                  {item.sku}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-mono">
                                  {item.confiancaPct}% Confiança
                                </span>
                                <span className="text-[11px] font-medium text-slate-500">
                                  Local Sugerido: <strong>{item.localSugerido}</strong>
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {item.descricao}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => atualizarQuantidadeItem(item.id, item.quantidade - 1)}
                                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 font-bold text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantidade}
                                onChange={(e) =>
                                  atualizarQuantidadeItem(item.id, Number(e.target.value))
                                }
                                className="w-14 text-center text-xs font-bold bg-white text-slate-900 py-1 focus:outline-none"
                                min="1"
                              />
                              <button
                                type="button"
                                onClick={() => atualizarQuantidadeItem(item.id, item.quantidade + 1)}
                                className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-600 min-w-14">
                              {item.unidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Remover item da lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botão de Autorização Formal */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Autorização & Envio para Triagem de Integridade
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Os {itensParaRevisao.filter((i) => i.selecionado).length} materiais selecionados serão alocados para a obra{' '}
                        <strong>{obraAtual?.nome}</strong> e passarão pela conferência de integridade no galpão.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutorizarEInserirEstoque}
                      disabled={gravandoNoEstoque}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {gravandoNoEstoque ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Gravando e Encaminhando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Autorizar e Encaminhar para Triagem</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* ABA 2: CADASTRO MANUAL DE MATERIAIS                          */}
          {/* ============================================================ */}
          {abaAtiva === 'manual' && (
            <form onSubmit={handleSalvarManual} className="space-y-5 animate-in fade-in duration-150">
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Conferência Física & Integridade:</span>
                  Todo material inserido manualmente será registrado no estoque e encaminhado imediatamente para a <strong>Triagem de Verificação de Integridade</strong> no Terminal Operacional.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código SKU / Referência Técnica *
                  </label>
                  <input
                    type="text"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    placeholder="Ex: ROLD-SUPREMA-DUPLA, PERF-SUP-6M-BRANCO"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-[#00B2D6]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoria / Tipo de Material *
                  </label>
                  <select
                    value={manualTipo}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setManualTipo(t);
                      if (t === 'perfil_barra') {
                        setManualUnidade('BARRA');
                        setManualComprimentoMm(6000);
                        setManualLocalId('loc-3');
                      } else if (t === 'vidro') {
                        setManualUnidade('CHAPA');
                        setManualComprimentoMm(2100);
                        setManualLocalId('loc-5');
                      } else if (t === 'retalho') {
                        setManualUnidade('PECA');
                        setManualLocalId('loc-3');
                      } else {
                        setManualUnidade('UN');
                        setManualLocalId('loc-1');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00B2D6]"
                  >
                    <option value="acessorio">Acessório / Ferragem / Parafuso</option>
                    <option value="perfil_barra">Perfil de Alumínio (Barra 6m)</option>
                    <option value="vidro">Chapa de Vidro Temperado / Laminado</option>
                    <option value="retalho">Retalho de Perfil Reaproveitável</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descrição Completa do Material *
                </label>
                <input
                  type="text"
                  value={manualDescricao}
                  onChange={(e) => setManualDescricao(e.target.value)}
                  placeholder="Ex: Roldana Dupla com Rolamento Blindado Linha Suprema"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={manualQuantidade}
                    onChange={(e) => setManualQuantidade(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unidade de Medida *
                  </label>
                  <select
                    value={manualUnidade}
                    onChange={(e) => setManualUnidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00B2D6]"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="BARRA">BARRA (6.000 mm)</option>
                    <option value="CHAPA">CHAPA (Vidro)</option>
                    <option value="PECA">PEÇA</option>
                    <option value="PAR">PAR</option>
                    <option value="ROLO">ROLO</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="METRO">METRO (m)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Comprimento (mm)
                  </label>
                  <input
                    type="number"
                    value={manualComprimentoMm}
                    onChange={(e) => setManualComprimentoMm(Number(e.target.value) || 0)}
                    placeholder="Ex: 6000, 1450, 50"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  />
                </div>
              </div>

              {/* Local de Armazenamento / Gaveta */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Local Físico / Gaveta de Destino *
                </label>
                <select
                  value={manualLocalId}
                  onChange={(e) => setManualLocalId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00B2D6]"
                >
                  {LOCAIS_DISPONIVEIS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.codigo}] {loc.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dados Fiscais e Rastreabilidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nota Fiscal (NF)
                  </label>
                  <input
                    type="text"
                    value={manualNf}
                    onChange={(e) => setManualNf(e.target.value)}
                    placeholder="Ex: NF-98401"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lote do Fabricante
                  </label>
                  <input
                    type="text"
                    value={manualLote}
                    onChange={(e) => setManualLote(e.target.value)}
                    placeholder="Ex: LOTE-2026-X1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={manualFornecedor}
                    onChange={(e) => setManualFornecedor(e.target.value)}
                    placeholder="Ex: Alumínio Brasil S/A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações de Entrada / Integridade
                </label>
                <input
                  type="text"
                  value={manualObservacao}
                  onChange={(e) => setManualObservacao(e.target.value)}
                  placeholder="Ex: Material recebido em perfeitas condições na embalagem original."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={aoFechar}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gravandoNoEstoque}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  {gravandoNoEstoque ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Cadastrar Material e Enviar para Triagem</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL DE CADASTRO RÁPIDO DE NOVA OBRA */}
      {modalNovaObra && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in zoom-in-95 duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00B2D6]" />
                Cadastrar Nova Obra
              </h3>
              <button
                onClick={() => setModalNovaObra(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarNovaObra} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nome da Obra / Empreendimento *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Condomínio Grand Ville"
                  value={novaObraNome}
                  onChange={(e) => setNovaObraNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cliente / Construtora
                </label>
                <input
                  type="text"
                  placeholder="Ex: Construtora Delta Ltda"
                  value={novaObraCliente}
                  onChange={(e) => setNovaObraCliente(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Endereço / Local da Instalação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rua das Flores, 100 - Bairro Centro"
                  value={novaObraEndereco}
                  onChange={(e) => setNovaObraEndereco(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#00B2D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalNovaObra(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-xs rounded-lg shadow-sm"
                >
                  Salvar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
