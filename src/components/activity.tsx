import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileClock,
  FileText,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import { formatBytes } from '../engine/types';
import type { Activity } from '../storage';
import { EmptyState, Modal, PageHead, PanelHead } from './Common';
export function metrics(all: Activity[]) {
  const a = all.filter(
    (i) => i.operation === 'Compress PDF' && (!i.status || i.status === 'success'),
  );
  const saved = a.reduce((s, i) => s + Math.max(0, i.input - i.output), 0);
  return {
    saved,
    files: a.length,
    percent: a.length
      ? Math.round(
          a.reduce((s, i) => s + ((i.input - i.output) / Math.max(1, i.input)) * 100, 0) / a.length,
        )
      : 0,
  };
}
const day = (time: number) =>
  new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const dateTime = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
function ActivityTable({ all, onDetail }: { all: Activity[]; onDetail: (a: Activity) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Operation</th>
            <th>Output size</th>
            <th>Processed</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {all.map((a) => (
            <tr key={a.id}>
              <td>
                <button className="table-file" onClick={() => onDetail(a)}>
                  <span className="file-stamp">
                    <FileText size={16} />
                  </span>
                  <b>{a.name}</b>
                </button>
              </td>
              <td>
                <span className="subtle-badge">{a.operation}</span>
              </td>
              <td>{a.status && a.status !== 'success' ? a.status : formatBytes(a.output)}</td>
              <td>{dateTime(a.at)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Details for ${a.name}`}
                  onClick={() => onDetail(a)}
                >
                  <ChevronRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RecentActivity({
  activities,
  onHistory,
  onDetail,
}: {
  activities: Activity[];
  onHistory: () => void;
  onDetail: (a: Activity) => void;
}) {
  return (
    <section className="panel recent-panel">
      <PanelHead icon={Clock3} title="Recent activity">
        <button className="small-link" onClick={onHistory}>
          View history
          <ArrowRight size={13} />
        </button>
      </PanelHead>
      {activities.length ? (
        <ActivityTable all={activities.slice(0, 3)} onDetail={onDetail} />
      ) : (
        <div className="recent-empty">
          <span>
            <FileClock size={21} />
          </span>
          <div>
            <b>A fresh workspace</b>
            <p>Your processed documents will appear here.</p>
          </div>
          <span className="local-only">LOCAL HISTORY</span>
        </div>
      )}
    </section>
  );
}
export function HistoryPage({
  activities,
  onDetail,
  onClear,
  onStudio,
}: {
  activities: Activity[];
  onDetail: (a: Activity) => void;
  onClear: () => void;
  onStudio: () => void;
}) {
  const [search, setSearch] = useState(''),
    [operation, setOperation] = useState('All operations'),
    [range, setRange] = useState('All time'),
    [limit, setLimit] = useState(25);
  const list = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) &&
          (operation === 'All operations' || a.operation === operation) &&
          (range === 'All time' ||
            a.at >= Date.now() - (range === 'Last 7 days' ? 7 : 30) * 86400000),
      ),
    [activities, search, operation, range],
  );
  return (
    <>
      <PageHead
        title="File history"
        desc="A local record of your document activity. This history contains metadata, not PDF contents."
      >
        <button className="button ghost" disabled={!activities.length} onClick={onClear}>
          <Trash2 size={15} />
          Clear history
        </button>
      </PageHead>
      <section className="panel">
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search file history"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by operation"
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          >
            {['All operations', ...new Set(activities.map((a) => a.operation))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="Filter by date"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {['All time', 'Last 7 days', 'Last 30 days'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {list.length ? (
          <>
            <ActivityTable all={list.slice(0, limit)} onDetail={onDetail} />
            <div className="table-end">
              Showing {Math.min(limit, list.length)} of {list.length} records
              {limit < list.length && (
                <button className="small-link" onClick={() => setLimit((v) => v + 25)}>
                  Show more
                </button>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            icon={History}
            title={activities.length ? 'No matching documents' : 'No activity yet'}
            desc={
              activities.length
                ? 'Try another search or filter.'
                : 'Compress a PDF or use a tool to start your local history.'
            }
            action={!activities.length ? 'Open compression studio' : undefined}
            onAction={onStudio}
          />
        )}
      </section>
    </>
  );
}
export function Insights({ activities }: { activities: Activity[] }) {
  const [span, setSpan] = useState(7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const m = metrics(activities),
    month = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const bars = Array.from({ length: span }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - span + 1 + i);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    return {
      at: d.getTime(),
      count: activities.filter((a) => a.at >= d.getTime() && a.at < end.getTime()).length,
    };
  });
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <>
      <PageHead
        title="Usage insights"
        desc="Document activity and storage savings, measured on this device."
      />
      <div className="insight-cards">
        {[
          {
            label: 'Documents today',
            val: activities.filter((a) => a.at >= today.getTime()).length,
            icon: CalendarDays,
          },
          {
            label: 'Operations this month',
            val: activities.filter((a) => a.at >= month).length,
            icon: BarChart3,
          },
          { label: 'Total storage saved', val: formatBytes(m.saved), icon: ArrowDownRight },
        ].map(({ label, val, icon: Icon }) => (
          <div className="panel insight-card" key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{val}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <PanelHead icon={BarChart3} title="Processing activity">
          <select aria-label="Chart period" value={span} onChange={(e) => setSpan(+e.target.value)}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </PanelHead>
        <div
          className="chart"
          role="img"
          aria-label={`${bars.reduce((n, b) => n + b.count, 0)} operations over ${span} days`}
        >
          {bars.map((b) => (
            <div key={b.at} title={`${day(b.at)}: ${b.count} operations`}>
              <span
                className={b.count ? 'has-data' : ''}
                style={{ height: `${Math.max(1, (b.count / max) * 93)}%` }}
              />
              {span === 7 && <small>{day(b.at)}</small>}
            </div>
          ))}
        </div>
        <p className="chart-caption">
          {activities.length
            ? 'Each recorded job counts as one operation, including failed or cancelled jobs.'
            : 'No operations recorded yet. Your real usage will appear here.'}
        </p>
      </section>
      <section className="panel insight-summary">
        <PanelHead icon={FileText} title="Compression summary" />
        <dl>
          <div>
            <dt>PDFs compressed</dt>
            <dd>{m.files}</dd>
          </div>
          <div>
            <dt>Average size reduction</dt>
            <dd>{m.percent}%</dd>
          </div>
          <div>
            <dt>Original size processed</dt>
            <dd>
              {formatBytes(
                activities
                  .filter((a) => a.operation === 'Compress PDF')
                  .reduce((s, a) => s + a.input, 0),
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel insight-summary">
        <PanelHead icon={BarChart3} title="Job outcomes & profiles" />
        <dl>
          {[
            [
              'Successful jobs',
              activities.filter((a) => !a.status || a.status === 'success').length,
            ],
            ['Failed jobs', activities.filter((a) => a.status === 'failed').length],
            ['Cancelled jobs', activities.filter((a) => a.status === 'cancelled').length],
            ...Object.entries(
              activities
                .filter((a) => a.operation === 'Compress PDF')
                .reduce<Record<string, number>>((p, a) => {
                  const k = a.profile || 'Legacy profile';
                  p[k] = (p[k] || 0) + 1;
                  return p;
                }, {}),
            ),
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
export function ActivityDetail({ record: a, onClose }: { record: Activity; onClose: () => void }) {
  return (
    <Modal title="Activity details" onClose={onClose} eyebrow="LOCAL RECORD">
      <div className="modal-body">
        <h3 className="detail-name">
          <FileText size={20} />
          {a.name}
        </h3>
        <dl className="details-list">
          {[
            ['Operation', a.operation],
            ['Original size', formatBytes(a.input)],
            ['Output size', formatBytes(a.output)],
            ['Pages', String(a.pages)],
            ['Status', a.status || 'success'],
            ['Profile', a.profile || '—'],
            ['Recorded', new Date(a.at).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="field-hint">
          This record contains metadata only. To process the document again, select the original
          file.
        </p>
      </div>
    </Modal>
  );
}
