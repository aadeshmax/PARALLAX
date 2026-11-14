import { EarthdataStatus, DatasetInfo, AnalysisMetrics, GranuleMetadata, CaseStudy } from './types';

const API_BASE = '/api';

export async function fetchEarthdataStatus(): Promise<EarthdataStatus> {
  const res = await fetch(`${API_BASE}/nasa/status`);
  if (!res.ok) throw new Error('Failed to fetch Earthdata status');
  return res.json();
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const res = await fetch(`${API_BASE}/nasa/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function fetchCases(): Promise<CaseStudy[]> {
  const res = await fetch(`${API_BASE}/analysis/cases`);
  if (!res.ok) throw new Error('Failed to fetch demonstration cases');
  return res.json();
}

export async function searchGranules(
  dataset: string,
  bbox: number[],
  startDate: string,
  endDate: string
): Promise<{ granules: GranuleMetadata[]; provenance: string }> {
  const res = await fetch(`${API_BASE}/nasa/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset,
      bbox,
      start_date: startDate,
      end_date: endDate,
      limit: 10
    })
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function runProcess(caseId: string = 'demo_flood_case'): Promise<AnalysisMetrics> {
  const res = await fetch(`${API_BASE}/nasa/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId })
  });
  if (!res.ok) throw new Error('Processing failed');
  return res.json();
}

export async function compareAnalysis(caseId: string = 'demo_flood_case'): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId })
  });
  if (!res.ok) throw new Error('Comparison failed');
  return res.json();
}
