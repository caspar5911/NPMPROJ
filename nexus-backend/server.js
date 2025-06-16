require('dotenv').config();

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Configuration ----------
const PACKAGES_DIR = path.resolve(__dirname, '..', 'packages');
const { NEXUS_USERNAME, NEXUS_PASSWORD } = process.env;

// ---------- Helpers ----------

function ensurePackagesFolder() {
  if (!fs.existsSync(PACKAGES_DIR)) {
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  }
  return PACKAGES_DIR;
}

function createNpmrc(registryUrl) {
  const registry = new URL(registryUrl);
  const registryHostPath = `${registry.host}${registry.pathname.replace(/\/$/, '')}`;
  const encodedPassword = Buffer.from(NEXUS_PASSWORD).toString('base64');

  const npmrcContent = [
    `registry=${registryUrl}`,
    `//${registryHostPath}/:username=${NEXUS_USERNAME}`,
    `//${registryHostPath}/:_password=${encodedPassword}`,
    `//${registryHostPath}/:email=you@example.com`,
    `//${registryHostPath}/:always-auth=true`
  ].join('\n');

  const npmrcPath = path.join(PACKAGES_DIR, '.npmrc');
  fs.writeFileSync(npmrcPath, npmrcContent);
  return npmrcPath;
}

function deleteNpmrc() {
  const npmrcPath = path.join(PACKAGES_DIR, '.npmrc');
  if (fs.existsSync(npmrcPath)) {
    fs.unlinkSync(npmrcPath);
  }
}

function npmPack(packageSpec) {
  return new Promise((resolve, reject) => {
    const cwd = ensurePackagesFolder();
    const cmd = `npm pack ${packageSpec} --registry=https://registry.npmjs.org/`;

    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      const filename = stdout.trim().split('\n').pop();
      resolve(path.join(cwd, filename));
    });
  });
}

function npmPublishTarball(tarballPath, registryUrl) {
  return new Promise((resolve, reject) => {
    if (!NEXUS_USERNAME || !NEXUS_PASSWORD) {
      return reject(new Error('Missing NEXUS_USERNAME or NEXUS_PASSWORD in .env'));
    }

    if (!fs.existsSync(tarballPath)) {
      return reject(new Error(`Tarball not found at path: ${tarballPath}`));
    }

    const npmrcPath = createNpmrc(registryUrl);

    const normalizedTarballPath = path.normalize(tarballPath);
    const cmd = `npm publish ${normalizedTarballPath} --registry=${registryUrl} --userconfig="${npmrcPath}" --no-provenance`;

    exec(cmd, (err, stdout, stderr) => {
      deleteNpmrc(); // cleanup
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

// ---------- Routes ----------

app.post('/api/pack', async (req, res) => {
  const { packageName, version } = req.body;
  if (!packageName) return res.status(400).json({ error: 'Package name is required' });

  try {
    const spec = version ? `${packageName}@${version}` : packageName;
    const tarballPath = await npmPack(spec);
    res.json({ message: 'Pack successful', tarballPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publish', async (req, res) => {
  const { tarballPath, registryUrl } = req.body;
  if (!tarballPath || !registryUrl) {
    return res.status(400).json({ error: 'tarballPath and registryUrl are required' });
  }

  try {
    const output = await npmPublishTarball(tarballPath, registryUrl);
    res.json({ message: 'Publish successful', output });
  } catch (err) {
    console.error('Publish error detail:', err);

    // Handle duplicate version error
    const msg = err.message || err.toString();
    if (msg.includes('You cannot publish over the previously published versions')) {
      return res.status(409).json({ error: 'This version already exists in the registry.' });
    }

    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
