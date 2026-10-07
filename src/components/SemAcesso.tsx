// ============================================================================
// COMPONENT: src/components/SemAcesso.tsx
// Tela de Acesso Negado para Rotas Restritas à Diretoria ('sistema.dono')
// ============================================================================

import React from 'react';
import { Lock, ShieldAlert, ArrowLeft, Crown } from 'lucide-react';

interface SemAcessoProps {
  aoVoltar?: () => void;
  permissaoNecessaria?: string;
}

export const SemAcesso: React.FC<SemAcessoProps> = ({
  aoVoltar,
  permissaoNecessaria = 'sistema.dono',
}) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-20 h-20 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-6 shadow-xl">
        <Lock className="w-10 h-10" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950 border border-rose-800 text-rose-300 text-xs font-mono font-bold mb-3">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
        ACESSO RESTRITO À DIRETORIA
      </div>

      <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl max-w-lg">
        Permissão Insuficiente para Acessar a Torre de Controle
      </h1>

      <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
        Esta rota contém indicadores executivos estratégicos, margens financeiras (R$) e auditoria de gestão restritos à credencial com a permissão{' '}
        <code className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs font-bold">
          {permissaoNecessaria}
        </code>.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#00B2D6] hover:bg-[#009bbd] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-98"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Terminal Operacional</span>
          </button>
        )}
      </div>

      <div className="mt-8 p-3 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-500 max-w-sm flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Para homologação deste módulo, utilize a credencial <strong>dono@local.test</strong> no alternador de login.</span>
      </div>
    </div>
  );
};
