# AssistMob Vision Metadata API

Serviço local de visão computacional para reconhecer a sequência do **Signal for Help**:

1. palma aberta;
2. polegar recolhido;
3. dedos fechando sobre o polegar.

O OpenCV decodifica e avalia o quadro. O MediaPipe fornece os pontos da mão. Uma máquina de estados temporal exige as duas etapas antes de confirmar o gesto.

## Privacidade e segurança

- imagens e pontos da mão não são gravados;
- a resposta contém somente metadados;
- uma confirmação exige revisão humana;
- nenhuma chamada de emergência é iniciada automaticamente;
- baixa luminosidade ou desfoque impedem a confirmação.

## Executar

```bash
docker build -t assistmob-vision .
docker run --rm -p 8001:8000 assistmob-vision
```

Documentação interativa: `http://localhost:8001/docs`.

## Testar

```bash
pytest
```
