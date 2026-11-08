package com.assistmob.monitoring;

import com.assistmob.dto.*;
import com.assistmob.family.*;
import com.assistmob.repository.*;
import com.assistmob.service.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MonitoringService {
  private final AiReports reports;
  private final AiAnalysisService ai;
  private final DeviceBindings bindings;

  @Value("${assistmob.monitoring.enabled:true}")
  private boolean enabled;

  public MonitoringService(AiReports reports, AiAnalysisService ai, DeviceBindings bindings) {
    this.reports = reports;
    this.ai = ai;
    this.bindings = bindings;
  }

  public synchronized AiReport analyze(String device) {
    var last = reports.findFirstByDeviceIdOrderByCreatedAtDesc(device);
    if (last.isPresent() && last.get().getCreatedAt().isAfter(Instant.now().minusSeconds(60)))
      return last.get();
    var report = new AiReport();
    report.setDeviceId(device);
    report.setCreatedAt(Instant.now());
    try {
      var req = new AiAnalysisRequestDTO();
      req.setDeviceId(device);
      req.setTelemetryLimit(30);
      req.setQuestion(
          "Resuma as leituras disponíveis e os alertas, destacando lacunas e horários. Não infira"
              + " tendência diária sem dados suficientes. Sugira apenas verificações humanas.");
      var answer = ai.analyze(req);
      report.setState("AVAILABLE");
      report.setSummary(answer.getAnswer());
      report.setModel(answer.getModel());
    } catch (RuntimeException e) {
      report.setState("UNAVAILABLE");
      report.setSummary("Ollama indisponível. Os alertas e o histórico continuam funcionando.");
    }
    return reports.save(report);
  }

  @Scheduled(fixedDelayString = "${assistmob.monitoring.interval-ms:300000}", initialDelay = 60000)
  public void monitor() {
    if (!enabled) return;
    for (var binding : bindings.findAll()) {
      try {
        var last = reports.findFirstByDeviceIdOrderByCreatedAtDesc(binding.getDeviceId());
        if (last.isEmpty() || last.get().getCreatedAt().isBefore(Instant.now().minusSeconds(300)))
          analyze(binding.getDeviceId());
      } catch (RuntimeException e) {
        org.slf4j.LoggerFactory.getLogger(getClass())
            .warn("Falha de análise isolada para um dispositivo");
      }
    }
  }

  public List<AiReport> history(String device) {
    return reports.findByDeviceIdOrderByCreatedAtDesc(device, PageRequest.of(0, 20));
  }
}
