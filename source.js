"use strict"

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    console.error('WebGL 2 não suportado');
}

// Vertex Shader
const vsSource = `#version 300 es
    in vec4 a_position;
    void main() {
        gl_Position = a_position;
    }
`;

// Fragment Shader
const fsSource = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;

#define BUTTERFLY_COUNT_X 5  // Número de borboletas no eixo X
#define BUTTERFLY_COUNT_Z 2  // Número de borboletas no eixo Z
#define BUTTERFLY_COUNT_Y 2  // Camadas no eixo Y
#define TOTAL_BUTTERFLIES (BUTTERFLY_COUNT_X * BUTTERFLY_COUNT_Z * BUTTERFLY_COUNT_Y)

// Funções de distância
float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

float sdBox(vec3 p, vec3 size) {
    vec3 d = abs(p) - size;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float sdPlane(vec3 p, vec3 normal, float height) {
    return dot(p, normal) + height;
}

float sdBoxFrame(vec3 p, vec3 b, float e) {
    p = abs(p)-b;
    vec3 q = abs(p+e)-e;
    return min(min(
        length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
        length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
        length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

float sdVesicaSegment(vec3 p, vec3 a, vec3 b, float w) {
    vec3 c = (a+b)*0.3;
    float l = length(b-a);
    vec3 v = (b-a)/l;
    float y = dot(p-c,v);
    vec2 q = vec2(length(p-c-y*v),abs(y));
    
    float r = 0.5*l;
    float d = 0.5*(r*r-w*w)/w;
    vec3 h = (r*q.x<d*(q.y-r)) ? vec3(0.0,r,0.0) : vec3(-d,0.0,d+w);
 
    return length(q-h.xy) - h.z;
}

// Operações booleanas
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

float opSubtraction(float d1, float d2) {
    return max(d1, -d2);
}

float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

// Função de rotação
vec3 rotateY(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(
        c * p.x - s * p.z,
        p.y,
        s * p.x + c * p.z
    );
}

// Função da borboleta
float sdButterflyWings(vec3 p, float size, float thickness, float time) {
    float wingFlap = sin(time * 2.5) * 0.5;
    float wingCurve = cos(time * 1.7) * 0.3;
    
    vec3 topWingLeft = vec3(-size*1.5, size*0.8 + wingFlap, wingCurve);
    vec3 topWingRight = vec3(size*1.5, size*0.8 + wingFlap, wingCurve);
    vec3 bottomWingLeft = vec3(-size*1.2, -size*0.6 - wingFlap*0.7, -wingCurve);
    vec3 bottomWingRight = vec3(size*1.2, -size*0.6 - wingFlap*0.7, -wingCurve);
    vec3 center = vec3(0.0);
    
    float topLeft = sdVesicaSegment(p, center, topWingLeft, thickness);
    float topRight = sdVesicaSegment(p, center, topWingRight, thickness);
    float bottomLeft = sdVesicaSegment(p, center, bottomWingLeft, thickness);
    float bottomRight = sdVesicaSegment(p, center, bottomWingRight, thickness);
    
    return min(min(topLeft, topRight), min(bottomLeft, bottomRight));
}

float rand(float n) {
    return fract(sin(n)*753.5453123);
}

// Função de distância da cena
float scene(vec3 p) {
    float finalDist = 1000.0;
    
    for(int zi = 0; zi < BUTTERFLY_COUNT_Z; zi++) {
        for(int xi = 0; xi < BUTTERFLY_COUNT_X; xi++) {
            for(int yi = 0; yi < BUTTERFLY_COUNT_Y; yi++) {
                int i = zi * BUTTERFLY_COUNT_X * BUTTERFLY_COUNT_Y + xi * BUTTERFLY_COUNT_Y + yi;
                
                // Posição X distribuída uniformemente
                float xPos = mix(-5.0, 5.0, float(xi)/float(BUTTERFLY_COUNT_X-1));
                
                // Posição Z em camadas
                float zPos = -5.0 - float(zi) * 2.5;
                
                // Posição Y com mais borboletas na parte superior (0 a 4)
                float yBase = pow(float(yi)/float(BUTTERFLY_COUNT_Y-1), 0.5) * 4.0;
                float yPos = yBase + sin(u_time * (0.5 + rand(float(i))*0.3)) * 0.8;
                
                vec3 butterflyPos = p - vec3(xPos, yPos, zPos);
                butterflyPos = rotateY(butterflyPos, u_time * (0.3 + rand(float(i)+1.0)*0.5));
                
                float size = 0.4;
                float butterfly = sdButterflyWings(butterflyPos, size, 0.08, 0.0);
                
                finalDist = min(finalDist, butterfly);
            }
        }
    }

    float plane = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0);
    return opSubtraction(finalDist, plane);
}

vec3 getObjectColor(vec3 p) {
    for(int zi = 0; zi < BUTTERFLY_COUNT_Z; zi++) {
        for(int xi = 0; xi < BUTTERFLY_COUNT_X; xi++) {
            for(int yi = 0; yi < BUTTERFLY_COUNT_Y; yi++) {
                int i = zi * BUTTERFLY_COUNT_X * BUTTERFLY_COUNT_Y + xi * BUTTERFLY_COUNT_Y + yi;
                
                float xPos = mix(-5.0, 5.0, float(xi)/float(BUTTERFLY_COUNT_X-1));
                float zPos = -5.0 - float(zi) * 2.5;
                float yBase = pow(float(yi)/float(BUTTERFLY_COUNT_Y-1), 0.5) * 4.0;
                float yPos = yBase + sin(u_time * (0.5 + rand(float(i))*0.3)) * 0.8;
                
                vec3 butterflyPos = p - vec3(xPos, yPos, zPos);
                butterflyPos = rotateY(butterflyPos, u_time * (0.3 + rand(float(i)+1.0)*0.5));
                float size = 0.4;
                float butterfly = sdButterflyWings(butterflyPos, size, 0.08, 0.0);
                
                if(butterfly < 0.01) {
                    float hueVariation = rand(float(i)+3.0) * 0.2;
                    return vec3(0.2-hueVariation, 0.4, 0.9+hueVariation);
                }
            }
        }
    }
    return vec3(1.0);
}

// Ray Marching
float rayMarch(vec3 ro, vec3 rd, float maxDist, float eps) {
    float dist = 0.0;
    for (int i = 0; i < 256; i++) {
        vec3 p = ro + dist * rd;
        float d = scene(p);
        if (d < eps * 0.5) return dist;
        dist += d;
        if (dist >= maxDist) break;
    }
    return -1.0;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.0));
    float maxDist = 100.0;
    float eps = 0.001;
    float dist = rayMarch(ro, rd, maxDist, eps);

    if (dist > -0.5) {
        vec3 p = ro + dist * rd;
        vec3 objectColor = getObjectColor(p);
        vec3 normal = normalize(vec3(
            scene(p + vec3(eps, 0.0, 0.0)) - scene(p - vec3(eps, 0.0, 0.0)),
            scene(p + vec3(0.0, eps, 0.0)) - scene(p - vec3(0.0, eps, 0.0)),
            scene(p + vec3(0.0, 0.0, eps)) - scene(p - vec3(0.0, 0.0, eps))
        ));
        vec3 lightDir = normalize(vec3(10.0, 10.0, 10.0));
        float diff = max(dot(normal, lightDir), 0.0);
        outColor = vec4(objectColor * diff, 1.0);
    } else {
        outColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
}
`;

// Compilar Shaders
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Erro ao compilar shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

// Criar Programa
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Erro ao linkar programa:', gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// Configurar Geometria
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positions = [
    -1, -1,
     1, -1,
    -1,  1,
     1,  1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// Configurar Uniforms
const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
const timeUniformLocation = gl.getUniformLocation(program, 'u_time');

gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);

// Renderizar
function render(time) {
    time *= 0.001; // Converter para segundos

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform1f(timeUniformLocation, time);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);