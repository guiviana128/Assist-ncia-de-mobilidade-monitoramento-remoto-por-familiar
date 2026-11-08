# Validação da versão familiar — 8 de novembro de 2026

Implementação local na branch `feat/family-monitoring`, baseada em `b02460fa` (interface do Gustavo). A cópia antiga em C:/TEMP foi preservada.

## Evidências

- Java 17: `mvn package` aprovado, incluindo seis testes: cinco fluxos de integração familiar e um teste de banco em arquivo reaberto com nova escrita.
- Python 3.11: seis testes aprovados para sequência temporal, interrupção de gesto, separação de estados da mão e fila persistente de metadados.
- React/TypeScript: `npm run build` aprovado. Permanece aviso de bundle maior que 500 kB, sem erro de compilação.
- Navegador: cadastro de conta sintética, credenciais de equipamento, entrada, saída, preferências persistidas, tela sem leituras e estado indisponível do Ollama verificados. Após reinício do backend, a mesma conta entrou e as preferências continuaram presentes.
- Revisão independente: corrigidos isolamento de contas no cliente, referências do robô ao dispositivo, alertas urgentes antigos, estados reais de conexão, fila por equipamento, dados de exemplo em contas reais, confirmação de persistência e competição entre agendamento de IA e lembretes.

## Comportamentos protegidos

Uma família não consulta dispositivos, telemetria, gestos, análises ou comandos de robô de outra. Chaves de equipamento são individuais. Tokens persistidos são hashes; senhas usam sal e PBKDF2. Recuperação invalida sessões anteriores. Convites expiram em 24 h e só podem ser utilizados uma vez. Identidade dos responsáveis por atendimento e revisão vem da sessão, não do texto enviado pelo cliente. Gestos repetidos com mesmo eventId não duplicam o alerta. Lembretes atrasados do mesmo dia são recuperados e registrados uma única vez. Ollama não bloqueia a tarefa de lembretes.

O perfil local usa um provedor de arquivo H2 que testa a abertura real de um canal de escrita quando a consulta antecipada `Files.isWritable` apresenta falso negativo em contêineres Windows. Não muda permissões, conteúdo do arquivo ou bloqueios do banco. URLs comuns de H2 e PostgreSQL não são afetadas.

## Limites da validação

Ollama/modelo não estavam em execução; foi verificado o estado de indisponibilidade, não a qualidade de respostas de um modelo real. Firebase externo não foi habilitado por ausência de credenciais; a caixa de entrada persistente funciona e a integração registra aceitação ou falha do provedor. Captura física da webcam não foi iniciada nesta validação; o worker foi implementado e a fila testada, mas precisão, tempo real e disponibilidade da câmera precisam ser avaliados com o equipamento. PostgreSQL permanece configurado para implantação, mas os testes e a prévia local usam H2. Comandos físicos de vibração e localização sonora não são afirmados como executados. Nenhum diagnóstico, ligação ou missão de socorro é executado pela IA.

## Operação

### Correção de cadastro e sessão

Reproduzidos e corrigidos: cadastro ignorava a opção de manter conectado; falhas do armazenamento local podiam ser apresentadas como indisponibilidade do servidor após uma conta já criada; armazenamento de aba bloqueado impedia recuperar sessão local válida; cadastros bem-sucedidos consumiam o limite de tentativas erradas da mesma conexão. O modo de recuperação também é encerrado ao selecionar cadastro.

Validação adicional: sete testes do backend aprovados, incluindo seis cadastros legítimos consecutivos pela mesma conexão; quatro testes de autenticação do front-end aprovados e incluídos no CI; build aprovado. No navegador, uma nova conta sem convite foi criada com manter conectado selecionado; a aba foi fechada e reaberta e o painel entrou sem novo login. A validade da sessão continua sendo oito horas, e a conta permanece no banco após expiração.

Veja `GUIA-DA-FAMILIA.md` e `INICIAR.ps1`. O banco e suas cópias de segurança, dados de execução e credenciais não fazem parte do commit nem do pacote de fontes. Nenhum push ou merge na main foi efetuado.
