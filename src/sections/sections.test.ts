import { describe, expect, it } from 'vitest';
import { renderActionsSection } from './actions.js';
import { renderCumulativeSection } from './cumulative.js';
import { renderDroppedSection } from './dropped.js';
import { renderNewCandidatesSection } from './new-candidates.js';
import { renderOverviewSection } from './overview.js';
import type { ReportData } from '../render.js';

const baseData: ReportData = {
  date: '2026-04-27',
  version: '0.4.0',
  reflection: {
    events_collected: 1,
    candidates_generated: 0,
    candidates_dropped: 0,
    duration_seconds: 3.5,
  },
  new_candidates: [
    { id: 'sha256:68', short_id: '68b21d20', problem_category: 'model_routing_failure', state: 'pending', age_days: 1, title: '模型路由故障识别', trigger_summary: '使用 gpt-5.4 时出现启动即崩溃/400 报 schema invalid…' },
  ],
  candidates_by_state: { pending: 6, reviewing: 0, shadow: 0, graduated: 0 },
  total_candidates: 6,
  stale_backlog: [],
  dropped_groups: [
    { reason: 'duplicate', label: '🔁 重复', count: 2, items: ['工具链报告测试通过但实际未在生产环境验证', '发版前必须跑完整测试矩阵'] },
  ],
  errors: [],
  stale_days: 4,
};

describe('sections', () => {
  it('overview section snapshot', () => {
    expect(renderOverviewSection(baseData)).toMatchSnapshot();
  });

  it('new candidates section snapshot', () => {
    expect(renderNewCandidatesSection(baseData)).toMatchSnapshot();
  });

  it('new candidates section empty fallback', () => {
    expect(renderNewCandidatesSection({ ...baseData, new_candidates: [] })).toMatchSnapshot();
  });

  it('dropped section snapshot', () => {
    expect(renderDroppedSection({ candidatesDropped: 2, droppedGroups: baseData.dropped_groups })).toMatchSnapshot();
  });

  it('dropped section empty fallback', () => {
    expect(renderDroppedSection({ candidatesDropped: 0, droppedGroups: [] })).toMatchSnapshot();
  });

  it('cumulative section snapshot', () => {
    expect(renderCumulativeSection(baseData)).toMatchSnapshot();
  });

  it('actions section snapshot', () => {
    expect(renderActionsSection(baseData)).toMatchSnapshot();
  });
});
