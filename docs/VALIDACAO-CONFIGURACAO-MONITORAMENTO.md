# Validação — configuração e monitoramento (08/11/2026)

- Backend: 10 testes aprovados, incluindo primeira leitura, família sem acesso a
  outro dispositivo, salvamento/rejeição da casa, leitura antiga e emergência
  ainda pendente após 51 eventos mais recentes.
- Frontend: 9 testes aprovados, incluindo CEP inválido/ausente/outro estado,
  confirmação de coordenadas, validade de conexões, sessão e proteção contra
  sobrescrever preferências quando seu carregamento falha.
- Navegador: conta sintética separada da sessão pessoal; CEP público 01001-000
  retornou Praça da Sé, busca no mapa retornou candidatos, escolha confirmada foi
  salva e preservada após recarregar. Os dois modos foram verificados.
- Demonstração: mudança automática de cômodo, pedido de ajuda e confirmação
  local. Ao voltar ao modo real, nenhum alerta real foi criado pelo teste.
- Celular: largura 390 px, conteúdo 382 px, sem rolagem horizontal; indicador de
  configuração pendente e seletor de modos legíveis.
- Revisão independente: corrigidos prontidão das preferências, validade das
  conexões, abertura de atendimento durante configuração, emergência fora da
  página de histórico e caminho legado do simulador para contas autenticadas.

Não foram validados equipamentos físicos. Ollama continua dependendo da
instalação e inicialização local; a tela informa sua indisponibilidade.
Provedores externos podem falhar ou não localizar um endereço; o formulário
permite preenchimento manual e ajuste do ponto. A planta é de referência.

Fontes de integração: [ViaCEP](https://viacep.com.br/) e
[Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

## Ajuste do fluxo e restauração do Início — 9 de novembro

O Início e a Casa 3D mantêm seus componentes originais. O Início agora apresenta
o mapa GPS abaixo da planta. Após cadastrar uma conta e confirmar a casa, o
painel abre o Início no modo demonstração, com robô virtual online e em ronda.
O modo é guardado por conta neste navegador. Equipamentos reais continuam com
estado baseado em telemetria; comandos simulados não são enviados ao robô físico.

Validação desta revisão: 10 testes do front-end e build aprovados. No navegador,
uma conta fictícia nova abriu a configuração de CEP; ViaCEP preencheu Praça da Sé
(01001-000), o salvamento abriu o Início com planta e GPS, a Casa 3D exibiu a ronda
e aceitou uma missão para o quarto. Após recarregar, endereço e demonstração
continuaram presentes. Nenhum equipamento físico foi utilizado no teste.
