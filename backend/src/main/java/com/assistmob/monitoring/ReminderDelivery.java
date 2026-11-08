package com.assistmob.monitoring;

import jakarta.persistence.*;

@Entity
@Table(name = "amparo_reminder_delivery")
public class ReminderDelivery {
  @Id public String id;

  protected ReminderDelivery() {}

  public ReminderDelivery(String id) {
    this.id = id;
  }
}
