# Saccade-Conditioned Image Visualization Tool

## Intent

This is a personal research translation project designed to build a scientifically credible interactive visualization inspired by vision neuroscience research on active sensing.

The goal is NOT to build a commercial product or flashy AI demo.

The goal is to create a computational visualization that helps explore how a simulated saccade vector (direction and amplitude) could bias spatial-frequency emphasis in visual input.

The tool should support:

- qualitative hypothesis exploration  
- intuition building  
- research communication  

It will be shown directly to a vision neuroscientist.

---

## Context — Product Experience

Build a single-page web application.

Technology constraints:

- HTML  
- CSS  
- JavaScript  
- No backend  
- No database  
- No authentication  

User workflow:

1. User uploads an image or selects built-in sample images.
2. User adjusts **saccade direction** using a visual control (dial or draggable arrow).
3. User adjusts **saccade amplitude** using a slider.
4. The system computes a direction-conditioned transformation.
5. Visualization updates in real time.

---

## Visualization Requirements

The page must be visualization-heavy.

Include:

- Original image panel  
- Processed image panel  
- Directional edge/detail map  
- Difference or frequency emphasis map  
- Optional comparison slider  

The processed output must depend strongly on:

- image content  
- saccade direction  
- saccade amplitude  

Behavior constraints:

- Changing direction rotates orientation of enhancement  
- Changing amplitude scales strength of modulation  
- Different images must produce different outputs  

The effect must feel like **targeted perceptual detail modulation**, not a generic sharpen filter.

---

## Data Requirements

No neural dataset required.

However include built-in **sample image dataset**:

- natural scene  
- object or face  
- high-texture image  

Store inside `/assets`.

---

## Processing Pipeline Expectations

Use lightweight interpretable methods:

- directional convolution kernels  
- Sobel / Scharr gradients  
- anisotropic sharpening  
- local high-frequency estimation  

Structure as multi-stage pipeline:

1. feature extraction  
2. directional weighting  
3. amplitude scaling  
4. reconstruction / blending  
5. diagnostic visualization  

---

## Scientific Framing

Include one restrained statement on page:

> This interface is a conceptual visualization inspired by research on perceptual enhancement and suppression during active sensing. It is intended for hypothesis exploration rather than neural simulation.

Avoid:

- bullet lists explaining neuroscience  
- marketing language  
- claims of biological accuracy  

---

## Visual Design Constraints

- dark lab interface  
- large central visualization  
- subtle panel borders  
- minimal animation  
- restrained typography  
- no gradients  
- desktop-first layout  

The UI must feel **custom lab-built**.

---

## Architecture

Minimal file structure:
