-- ============================================================================
-- MIGRATION: 20261003000016_fase3_minima.sql
-- ETAPA F: Fase 3 Mínima (Triagem 3 - Qualidade, Triagem 4 - Expedição, Ferramental)
-- ============================================================================

-- 1. TABELA DE PEDIDOS DE CLIENTES / OBRAS
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

-- 2. TABELA DE ESQUADRIAS / PEÇAS PRODUZIDAS COM CONTROLE DE REPROVAÇÕES
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

-- 3. TRIAGEM 3: INSPEÇÃO DE QUALIDADE & CHECKLIST TÉCNICO
CREATE TABLE IF NOT EXISTS public.inspecoes_qualidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  esquadria_id UUID NOT NULL REFERENCES public.esquadrias(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL, -- {"esquadro": true, "vedacao_epdm": true, "roldanas": true, "pelicula_protetora": true}
  resultado TEXT NOT NULL CHECK (resultado IN ('aprovado', 'reprovado')),
  motivo TEXT,
  inspetor_id UUID REFERENCES public.perfis(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger da Triagem 3: Trata Reprovação, 2ª Reprovação ao Dono e Geração de OP de Retrabalho
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

    -- Atualizar esquadria: status para 'retrabalho' e incrementa contador
    UPDATE public.esquadrias
    SET
      status = 'retrabalho',
      reprovacoes_consecutivas = v_nova_reprovacao,
      ultima_inspecao_em = now(),
      atualizado_em = now()
    WHERE id = NEW.esquadria_id;

    -- Gerar automaticamente Ordem de Produção de Retrabalho vinculada
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
        v_esquadria.serial, v_esquadria.codigo_tipologia, COALESCE(NEW.motivo, 'Defeito identificado no checklist')),
      'planejada',
      'definitiva',
      false,
      true
    )
    RETURNING id INTO v_op_id;

    -- Registrar evento na auditoria
    INSERT INTO public.auditoria (
      usuario_id,
      evento,
      tabela,
      registro_id,
      dados_novos
    ) VALUES (
      NEW.inspetor_id,
      'INSPECAO_REPROVADA_RETRABALHO',
      'inspecoes_qualidade',
      NEW.id::text,
      jsonb_build_object(
        'serial', v_esquadria.serial,
        'reprovacoes', v_nova_reprovacao,
        'motivo', NEW.motivo,
        'op_retrabalho', v_op_retrabalho_numero
      )
    );

    -- REGRA CRÍTICA: Se a mesma peça for reprovada pela 2ª vez consecutiva, notificar o Dono!
    IF v_nova_reprovacao >= 2 THEN
      PERFORM private.emitir_notificacao(
        'qualidade_segunda_reprovacao',
        'critica'::public.severidade_notificacao,
        'Alerta Crítico: 2ª Reprovação Consecutiva de Esquadria',
        format('Esquadria %s (Obra: %s) reprovada pela 2ª vez consecutiva na qualidade. Motivo: %s. OP de Retrabalho: %s.',
          v_esquadria.serial,
          COALESCE(v_pedido.obra_destino, 'Geral'),
          NEW.motivo,
          v_op_retrabalho_numero
        ),
        '/qualidade',
        'sistema.dono',
        NULL,
        'esquadrias',
        v_esquadria.id::text
      );
    ELSE
      -- Notificação padrão de retrabalho para PCP/Produção
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
    -- Zera o contador de reprovações consecutivas e aprova a peça
    UPDATE public.esquadrias
    SET
      status = 'aprovado',
      reprovacoes_consecutivas = 0,
      ultima_inspecao_em = now(),
      atualizado_em = now()
    WHERE id = NEW.esquadria_id;

    -- REGRA DE TRANSIÇÃO DO PEDIDO:
    -- O pedido só avança de 'em_inspecao' para 'na_doca' se 100% das peças estiverem aprovadas!
    SELECT NOT EXISTS (
      SELECT 1 FROM public.esquadrias
      WHERE pedido_id = v_esquadria.pedido_id
        AND status NOT IN ('aprovado', 'na_doca', 'carregado', 'entregue')
    ) INTO v_todas_aprovadas;

    IF v_todas_aprovadas THEN
      UPDATE public.pedidos
      SET
        status = 'na_doca',
        atualizado_em = now()
      WHERE id = v_esquadria.pedido_id;

      -- Atualizar todas as peças do pedido para 'na_doca'
      UPDATE public.esquadrias
      SET status = 'na_doca', atualizado_em = now()
      WHERE pedido_id = v_esquadria.pedido_id
        AND status = 'aprovado';

      PERFORM private.emitir_notificacao(
        'pedido_liberado_doca',
        'info'::public.severidade_notificacao,
        'Pedido 100% Aprovado e Posicionado na Doca',
        format('Todas as esquadrias do pedido %s (%s) foram aprovadas na inspeção e liberadas para expedição.',
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

-- 4. TRIAGEM 4: EXPEDIÇÃO, VALIDAÇÃO RÍGIDA DE SERIAL E FINALIZAÇÃO

-- RPC 4.1: validar_carregamento_expedicao
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
  -- Validar se o pedido existe
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido ID % não encontrado.', p_pedido;
  END IF;

  -- Localizar a peça pelo serial
  SELECT * INTO v_esquadria FROM public.esquadrias WHERE serial = v_serial_limpo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serial % não cadastrado no sistema.', v_serial_limpo;
  END IF;

  -- Regra 1: Validar se a peça pertence exatamente ao pedido sendo carregado
  IF v_esquadria.pedido_id <> p_pedido THEN
    RAISE EXCEPTION 'BLOQUEIO FÍSICO: Peça % pertence a outro pedido (Obra divergente). Embarque cancelado.', v_serial_limpo;
  END IF;

  -- Regra 2: Validar se a peça já passou pela inspeção com aprovação
  IF v_esquadria.status IN ('em_inspecao', 'retrabalho', 'em_producao') THEN
    RAISE EXCEPTION 'BLOQUEIO DE QUALIDADE: Peça % não aprovada na qualidade (Status atual: %). Embarque proibido.',
      v_serial_limpo, v_esquadria.status;
  END IF;

  -- Regra 3: Peça já carregada
  IF v_esquadria.status = 'carregado' THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'ja_carregado', true,
      'serial', v_serial_limpo,
      'mensagem', 'Peça já havia sido bipada anteriormente neste carregamento.'
    );
  END IF;

  -- Atualizar peça para 'carregado'
  UPDATE public.esquadrias
  SET
    status = 'carregado',
    atualizado_em = now()
  WHERE id = v_esquadria.id;

  -- Registrar na auditoria
  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    tabela,
    registro_id,
    dados_novos
  ) VALUES (
    auth.uid(),
    'BIPAGEM_DOCA_SUCESSO',
    'esquadrias',
    v_esquadria.id::text,
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

-- RPC 4.2: finalizar_expedicao
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

  -- Contar peças totais e peças que ainda não estão 'carregado'
  SELECT count(*)::int INTO v_total_pecas FROM public.esquadrias WHERE pedido_id = p_pedido;
  SELECT count(*)::int INTO v_pecas_pendentes 
  FROM public.esquadrias 
  WHERE pedido_id = p_pedido AND status <> 'carregado';

  -- Impedir carregamento com peças pendentes
  IF v_pecas_pendentes > 0 THEN
    RAISE EXCEPTION 'Não é permitido finalizar a expedição: restam % de % esquadrias pendentes de bipagem e carregamento.',
      v_pecas_pendentes, v_total_pecas;
  END IF;

  -- Transicionar pedido para 'entregue'
  UPDATE public.pedidos
  SET
    status = 'entregue',
    comprovante_entrega = COALESCE(p_comprovante_nome, 'Assinatura_Digital_Entregue'),
    entregue_em = now(),
    atualizado_em = now()
  WHERE id = p_pedido;

  -- Transicionar esquadrias para 'entregue'
  UPDATE public.esquadrias
  SET
    status = 'entregue',
    atualizado_em = now()
  WHERE pedido_id = p_pedido;

  -- Registrar na auditoria
  INSERT INTO public.auditoria (
    usuario_id,
    evento,
    tabela,
    registro_id,
    dados_novos
  ) VALUES (
    auth.uid(),
    'EXPEDICAO_FINALIZADA_ENTREGUE',
    'pedidos',
    p_pedido::text,
    jsonb_build_object(
      'pedido', v_pedido.numero_pedido,
      'obra', v_pedido.obra_destino,
      'total_pecas', v_total_pecas,
      'comprovante', p_comprovante_nome
    )
  );

  -- Notificar Dono e PCP
  PERFORM private.emitir_notificacao(
    'expedicao_concluida',
    'info'::public.severidade_notificacao,
    'Carga Despachada com Sucesso',
    format('O pedido %s da obra %s (%s peças) teve expedição 100%% concluída e liberada na doca.',
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

-- 5. MÓDULO DE FERRAMENTAL FABRIL E ATIVOS
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

-- View para identificar ferramentas vencidas e atrasos na fábrica
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

-- 6. SEED INICIAL DE HOMOLOGAÇÃO PARA TESTES E DEMONSTRAÇÃO
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
