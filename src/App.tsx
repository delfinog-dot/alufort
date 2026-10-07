// ============================================================================
// APP: src/App.tsx
// Roteamento Inteligente, RBAC, NotificationCenter e Triagens 1 & 2
// Paleta Estrita: Fundo #0A1A33, Ação #00B2D6
// ============================================================================

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTriagemAlerts } from './hooks/useTriagemAlerts';
import { NotificationCenter } from './components/layout/NotificationCenter';
import { Login } from './pages/Login';
import { LocaisPage } from './pages/Locais';
import { Terminal as TerminalPage } from './pages/Terminal';
import { Torre as TorrePage } from './pages/Torre';
import { Qualidade as QualidadePage } from './pages/Qualidade';
import { Expedicao as ExpedicaoPage } from './pages/Expedicao';
import { Ferramentas as FerramentasPage } from './pages/Ferramentas';
import { Quarentena as QuarentenaPage } from './pages/Quarentena';
import logoAlufort from './assets/logo.png';
import { Toaster, toast } from 'sonner';
import {
  ShieldAlert,
  Crown,
  HardHat,
  LogOut,
  MapPin,
  TrendingUp,
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  CheckCircle2,
  Package,
  Scissors,
  ClipboardCheck,
  Truck,
  Database,
  Lock,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Sparkles,
  Check,
  XCircle,
} from 'lucide-react';

const queryClient = new QueryClient();

type RotaAtiva =
  | 'raiz'
  | 'torre'
  | 'terminal'
  | 'quarentena'
  | 'locais'
  | 'qualidade'
  | 'expedicao'
  | 'ferramentas'
  | 'regras_sql';

const AppContent: React.FC = () => {
  const { session, perfil, carregando, sair, ehDono, telaInicial, pode } = useAuth();
  const { simularAlertaQuarentena, simularAlertaMisturaCor } = useTriagemAlerts();
  const [rota, setRota] = useState<RotaAtiva>('raiz');
  const [mensagemBloqueio, setMensagemBloqueio] = useState<string | null>(null);

  // Listener para redirecionamento via clique no Toast "Ver Pendência" ou Notificações
  useEffect(() => {
    const handleNavegacaoCustom = (e: any) => {
      const link = (e.detail || window.location.hash || '').toLowerCase();
      if (link.includes('quarentena')) {
        navegarPara('quarentena');
      } else if (link.includes('qualidade')) {
        navegarPara('qualidade');
      } else if (link.includes('expedicao')) {
        navegarPara('expedicao');
      } else if (link.includes('ferramentas')) {
        navegarPara('ferramentas');
      } else if (link.includes('torre')) {
        navegarPara('torre');
      } else if (link.includes('terminal')) {
        navegarPara('terminal');
      } else if (link.includes('locais')) {
        navegarPara('locais');
      }
    };

    const handleHashChange = () => {
      if (window.location.hash) {
        handleNavegacaoCustom({ detail: window.location.hash });
      }
    };

    window.addEventListener('alufort_navegar', handleNavegacaoCustom);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('alufort_navegar', handleNavegacaoCustom);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [ehDono]);

  // Roteamento Inteligente da Raiz (/):
  // Redireciona automaticamente para a telaInicial do perfil logado
  useEffect(() => {
    if (perfil) {
      if (rota === 'raiz') {
        if (telaInicial === 'torre') {
          setRota('torre');
        } else if (telaInicial === 'terminal') {
          setRota('terminal');
        } else {
          setRota('locais');
        }
      }
    }
  }, [perfil, telaInicial, rota]);

  if (carregando && !perfil) {
    return (
      <div className="min-h-screen bg-[#0A1A33] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-3 border-[#00B2D6] border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono tracking-wider text-slate-400">
          AUTENTICANDO TERMINAL FABRIL...
        </span>
      </div>
    );
  }

  if (!session && !perfil) {
    return (
      <Login
        aoLogarSucesso={() => {
          setRota('raiz');
        }}
      />
    );
  }

  const navegarPara = (destino: RotaAtiva) => {
    setMensagemBloqueio(null);

    // GUARDA DA ROTA /torre: Exige estritamente 'sistema.dono'
    if (destino === 'torre' && !ehDono) {
      setMensagemBloqueio(
        'Acesso negado: a rota "/torre" é restrita a usuários com permissão "sistema.dono". Redirecionando para o Terminal Operacional.'
      );
      setRota('terminal');
      return;
    }

    setRota(destino);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-[#00B2D6] selection:text-slate-950">
      {/* Notificações Toaster do sonner */}
      <Toaster position="top-right" richColors theme="dark" closeButton />

      {/* Top Header Institucional (#0A1A33 e #00B2D6) */}
      <header className="w-full bg-[#0A1A33] text-white border-b border-[#2A3F5C] shadow-md sticky top-0 z-40">
        <div className="w-full px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Lado Esquerdo: Logo Oficial e Nome da Empresa */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              onClick={() => navegarPara('raiz')}
              className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity cursor-pointer text-left focus:outline-hidden"
            >
              <img
                src={logoAlufort}
                alt="AluFort Logo"
                className="h-8 sm:h-9 w-auto object-contain rounded"
              />
              <span className="text-xs sm:text-sm md:text-base font-black tracking-tight text-white uppercase whitespace-nowrap">
                AluFort Sistemas de Alumínio
              </span>
            </button>
          </div>

          {/* Centro Harmonizado: Abas de Navegação (visível em telas grandes >= 1280px para não espremer o usuário) */}
          <nav className="hidden xl:flex items-center justify-center flex-1 mx-2">
            <div className="flex items-center gap-1 bg-[#12264A]/70 p-1 rounded-xl border border-[#2A3F5C]/80 shadow-inner">
              {/* Torre de Controle: Visível EXCLUSIVAMENTE para o Dono */}
              {ehDono && (
                <button
                  onClick={() => navegarPara('torre')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    rota === 'torre'
                      ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Torre</span>
                </button>
              )}

              <button
                onClick={() => navegarPara('terminal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'terminal'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <HardHat className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terminal</span>
              </button>

              <button
                onClick={() => navegarPara('quarentena')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'quarentena'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Quarentena</span>
              </button>

              <button
                onClick={() => navegarPara('qualidade')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'qualidade'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Qualidade</span>
              </button>

              <button
                onClick={() => navegarPara('expedicao')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'expedicao'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Expedição</span>
              </button>

              <button
                onClick={() => navegarPara('ferramentas')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'ferramentas'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Ferramental</span>
              </button>

              <button
                onClick={() => navegarPara('locais')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  rota === 'locais'
                    ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Locais</span>
              </button>
            </div>
          </nav>

          {/* Lado Direito: Notificações, Usuário e Logout (Sempre 100% visível e protegido contra cortes) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            {/* Componente da Central de Notificações com sino e indicador pulsante */}
            <NotificationCenter
              onNavegar={(link) => {
                if (link.includes('quarentena')) {
                  navegarPara('quarentena');
                } else if (link.includes('qualidade')) {
                  navegarPara('qualidade');
                } else if (link.includes('expedicao')) {
                  navegarPara('expedicao');
                } else if (link.includes('ferramentas')) {
                  navegarPara('ferramentas');
                } else if (link.includes('terminal')) {
                  navegarPara('terminal');
                } else if (link.includes('torre')) {
                  navegarPara('torre');
                } else if (link.includes('locais')) {
                  navegarPara('locais');
                }
              }}
            />

            <div className="h-6 w-px bg-[#2A3F5C] mx-0.5 sm:mx-1" />

            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white flex items-center justify-end gap-1.5 whitespace-nowrap">
                {perfil?.nome}
                {ehDono ? (
                  <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-mono">
                    DONO
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase bg-blue-500 text-white px-1.5 py-0.2 rounded font-mono">
                    {perfil?.papel}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                {perfil?.email}
              </span>
            </div>

            <button
              onClick={() => sair()}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 hover:bg-[#14283F] rounded-lg transition-colors cursor-pointer"
              title="Encerrar Sessão (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-barra de navegação responsiva para tablets e laptops (< 1280px) garantindo espaço amplo para o cabeçalho */}
        <div className="xl:hidden px-4 py-2 border-t border-[#2A3F5C] bg-[#071324] overflow-x-auto flex items-center justify-center gap-1.5 scrollbar-none">
          {ehDono && (
            <button
              onClick={() => navegarPara('torre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                rota === 'torre'
                  ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Torre</span>
            </button>
          )}

          <button
            onClick={() => navegarPara('terminal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'terminal'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <HardHat className="w-3.5 h-3.5 text-cyan-400" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => navegarPara('quarentena')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'quarentena'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Quarentena</span>
          </button>

          <button
            onClick={() => navegarPara('qualidade')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'qualidade'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Qualidade</span>
          </button>

          <button
            onClick={() => navegarPara('expedicao')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'expedicao'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Expedição</span>
          </button>

          <button
            onClick={() => navegarPara('ferramentas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'ferramentas'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>Ferramental</span>
          </button>

          <button
            onClick={() => navegarPara('locais')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              rota === 'locais'
                ? 'bg-[#00B2D6] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#14283F]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Locais</span>
          </button>
        </div>
      </header>

      {mensagemBloqueio && (
        <div className="bg-rose-900/90 text-rose-100 px-4 py-2.5 border-b border-rose-700 flex items-center justify-center gap-2 text-xs font-medium">
          <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{mensagemBloqueio}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ROTA: /torre */}
        {rota === 'torre' && (
          <TorrePage
            aoNavegarParaTerminal={() => navegarPara('terminal')}
            aoNavegarParaLocais={() => navegarPara('locais')}
          />
        )}

        {/* ROTA: /quarentena (Página Dedicada SÓ da Quarentena) */}
        {rota === 'quarentena' && <QuarentenaPage />}

        {/* ROTA: /terminal */}
        {rota === 'terminal' && (
          <TerminalPage
            aoNavegarParaLocais={() => navegarPara('locais')}
            aoNavegarParaQualidade={() => navegarPara('qualidade')}
            aoNavegarParaExpedicao={() => navegarPara('expedicao')}
            aoNavegarParaFerramentas={() => navegarPara('ferramentas')}
            aoNavegarParaQuarentena={() => navegarPara('quarentena')}
          />
        )}

        {/* ROTA: /qualidade (Triagem 3) */}
        {rota === 'qualidade' && (
          <QualidadePage aoNavegarParaExpedicao={() => navegarPara('expedicao')} />
        )}

        {/* ROTA: /expedicao (Triagem 4) */}
        {rota === 'expedicao' && (
          <ExpedicaoPage aoNavegarParaQualidade={() => navegarPara('qualidade')} />
        )}

        {/* ROTA: /ferramentas (Módulo de Ferramental) */}
        {rota === 'ferramentas' && <FerramentasPage />}

        {/* ROTA: /locais */}
        {rota === 'locais' && <LocaisPage />}

        {/* ROTA: /regras_sql */}
        {rota === 'regras_sql' && (
          <div className="space-y-6 animate-in fade-in-50 duration-150">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 text-cyan-700 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                Garantia de Regra no Banco de Dados
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                Arquitetura de Banco — Entregáveis das Etapas A, B, C, E e F (Sistema v2 Completo)
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Regras no banco via Postgres RLS, Triagens 1 a 4, Validações Físicas, RPCs de Expedição, Ferramental e testes automatizados pgTAP.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-mono font-bold text-slate-500 block mb-1">
                    1. Triagem 3 (Qualidade)
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">2ª Reprovação ao Dono</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Checklist técnico (esquadro, EPDM, roldanas, película). 2ª falha consecutiva emite notificação crítica para 'sistema.dono' e OP de retrabalho.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-mono font-bold text-slate-500 block mb-1">
                    2. Triagem 4 (Expedição)
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Bipagem & Bloqueio Físico</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Validação em tempo real que bloqueia serial de outra obra ou sem aprovação com alerta sonoro e tela cheia vermelha.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-mono font-bold text-slate-500 block mb-1">
                    3. Módulo de Ferramentas
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Controle de Ferramentas Vencidas</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Rastreabilidade de gabaritos e ferramentas pneumáticas com alerta em tempo real de devolução expirada.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs font-mono font-bold text-slate-500 block mb-1">
                    4. Finalizar Expedição
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">Baixa no Ledger Imutável</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Transiciona para 'entregue' apenas com 100% das peças carregadas e comprovante assinado.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 shadow-md">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-3">
                <Terminal className="w-4 h-4" />
                Comandos de Migração e Testes Automatizados (Etapa F — Fase 3 Mínima)
              </div>
              <div className="bg-slate-950 p-3.5 rounded-lg font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
                <p className="text-slate-400"># 1. Aplicar a migration da Fase 3 Mínima no Supabase:</p>
                <p className="text-cyan-300">
                  supabase db push
                </p>
                <p className="text-slate-400 mt-2"># Ou diretamente via psql:</p>
                <p className="text-cyan-300">
                  psql "$DATABASE_URL" -f supabase/migrations/20261003000015_fase3_minima.sql
                </p>
                <p className="text-slate-400 mt-2"># 2. Executar os testes automatizados pgTAP da Etapa F:</p>
                <p className="text-cyan-300">
                  supabase test db --test supabase/tests/06_fase3.test.sql
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
