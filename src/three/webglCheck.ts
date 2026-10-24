/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks whether WebGL or WebGL2 context can be successfully created in the current browser.
 */
export function isWebGLSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    // Try webgl2 first, then webgl, then experimental-webgl
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    if (!gl) {
      return false;
    }

    // Free probe context if possible
    const webglCtx = gl as WebGLRenderingContext | WebGL2RenderingContext;
    if (typeof webglCtx.getExtension === 'function') {
      const loseContext = webglCtx.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    return true;
  } catch {
    return false;
  }
}
