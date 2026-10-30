// Shaders GLSL próprios do painel 3D (requisito "Interface Imersiva": pipeline gráfico real).
//
// Pipeline: vértices da malha -> vertex shader (modelo -> visão -> projeção) -> rasterização
// -> fragment shader (cor de cada pixel) -> teste de profundidade -> imagem.
// As cores entram em espaço linear e a conversão para sRGB fica no fim (colorspace_fragment).

/** Piso de cada cômodo: grade de 0,5 m antisserrilhada com fwidth + onda de alerta animada. */
export const floorVertexShader = /* glsl */ `
  uniform vec2 uRoomCenter;
  varying vec2 vMapPos;

  void main() {
    // O plano é criado no plano XY e girado -90° em X: (x, y) local = (x, y) na planta
    vMapPos = uRoomCenter + position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const floorFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLineColor;
  uniform float uTime;
  uniform float uHighlight;
  uniform float uAlert;
  uniform vec2 uAlertCenter;
  varying vec2 vMapPos;

  float gridLine(vec2 p, float spacing) {
    vec2 cell = p / spacing;
    // fwidth = quanto a coordenada muda entre pixels vizinhos -> linha com ~1 px em qualquer zoom
    vec2 g = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
    return 1.0 - clamp(min(g.x, g.y), 0.0, 1.0);
  }

  void main() {
    vec3 color = uColor;
    color = mix(color, uLineColor, gridLine(vMapPos, 0.5) * 0.45);
    color += uHighlight * vec3(0.05, 0.11, 0.20);

    if (uAlert > 0.5) {
      float d = distance(vMapPos, uAlertCenter);
      float wave = 0.5 + 0.5 * sin(d * 9.0 - uTime * 5.0);
      float falloff = exp(-d * 0.8);
      color = mix(color, vec3(0.86, 0.15, 0.15), clamp(wave * falloff * 0.7 + 0.10, 0.0, 1.0));
    }

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Varredura do LiDAR em volta do robô + anel na distância do obstáculo mais próximo (dado do /scan). */
export const lidarVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const lidarFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uObstacle;
  uniform vec3 uBeamColor;
  uniform vec3 uObstacleColor;
  varying vec2 vUv;

  const float TAU = 6.2831853;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uRadius;   // metros, robô no centro, frente = +x
    float r = length(p);
    float angle = atan(p.y, p.x);
    float sweep = mod(uTime * 2.4, TAU);
    float behind = mod(sweep - angle + TAU, TAU);        // quanto o feixe já passou deste ponto
    float beam = exp(-behind * 2.0) * (1.0 - smoothstep(uRadius * 0.7, uRadius, r));
    float obstacle = uObstacle > 0.0 ? 1.0 - smoothstep(0.0, 0.05, abs(r - uObstacle)) : 0.0;
    float edge = (1.0 - smoothstep(0.0, 0.03, abs(r - uRadius * 0.98))) * 0.25;

    float alpha = clamp(beam * 0.5 + obstacle * 0.9 + edge, 0.0, 1.0);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uBeamColor * (beam + edge) + uObstacleColor * obstacle, alpha);
    #include <colorspace_fragment>
  }
`;
