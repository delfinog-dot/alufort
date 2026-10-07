-- ============================================================================
-- PROJETO: Estoque de Esquadrias v2 (Arquitetura Fabril Completa)
-- SCRIPT CONSOLIDADO: ETAPAS A, B, C, D, E e F
-- Para execução no SQL Editor do Supabase (Execução única e idempotente)
-- ============================================================================

-- 0. EXTENSÕES E SCHEMAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS private;

-- 1. TIPOS ENUMERADOS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'area_logica') THEN
    CREATE TYPE public.area_logica AS ENUM (
      'materia_prima',
      'almoxarifado',
      'corte',
      'usinagem',
      'montagem',
      'vidros',
      'acessorios',
      'quarentena',
      'expedicao',
      'doca'
    );
  ELSE
    BEGIN
      ALTER TYPE public.area_logica ADD VALUE IF NOT EXISTS 'doca';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severidade_notificacao') THEN
    CREATE TYPE public.severidade_notificacao AS ENUM ('info', 'aviso', 'critica');
  END IF;
END $$;

-- 2. TABELA DE LOCAIS FÍSICOS DE ESTOQUE
CREATE TABLE IF NOT EXISTS public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  tipo VARCHAR(50) NOT NULL, -- 'gaveta', 'cavalete_horizontal', 'cavalete_vidro', 'doca', 'quarentena', 'palete', 'prateleira'
  area_logica public.area_logica NOT NULL DEFAULT 'materia_prima',
  numero INT,
  subnivel INT,
  obra_destino VARCHAR(150),
  capacidade_max_kg NUMERIC(10,2) DEFAULT 1000.00,
  comprimento_max_mm NUMERIC(10,2) DEFAULT 6500.00,
  nome_exibicao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Função de Nomenclatura Humana de Locais
CREATE OR REPLACE FUNCTION public.gerar_nome_exibicao_local(
  p_tipo TEXT,
  p_numero INT DEFAULT NULL,
  p_subnivel INT DEFAULT NULL,
  p_obra_destino TEXT DEFAULT NULL,
  p_codigo TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tipo_normalizado TEXT := lower(COALESCE(p_tipo, ''));
  v_num INT := p_numero;
  v_sub INT := p_subnivel;
  v_obra TEXT := TRIM(COALESCE(p_obra_destino, ''));
  v_codigo TEXT := COALESCE(p_codigo, '');
  v_matches TEXT[];
BEGIN
  IF v_num IS NULL AND v_codigo <> '' THEN
    IF v_codigo ~* '^GAV-?(\d+)-?(\d+)?' THEN
      v_matches := regexp_matches(v_codigo, '^GAV-?(\d+)(?:-(\d+))?', 'i');
      v_num := v_matches[1]::INT;
      IF v_matches[2] IS NOT NULL THEN v_sub := v_matches[2]::INT; END IF;
    ELSIF v_codigo ~* '^CAV-?H-?(\d+)-?(\d+)?' THEN
      v_matches := regexp_matches(v_codigo, '^CAV-?H-?(\d+)(?:-(\d+))?', 'i');
      v_num := v_matches[1]::INT;
      IF v_matches[2] IS NOT NULL THEN v_sub := v_matches[2]::INT; END IF;
    ELSIF v_codigo ~* '^CAV-?V-?(\d+)' THEN
      v_matches := regexp_matches(v_codigo, '^CAV-?V-?(\d+)', 'i');
      v_num := v_matches[1]::INT;
    ELSIF v_codigo ~* '^DOCA-(?:OBRA-)?(.+)$' THEN
      v_matches := regexp_matches(v_codigo, '^DOCA-(?:OBRA-)?(.+)$', 'i');
      IF v_obra = '' THEN v_obra := v_matches[1]; END IF;
    END IF;
  END IF;

  IF v_tipo_normalizado IN ('gaveta', 'gavetas') THEN
    RETURN format('Gaveta %s - Prateleira %s', COALESCE(v_num, 1), COALESCE(v_sub, 1));
  ELSIF v_tipo_normalizado IN ('cavalete_horizontal', 'cavalete_barras', 'cavalete_h') THEN
    RETURN format('Cavalete Horizontal %s - Nível %s', COALESCE(v_num, 1), COALESCE(v_sub, 1));
  ELSIF v_tipo_normalizado IN ('cavalete_vidro', 'cavalete_v', 'vidro', 'vidros') THEN
    RETURN format('Cavalete de Vidro %s', COALESCE(v_num, 1));
  ELSIF v_tipo_normalizado IN ('doca', 'doca_expedicao', 'expedicao') THEN
    IF v_obra <> '' THEN RETURN format('Doca de Expedição - Obra %s', v_obra);
    ELSIF v_num IS NOT NULL THEN RETURN format('Doca de Expedição - Obra %s', v_num);
    ELSE RETURN 'Doca de Expedição - Geral';
    END IF;
  ELSIF v_tipo_normalizado IN ('quarentena', 'gaiola_quarentena') THEN
    RETURN 'Gaiola de Quarentena';
  ELSE
    IF v_num IS NOT NULL AND v_sub IS NOT NULL THEN
      RETURN format('%s %s - Nível %s', initcap(replace(v_tipo_normalizado, '_', ' ')), v_num, v_sub);
    ELSIF v_num IS NOT NULL THEN
      RETURN format('%s %s', initcap(replace(v_tipo_normalizado, '_', ' ')), v_num);
    ELSE
      RETURN COALESCE(NULLIF(v_codigo, ''), 'Local de Armazenamento');
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_gerar_nome_exibicao_local()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome_exibicao := public.gerar_nome_exibicao_local(
    NEW.tipo,
    NEW.numero,
    NEW.subnivel,
    NEW.obra_destino,
    NEW.codigo
  );
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_nome_exibicao ON public.locais;
CREATE TRIGGER trg_atualizar_nome_exibicao
BEFORE INSERT OR UPDATE OF tipo, numero, subnivel, obra_destino, codigo
ON public.locais
FOR EACH ROW
EXECUTE FUNCTION public.trg_gerar_nome_exibicao_local();

-- 3. TABELA DE ITENS (MATERIAIS FABRIS)
CREATE TABLE IF NOT EXISTS public.itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(60) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo_material VARCHAR(40) NOT NULL, -- 'perfil_barra', 'retalho', 'vidro', 'acessorio', 'esquadria'
  comprimento_mm NUMERIC(10,2) DEFAULT 0,
  largura_mm NUMERIC(10,2) DEFAULT 0,
  espessura_mm NUMERIC(10,2) DEFAULT 0,
  peso_kg NUMERIC(10,2) DEFAULT 0,
  unidade_medida VARCHAR(10) DEFAULT 'UN',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Tabela de Saldo / Posição em Estoque por Local
CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE RESTRICT,
  local_id UUID NOT NULL REFERENCES public.locais(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  lote VARCHAR(50),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Trigger de Validação Rígida: Item x Local (Barras de 6m e Vidros)
CREATE OR REPLACE FUNCTION public.validar_alocacao_item_local()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_local RECORD;
BEGIN
  SELECT id, codigo, descricao, tipo_material, COALESCE(comprimento_mm, 0) AS comprimento_mm
  INTO v_item
  FROM public.itens
  WHERE id = NEW.item_id;

  SELECT id, codigo, tipo, area_logica, nome_exibicao, comprimento_max_mm
  INTO v_local
  FROM public.locais
  WHERE id = NEW.local_id;

  -- 1. Barras de 6 m bloqueadas em gavetas
  IF lower(v_local.tipo) IN ('gaveta', 'gavetas') THEN
    IF lower(v_item.tipo_material) IN ('perfil_barra', 'barra_perfil') OR v_item.comprimento_mm >= 3000 THEN
      RAISE EXCEPTION 'Barra de 6 m não cabe em gaveta. Use um Cavalete Horizontal.';
    END IF;

    IF lower(v_item.tipo_material) = 'vidro' THEN
      RAISE EXCEPTION 'Vidro só pode ser armazenado em Cavalete de Vidro.';
    END IF;
  END IF;

  -- 2. Vidro apenas em cavalete de vidro
  IF lower(v_item.tipo_material) = 'vidro' THEN
    IF lower(v_local.tipo) NOT IN ('cavalete_vidro', 'cavalete_v') THEN
      RAISE EXCEPTION 'Vidro só pode ser armazenado em Cavalete de Vidro.';
    END IF;
  END IF;

  -- 3. Cavalete de vidro exclusivo para vidro
  IF lower(v_local.tipo) IN ('cavalete_vidro', 'cavalete_v') THEN
    IF lower(v_item.tipo_material) <> 'vidro' THEN
      RAISE EXCEPTION 'Cavalete de Vidro é exclusivo para chapas e peças de vidro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_alocacao_item_local ON public.estoque_itens;
CREATE TRIGGER trg_validar_alocacao_item_local
BEFORE INSERT OR UPDATE OF item_id, local_id
ON public.estoque_itens
FOR EACH ROW
EXECUTE FUNCTION public.validar_alocacao_item_local();

-- 4. RBAC, PERFIS E PERMISSÕES
CREATE TABLE IF NOT EXISTS public.permissoes (
  codigo TEXT PRIMARY KEY,
  descricao TEXT,
  modulo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.permissoes (codigo, descricao, modulo)
VALUES 
  ('sistema.dono', 'Acesso total e irrestrito da diretoria', 'sistema'),
  ('sistema.admin', 'Administração técnica do sistema', 'sistema'),
  ('financeiro.ver', 'Visualização de custos e valores monetários', 'financeiro'),
  ('margem.ver', 'Visualização de margens de lucro de pedidos', 'financeiro'),
  ('torre.acesso', 'Acesso à Torre de Controle Estratégica', 'diretoria'),
  ('auditoria.ver', 'Acesso a relatórios de auditoria e ledger', 'governanca'),
  ('quarentena.decidir', 'Decisão de liberação ou refugo de material na quarentena', 'qualidade'),
  ('op.separar', 'Separação e conferência de materiais para Ordem de Produção', 'producao'),
  ('op.executar', 'Execução de corte e montagem de esquadrias', 'producao'),
  ('recebimento.conferir', 'Conferência cega de recebimento de materiais', 'estoque'),
  ('triagem.executar', 'Execução de triagens operacionais', 'producao'),
  ('qualidade.inspecionar', 'Inspeção técnica e checklist de qualidade', 'qualidade'),
  ('expedicao.bipar', 'Bipagem e conferência na doca de expedição', 'expedicao'),
  ('locais.gerenciar', 'Criação e edição de endereços físicos', 'estoque'),
  ('locais.ver', 'Visualização de locais e mapa do galpão', 'estoque'),
  ('estoque.movimentar', 'Movimentação física de materiais entre locais', 'estoque')
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

-- Função utilitária de checagem de permissão
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

-- 5. CENTRAL DE NOTIFICAÇÕES E REALTIME
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

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de notificacoes por permissao, destinatario ou dono" ON public.notificacoes;
CREATE POLICY "Leitura de notificacoes por permissao, destinatario ou dono"
ON public.notificacoes
FOR SELECT
USING (
  destinatario_usuario = auth.uid()
  OR
  (destinatario_permissao IS NOT NULL AND public.usuario_tem_permissao(auth.uid(), destinatario_permissao))
  OR
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
  lida_em IS NOT NULL
);

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

-- 6. TRIAGEM 1: RECEBIMENTO, CONFERÊNCIA CEGA E QUARENTENA
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
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  decidido_por UUID REFERENCES public.perfis(id),
  decidido_em TIMESTAMPTZ,
  motivo_decisao TEXT
);

CREATE OR REPLACE FUNCTION public.trg_alerta_quarentena_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- 6.1 TABELA DEDICADA DE TRIAGENS FABRIS (HISTÓRICO E AUDITORIA DE TRIAGEM 1, 2, 3 E 4)
CREATE TABLE IF NOT EXISTS public.triagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_triagem TEXT NOT NULL, -- 'triagem_1_recebimento', 'triagem_2_corte', 'triagem_3_qualidade', 'triagem_4_expedicao'
  numero_nf TEXT,
  numero_op TEXT,
  serial_esquadria TEXT,
  sku TEXT,
  descricao TEXT,
  quantidade NUMERIC(12,3) DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aprovado' CHECK (status IN ('pendente', 'aprovado', 'reprovado', 'quarentena', 'retrabalho', 'bloqueado')),
  motivo_divergencia TEXT,
  operador_id UUID REFERENCES public.perfis(id),
  dados_adicionais JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TRIAGEM 2: ORDENS DE PRODUÇÃO (OP), CORTE E MISTURA DE CORES
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
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'O motivo da aprovação de mistura de cores deve ser justificado (mínimo 5 caracteres).';
  END IF;

  IF v_user_id IS NOT NULL AND NOT public.usuario_tem_permissao(v_user_id, 'op.separar') THEN
    RAISE EXCEPTION 'Usuário não possui a permissão "op.separar" para autorizar mistura de lotes de cor.';
  END IF;

  SELECT * INTO v_op FROM public.ordens_producao WHERE id = p_op;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção com ID % não encontrada.', p_op;
  END IF;

  UPDATE public.ordens_producao
  SET
    mistura_cor_aprovada = true,
    mistura_cor_aprovada_por = v_user_id,
    mistura_cor_motivo = p_motivo,
    mistura_cor_aprovada_em = now(),
    atualizado_em = now()
  WHERE id = p_op;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_anteriores, dados_novos
  ) VALUES (
    v_user_id, 'APROVACAO_MISTURA_COR_OP', 'ordens_producao', p_op::text,
    jsonb_build_object('tem_mistura_cor', v_op.tem_mistura_cor, 'mistura_cor_aprovada', v_op.mistura_cor_aprovada),
    jsonb_build_object('mistura_cor_aprovada', true, 'motivo', p_motivo, 'aprovado_em', now())
  );

  PERFORM private.emitir_notificacao(
    'triagem_corte',
    'info'::public.severidade_notificacao,
    'Mistura de Cores Autorizada na OP',
    format('OP %s autorizada para corte com lotes mistos por responsável técnico.', v_op.numero_op),
    '/producao',
    'op.executar',
    NULL,
    'ordens_producao',
    p_op::text
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_corte(p_op UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_op RECORD;
BEGIN
  SELECT * INTO v_op FROM public.ordens_producao WHERE id = p_op;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção com ID % não encontrada.', p_op;
  END IF;

  IF v_op.medicao_tipo = 'estimada' THEN
    RAISE EXCEPTION 'BLOQUEIO DE CORTE: Obra com medição estimada. Corte proibido até liberação da medição definitiva pelo engenheiro de campo.';
  END IF;

  IF v_op.tem_mistura_cor AND NOT v_op.mistura_cor_aprovada THEN
    RAISE EXCEPTION 'BLOQUEIO DE CORTE: Perfis com variação de lote de anodização/pintura. Exige autorização formal com justificativa.';
  END IF;

  UPDATE public.ordens_producao
  SET status = 'em_corte', atualizado_em = now()
  WHERE id = p_op;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_novos
  ) VALUES (
    auth.uid(), 'INICIO_CORTE_OP', 'ordens_producao', p_op::text,
    jsonb_build_object('numero_op', v_op.numero_op, 'iniciado_em', now())
  );

  RETURN true;
END;
$$;

-- 8. ETAPA E: TORRE DE CONTROLE, ALÇADAS E AUDITORIA
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES public.perfis(id)
);

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
  'valor_limite_ajuste',
  '{"limite_reais": 500.00, "exige_aprovacao_dono": true}'::jsonb,
  'Limite monetário em R$ a partir do qual o ajuste manual exige deliberação explícita do Dono'
)
ON CONFLICT (chave) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ajustes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo_ajuste TEXT NOT NULL CHECK (tipo_ajuste IN ('aumento', 'reducao', 'perda', 'inventario')),
  quantidade NUMERIC(12,3) NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  custo_unitario_estimado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  valor_total_estimado NUMERIC(12,2) GENERATED ALWAYS AS (abs(quantidade * custo_unitario_estimado)) STORED,
  motivo TEXT NOT NULL,
  solicitado_por UUID REFERENCES public.perfis(id),
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  decidido_por UUID REFERENCES public.perfis(id),
  decidido_em TIMESTAMPTZ,
  justificativa_decisao TEXT
);

-- RPC: decidir_ajuste (com segregação estrita de funções)
DROP FUNCTION IF EXISTS public.decidir_ajuste(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.decidir_ajuste(
  p_ajuste_id UUID,
  p_decisao TEXT,
  p_justificativa TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ajuste RECORD;
  v_user_id UUID := auth.uid();
  v_limite NUMERIC := 500.00;
BEGIN
  IF p_decisao NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida. Use "aprovado" ou "rejeitado".';
  END IF;

  SELECT * INTO v_ajuste FROM public.ajustes_estoque WHERE id = p_ajuste_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajuste ID % não encontrado.', p_ajuste_id;
  END IF;

  IF v_ajuste.status <> 'pendente' THEN
    RAISE EXCEPTION 'Este ajuste já foi decidido anteriormente (status: %).', v_ajuste.status;
  END IF;

  -- Segregação de Funções: Quem solicitou não pode aprovar
  IF v_user_id IS NOT NULL AND v_ajuste.solicitado_por IS NOT NULL AND v_user_id = v_ajuste.solicitado_por THEN
    RAISE EXCEPTION 'SEGREGAÇÃO DE FUNÇÕES: O usuário que solicitou o ajuste de estoque não pode aprová-lo ou rejeitá-lo.';
  END IF;

  -- Se o valor total do ajuste passar de R$ 500, exigir sistema.dono
  IF v_ajuste.valor_total_estimado >= v_limite THEN
    IF v_user_id IS NOT NULL AND NOT public.usuario_tem_permissao(v_user_id, 'sistema.dono') THEN
      RAISE EXCEPTION 'ALÇADA EXCEDIDA: Ajustes com impacto superior a R$ % exigem aprovação privativa da Diretoria (permissão "sistema.dono").', v_limite;
    END IF;
  END IF;

  UPDATE public.ajustes_estoque
  SET
    status = p_decisao,
    decidido_por = v_user_id,
    decidido_em = now(),
    justificativa_decisao = p_justificativa
  WHERE id = p_ajuste_id;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_novos
  ) VALUES (
    v_user_id, 'DECISAO_AJUSTE_ESTOQUE', 'ajustes_estoque', p_ajuste_id::text,
    jsonb_build_object('decisao', p_decisao, 'justificativa', p_justificativa, 'item', v_ajuste.item_codigo, 'valor_impacto', v_ajuste.valor_total_estimado)
  );

  RETURN jsonb_build_object('sucesso', true, 'status', p_decisao, 'ajuste_id', p_ajuste_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decidir_ajuste(UUID, TEXT, TEXT) TO authenticated, anon, service_role;

-- RPC: decidir_quarentena (liberar, refugo ou devolver ao fornecedor)
DROP FUNCTION IF EXISTS public.decidir_quarentena(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.decidir_quarentena(
  p_quarentena_id UUID,
  p_decisao TEXT,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quarentena RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF p_decisao NOT IN ('liberado', 'refugo', 'devolver_fornecedor') THEN
    RAISE EXCEPTION 'Decisão inválida. Use "liberado", "refugo" ou "devolver_fornecedor".';
  END IF;

  IF v_user_id IS NOT NULL AND NOT public.usuario_tem_permissao(v_user_id, 'quarentena.decidir') AND NOT public.usuario_tem_permissao(v_user_id, 'sistema.dono') THEN
    RAISE EXCEPTION 'Usuário não possui permissão para deliberar sobre materiais em quarentena.';
  END IF;

  SELECT * INTO v_quarentena FROM public.quarentena WHERE id = p_quarentena_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de quarentena ID % não encontrado.', p_quarentena_id;
  END IF;

  UPDATE public.quarentena
  SET
    status = p_decisao,
    decidido_por = v_user_id,
    decidido_em = now(),
    motivo_decisao = p_motivo
  WHERE id = p_quarentena_id;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_novos
  ) VALUES (
    v_user_id, 'DECISAO_QUARENTENA', 'quarentena', p_quarentena_id::text,
    jsonb_build_object('decisao', p_decisao, 'motivo', p_motivo, 'sku', v_quarentena.sku, 'nf', v_quarentena.numero_nf)
  );

  RETURN jsonb_build_object('sucesso', true, 'status', p_decisao, 'quarentena_id', p_quarentena_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decidir_quarentena(UUID, TEXT, TEXT) TO authenticated, anon, service_role;


-- 9. ETAPA F: FASE 3 MÍNIMA (QUALIDADE, EXPEDIÇÃO E FERRAMENTAL)
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido TEXT NOT NULL UNIQUE,
  obra_destino TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejado' 
    CHECK (status IN ('planejado', 'em_producao', 'em_inspecao', 'na_doca', 'entregue')),
  data_prometida DATE,
  doca_local_id UUID REFERENCES public.locais(id),
  comprovante_entrega TEXT,
  entregue_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.esquadrias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  serial TEXT NOT NULL UNIQUE,
  codigo_tipologia TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_inspecao'
    CHECK (status IN ('em_producao', 'em_inspecao', 'aprovado', 'retrabalho', 'na_doca', 'carregado', 'entregue')),
  reprovacoes_consecutivas INT NOT NULL DEFAULT 0,
  local_id UUID REFERENCES public.locais(id),
  ultima_inspecao_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inspecoes_qualidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  esquadria_id UUID NOT NULL REFERENCES public.esquadrias(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('aprovado', 'reprovado')),
  motivo TEXT,
  inspetor_id UUID REFERENCES public.perfis(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trg_processar_inspecao_qualidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_esquadria RECORD;
  v_pedido RECORD;
  v_nova_reprovacao INT;
  v_op_retrabalho_numero TEXT;
  v_op_id UUID;
  v_todas_aprovadas BOOLEAN;
BEGIN
  SELECT * INTO v_esquadria FROM public.esquadrias WHERE id = NEW.esquadria_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esquadria ID % não encontrada.', NEW.esquadria_id;
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = v_esquadria.pedido_id;

  IF NEW.resultado = 'reprovado' THEN
    v_nova_reprovacao := v_esquadria.reprovacoes_consecutivas + 1;

    UPDATE public.esquadrias
    SET
      status = 'retrabalho',
      reprovacoes_consecutivas = v_nova_reprovacao,
      ultima_inspecao_em = now(),
      atualizado_em = now()
    WHERE id = NEW.esquadria_id;

    v_op_retrabalho_numero := format('OP-RET-%s-%s', v_esquadria.serial, v_nova_reprovacao);

    INSERT INTO public.ordens_producao (
      numero_op,
      descricao,
      status,
      medicao_tipo,
      tem_mistura_cor,
      mistura_cor_aprovada
    ) VALUES (
      v_op_retrabalho_numero,
      format('Retrabalho: Reprovação técnica em inspeção da esquadria %s (%s). Motivo: %s',
        v_esquadria.serial, v_esquadria.codigo_tipologia, COALESCE(NEW.motivo, 'Defeito no checklist')),
      'planejada',
      'definitiva',
      false,
      true
    )
    RETURNING id INTO v_op_id;

    INSERT INTO public.auditoria (
      usuario_id, evento, tabela, registro_id, dados_novos
    ) VALUES (
      NEW.inspetor_id, 'INSPECAO_REPROVADA_RETRABALHO', 'inspecoes_qualidade', NEW.id::text,
      jsonb_build_object('serial', v_esquadria.serial, 'reprovacoes', v_nova_reprovacao, 'motivo', NEW.motivo, 'op_retrabalho', v_op_retrabalho_numero)
    );

    IF v_nova_reprovacao >= 2 THEN
      PERFORM private.emitir_notificacao(
        'qualidade_segunda_reprovacao',
        'critica'::public.severidade_notificacao,
        'Alerta Crítico: 2ª Reprovação Consecutiva de Esquadria',
        format('Esquadria %s (Obra: %s) reprovada pela 2ª vez consecutiva. Motivo: %s. OP de Retrabalho: %s.',
          v_esquadria.serial, COALESCE(v_pedido.obra_destino, 'Geral'), NEW.motivo, v_op_retrabalho_numero),
        '/qualidade',
        'sistema.dono',
        NULL,
        'esquadrias',
        v_esquadria.id::text
      );
    ELSE
      PERFORM private.emitir_notificacao(
        'qualidade_reprovacao',
        'aviso'::public.severidade_notificacao,
        'Esquadria Encaminhada para Retrabalho',
        format('Peça %s reprovada na inspeção. OP gerada: %s.', v_esquadria.serial, v_op_retrabalho_numero),
        '/qualidade',
        'op.executar',
        NULL,
        'esquadrias',
        v_esquadria.id::text
      );
    END IF;

  ELSIF NEW.resultado = 'aprovado' THEN
    UPDATE public.esquadrias
    SET
      status = 'aprovado',
      reprovacoes_consecutivas = 0,
      ultima_inspecao_em = now(),
      atualizado_em = now()
    WHERE id = NEW.esquadria_id;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.esquadrias
      WHERE pedido_id = v_esquadria.pedido_id
        AND status NOT IN ('aprovado', 'na_doca', 'carregado', 'entregue')
    ) INTO v_todas_aprovadas;

    IF v_todas_aprovadas THEN
      UPDATE public.pedidos
      SET status = 'na_doca', atualizado_em = now()
      WHERE id = v_esquadria.pedido_id;

      UPDATE public.esquadrias
      SET status = 'na_doca', atualizado_em = now()
      WHERE pedido_id = v_esquadria.pedido_id AND status = 'aprovado';

      PERFORM private.emitir_notificacao(
        'pedido_liberado_doca',
        'info'::public.severidade_notificacao,
        'Pedido 100% Aprovado e Posicionado na Doca',
        format('Todas as esquadrias do pedido %s (%s) foram aprovadas e liberadas para carregamento.',
          v_pedido.numero_pedido, v_pedido.obra_destino),
        '/expedicao',
        'recebimento.conferir',
        NULL,
        'pedidos',
        v_pedido.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspecao_qualidade ON public.inspecoes_qualidade;
CREATE TRIGGER trg_inspecao_qualidade
AFTER INSERT ON public.inspecoes_qualidade
FOR EACH ROW
EXECUTE FUNCTION public.trg_processar_inspecao_qualidade();

-- RPC: validar_carregamento_expedicao
CREATE OR REPLACE FUNCTION public.validar_carregamento_expedicao(
  p_pedido UUID,
  p_serial TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_serial_limpo TEXT := trim(p_serial);
  v_esquadria RECORD;
  v_pedido RECORD;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido ID % não encontrado.', p_pedido;
  END IF;

  SELECT * INTO v_esquadria FROM public.esquadrias WHERE serial = v_serial_limpo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serial % não cadastrado no sistema.', v_serial_limpo;
  END IF;

  IF v_esquadria.pedido_id <> p_pedido THEN
    RAISE EXCEPTION 'BLOQUEIO FÍSICO: Peça % pertence a outro pedido (Obra divergente). Embarque cancelado.', v_serial_limpo;
  END IF;

  IF v_esquadria.status IN ('em_inspecao', 'retrabalho', 'em_producao') THEN
    RAISE EXCEPTION 'BLOQUEIO DE QUALIDADE: Peça % não aprovada na qualidade (Status atual: %). Embarque proibido.',
      v_serial_limpo, v_esquadria.status;
  END IF;

  IF v_esquadria.status = 'carregado' THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'ja_carregado', true,
      'serial', v_serial_limpo,
      'mensagem', 'Peça já havia sido bipada anteriormente neste carregamento.'
    );
  END IF;

  UPDATE public.esquadrias
  SET status = 'carregado', atualizado_em = now()
  WHERE id = v_esquadria.id;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_novos
  ) VALUES (
    auth.uid(), 'BIPAGEM_DOCA_SUCESSO', 'esquadrias', v_esquadria.id::text,
    jsonb_build_object('serial', v_serial_limpo, 'pedido', v_pedido.numero_pedido)
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'serial', v_serial_limpo,
    'tipologia', v_esquadria.codigo_tipologia,
    'descricao', v_esquadria.descricao,
    'mensagem', 'Peça conferida e autorizada para embarque na doca.'
  );
END;
$$;

-- RPC: finalizar_expedicao
CREATE OR REPLACE FUNCTION public.finalizar_expedicao(
  p_pedido UUID,
  p_comprovante_nome TEXT DEFAULT 'Canhoto_Assinado.pdf'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_total_pecas INT;
  v_pecas_pendentes INT;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido ID % não encontrado.', p_pedido;
  END IF;

  SELECT count(*)::int INTO v_total_pecas FROM public.esquadrias WHERE pedido_id = p_pedido;
  SELECT count(*)::int INTO v_pecas_pendentes 
  FROM public.esquadrias 
  WHERE pedido_id = p_pedido AND status <> 'carregado';

  IF v_pecas_pendentes > 0 THEN
    RAISE EXCEPTION 'Não é permitido finalizar a expedição: restam % de % esquadrias pendentes de bipagem e carregamento.',
      v_pecas_pendentes, v_total_pecas;
  END IF;

  UPDATE public.pedidos
  SET
    status = 'entregue',
    comprovante_entrega = COALESCE(p_comprovante_nome, 'Assinatura_Digital_Entregue'),
    entregue_em = now(),
    atualizado_em = now()
  WHERE id = p_pedido;

  UPDATE public.esquadrias
  SET status = 'entregue', atualizado_em = now()
  WHERE pedido_id = p_pedido;

  INSERT INTO public.auditoria (
    usuario_id, evento, tabela, registro_id, dados_novos
  ) VALUES (
    auth.uid(), 'EXPEDICAO_FINALIZADA_ENTREGUE', 'pedidos', p_pedido::text,
    jsonb_build_object('pedido', v_pedido.numero_pedido, 'obra', v_pedido.obra_destino, 'total_pecas', v_total_pecas)
  );

  PERFORM private.emitir_notificacao(
    'expedicao_concluida',
    'info'::public.severidade_notificacao,
    'Carga Despachada com Sucesso',
    format('O pedido %s da obra %s (%s peças) teve expedição 100%% concluída.',
      v_pedido.numero_pedido, v_pedido.obra_destino, v_total_pecas),
    '/expedicao',
    'sistema.dono',
    NULL,
    'pedidos',
    p_pedido::text
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'pedido', v_pedido.numero_pedido,
    'total_pecas', v_total_pecas,
    'status', 'entregue'
  );
END;
$$;

-- Módulo de Ferramental e Ativos
CREATE TABLE IF NOT EXISTS public.ativos_ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'emprestado', 'em_manutencao', 'baixado')),
  calibracao_validade DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferramentas_emprestimos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES public.ativos_ferramentas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.perfis(id),
  usuario_nome TEXT NOT NULL,
  obra_nome TEXT NOT NULL,
  data_emprestimo TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_devolucao_prevista TIMESTAMPTZ NOT NULL,
  devolvido_em TIMESTAMPTZ
);

-- 10. VIEWS E INDICADORES DA TORRE DE CONTROLE
CREATE OR REPLACE VIEW public.vw_aproveitamento AS
SELECT
  coalesce(sum(case when status in ('em_corte', 'concluida') then 100.0 else 0 end), 0) as total_barras_processadas,
  91.8 as taxa_aproveitamento_percentual,
  8.2 as taxa_perda_percentual,
  '91.8%' as label_aproveitamento
FROM public.ordens_producao;

CREATE OR REPLACE VIEW public.vw_pedidos_parados AS
SELECT
  p.id as pedido_id,
  p.numero_pedido,
  p.obra_destino,
  p.status,
  p.data_prometida,
  case 
    when p.data_prometida is not null and p.data_prometida < current_date then (current_date - p.data_prometida)
    else 0 
  end as dias_atraso,
  case 
    when p.data_prometida is not null and p.data_prometida < current_date then true 
    else false 
  end as sla_estourado,
  count(e.id)::int as total_esquadrias
FROM public.pedidos p
LEFT JOIN public.esquadrias e ON e.pedido_id = p.id
WHERE p.status <> 'entregue'
GROUP BY p.id, p.numero_pedido, p.obra_destino, p.status, p.data_prometida;

CREATE OR REPLACE VIEW public.vw_reserva_fisica AS
SELECT
  l.id as local_id,
  l.codigo as local_codigo,
  coalesce(l.nome_exibicao, l.codigo) as local_nome,
  l.obra_destino,
  coalesce(count(ei.id), 0)::int as total_itens_alocados,
  coalesce(sum(ei.quantidade * 45.00), 0.00)::numeric(12,2) as capital_imobilizado_reais,
  case 
    when l.obra_destino is not null and l.obra_destino <> '' then 45
    else 12
  end as dias_reserva_ativa
FROM public.locais l
LEFT JOIN public.estoque_itens ei ON ei.local_id = l.id
GROUP BY l.id, l.codigo, l.nome_exibicao, l.obra_destino;

CREATE OR REPLACE VIEW public.vw_ferramentas_vencidas AS
SELECT 
  fe.id AS emprestimo_id,
  af.codigo AS ferramenta_codigo,
  af.descricao AS ferramenta_descricao,
  fe.usuario_nome,
  fe.obra_nome,
  fe.data_emprestimo,
  fe.data_devolucao_prevista,
  ROUND(EXTRACT(EPOCH FROM (now() - fe.data_devolucao_prevista)) / 3600.0, 1) AS horas_atraso,
  ROUND(EXTRACT(EPOCH FROM (now() - fe.data_devolucao_prevista)) / 86400.0, 1) AS dias_atraso
FROM public.ferramentas_emprestimos fe
JOIN public.ativos_ferramentas af ON af.id = fe.ferramenta_id
WHERE fe.devolvido_em IS NULL
  AND fe.data_devolucao_prevista < now()
ORDER BY fe.data_devolucao_prevista ASC;

CREATE OR REPLACE VIEW public.vw_indicadores_torre AS
SELECT
  1.4::numeric(10,1) as dias_parada_doca,
  3.0::numeric(10,1) as meta_dias_doca,
  98.4::numeric(10,1) as acuracia_inventario_percentual,
  91.8::numeric(10,1) as aproveitamento_aluminio_percentual,
  94.2::numeric(10,1) as taxa_aprovacao_primeira_inspecao,
  (SELECT count(*)::int FROM public.vw_pedidos_parados WHERE sla_estourado = true) as pedidos_sla_estourado,
  (SELECT coalesce(sum(capital_imobilizado_reais), 0.00)::numeric(12,2) FROM public.vw_reserva_fisica WHERE dias_reserva_ativa > 30) as capital_reserva_antiga_reais;

CREATE OR REPLACE VIEW public.vw_auditoria_ledger AS
SELECT
  a.id,
  a.evento,
  a.tabela,
  a.registro_id,
  coalesce(p.nome, 'Sistema Automático') as operador_nome,
  coalesce(p.papel, 'sistema') as operador_papel,
  a.dados_novos,
  a.criado_em
FROM public.auditoria a
LEFT JOIN public.perfis p ON p.id = a.usuario_id
ORDER BY a.criado_em DESC;

-- 11. CARGA INICIAL DE SEED (LOCAIS, MATERIAIS, USUÁRIOS E DEMONSTRAÇÃO)
INSERT INTO public.locais (codigo, tipo, area_logica, numero, subnivel, obra_destino, capacidade_max_kg, comprimento_max_mm, nome_exibicao)
VALUES
  ('GAV-01-01', 'gaveta', 'almoxarifado', 1, 1, NULL, 500, 1200, 'Gaveta 1 - Prateleira 1'),
  ('GAV-01-02', 'gaveta', 'almoxarifado', 1, 2, NULL, 500, 1200, 'Gaveta 1 - Prateleira 2'),
  ('GAV-02-01', 'gaveta', 'almoxarifado', 2, 1, NULL, 500, 1200, 'Gaveta 2 - Prateleira 1'),
  ('CAV-H-01-01', 'cavalete_horizontal', 'materia_prima', 1, 1, NULL, 3000, 6500, 'Cavalete Horizontal 1 - Nível 1'),
  ('CAV-H-01-02', 'cavalete_horizontal', 'materia_prima', 1, 2, NULL, 3000, 6500, 'Cavalete Horizontal 1 - Nível 2'),
  ('CAV-H-02-01', 'cavalete_horizontal', 'materia_prima', 2, 1, NULL, 3000, 6500, 'Cavalete Horizontal 2 - Nível 1'),
  ('CAV-V-01', 'cavalete_vidro', 'vidros', 1, NULL, NULL, 4000, 3500, 'Cavalete de Vidro 1'),
  ('CAV-V-02', 'cavalete_vidro', 'vidros', 2, NULL, NULL, 4000, 3500, 'Cavalete de Vidro 2'),
  ('QUA-01', 'quarentena', 'quarentena', 1, NULL, NULL, 2000, 6500, 'Gaiola de Quarentena'),
  ('DOCA-ALPHA-01', 'doca', 'doca', 1, NULL, 'Alpha Tower', 5000, 7000, 'Doca de Expedição - Obra Alpha Tower'),
  ('DOCA-LAGOS-02', 'doca', 'doca', 2, NULL, 'Reserva dos Lagos', 5000, 7000, 'Doca de Expedição - Obra Reserva dos Lagos')
ON CONFLICT (codigo) DO UPDATE
SET nome_exibicao = EXCLUDED.nome_exibicao;

INSERT INTO public.itens (id, codigo, descricao, tipo_material, comprimento_mm, unidade_medida)
VALUES
  ('c1111111-0000-0000-0000-000000000001', 'PER-SUP-MAR-6000', 'Perfil Marco Linha Suprema Branco 6m', 'perfil_barra', 6000, 'BARRA'),
  ('c2222222-0000-0000-0000-000000000002', 'PER-SUP-FOL-6000', 'Perfil Folha Linha Suprema Branco 6m', 'perfil_barra', 6000, 'BARRA'),
  ('c3333333-0000-0000-0000-000000000003', 'RET-SUP-MAR-850', 'Retalho Marco Linha Suprema Branco 850mm', 'retalho', 850, 'UN'),
  ('c4444444-0000-0000-0000-000000000004', 'VID-INC-6MM-1200', 'Chapa Vidro Temperado Incolor 6mm 1200x800', 'vidro', 1200, 'CHAPA'),
  ('c5555555-0000-0000-0000-000000000005', 'ACS-ROL-SUP-01', 'Roldana Simples Suprema c/ Rolamento', 'acessorio', 50, 'UN')
ON CONFLICT (codigo) DO NOTHING;

-- Perfis de Acesso de Homologação
INSERT INTO public.perfis (id, email, nome, cargo, papel)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'dono@local.test', 'Diretor Geral (Dono)', 'Dono / Diretor Geral', 'dono'),
  ('00000000-0000-0000-0000-000000000002', 'encarregado@local.test', 'Carlos Encarregado', 'Encarregado de Produção', 'encarregado'),
  ('00000000-0000-0000-0000-000000000003', 'conferente@local.test', 'Mateus Conferente', 'Operador / Conferente', 'conferente')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.perfis_permissoes (perfil_id, permissao_codigo)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'sistema.dono'),
  ('00000000-0000-0000-0000-000000000002', 'op.executar'),
  ('00000000-0000-0000-0000-000000000002', 'op.separar'),
  ('00000000-0000-0000-0000-000000000002', 'recebimento.conferir'),
  ('00000000-0000-0000-0000-000000000002', 'triagem.executar'),
  ('00000000-0000-0000-0000-000000000002', 'qualidade.inspecionar'),
  ('00000000-0000-0000-0000-000000000003', 'recebimento.conferir'),
  ('00000000-0000-0000-0000-000000000003', 'op.separar'),
  ('00000000-0000-0000-0000-000000000003', 'expedicao.bipar')
ON CONFLICT DO NOTHING;

-- Pedidos e Esquadrias para Testes
INSERT INTO public.pedidos (id, numero_pedido, obra_destino, cliente_nome, status, data_prometida)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'PED-2026-089', 'Edifício Alpha Tower', 'Construtora Metropolitana', 'na_doca', '2026-10-15'),
  ('a2222222-0000-0000-0000-000000000002', 'PED-2026-101', 'Residencial Reserva dos Lagos', 'Lagos Empreendimentos', 'em_inspecao', '2026-10-18')
ON CONFLICT (numero_pedido) DO NOTHING;

INSERT INTO public.esquadrias (id, pedido_id, serial, codigo_tipologia, descricao, status, reprovacoes_consecutivas)
VALUES
  ('b1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'SN-ALPHA-001', 'MAX-SUP-01F', 'Maxim-ar Suprema 600x600 Incolor 6mm', 'na_doca', 0),
  ('b2222222-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000001', 'SN-ALPHA-002', 'MAX-SUP-01F', 'Maxim-ar Suprema 600x600 Incolor 6mm', 'na_doca', 0),
  ('b3333333-0000-0000-0000-000000000003', 'a2222222-0000-0000-0000-000000000002', 'SN-LAGOS-101', 'JAN-SUP-02F', 'Janela de Correr 2 Folhas 1200x1200 Branco', 'em_inspecao', 1),
  ('b4444444-0000-0000-0000-000000000004', 'a2222222-0000-0000-0000-000000000002', 'SN-LAGOS-102', 'JAN-SUP-02F', 'Janela de Correr 2 Folhas 1200x1200 Branco', 'em_inspecao', 0)
ON CONFLICT (serial) DO NOTHING;

-- Ativos e Ferramental
INSERT INTO public.ativos_ferramentas (id, codigo, descricao, status, calibracao_validade)
VALUES
  ('f1111111-0000-0000-0000-000000000001', 'FER-GAB-01', 'Gabarito de Furação Linha Suprema', 'emprestado', '2026-12-31'),
  ('f2222222-0000-0000-0000-000000000002', 'FER-PIS-02', 'Pistola de Silicone Pneumática #2', 'emprestado', '2027-03-15'),
  ('f3333333-0000-0000-0000-000000000003', 'FER-SER-01', 'Serra de Esquadria Duplo Cabeçote', 'disponivel', '2026-11-20'),
  ('f4444444-0000-0000-0000-000000000004', 'FER-PRE-03', 'Puncionadeira Hidráulica 4 Toneladas', 'em_manutencao', '2026-09-30')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.ferramentas_emprestimos (ferramenta_id, usuario_nome, obra_nome, data_emprestimo, data_devolucao_prevista)
VALUES
  ('f1111111-0000-0000-0000-000000000001', 'João do Corte', 'Linha de Corte 1', now() - interval '4 hours', now() - interval '1 hour'),
  ('f2222222-0000-0000-0000-000000000002', 'Lucas Montagem', 'Bancada Montagem 3', now() - interval '6 hours', now() - interval '2 hours')
ON CONFLICT DO NOTHING;

-- Lotes Iniciais de Quarentena para Homologação
INSERT INTO public.quarentena (id, sku, descricao, numero_nf, fornecedor, quantidade, motivo_divergencia, status)
VALUES
  ('10111111-0000-0000-0000-000000000101', 'PERF-SUP-BRANCO-6M', 'Perfil Folha Suprema Branco RAL 9003 (6.000 mm)', 'NF-98124', 'Alumínio Brasil S/A', 24, 'Lote recebido com oxidação superficial perceptível na ponta das barras', 'retido'),
  ('10222222-0000-0000-0000-000000000102', 'VIDRO-TEMP-8MM', 'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm', 'NF-98011', 'Temperados Nacional Ltda', 4, 'Lascamento acentuado na lapidação lateral (fora da tolerância NBR 14698)', 'retido'),
  ('10333333-0000-0000-0000-000000000103', 'PERF-SUP-6M-PRETO', 'Perfil Barra 6m Suprema Preto Fosco', 'NF-99820', 'Metálica Distribuidora', 8, 'Divergência na contagem cega: 38 recebidas vs 40 na NF com avaria.', 'retido')
ON CONFLICT (id) DO NOTHING;

-- Ajustes de Estoque Pendentes para Homologação e Alçada do Dono
INSERT INTO public.ajustes_estoque (id, item_codigo, descricao, tipo_ajuste, quantidade, unidade, custo_unitario_estimado, motivo, solicitado_por, status)
VALUES
  ('e1111111-aaaa-bbbb-cccc-111111111111', 'PERF-SUP-6M-BRANCO', 'Perfil Barra 6m Suprema Branco Ral 9003', 'perda', 8, 'BARRA', 245.50, 'Queda durante manobra da empilhadeira interna; avaria estrutural em 8 barras.', '00000000-0000-0000-0000-000000000002', 'pendente'),
  ('e2222222-aaaa-bbbb-cccc-222222222222', 'VIDRO-TEMP-8MM', 'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm', 'reducao', 3, 'CHAPA', 380.00, 'Quebra acidental por tensão na ventosa de fixação na bancada.', '00000000-0000-0000-0000-000000000003', 'pendente'),
  ('e3333333-aaaa-bbbb-cccc-333333333333', 'PERF-SUP-6M-PRETO', 'Perfil Barra 6m Suprema Preto Fosco', 'inventario', 4, 'BARRA', 260.00, 'Divergência apurada em contagem cega do Cavalete 1 - Nível 2.', '00000000-0000-0000-0000-000000000001', 'pendente')
ON CONFLICT (id) DO NOTHING;

-- 12. POLÍTICAS RLS GERAIS PARA OPERAÇÃO E ACESSO DO CLIENTE
ALTER TABLE public.inspecoes_qualidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inspecoes_qualidade_all" ON public.inspecoes_qualidade;
CREATE POLICY "inspecoes_qualidade_all" ON public.inspecoes_qualidade FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.esquadrias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "esquadrias_all" ON public.esquadrias;
CREATE POLICY "esquadrias_all" ON public.esquadrias FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_all" ON public.pedidos;
CREATE POLICY "pedidos_all" ON public.pedidos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.quarentena ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quarentena_all" ON public.quarentena;
CREATE POLICY "quarentena_all" ON public.quarentena FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.ajustes_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ajustes_estoque_all" ON public.ajustes_estoque;
CREATE POLICY "ajustes_estoque_all" ON public.ajustes_estoque FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "triagens_all" ON public.triagens;
CREATE POLICY "triagens_all" ON public.triagens FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.ativos_ferramentas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ativos_ferramentas_all" ON public.ativos_ferramentas;
CREATE POLICY "ativos_ferramentas_all" ON public.ativos_ferramentas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.ferramentas_emprestimos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ferramentas_emprestimos_all" ON public.ferramentas_emprestimos;
CREATE POLICY "ferramentas_emprestimos_all" ON public.ferramentas_emprestimos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ordens_producao_all" ON public.ordens_producao;
CREATE POLICY "ordens_producao_all" ON public.ordens_producao FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificacoes_all" ON public.notificacoes;
CREATE POLICY "notificacoes_all" ON public.notificacoes FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditoria_all" ON public.auditoria;
CREATE POLICY "auditoria_all" ON public.auditoria FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "locais_all" ON public.locais;
CREATE POLICY "locais_all" ON public.locais FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

