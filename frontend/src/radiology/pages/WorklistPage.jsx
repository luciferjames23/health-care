import React, { useEffect, useMemo, useState } from "react";
import WorklistSummaryCards from "../components/WorklistSummaryCards";
import WorklistTable from "../components/WorklistTable";
import OhifViewerModal from "../components/OhifViewerModal";
import ErrorBanner from "../components/ErrorBanner";
import { getWorklist } from "../services/radiologyApi";

const STATUS_RANK = {
  "HIGH PRIORITY": 0,
  "REVIEW FLAG": 1,
  "ROUTINE": 2,
};

function isWithinDateFilter(analyzedAt, filter) {
  if (filter === "all") return true;
  if (!analyzedAt) return false;
  const analyzedDate = new Date(analyzedAt);
  const now = new Date();
  if (filter === "today") {
    return analyzedDate.toDateString() === now.toDateString();
  }
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return analyzedDate >= sevenDaysAgo;
}

export default function WorklistPage({ onViewStudy, refreshKey }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [sortMode, setSortMode] = useState("default");
  const [ohifTarget, setOhifTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getWorklist()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load the worklist.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredAndSorted = useMemo(() => {
    if (!data?.studies) return [];
    const query = search.trim().toLowerCase();

    let items = data.studies.filter((item) => {
      if (statusFilter !== "all" && item.combined_assessment?.status !== statusFilter) return false;
      if (!isWithinDateFilter(item.analyzed_at, dateFilter)) return false;

      if (signalFilter === "densenet_positive" && !item.combined_assessment?.densenet_positive) return false;
      if (signalFilter === "yolo_detection" && !item.combined_assessment?.yolo_positive) return false;
      if (signalFilter === "disagreement" && item.combined_assessment?.agreement) return false;

      if (query) {
        const haystack = `${item.study_id} ${item.source_filename ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    items = [...items];

    const viewedRank = (item) => (item.viewed ? 1 : 0);
    const compareViewed = (a, b) => viewedRank(a) - viewedRank(b);

    if (sortMode === "probability") {
      items.sort((a, b) => compareViewed(a, b) || ((b.triage?.probability || 0) - (a.triage?.probability || 0)));
    } else if (sortMode === "date") {
      items.sort((a, b) => compareViewed(a, b) || (new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()));
    } else if (sortMode === "status") {
      items.sort((a, b) => compareViewed(a, b) || (STATUS_RANK[a.combined_assessment?.status] - STATUS_RANK[b.combined_assessment?.status]));
    }

    return items;
  }, [data, search, statusFilter, dateFilter, signalFilter, sortMode]);

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="worklist-page">
        <div className="worklist-page__intro">
          <h2>Radiology Worklist</h2>
          <p className="worklist-page__subtitle">AI-prioritized list of analysed chest X-rays</p>
          <p className="worklist-page__note">
            Studies are prioritized to help radiologists review potentially
            abnormal cases earlier. AI prioritization does not replace
            clinical judgement.
          </p>
        </div>

        {isLoading ? (
          <div className="card worklist-table__empty">
            <p>Loading worklist…</p>
          </div>
        ) : data ? (
          <>
            <WorklistSummaryCards counts={data.counts} />

            <div className="worklist-controls card">
              <input
                className="worklist-controls__search"
                type="text"
                placeholder="Search analysed studies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <label className="worklist-controls__field">
                <span>Triage status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="HIGH PRIORITY">High Priority</option>
                  <option value="REVIEW FLAG">Review Flag</option>
                  <option value="ROUTINE">Routine</option>
                </select>
              </label>

              <label className="worklist-controls__field">
                <span>Date</span>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                </select>
              </label>

              <label className="worklist-controls__field">
                <span>Model signal</span>
                <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="densenet_positive">DenseNet Positive</option>
                  <option value="yolo_detection">YOLO Detection</option>
                  <option value="disagreement">Model Disagreement</option>
                </select>
              </label>

              <label className="worklist-controls__field">
                <span>Sort by</span>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                  <option value="default">Triage Priority (default)</option>
                  <option value="probability">DenseNet Probability</option>
                  <option value="date">Study Date/Time</option>
                  <option value="status">Triage Status</option>
                </select>
              </label>
            </div>

            <WorklistTable items={filteredAndSorted} onViewStudy={onViewStudy} onOpenOhif={setOhifTarget} />
            <OhifViewerModal
              studyInstanceUID={ohifTarget?.studyInstanceUID ?? null}
              studyId={ohifTarget?.studyId}
              onClose={() => setOhifTarget(null)}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
