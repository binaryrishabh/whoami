import * as THREE from 'three';
import { Effect, EffectAttribute, KawaseBlurPass, KernelSize } from 'postprocessing';

/**
 * The miniature look, cheaply: one soft, half-resolution blur of the frame, mixed back in by how far
 * each pixel sits from the plane in focus. Near and far both melt; the island you are looking at stays
 * sharp, like a model photographed with a tilt-shift lens.
 */
const fragment = /* glsl */ `
  uniform sampler2D blurBuffer;
  uniform float focus, range;
  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    float z = -getViewZ(depth);
    float off = abs(z - focus);
    float coc = smoothstep(range * 0.45, range * 1.6, off);
    coc = max(coc, step(0.99999, depth));            // the open sky is always soft
    vec4 b = texture2D(blurBuffer, uv);
    outputColor = vec4(mix(inputColor.rgb, b.rgb, coc), inputColor.a);
  }
`;

export class MiniatureBlurEffect extends Effect {
  private blur: KawaseBlurPass;
  private target: THREE.WebGLRenderTarget;

  constructor() {
    super('MiniatureBlurEffect', fragment, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([['blurBuffer', new THREE.Uniform(null)], ['focus', new THREE.Uniform(20)], ['range', new THREE.Uniform(10)]]),
    });
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.target.texture.name = 'MiniatureBlur.Blurred';
    this.blur = new KawaseBlurPass({ kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
    this.uniforms.get('blurBuffer')!.value = this.target.texture;
  }

  set focus(v: number) { this.uniforms.get('focus')!.value = v; }
  set range(v: number) { this.uniforms.get('range')!.value = v; }

  override initialize(renderer: THREE.WebGLRenderer, alpha: boolean, frameBufferType: number) {
    this.blur.initialize(renderer, alpha, frameBufferType);
    if (frameBufferType !== undefined) this.target.texture.type = frameBufferType as THREE.TextureDataType;
  }

  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    this.blur.render(renderer, inputBuffer, this.target);
  }

  override setSize(width: number, height: number) {
    this.blur.setSize(width, height);
    this.target.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  }

  override dispose() { this.blur.dispose(); this.target.dispose(); super.dispose(); }
}
