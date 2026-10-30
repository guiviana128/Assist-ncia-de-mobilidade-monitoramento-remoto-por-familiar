package com.assistmob.security;

/** Quem está chamando a API: um dispositivo (bengala/robô) ou um familiar logado. */
public record AuthPrincipal(Role role, String name) {

    public static final String REQUEST_ATTRIBUTE = "assistmob.principal";

    public enum Role {
        DEVICE,
        FAMILY
    }
}
