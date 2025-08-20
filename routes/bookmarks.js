import express from 'express';
import { nanoid } from 'nanoid';
import Database from 'better-sqlite3';
import { requireAny, requireRole } from '../utils/authMiddleware.js';

const db = new Database('/var/data/app.db');
const router = express.Router();

function fetchChildren(parentId){
  const rows = db.prepare(
    'SELECT * FROM bookmarks WHERE parent_id IS ? ORDER BY position ASC, title ASC'
  ).all(parentId);
  return rows.map(r => ({
    id: r.id, type: r.type, title: r.title, url: r.url,
    children: r.type === 'folder' ? fetchChildren(r.id) : undefined
  }));
}

router.get('/', requireAny('guest','owner'), (req,res)=>{
  const roots = fetchChildren(null);
  res.json({ root: { title: 'Root', type:'folder', children: roots }});
});

router.post('/export', requireAny('guest','owner'), (req,res)=>{
  const roots = fetchChildren(null);
  const payload = { title: 'Root', type:'folder', children: roots };
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.json"');
  res.json(payload);
});

router.post('/', requireRole('owner'), (req,res)=>{
  const { parent_id = null, type, title, url } = req.body || {};
  if (!['folder','link'].includes(type)) return res.status(400).json({error:'invalid type'});
  if (!title) return res.status(400).json({error:'title required'});
  if (type==='link' && !url) return res.status(400).json({error:'url required for link'});
  const id = nanoid();
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as p FROM bookmarks WHERE parent_id IS ?').get(parent_id).p;
  db.prepare('INSERT INTO bookmarks(id,parent_id,type,title,url,position) VALUES (?,?,?,?,?,?)')
    .run(id, parent_id, type, title, url || null, pos);
  res.json({ ok:true, id });
});

router.put('/:id', requireRole('owner'), (req,res)=>{
  const { id } = req.params;
  const { title, url } = req.body || {};
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({error:'not found'});
  if (row.type === 'folder' && url) return res.status(400).json({error:'folders cannot have url'});
  db.prepare('UPDATE bookmarks SET title = ?, url = ? WHERE id = ?')
    .run(title || row.title, url || row.url, id);
  res.json({ ok:true });
});

router.delete('/:id', requireRole('owner'), (req,res)=>{
  const { id } = req.params;
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  res.json({ ok:true });
});

export default router;
