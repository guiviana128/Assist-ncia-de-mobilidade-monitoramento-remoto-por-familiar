package com.assistmob.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ResourceLoader;

@Configuration
@ConditionalOnProperty(name = "firebase.enabled", havingValue = "true")
public class FirebaseConfig {
  @Bean
  public FirebaseApp firebaseApp(
      @Value("${firebase.config-path}") String path, ResourceLoader resources) throws Exception {
    if (!FirebaseApp.getApps().isEmpty()) return FirebaseApp.getInstance();
    try (var stream = resources.getResource(path).getInputStream()) {
      return FirebaseApp.initializeApp(
          FirebaseOptions.builder().setCredentials(GoogleCredentials.fromStream(stream)).build());
    }
  }
}
