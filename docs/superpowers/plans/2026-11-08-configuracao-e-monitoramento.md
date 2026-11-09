# Configuração e monitoramento — Implementation Plan

> Execução nesta sessão: superpowers:executing-plans. O usuário aprovou a
> especificação e solicitou implementação; continuar até testes e publicação.

**Goal:** configurar a casa após o cadastro e oferecer acompanhamento real ou demonstração explícita.
**Architecture:** React com preferências existentes por família, modo local por conta,
simulador isolado e resumo real calculado pelo backend. Reutilizar planta, Leaflet e DemoRobot.
**Tech Stack:** React/TypeScript/Vite, Spring Boot/Java 17, banco existente.
**Spec:** ../specs/2026-11-08-configuracao-e-monitoramento-design.md

## Global Constraints
- Preservar dados, autenticação e isolamento por família.
- Não publicar eventos simulados nem enviar comandos físicos pela demonstração.
- Endereço confirmado é localização da casa; posição da pessoa depende de telemetria.
- Emergências reais permanecem visíveis e atendíveis nos dois modos.
- Publicar na main sem force, após verificação.

## Review Focus
- Mudança de conta durante consultas: descartar resposta antiga.
- Endereço editado após marcar ponto: invalidar confirmação.
- Dados antigos: não apresentar como atividade atual.
- Armazenamento bloqueado: escolha funciona na sessão.
- Cadastro incompleto: configuração pode ser retomada sem perder o contato anterior.

## Task 1 — Configuração da casa
Files: lib/monitoring.ts, services/address.ts, components/setup/HouseSetup.tsx,
lib/cuidado.ts, testes Node, validação de preferências backend.
- [x] Testar validação de endereço/coordenadas e resposta inválida de CEP.
- [x] Adicionar configuração versionada, carregamento e salvamento atômico de casa.
- [x] Criar campos editáveis, busca explícita e confirmação do ponto no mapa.
- [x] Verificar testes, integração de preferências e compatibilidade com dados antigos.

## Task 2 — Dois modos e painel
Files: components/monitorar/MonitoringWorkspace.tsx, DemoMonitoring.tsx,
RealMonitoring.tsx, App.tsx, StatusConexao.tsx, styles/monitoring-workspace.css.
- [x] Testar resumo para primeira configuração, dados antigos e movimento recente.
- [x] Escolha por conta/navegador, reset de estado ao trocar conta, convite inicial.
- [x] Simulação local com pausa, ronda, mudança de cômodo e pedido de ajuda.
- [x] Painel real com estado por equipamento, resumo, mapa e histórico.
- [x] Remover longa central administrativa de Monitorar; manter em Configurações.
- [x] Preservar aviso e atendimento reais fora da demonstração.

## Task 3 — Estado real e verificação
Files: monitoring/CareController.java, MonitoringSummary.java, testes backend.
- [x] Endpoint por dispositivo com família autorizada, fonte e validade.
- [x] Testes para acesso entre famílias e ausência/expiração de leituras.
- [x] Build web, testes backend e browser em desktop/celular.
- [x] Revisão independente do diff e correções.
- [ ] Commit, publicação e verificação remota.

## Ledger
- Base: f048d40. Checkout atual preservado a pedido do usuário.
- Escolha local de modo não altera a escolha dos outros familiares.
- Implantação física e novo classificador de caminhada não fazem parte desta entrega.

- Verificação: backend 10 testes; frontend 9 testes e build; navegador desktop e 390 px, CEP/mapa públicos, persistência, troca de modos e ajuda local. Revisão final sem bloqueadores.
