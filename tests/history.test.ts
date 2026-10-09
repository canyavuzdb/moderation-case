import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/lib/store';

test('Karar ve açıklama değişiklikleri sıralı ve kalıcı; aynı kayıt tekrar eklenmez', () => {
  const dir = mkdtempSync(join(tmpdir(), 'history-'));
  const path = join(dir, 'test.db');
  let store = openStore(path);
  try {
    const comment = store.create('Teşekkürler');
    assert.deepEqual(comment.history, []);
    assert.throws(() => store.decide(comment.id, 'rejected', ''));
    assert.equal(store.get(comment.id)?.history.length, 0);
    store.decide(comment.id, 'approved', 'İlk karar');
    store.decide(comment.id, 'rejected', 'Bağlam yeniden incelendi');
    store.decide(comment.id, 'rejected', 'Açıklama düzeltildi');
    store.decide(comment.id, 'rejected', 'Açıklama düzeltildi');
    store.close(); store = openStore(path);
    const current = store.get(comment.id)!;
    assert.equal(current.history.length, 3);
    assert.deepEqual(current.history.map(e => e.decision), ['rejected', 'rejected', 'approved']);
    assert.deepEqual(current.history.map(e => e.note), ['Açıklama düzeltildi', 'Bağlam yeniden incelendi', 'İlk karar']);
    assert.equal(current.history[0].decidedAt, current.decidedAt);
    assert.ok(current.history.every(e => !e.legacy));
    assert.deepEqual(current.assessment, comment.assessment);
  } finally { store.close(); rmSync(dir, {recursive:true, force:true}); }
});
test('Eski son karar bir defa başlangıç kaydı olarak taşınır', () => {
  const dir = mkdtempSync(join(tmpdir(), 'legacy-'));
  const path = join(dir, 'test.db');
  let store = openStore(path);
  const comment = store.create('Teşekkürler');
  store.close();
  const db = new DatabaseSync(path);
  db.prepare('UPDATE comments SET decision=?, note=?, decided_at=? WHERE id=?').run('approved', 'Eski açıklama', '2026-10-09T12:00:00.000Z', comment.id);
  db.close();
  store = openStore(path);
  try {
    assert.equal(store.get(comment.id)?.history[0].legacy, true);
    assert.equal(store.get(comment.id)?.history[0].note, 'Eski açıklama');
    store.close(); store = openStore(path);
    assert.equal(store.get(comment.id)?.history.length, 1);
    store.decide(comment.id, 'rejected', 'Karar değişti');
    assert.deepEqual(store.get(comment.id)?.history.map(e => e.legacy), [false, true]);
  } finally { store.close(); rmSync(dir, {recursive:true, force:true}); }
});
test('Güncel karar yazılamazsa geçmiş kaydı da geri alınır', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-'));
  const path = join(dir, 'test.db');
  const store = openStore(path);
  try {
    const comment = store.create('Teşekkürler');
    const db = new DatabaseSync(path);
    db.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON comments BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    db.close();
    assert.throws(() => store.decide(comment.id, 'approved'));
    assert.deepEqual(store.get(comment.id), comment);
  } finally { store.close(); rmSync(dir, {recursive:true, force:true}); }
});
