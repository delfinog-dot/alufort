-- ============================================================================
-- MIGRATION: 20261003000014_notificacoes.sql
-- ETAPA C: Central de Notificações, RLS e Triagens Obrigatórias (1 & 2)
-- ============================================================================

-- 1. Criação do enum de severidade
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severidade_notificacao') THEN
    CREATE TYPE public.severidade_notificacao AS ENUM ('info', 'aviso', 'critica');
  END IF;
END $$;

-- 2. Garantir schema private para funções de segurança
CREATE SCHEMA IF NOT EXISTS private;

-- 3. Garantir tabelas base de perfis e permissões se ainda não existirem
CREATE TABLE IF NOT EXISTS public.permissoes (
  codigo TEXT PRIMARY KEY,
  descricao TEXT,
  modulo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed de permissões fundamentais do sistema
INSERT INTO public.permissoes (codigo, descricao, modulo)
VALUES 
  ('sistema.dono', 'Acesso total e irrestrito da diretoria', 'sistema'),
  ('quarentena.decidir', 'Decisão de liberação ou refugo de material na quarentena', 'qualidade'),
  ('op.separar', 'Separação e conferência de materiais para Ordem de Produção', 'producao'),
  ('op.executar', 'Execução de corte e montagem de esquadrias', 'producao'),
  ('recebimento.conferir', 'Conferência cega de recebimento de materiais', 'estoque')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  papel TEXT NOT NULL DEFAULT 'operador',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.perfis_permissoes (
  perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  permissao_codigo TEXT NOT NULL REFERENCES public.permissoes(codigo) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, permissao_codigo)
);

CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  tabela TEXT,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidade public.severidade_notificacao NOT NULL DEFAULT 'info',
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  destinatario_permissao TEXT REFERENCES public.permissoes(codigo) ON DELETE SET NULL,
  destinatario_usuario UUID REFERENCES public.perfis(id) ON DELETE CASCADE,
  origem_tipo TEXT,
  origem_id TEXT,
  lida_em TIMESTAMPTZ,
  lida_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Realtime para public.notificacoes se publicação existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 5. Função utilitária para verificar se usuário tem determinada permissão
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(p_usuario_id UUID, p_permissao TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.perfis_permissoes pp
    WHERE pp.perfil_id = p_usuario_id
      AND (pp.permissao_codigo = p_permissao OR pp.permissao_codigo = 'sistema.dono')
  );
$$;

-- 6. Configurar RLS em public.notificacoes
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de notificacoes por permissao, destinatario ou dono" ON public.notificacoes;
CREATE POLICY "Leitura de notificacoes por permissao, destinatario ou dono"
ON public.notificacoes
FOR SELECT
USING (
  -- Caso o usuário logado seja o destinatário direto
  destinatario_usuario = auth.uid()
  OR
  -- Caso o usuário possua a permissão especificada
  (destinatario_permissao IS NOT NULL AND public.usuario_tem_permissao(auth.uid(), destinatario_permissao))
  OR
  -- Caso o usuário seja o Dono do sistema
  public.usuario_tem_permissao(auth.uid(), 'sistema.dono')
);

DROP POLICY IF EXISTS "Atualizacao de leitura da notificacao" ON public.notificacoes;
CREATE POLICY "Atualizacao de leitura da notificacao"
ON public.notificacoes
FOR UPDATE
USING (
  destinatario_usuario = auth.uid()
  OR (destinatario_permissao IS NOT NULL AND public.usuario_tem_permissao(auth.uid(), destinatario_permissao))
  OR public.usuario_tem_permissao(auth.uid(), 'sistema.dono')
)
WITH CHECK (
  -- Apenas marcar como lida (lida_em e lida_por)
  lida_em IS NOT NULL
);

-- 7. Função interna auxiliar para centralizar emissão de notificações
CREATE OR REPLACE FUNCTION private.emitir_notificacao(
  p_tipo TEXT,
  p_severidade public.severidade_notificacao,
  p_titulo TEXT,
  p_mensagem TEXT,
  p_link TEXT DEFAULT NULL,
  p_destinatario_permissao TEXT DEFAULT NULL,
  p_destinatario_usuario UUID DEFAULT NULL,
  p_origem_tipo TEXT DEFAULT NULL,
  p_origem_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  INSERT INTO public.notificacoes (
    tipo,
    severidade,
    titulo,
    mensagem,
    link,
    destinatario_permissao,
    destinatario_usuario,
    origem_tipo,
    origem_id
  ) VALUES (
    p_tipo,
    p_severidade,
    p_titulo,
    p_mensagem,
    p_link,
    p_destinatario_permissao,
    p_destinatario_usuario,
    p_origem_tipo,
    p_origem_id
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- 8. TRIAGEM 1: Tabela de Quarentena e Trigger de Alerta Crítico
CREATE TABLE IF NOT EXISTS public.quarentena (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  descricao TEXT,
  numero_nf TEXT NOT NULL,
  fornecedor TEXT,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  motivo_divergencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'retido', -- 'retido', 'liberado', 'refugo'
  local_id UUID REFERENCES public.locais(id),
  criado_por UUID REFERENCES public.perfis(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_alerta_quarentena_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Emite notificação de severidade 'critica' para permissão 'quarentena.decidir'
  PERFORM private.emitir_notificacao(
    'triagem_quarentena',
    'critica'::public.severidade_notificacao,
    'Material Retido em Quarentena',
    format('NF %s: SKU %s retido na Gaiola de Quarentena. Motivo: %s', NEW.numero_nf, NEW.sku, NEW.motivo_divergencia),
    '/quarentena',
    'quarentena.decidir',
    NULL,
    'quarentena',
    NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quarentena_inserida ON public.quarentena;
CREATE TRIGGER trg_quarentena_inserida
AFTER INSERT ON public.quarentena
FOR EACH ROW
EXECUTE FUNCTION public.trg_alerta_quarentena_entrada();

-- 9. TRIAGEM 2: Ordens de Produção (OP), Trava de Corte e Aprovação de Mistura de Cor
CREATE TABLE IF NOT EXISTS public.ordens_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_op TEXT UNIQUE NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejada', -- 'planejada', 'separacao', 'em_corte', 'concluida'
  medicao_tipo TEXT NOT NULL DEFAULT 'definitiva', -- 'definitiva', 'estimada'
  tem_mistura_cor BOOLEAN NOT NULL DEFAULT false,
  mistura_cor_aprovada BOOLEAN NOT NULL DEFAULT false,
  mistura_cor_aprovada_por UUID REFERENCES public.perfis(id),
  mistura_cor_motivo TEXT,
  mistura_cor_aprovada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Função RPC: aprovar_mistura_cor
CREATE OR REPLACE FUNCTION public.aprovar_mistura_cor(
  p_op UUID,
  p_motivo TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_op RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  -- Validar se o motivo foi preenchido
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'O motivo da aprovação de mistura de cores deve ser justificado (mínimo 5 caracteres).';
  END IF;

  -- Exigir permissão 'op.separar' ou 'sistema.dono'
  IF v_user_id IS NOT NULL AND NOT public.usuario_tem_permissao(v_user_id, 'op.separar') THEN
    RAISE EXCEPTION 'Usuário não possui a permissão "op.separar" para autorizar mistura de lotes de cor.';
  END IF;

  SELECT * INTO v_op FROM public.ordens_producao WHERE id = p_op;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção com ID % não encontrada.', p_op;
  END IF;

  -- Atualizar a OP
  UPDATE public.ordens_producao
  SET
    mistura_cor_aprovada = true,
    mistura_cor_aprovada_por = v_user_id,
    mistura_cor_motivo = p_motivo,
    mistura_cor_aprovada_em = now(),
    atualizado_em = now()
  WHERE id = p_op;

  -- Registrar na tabela de auditoria
  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos
  ) VALUES (
    v_user_id,
    'APROVACAO_MISTURA_COR_OP',
    'ordens_producao',
    p_op::text,
    jsonb_build_object('tem_mistura_cor', v_op.tem_mistura_cor, 'mistura_cor_aprovada', v_op.mistura_cor_aprovada),
    jsonb_build_object('mistura_cor_aprovada', true, 'motivo', p_motivo, 'aprovado_em', now())
  );

  -- Notificar a equipe de corte
  PERFORM private.emitir_notificacao(
    'triagem_corte',
    'aviso'::public.severidade_notificacao,
    'Mistura de Cor Aprovada em OP',
    format('OP %s: Mistura de lotes autorizada. Motivo: %s', v_op.numero_op, p_motivo),
    format('/terminal?op=%s', v_op.numero_op),
    'op.executar',
    NULL,
    'ordens_producao',
    p_op::text
  );

  RETURN true;
END;
$$;

-- Trigger de validação pré-corte (Trava de Corte Obrigatória)
CREATE OR REPLACE FUNCTION public.trg_validar_inicio_corte_op()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se a OP está tentando transitar para 'em_corte'
  IF NEW.status = 'em_corte' AND OLD.status <> 'em_corte' THEN
    -- Regra 1: Medição estimada bloqueia corte
    IF NEW.medicao_tipo = 'estimada' THEN
      RAISE EXCEPTION 'Não é permitido iniciar corte em OP com medição estimada. Obtenha a medição definitiva na obra.';
    END IF;

    -- Regra 2: Mistura de cor sem aprovação formal bloqueia corte
    IF NEW.tem_mistura_cor AND NOT NEW.mistura_cor_aprovada THEN
      RAISE EXCEPTION 'Não é permitido iniciar corte com mistura de lotes de cor sem aprovação formal.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trava_corte_op ON public.ordens_producao;
CREATE TRIGGER trg_trava_corte_op
BEFORE UPDATE OF status
ON public.ordens_producao
FOR EACH ROW
EXECUTE FUNCTION public.trg_validar_inicio_corte_op();
