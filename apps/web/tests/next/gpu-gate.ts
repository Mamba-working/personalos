export type GPUObservation = { availability: string; canvasCount: number; actorCount: number; actorUUID?: string; calls?: number; frames?: number };
export function assessGPU(before: GPUObservation, after: GPUObservation) {
  if (before.availability !== 'ready' || after.availability !== 'ready') return { status:'blocked',reason:'Real WebGL is unavailable; zero canvases is only fallback evidence' } as const;
  if (before.canvasCount !== 1 || after.canvasCount !== 1 || before.actorCount !== 1 || after.actorCount !== 1 || !before.actorUUID || before.actorUUID !== after.actorUUID || !(after.calls! > 0) || !(after.frames! > 0)) return {status:'failed',reason:'Expected one rendered canvas and the same initialized Ball actor'} as const;
  return {status:'passed',reason:'Same initialized/rendered Ball actor and one canvas'} as const;
}
