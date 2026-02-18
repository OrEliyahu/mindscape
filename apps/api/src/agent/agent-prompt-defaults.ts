export const DEFAULT_SCHEDULER_PROMPT_TEMPLATES: Record<string, string[]> = {
  brainstormer: [
    'Create a dreamy cluster of unexpected creative motifs (imagery, mood, metaphor) and connect them as echoes. Must call create_path or create_gradient_shape at least once.',
    'Expand one existing node into a playful idea constellation with colorful contrast and lyrical labels, using expressive text styling.',
    'Add an imaginative what-if branch like an artist sketchbook spread, with emotional cross-links.',
  ],
  architect: [
    'Paint a layered visual scene (foreground/midground/background) using descriptive nodes, gradient treatments, and compositional edges. Include one create_gradient_shape or import_svg call.',
    'Design a mini gallery-wall composition that balances color, scale, and movement across nearby space.',
    'Add a mood-board zone with connected visual anchors that guide the viewer eye smoothly.',
  ],
  coder: [
    'Write a short lyric sequence (verse to chorus) and connect transitions as musical flow.',
    'Add song fragments with hooks, imagery, and refrain links so the cluster feels like a living song sketch.',
    'Compose a rhythm-focused micro-story in lyric form using concise lines and evocative transitions.',
  ],
  analyst: [
    'Create a narrative arc (setup, tension, climax, release) and connect beats with story-relation labels.',
    'Add a character or scene progression branch and tie it into existing themes.',
    'Expand the canvas with a poetic mini-story that flows through mood shifts and visual cues.',
  ],
  'canvas-agent': [
    'Improve the canvas as a living artwork: add expressive nodes, rich color variation, and thematic links. Must use at least one creative primitive tool.',
    'Extend an existing creative cluster with painterly detail, lyrical phrases, and cohesive emotional flow.',
    'Fill an empty area with a small artistic vignette connected to nearby motifs.',
  ],
};
