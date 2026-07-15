/**
 * Tiny dependency-free markdown helpers.
 * renderMarkdown — good-enough HTML for the note panel (headings, lists,
 * emphasis, code, quotes, wikilinks-as-clickable-spans).
 * plainText     — flattens a note to readable text for the interior scene.
 */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(md) {
  return md
    .replace(/!?\[\[([^\][|#]+)(?:#[^\][|]*)?(?:\|([^\][]*))?\]\]/g, (_, target, alias) =>
      `<span class="wikilink" data-target="${escapeHtml(target.trim())}">${escapeHtml((alias || target).trim())}</span>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderMarkdown(md) {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const out = [];
  const lines = md.split('\n');
  let list = false;
  let code = false;
  for (const raw of lines) {
    if (raw.startsWith('```')) {
      if (code) { out.push('</pre>'); code = false; } else { out.push('<pre>'); code = true; }
      continue;
    }
    if (code) { out.push(escapeHtml(raw)); continue; }
    const line = escapeHtml(raw);
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li && !list) { out.push('<ul>'); list = true; }
    if (!li && list) { out.push('</ul>'); list = false; }
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (li) out.push(`<li>${inline(li[1])}</li>`);
    else if (line.startsWith('&gt;')) out.push(`<blockquote>${inline(line.slice(4))}</blockquote>`);
    else if (line.trim() === '') out.push('');
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  if (code) out.push('</pre>');
  return out.join('\n');
}

export function plainText(md) {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[\[([^\][|#]+)(?:#[^\][|]*)?(?:\|([^\][]*))?\]\]/g, (_, t, a) => (a || t).trim())
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
