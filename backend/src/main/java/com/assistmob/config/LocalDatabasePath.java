package com.assistmob.config;

import java.io.IOException;
import org.h2.store.fs.FilePath;
import org.h2.store.fs.FilePathWrapper;

/**
 * Local H2 file access with a real write-access probe. On some Windows app containers,
 * Files.isWritable returns false although opening a write channel is permitted. No file
 * contents or permissions are changed by the probe; H2 still takes its normal database lock.
 * PostgreSQL and ordinary H2 URLs are unaffected.
 */
public final class LocalDatabasePath extends FilePathWrapper {
  public static void register() {
    FilePath.register(new LocalDatabasePath());
  }

  @Override
  public String getScheme() {
    return "amparo";
  }

  @Override
  public boolean canWrite() {
    if (super.canWrite()) return true;
    if (!getBase().exists() || getBase().isDirectory()) return false;
    try (var channel = getBase().open("rw")) {
      return channel.isOpen();
    } catch (IOException | SecurityException denied) {
      return false;
    }
  }
}
