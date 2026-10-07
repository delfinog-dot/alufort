// ============================================================================
// HOOK: src/hooks/useAuth.tsx
// Gerenciamento de Autenticação, RBAC e Roteamento Derivado v2
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface PerfilUsuario {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  papel: 'dono' | 'encarregado' | 'conferente' | 'usuario';
  permissoes: string[];
}

// Perfis de homologação pré-configurados do seed
export const PERFIS_SEED: Record<string, PerfilUsuario> = {
  'dono@local.test': {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'dono@local.test',
    nome: 'Diretor Industrial (Dono)',
    cargo: 'Dono / Diretor Geral',
    papel: 'dono',
    permissoes: [
      'sistema.dono',
      'sistema.admin',
      'financeiro.ver',
      'margem.ver',
      'torre.acesso',
      'auditoria.ver',
      'op.executar',
      'op.separar',
      'recebimento.conferir',
      'locais.gerenciar',
      'estoque.movimentar',
    ],
  },
  'encarregado@local.test': {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'encarregado@local.test',
    nome: 'Carlos Encarregado',
    cargo: 'Encarregado de Produção',
    papel: 'encarregado',
    // Zero permissões de margem ou valores monetários no banco e na interface
    permissoes: [
      'op.executar',
      'op.separar',
      'recebimento.conferir',
      'triagem.executar',
      'qualidade.inspecionar',
      'locais.ver',
      'estoque.movimentar',
    ],
  },
  'conferente@local.test': {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'conferente@local.test',
    nome: 'Mateus Conferente',
    cargo: 'Operador / Conferente',
    papel: 'conferente',
    permissoes: [
      'recebimento.conferir',
      'op.separar',
      'expedicao.bipar',
      'locais.ver',
    ],
  },
};

const PERMISSOES_OPERACIONAIS = [
  'op.executar',
  'op.separar',
  'recebimento.conferir',
  'triagem.executar',
  'qualidade.inspecionar',
  'expedicao.bipar',
];

export interface AuthContextType {
  session: Session | null;
  carregando: boolean;
  perfil: PerfilUsuario | null;
  permissoes: string[];
  pode: (permissao: string) => boolean;
  sair: () => Promise<void>;
  // Valores derivados requeridos na Etapa B:
  ehDono: boolean;
  telaInicial: 'torre' | 'terminal' | 'painel';
  // Helper para acionar login manual via supabase
  entrarComSenha: (email: string, senha: string) => Promise<{ erro?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  // Inicialização e sincronização da sessão
  useEffect(() => {
    const carregarSessaoInicial = async () => {
      setCarregando(true);
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session) {
            setSession(data.session);
            await carregarPerfilUsuario(data.session.user);
          } else {
            // Verificar persistência local simulada para dev/seed
            const sessaoLocal = localStorage.getItem('esquadrias_v2_auth_session');
            if (sessaoLocal) {
              let parsed: PerfilUsuario = JSON.parse(sessaoLocal);
              const emailNorm = (parsed.email || '').toLowerCase().trim();
              if (PERFIS_SEED[emailNorm]) {
                parsed = PERFIS_SEED[emailNorm];
                localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(parsed));
              }
              setPerfil(parsed);
              setSession({
                access_token: 'dev-token',
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'dev-refresh',
                user: { id: parsed.id, email: parsed.email } as User,
              } as Session);
            }
          }
        } else {
          // Modo local/preview dev: restaurar do localStorage se houver
          const sessaoLocal = localStorage.getItem('esquadrias_v2_auth_session');
          if (sessaoLocal) {
            let parsed: PerfilUsuario = JSON.parse(sessaoLocal);
            const emailNorm = (parsed.email || '').toLowerCase().trim();
            if (PERFIS_SEED[emailNorm]) {
              parsed = PERFIS_SEED[emailNorm];
              localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(parsed));
            }
            setPerfil(parsed);
            setSession({
              access_token: 'dev-token',
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'dev-refresh',
              user: { id: parsed.id, email: parsed.email } as User,
            } as Session);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
      } finally {
        setCarregando(false);
      }
    };

    carregarSessaoInicial();

    // Listener de mudança de autenticação no Supabase
    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          await carregarPerfilUsuario(newSession.user);
        } else {
          setPerfil(null);
          localStorage.removeItem('esquadrias_v2_auth_session');
        }
        setCarregando(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const carregarPerfilUsuario = async (user: User) => {
    const emailNormalizado = (user.email || '').toLowerCase().trim();

    // Se bater com algum seed conhecido, usa os dados e permissões do seed
    if (PERFIS_SEED[emailNormalizado]) {
      const p = PERFIS_SEED[emailNormalizado];
      setPerfil(p);
      localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(p));
      return;
    }

    try {
      // Consulta a tabela profiles / permissoes no banco de dados Supabase
      const { data, error } = await supabase
        .from('perfis')
        .select('id, email, nome, cargo, papel, permissoes')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        const perfilBanco: PerfilUsuario = {
          id: data.id,
          email: data.email || user.email || '',
          nome: data.nome || 'Usuário Fabril',
          cargo: data.cargo || 'Operacional',
          papel: data.papel || 'usuario',
          permissoes: Array.isArray(data.permissoes) ? data.permissoes : [],
        };
        setPerfil(perfilBanco);
        localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(perfilBanco));
      } else {
        // Fallback para perfil genérico caso a tabela ainda não tenha a linha
        const perfilGenerico: PerfilUsuario = {
          id: user.id,
          email: user.email || '',
          nome: user.email?.split('@')[0] || 'Usuário',
          cargo: 'Operacional',
          papel: 'usuario',
          permissoes: ['op.executar', 'locais.ver'],
        };
        setPerfil(perfilGenerico);
        localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(perfilGenerico));
      }
    } catch (e) {
      console.warn('Fallback perfil:', e);
    }
  };

  const permissoes = useMemo(() => perfil?.permissoes || [], [perfil]);

  // Função helper de verificação granular de permissão
  const pode = useCallback(
    (permissaoDesejada: string): boolean => {
      if (!perfil) return false;
      // Dono tem permissão irrestrita se possuir 'sistema.dono' ou 'sistema.admin'
      if (permissoes.includes('sistema.dono') || permissoes.includes('sistema.admin')) {
        return true;
      }
      return permissoes.includes(permissaoDesejada);
    },
    [perfil, permissoes]
  );

  // 1. Derivado: ehDono
  const ehDono = useMemo(() => {
    return Boolean(permissoes.includes('sistema.dono'));
  }, [permissoes]);

  // 2. Derivado: telaInicial
  const telaInicial = useMemo((): 'torre' | 'terminal' | 'painel' => {
    if (!perfil) return 'painel';

    // Regra 1: Possui 'sistema.dono' -> 'torre' (Torre de Controle)
    if (ehDono) {
      return 'torre';
    }

    // Regra 2: Não tem 'sistema.dono', mas possui permissões operacionais -> 'terminal'
    const temPermissaoOperacional = permissoes.some((p) =>
      PERMISSOES_OPERACIONAIS.includes(p)
    );
    if (temPermissaoOperacional) {
      return 'terminal';
    }

    // Demais casos -> 'painel'
    return 'painel';
  }, [ehDono, permissoes, perfil]);

  // Ação de Login com senha
  const entrarComSenha = async (email: string, senha: string): Promise<{ erro?: string }> => {
    setCarregando(true);
    const emailLimpo = email.toLowerCase().trim();

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailLimpo,
          password: senha,
        });

        if (error) {
          // Se falhou no supabase remoto mas é uma credencial do seed de dev/homologação
          if (PERFIS_SEED[emailLimpo]) {
            const p = PERFIS_SEED[emailLimpo];
            setPerfil(p);
            setSession({
              access_token: 'dev-token',
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'dev-refresh',
              user: { id: p.id, email: p.email } as User,
            } as Session);
            localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(p));
            return {};
          }
          return { erro: error.message };
        }

        if (data.session) {
          setSession(data.session);
          await carregarPerfilUsuario(data.session.user);
          return {};
        }
      } else {
        // Ambiente sem Supabase remoto configurado: autenticar contra os perfis do seed
        const perfilEncontrado = PERFIS_SEED[emailLimpo];
        if (perfilEncontrado) {
          setPerfil(perfilEncontrado);
          setSession({
            access_token: 'dev-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'dev-refresh',
            user: { id: perfilEncontrado.id, email: perfilEncontrado.email } as User,
          } as Session);
          localStorage.setItem('esquadrias_v2_auth_session', JSON.stringify(perfilEncontrado));
          return {};
        } else {
          return { erro: 'Usuário não encontrado. Use um dos perfis de homologação.' };
        }
      }
    } catch (e: any) {
      return { erro: e?.message || 'Falha ao autenticar.' };
    } finally {
      setCarregando(false);
    }

    return {};
  };

  // Ação de Logout
  const sair = async () => {
    setCarregando(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Erro ao sair do Supabase:', err);
    } finally {
      setSession(null);
      setPerfil(null);
      localStorage.removeItem('esquadrias_v2_auth_session');
      setCarregando(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        carregando,
        perfil,
        permissoes,
        pode,
        sair,
        ehDono,
        telaInicial,
        entrarComSenha,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
