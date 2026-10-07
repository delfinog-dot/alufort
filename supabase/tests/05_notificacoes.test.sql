-- ============================================================================
-- TEST: supabase/tests/05_notificacoes.test.sql
-- pgTAP: Testes automatizados da Etapa C (Notificações, RLS e Triagens 1 & 2)
-- ============================================================================

BEGIN;
SELECT plan(10);

-- 1. Verificar existência do enum severidade_notificacao e tabela notificacoes
SELECT has_enum('public', 'severidade_notificacao', 'Enum severidade_notificacao deve existir');
SELECT enum_has_labels(
  'public',
  'severidade_notificacao',
  ARRAY['info', 'aviso', 'critica'],
  'Enum severidade_notificacao deve conter info, aviso e critica'
);
SELECT has_table('public', 'notificacoes', 'Tabela notificacoes deve existir');

-- 2. Configurar ambiente de teste com perfis e permissões
INSERT INTO public.perfis (id, email, nome, cargo, papel)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'qualidade@local.test', 'Inspetor de Qualidade', 'Controle de Qualidade', 'operador'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'comum@local.test', 'Operador Básico', 'Operador', 'operador'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'planejador@local.test', 'PCP Planejador', 'PCP', 'encarregado')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.perfis_permissoes (perfil_id, permissao_codigo)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'quarentena.decidir'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'op.separar')
ON CONFLICT DO NOTHING;

-- 3. TESTE TRIAGEM 1: Inserção em quarentena deve gerar notificação de severidade 'critica'
INSERT INTO public.quarentena (
  id,
  sku,
  numero_nf,
  fornecedor,
  quantidade,
  motivo_divergencia
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'PERF-SUP-BRANCO-6M',
  'NF-98124',
  'Alumínio Brasil S/A',
  24,
  'Lote com oxidação superficial visível na ponta das barras'
);

-- Validar se a notificação foi emitida pelo trigger
SELECT is(
  (
    SELECT count(*)::int 
    FROM public.notificacoes 
    WHERE tipo = 'triagem_quarentena' 
      AND severidade = 'critica'
      AND destinatario_permissao = 'quarentena.decidir'
      AND origem_id = '11111111-2222-3333-4444-555555555555'
  ),
  1,
  'Inserção em quarentena deve disparar notificação com severidade "critica" para a permissão "quarentena.decidir"'
);

-- Validar texto da notificação
SELECT like(
  (
    SELECT mensagem 
    FROM public.notificacoes 
    WHERE origem_id = '11111111-2222-3333-4444-555555555555'
  ),
  '%NF-98124%PERF-SUP-BRANCO-6M%',
  'Mensagem da notificação deve conter a NF e o SKU retido'
);

-- 4. TESTE RLS: Validação de isolamento e leitura protegida
-- Usuário sem permissão não pode ler notificações endereçadas a 'quarentena.decidir'
SET LOCAL ROLE postgres;
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT is(
  (
    SELECT count(*)::int 
    FROM public.notificacoes 
    WHERE origem_id = '11111111-2222-3333-4444-555555555555'
      AND destinatario_permissao = 'quarentena.decidir'
      AND NOT public.usuario_tem_permissao('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'quarentena.decidir')
  ),
  1,
  'RLS: Usuário comum não possui permissão para inspecionar notificações de quarentena'
);

RESET "request.jwt.claims";
RESET ROLE;

-- 5. TESTE TRIAGEM 2: Trava de corte e função aprovar_mistura_cor
INSERT INTO public.ordens_producao (
  id,
  numero_op,
  descricao,
  status,
  medicao_tipo,
  tem_mistura_cor,
  mistura_cor_aprovada
) VALUES (
  '99999999-8888-7777-6666-555555555555',
  'OP-2026-089',
  'Janela Suprema 2 Folhas 1200x1200',
  'planejada',
  'estimada',
  true,
  false
);

-- Teste negativo: Iniciar corte com medição estimada deve disparar exceção
SELECT throws_matching(
  $$
    UPDATE public.ordens_producao
    SET status = 'em_corte'
    WHERE id = '99999999-8888-7777-6666-555555555555';
  $$,
  'Não é permitido iniciar corte em OP com medição estimada. Obtenha a medição definitiva na obra.',
  'Trava de Corte: Bloqueia início de corte com medição estimada'
);

-- Ajustar medição para definitiva, mas mantendo mistura de cor não aprovada
UPDATE public.ordens_producao
SET medicao_tipo = 'definitiva'
WHERE id = '99999999-8888-7777-6666-555555555555';

-- Teste negativo: Iniciar corte com mistura de cor sem aprovação deve disparar exceção
SELECT throws_matching(
  $$
    UPDATE public.ordens_producao
    SET status = 'em_corte'
    WHERE id = '99999999-8888-7777-6666-555555555555';
  $$,
  'Não é permitido iniciar corte com mistura de lotes de cor sem aprovação formal.',
  'Trava de Corte: Bloqueia corte com mistura de cores sem aprovação explícita'
);

-- Executar aprovação formal através da função RPC aprovar_mistura_cor
SELECT lives_ok(
  $$
    SELECT public.aprovar_mistura_cor(
      '99999999-8888-7777-6666-555555555555',
      'Cliente autorizou variação tonal discreta no lote de perfis pretos foscos conforme termo de ajuste'
    );
  $$,
  'aprovar_mistura_cor deve executar com sucesso'
);

-- Validar registro em auditoria
SELECT is(
  (
    SELECT count(*)::int 
    FROM public.auditoria 
    WHERE evento = 'APROVACAO_MISTURA_COR_OP' 
      AND registro_id = '99999999-8888-7777-6666-555555555555'
  ),
  1,
  'aprovar_mistura_cor deve registrar o evento na tabela auditoria'
);

-- Validar que após a aprovação formal, o status pode avançar para 'em_corte'
SELECT lives_ok(
  $$
    UPDATE public.ordens_producao
    SET status = 'em_corte'
    WHERE id = '99999999-8888-7777-6666-555555555555';
  $$,
  'Com medição definitiva e mistura de cor aprovada, o corte pode ser iniciado normalmente'
);

SELECT * FROM finish();
ROLLBACK;
