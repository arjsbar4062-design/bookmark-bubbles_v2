import { nanoid } from 'nanoid';
import { JSDOM } from 'jsdom';

// recursively parse <DL><DT><A> structure
function parseDL(dl) {
  const items = [];
  dl.querySelectorAll(':scope > DT').forEach(dt => {
    const a = dt.querySelector('a');
    const h3 = dt.querySelector('h3');
    if (a) {
      items.push({
        type: 'link',
        title: a.textContent,
        url: a.href
      });
    } else if (h3) {
      const folder = { type: 'folder', title: h3.textContent, children: [] };
      const childDL = dt.querySelector('dl');
      if (childDL) folder.children = parseDL(childDL);
      items.push(folder);
    }
  });
  return items;
}

export async function seedBookmarks(db, html) {
  const dom = new JSDOM(html);
  const dl = dom.window.document.querySelector('dl');
  const root = { type: 'folder', title: 'Root', children: parseDL(dl) };

  function insertNode(node, parent_id = null, pos = 0) {
    const id = nanoid();
    db.prepare(
      'INSERT INTO bookmarks(id,parent_id,type,title,url,position) VALUES (?,?,?,?,?,?)'
    ).run(id, parent_id, node.type, node.title, node.url || null, pos);

    if (node.type === 'folder' && node.children) {
      node.children.forEach((ch, i) => insertNode(ch, id, i));
    }
  }

  root.children.forEach((ch, i) => insertNode(ch, null, i));
}
