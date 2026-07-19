-- ============================================================
-- SOMA 11.0 — MIGRAÇÃO · NeuroDynamics
-- INFORMAÇÕES do Portal do Membro: biblioteca de documentos e
-- políticas da equipe (estatuto, políticas, guias, formulários),
-- publicados como LINKS do Google Drive pelo Depto de Pessoal
-- no admin.html do portal e lidos por qualquer membro logado
-- na aba "Informações".
--
-- O arquivo em si continua no Drive (com o controle de acesso
-- de lá); o portal guarda só título, categoria, descrição e o
-- link. Se o Drive negar o acesso, o membro abre uma
-- Solicitação de acesso pelo próprio portal.
--
-- Pré-requisito: SOMA 10.0 aplicada.
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. DOCUMENTOS E POLÍTICAS
-- ------------------------------------------------------------
create table if not exists public.portal_documentos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descricao     text,
  categoria     text not null default 'outro'
                check (categoria in ('institucional','politica','guia','formulario','outro')),
  url           text not null,                 -- link do Drive (ou outro repositório)
  ordem         integer not null default 100,
  publicado     boolean not null default true,
  criado_por    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_pdocs_cat
  on public.portal_documentos (publicado, categoria, ordem);

drop trigger if exists tg_upd_pdocs on public.portal_documentos;
create trigger tg_upd_pdocs before update on public.portal_documentos
  for each row execute function public.fn_atualizado();

-- ------------------------------------------------------------
-- 2. AUDITORIA (mesmo gatilho das demais tabelas do sistema)
-- ------------------------------------------------------------
drop trigger if exists tg_aud_pdocs on public.portal_documentos;
create trigger tg_aud_pdocs after insert or update or delete on public.portal_documentos
  for each row execute function public.fn_auditoria();

-- ------------------------------------------------------------
-- 3. SEGURANÇA (RLS)
--    Membros leem o que está publicado; admin/pessoal leem e
--    editam tudo.
-- ------------------------------------------------------------
alter table public.portal_documentos enable row level security;

drop policy if exists pdocs_select on public.portal_documentos;
create policy pdocs_select on public.portal_documentos
  for select to authenticated
  using (publicado or public.papel_atual() in ('admin','pessoal'));

drop policy if exists pdocs_write on public.portal_documentos;
create policy pdocs_write on public.portal_documentos
  for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- ============================================================
-- FIM — SOMA 11.0
-- Depois desta migração:
--   1) publique o index.html e o admin.html atualizados do
--      repositório "membro" (aba Informações);
--   2) cadastre os documentos em /admin.html -> Documentos,
--      colando os links de compartilhamento do Drive
--      ("qualquer pessoa na organização com o link", de
--      preferência — o controle fino continua no Drive).
-- ============================================================
