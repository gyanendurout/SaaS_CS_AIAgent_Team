'use client';

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/supabase/types';
import type { ArchiveFilters } from '@/lib/url-state';
import { DEFAULT_FILTERS } from '@/lib/url-state';
import { buildExportUrl } from '@/lib/api/archive';

interface FilterBarProps {
  filters: ArchiveFilters;
  /** Patch handler — receives an object of fields to merge into the URL. */
  onChange: (patch: Partial<ArchiveFilters>) => void;
  agents: Agent[];
}

/**
 * Top filter rail. Each control patches a single field; the parent page is
 * responsible for serializing the filters back into the URL. The search
 * input is debounced inside this component to avoid URL churn on every
 * keystroke.
 */
export function FilterBar({ filters, onChange, agents }: FilterBarProps) {
  const [searchLocal, setSearchLocal] = useState(filters.q);

  // Keep local search in sync if the URL changes externally (e.g. back btn).
  useEffect(() => {
    setSearchLocal(filters.q);
  }, [filters.q]);

  // Debounce: push search change to URL after 300ms of no typing.
  useEffect(() => {
    if (searchLocal === filters.q) return;
    const t = setTimeout(() => onChange({ q: searchLocal, page: 0 }), 300);
    return () => clearTimeout(t);
  }, [filters.q, onChange, searchLocal]);

  const reset = () => onChange({ ...DEFAULT_FILTERS });

  return (
    <div className="filterbar">
      <div className="filter filter--search">
        <label>Search</label>
        <input
          placeholder="customer · email · issue · WC-id…"
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
        />
      </div>
      <div className="filter">
        <label>Date range</label>
        <select
          value={filters.range}
          onChange={(e) => onChange({ range: e.target.value, page: 0 })}
        >
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div className="filter">
        <label>Channel</label>
        <select
          value={filters.channel}
          onChange={(e) =>
            onChange({ channel: (e.target.value as ArchiveFilters['channel']) || '', page: 0 })
          }
        >
          <option value="">All channels</option>
          <option value="voice">Voice</option>
          <option value="email">Email</option>
          <option value="web">Web form</option>
        </select>
      </div>
      <div className="filter">
        <label>Decision</label>
        <select
          value={filters.decision}
          onChange={(e) =>
            onChange({ decision: (e.target.value as ArchiveFilters['decision']) || '', page: 0 })
          }
        >
          <option value="">All decisions</option>
          <option value="ELIGIBLE_FOR_DAMAGE_REVIEW">Eligible</option>
          <option value="NOT_ELIGIBLE">Not eligible</option>
          <option value="HUMAN_REVIEW_REQUIRED">Human review</option>
          <option value="WARRANTY_EXPIRED">Warranty expired</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </div>
      <div className="filter">
        <label>Primary agent</label>
        <select
          value={filters.agent}
          onChange={(e) =>
            onChange({ agent: (e.target.value as ArchiveFilters['agent']) || '', page: 0 })
          }
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter--actions">
        <button type="button" onClick={reset}>RESET</button>
        <button
          type="button"
          className="primary"
          onClick={() => window.open(buildExportUrl(filters), '_blank', 'noopener,noreferrer')}
        >
          EXPORT CSV ⇣
        </button>
      </div>
    </div>
  );
}
