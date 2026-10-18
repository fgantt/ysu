import { useState } from 'react';
import { backgroundImageUrl, BACKGROUND_ARTWORK_DESCRIPTIONS } from '../data/backgroundArtwork';
import './BackgroundGallery.css';


export function backgroundName(path: string): string {
  const filename = path.split(/[\\/]/).pop()?.split(/[?#]/)[0] ?? path;
  let name = filename.replace(/\.[^.]+$/, '');
  try { name = decodeURIComponent(name); } catch { /* Preserve unusual user filenames. */ }
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
function description(path: string): string | undefined {
  return BACKGROUND_ARTWORK_DESCRIPTIONS[path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''];
}
interface Props {
  kind: 'board' | 'wallpaper';
  images: string[];
  current: string;
  onSelect: (path: string) => void;
}
export function BackgroundGallery({ kind, images, current, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const uniqueImages = [...new Set(images)].sort((a, b) => Number(Boolean(description(b))) - Number(Boolean(description(a))));
  const matches = uniqueImages.filter(path => (!onlyNew || description(path)) && `${backgroundName(path)} ${description(path) ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const label = kind === 'board' ? 'board background' : 'wallpaper';
  return <div role="group" aria-label={`${kind === 'board' ? 'Board background' : 'Wallpaper'} gallery`} className={`background-gallery background-gallery-${kind}`}>
    {current && <div className="background-selected-preview">
      <div className="background-preview-image">
        <img src={backgroundImageUrl(current)} alt={`Current ${label}: ${backgroundName(current)}`} />
        {kind === 'board' && <div className="background-board-grid" aria-hidden="true"><span>王</span><span>歩</span><span>角</span></div>}
      </div>
      <div><span className="background-eyebrow">CURRENT {label.toUpperCase()}</span><h4>{backgroundName(current)}</h4><p>{description(current) ?? (kind === 'board' ? 'Preview the surface beneath your board grid and pieces.' : 'The backdrop behind your game and analysis windows.')}</p><small>Choose a card to apply it immediately.</small></div>
    </div>}
    <div className="background-gallery-tools">
      <label><span className="background-search-label">Find a {label}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or mood…" /></label>
      <button type="button" className="background-collection" aria-pressed={onlyNew} onClick={() => setOnlyNew(value => !value)}>New artwork</button>
    </div>
    <p className="background-count">{matches.length} of {uniqueImages.length} {kind === 'board' ? 'board backgrounds' : 'wallpapers'}</p>
    <div className="background-card-grid" aria-label={`${kind === 'board' ? 'Board background' : 'Wallpaper'} choices`}>
      {matches.map(path => <button type="button" key={path} className={`background-card ${path === current ? 'is-selected' : ''}`} aria-label={`Select ${label}: ${backgroundName(path)}`} aria-pressed={path === current} onClick={() => onSelect(path)}>
        <div className="background-card-image"><img src={backgroundImageUrl(path)} alt="" loading="lazy" />{path === current && <span className="background-check" aria-hidden="true">✓</span>}{description(path) && <span className="background-new">NEW</span>}</div>
        <span className="background-card-name">{backgroundName(path)}</span>
      </button>)}
    </div>
    {!matches.length && <p className="setting-description">{uniqueImages.length ? 'No matching images. Try another search or turn off New artwork.' : `No ${label} images are available yet.`}</p>}
  </div>;
}
