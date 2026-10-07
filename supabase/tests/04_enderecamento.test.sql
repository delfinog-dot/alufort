-- ============================================================================
-- TEST: supabase/tests/04_enderecamento.test.sql
-- pgTAP: Testes automatizados da Etapa A (Endereçamento e Validações)
-- ============================================================================

BEGIN;
SELECT plan(12);

-- 1. Testar se o enum area_logica contém o valor 'doca'
SELECT has_enum('public', 'area_logica', 'Enum area_logica deve existir');
SELECT enum_has_labels(
  'public',
  'area_logica',
  ARRAY['doca'],
  'Enum area_logica deve conter o rótulo "doca"'
);

-- 2. Testar se a coluna nome_exibicao existe na tabela locais
SELECT has_column('public', 'locais', 'nome_exibicao', 'Tabela locais deve ter a coluna nome_exibicao');

-- 3. Testar função gerar_nome_exibicao_local para cada padrão operacional
SELECT is(
  gerar_nome_exibicao_local('gaveta', 2, 4, NULL, 'GAV-02-04'),
  'Gaveta 2 - Prateleira 4',
  'Gaveta deve ser nomeada como "Gaveta {N} - Prateleira {M}"'
);

SELECT is(
  gerar_nome_exibicao_local('cavalete_horizontal', 3, 2, NULL, 'CAV-H-03-02'),
  'Cavalete Horizontal 3 - Nível 2',
  'Cavalete horizontal deve ser nomeado como "Cavalete Horizontal {N} - Nível {M}"'
);

SELECT is(
  gerar_nome_exibicao_local('cavalete_vidro', 5, NULL, NULL, 'CAV-V-05'),
  'Cavalete de Vidro 5',
  'Cavalete de vidro deve ser nomeado como "Cavalete de Vidro {N}"'
);

SELECT is(
  gerar_nome_exibicao_local('doca', NULL, NULL, 'Reserva Imperial', 'DOCA-OBRA-01'),
  'Doca de Expedição - Obra Reserva Imperial',
  'Doca deve ser nomeada como "Doca de Expedição - Obra {Nome_ou_Código}"'
);

SELECT is(
  gerar_nome_exibicao_local('quarentena', NULL, NULL, NULL, 'QUA-01'),
  'Gaiola de Quarentena',
  'Quarentena deve ser nomeada como "Gaiola de Quarentena"'
);

-- 4. Testar criação via trigger automático na inserção direta
INSERT INTO locais (codigo, tipo, numero, subnivel)
VALUES ('TEST-GAV-99', 'gaveta', 9, 3);

SELECT is(
  (SELECT nome_exibicao FROM locais WHERE codigo = 'TEST-GAV-99'),
  'Gaveta 9 - Prateleira 3',
  'Trigger deve gerar automaticamente nome_exibicao no INSERT'
);

-- 5. Testar função criar_locais_em_lote preenchendo nome_exibicao
SELECT lives_ok(
  $$ SELECT * FROM criar_locais_em_lote('cavalete_horizontal', 2, 2, 'materia_prima', 'TEST-LOTE-CAV') $$,
  'criar_locais_em_lote deve executar com sucesso'
);

SELECT is(
  (SELECT nome_exibicao FROM locais WHERE codigo = 'TEST-LOTE-CAV-01-01'),
  'Cavalete Horizontal 1 - Nível 1',
  'criar_locais_em_lote deve preencher corretamente nome_exibicao'
);

-- 6. Preparar dados para testes de validação item x local
INSERT INTO itens (id, codigo, descricao, tipo_material, comprimento_mm)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'PERF-SUP-6M', 'Perfil Barra 6m Linha Suprema', 'perfil_barra', 6000),
  ('22222222-2222-2222-2222-222222222222', 'VIDRO-TEMP-8MM', 'Chapa Vidro Temperado 8mm Incolor', 'vidro', 2100),
  ('33333333-3333-3333-3333-333333333333', 'ROLD-SUPREMA', 'Roldana Dupla Suprema', 'acessorio', 50);

INSERT INTO locais (id, codigo, tipo, area_logica, numero, subnivel)
VALUES 
  ('44444444-4444-4444-4444-444444444444', 'GAV-TEST-01', 'gaveta', 'almoxarifado', 1, 1),
  ('55555555-5555-5555-5555-555555555555', 'CAV-H-TEST-01', 'cavalete_horizontal', 'materia_prima', 1, 1),
  ('66666666-6666-6666-6666-666666666666', 'CAV-V-TEST-01', 'cavalete_vidro', 'vidros', 1, 1);

-- 7. Teste negativo: Barra de 6m alocada em gaveta deve ser BLOQUEADA com erro específico
SELECT throws_matching(
  $$
    INSERT INTO estoque_itens (item_id, local_id, quantidade)
    VALUES ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 10);
  $$,
  'Barra de 6 m não cabe em gaveta. Use um Cavalete Horizontal.',
  'Bloqueia alocação de barra de 6m em gaveta com mensagem exata em português'
);

-- 8. Teste negativo: Vidro alocado fora de Cavalete de Vidro deve ser BLOQUEADO
SELECT throws_matching(
  $$
    INSERT INTO estoque_itens (item_id, local_id, quantidade)
    VALUES ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 2);
  $$,
  'Vidro só pode ser armazenado em Cavalete de Vidro.',
  'Bloqueia alocação de vidro fora de cavalete de vidro com mensagem exata em português'
);

SELECT * FROM finish();
ROLLBACK;
