package com.assistmob.service;

import com.assistmob.model.Alert;
import com.google.firebase.messaging.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class FcmNotificationService {

  private static final Logger log = LoggerFactory.getLogger(FcmNotificationService.class);

  @Value("${firebase.enabled:false}")
  private boolean firebaseEnabled;

  public String sendPushAlert(String targetToken, Alert alert) {
    log.info(
        "[FCM] Disparando Notificação Push: Tipo={}, Dispositivo={}, Mensagem='{}'",
        alert.getAlertType(),
        alert.getDeviceId(),
        alert.getMessage());

    if (!firebaseEnabled || targetToken == null || targetToken.isBlank()) {
      return "INBOX_ONLY";
    }

    try {
      Notification notification =
          Notification.builder()
              .setTitle("🚨 Alerta de Emergência: " + alert.getAlertType())
              .setBody(
                  alert.getMessage() != null
                      ? alert.getMessage()
                      : "Evento detectado no dispositivo " + alert.getDeviceId())
              .build();

      Message message =
          Message.builder()
              .setToken(targetToken)
              .setNotification(notification)
              .putData("alertId", String.valueOf(alert.getId()))
              .putData("deviceId", alert.getDeviceId())
              .putData("alertType", alert.getAlertType().name())
              .putData("severity", alert.getSeverity().name())
              .putData("latitude", String.valueOf(alert.getLatitude()))
              .putData("longitude", String.valueOf(alert.getLongitude()))
              .build();

      String response = FirebaseMessaging.getInstance().send(message);
      log.info("[FCM Real] Mensagem aceita pelo provedor. Response ID: {}", response);
      return "PROVIDER_ACCEPTED";
    } catch (Exception e) {
      log.error("[FCM Erro] Falha ao enviar notificação push Firebase: {}", e.getMessage());
      return "FAILED";
    }
  }
}
