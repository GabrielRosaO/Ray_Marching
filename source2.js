"use strict";

        const canvas = document.getElementById('canvas');
        const gl = canvas.getContext('webgl2');

        if (!gl) {
            alert('WebGL 2 não suportado no seu navegador');
            throw new Error('WebGL 2 não suportado');
        }

        // Ajustar tamanho do canvas
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Vertex Shader
        const vsSource = `#version 300 es
            in vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        // Fragment Shader com borboletas realistas
        const fsSource = `#version 300 es
        precision highp float;
        out vec4 outColor;

        uniform vec2 u_resolution;
        uniform float u_time;

        #define BUTTERFLY_COUNT 15
        #define PI 3.14159265359

        // Funções de distância
        float sdSphere(vec3 p, float r) { return length(p) - r; }
        float sdCylinder(vec3 p, float h, float r) {
            vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
            return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
        }

        // Função para criar asas de borboleta
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

        // Função da borboleta completa
        float sdButterflyWings(vec3 p, float size, float thickness, float time) {
            float wingFlap = sin(time * 3.0) * 0.5;
            float wingCurve = cos(time * 2.0) * 0.3;
            
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

        // Função de ruído para variação
        float rand(float n) { return fract(sin(n) * 43758.5453); }

        // Função de distância da cena
        float scene(vec3 p) {
            // Poste de luz (cilindro + esfera no topo)
            float pole = sdCylinder(p - vec3(0.0, -1.0, 0.0), 1.5, 0.1);
            float lamp = sdSphere(p - vec3(0.0, 0.5, 0.0), 0.3);
            float light = min(pole, lamp);
            
            // Borboletas voando ao redor do poste
            float butterflyDist = 1000.0;
            for(int i = 0; i < BUTTERFLY_COUNT; i++) {
                float angle = float(i) * 2.0 * PI / float(BUTTERFLY_COUNT) + u_time * (0.3 + rand(float(i))*0.2);
                float radius = 1.5 + rand(float(i)*10.0) * 0.8;
                float height = 0.5 + sin(u_time * (0.5 + rand(float(i)*2.0)*0.3)) * 0.8;
                
                vec3 bPos = vec3(cos(angle) * radius, height, sin(angle) * radius);
                vec3 bRotPos = p - bPos;
                bRotPos = vec3(
                    bRotPos.x * cos(angle) - bRotPos.z * sin(angle),
                    bRotPos.y,
                    bRotPos.x * sin(angle) + bRotPos.z * cos(angle)
                );
                
                float size = 0.1 + rand(float(i)*5.0) * 0.05;
                float butterfly = sdButterflyWings(bRotPos, size, 0.03, u_time * 2.0 + float(i));
                
                butterflyDist = min(butterflyDist, butterfly);
            }
            
            return min(light, butterflyDist);
        }

        // Cor dos objetos
        vec3 getColor(vec3 p) {
            // Cor do poste
            float pole = sdCylinder(p - vec3(0.0, -1.0, 0.0), 1.5, 0.1);
            if(pole < 0.01) return vec3(0.3, 0.3, 0.3);
            
            // Cor da lâmpada
            float lamp = sdSphere(p - vec3(0.0, 0.5, 0.0), 0.3);
            if(lamp < 0.01) {
                float glow = 0.05 / (0.01 + lamp * lamp);
                return vec3(1.0, 0.9, 0.7) * (1.0 + glow * 3.0);
            }
            
            // Cor das borboletas
            for(int i = 0; i < BUTTERFLY_COUNT; i++) {
                float angle = float(i) * 2.0 * PI / float(BUTTERFLY_COUNT) + u_time * (0.3 + rand(float(i))*0.2);
                float radius = 1.5 + rand(float(i)*10.0) * 0.8;
                float height = 0.5 + sin(u_time * (0.5 + rand(float(i)*2.0)*0.3)) * 0.8;
                
                vec3 bPos = vec3(cos(angle) * radius, height, sin(angle) * radius);
                vec3 bRotPos = p - bPos;
                bRotPos = vec3(
                    bRotPos.x * cos(angle) - bRotPos.z * sin(angle),
                    bRotPos.y,
                    bRotPos.x * sin(angle) + bRotPos.z * cos(angle)
                );
                
                float size = 0.1 + rand(float(i)*5.0) * 0.05;
                float butterfly = sdButterflyWings(bRotPos, size, 0.03, u_time * 2.0 + float(i));
                
                if(butterfly < 0.01) {
                    float hue = rand(float(i)*3.0);
                    vec3 wingColor = mix(vec3(0.2, 0.4, 0.9), vec3(0.9, 0.4, 0.2), hue);
                    
                    // Adicionar padrão nas asas
                    //float pattern = sin(bRotPos.x * 50.0) * sin(bRotPos.y * 50.0);
                    //wingColor = mix(wingColor, vec3(1.0), smoothstep(0.3, 0.8, pattern) * 0.3);
                    
                    return wingColor;
                }
            }
            
            // Cor do chão
            return vec3(0.2, 0.2, 0.25);
        }

        // Ray Marching
        float rayMarch(vec3 ro, vec3 rd, float maxDist, float eps) {
            float dist = 0.0;
            for(int i = 0; i < 100; i++) {
                vec3 p = ro + dist * rd;
                float d = scene(p);
                if(d < eps || dist > maxDist) break;
                dist += d;
            }
            return dist;
        }

        // Normal calculada
        vec3 getNormal(vec3 p, float eps) {
            vec2 e = vec2(eps, 0);
            return normalize(vec3(
                scene(p + e.xyy) - scene(p - e.xyy),
                scene(p + e.yxy) - scene(p - e.yxy),
                scene(p + e.yyx) - scene(p - e.yyx)
            ));
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
            vec3 ro = vec3(0.0, 0.0, 3.0);
            vec3 rd = normalize(vec3(uv, -1.0));
            
            float maxDist = 100.0;
            float eps = 0.001;
            float dist = rayMarch(ro, rd, maxDist, eps);

            if(dist < maxDist) {
                vec3 p = ro + dist * rd;
                vec3 col = getColor(p);
                vec3 n = getNormal(p, eps);
                
                // Iluminação
                vec3 lightPos = vec3(0.0, 0.5, 0.0);
                vec3 lightDir = normalize(lightPos - p);
                float diff = max(dot(n, lightDir), 0.0);
                
                // Brilho da lâmpada
                float lampDist = sdSphere(p - lightPos, 0.3);
                if(lampDist < 0.3) {
                    float glow = 0.1 / (0.01 + lampDist * lampDist);
                    col += vec3(1.0, 0.9, 0.7) * glow * 0.5;
                }
                
                outColor = vec4(col * (0.5 + 0.5 * diff), 1.0);
            } else {
                // Fundo com gradiente
                vec3 bgColor = mix(vec3(0.1, 0.1, 0.15), vec3(0.05, 0.05, 0.1), uv.y + 0.5);
                outColor = vec4(bgColor, 1.0);
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

        if (!vertexShader || !fragmentShader) {
            throw new Error('Falha ao compilar shaders');
        }

        // Criar e linkar programa
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Erro ao linkar programa:', gl.getProgramInfoLog(program));
            throw new Error('Falha ao linkar programa');
        }

        // Configurar geometria (tela cheia)
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
             1, -1, 1,  1, -1, 1
        ]), gl.STATIC_DRAW);

        // Configurar atributos
        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // Configurar uniforms
        const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
        const timeUniformLocation = gl.getUniformLocation(program, 'u_time');

        // Função de renderização
        function render(time) {
            time *= 0.001; // Converter para segundos
            
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            gl.useProgram(program);
            gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
            gl.uniform1f(timeUniformLocation, time);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            
            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);