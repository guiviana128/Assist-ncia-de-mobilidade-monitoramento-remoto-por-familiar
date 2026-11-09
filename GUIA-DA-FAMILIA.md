# Amparo: contas e monitoramento

A interface de Gustavo foi preservada. Esta versão adiciona contas individuais, separação de famílias, histórico persistente, revisão de gestos, confirmação de atendimento, preferências compartilhadas e análise local supervisionada.

## Usar neste computador

O painel é http://127.0.0.1:3001. Escolha **Criar conta da família**, informe seu e-mail, uma senha de pelo menos 12 caracteres e o nome da pessoa acompanhada. Guarde a chave do equipamento e o código de recuperação: aparecem uma única vez. Não existe mais uma senha compartilhada padrão.

Qualquer pessoa pode criar sua própria conta sem convite. Marque **Manter conectado neste aparelho** no cadastro ou login para preservar a sessão ao fechar e reabrir o navegador. A sessão tem validade de oito horas; sair da conta ou recuperar a senha encerra esse acesso. Use sempre o mesmo endereço do painel: `localhost` e `127.0.0.1` têm armazenamentos separados no navegador.

Em **Monitorar**, a Central de cuidado mostra conexões, histórico, responsáveis por atendimentos, gestos, resumos da IA e convites. Em **Configurações** você também encontra essa central. O convite é de uso único e expira em 24 horas. Outro cuidador cria a própria conta usando o código, sem criar outra família. Não compartilhe a senha.

O banco local está em `backend/data/`. Contas, sessões, histórico e preferências sobrevivem ao fechamento do navegador e ao reinício do servidor. Faça backup dessa pasta com o servidor parado. Ela não deve ser enviada ao GitHub. PostgreSQL continua configurado no perfil padrão para implantação; o perfil `local` usa H2 persistente para dispensar Docker nesta máquina.

## Reiniciar os serviços

Abra dois terminais na pasta deste projeto e execute um comando em cada um:

```powershell
.\INICIAR.ps1 servidor
.\INICIAR.ps1 painel
```

Requisitos em outra máquina: Java 17, Maven 3.9, Node e Python 3.11. O script aproveita os ambientes preparados neste workspace quando existem. Para refazer o servidor após alterar seu código: `mvn package` na pasta `backend`.

## Câmera independente do navegador

Em um terceiro terminal, inicie o serviço de visão:

```powershell
.\INICIAR.ps1 visao
```

Em outro terminal configure as credenciais exibidas no cadastro e inicie a captura:

```powershell
$env:AMPARO_DEVICE_ID='identificador-exibido-no-cadastro'
$env:AMPARO_DEVICE_KEY='chave-exibida-no-cadastro'
$env:AMPARO_CAMERA_INDEX='0'
.\INICIAR.ps1 camera
```

Esse processo precisa ficar rodando no computador que tem a câmera. Continua com o navegador fechado, mas não com o computador desligado. Ctrl+C encerra a captura. Não execute simultaneamente o worker e a captura do navegador na mesma webcam. A aba Câmera tem **Ligar** e **Desligar câmera do navegador**; mudar de aba mantém a captura já autorizada.

O worker envia quadros ao serviço local de visão e registra somente metadados no backend. Não grava imagens. Eventos que aguardam envio ficam numa fila SQLite por dispositivo; recusas permanentes ficam na tabela de auditoria `rejected`, sem bloquear eventos seguintes. Proteja essa pasta. A precisão dos gestos ainda precisa ser avaliada com vídeos e câmeras reais; o resultado é um pedido de verificação, não confirmação de emergência.

## Ollama

A integração está pronta, mas Ollama e o modelo precisam estar disponíveis. Se já tiver Docker, o projeto inclui:

```powershell
cd backend
docker compose up -d ollama ollama-model
```

Ou, em uma instalação local do Ollama, prepare o modelo configurado:

```powershell
ollama pull llama3.2:3b
ollama serve
```

O backend usa `http://localhost:11434` e `llama3.2:3b`; ajuste `OLLAMA_BASE_URL` e `OLLAMA_MODEL` se necessário. Com servidor ligado, registra um resumo a cada cinco minutos e permite pedir análise e proposta manualmente. A ausência do modelo aparece como **IA sem conexão** e não interrompe alertas. O resumo usa as amostras disponíveis, não pressupõe histórico diário completo. Decisões são registradas com a identidade de quem aprovou; nenhuma ligação ou missão de socorro é iniciada pela IA.

## Notificações e equipamentos

O histórico é a caixa de entrada persistente. O botão **Ativar notificações neste navegador** pede permissão ao navegador e funciona enquanto o painel está aberto. Para receber push com o painel fechado, é necessária uma integração de cliente FCM e as credenciais do seu projeto Firebase; não há envio externo configurado nesta máquina.

Para habilitar o backend FCM, defina `FIREBASE_ENABLED=true` e `FIREBASE_CONFIG_PATH=file:C:/caminho/credencial.json`. O cliente autenticado registra seu token FCM em `POST /api/v1/care/notifications/token` com `{"token":"token-do-cliente"}`. Envie `null` para removê-lo. Nunca coloque a credencial administrativa no front-end. O histórico diferencia caixa de entrada, falha e mensagem aceita pelo provedor; aceitação não comprova leitura no aparelho.

A bengala envia `X-API-Key` com sua chave individual e o `deviceId` cadastrado nas rotas de telemetria/alertas. A ponte do robô deve usar o `robotId` exibido e a mesma chave do vínculo. As credenciais antigas compartilhadas deixaram de autenticar equipamentos. Configurar hardware real e avaliar sensores requer esses aparelhos conectados.

Preferências de remédios geram lembretes no painel na hora cadastrada (fuso America/Sao_Paulo), com o servidor ligado. Vibração e localização sonora exigem transporte físico ainda não implementado; a API não afirma que executou esses comandos. Áreas seguras só são avaliadas quando cadastradas e ativadas nas preferências. Sem leitura, bateria e posição aparecem como desconhecidas; métricas de exemplo ficam restritas à demonstração.

## Verificação

Backend: `mvn test` em `backend`. Front-end: `npm ci` e `npm run build` em `dashboard-web`. Visão: `PYTHONPATH=. python -m pytest -q` em `vision-service`. No Windows use `$env:PYTHONPATH='.'` antes do pytest.

A implantação pública ainda exige HTTPS, configuração do banco PostgreSQL, backup e credenciais de push. Esta entrega inicia apenas em endereços locais. Não houve publicação nem merge na main.
# Configuração da casa e modos de acompanhamento

Após criar a conta e guardar as credenciais, abra o painel para configurar a casa.
Informe um CEP de SP ou preencha rua, número e cidade manualmente. A busca no
mapa consulta o OpenStreetMap/Nominatim apenas quando você clicar no botão.
Confira o resultado, ajuste o ponto se necessário e marque a confirmação da casa.
O mapa marca a casa mesmo sem uma leitura de GPS da pessoa.

Escolha **Demonstração** para experimentar a pessoa mudando de cômodo, o robô em
ronda e um pedido de ajuda simulado. Os eventos ficam apenas no navegador e não
entram no histórico real. A escolha é salva por conta neste navegador e não muda
a tela dos outros familiares. Emergências reais continuam sinalizadas.

Escolha **Equipamento real** para ver as leituras da sua família. Uma conta nova
fica aguardando configuração até receber dados. Configure os identificadores e
a chave no equipamento e no serviço de câmera; depois use **Verificar conexão**.
Câmera, detector, bengala e robô têm estados independentes.

Em Monitorar, **Editar casa e mapa** permite revisar o endereço. Alterar endereço
ou ponto exige confirmar a localização novamente. Contatos, convites e histórico
completo ficam em Configurações. A frase de acompanhamento real usa observações
recebidas e seus horários; o detector de gesto atual não classifica caminhada.
