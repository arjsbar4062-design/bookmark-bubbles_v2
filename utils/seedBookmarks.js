import { nanoid } from 'nanoid';

// Parse Netscape bookmarks export with regex
function parseBookmarks(html) {
  const lines = html.split('\n');
  const stack = [{ title: 'Root', type: 'folder', children: [] }];
  
  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('<DT><H3')) {
      const title = line.replace(/.*<H3[^>]*>(.*?)<\/H3>.*/, '$1');
      const folder = { type: 'folder', title, children: [] };
      stack[stack.length - 1].children.push(folder);
      stack.push(folder);
    } else if (line.startsWith('</DL>')) {
      stack.pop();
    } else if (line.startsWith('<DT><A')) {
      const urlMatch = line.match(/HREF="([^"]+)"/i);
      const title = line.replace(/.*<A[^>]*>(.*?)<\/A>.*/, '$1');
      stack[stack.length - 1].children.push({
        type: 'link',
        title,
        url: urlMatch ? urlMatch[1] : null
      });
    }
  });
  return stack[0];
}

export async function seedBookmarks(db, html) {
  const root = parseBookmarks(html);

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
