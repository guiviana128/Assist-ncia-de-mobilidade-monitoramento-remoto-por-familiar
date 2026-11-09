# Configuração inicial e monitoramento da família

## Intenção

Depois de criar a conta, o familiar deve conseguir configurar a casa, escolher
entre demonstração e equipamento real e entender o que está acontecendo com a
pessoa acompanhada. O usuário escolheu oferecer os dois modos na tela.

## Diagnóstico do projeto atual

- O cadastro e o login funcionaram na porta 3001. O painel já mostra a pessoa
  cadastrada pelo usuário.
- O cadastro gera identificadores e uma chave de equipamento, mas isso não
  conecta um robô físico nem instala o serviço de captura.
- `App.tsx` decide demonstração pela origem dos dados; uma conta autenticada não
  pode selecionar demonstração explicitamente.
- `MonitorarView.tsx` usa uma apresentação básica para dados reais, enquanto os
  gráficos e a apresentação mais elaborada estão no ramo de demonstração.
- `FamilyCare.tsx` mistura histórico, estado das conexões, IA, contatos,
  convites e credenciais numa sequência extensa dentro de Monitorar.
- `cuidado.ts` já salva preferências por família; uma casa nova tem coordenadas
  0,0 e a área segura desativada. O endereço é apenas texto livre.
- `MapaSaidas.tsx` esconde todo o mapa quando não existe posição da pessoa,
  mesmo quando a localização da casa poderia ser mostrada.
- Os indicadores usam “sem conexão” em casos de primeira configuração. A
  configuração pendente e a perda de uma conexão anterior precisam ser distintas.
- A telemetria contém velocidade e pode informar cômodo, mas o GPS sozinho não
  permite saber em qual cômodo a pessoa está. Há rastreamento de cômodo separado.

## Abordagens

1. Apenas equipamento real: dados verificados, mas exige equipamentos vinculados
   para experimentar o produto. Não atende ao pedido de demonstração.
2. Apenas demonstração: experiência imediata, mas não entrega acompanhamento real.
3. **Dois modos explícitos, escolhidos na tela**: escolhido pelo usuário. Preserva
   o acompanhamento real e permite testar uma casa simulada sem misturar fontes.

## Fluxo após o cadastro

1. Preservar a confirmação de criação e a entrega das chaves de configuração.
2. Ao abrir o painel pela primeira vez, apresentar “Vamos configurar sua casa”.
3. Solicitar endereço e ponto da casa no mapa. Permitir configurar depois,
   mantendo um convite claro para concluir a configuração.
4. Oferecer “Experimentar demonstração” e “Conectar meu equipamento”. Permitir
   trocar depois por um controle visível no painel.
5. Proposta de implementação: salvar a escolha por conta neste navegador, com
   isolamento entre usuários. Experimentar a demonstração não muda a tela dos
   demais familiares. Casa e vínculos continuam sendo preferências da família.
6. Contas já existentes recebem o mesmo convite quando a configuração estiver
   incompleta, sem apagar telefone, endereço, histórico ou credenciais existentes.

## Endereço e mapa

- Proposta de escopo: cidades do estado de São Paulo, incluindo a capital;
  campos manuais aceitam ruas não encontradas na busca.
- Busca por CEP sob ação do usuário, com rua, número, complemento, bairro,
  cidade e UF editáveis. Convite de família continua opcional.
- ViaCEP preenche os dados postais. CEP não é coordenada e não posiciona o GPS
  de uma pessoa. Mostrar falhas de consulta sem impedir preenchimento manual.
- Busca explícita no mapa pelo endereço, sem consultas a cada tecla; identificar
  o provedor e informar que o endereço será enviado para a consulta. Mostrar
  candidatos quando o resultado for ambíguo; exigir confirmação do ponto.
- Permitir ajustar o ponto no mapa ou inserir coordenadas se a busca falhar.
- Não usar a localização do computador como se fosse a localização da pessoa.
  Uma opção de localização do navegador, se oferecida, depende de ação e
  permissão do usuário e será rotulada como localização deste aparelho.
- Exibir casa e perímetro mesmo sem GPS da pessoa. Não desenhar marcador de
  pessoa na casa por falta de dados. Identificar a última posição recebida e seu
  horário; 0,0 não é uma localização padrão válida para uma casa em SP.
- Persistir endereço estruturado, endereço para atendimento, coordenadas e raio
  nas preferências da família. A cerca só fica ativa após confirmação válida.
- Manter atribuição dos mapas e consulta manual em caso de indisponibilidade.
  Não prometer cobertura completa de todos os endereços pelo provedor externo.

## Demonstração

- Disponível também para contas autenticadas e recém-criadas.
- Faixa permanente “Demonstração · movimentos e leituras simulados”.
- Usar o nome da pessoa cadastrada. A planta é uma casa de exemplo, rotulada.
- Pessoa muda de cômodo; robô faz ronda. Oferecer pausar/retomar e testar um
  evento de ajuda. A planta e a frase descrevem o mesmo estado simulado.
- Exemplo: “José está caminhando pela casa”, seguido do cômodo e do horário
  simulado. Ao pausar, informar que a demonstração está pausada.
- Usar a máquina local `DemoRobot` quando adequado. Não gravar telemetria,
  alertas, notificações externas ou relatórios simulados no histórico real.
- Comandos e confirmação de ajuda ficam no ambiente simulado. Não enviar
  comandos a um robô físico a partir de botões da demonstração.
- A câmera real e o atendimento de alertas reais mantêm identificação própria;
  entrar em demonstração não interrompe serviços de monitoramento já instalados.
- Uma faixa independente mantém emergências reais visíveis também durante a
  demonstração, com origem “Equipamento real” e ação para abrir o atendimento
  real. Não misturar esses eventos com a linha do tempo fictícia. Sua confirmação
  continua usando a sessão real, com identificação explícita da ação.

## Equipamento real

- Mostrar vínculo da família, identificação do equipamento e instruções para
  configurar o dispositivo e o serviço de câmera, aproveitando a chave já emitida.
- Uma conta nova mostra “Aguardando configuração”/“Aguardando primeira leitura”,
  com ação para configurar. Não afirmar “conectado” antes de receber dados.
- Distinguir configuração pendente, conexão ativa e perda de conexão após leituras.
  Usar os mesmos limites de expiração dos serviços existentes.
- Apresentar câmera, detector, bengala e robô separadamente; câmera conectada não
  implica robô ou detector conectado. Falha do servidor também é um estado próprio.
- A ação “Verificar conexão” consulta os serviços novamente e mostra o horário.
- Não substituir, regenerar ou expor chaves existentes automaticamente.

## Nova apresentação de Monitorar

Ordem proposta:

1. Nome da pessoa, modo selecionado e resumo do estado atual.
2. Cartão “Agora” com movimento/localização, fonte e horário da última leitura.
3. Planta da casa e mapa externo em cartões distintos e responsivos.
4. Cartões compactos de equipamento, bateria e alertas pendentes.
5. Linha do tempo de eventos recentes, com ação para ver histórico e atender.
6. IA em seção secundária com disponibilidade e resumo, sem substituir os fatos.

Endereço, contato, convites e configuração de equipamentos ficam em Configurações
ou na etapa inicial; não são repetidos ao final de Monitorar.
Preservar fontes, cores, cantos e componentes do front-end existente.

## Frases de acompanhamento

- Computadas no servidor a partir de observações da própria família, com fonte,
  data e estado de validade. Regras simples não dependem do Ollama.
- Prioridade: emergência pendente; dados desatualizados; configuração pendente;
  observação recente de atividade; dados insuficientes.
- Velocidade isolada de GPS não comprova caminhada dentro da casa. Sem sinal de
  movimento confiável, dizer “Movimento registrado” ou “Última leitura na sala”,
  conforme a observação disponível.
- “Caminhando” em acompanhamento real exige fonte que reporte essa atividade;
  a pipeline atual reconhece gesto de ajuda e não deve ser apresentada como um
  classificador de caminhada já implementado.
- Não afirmar que a pessoa está bem por ausência de alerta. Dados antigos devem
  virar “Última observação”, não uma frase no presente.
- Todas as contas vinculadas à mesma família veem o mesmo estado real. Famílias
  diferentes não compartilham leituras. A reprodução simulada é local a cada aba,
  identificada como demonstração, sem sincronização entre espectadores.

## Decisões de implementação propostas

- Manter React/Vite, Spring Boot, banco existente e controle de acesso por família.
- Adicionar configuração versionada da casa às preferências, compatível com dados
  antigos. Guardar modo de visualização separadamente por conta neste navegador;
  sem armazenamento disponível, manter na sessão e informar a limitação.
- Separar o painel de acompanhamento, a configuração e o simulador em componentes.
- Não alterar firmware/ROS nem instalar Ollama automaticamente nesta entrega.
- Provedores candidatos: ViaCEP para CEP e OpenStreetMap/Nominatim para busca
  explícita de endereço. Respeitar atribuição, cache e limites de uso; se o projeto
  exigir uso em escala, configurar outro provedor ou serviço próprio.
- Referências: [ViaCEP](https://viacep.com.br/) e
  [política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

## Validação necessária antes da publicação na main

- Conta nova e conta existente; salvar, recarregar e trocar de conta sem misturar dados.
- Seleção dos dois modos, persistência e troca sem enviar dados fictícios ao backend.
- CEP válido, inválido, não encontrado e indisponível; endereço manual preservado.
- Endereço alterado invalida a confirmação anterior do ponto no mapa.
- Mapa da casa sem GPS; GPS antigo não aparece como posição atual.
- Configuração pendente, primeira leitura, conexão ativa e expiração das leituras.
- Resumos coerentes com emergência, dados insuficientes e atividade observada.
- Mesma família em duas sessões e bloqueio de acesso entre famílias distintas.
- Revisão em computador e celular, navegação por teclado e mensagens legíveis.
- Build e testes relevantes aprovados; commit e publicação na main com verificação
  do resultado remoto, conforme autorização já dada pelo usuário.
