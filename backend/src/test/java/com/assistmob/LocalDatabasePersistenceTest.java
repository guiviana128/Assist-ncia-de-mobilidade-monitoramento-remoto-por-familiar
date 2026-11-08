package com.assistmob;

import com.assistmob.config.LocalDatabasePath;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class LocalDatabasePersistenceTest {
  @Test
  void fileDatabaseRemainsWritableAfterClosingAndReopening() throws Exception {
    LocalDatabasePath.register();
    Files.createDirectories(Path.of("target", "persistence-test"));
    String path = "./target/persistence-test/" + UUID.randomUUID();
    String url = "jdbc:h2:amparo:" + path;
    try {
      try (var connection = DriverManager.getConnection(url, "sa", "")) {
        connection.createStatement().execute("create table saved_state (id int primary key)");
        connection.createStatement().execute("insert into saved_state values (1)");
      }
      try (var connection = DriverManager.getConnection(url, "sa", "")) {
        connection.createStatement().execute("insert into saved_state values (2)");
        try (var result = connection.createStatement().executeQuery("select count(*) from saved_state")) {
          result.next();
          assertEquals(2, result.getInt(1));
        }
      }
    } finally {
      Files.deleteIfExists(Path.of(path + ".mv.db"));
      Files.deleteIfExists(Path.of(path + ".trace.db"));
    }
  }
}
