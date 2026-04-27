import { describe, expect, it } from 'vitest';
import { renderActionsSection } from './actions.js';
import { renderCumulativeSection } from './cumulative.js';
import { renderDroppedSection } from './dropped.js';
import { renderNewCandidatesSection } from './new-candidates.js';
import { renderOverviewSection } from './overview.js';
import type { RenderData } from '../render.js';

const baseData: RenderData = {
  date: '2026-04-27',
  version: '0.3.0',
  eventsCollected: 22,
  candidatesGenerated: 2,
  candidatesDropped: 3,
  durationSeconds: '5.2',
  newCandidates: [
    { title: '模型路由故障识别', shortId: '68b21d20', status: 'pending', confidence: 0.5, trigger: 'pollinations API 故障诊断', note: '(no summary)' },
    { title: '未分类候选', shortId: 'f50ea43f', status: 'pending', confidence: 0.5, note: '(no summary)' },
  ],
  droppedGroups: [
    { reason: 'duplicate', label: '🔁 重复', count: 2, items: ['工具链报告测试通过但实际未在生产环境验证', '发版前必须跑完整测试矩阵'] },
    { reason: 'low_signal', label: '📉 信号太弱', count: 1, items: ['日志格式优化建议'] },
  ],
  counts: { pending: 6, reviewing: 0, shadow: 0, graduated: 0 },
  backlog: [{ id: 'sha256:68...', shortId: '68b21d20', confidence: 0.8, ageDays: 5 }],
  errors: [],
};

describe('sections', () => {
  it('overview section snapshot', () => {
    expect(renderOverviewSection(baseData)).toMatchSnapshot();
  });

  it('new candidates section snapshot', () => {
    expect(renderNewCandidatesSection(baseData)).toMatchSnapshot();
  });

  it('new candidates section empty fallback', () => {
    expect(renderNewCandidatesSection({ ...baseData, newCandidates: [], candidatesGenerated: 0 })).toMatchSnapshot();
  });

  it('dropped section snapshot', () => {
    expect(renderDroppedSection(baseData)).toMatchSnapshot();
  });

  it('dropped section empty fallback', () => {
    expect(renderDroppedSection({ ...baseData, candidatesDropped: 0, droppedGroups: [] })).toMatchSnapshot();
  });

  it('cumulative section snapshot', () => {
    expect(renderCumulativeSection(baseData)).toMatchSnapshot();
  });

  it('actions section with overdue backlog', () => {
    expect(renderActionsSection(baseData)).toMatchSnapshot();
  });

  it('actions section without overdue backlog', () => {
    expect(renderActionsSection({ ...baseData, backlog: [] })).toMatchSnapshot();
  });

  it('actions section without new candidates', () => {
    expect(renderActionsSection({ ...baseData, newCandidates: [], candidatesGenerated: 0 })).toMatchSnapshot();
  });
});
