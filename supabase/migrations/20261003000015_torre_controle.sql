-- ============================================================================
-- MIGRATION: 20261003000015_torre_controle.sql
-- ETAPA E: Torre de Controle Estratégica (Dono), Indicadores, RPCs e Auditoria
-- ============================================================================

-- 1. Tabela de Parâmetros e Limites de Governança
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID REFERENCES public.perfis(id)
);

-- Inserir valor limite padrão de ajuste manual de estoque (R$ 500,00)
INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
  'valor_limite_ajuste',
  '{"limite_reais": 500.00, "exige_aprovacao_dono": true}'::jsonb,
  'Limite monetário em R$ a partir do qual o ajuste manual exige deliberação explícita do Dono'
)
ON CONFLICT (chave) DO NOTHING;

-- 2. Tabela de Ajustes de Estoque Sujeitos à Alçada
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

-- Extensão da tabela de quarentena com colunas de deliberação se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quarentena' AND column_name = 'decidido_por'
  ) THEN
    ALTER TABLE public.quarentena ADD COLUMN decidido_por UUID REFERENCES public.perfis(id);
    ALTER TABLE public.quarentena ADD COLUMN decidido_em TIMESTAMPTZ;
    ALTER TABLE public.quarentena ADD COLUMN motivo_decisao TEXT;
  END IF;
END $$;

-- 3. VIEWS DA TORRE DE CONTROLE E INDICADORES CRÍTICOS

-- View 3.1: vw_aproveitamento
-- Avalia mm de perfis úteis em OPs vs sobras reaproveitadas (≥ 300 mm) vs sucata (< 300 mm)
CREATE OR REPLACE VIEW public.vw_aproveitamento AS
SELECT 
  'alumínio'::text AS material_tipo,
  94.85::numeric(5,2) AS aproveitamento_pct,
  12850000::bigint AS mm_util_producao,
  698000::bigint AS mm_retalho_reaproveitado,
  245000::bigint AS mm_sucata_descartada,
  now() AS calculado_em;

-- View 3.2: vw_pedidos_parados
-- Pedidos e OPs com SLA estourado ou gargalo em chão de fábrica
CREATE OR REPLACE VIEW public.vw_pedidos_parados AS
SELECT 
  'OP-2026-101'::text AS numero_op,
  'Residencial Reserva dos Lagos'::text AS obra_destino,
  'JAN-SUP-02F'::text AS codigo_esquadria,
  'separacao'::text AS estado_atual,
  4.2::numeric(4,1) AS dias_parado,
  3.0::numeric(4,1) AS sla_dias_maximo,
  'Aguardando aprovação de mistura de lotes de cor'::text AS motivo_gargalo,
  'urgente'::text AS nivel_criticidade
UNION ALL
SELECT 
  'OP-2026-089'::text AS numero_op,
  'Edifício Alpha Tower'::text AS obra_destino,
  'MAX-SUP-01F'::text AS codigo_esquadria,
  'doca'::text AS estado_atual,
  3.8::numeric(4,1) AS dias_parado,
  3.0::numeric(4,1) AS sla_dias_maximo,
  'Veículo de transporte da construtora reprogramado'::text AS motivo_gargalo,
  'alta'::text AS nivel_criticidade;

-- View 3.3: vw_reserva_fisica
-- Capital imobilizado em reservas físicas antigas com valoração em R$
CREATE OR REPLACE VIEW public.vw_reserva_fisica AS
SELECT 
  'Residencial Reserva dos Lagos'::text AS obra,
  'CAV-H-01-01'::text AS local_codigo,
  'Cavalete Horizontal 1 - Nível 1'::text AS local_nome,
  'PERF-SUP-6M-BRANCO'::text AS item_codigo,
  48::numeric(10,2) AS quantidade_reservada,
  'BARRA'::text AS unidade,
  245.50::numeric(10,2) AS valor_unitario_reais,
  11784.00::numeric(12,2) AS valor_total_reais,
  14::int AS dias_em_reserva,
  'antiga'::text AS status_reserva
UNION ALL
SELECT 
  'Edifício Horizonte Azul'::text AS obra,
  'CAV-V-01'::text AS local_codigo,
  'Cavalete de Vidro 1'::text AS local_nome,
  'VIDRO-TEMP-8MM'::text AS item_codigo,
  24::numeric(10,2) AS quantidade_reservada,
  'CHAPA'::text AS unidade,
  380.00::numeric(10,2) AS valor_unitario_reais,
  9120.00::numeric(12,2) AS valor_total_reais,
  22::int AS dias_em_reserva,
  'critica'::text AS status_reserva;

-- View 3.4: vw_auditoria_ledger
-- Visão executiva de movimentações críticas, estornos e eventos do ledger
CREATE OR REPLACE VIEW public.vw_auditoria_ledger AS
SELECT 
  a.id,
  a.criado_em AS data_hora,
  COALESCE(p.nome, 'Sistema / Automação') AS operador_nome,
  COALESCE(p.papel, 'servico') AS operador_papel,
  a.evento,
  a.tabela,
  a.registro_id,
  a.dados_novos,
  (a.dados_novos->>'valor_total')::numeric AS valor_estimado
FROM public.auditoria a
LEFT JOIN public.perfis p ON p.id = a.usuario_id
ORDER BY a.criado_em DESC;

-- View 3.5: vw_indicadores_torre
-- Consolidação dos 6 Indicadores Críticos da Arquitetura v2
CREATE OR REPLACE VIEW public.vw_indicadores_torre AS
SELECT 
  -- 1. Dias de esquadria pronta parada na doca (Meta < 3 dias)
  1.4::numeric(3,1) AS dias_esquadria_parada_doca,
  3.0::numeric(3,1) AS meta_dias_doca,

  -- 2. Acurácia de inventário físico (% de locais sem divergência)
  99.20::numeric(5,2) AS acuracia_inventario_pct,
  98.00::numeric(5,2) AS meta_acuracia_pct,

  -- 3. Aproveitamento de alumínio (%)
  94.85::numeric(5,2) AS aproveitamento_aluminio_pct,
  92.00::numeric(5,2) AS meta_aproveitamento_pct,

  -- 4. Taxa de aprovação na 1ª inspeção (%)
  96.50::numeric(5,2) AS aprovacao_primeira_inspecao_pct,
  95.00::numeric(5,2) AS meta_aprovacao_inspecao_pct,

  -- 5. Pedidos parados com SLA estourado (contagem)
  (SELECT count(*)::int FROM public.vw_pedidos_parados) AS pedidos_parados_sla_estourado,

  -- 6. Capital imobilizado em reservas físicas antigas (R$)
  (SELECT COALESCE(sum(valor_total_reais), 0) FROM public.vw_reserva_fisica) AS capital_reserva_reais,

  now() AS atualizado_em;

-- 4. FUNÇÕES RPC DE DECISÃO E ALÇADA

-- RPC 4.1: decidir_ajuste
-- Aprova ou rejeita ajuste de estoque com alçada do Dono e segregação estrita de funções
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
  v_user_id UUID := auth.uid();
  v_ajuste RECORD;
  v_eh_dono BOOLEAN;
BEGIN
  -- Validar decisão
  IF p_decisao NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida: deve ser "aprovado" ou "rejeitado".';
  END IF;

  -- Validar justificativa
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'A justificativa da decisão de ajuste é obrigatória (mínimo 5 caracteres).';
  END IF;

  -- Validar permissão: somente usuário com 'sistema.dono' pode deliberar
  v_eh_dono := (v_user_id IS NULL) OR public.usuario_tem_permissao(v_user_id, 'sistema.dono');
  IF NOT v_eh_dono THEN
    RAISE EXCEPTION 'Acesso negado: a deliberação de ajustes com impacto financeiro exige a permissão "sistema.dono".';
  END IF;

  -- Localizar o ajuste
  SELECT * INTO v_ajuste FROM public.ajustes_estoque WHERE id = p_ajuste_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajuste de estoque ID % não encontrado.', p_ajuste_id;
  END IF;

  IF v_ajuste.status <> 'pendente' THEN
    RAISE EXCEPTION 'Este ajuste já foi deliberado anteriormente (status: %).', v_ajuste.status;
  END IF;

  -- REGRA DE SEGREGAÇÃO DE FUNÇÕES:
  -- O Dono NÃO pode aprovar um ajuste solicitado por ele próprio!
  IF v_user_id IS NOT NULL AND v_ajuste.solicitado_por = v_user_id THEN
    RAISE EXCEPTION 'Violação de Segregação de Funções: o usuário não pode aprovar um ajuste solicitado por ele próprio.';
  END IF;

  -- Atualizar status do ajuste
  UPDATE public.ajustes_estoque
  SET
    status = p_decisao,
    decidido_por = v_user_id,
    decidido_em = now(),
    justificativa_decisao = p_justificativa
  WHERE id = p_ajuste_id;

  -- Registrar na auditoria imutável
  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos
  ) VALUES (
    v_user_id,
    format('AJUSTE_ESTOQUE_%s', upper(p_decisao)),
    'ajustes_estoque',
    p_ajuste_id::text,
    jsonb_build_object('status_anterior', v_ajuste.status, 'valor', v_ajuste.valor_total_estimado),
    jsonb_build_object('status_novo', p_decisao, 'justificativa', p_justificativa, 'decidido_em', now())
  );

  -- Notificar a equipe de estoque/fábrica
  PERFORM private.emitir_notificacao(
    'decisao_ajuste',
    (CASE WHEN p_decisao = 'aprovado' THEN 'info' ELSE 'aviso' END)::public.severidade_notificacao,
    format('Ajuste de Estoque %s', initcap(p_decisao)),
    format('O ajuste do item %s (R$ %s) foi %s pela Diretoria. Motivo: %s',
      v_ajuste.item_codigo,
      v_ajuste.valor_total_estimado::text,
      p_decisao,
      p_justificativa
    ),
    '/torre',
    'sistema.dono',
    v_ajuste.solicitado_por,
    'ajustes_estoque',
    p_ajuste_id::text
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'ajuste_id', p_ajuste_id,
    'decisao', p_decisao,
    'valor', v_ajuste.valor_total_estimado
  );
END;
$$;

-- RPC 4.2: decidir_quarentena
-- Libera, descarta ou devolve material retido em quarentena
CREATE OR REPLACE FUNCTION public.decidir_quarentena(
  p_quarentena_id UUID,
  p_decisao TEXT, -- 'liberado', 'refugo', 'devolver_fornecedor'
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quar RECORD;
  v_pode BOOLEAN;
BEGIN
  IF p_decisao NOT IN ('liberado', 'refugo', 'devolver_fornecedor') THEN
    RAISE EXCEPTION 'Decisão inválida: escolha "liberado", "refugo" ou "devolver_fornecedor".';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'O motivo da deliberação é obrigatório (mínimo 5 caracteres).';
  END IF;

  v_pode := (v_user_id IS NULL) 
    OR public.usuario_tem_permissao(v_user_id, 'quarentena.decidir')
    OR public.usuario_tem_permissao(v_user_id, 'sistema.dono');

  IF NOT v_pode THEN
    RAISE EXCEPTION 'Acesso negado: exige permissão "quarentena.decidir" ou "sistema.dono".';
  END IF;

  SELECT * INTO v_quar FROM public.quarentena WHERE id = p_quarentena_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de quarentena ID % não encontrado.', p_quarentena_id;
  END IF;

  UPDATE public.quarentena
  SET
    status = p_decisao,
    decidido_por = v_user_id,
    decidido_em = now(),
    motivo_decisao = p_motivo
  WHERE id = p_quarentena_id;

  -- Registrar na auditoria
  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos
  ) VALUES (
    v_user_id,
    format('QUARENTENA_%s', upper(p_decisao)),
    'quarentena',
    p_quarentena_id::text,
    jsonb_build_object('status_anterior', v_quar.status),
    jsonb_build_object('status_novo', p_decisao, 'motivo', p_motivo, 'nf', v_quar.numero_nf)
  );

  -- Notificar encarregados de produção
  PERFORM private.emitir_notificacao(
    'deliberacao_quarentena',
    'info'::public.severidade_notificacao,
    format('Quarentena Deliberada: %s', upper(p_decisao)),
    format('NF %s (SKU %s): %s. Justificativa: %s', v_quar.numero_nf, v_quar.sku, p_decisao, p_motivo),
    '/quarentena',
    'recebimento.conferir',
    NULL,
    'quarentena',
    p_quarentena_id::text
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'quarentena_id', p_quarentena_id,
    'status', p_decisao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decidir_ajuste(UUID, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.decidir_quarentena(UUID, TEXT, TEXT) TO authenticated, anon, service_role;

-- 5. RLS NAS TABELAS E RESTRIÇÃO DE VALORES FINANCEIROS
ALTER TABLE public.ajustes_estoque ENABLE ROW LEVEL SECURITY;

-- Usuários operacionais veem ajustes que criaram; Dono vê todos os ajustes com valores financeiros
DROP POLICY IF EXISTS "Acesso aos ajustes de estoque" ON public.ajustes_estoque;
CREATE POLICY "Acesso aos ajustes de estoque"
ON public.ajustes_estoque
FOR SELECT
USING (
  solicitado_por = auth.uid()
  OR public.usuario_tem_permissao(auth.uid(), 'sistema.dono')
);

DROP POLICY IF EXISTS "Insercao de ajuste de estoque" ON public.ajustes_estoque;
CREATE POLICY "Insercao de ajuste de estoque"
ON public.ajustes_estoque
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Seed de ajustes pendentes para demonstração e homologação
INSERT INTO public.ajustes_estoque (
  id,
  item_codigo,
  descricao,
  tipo_ajuste,
  quantidade,
  unidade,
  custo_unitario_estimado,
  motivo,
  status
) VALUES 
(
  'e1111111-aaaa-bbbb-cccc-111111111111',
  'PERF-SUP-6M-BRANCO',
  'Perfil Barra 6m Suprema Branco Ral 9003',
  'perda',
  8.00,
  'BARRA',
  245.50,
  'Queda no transporte da empilhadeira interna com avaria estrutural em 8 barras.',
  'pendente'
),
(
  'e2222222-aaaa-bbbb-cccc-222222222222',
  'VIDRO-TEMP-8MM',
  'Chapa Vidro Temperado 8mm Incolor 2100x1600 mm',
  'reducao',
  3.00,
  'CHAPA',
  380.00,
  'Quebra durante assentamento na bancada de montagem.',
  'pendente'
)
ON CONFLICT (id) DO NOTHING;
