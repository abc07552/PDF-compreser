import { useState } from 'react';
import {
  ArrowDownWideNarrow,
  Check,
  CheckCheck,
  ChevronDown,
  CloudUpload,
  FileStack,
  FileText,
  FolderOpen,
  LibraryBig,
  ListFilter,
  MoreHorizontal,
  Search,
  Star,
  X,
} from 'lucide-react';
import { assetUrl } from '../assets';
import { formatBytes } from '../engine/types';
import { categories, type DocumentItem } from './types';
import { useWorkspace } from './workspace';
import { Count, Head, IconButton } from './ui';
export function Cover({ d }: { d: DocumentItem }) {
  return (
    <span className={'v-cover ' + (!d.sample && !d.cover ? 'generic-cover' : '')}>
      {d.sample || d.cover ? (
        <img src={d.cover || assetUrl(`library/${d.sample}.webp`)} alt="" />
      ) : (
        <>
          <FileText size={17} />
          <small>PDF</small>
        </>
      )}
    </span>
  );
}
export function Library() {
  const w = useWorkspace(),
    [drag, setDrag] = useState(false);
  const list = w.docs
    .filter(
      (d) =>
        (w.filter !== 'Starred' || d.favorite) &&
        (w.category === 'All categories' || d.category === w.category) &&
        `${d.name} ${d.category}`.toLowerCase().includes(w.query.toLowerCase()),
    )
    .sort((a, b) =>
      w.sort === 'Recently opened'
        ? (b.opened || b.created) - (a.opened || a.created)
        : w.sort === 'Name A–Z'
          ? a.name.localeCompare(b.name)
          : w.sort === 'Largest first'
            ? b.size - a.size
            : w.sort === 'Recently processed'
              ? (b.lastRun || 0) - (a.lastRun || 0) || b.created - a.created
              : b.created - a.created,
    );
  return (
    <section
      className={'v-panel library-panel ' + (drag ? 'dragging' : '')}
      aria-label="Document library"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) void w.importFiles([...e.dataTransfer.files]);
      }}
    >
      <Head icon={LibraryBig} title="Document library" end={<Count n={w.docs.length} />} />
      <div className="lib-filters">
        <label className="v-search">
          <Search size={15} />
          <input
            aria-label="Search library"
            placeholder="Search documents…"
            value={w.query}
            onChange={(e) => w.setQuery(e.target.value)}
          />
          {w.query && <IconButton icon={X} label="Clear search" onClick={() => w.setQuery('')} />}
        </label>
        <div className="filter-bar">
          <div className="mini-tabs">
            {['All files', 'Starred'].map((t) => (
              <button
                aria-pressed={w.filter === t}
                key={t}
                className={w.filter === t ? 'selected' : ''}
                onClick={() => w.setFilter(t)}
              >
                {t === 'Starred' ? <Star size={12} /> : <FolderOpen size={13} />} {t}
              </button>
            ))}
          </div>
          <IconButton
            icon={ListFilter}
            active={w.showFilter || w.category !== 'All categories'}
            label="Filter and sort library"
            onClick={() => w.setShowFilter(!w.showFilter)}
          />
        </div>
        {w.showFilter && (
          <div className="v-filter-options">
            <label>
              Category
              <select value={w.category} onChange={(e) => w.setCategory(e.target.value)}>
                {['All categories', ...categories].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span>
                <ArrowDownWideNarrow size={12} /> Sort by
              </span>
              <select value={w.sort} onChange={(e) => w.setSort(e.target.value)}>
                {[
                  'Newest first',
                  'Recently opened',
                  'Recently processed',
                  'Largest first',
                  'Name A–Z',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="v-list-heading">
        <span>
          {w.batch
            ? 'BATCH SELECTION'
            : w.filter === 'Starred'
              ? 'STARRED DOCUMENTS'
              : w.sort === 'Newest first'
                ? 'RECENT FILES'
                : 'DOCUMENTS'}
        </span>
        {w.batch ? (
          <button onClick={() => w.setChecked(list.slice(0, 16).map((d) => d.id))}>
            Select all
          </button>
        ) : (
          <ChevronDown size={11} />
        )}
      </div>
      <div className="lib-rows">
        {list.map((d) => (
          <div key={d.id} className={'lib-row ' + (w.id === d.id ? 'selected' : '')}>
            {w.batch && (
              <input
                type="checkbox"
                checked={w.checked.includes(d.id)}
                disabled={!!w.job}
                aria-label={`Select ${d.name} for batch`}
                onChange={() => w.selectBatch(d.id)}
              />
            )}
            <button className="doc-select" aria-pressed={w.id === d.id} onClick={() => w.select(d)}>
              <Cover d={d} />
              <span className="doc-lines">
                <strong>{d.name}</strong>
                <small>
                  {formatBytes(d.size)}
                  <i /> {d.pages} pages
                </small>
                <em
                  title={`${d.category} · ${d.layer} · ${d.out ? 'Result ready' : d.lastRun ? 'Previously compressed' : 'Original'}`}
                >
                  <b className={`category-dot cat-${categories.indexOf(d.category)}`} />
                  {d.category}
                  {(d.out || d.lastRun) && <CheckCheck size={11} />}
                </em>
              </span>
            </button>
            {w.id === d.id ? (
              <button
                className="row-more"
                aria-label={`Manage ${d.name}`}
                title="Document actions"
                onClick={() => w.manage(d)}
              >
                <MoreHorizontal size={15} />
              </button>
            ) : d.favorite ? (
              <Star className="star-mark" size={11} />
            ) : null}
          </div>
        ))}
        {!list.length && (
          <div className="v-empty">
            <FileStack />
            <b>{w.ready ? 'No matching files' : 'Opening library…'}</b>
            <small>
              {w.ready ? 'Import a PDF or change your filters.' : 'Loading local documents.'}
            </small>
          </div>
        )}
      </div>
      <button className="drop-library" disabled={!!w.job} onClick={w.pick}>
        <CloudUpload size={21} />
        <span>
          <b>Drop PDFs here</b>
          <small>or click to browse</small>
        </span>
      </button>
      {w.batch && (
        <div className="batch-bar">
          <Check size={14} />
          {w.checked.length} selected
          <button
            onClick={() => {
              w.setBatch(false);
              w.setChecked([]);
            }}
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
}
