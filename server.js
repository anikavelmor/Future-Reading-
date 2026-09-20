const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || "change-me";
const DATA = path.join(__dirname, "data");
const SITES = path.join(DATA, "sites");

fs.mkdirSync(SITES, { recursive: true });

const upload = multer({
  dest: path.join(DATA, "tmp"),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  if (req.get("x-host-password") === HOST_PASSWORD || req.body?.password === HOST_PASSWORD) return next();
  res.status(401).json({error:"Wrong host password"});
}

function safeSlug(input) {
  return (input || "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function copySafeZip(zipFile, dest) {
  const zip = new AdmZip(zipFile);
  const entries = zip.getEntries();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const raw = e.entryName.replaceAll("\\", "/");
    if (raw.startsWith("/") || raw.includes("../") || raw.includes("/..")) continue;
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) continue;
    const filename = parts[parts.length - 1].toLowerCase();
    const blocked = [".exe",".dll",".so",".dylib",".sh",".bat",".cmd",".php",".py",".pl",".cgi"];
    if (blocked.some(ext => filename.endsWith(ext))) continue;
    const out = path.join(dest, ...parts);
    if (!out.startsWith(dest + path.sep)) continue;
    fs.mkdirSync(path.dirname(out), {recursive:true});
    fs.writeFileSync(out, e.getData());
  }
}

app.get("/api/sites", auth, (req,res) => {
  const names = fs.readdirSync(SITES, {withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);
  res.json(names.map(slug => ({slug, url:`/sites/${slug}/`})));
});

app.post("/api/publish", upload.single("site"), (req,res) => {
  if (req.body.password !== HOST_PASSWORD) return res.status(401).json({error:"Wrong host password"});
  const slug = safeSlug(req.body.name);
  if (!slug) return res.status(400).json({error:"Use letters, numbers, and hyphens for the site name."});
  if (!req.file) return res.status(400).json({error:"Upload a ZIP file."});

  const dest = path.join(SITES, slug);
  fs.rmSync(dest, {recursive:true, force:true});
  fs.mkdirSync(dest, {recursive:true});

  try {
    if (req.file.originalname.toLowerCase().endsWith(".zip")) {
      copySafeZip(req.file.path, dest);
    } else {
      return res.status(400).json({error:"Only .zip website files are accepted."});
    }

    let index = path.join(dest, "index.html");
    if (!fs.existsSync(index)) {
      const candidates = [];
      function walk(dir) {
        for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
          const p = path.join(dir,item.name);
          if (item.isDirectory()) walk(p);
          else if (item.name.toLowerCase()==="index.html") candidates.push(p);
        }
      }
      walk(dest);
      if (candidates.length) fs.renameSync(candidates[0], index);
    }
    if (!fs.existsSync(index)) {
      fs.writeFileSync(index, `<h1>No index.html found</h1><p>Upload a ZIP containing index.html at the root (or inside its first folder).</p>`);
    }

    const host = req.get("host");
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    res.json({ok:true, slug, url:`${proto}://${host}/sites/${slug}/`});
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

app.delete("/api/sites/:slug", auth, (req,res) => {
  const slug = safeSlug(req.params.slug);
  fs.rmSync(path.join(SITES,slug), {recursive:true, force:true});
  res.json({ok:true});
});

app.use("/sites", express.static(SITES, {
  extensions:["html"],
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options","nosniff");
  }
}));

app.listen(PORT, () => console.log(`Dorothy Host running on port ${PORT}`));
