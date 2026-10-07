-- ============================================================================
-- TEST: supabase/tests/06_fase3.test.sql
-- pgTAP: Testes automatizados da Etapa F (Fase 3 Mínima: Qualidade, Expedição & Ferramentas)
-- ============================================================================

BEGIN;
SELECT plan(12);

-- 1. Verificar Existência das Tabelas e Views da Fase 3
SELECT has_table('public', 'pedidos', 'Tabela pedidos deve existir');
SELECT has_table('public', 'esquadrias', 'Tabela esquadrias deve existir');
SELECT has_table('public', 'inspecoes_qualidade', 'Tabela inspecoes_qualidade deve existir');
SELECT has_table('public', 'ativos_ferramentas', 'Tabela ativos_ferramentas deve existir');
SELECT has_table('public', 'ferramentas_emprestimos', 'Tabela ferramentas_emprestimos deve existir');
SELECT has_view('public', 'vw_ferramentas_vencidas', 'View vw_ferramentas_vencidas deve existir');

-- 2. Verificar Funções RPC da Expedição
SELECT has_function('public', 'validar_carregamento_expedicao', ARRAY['uuid', 'text'], 'RPC validar_carregamento_expedicao deve existir');
SELECT has_function('public', 'finalizar_expedicao', ARRAY['uuid', 'text'], 'RPC finalizar_expedicao deve existir');

-- 3. TESTE TRIAGEM 3: 2ª REPROVAÇÃO CONSECUTIVA EMITE NOTIFICAÇÃO CRÍTICA PARA O DONO
-- Criar pedido e esquadria para o teste
INSERT INTO public.pedidos (id, numero_pedido, obra_destino, cliente_nome, status)
VALUES ('d1111111-1111-1111-1111-111111111111', 'PED-TESTE-RET', 'Obra Teste Retrabalho', 'Cliente Teste', 'em_inspecao');

INSERT INTO public.esquadrias (id, pedido_id, serial, codigo_tipologia, descricao, status, reprovacoes_consecutivas)
VALUES ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'SN-TESTE-REPROV-01', 'JAN-SUP', 'Janela Teste', 'em_inspecao', 0);

-- 1ª Reprovação
INSERT INTO public.inspecoes_qualidade (
  esquadria_id,
  checklist,
  resultado,
  motivo
) VALUES (
  'e1111111-1111-1111-1111-111111111111',
  '{"esquadro": false, "vedacao_epdm": true, "roldanas": true, "pelicula_protetora": true}'::jsonb,
  'reprovado',
  'Fora de esquadro em 4mm'
);

-- Verificar se contador subiu para 1 e gerou OP de retrabalho
SELECT is(
  (SELECT reprovacoes_consecutivas FROM public.esquadrias WHERE id = 'e1111111-1111-1111-1111-111111111111'),
  1,
  '1ª reprovação deve incrementar contador para 1'
);

-- 2ª Reprovação consecutiva da mesma esquadria
INSERT INTO public.inspecoes_qualidade (
  esquadria_id,
  checklist,
  resultado,
  motivo
) VALUES (
  'e1111111-1111-1111-1111-111111111111',
  '{"esquadro": false, "vedacao_epdm": false, "roldanas": true, "pelicula_protetora": true}'::jsonb,
  'reprovado',
  'Reincidência: esquadro desalinhado e vedação rompida'
);

-- Validar se a 2ª reprovação consecutiva emitiu notificação 'critica' para 'sistema.dono'
SELECT is(
  (
    SELECT count(*)::int
    FROM public.notificacoes
    WHERE tipo = 'qualidade_segunda_reprovacao'
      AND severidade = 'critica'
      AND destinatario_permissao = 'sistema.dono'
      AND origem_id = 'e1111111-1111-1111-1111-111111111111'
  ),
  1,
  '2ª reprovação consecutiva deve emitir notificação de severidade crítica para a permissão sistema.dono'
);

-- 4. TESTE TRIAGEM 4: validar_carregamento_expedicao RECUSA SERIAL DE OUTRO PEDIDO
INSERT INTO public.pedidos (id, numero_pedido, obra_destino, cliente_nome, status)
VALUES ('d2222222-2222-2222-2222-222222222222', 'PED-TESTE-OUTRO', 'Obra Residencial Sul', 'Cliente Sul', 'na_doca');

INSERT INTO public.esquadrias (id, pedido_id, serial, codigo_tipologia, descricao, status, reprovacoes_consecutivas)
VALUES ('e2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'SN-SERIAL-PEDIDO-2', 'PORTA-SUP', 'Porta Balcão', 'na_doca', 0);

-- Tentar bipar o serial do pedido 2 no pedido 1 (deve lançar exceção de bloqueio com mensagem em português)
SELECT throws_ok(
  $$ SELECT public.validar_carregamento_expedicao('d1111111-1111-1111-1111-111111111111'::uuid, 'SN-SERIAL-PEDIDO-2') $$,
  'BLOQUEIO FÍSICO: Peça SN-SERIAL-PEDIDO-2 pertence a outro pedido (Obra divergente). Embarque cancelado.',
  'Bipagem de serial de pedido divergente deve ser bloqueada com exceção'
);

-- 5. TESTE TRANSIÇÃO DE PEDIDO PARA 'na_doca' APENAS COM 100% DAS PEÇAS APROVADAS
INSERT INTO public.pedidos (id, numero_pedido, obra_destino, cliente_nome, status)
VALUES ('d3333333-3333-3333-3333-333333333333', 'PED-TESTE-APROV', 'Obra Alpha', 'Cliente Alpha', 'em_inspecao');

INSERT INTO public.esquadrias (id, pedido_id, serial, codigo_tipologia, descricao, status)
VALUES 
  ('e3333333-3333-3333-3333-333333333331', 'd3333333-3333-3333-3333-333333333333', 'SN-PECA-1', 'JAN-01', 'Janela 1', 'em_inspecao'),
  ('e3333333-3333-3333-3333-333333333332', 'd3333333-3333-3333-3333-333333333333', 'SN-PECA-2', 'JAN-02', 'Janela 2', 'em_inspecao');

-- Aprovar apenas a 1ª peça: pedido AINDA NÃO deve ir para 'na_doca'
INSERT INTO public.inspecoes_qualidade (esquadria_id, checklist, resultado)
VALUES ('e3333333-3333-3333-3333-333333333331', '{"esquadro": true}'::jsonb, 'aprovado');

SELECT is(
  (SELECT status FROM public.pedidos WHERE id = 'd3333333-3333-3333-3333-333333333333'),
  'em_inspecao',
  'Pedido deve permanecer em_inspecao enquanto houver peças pendentes'
);

-- Aprovar a 2ª e última peça: agora o pedido DEVE transicionar para 'na_doca'
INSERT INTO public.inspecoes_qualidade (esquadria_id, checklist, resultado)
VALUES ('e3333333-3333-3333-3333-333333333332', '{"esquadro": true}'::jsonb, 'aprovado');

SELECT is(
  (SELECT status FROM public.pedidos WHERE id = 'd3333333-3333-3333-3333-333333333333'),
  'na_doca',
  'Pedido deve avançar para na_doca quando 100% das peças estiverem inspecionadas e aprovadas'
);

SELECT * FROM finish();
ROLLBACK;
