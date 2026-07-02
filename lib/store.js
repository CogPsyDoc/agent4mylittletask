// 사용자가 붙인 정리 메타데이터(커스텀 제목/태그/폴더/즐겨찾기/메모)를
// 간단한 JSON 파일에 저장한다. sessionId -> meta.
// (별도 DB 없이 solo 사용에 충분하고 이식이 쉽다.)

import fs from 'node:fs';
import path from 'node:path';

export class MetaStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {};
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = JSON.parse(raw) || {};
    } catch {
      this.data = {};
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  get(id) {
    return this.data[id] || { customTitle: '', tags: [], folder: '', favorite: false, notes: '' };
  }

  update(id, patch) {
    const cur = this.get(id);
    const next = { ...cur, ...patch };
    // 태그는 배열로 정규화
    if (patch.tags != null) {
      next.tags = Array.isArray(patch.tags)
        ? patch.tags
        : String(patch.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }
    this.data[id] = next;
    this._save();
    return next;
  }

  all() {
    return this.data;
  }
}
