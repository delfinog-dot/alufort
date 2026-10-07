// ============================================================================
// PAGE: src/pages/Login.tsx
// Tela de Login com Paleta Estrita Industrial e Alternador de Homologação
// Paleta: Fundo #0A1A33, Cartão #12264A, Campos #14283F, Borda #2A3F5C, Botão #00B2D6
// ============================================================================

import React, { useState } from 'react';
import { useAuth, PERFIS_SEED } from '../hooks/useAuth';
import logoAlufort from '../assets/logo.png';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  HardHat,
  Crown,
  ClipboardList,
} from 'lucide-react';

interface LoginProps {
  aoLogarSucesso?: () => void;
}

export const Login: React.FC<LoginProps> = ({ aoLogarSucesso }) => {
  const { entrarComSenha, carregando } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [perfilSelecionadoDev, setPerfilSelecionadoDev] = useState<string | null>(null);

  // Regra de Segurança: Visível apenas em DEV ou quando VITE_ENABLE_DEV_LOGIN === "true"
  const exibirAlternadorDev =
    import.meta.env.DEV === true ||
    import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';

  const senhaPadraoDev =
    import.meta.env.VITE_DEV_LOGIN_PASSWORD || 'senha12345';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!email || !senha) {
      setErro('Por favor, informe o e-mail e a senha de acesso.');
      return;
    }

    const resultado = await entrarComSenha(email, senha);
    if (resultado.erro) {
      setErro(resultado.erro);
    } else {
      if (aoLogarSucesso) aoLogarSucesso();
    }
  };

  // Alternador de Homologação: preenche credenciais e autentica de verdade via Supabase
  const selecionarPerfilDev = async (emailSeed: string) => {
    setPerfilSelecionadoDev(emailSeed);
    setEmail(emailSeed);
    setSenha(senhaPadraoDev);
    setErro(null);

    // Executa autenticação real com a senha para respeitar RLS e tokens
    const resultado = await entrarComSenha(emailSeed, senhaPadraoDev);
    if (resultado.erro) {
      setErro(resultado.erro);
    } else {
      if (aoLogarSucesso) aoLogarSucesso();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1A33] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 antialiased selection:bg-[#00B2D6] selection:text-slate-950">
      {/* Container Centralizado */}
      <div className="w-full max-w-md">
        {/* Cabeçalho Institucional */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={logoAlufort}
              alt="AluFort Logo"
              className="h-16 w-auto object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            AluFort Sistemas de Alumínio
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide">
            TERMINAL DE CONTROLE & GESTÃO FABRIL
          </p>
        </div>

        {/* Cartão de Login: Paleta Estrita #12264A */}
        <div className="bg-[#12264A] rounded-2xl border border-[#2A3F5C] p-6 sm:p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white tracking-tight mb-2">
            Acesso ao Sistema
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Autentique-se com sua credencial operacional ou diretoria.
          </p>

          {/* Mensagem de Erro de Alto Contraste */}
          {erro && (
            <div className="mb-6 p-3.5 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-start gap-2.5 shadow-xs">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Falha na Autenticação</span>
                <span className="text-[11px] leading-relaxed">{erro}</span>
              </div>
            </div>
          )}

          {/* Formulário com Campos min-h-[48px] para tablet/galpão */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@esquadrias.com.br"
                  required
                  autoComplete="email"
                  className="w-full min-h-[48px] h-12 pl-11 pr-4 bg-[#14283F] border border-[#2A3F5C] rounded-lg text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-[#00B2D6] focus:ring-2 focus:ring-[#00B2D6]/20 transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full min-h-[48px] h-12 pl-11 pr-4 bg-[#14283F] border border-[#2A3F5C] rounded-lg text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-[#00B2D6] focus:ring-2 focus:ring-[#00B2D6]/20 transition-all font-sans"
                />
              </div>
            </div>

            {/* Botão de Ação Principal: #00B2D6 */}
            <button
              type="submit"
              disabled={carregando}
              className="w-full min-h-[48px] h-12 mt-2 bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-black text-sm rounded-lg shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider"
            >
              {carregando ? (
                <span>Validando Credenciais...</span>
              ) : (
                <>
                  <span>Entrar no Galpão</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Alternador de Perfis para Homologação (Visível apenas em DEV ou homologação explícita) */}
          {exibirAlternadorDev && (
            <div className="mt-8 pt-6 border-t border-[#2A3F5C]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#00B2D6]" />
                  Homologação de Perfis (RBAC)
                </span>
                <span className="text-[9px] font-mono bg-cyan-950/80 text-[#00B2D6] border border-[#00B2D6]/40 px-1.5 py-0.5 rounded">
                  DEV SEED
                </span>
              </div>

              <div className="space-y-2">
                {/* 1. Dono / Diretor */}
                <button
                  type="button"
                  onClick={() => selecionarPerfilDev('dono@local.test')}
                  disabled={carregando}
                  className={`w-full min-h-[48px] p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                    perfilSelecionadoDev === 'dono@local.test'
                      ? 'bg-cyan-950/60 border-[#00B2D6] text-white ring-1 ring-[#00B2D6]'
                      : 'bg-[#14283F] border-[#2A3F5C] text-slate-300 hover:border-slate-400 hover:bg-[#18304c]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Dono / Diretor
                        <span className="text-[10px] text-cyan-300 font-mono font-normal">→ /torre</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        dono@local.test • Visão Total & Margem
                      </div>
                    </div>
                  </div>
                  {perfilSelecionadoDev === 'dono@local.test' && (
                    <CheckCircle2 className="w-4 h-4 text-[#00B2D6] shrink-0" />
                  )}
                </button>

                {/* 2. Encarregado de Produção */}
                <button
                  type="button"
                  onClick={() => selecionarPerfilDev('encarregado@local.test')}
                  disabled={carregando}
                  className={`w-full min-h-[48px] p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                    perfilSelecionadoDev === 'encarregado@local.test'
                      ? 'bg-cyan-950/60 border-[#00B2D6] text-white ring-1 ring-[#00B2D6]'
                      : 'bg-[#14283F] border-[#2A3F5C] text-slate-300 hover:border-slate-400 hover:bg-[#18304c]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Encarregado de Produção
                        <span className="text-[10px] text-emerald-400 font-mono font-normal">→ /terminal</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        encarregado@local.test • 4 Ações Rápidas (Zero R$)
                      </div>
                    </div>
                  </div>
                  {perfilSelecionadoDev === 'encarregado@local.test' && (
                    <CheckCircle2 className="w-4 h-4 text-[#00B2D6] shrink-0" />
                  )}
                </button>

                {/* 3. Operador / Conferente */}
                <button
                  type="button"
                  onClick={() => selecionarPerfilDev('conferente@local.test')}
                  disabled={carregando}
                  className={`w-full min-h-[48px] p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                    perfilSelecionadoDev === 'conferente@local.test'
                      ? 'bg-cyan-950/60 border-[#00B2D6] text-white ring-1 ring-[#00B2D6]'
                      : 'bg-[#14283F] border-[#2A3F5C] text-slate-300 hover:border-slate-400 hover:bg-[#18304c]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        Operador / Conferente
                        <span className="text-[10px] text-emerald-400 font-mono font-normal">→ /terminal</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        conferente@local.test • Bipagem & Conferência
                      </div>
                    </div>
                  </div>
                  {perfilSelecionadoDev === 'conferente@local.test' && (
                    <CheckCircle2 className="w-4 h-4 text-[#00B2D6] shrink-0" />
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center mt-3">
                Ao clicar em um perfil, as credenciais são enviadas via signInWithPassword real.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé Seguro */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <span>Sistema Seguro com RLS (Row Level Security) e Auditoria Imutável</span>
        </div>
      </div>
    </div>
  );
};
