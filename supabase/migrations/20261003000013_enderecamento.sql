-- ============================================================================
-- MIGRATION: 20261003000013_enderecamento.sql
-- ETAPA A: Endereçamento físico humano, nomenclatura e validação item x local
-- ============================================================================

-- 1. Garantir existência e evolução do enum area_logica com 'doca'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'area_logica') THEN
    CREATE TYPE area_logica AS ENUM (
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
      ALTER TYPE area_logica ADD VALUE IF NOT EXISTS 'doca';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Tabela de locais de estoque (estrutura base compatível)
CREATE TABLE IF NOT EXISTS locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  tipo VARCHAR(50) NOT NULL, -- 'gaveta', 'cavalete_horizontal', 'cavalete_vidro', 'doca', 'quarentena', 'palete', 'prateleira'
  area_logica area_logica NOT NULL DEFAULT 'materia_prima',
  numero INT,
  subnivel INT,
  obra_destino VARCHAR(150),
  capacidade_max_kg NUMERIC(10,2) DEFAULT 1000.00,
  comprimento_max_mm NUMERIC(10,2) DEFAULT 6500.00,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Adicionar coluna nome_exibicao preservando codigo técnico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locais' AND column_name = 'nome_exibicao'
  ) THEN
    ALTER TABLE locais ADD COLUMN nome_exibicao TEXT;
  END IF;
END $$;

-- 3. Função pura de formatação e padronização do nome de exibição humano
CREATE OR REPLACE FUNCTION gerar_nome_exibicao_local(
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
  -- Se os números/obra não foram fornecidos diretamente, tenta extrair via regex do código técnico
  IF v_num IS NULL AND v_codigo <> '' THEN
    -- Padrão Gaveta: GAV-01-02 ou GAV-1-2
    IF v_codigo ~* '^GAV-?(\d+)-?(\d+)?' THEN
      v_matches := regexp_matches(v_codigo, '^GAV-?(\d+)(?:-(\d+))?', 'i');
      v_num := v_matches[1]::INT;
      IF v_matches[2] IS NOT NULL THEN
        v_sub := v_matches[2]::INT;
      END IF;
    -- Padrão Cavalete Horizontal: CAV-H-01-02
    ELSIF v_codigo ~* '^CAV-?H-?(\d+)-?(\d+)?' THEN
      v_matches := regexp_matches(v_codigo, '^CAV-?H-?(\d+)(?:-(\d+))?', 'i');
      v_num := v_matches[1]::INT;
      IF v_matches[2] IS NOT NULL THEN
        v_sub := v_matches[2]::INT;
      END IF;
    -- Padrão Cavalete de Vidro: CAV-V-01
    ELSIF v_codigo ~* '^CAV-?V-?(\d+)' THEN
      v_matches := regexp_matches(v_codigo, '^CAV-?V-?(\d+)', 'i');
      v_num := v_matches[1]::INT;
    -- Padrão Doca: DOCA-OBRA-XXX ou DOCA-XXX
    ELSIF v_codigo ~* '^DOCA-(?:OBRA-)?(.+)$' THEN
      v_matches := regexp_matches(v_codigo, '^DOCA-(?:OBRA-)?(.+)$', 'i');
      IF v_obra = '' THEN
        v_obra := v_matches[1];
      END IF;
    END IF;
  END IF;

  -- Regras oficiais de nomenclatura:
  -- 1. Gaveta: "Gaveta {N} - Prateleira {M}"
  IF v_tipo_normalizado IN ('gaveta', 'gavetas') THEN
    RETURN format('Gaveta %s - Prateleira %s', COALESCE(v_num, 1), COALESCE(v_sub, 1));

  -- 2. Cavalete de barras: "Cavalete Horizontal {N} - Nível {M}"
  ELSIF v_tipo_normalizado IN ('cavalete_horizontal', 'cavalete_barras', 'cavalete_h') THEN
    RETURN format('Cavalete Horizontal %s - Nível %s', COALESCE(v_num, 1), COALESCE(v_sub, 1));

  -- 3. Vidros: "Cavalete de Vidro {N}"
  ELSIF v_tipo_normalizado IN ('cavalete_vidro', 'cavalete_v', 'vidro', 'vidros') THEN
    RETURN format('Cavalete de Vidro %s', COALESCE(v_num, 1));

  -- 4. Doca: "Doca de Expedição - Obra {Nome_ou_Código}"
  ELSIF v_tipo_normalizado IN ('doca', 'doca_expedicao', 'expedicao') THEN
    IF v_obra <> '' THEN
      RETURN format('Doca de Expedição - Obra %s', v_obra);
    ELSIF v_num IS NOT NULL THEN
      RETURN format('Doca de Expedição - Obra %s', v_num);
    ELSE
      RETURN 'Doca de Expedição - Geral';
    END IF;

  -- 5. Quarentena: "Gaiola de Quarentena"
  ELSIF v_tipo_normalizado IN ('quarentena', 'gaiola_quarentena') THEN
    RETURN 'Gaiola de Quarentena';

  -- Fallback inteligente
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

-- 4. Trigger para auto-gerar nome_exibicao em novos locais ou atualizações
CREATE OR REPLACE FUNCTION trg_gerar_nome_exibicao_local()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nome_exibicao := gerar_nome_exibicao_local(
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

DROP TRIGGER IF EXISTS trg_atualizar_nome_exibicao ON locais;
CREATE TRIGGER trg_atualizar_nome_exibicao
BEFORE INSERT OR UPDATE OF tipo, numero, subnivel, obra_destino, codigo
ON locais
FOR EACH ROW
EXECUTE FUNCTION trg_gerar_nome_exibicao_local();

-- 5. Backfill para atualizar todos os locais já existentes
UPDATE locais
SET nome_exibicao = gerar_nome_exibicao_local(tipo, numero, subnivel, obra_destino, codigo)
WHERE nome_exibicao IS NULL OR nome_exibicao = '';

-- 6. Atualizar a função criar_locais_em_lote com preenchimento de nome_exibicao
CREATE OR REPLACE FUNCTION criar_locais_em_lote(
  p_tipo TEXT,
  p_quantidade INT,
  p_subniveis INT DEFAULT 1,
  p_area_logica area_logica DEFAULT 'materia_prima',
  p_prefixo TEXT DEFAULT NULL,
  p_obra TEXT DEFAULT NULL,
  p_capacidade_kg NUMERIC DEFAULT 1000.00,
  p_comprimento_mm NUMERIC DEFAULT 6500.00
)
RETURNS SETOF locais
LANGUAGE plpgsql
AS $$
DECLARE
  v_i INT;
  v_j INT;
  v_prefix TEXT;
  v_cod TEXT;
  v_novo_local locais;
  v_tipo_norm TEXT := lower(TRIM(p_tipo));
  v_area area_logica := p_area_logica;
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
  END IF;

  IF p_subniveis <= 0 THEN
    p_subniveis := 1;
  END IF;

  -- Determinar prefixo padrão e área lógica se não informados
  IF v_tipo_norm IN ('gaveta', 'gavetas') THEN
    v_prefix := COALESCE(p_prefixo, 'GAV');
    IF p_area_logica IS NULL THEN v_area := 'almoxarifado'::area_logica; END IF;
    p_comprimento_mm := LEAST(COALESCE(p_comprimento_mm, 1000.00), 1200.00);
  ELSIF v_tipo_norm IN ('cavalete_horizontal', 'cavalete_barras') THEN
    v_prefix := COALESCE(p_prefixo, 'CAV-H');
    IF p_area_logica IS NULL THEN v_area := 'materia_prima'::area_logica; END IF;
    p_comprimento_mm := GREATEST(COALESCE(p_comprimento_mm, 6500.00), 6500.00);
  ELSIF v_tipo_norm IN ('cavalete_vidro', 'cavalete_v') THEN
    v_prefix := COALESCE(p_prefixo, 'CAV-V');
    p_subniveis := 1;
    v_area := 'vidros'::area_logica;
  ELSIF v_tipo_norm IN ('doca', 'doca_expedicao') THEN
    v_prefix := COALESCE(p_prefixo, 'DOCA');
    p_subniveis := 1;
    v_area := 'doca'::area_logica;
  ELSIF v_tipo_norm IN ('quarentena', 'gaiola_quarentena') THEN
    v_prefix := COALESCE(p_prefixo, 'QUA');
    p_subniveis := 1;
    v_area := 'quarentena'::area_logica;
  ELSE
    v_prefix := COALESCE(p_prefixo, 'LOC');
  END IF;

  FOR v_i IN 1..p_quantidade LOOP
    FOR v_j IN 1..p_subniveis LOOP
      IF v_tipo_norm IN ('gaveta', 'cavalete_horizontal') THEN
        v_cod := format('%s-%s-%s', v_prefix, lpad(v_i::text, 2, '0'), lpad(v_j::text, 2, '0'));
      ELSIF v_tipo_norm IN ('doca') AND p_obra IS NOT NULL AND p_obra <> '' THEN
        v_cod := format('%s-%s', v_prefix, upper(regexp_replace(p_obra, '[^a-zA-Z0-9]+', '-', 'g')));
      ELSE
        v_cod := format('%s-%s', v_prefix, lpad(v_i::text, 2, '0'));
      END IF;

      INSERT INTO locais (
        codigo,
        tipo,
        area_logica,
        numero,
        subnivel,
        obra_destino,
        capacidade_max_kg,
        comprimento_max_mm,
        nome_exibicao
      ) VALUES (
        v_cod,
        v_tipo_norm,
        v_area,
        v_i,
        v_j,
        p_obra,
        p_capacidade_kg,
        p_comprimento_mm,
        gerar_nome_exibicao_local(v_tipo_norm, v_i, v_j, p_obra, v_cod)
      )
      ON CONFLICT (codigo) DO UPDATE
      SET
        tipo = EXCLUDED.tipo,
        area_logica = EXCLUDED.area_logica,
        numero = EXCLUDED.numero,
        subnivel = EXCLUDED.subnivel,
        obra_destino = EXCLUDED.obra_destino,
        nome_exibicao = EXCLUDED.nome_exibicao,
        updated_at = clock_timestamp()
      RETURNING * INTO v_novo_local;

      RETURN NEXT v_novo_local;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- 7. Tabela de itens e regras de validação item x local
CREATE TABLE IF NOT EXISTS itens (
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

CREATE TABLE IF NOT EXISTS estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES itens(id) ON DELETE RESTRICT,
  local_id UUID NOT NULL REFERENCES locais(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  lote VARCHAR(50),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 8. Trigger de Validação Rígida Item x Local
CREATE OR REPLACE FUNCTION validar_alocacao_item_local()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_local RECORD;
BEGIN
  -- Obter dados do item
  SELECT id, codigo, descricao, tipo_material, COALESCE(comprimento_mm, 0) AS comprimento_mm
  INTO v_item
  FROM itens
  WHERE id = NEW.item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item com ID % não encontrado.', NEW.item_id;
  END IF;

  -- Obter dados do local
  SELECT id, codigo, tipo, area_logica, nome_exibicao, comprimento_max_mm
  INTO v_local
  FROM locais
  WHERE id = NEW.local_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Local com ID % não encontrado.', NEW.local_id;
  END IF;

  -- REGRA 1: Barras de 6m ou perfis longos são proibidos em gavetas
  -- Erro operacional exato exigido: "Barra de 6 m não cabe em gaveta. Use um Cavalete Horizontal."
  IF lower(v_local.tipo) IN ('gaveta', 'gavetas') THEN
    IF lower(v_item.tipo_material) IN ('perfil_barra', 'barra_perfil') OR v_item.comprimento_mm >= 3000 THEN
      RAISE EXCEPTION 'Barra de 6 m não cabe em gaveta. Use um Cavalete Horizontal.';
    END IF;

    IF lower(v_item.tipo_material) = 'vidro' THEN
      RAISE EXCEPTION 'Vidro só pode ser armazenado em Cavalete de Vidro.';
    END IF;
  END IF;

  -- REGRA 2: Vidro apenas em cavalete de vidro
  IF lower(v_item.tipo_material) = 'vidro' THEN
    IF lower(v_local.tipo) NOT IN ('cavalete_vidro', 'cavalete_v') THEN
      RAISE EXCEPTION 'Vidro só pode ser armazenado em Cavalete de Vidro.';
    END IF;
  END IF;

  -- REGRA 3: Cavalete de vidro não pode receber outros materiais
  IF lower(v_local.tipo) IN ('cavalete_vidro', 'cavalete_v') THEN
    IF lower(v_item.tipo_material) <> 'vidro' THEN
      RAISE EXCEPTION 'Cavalete de Vidro é exclusivo para chapas e peças de vidro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_alocacao_item_local ON estoque_itens;
CREATE TRIGGER trg_validar_alocacao_item_local
BEFORE INSERT OR UPDATE OF item_id, local_id
ON estoque_itens
FOR EACH ROW
EXECUTE FUNCTION validar_alocacao_item_local();
