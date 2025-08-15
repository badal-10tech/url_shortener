import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join("data", "links.json");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Create data folder if missing
const ensureDataDir = async () => {
  try {
    await fs.mkdir("data", { recursive: true });
  } catch {}
};

// Sanitize short codes
const sanitizeShortCode = (code) =>
  code
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");

// Load saved links
const loadLinks = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    return data ? JSON.parse(data) : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(DATA_FILE, JSON.stringify({}));
      return {};
    }
    throw error;
  }
};

// Save links
const saveLinks = async (links) =>
  await fs.writeFile(DATA_FILE, JSON.stringify(links, null, 2));

// Homepage
app.get("/", async (req, res) => {
  try {
    const file = await fs.readFile(path.join("view", "index.html"), "utf-8");
    const links = await loadLinks();

    const content = file.replaceAll(
      "{{shortened_urls}}",
      Object.entries(links)
        .map(
          ([shortCode, url]) => `
          <div class="link-item">
            <a class="short-link" href="/${encodeURIComponent(
              shortCode
            )}" target="_blank">${req.get("host")}/${shortCode}</a>
            <span class="gap"></span>
            <a class="original-link" href="${url}" target="_blank">${url}</a>
          </div>`
        )
        .join("")
    );

    return res.send(content);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
});

// Redirect
app.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params;
    const links = await loadLinks();

    if (!links[shortCode]) {
      return res.status(404).send("404: Link not found");
    }
    return res.redirect(links[shortCode]);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
});

// Create short link
app.post("/", async (req, res) => {
  try {
    let { shortCode, url } = req.body;

    // Ensure URL starts with http/https
    if (!/^https?:\/\//i.test(url)) {
      url = "http://" + url;
    }

    // Auto-generate if invalid
    if (
      !shortCode ||
      shortCode.length > 20 ||
      /^https?:\/\//i.test(shortCode)
    ) {
      shortCode = crypto.randomBytes(4).toString("hex");
    } else {
      shortCode = sanitizeShortCode(shortCode);
    }

    const links = await loadLinks();

    if (links[shortCode]) {
      return res.status(400).send("Short code already exists");
    }

    links[shortCode] = url;
    await saveLinks(links);

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

// Start server
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});
