package com.assistmob.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Respostas de erro padronizadas, sem stack trace (o pentest mostrou que erros 500 expunham detalhes internos).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "bad_request", "message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException e) {
        String details = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest().body(Map.of("error", "validation_failed", "message", details));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "malformed_json",
                "message", "Corpo da requisição inválido ou com valores não aceitos."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> unexpected(Exception e) {
        if (e instanceof ErrorResponse errorResponse) {
            // Erros do próprio Spring (404, 405, parâmetro faltando...) mantêm o status correto
            return ResponseEntity.status(errorResponse.getStatusCode()).body(Map.of("error", "request_error",
                    "message", errorResponse.getBody().getTitle() != null ? errorResponse.getBody().getTitle() : "Requisição inválida"));
        }
        log.error("Erro inesperado", e);
        return ResponseEntity.internalServerError().body(Map.of("error", "internal_error",
                "message", "Erro interno. Consulte os logs do servidor."));
    }
}
