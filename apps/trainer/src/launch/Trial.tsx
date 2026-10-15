// WO-024 §3a /trial/<pass>: 「無料ではじめる（3日間）」. Starts that Pass's trial on this device (never restarts
// one already running or ended) and opens its first lesson; the course home if the trial has ended.
import { loadBundle } from '@lens/scenes';
import { useEffect } from 'react';
import { lessonOpen, startTrial, trialLens } from '../course/access';
import { lessonEntry } from '../course/masterclass';
import { masterclassSeen } from '../course/progress';
import { track } from './analytics';
import { navigate } from './navigate';

export function trialTarget(passId: string): string {
  const pass = loadBundle().passes?.find((p) => p.id === passId);
  const lens = trialLens(passId);
  const lesson = pass?.lessons.find((l) => l.lens === lens);
  if (!pass || !lesson) return '/';
  return lessonOpen(passId, lesson.lens) ? lessonEntry(passId, lesson, masterclassSeen(passId, lesson.lens)) : `/pass/${passId}`;
}

export function TrialStart({ passId }: { passId: string }) {
  useEffect(() => {
    if (startTrial(passId)) track({ name: 'trial_start', params: { pass: passId } });
    navigate(trialTarget(passId), { replace: true });
  }, [passId]);
  return <div className="lp2" />;
}
