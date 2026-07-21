import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const required = ['index.html','order.html','checkout.html','portal.html','admin.html','assets/css/styles.css','data/projects.json','data/services.json','supabase/schema.sql'];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing required file: ${file}`);
}
for (const file of ['data/projects.json','data/services.json','data/posts.json','data/project-overrides.json','site.webmanifest','package.json']) {
  JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
}
const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) jsFiles.push(full);
  }
}
walk(path.join(root,'assets','js'));
walk(path.join(root,'functions'));
walk(path.join(root,'scripts'));
walk(path.join(root,'workers'));
for (const file of jsFiles) execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const projects = JSON.parse(fs.readFileSync(path.join(root,'data/projects.json'),'utf8'));
if (!projects.some(project => project.appUrl && project.websiteUrl && project.repoUrl)) throw new Error('At least one project must demonstrate website, app and source links.');
console.log(`Checks passed: ${required.length} required files, ${jsFiles.length} JavaScript modules, ${projects.length} projects.`);
