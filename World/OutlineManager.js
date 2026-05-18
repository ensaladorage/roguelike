import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export class OutlineManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.renderer = scene.renderer;
    this.sceneRoot = scene.scene;
    this.camera = scene.camera;
    this.selectedObjects = [];
    this.enabled = false;

    const defaults = {
      visibleEdgeColor: 0xffdf5d,
      hiddenEdgeColor: 0x000000,
      edgeStrength: 4.0,
      edgeGlow: 0.2,
      edgeThickness: 1.5,
    };

    this.opts = Object.assign({}, defaults, options);

    try {
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.sceneRoot, this.camera);
      this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.sceneRoot, this.camera);
      this.fxaaPass = new ShaderPass(FXAAShader);

      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.outlinePass);
      this.composer.addPass(this.fxaaPass);

      const pixelRatio = Math.min(this.renderer.getPixelRatio() || 1, 2);
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(window.innerWidth, window.innerHeight);

      if (this.fxaaPass && this.fxaaPass.material && this.fxaaPass.material.uniforms && this.fxaaPass.material.uniforms["resolution"]) {
        this.fxaaPass.material.uniforms["resolution"].value.x = 1 / (window.innerWidth * pixelRatio);
        this.fxaaPass.material.uniforms["resolution"].value.y = 1 / (window.innerHeight * pixelRatio);
      }

      // apply style
      this.outlinePass.edgeStrength = this.opts.edgeStrength;
      this.outlinePass.edgeGlow = this.opts.edgeGlow;
      this.outlinePass.edgeThickness = this.opts.edgeThickness;
      this.outlinePass.visibleEdgeColor.setHex(this.opts.visibleEdgeColor);
      this.outlinePass.hiddenEdgeColor.setHex(this.opts.hiddenEdgeColor);

      window.addEventListener("resize", () => this.onResize());
      this.enabled = true;
    } catch (e) {
      console.warn("OutlineManager: composer setup failed", e);
      this.composer = null;
      this.enabled = false;
    }
  }

  setParams(params = {}) {
    if (!this.outlinePass) return;
    if (typeof params.edgeStrength === "number") this.outlinePass.edgeStrength = params.edgeStrength;
    if (typeof params.edgeGlow === "number") this.outlinePass.edgeGlow = params.edgeGlow;
    if (typeof params.edgeThickness === "number") this.outlinePass.edgeThickness = params.edgeThickness;
    if (typeof params.visibleEdgeColor !== "undefined") this.outlinePass.visibleEdgeColor.setHex(params.visibleEdgeColor);
    if (typeof params.hiddenEdgeColor !== "undefined") this.outlinePass.hiddenEdgeColor.setHex(params.hiddenEdgeColor);
  }

  add(object) {
    if (!object) return;
    if (!this.selectedObjects.includes(object)) this.selectedObjects.push(object);
  }

  remove(object) {
    this.selectedObjects = this.selectedObjects.filter(o => o !== object);
  }

  setSelection(objects) {
    this.selectedObjects = Array.isArray(objects) ? objects.slice() : [];
  }

  clear() {
    this.selectedObjects = [];
  }

  onResize() {
    if (!this.composer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pixelRatio = Math.min(this.renderer.getPixelRatio() || 1, 2);
    this.composer.setSize(w, h);
    if (this.fxaaPass && this.fxaaPass.material && this.fxaaPass.material.uniforms && this.fxaaPass.material.uniforms["resolution"]) {
      this.fxaaPass.material.uniforms["resolution"].value.x = 1 / (w * pixelRatio);
      this.fxaaPass.material.uniforms["resolution"].value.y = 1 / (h * pixelRatio);
    }
    try {
      if (this.outlinePass && this.outlinePass.setSize) this.outlinePass.setSize(w, h);
    } catch (e) {}
  }

  render() {
    if (this.composer) {
      this.outlinePass.selectedObjects = this.selectedObjects;
      this.composer.render();
    } else {
      // fallback
      this.renderer.render(this.sceneRoot, this.camera);
    }
  }
}
