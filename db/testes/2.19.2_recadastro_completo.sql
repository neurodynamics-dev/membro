\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_recadastro_completo: conferir os dados atualiza tudo o que a aba "Dados pessoais" mostra.
\i 2.19.2_recadastro_completo.sql
\i 2.19.2_recadastro_completo.sql

do $$
declare r jsonb; bom jsonb;
begin
  perform sou(11);
  bom := '{"nome_civil":"Bruno Tavares da Silva","cpf":"529.982.247-25","data_nascimento":"2001-03-04","matricula":"2021012345",
    "instituicao":"UFMG","curso":"Engenharia Elétrica","rg":"MG-12.345.678","rg_orgao":"PC-MG","nacionalidade":"brasileira",
    "estado_civil":"solteiro(a)","telefone":"(31) 99876-5432","end_logradouro":"Rua dos Inconfidentes","end_numero":"123",
    "end_complemento":"apto 201","end_bairro":"Pampulha","end_cep":"31270-901","end_cidade":"Belo Horizonte","end_uf":"MG",
    "genero":"Masculino","cidade_origem":"Ouro Preto","periodo_ingresso":"2021/1","tempo_deslocamento":"40 min",
    "autodeclaracao_racial":"Parda","situacao_fump":"Não cadastrado","acessibilidade":"","background":"Eletrônica e firmware",
    "lattes":"http://lattes.cnpq.br/1234567890","instagram":"@bruno","github":"brunot","autorizacao_imagem":"true",
    "email_pessoal":"Bruno.Tavares@Exemplo.com "}';
  r := public.cadastro_confirmar(bom);
  perform ok(r->>'status' = 'ok', 'confirmar com todos os campos');
  perform ok((select genero = 'Masculino' and cidade_origem = 'Ouro Preto' and periodo_ingresso = '2021/1' and tempo_deslocamento = '40 min'
              and autodeclaracao_racial = 'Parda' and situacao_fump = 'Não cadastrado' and acessibilidade is null
              and background = 'Eletrônica e firmware' and lattes like '%lattes.cnpq.br%' and instagram = '@bruno' and github = 'brunot'
              and autorizacao_imagem from dados_pessoais where registro = 11), 'os campos da aba Dados pessoais são atualizados');
  perform ok((select endereco from dados_pessoais where registro = 11) = 'Rua dos Inconfidentes, 123 apto 201, Pampulha, Belo Horizonte/MG, CEP 31270-901',
    'o endereço de uma linha acompanha as partes');
  perform ok((select email_pessoal from membros where registro = 11) = 'bruno.tavares@exemplo.com', 'o e-mail pessoal vai para o quadro');
  r := public.cadastro_meus_dados();
  perform ok(r->>'genero' = 'Masculino' and r->>'email_pessoal' = 'bruno.tavares@exemplo.com' and (r->>'autorizacao_imagem')::boolean, 'Meus dados devolve tudo');

  -- um formulário antigo (sem os opcionais) não apaga o que já estava
  r := public.cadastro_confirmar(bom - 'genero' - 'cidade_origem' - 'email_pessoal' - 'autorizacao_imagem');
  perform ok((select genero = 'Masculino' and cidade_origem = 'Ouro Preto' and autorizacao_imagem from dados_pessoais where registro = 11)
             and (select email_pessoal from membros where registro = 11) = 'bruno.tavares@exemplo.com', 'campo que não veio fica como estava');
  -- em branco apaga
  r := public.cadastro_confirmar(jsonb_set(bom, '{instagram}', '""'));
  perform ok((select instagram from dados_pessoais where registro = 11) is null, 'campo em branco apaga');
  r := public.cadastro_confirmar(jsonb_set(jsonb_set(bom, '{email_pessoal}', '"sem-arroba"'), '{lattes}', '"meusite.com"'));
  perform ok(r->>'status' = 'invalido' and r->'campos' ? 'email_pessoal' and r->'campos' ? 'lattes', 'e-mail e Lattes inválidos voltam marcados');
end $$;
\echo Tudo certo.
