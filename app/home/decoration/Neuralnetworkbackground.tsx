'use client';

import { useEffect, useRef } from 'react';

export default function NeuralNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;
    let renderer: any, composer: any, controls: any, clock: any;
    let nodesMesh: any = null;
    let connectionsMesh: any = null;
    let starField: any = null;
    let scene: any, camera: any;
    let THREE: any, OrbitControls: any, EffectComposer: any, RenderPass: any, UnrealBloomPass: any, OutputPass: any;

    const canvas = canvasRef.current;

    async function init() {
      // Dynamic imports to avoid SSR issues
      THREE = await import('three');
      const addons = await import('three/addons/controls/OrbitControls.js' as any);
      const ec = await import('three/addons/postprocessing/EffectComposer.js' as any);
      const rp = await import('three/addons/postprocessing/RenderPass.js' as any);
      const bp = await import('three/addons/postprocessing/UnrealBloomPass.js' as any);
      const op = await import('three/addons/postprocessing/OutputPass.js' as any);

      OrbitControls = addons.OrbitControls;
      EffectComposer = ec.EffectComposer;
      RenderPass = rp.RenderPass;
      UnrealBloomPass = bp.UnrealBloomPass;
      OutputPass = op.OutputPass;

      const BG_COLOR = 0x030712;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(BG_COLOR);
      scene.fog = new THREE.FogExp2(BG_COLOR, 0.002);

      camera = new THREE.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
      camera.position.set(0, 8, 28);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,          // no transparency — we own the background
      });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(BG_COLOR, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;

      // Starfield
      const count = 5000;
      const positions: number[] = [];
      const colors: number[] = [];
      const sizes: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = THREE.MathUtils.randFloat(50, 150);
        const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
        const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
        const colorChoice = Math.random();
        if (colorChoice < 0.7) colors.push(1, 1, 1);
        else if (colorChoice < 0.85) colors.push(0.7, 0.8, 1);
        else colors.push(1, 0.9, 0.8);
        sizes.push(THREE.MathUtils.randFloat(0.1, 0.25));
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      starGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      starGeo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      const starMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uTime;
          void main() {
            vColor = color;
            vec4 mvp = modelViewMatrix * vec4(position, 1.0);
            float tw = sin(uTime * 2.0 + position.x * 100.0) * 0.3 + 0.7;
            gl_PointSize = size * tw * (300.0 / -mvp.z);
            gl_Position = projectionMatrix * mvp;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            vec2 c = gl_PointCoord - 0.5; float d = length(c);
            if (d > 0.5) discard;
            float a = 1.0 - smoothstep(0.0, 0.5, d);
            gl_FragColor = vec4(vColor, a * 0.6);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
        1.4,   // strength
        0.4,   // radius
        0.85   // threshold — higher = less bleed into dark areas
      );
      bloom.clearColor = new THREE.Color(BG_COLOR);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      // Brand color palette — #FB2B37 based
      const palette = [
        new THREE.Color(0xFB2B37), // primary brand red
        new THREE.Color(0x460808), // darker red
        new THREE.Color(0xFFA1A3), // light pink-red
        new THREE.Color(0xC41520), // deep crimson
        new THREE.Color(0xFF9BA0), // soft rose
      ];

      // Generate network
      const { nodes } = generateNetwork(palette, THREE);

      // Build node mesh
      const nodePositions: number[] = [];
      const nodeTypes: number[] = [];
      const nodeSizes: number[] = [];
      const nodeColors: number[] = [];
      const distancesFromRoot: number[] = [];

      nodes.forEach((node: any) => {
        nodePositions.push(node.position.x, node.position.y, node.position.z);
        nodeTypes.push(node.type);
        nodeSizes.push(node.size);
        distancesFromRoot.push(node.distanceFromRoot);
        const colorIndex = Math.min(node.level, palette.length - 1);
        const c = palette[colorIndex % palette.length].clone();
        c.offsetHSL(
          THREE.MathUtils.randFloatSpread(0.02),
          THREE.MathUtils.randFloatSpread(0.06),
          THREE.MathUtils.randFloatSpread(0.06)
        );
        nodeColors.push(c.r, c.g, c.b);
      });

      const nodesGeo = new THREE.BufferGeometry();
      nodesGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
      nodesGeo.setAttribute('nodeType', new THREE.Float32BufferAttribute(nodeTypes, 1));
      nodesGeo.setAttribute('nodeSize', new THREE.Float32BufferAttribute(nodeSizes, 1));
      nodesGeo.setAttribute('nodeColor', new THREE.Float32BufferAttribute(nodeColors, 3));
      nodesGeo.setAttribute('distanceFromRoot', new THREE.Float32BufferAttribute(distancesFromRoot, 1));

      // Shared pulse state — 3 simultaneous pulses cycling
      const pulseUniforms = {
        uTime:           { value: 0.0 },
        uBaseNodeSize:   { value: 0.55 },
        uPulsePositions: { value: [
          new THREE.Vector3(1e4, 1e4, 1e4),
          new THREE.Vector3(1e4, 1e4, 1e4),
          new THREE.Vector3(1e4, 1e4, 1e4),
        ]},
        uPulseTimes:     { value: [-1e4, -1e4, -1e4] },
        uPulseColors:    { value: [
          new THREE.Color(0xFB2B37),
          new THREE.Color(0xFF6B73),
          new THREE.Color(0xFFFFFF),
        ]},
        uPulseSpeed:     { value: 16.0 },
      };

      const nodesMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(pulseUniforms),
        vertexShader: `
          attribute float nodeSize; attribute float nodeType; attribute vec3 nodeColor; attribute float distanceFromRoot;
          uniform float uTime; uniform float uBaseNodeSize;
          uniform vec3 uPulsePositions[3];
          uniform float uPulseTimes[3];
          uniform float uPulseSpeed;
          varying vec3 vColor; varying float vGlow; varying float vPulse;

          float getPulse(vec3 worldPos, vec3 pPos, float pTime) {
            if (pTime < -999.0) return 0.0;
            float dt = uTime - pTime;
            if (dt < 0.0 || dt > 4.0) return 0.0;
            float radius = dt * uPulseSpeed;
            float dist = distance(worldPos, pPos);
            float prox = abs(dist - radius);
            return smoothstep(3.0, 0.0, prox) * smoothstep(4.0, 0.0, dt);
          }

          void main() {
            vColor = nodeColor;
            float breathe = sin(uTime * 0.7 + distanceFromRoot * 0.15) * 0.12 + 0.88;
            vGlow = 0.5 + 0.5 * sin(uTime * 0.5 + distanceFromRoot * 0.2);
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            float p = 0.0;
            for (int i = 0; i < 3; i++) p += getPulse(wp, uPulsePositions[i], uPulseTimes[i]);
            vPulse = min(p, 1.0);
            float sz = nodeSize * breathe * (1.0 + vPulse * 2.2);
            vec4 mvp = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = sz * uBaseNodeSize * (1000.0 / -mvp.z);
            gl_Position = projectionMatrix * mvp;
          }`,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uPulseColors[3];
          varying vec3 vColor; varying float vGlow; varying float vPulse;
          void main() {
            vec2 c = 2.0 * gl_PointCoord - 1.0; float d = length(c);
            if (d > 1.0) discard;
            float g1 = 1.0 - smoothstep(0.0, 0.5, d);
            float g2 = 1.0 - smoothstep(0.0, 1.0, d);
            float gs = pow(g1, 1.2) + g2 * 0.3;
            vec3 fc = vColor * (0.9 + 0.1 * vGlow);
            if (vPulse > 0.0) {
              fc = mix(fc, uPulseColors[0] * 1.5, vPulse * 0.75);
              gs *= (1.0 + vPulse * 1.0);
            }
            fc += vec3(1.0) * smoothstep(0.4, 0.0, d) * 0.3;
            float alpha = gs * (0.9 - 0.3 * d);
            gl_FragColor = vec4(fc, alpha);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });

      nodesMesh = new THREE.Points(nodesGeo, nodesMat);
      scene.add(nodesMesh);

      // Build connections mesh
      const connPositions: number[] = [];
      const connColors: number[] = [];
      const connStrengths: number[] = [];
      const startPoints: number[] = [];
      const endPoints: number[] = [];
      const pathIndices: number[] = [];
      const processed = new Set<string>();
      let pathIdx = 0;

      nodes.forEach((node: any, ni: number) => {
        node.connections.forEach((conn: any) => {
          const ci = nodes.indexOf(conn.node);
          if (ci === -1) return;
          const key = [Math.min(ni, ci), Math.max(ni, ci)].join('-');
          if (!processed.has(key)) {
            processed.add(key);
            const numSeg = 18;
            for (let i = 0; i < numSeg; i++) {
              const t = i / (numSeg - 1);
              connPositions.push(t, 0, 0);
              startPoints.push(node.position.x, node.position.y, node.position.z);
              endPoints.push(conn.node.position.x, conn.node.position.y, conn.node.position.z);
              pathIndices.push(pathIdx);
              connStrengths.push(conn.strength);
              const avgLvl = Math.min(Math.floor((node.level + conn.node.level) / 2), palette.length - 1);
              const c = palette[avgLvl % palette.length].clone();
              c.offsetHSL(0, THREE.MathUtils.randFloatSpread(0.06), THREE.MathUtils.randFloatSpread(0.06));
              connColors.push(c.r, c.g, c.b);
            }
            pathIdx++;
          }
        });
      });

      const connGeo = new THREE.BufferGeometry();
      connGeo.setAttribute('position', new THREE.Float32BufferAttribute(connPositions, 3));
      connGeo.setAttribute('startPoint', new THREE.Float32BufferAttribute(startPoints, 3));
      connGeo.setAttribute('endPoint', new THREE.Float32BufferAttribute(endPoints, 3));
      connGeo.setAttribute('connectionStrength', new THREE.Float32BufferAttribute(connStrengths, 1));
      connGeo.setAttribute('connectionColor', new THREE.Float32BufferAttribute(connColors, 3));
      connGeo.setAttribute('pathIndex', new THREE.Float32BufferAttribute(pathIndices, 1));

      const connMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(pulseUniforms),
        vertexShader: `
          attribute vec3 startPoint; attribute vec3 endPoint;
          attribute float connectionStrength; attribute float pathIndex; attribute vec3 connectionColor;
          uniform float uTime;
          uniform vec3 uPulsePositions[3];
          uniform float uPulseTimes[3];
          uniform float uPulseSpeed;
          varying vec3 vColor; varying float vConnectionStrength; varying float vPathPosition; varying float vPulse;

          float getPulse(vec3 worldPos, vec3 pPos, float pTime) {
            if (pTime < -999.0) return 0.0;
            float dt = uTime - pTime;
            if (dt < 0.0 || dt > 4.0) return 0.0;
            float radius = dt * uPulseSpeed;
            float dist = distance(worldPos, pPos);
            float prox = abs(dist - radius);
            return smoothstep(3.0, 0.0, prox) * smoothstep(4.0, 0.0, dt);
          }

          void main() {
            float t = position.x; vPathPosition = t;
            vec3 mid = mix(startPoint, endPoint, 0.5);
            vec3 perp = normalize(cross(normalize(endPoint - startPoint), vec3(0.0,1.0,0.0)));
            if (length(perp) < 0.1) perp = vec3(1.0,0.0,0.0);
            mid += perp * sin(t * 3.14159) * 0.12;
            vec3 p0 = mix(startPoint, mid, t);
            vec3 p1 = mix(mid, endPoint, t);
            vec3 finalPos = mix(p0, p1, t);
            vec3 wp = (modelMatrix * vec4(finalPos, 1.0)).xyz;
            float p = 0.0;
            for (int i = 0; i < 3; i++) p += getPulse(wp, uPulsePositions[i], uPulseTimes[i]);
            vPulse = min(p, 1.0);
            vColor = connectionColor; vConnectionStrength = connectionStrength;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
          }`,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uPulseColors[3];
          varying vec3 vColor; varying float vConnectionStrength; varying float vPathPosition; varying float vPulse;
          void main() {
            float flow1 = sin(vPathPosition * 22.0 - uTime * 3.5) * 0.5 + 0.5;
            float flow2 = sin(vPathPosition * 14.0 - uTime * 2.2 + 1.57) * 0.5 + 0.5;
            float combined = (flow1 + flow2 * 0.5) / 1.5;
            vec3 fc = vColor * (0.8 + 0.2 * sin(uTime * 0.6 + vPathPosition * 10.0));
            if (vPulse > 0.0) {
              fc = mix(fc, uPulseColors[0] * 1.3, vPulse * 0.65);
              combined += vPulse * 0.6;
            }
            fc *= (0.7 + 0.4 * combined * vConnectionStrength + vConnectionStrength * 0.4);
            float alpha = (0.6 * vConnectionStrength + combined * 0.25);
            alpha = mix(alpha, min(1.0, alpha * 2.2), vPulse);
            gl_FragColor = vec4(fc, alpha);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });

      connectionsMesh = new THREE.LineSegments(connGeo, connMat);
      scene.add(connectionsMesh);

      clock = new THREE.Clock();

      // Pulse interaction setup
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const interactionPlane = new THREE.Plane();
      const interactionPoint = new THREE.Vector3();
      let lastPulseIndex = 0;

      // Drag vs tap disambiguation
      let pointerDownX = 0;
      let pointerDownY = 0;
      const DRAG_THRESHOLD = 6; // px

      function triggerPulse(clientX: number, clientY: number) {
        const rect = canvas.getBoundingClientRect();
        pointer.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        pointer.y = -((clientY - rect.top)  / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);

        // Interaction plane faces the camera at the network's rough depth
        interactionPlane.normal.copy(camera.position).normalize();
        interactionPlane.constant = -(
          interactionPlane.normal.dot(camera.position) - camera.position.length() * 0.5
        );

        if (!raycaster.ray.intersectPlane(interactionPlane, interactionPoint)) return;

        const t = clock.getElapsedTime();
        lastPulseIndex = (lastPulseIndex + 1) % 3;

        // Pick a random brand-toned pulse color
        const pulseColors = [
          new THREE.Color(0xFB2B37),
          new THREE.Color(0xFF6B73),
          new THREE.Color(0xFFFFFF),
          new THREE.Color(0xFF9BA0),
        ];
        const randColor = pulseColors[Math.floor(Math.random() * pulseColors.length)];

        for (const mesh of [nodesMesh, connectionsMesh]) {
          if (!mesh) continue;
          mesh.material.uniforms.uPulsePositions.value[lastPulseIndex].copy(interactionPoint);
          mesh.material.uniforms.uPulseTimes.value[lastPulseIndex] = t;
          mesh.material.uniforms.uPulseColors.value[0].copy(randColor);
        }
      }

      // Mouse
      canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
      });
      canvas.addEventListener('pointerup', (e: PointerEvent) => {
        const dx = Math.abs(e.clientX - pointerDownX);
        const dy = Math.abs(e.clientY - pointerDownY);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
          triggerPulse(e.clientX, e.clientY);
        }
      });

      // Touch
      canvas.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 0) {
          pointerDownX = e.touches[0].clientX;
          pointerDownY = e.touches[0].clientY;
        }
      }, { passive: true });
      canvas.addEventListener('touchend', (e: TouchEvent) => {
        if (e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          const dx = Math.abs(t.clientX - pointerDownX);
          const dy = Math.abs(t.clientY - pointerDownY);
          if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
            triggerPulse(t.clientX, t.clientY);
          }
        }
      }, { passive: true });

      function animate() {
        animationId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        if (nodesMesh) {
          nodesMesh.material.uniforms.uTime.value = t;
          nodesMesh.rotation.y = Math.sin(t * 0.04) * 0.05;
        }
        if (connectionsMesh) {
          connectionsMesh.material.uniforms.uTime.value = t;
          connectionsMesh.rotation.y = Math.sin(t * 0.04) * 0.05;
        }
        starField.rotation.y += 0.0001;
        starField.material.uniforms.uTime.value = t;
        controls.update();
        composer.render();
      }

      animate();

      function onResize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloom.resolution.set(w, h);
      }
      window.addEventListener('resize', onResize);

      cleanupRef.current = () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        nodesGeo.dispose();
        nodesMat.dispose();
        connGeo.dispose();
        connMat.dispose();
      };
    }

    init().catch(console.error);

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-crosshair"
      style={{ display: 'block' }}
    />
  );
}

function generateNetwork(palette: any[], THREE: any) {
  const nodes: any[] = [];

  class Node {
    position: any;
    connections: any[];
    level: number;
    type: number;
    size: number;
    distanceFromRoot: number;

    constructor(position: any, level = 0, type = 0) {
      this.position = position;
      this.connections = [];
      this.level = level;
      this.type = type;
      this.size = type === 0
        ? THREE.MathUtils.randFloat(0.8, 1.4)
        : THREE.MathUtils.randFloat(0.5, 1.0);
      this.distanceFromRoot = 0;
    }

    addConnection(node: any, strength = 1.0) {
      if (!this.isConnectedTo(node)) {
        this.connections.push({ node, strength });
        node.connections.push({ node: this, strength });
      }
    }

    isConnectedTo(node: any) {
      return this.connections.some((c: any) => c.node === node);
    }
  }

  const rootNode = new Node(new THREE.Vector3(0, 0, 0), 0, 0);
  rootNode.size = 2.0;
  nodes.push(rootNode);

  const layers = 5;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let layer = 1; layer <= layers; layer++) {
    const radius = layer * 4;
    const numPoints = Math.floor(layer * 10);
    for (let i = 0; i < numPoints; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
      const theta = 2 * Math.PI * i / goldenRatio;
      const pos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
      const isLeaf = layer === layers || Math.random() < 0.3;
      const node = new Node(pos, layer, isLeaf ? 1 : 0);
      node.distanceFromRoot = radius;
      nodes.push(node);

      if (layer > 1) {
        const prevLayerNodes = nodes.filter((n: any) => n.level === layer - 1 && n !== rootNode);
        prevLayerNodes.sort((a: any, b: any) => pos.distanceTo(a.position) - pos.distanceTo(b.position));
        for (let j = 0; j < Math.min(3, prevLayerNodes.length); j++) {
          const dist = pos.distanceTo(prevLayerNodes[j].position);
          node.addConnection(prevLayerNodes[j], Math.max(0.3, 1.0 - dist / (radius * 2)));
        }
      } else {
        rootNode.addConnection(node, 0.9);
      }
    }

    const layerNodes = nodes.filter((n: any) => n.level === layer && n !== rootNode);
    for (let i = 0; i < layerNodes.length; i++) {
      const node = layerNodes[i];
      const nearby = layerNodes
        .filter((n: any) => n !== node)
        .sort((a: any, b: any) => node.position.distanceTo(a.position) - node.position.distanceTo(b.position))
        .slice(0, 4);
      for (const nearNode of nearby) {
        if (node.position.distanceTo(nearNode.position) < radius * 0.8) {
          node.addConnection(nearNode, 0.5);
        }
      }
    }
  }

  return { nodes };
}