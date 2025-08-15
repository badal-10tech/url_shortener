import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import { join } from "path";
import crypto from "crypto";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = join("data", "links.json");
const serverFile = async (res, filePath, contentType) => {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Page not found");
  }
};

const loadLinks = async () => {
  try {
    const data = await readFile(DATA_FILE, "utf-8");
    return data ? JSON.parse(data) : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(DATA_FILE, JSON.stringify({}));
      return {};
    }
    throw error;
  }
};

const saveLinks = async (links) => {
  await writeFile(DATA_FILE, JSON.stringify(links));
};

const server = createServer(async (req, res) => {
  if (req.method === "GET") {
    if (req.url === "/") {
      return serverFile(res, join("public", "index.html"), "text/html");
    } else if (req.url === "/style.css") {
      return serverFile(res, join("public", "style.css"), "text/css");
    } else {
      const links = await loadLinks();
      const shortCode = req.url.slice(1);
      if (links[shortCode]) {
        res.writeHead(302, { Location: links[shortCode] });
        return res.end();
      }
    }
  }

  if (req.method === "POST" && req.url === "/shorten") {
    const links = await loadLinks();
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const { shortCode, url } = JSON.parse(body);
      if (!url) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("URL is required");
      }
      const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");
      if (links[finalShortCode]) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Short code already exists, please choose another");
      }

      links[finalShortCode] = url;
      await saveLinks(links);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
