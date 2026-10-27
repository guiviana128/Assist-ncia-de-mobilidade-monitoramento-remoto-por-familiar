package com.assistmob.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiStatusDTO {
    private boolean available;
    private String provider;
    private String model;
    private String message;
}
