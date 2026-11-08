package com.assistmob.family;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class Secrets {
  private Secrets() {}

  public static String token() {
    byte[] b = new byte[32];
    new SecureRandom().nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  public static String digest(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public static String password(String value) {
    String salt = token();
    return salt + ":" + derive(value, salt);
  }

  private static String derive(String value, String salt) {
    try {
      var spec =
          new PBEKeySpec(value.toCharArray(), salt.getBytes(StandardCharsets.UTF_8), 310000, 256);
      try {
        return Base64.getEncoder()
            .encodeToString(
                SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec)
                    .getEncoded());
      } finally {
        spec.clearPassword();
      }
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public static boolean matches(String value, String hash) {
    if (hash == null || !hash.contains(":")) return false;
    String[] p = hash.split(":", 2);
    return MessageDigest.isEqual(
        derive(value, p[0]).getBytes(StandardCharsets.UTF_8),
        p[1].getBytes(StandardCharsets.UTF_8));
  }
}
