package com.assistmob.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tb_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    private String fcmToken; // Token para notificações Push no Smartphone

    @Column(nullable = false)
    private String role; // "GUARDIAN" (Familiar/Cuidador) ou "PATIENT" (Usuário da bengala)

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
