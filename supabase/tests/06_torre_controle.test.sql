-- ============================================================================
-- TEST: supabase/tests/06_torre_controle.test.sql
-- pgTAP: Testes automatizados da Etapa E (Torre de Controle, Indicadores & Decisões)
-- ============================================================================

BEGIN;
SELECT plan(12);

-- 1. Verificar Views da Torre de Controle
SELECT has_view('public', 'vw_indicadores_torre', 'View vw_indicadores_torre deve existir');
SELECT has_view('public', 'vw_aproveitamento', 'View vw_aproveitamento deve existir');
SELECT has_view('public', 'vw_pedidos_parados', 'View vw_pedidos_parados deve existir');
SELECT has_view('public', 'vw_reserva_fisica', 'View vw_reserva_fisica deve existir');
SELECT has_view('public', 'vw_auditoria_ledger', 'View vw_auditoria_ledger deve existir');

-- 2. Verificar Tabelas de Governança
SELECT has_table('public', 'configuracoes', 'Tabela configuracoes deve existir');
SELECT has_table('public', 'ajustes_estoque', 'Tabela ajustes_estoque deve existir');

-- 3. Verificar Funções RPC de Decisão
SELECT has_function('public', 'decidir_ajuste', ARRAY['uuid', 'text', 'text'], 'RPC decidir_ajuste deve existir');
SELECT has_function('public', 'decidir_quarentena', ARRAY['uuid', 'text', 'text'], 'RPC decidir_quarentena deve existir');

-- 4. Testar leitura de indicadores consolidados
SELECT is(
  (SELECT dias_esquadria_parada_doca FROM public.vw_indicadores_torre),
  1.4::numeric,
  'Indicador 1: Dias médios de esquadria na doca deve ser 1.4'
);

-- 5. Testar Segregação de Funções na RPC decidir_ajuste:
-- Criar perfil de solicitante e perfil do Dono
INSERT INTO public.perfis (id, email, nome, papel)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'encarregado_teste@local.test', 'Encarregado Teste', 'encarregado'),
  ('22222222-2222-2222-2222-222222222222', 'dono_teste@local.test', 'Dono Teste', 'dono')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.perfis_permissoes (perfil_id, permissao_codigo)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'sistema.dono')
ON CONFLICT DO NOTHING;

-- Inserir ajuste de teste solicitado pelo encarregado
INSERT INTO public.ajustes_estoque (
  id,
  item_codigo,
  descricao,
  tipo_ajuste,
  quantidade,
  unidade,
  custo_unitario_estimado,
  motivo,
  solicitado_por,
  status
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'TESTE-PERF-01',
  'Perfil Teste 6m',
  'perda',
  5,
  'BARRA',
  100.00,
  'Avaria no descarregamento',
  '11111111-1111-1111-1111-111111111111',
  'pendente'
);

-- Deliberar como Dono (válido, solicitante diferente)
SELECT lives_ok(
  $$ SELECT public.decidir_ajuste('33333333-3333-3333-3333-333333333333'::uuid, 'aprovado', 'Ajuste auditado e autorizado pela gerência.') $$,
  'Dono deve conseguir aprovar ajuste solicitado por terceiro'
);

-- 6. Testar Quarentena: Deliberação de devolução ao fornecedor
INSERT INTO public.quarentena (
  id,
  sku,
  numero_nf,
  fornecedor,
  quantidade,
  motivo_divergencia,
  status
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'TESTE-VIDRO-8MM',
  'NF-99999',
  'Vidraçaria Modelo',
  2,
  'Borda trincada',
  'retido'
);

SELECT lives_ok(
  $$ SELECT public.decidir_quarentena('44444444-4444-4444-4444-444444444444'::uuid, 'devolver_fornecedor', 'Peças com defeito de fábrica; devolução emitida para reposição.') $$,
  'Deliberação de devolução ao fornecedor na quarentena deve ser executada com sucesso'
);

SELECT * FROM finish();
ROLLBACK;
