require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.json());

const PACKAGES_DIR = path.resolve(__dirname, '..', 'packages');
const { NEXUS_USERNAME, NEXUS_PASSWORD } = process.env;

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
    `always-auth=true`,
    `//${registryHostPath}/:username=${NEXUS_USERNAME}`,
    `//${registryHostPath}/:_password=${encodedPassword}`,
    `//${registryHostPath}/:email=you@example.com`
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
    const cmd = `npm publish "${normalizedTarballPath}" --registry=${registryUrl} --userconfig="${npmrcPath}" --no-provenance --tag old`;

    exec(cmd, (err, stdout, stderr) => {
      deleteNpmrc(); // cleanup
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

async function publishAllTarballs(registryUrl) {
  const folder = PACKAGES_DIR;
  const allFiles = fs.readdirSync(folder);
  const tarballs = allFiles.filter(f => f.endsWith('.tgz')).map(f => path.join(folder, f));

  if (tarballs.length === 0) {
    throw new Error('No .tgz tarballs found to publish.');
  }

  const results = [];

  for (const tarballPath of tarballs) {
    try {
      const output = await npmPublishTarball(tarballPath, registryUrl);
      results.push({ tarball: path.basename(tarballPath), status: 'success', output });
    } catch (err) {
      const errStr = (typeof err === 'string') ? err : (err.message || err.toString());
      if (errStr.includes('You cannot publish over the previously published versions')) {
        results.push({
          tarball: path.basename(tarballPath),
          status: 'error',
          error: 'This version already exists in the registry.',
        });
        continue;
      }
      results.push({
        tarball: path.basename(tarballPath),
        status: 'error',
        error: errStr || 'Unknown error',
      });
    }
  }

  return results;
}

// ---------- Routes ----------

app.post('/api/publish-all', async (req, res) => {
  const { registryUrl } = req.body;
  if (!registryUrl) {
    return res.status(400).json({ error: 'registryUrl is required' });
  }

  try {
    const results = await publishAllTarballs(registryUrl);
    res.json({ message: 'Publish all completed.', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/list-tarballs', (req, res) => {
  const folder = PACKAGES_DIR;
  fs.readdir(folder, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read tarballs folder' });
    }
    const tarballs = files
      .filter((f) => f.endsWith('.tgz'))
      .map((f) => path.join(folder, f));
    res.json({ tarballs });
  });
});

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
    const msg = err.message || err.toString();
    if (msg.includes('You cannot publish over the previously published versions')) {
      return res.status(409).json({ error: 'This version already exists in the registry.' });
    }
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// ✅ FIXED: Properly handle and register this router
router.post('/api/pack-from-packagejson', upload.single('packageJson'), async (req, res) => {
  console.log('Received /api/pack-from-packagejson request body:', req.body);

  const packageJson = req.file;
  if (!packageJson) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let parsedJson;
  try {
    const content = fs.readFileSync(packageJson.path, 'utf-8');
    parsedJson = JSON.parse(content);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON file uploaded' });
  } finally {
    fs.unlinkSync(packageJson.path);
  }

  const dependencies = {
    ...(parsedJson.dependencies || {}),
    ...(parsedJson.devDependencies || {}),
  };

  if (Object.keys(dependencies).length === 0) {
    return res.status(400).json({ error: 'No dependencies or devDependencies found in package.json' });
  }

  const results = [];

  for (const [pkg, version] of Object.entries(dependencies)) {
    const spec = typeof version === 'string' && version.startsWith('file:') ? pkg : `${pkg}@${version}`;
    try {
      const tarballPath = await npmPack(spec);
      results.push({ package: pkg, version, status: 'success', tarballPath });
    } catch (err) {
      results.push({ package: pkg, version, status: 'error', error: err.toString() });
    }
  }

  res.json({ results });
});

// ✅ IMPORTANT: Register router so above route works
app.use(router);

// ---------- Start Server ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
